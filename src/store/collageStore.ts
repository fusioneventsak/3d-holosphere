// src/store/collageStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { nanoid } from 'nanoid';
import { RealtimeChannel } from '@supabase/supabase-js';

// Helper function to get file URL
const getFileUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// Helper for deep merging objects
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

// Default scene settings
const defaultSettings = {
  animationPattern: 'grid_wall',
  photoCount: 100,
  animationSpeed: 50,
  cameraDistance: 15,
  cameraHeight: 8,
  cameraRotationSpeed: 20,
  photoSize: 1.0,
  photoBrightness: 1.0,
  backgroundColor: '#000000',
  backgroundGradient: true,
  backgroundGradientStart: '#1a1a2e',
  backgroundGradientEnd: '#16213e',
  backgroundGradientAngle: 45,
  floorColor: '#111111',
  showFloor: true,
  showGrid: true,
  ambientLightIntensity: 0.4,
  spotlightIntensity: 0.8,
  patterns: {
    grid_wall: { enabled: true },
    float: { enabled: false },
    wave: { enabled: false },
    spiral: { enabled: false }
  }
};

export interface Photo {
  id: string;
  collage_id: string;
  url: string;
  created_at: string;
}

export interface Collage {
  id: string;
  name: string;
  code: string;
  created_at: string;
  settings: any;
}

export interface SceneSettings {
  animationPattern?: string;
  patterns?: any;
  [key: string]: any;
}

interface CollageStore {
  // State
  photos: Photo[];
  currentCollage: Collage | null;
  loading: boolean;
  error: string | null;
  collages: Collage[];
  realtimeChannel: RealtimeChannel | null;

  // Actions
  fetchCollages: () => Promise<void>;
  fetchCollageByCode: (code: string) => Promise<Collage | null>;
  fetchCollageById: (id: string) => Promise<Collage | null>;
  createCollage: (name: string) => Promise<Collage | null>;
  updateCollageSettings: (collageId: string, settings: Partial<SceneSettings>) => Promise<any>;
  uploadPhoto: (collageId: string, file: File) => Promise<Photo | null>;
  deletePhoto: (photoId: string) => Promise<void>;
  fetchPhotosByCollageId: (collageId: string) => Promise<void>;
  
  // Realtime methods - CRITICAL for photobooth sync
  setupRealtimeSubscription: (collageId: string) => void;
  cleanupRealtimeSubscription: () => void;
  addPhotoToState: (photo: Photo) => void;
  removePhotoFromState: (photoId: string) => void;
}

export const useCollageStore = create<CollageStore>((set, get) => ({
  // Initial state
  photos: [],
  currentCollage: null,
  loading: false,
  error: null,
  collages: [],
  realtimeChannel: null,

  // Add photo to state (called by realtime subscription)
  addPhotoToState: (photo: Photo) => {
    set((state) => {
      // Prevent duplicates
      const exists = state.photos.some(p => p.id === photo.id);
      if (exists) {
        console.log('🔄 Photo already exists in state:', photo.id);
        return state;
      }
      
      console.log('✅ Adding new photo to state via realtime:', photo.id);
      return {
        photos: [photo, ...state.photos] // Add to beginning for newest first
      };
    });
  },

  // Remove photo from state (called by realtime subscription)
  removePhotoFromState: (photoId: string) => {
    console.log('🗑️ Removing photo from state via realtime:', photoId);
    set((state) => ({
      photos: state.photos.filter(p => p.id !== photoId)
    }));
  },

  // Setup realtime subscription - THIS IS THE KEY FUNCTION
  setupRealtimeSubscription: (collageId: string) => {
    const currentChannel = get().realtimeChannel;
    
    // Clean up existing subscription first
    if (currentChannel) {
      console.log('🧹 Cleaning up existing realtime subscription');
      supabase.removeChannel(currentChannel);
    }

    console.log('🚀 Setting up NEW realtime subscription for collage:', collageId);

    // Capture current state functions to avoid stale closures
    const store = get();

    const channel = supabase
      .channel(`photos-${collageId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          console.log('🔔 Realtime: New photo inserted:', payload.new);
          // Get fresh store reference to avoid stale state
          const currentStore = get();
          currentStore.addPhotoToState(payload.new as Photo);
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
          console.log('🔔 Realtime: Photo deleted:', payload.old);
          // Get fresh store reference to avoid stale state
          const currentStore = get();
          currentStore.removePhotoFromState(payload.old.id);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription ACTIVE for collage:', collageId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription ERROR for collage:', collageId);
        }
      });

    set({ realtimeChannel: channel });
  },

  // Clean up realtime subscription
  cleanupRealtimeSubscription: () => {
    const currentChannel = get().realtimeChannel;
    if (currentChannel) {
      console.log('🧹 Cleaning up realtime subscription');
      supabase.removeChannel(currentChannel);
      set({ realtimeChannel: null });
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
      
      // CRITICAL: Fetch photos and setup realtime subscription
      await get().fetchPhotosByCollageId(collage.id);
      
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
      
      // CRITICAL: Fetch photos and setup realtime subscription
      await get().fetchPhotosByCollageId(id);
      
      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  createCollage: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const code = nanoid(8).toUpperCase();
      
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .insert([{ name, code }])
        .select()
        .single();

      if (collageError) throw collageError;

      const { data: settings, error: settingsError } = await supabase
        .from('collage_settings')
        .insert([{ 
          collage_id: collage.id, 
          settings: defaultSettings 
        }])
        .select()
        .single();

      if (settingsError) throw settingsError;

      const collageWithSettings = {
        ...collage,
        settings: defaultSettings
      } as Collage;

      set((state) => ({
        collages: [collageWithSettings, ...state.collages],
        loading: false
      }));

      return collageWithSettings;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  updateCollageSettings: async (collageId: string, settings: Partial<SceneSettings>) => {
    try {
      const currentCollage = get().currentCollage;
      if (!currentCollage) throw new Error('No current collage');

      const mergedSettings = deepMerge(currentCollage.settings, settings);

      const { data, error } = await supabase
        .from('collage_settings')
        .update({ settings: mergedSettings })
        .eq('collage_id', collageId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
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

  // Upload photo (called from photobooth/uploader) - CRITICAL FOR REALTIME SYNC
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

      // Insert into database - realtime subscription will handle UI update
      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert([{
          collage_id: collageId,
          url: publicUrl
        }])
        .select()
        .single();

      if (insertError) {
        // Clean up storage if database insert failed
        await supabase.storage.from('photos').remove([filePath]);
        throw insertError;
      }

      const newPhoto = photoData as Photo;
      
      // IMPORTANT: Don't manually add to state here!
      // Let the realtime subscription handle it to ensure consistency across components
      console.log('📸 Photo uploaded successfully:', newPhoto.id);
      console.log('🔔 Realtime subscription should pick this up automatically...');
      
      set({ error: null });
      return newPhoto;
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      set({ 
        error: error.message || 'Failed to upload photo'
      });
      return null;
    }
  },

  // Delete photo (called from moderation)
  deletePhoto: async (photoId: string) => {
    try {
      // Get photo data first to extract file path
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('url')
        .eq('id', photoId)
        .single();

      if (fetchError) throw fetchError;

      // Extract file path from URL for storage deletion
      let filePath = '';
      if (photo?.url) {
        try {
          const url = new URL(photo.url);
          // Get the path after /storage/v1/object/public/photos/
          const pathRegex = /\/storage\/v1\/object\/public\/photos\/(.+)/;
          const match = url.pathname.match(pathRegex);
          if (match && match[1]) {
            filePath = match[1];
          }
        } catch (err) {
          console.warn('Failed to parse photo URL:', photo.url, err);
        }
      }

      const deletePromises = [];
      
      // Delete from storage if we have a valid path
      if (filePath) {
        console.log('🗑️ Deleting file from storage:', filePath);
        deletePromises.push(
          supabase.storage.from('photos').remove([filePath])
        );
      }

      // Delete from database - realtime will handle UI update
      deletePromises.push(
        supabase.from('photos').delete().eq('id', photoId)
      );

      await Promise.allSettled(deletePromises);

      console.log('🗑️ Photo deleted successfully:', photoId);
      // Realtime subscription will handle UI update
      
      set({ error: null });
    } catch (error: any) {
      console.error('❌ Delete photo error:', error);
      set({ 
        error: error.message || 'Failed to delete photo'
      });
      throw error;
    }
  },

  // Fetch photos and setup realtime subscription - CRITICAL
  fetchPhotosByCollageId: async (collageId: string) => {
    try {
      console.log('📋 Fetching photos for collage:', collageId);
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📸 Fetched photos:', data?.length || 0);
      set({ photos: data as Photo[], error: null });
      
      // CRITICAL: Setup realtime subscription after initial fetch
      get().setupRealtimeSubscription(collageId);
      
    } catch (error: any) {
      console.error('❌ Fetch photos error:', error);
      set({ error: error.message });
    }
  }
}));