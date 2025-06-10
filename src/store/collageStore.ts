// src/store/collageStore.ts - SIMPLIFIED WITH POLLING FALLBACK
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
  isRealtimeConnected: boolean;
  lastRefreshTime: number;
  pollingInterval: NodeJS.Timeout | null;

  // Actions
  fetchCollages: () => Promise<void>;
  fetchCollageByCode: (code: string) => Promise<Collage | null>;
  fetchCollageById: (id: string) => Promise<Collage | null>;
  createCollage: (name: string) => Promise<Collage | null>;
  updateCollageSettings: (collageId: string, settings: Partial<SceneSettings>) => Promise<any>;
  uploadPhoto: (collageId: string, file: File) => Promise<Photo | null>;
  deletePhoto: (photoId: string) => Promise<void>;
  fetchPhotosByCollageId: (collageId: string) => Promise<void>;
  refreshPhotos: (collageId: string) => Promise<void>;
  
  // Simplified realtime/polling methods
  setupRealtimeSubscription: (collageId: string) => void;
  cleanupRealtimeSubscription: () => void;
  addPhotoToState: (photo: Photo) => void;
  removePhotoFromState: (photoId: string) => void;
  startPolling: (collageId: string) => void;
  stopPolling: () => void;
}

export const useCollageStore = create<CollageStore>((set, get) => ({
  // Initial state
  photos: [],
  currentCollage: null,
  loading: false,
  error: null,
  collages: [],
  realtimeChannel: null,
  isRealtimeConnected: false,
  lastRefreshTime: 0,
  pollingInterval: null,

  // Add photo to state
  addPhotoToState: (photo: Photo) => {
    set((state) => {
      const exists = state.photos.some(p => p.id === photo.id);
      if (exists) {
        console.log('🔄 Photo already exists in state:', photo.id);
        return state;
      }
      
      console.log('✅ Adding new photo to state:', photo.id);
      return {
        photos: [photo, ...state.photos],
        lastRefreshTime: Date.now()
      };
    });
  },

  // Remove photo from state
  removePhotoFromState: (photoId: string) => {
    console.log('🗑️ Removing photo from state:', photoId);
    set((state) => ({
      photos: state.photos.filter(p => p.id !== photoId),
      lastRefreshTime: Date.now()
    }));
  },

  // Start polling for updates (fallback method)
  startPolling: (collageId: string) => {
    // Stop existing polling first
    get().stopPolling();
    
    console.log('🔄 Starting polling for collage:', collageId);
    
    const interval = setInterval(async () => {
      try {
        const currentState = get();
        if (currentState.currentCollage?.id === collageId) {
          // Get latest photos from database
          const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('collage_id', collageId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          // Check if photos have changed
          const currentPhotoIds = currentState.photos.map(p => p.id).sort().join(',');
          const newPhotoIds = (data || []).map(p => p.id).sort().join(',');
          
          if (currentPhotoIds !== newPhotoIds) {
            console.log('📡 Polling detected photo changes:', data?.length);
            set({ 
              photos: data as Photo[], 
              lastRefreshTime: Date.now() 
            });
          }
        } else {
          // Collage changed, stop polling
          get().stopPolling();
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    set({ pollingInterval: interval, isRealtimeConnected: false });
  },

  // Stop polling
  stopPolling: () => {
    const interval = get().pollingInterval;
    if (interval) {
      console.log('🛑 Stopping polling');
      clearInterval(interval);
      set({ pollingInterval: null });
    }
  },

  // Simplified realtime subscription (tries realtime, falls back to polling)
  setupRealtimeSubscription: (collageId: string) => {
    const currentChannel = get().realtimeChannel;
    
    // Clean up existing
    if (currentChannel) {
      console.log('🧹 Cleaning up existing subscription');
      try {
        supabase.removeChannel(currentChannel);
      } catch (error) {
        console.warn('⚠️ Error cleaning up channel:', error);
      }
    }

    // Stop existing polling
    get().stopPolling();

    console.log('🚀 Attempting realtime subscription for collage:', collageId);

    // Try realtime first
    const channelName = `photos_simple_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          console.log('🔔 Realtime event received:', payload.eventType, payload);
          
          try {
            if (payload.eventType === 'INSERT' && payload.new) {
              get().addPhotoToState(payload.new as Photo);
            } else if (payload.eventType === 'DELETE' && payload.old) {
              get().removePhotoFromState(payload.old.id);
            }
          } catch (error) {
            console.error('❌ Error processing realtime event:', error);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime working! Using realtime updates.');
          set({ isRealtimeConnected: true });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ Realtime failed, falling back to polling');
          if (err) console.error('Error details:', err);
          set({ isRealtimeConnected: false });
          
          // Fallback to polling
          get().startPolling(collageId);
        }
      });

    set({ realtimeChannel: channel });

    // Safety fallback: if no subscription status after 5 seconds, start polling
    setTimeout(() => {
      const currentState = get();
      if (!currentState.isRealtimeConnected && !currentState.pollingInterval) {
        console.log('🔄 Realtime timeout, starting polling fallback');
        get().startPolling(collageId);
      }
    }, 5000);
  },

  // Clean up realtime and polling
  cleanupRealtimeSubscription: () => {
    const currentChannel = get().realtimeChannel;
    if (currentChannel) {
      console.log('🧹 Cleaning up realtime subscription');
      try {
        supabase.removeChannel(currentChannel);
      } catch (error) {
        console.warn('⚠️ Error during cleanup:', error);
      }
      set({ realtimeChannel: null, isRealtimeConnected: false });
    }
    
    // Stop polling
    get().stopPolling();
  },

  // Manual refresh photos
  refreshPhotos: async (collageId: string) => {
    try {
      console.log('🔄 Manual refresh photos for collage:', collageId);
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📸 Refreshed photos:', data?.length || 0);
      set({ 
        photos: data as Photo[], 
        error: null,
        lastRefreshTime: Date.now()
      });
      
    } catch (error: any) {
      console.error('❌ Refresh photos error:', error);
      set({ error: error.message });
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
      
      // Fetch photos and setup updates
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
      
      // Fetch photos and setup updates
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

  // Upload photo with immediate local update
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
      
      console.log('📸 Photo uploaded successfully:', newPhoto.id);
      
      // ALWAYS add to state immediately (don't wait for realtime/polling)
      get().addPhotoToState(newPhoto);
      
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

      // Delete from database
      deletePromises.push(
        supabase.from('photos').delete().eq('id', photoId)
      );

      await Promise.allSettled(deletePromises);

      console.log('🗑️ Photo deleted successfully:', photoId);
      
      // ALWAYS remove from state immediately (don't wait for realtime/polling)
      get().removePhotoFromState(photoId);
      
      set({ error: null });
    } catch (error: any) {
      console.error('❌ Delete photo error:', error);
      set({ 
        error: error.message || 'Failed to delete photo'
      });
      throw error;
    }
  },

  // Fetch photos and setup updates
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
      set({ 
        photos: data as Photo[], 
        error: null,
        lastRefreshTime: Date.now()
      });
      
      // Setup realtime/polling after initial fetch
      setTimeout(() => {
        get().setupRealtimeSubscription(collageId);
      }, 500);
      
    } catch (error: any) {
      console.error('❌ Fetch photos error:', error);
      set({ error: error.message });
    }
  }
}));