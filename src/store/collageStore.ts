import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { supabase, getFileUrl, addCacheBustToUrl, normalizeFileExtension } from '../lib/supabase';
import { defaultSettings, type SceneSettings } from './sceneStore';

type Collage = {
  id: string;
  code: string;
  name: string;
  user_id?: string;
  created_at: string;
  settings?: SceneSettings;
};

type Photo = {
  id: string;
  collage_id: string;
  url: string;
  created_at: string;
};

type CollageState = {
  collages: Collage[];
  currentCollage: Collage | null;
  photos: Photo[];
  loading: boolean;
  error: string | null;
  deletePhoto: (photoId: string) => Promise<void>;
  subscribeToPhotos: (collageId: string) => () => void;
  
  fetchCollages: () => Promise<void>;
  fetchCollageByCode: (code: string) => Promise<Collage | null>;
  fetchCollageById: (id: string) => Promise<Collage | null>;
  createCollage: (name: string) => Promise<Collage | null>;
  updateCollageSettings: (collageId: string, settings: Partial<SceneSettings>) => Promise<any>;
  uploadPhoto: (collageId: string, file: File) => Promise<Photo | null>;
  fetchPhotosByCollageId: (collageId: string) => Promise<void>;
};

// Optimized batch processing for better performance
const BATCH_SIZE = 20; // Increased batch size for better throughput
const BATCH_DELAY = 50; // Reduced delay for faster updates
let photoUpdateQueue: Photo[] = [];
let updateTimeout: NodeJS.Timeout | null = null;
let isProcessingBatch = false;

const processBatchUpdate = (set: any) => {
  if (photoUpdateQueue.length === 0 || isProcessingBatch) return;
  
  isProcessingBatch = true;
  const batch = photoUpdateQueue.splice(0, BATCH_SIZE);
  
  // Use requestAnimationFrame for smoother updates
  requestAnimationFrame(() => {
    set((state: CollageState) => {
      const existingIds = new Set(state.photos.map(p => p.id));
      const newPhotos = batch.filter(p => !existingIds.has(p.id));
      
      if (newPhotos.length === 0) {
        isProcessingBatch = false;
        if (photoUpdateQueue.length > 0) {
          updateTimeout = setTimeout(() => processBatchUpdate(set), BATCH_DELAY);
        }
        return state; // No changes needed
      }
      
      const updatedPhotos = [...state.photos, ...newPhotos].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      isProcessingBatch = false;
      
      // Schedule next batch if there are more items
      if (photoUpdateQueue.length > 0) {
        updateTimeout = setTimeout(() => processBatchUpdate(set), BATCH_DELAY);
      }
      
      return { photos: updatedPhotos };
    });
  });
};

// Deep merge utility function
const deepMerge = (target: any, source: any): any => {
  if (!source) return target;
  const output = { ...target };
  
  Object.keys(source).forEach(key => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(output[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  
  return output;
};

export const useCollageStore = create<CollageState>((set, get) => ({
  collages: [],
  currentCollage: null,
  photos: [],
  loading: false,
  error: null,

  subscribeToPhotos: (collageId: string) => {
    const subscription = supabase
      .channel(`photos:${collageId}`)
      .on(
        'postgres_changes',
        [
          {
            event: 'INSERT',
            schema: 'public',
            table: 'photos',
            filter: `collage_id=eq.${collageId}`
          },
          {
            event: 'DELETE',
            schema: 'public',
            table: 'photos',
            filter: `collage_id=eq.${collageId}`
          }
        ],
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            // Handle deletions immediately for responsiveness
            set((state) => ({
              photos: state.photos.filter(p => p.id !== payload.old.id)
            }));
            return;
          }

          if (payload.eventType === 'INSERT' && payload.new) {
            const photo = {
              ...payload.new,
              url: normalizeFileExtension(payload.new.url) // Don't add cache bust here for better performance
            } as Photo;
            
            // Add to queue for batch processing
            photoUpdateQueue.push(photo);
            
            // Start batch processing if not already running
            if (!updateTimeout && !isProcessingBatch) {
              updateTimeout = setTimeout(() => {
                updateTimeout = null;
                processBatchUpdate(set);
              }, BATCH_DELAY);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (updateTimeout) {
        clearTimeout(updateTimeout);
        updateTimeout = null;
      }
      photoUpdateQueue = [];
      isProcessingBatch = false;
    };
  },

  deletePhoto: async (photoId: string) => {
    // Optimistic update - remove from UI immediately
    set(state => ({
      photos: state.photos.filter(p => p.id !== photoId)
    }));

    try {
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('*')
        .eq('id', photoId)
        .single();

      if (fetchError) throw fetchError;

      let filePath = '';
      try {
        const url = new URL(photo.url);
        const pathParts = url.pathname.split('/');
        const publicIndex = pathParts.indexOf('public');
        if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
          filePath = pathParts.slice(publicIndex + 2).join('/');
        }
      } catch (err) {
        console.warn('Failed to parse photo URL:', photo.url, err);
      }

      // Delete from storage and database in parallel
      const deletePromises = [];
      
      if (filePath) {
        deletePromises.push(
          supabase.storage.from('photos').remove([filePath])
        );
      }

      deletePromises.push(
        supabase.from('photos').delete().eq('id', photoId)
      );

      await Promise.allSettled(deletePromises);

      set({ error: null });
    } catch (error: any) {
      // Revert optimistic update on error
      const { data: photos } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', get().currentCollage?.id)
        .order('created_at', { ascending: false });

      set({ 
        photos: (photos || []) as Photo[],
        error: error.message || 'Failed to delete photo'
      });
      throw error;
    }
  },

  fetchCollages: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('collages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ collages: data as Collage[], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchCollageByCode: async (code: string) => {
    set({ loading: true, error: null });
    try {
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('*')
        .eq('code', code)
        .single();

      if (collageError) throw collageError;

      const { data: settings } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', collage.id)
        .single();

      const collageWithSettings = {
        ...collage,
        settings: settings?.settings ? deepMerge(defaultSettings, settings.settings) : defaultSettings
      } as Collage;

      set({ currentCollage: collageWithSettings, loading: false });
      
      // Fetch photos without blocking
      get().fetchPhotosByCollageId(collage.id);
      
      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  fetchCollageById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('*')
        .eq('id', id)
        .single();

      if (collageError) throw collageError;

      const { data: settings } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', id)
        .single();

      const collageWithSettings = {
        ...collage,
        settings: settings?.settings ? deepMerge(defaultSettings, settings.settings) : defaultSettings
      } as Collage;

      set({ currentCollage: collageWithSettings, loading: false });
      
      // Fetch photos without blocking
      get().fetchPhotosByCollageId(collage.id);
      
      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  createCollage: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const code = nanoid(6).toLowerCase();
      
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .insert([{ name, code }])
        .select()
        .single();

      if (collageError) throw collageError;

      const newCollage = { 
        ...collage,
        settings: defaultSettings 
      } as Collage;

      set({ 
        collages: [...get().collages, newCollage],
        loading: false,
        currentCollage: newCollage,
        error: null
      });

      return newCollage;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  updateCollageSettings: async (collageId: string, newSettings: Partial<SceneSettings>) => {
    try {
      const { data: existingData } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', collageId)
        .single();

      // Initialize current settings by deep merging default settings with existing settings
      const currentSettings = deepMerge(defaultSettings, existingData?.settings || {});

      // Handle pattern changes
      if (newSettings.animationPattern && newSettings.animationPattern !== currentSettings.animationPattern) {
        Object.keys(currentSettings.patterns || {}).forEach(pattern => {
          if (currentSettings.patterns[pattern as keyof typeof currentSettings.patterns]) {
            currentSettings.patterns[pattern as keyof typeof currentSettings.patterns].enabled = 
              pattern === newSettings.animationPattern;
          }
        });
      }

      // Deep merge the current settings with new settings
      const mergedSettings = deepMerge(currentSettings, newSettings);

      const { data, error } = await supabase
        .from('collage_settings')
        .upsert({
          collage_id: collageId,
          settings: mergedSettings
        }, {
          onConflict: 'collage_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state without triggering scene refresh
      set(state => ({
        currentCollage: state.currentCollage ? {
          ...state.currentCollage,
          settings: mergedSettings
        } : null
      }));

      return data;
    } catch (error: any) {
      console.error('Failed to update collage settings:', error.message);
      throw error;
    }
  },

  uploadPhoto: async (collageId: string, file: File) => {
    // Don't set loading state to avoid UI disruption
    try {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        throw new Error('Invalid file type. Only images are supported.');
      }

      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('code')
        .eq('id', collageId)
        .single();

      if (collageError) throw collageError;

      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const fileName = `${nanoid()}.${fileExt}`;
      const filePath = `${collage.code}/${fileName}`;

      // Upload file with optimized settings
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false, // Don't overwrite, use unique names
          duplex: 'half' // Optimize for upload performance
        });

      if (uploadError) throw uploadError;

      const publicUrl = getFileUrl('photos', filePath);

      // Insert photo record
      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert([{
          collage_id: collageId,
          url: publicUrl
        }])
        .select()
        .single();

      if (insertError) {
        // Clean up uploaded file on database error
        await supabase.storage.from('photos').remove([filePath]);
        throw insertError;
      }

      const newPhoto = photoData as Photo;
      
      // Don't update local state here - let real-time subscription handle it
      // This prevents double-adding and ensures consistency
      
      return newPhoto;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to upload photo'
      });
      return null;
    }
  },

  fetchPhotosByCollageId: async (collageId: string) => {
    // Don't set loading state for background photo fetching
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      set({ photos: data as Photo[], error: null });
    } catch (error: any) {
      set({ error: error.message });
    }
  }
}));