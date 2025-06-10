// src/store/collageStore.ts - GLOBAL SHARED SUBSCRIPTION FOR ALL COMPONENTS
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
  
  // CRITICAL: Global subscription management
  currentCollageId: string | null;
  subscriberCount: number;

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
  
  // CRITICAL: Global subscription methods
  subscribeToCollage: (collageId: string) => void;
  unsubscribeFromCollage: () => void;
  
  // Internal methods
  addPhotoToState: (photo: Photo) => void;
  removePhotoFromState: (photoId: string) => void;
  startPolling: (collageId: string) => void;
  stopPolling: () => void;
  forceRefreshAllComponents: () => void;
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
  currentCollageId: null,
  subscriberCount: 0,

  // CRITICAL: Global subscription management
  subscribeToCollage: (collageId: string) => {
    const state = get();
    
    console.log('🔗 GLOBAL SUBSCRIPTION REQUEST for collage:', collageId);
    console.log('🔗 Current subscribers:', state.subscriberCount);
    console.log('🔗 Current collage ID:', state.currentCollageId);
    
    // Increment subscriber count
    set({ subscriberCount: state.subscriberCount + 1 });
    
    // If this is the first subscriber or different collage, setup subscription
    if (state.subscriberCount === 0 || state.currentCollageId !== collageId) {
      console.log('🔗 SETTING UP GLOBAL SUBSCRIPTION for:', collageId);
      set({ currentCollageId: collageId });
      get().setupGlobalRealtimeSubscription(collageId);
    } else {
      console.log('🔗 REUSING EXISTING GLOBAL SUBSCRIPTION');
    }
  },

  unsubscribeFromCollage: () => {
    const state = get();
    const newCount = Math.max(0, state.subscriberCount - 1);
    
    console.log('🔗 GLOBAL UNSUBSCRIBE REQUEST');
    console.log('🔗 Subscribers: ', state.subscriberCount, '->', newCount);
    
    set({ subscriberCount: newCount });
    
    // If no more subscribers, cleanup
    if (newCount === 0) {
      console.log('🔗 NO MORE SUBSCRIBERS - CLEANING UP GLOBAL SUBSCRIPTION');
      get().cleanupGlobalRealtimeSubscription();
      set({ currentCollageId: null });
    }
  },

  // CRITICAL: Single global realtime subscription
  setupGlobalRealtimeSubscription: (collageId: string) => {
    // Clean up any existing subscription
    get().cleanupGlobalRealtimeSubscription();

    console.log('🌍 SETTING UP GLOBAL REALTIME SUBSCRIPTION for collage:', collageId);

    const channelName = `global_photos_${collageId}_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        (payload) => {
          console.log('🌍 GLOBAL REALTIME EVENT:', payload.eventType, payload);
          
          try {
            if (payload.eventType === 'INSERT' && payload.new) {
              console.log('➕ GLOBAL INSERT:', payload.new.id);
              get().addPhotoToState(payload.new as Photo);
            } 
            else if (payload.eventType === 'DELETE') {
              let photoId = null;
              
              if (payload.old && payload.old.id) {
                photoId = payload.old.id;
              }
              
              if (photoId) {
                console.log('🗑️ GLOBAL DELETE:', photoId);
                get().removePhotoFromState(photoId);
              } else {
                console.error('🗑️ GLOBAL DELETE: No photo ID found, forcing refresh');
                setTimeout(() => get().refreshPhotos(collageId), 500);
              }
            }
            else if (payload.eventType === 'UPDATE' && payload.new) {
              console.log('🔄 GLOBAL UPDATE:', payload.new.id);
              const updatedPhoto = payload.new as Photo;
              set((state) => ({
                photos: state.photos.map(p => 
                  p.id === updatedPhoto.id ? updatedPhoto : p
                ),
                lastRefreshTime: Date.now()
              }));
            }
          } catch (error) {
            console.error('❌ GLOBAL REALTIME ERROR:', error);
            setTimeout(() => get().refreshPhotos(collageId), 1000);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🌍 GLOBAL SUBSCRIPTION STATUS:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ GLOBAL REALTIME CONNECTED');
          set({ isRealtimeConnected: true });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ GLOBAL REALTIME FAILED, falling back to polling');
          if (err) console.error('Error details:', err);
          set({ isRealtimeConnected: false });
          get().startPolling(collageId);
        }
      });

    set({ realtimeChannel: channel });

    // Fallback to polling if realtime doesn't connect
    setTimeout(() => {
      const currentState = get();
      if (!currentState.isRealtimeConnected && !currentState.pollingInterval) {
        console.log('🔄 GLOBAL REALTIME TIMEOUT, starting polling');
        get().startPolling(collageId);
      }
    }, 3000);
  },

  cleanupGlobalRealtimeSubscription: () => {
    const currentChannel = get().realtimeChannel;
    if (currentChannel) {
      console.log('🧹 CLEANING UP GLOBAL REALTIME SUBSCRIPTION');
      try {
        supabase.removeChannel(currentChannel);
      } catch (error) {
        console.warn('⚠️ Error during global cleanup:', error);
      }
      set({ realtimeChannel: null, isRealtimeConnected: false });
    }
    
    get().stopPolling();
  },

  // Add photo to state with smooth updates
  addPhotoToState: (photo: Photo) => {
    set((state) => {
      const exists = state.photos.some(p => p.id === photo.id);
      if (exists) {
        console.log('🔄 Photo already exists in state:', photo.id);
        return state;
      }
      
      console.log('✅ SMOOTH: Adding new photo to state:', photo.id);
      return {
        photos: [photo, ...state.photos],
        lastRefreshTime: Date.now()
      };
    });
  },

  // CRITICAL: Enhanced removePhotoFromState with global broadcast
  removePhotoFromState: (photoId: string) => {
    console.log('🗑️ GLOBAL: Removing photo from ALL components:', photoId);
    
    set((state) => {
      const beforeCount = state.photos.length;
      const newPhotos = state.photos.filter(p => p.id !== photoId);
      const afterCount = newPhotos.length;
      
      console.log(`🗑️ GLOBAL removal: ${beforeCount} -> ${afterCount} photos`);
      console.log('🗑️ Remaining IDs:', newPhotos.map(p => p.id.slice(-4)));
      
      return {
        photos: newPhotos,
        lastRefreshTime: Date.now()
      };
    });

    // CRITICAL: Force update all components multiple times
    setTimeout(() => {
      console.log('🗑️ GLOBAL: Secondary deletion signal');
      set(state => ({ ...state, lastRefreshTime: Date.now() + 1 }));
    }, 50);

    setTimeout(() => {
      console.log('🗑️ GLOBAL: Final deletion signal');
      set(state => ({ ...state, lastRefreshTime: Date.now() + 2 }));
    }, 200);
  },

  forceRefreshAllComponents: () => {
    console.log('🔄 GLOBAL: Force refreshing ALL components');
    set((state) => ({
      ...state,
      lastRefreshTime: Date.now() + Math.random()
    }));
  },

  // Polling fallback
  startPolling: (collageId: string) => {
    get().stopPolling();
    
    console.log('🔄 GLOBAL: Starting polling for collage:', collageId);
    
    const interval = setInterval(async () => {
      try {
        const currentState = get();
        if (currentState.currentCollageId === collageId && currentState.subscriberCount > 0) {
          const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('collage_id', collageId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          const currentPhotoIds = currentState.photos.map(p => p.id).sort().join(',');
          const newPhotoIds = (data || []).map(p => p.id).sort().join(',');
          
          if (currentPhotoIds !== newPhotoIds) {
            console.log('📡 GLOBAL POLLING: Photo changes detected');
            set({ 
              photos: data as Photo[], 
              lastRefreshTime: Date.now() 
            });
          }
        } else {
          get().stopPolling();
        }
      } catch (error) {
        console.error('❌ GLOBAL POLLING ERROR:', error);
      }
    }, 2000);

    set({ pollingInterval: interval, isRealtimeConnected: false });
  },

  stopPolling: () => {
    const interval = get().pollingInterval;
    if (interval) {
      console.log('🛑 GLOBAL: Stopping polling');
      clearInterval(interval);
      set({ pollingInterval: null });
    }
  },

  refreshPhotos: async (collageId: string) => {
    try {
      console.log('🔄 GLOBAL: Force refreshing photos for collage:', collageId);
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📸 GLOBAL: Force refreshed photos:', data?.length || 0);
      
      set({ 
        photos: data as Photo[], 
        error: null,
        lastRefreshTime: Date.now()
      });
      
    } catch (error: any) {
      console.error('❌ GLOBAL: Refresh photos error:', error);
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
      
      // Fetch photos and setup global subscription
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
      
      // Fetch photos and setup global subscription
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

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          duplex: 'half'
        });

      if (uploadError) throw uploadError;

      const publicUrl = getFileUrl('photos', filePath);

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
      
      // Let global subscription handle the update
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
      console.log('🗑️ GLOBAL: Starting deletion for photo:', photoId);
      
      // Get photo data for storage cleanup
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('url')
        .eq('id', photoId)
        .single();

      if (fetchError && !fetchError.message.includes('0 rows')) {
        console.warn('⚠️ Could not fetch photo for cleanup:', fetchError);
      }

      // Delete from database (triggers global realtime)
      const { error: deleteError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (deleteError && !deleteError.message.includes('0 rows')) {
        throw deleteError;
      }

      // Cleanup storage
      if (photo?.url) {
        try {
          const url = new URL(photo.url);
          const pathRegex = /\/storage\/v1\/object\/public\/photos\/(.+)/;
          const match = url.pathname.match(pathRegex);
          if (match && match[1]) {
            await supabase.storage.from('photos').remove([match[1]]);
          }
        } catch (storageErr) {
          console.warn('⚠️ Storage cleanup failed:', storageErr);
        }
      }

      console.log('🗑️ GLOBAL: Photo deletion completed:', photoId);
      set({ error: null });
      
    } catch (error: any) {
      console.error('❌ GLOBAL: Delete photo error:', error);
      set({ error: error.message || 'Failed to delete photo' });
      throw error;
    }
  },

  fetchPhotosByCollageId: async (collageId: string) => {
    try {
      console.log('📋 GLOBAL: Fetching photos for collage:', collageId);
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📸 GLOBAL: Fetched photos:', data?.length || 0);
      set({ 
        photos: data as Photo[], 
        error: null,
        lastRefreshTime: Date.now()
      });
      
    } catch (error: any) {
      console.error('❌ GLOBAL: Fetch photos error:', error);
      set({ error: error.message });
    }
  }
}));