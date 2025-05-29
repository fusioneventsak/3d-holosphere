import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { defaultSettings, type SceneSettings } from './sceneStore';

type Collage = {
  id: string;
  code: string;
  name: string;
  user_id: string;
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
          console.log('Photo change received:', payload);
          
          // Fetch the latest photos to ensure correct order
          const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('collage_id', collageId)
            .order('created_at', { ascending: true });
            
          if (!error && data) {
            console.log('Updated photos list:', data);
            set({ photos: data as Photo[] });
          } else {
            console.error('Error fetching updated photos:', error);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  deletePhoto: async (photoId: string) => {
    set({ loading: true, error: null });
    try {
      // First get the photo details to get the storage path
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('*')
        .eq('id', photoId)
        .single();

      if (fetchError) throw fetchError;

      // Extract storage path from URL
      const url = new URL(photo.url);
      const storagePath = url.pathname.split('/').slice(-2).join('/');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: deleteError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (deleteError) throw deleteError;

      // Update local state
      set(state => ({
        photos: state.photos.filter(p => p.id !== photoId),
        loading: false,
        error: null
      }));
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to delete photo',
        loading: false
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
      // Fetch collage and its settings
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('*')
        .eq('code', code)
        .single();

      if (collageError) throw collageError;

      // Fetch settings
      const { data: settings, error: settingsError } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', collage.id)
        .single();

      const collageWithSettings = {
        ...collage,
        settings: settings?.settings || defaultSettings
      } as Collage;

      set({ currentCollage: collageWithSettings, loading: false });
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
      // Fetch collage and settings in parallel
      const [collageResponse, settingsResponse] = await Promise.all([
        supabase
          .from('collages')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('collage_settings')
          .select('settings')
          .eq('collage_id', id)
          .maybeSingle()
      ]);

      if (collageResponse.error) throw collageResponse.error;
      const collage = collageResponse.data;

      if (!settingsResponse.data) {
        // Use upsert to create or update settings
        // Removed ignoreDuplicates: false to fix the constraint violation
        const { data: settingsData, error: upsertError } = await supabase
          .from('collage_settings')
          .upsert(
            { 
              collage_id: collage.id, 
              settings: defaultSettings 
            },
            {
              onConflict: 'collage_id'
            }
          )
          .select('settings')
          .single();

        if (upsertError) throw upsertError;
        
        // Use the returned settings or fall back to default
        collage.settings = settingsData?.settings || defaultSettings;
      } else {
        collage.settings = settingsResponse.data.settings;
      }

      set({ currentCollage: collage as Collage, loading: false });
      await get().fetchPhotosByCollageId(collage.id);
      return collage as Collage;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  createCollage: async (name: string) => {
    set({ loading: true, error: null });
    try {
      // Generate a unique code
      const code = nanoid(6).toLowerCase();
      
      // Create collage without requiring a user_id
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .insert([{
          name,
          code
        }])
        .select()
        .single();

      if (collageError) throw collageError;

      // Create settings
      const { error: settingsError } = await supabase
        .from('collage_settings')
        .insert([{
          collage_id: collage.id,
          settings: defaultSettings
        }]);

      if (settingsError) throw settingsError;

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

  updateCollageSettings: async (collageId: string, settings: Partial<SceneSettings>) => {
    try {
      // Get current settings to merge with updates
      const { data: currentSettings, error: settingsError } = await supabase
        .from('collage_settings')
        .select('settings')
        .eq('collage_id', collageId)
        .single();
        
      if (settingsError && settingsError.code !== 'PGRST116') { // Ignore 'not found' error
        console.error('Failed to get current settings:', settingsError.message);
      }
      
      // Merge current settings with updates
      const mergedSettings = {
        ...(currentSettings?.settings || defaultSettings),
        ...settings
      };

      // Update settings using upsert
      const { data, error } = await supabase
        .from('collage_settings')
        .upsert({ 
          collage_id: collageId,
          settings: mergedSettings
        }, {
          onConflict: 'collage_id'
        })
        .select('settings')
        .single();

      if (error) {
        console.error('Failed to update collage settings:', error.message);
        throw new Error(`Failed to update collage settings: ${error.message}`);
      }

      // Update local state
      set(state => ({
        currentCollage: state.currentCollage ? {
          ...state.currentCollage,
          settings: data?.settings || state.currentCollage.settings
        } : null
      }));

      return data;
    } catch (error: any) {
      console.error('Failed to update collage settings:', error.message);
      throw error;
    }
  },

  uploadPhoto: async (collageId: string, file: File) => {
    set({ loading: true, error: null });
    try {
      // Check file size (10MB limit)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Verify collage exists
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('id')
        .eq('id', collageId)
        .single();

      if (collageError || !collage) {
        throw new Error('Invalid collage ID');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${nanoid()}.${fileExt}`;
      const filePath = `${collageId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

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
        // If insert fails, clean up the uploaded file
        await supabase.storage
          .from('photos')
          .remove([filePath]);
        throw insertError;
      }

      // Update local state
      const newPhoto = photoData as Photo;
      set(state => ({ 
        photos: [...state.photos, newPhoto],
        loading: false,
        error: null
      }));

      return newPhoto;
    } catch (error: any) {
      console.error('Upload error details:', error);
      set({ 
        error: error.message || 'Failed to upload photo', 
        loading: false 
      });
      return null;
    }
  },

  fetchPhotosByCollageId: async (collageId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ photos: data as Photo[], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));