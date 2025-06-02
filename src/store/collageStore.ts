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
    const channel = supabase
      .channel(`photos:${collageId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        async (payload) => {
          if (payload.new) {
            const newPhoto = payload.new as Photo;
            
            // Add new photo without duplicates
            set((state) => {
              const exists = state.photos.some(p => p.id === newPhoto.id);
              if (exists) return state;
              
              // Add new photo to the beginning to maintain newest-first order
              return {
                photos: [newPhoto, ...state.photos]
              };
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          if (payload.old) {
            set((state) => ({
              photos: state.photos.filter(p => p.id !== payload.old.id)
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  deletePhoto: async (photoId: string) => {
    // Optimistically remove from state
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

      // Extract file path from URL
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

      const deletePromises = [];
      
      // Delete from storage if we have a valid path
      if (filePath) {
        deletePromises.push(
          supabase.storage.from('photos').remove([filePath])
        );
      }

      // Delete from database
      deletePromises.push(
        supabase.from('photos').delete().eq('id', photoId)
      );

      await Promise.allSettled(deletePromises);

      set({ error: null });
    } catch (error: any) {
      // Restore photo on error
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

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          duplex: 'half'
        });

      if (uploadError) throw uploadError;

      const publicUrl = getFileUrl('photos', filePath);

      // Insert into database
      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert([{
          collage_id: collageId,
          url: publicUrl
        }])
        .select()
        .single();

      if (insertError) {
        await supabase.storage.from('photos').remove([filePath]);
        throw insertError;
      }

      const newPhoto = photoData as Photo;
      
      // Add to state immediately (realtime subscription will handle deduplication)
      set((state) => {
        const exists = state.photos.some(p => p.id === newPhoto.id);
        if (exists) return state;
        
        return {
          photos: [newPhoto, ...state.photos]
        };
      });
      
      return newPhoto;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to upload photo'
      });
      return null;
    }
  },

  fetchPhotosByCollageId: async (collageId: string) => {
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