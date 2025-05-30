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

// Helper function to determine correct MIME type based on file extension
const getMimeType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
};

export const useCollageStore = create<CollageState>((set, get) => ({
  collages: [],
  currentCollage: null,
  photos: [],
  loading: false,
  error: null,
  
  subscribeToPhotos: (collageId: string) => {
    console.log(`Setting up real-time subscription for collage ${collageId}`);
    
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
            // Add cache busting to URLs
            const photosWithTimestamp = data.map(photo => ({
              ...photo,
              url: addCacheBustToUrl(normalizeFileExtension(photo.url))
            }));
            
          if (!error && data) {
            console.log(`Updated photos list received: ${data.length} photos`);
            set({ photos: photosWithTimestamp as Photo[] });
          } else {
            console.error('Error fetching updated photos:', error);
          }
        }
      )
      .subscribe();

    return () => {
      console.log(`Unsubscribing from photos for collage ${collageId}`);
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
      let filePath = '';
      try {
        const url = new URL(photo.url);
        const pathParts = url.pathname.split('/');
        const publicIndex = pathParts.indexOf('public');
        
        if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
          // The path should be everything after "public/bucket_name/"
          filePath = pathParts.slice(publicIndex + 2).join('/');
        }
      } catch (err) {
        console.warn('Failed to parse photo URL:', photo.url, err);
        // If URL parsing fails, we'll try a direct delete from the database only
      }

      console.log(`Deleting photo from storage path: ${filePath}`);

      // Delete from storage if we have a valid path
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('photos')
          .remove([filePath]);

        if (storageError) {
          console.warn('Failed to delete photo from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

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
      console.error('Delete photo error:', error);
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
      console.log('Starting photo upload process for collage:', collageId);
      
      // Check file size (10MB limit)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
      let contentType = file.type;

      // If content type is not valid or is application/json, infer from extension
      if (!validImageTypes.includes(contentType) || contentType === 'application/json') {
        contentType = getMimeType(file.name);
        if (!validImageTypes.includes(contentType)) {
          throw new Error('Invalid file type. Only images are supported.');
        }
      }

      // Ensure collage exists before proceeding
      const { data: collage, error: collageError } = await supabase
        .from('collages')
        .select('id, code')
        .eq('id', collageId)
        .single();

      if (collageError) {
        console.error('Collage verification error:', collageError);
        throw new Error('Collage not found. Please try again or create a new collage.');
      }

      if (!collage) {
        throw new Error('Invalid collage ID');
      }

      console.log(`Verified collage exists: ID=${collage.id}, code=${collage.code}`);

      // Format file extension to lowercase to prevent case sensitivity issues
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const fileName = `${nanoid()}.${fileExt}`;
      const filePath = `${collageId}/${fileName}`;

      console.log(`Uploading file to ${filePath} with content type ${contentType}`);

      // Upload file to storage with the correct content type
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: contentType
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful, getting public URL');

      // Generate public URL using the helper
      const publicUrl = getFileUrl('photos', `collages/${filePath}`, { cacheBust: true });
      console.log('Public URL:', publicUrl);

      // Insert photo record
      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert([{
          collage_id: collageId,
          url: normalizeFileExtension(publicUrl)
        }])
        .select()
        .single();

      if (insertError) {
        // If insert fails, clean up the uploaded file
        console.error('Database insert error:', insertError);
        await supabase.storage
          .from('photos')
          .remove([filePath]);
        throw insertError;
      }

      console.log('Successfully added photo to database:', photoData);

      // Update local state with the clean URL
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
      console.log(`Fetching photos for collage: ${collageId}`);
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('collage_id', collageId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching photos:', error);
        throw error;
      }
      
      console.log(`Found ${data?.length || 0} photos`);
      
      // Add cache busting to URLs
      const photosWithTimestamp = data?.map(photo => ({
        ...photo,
        url: addCacheBustToUrl(normalizeFileExtension(photo.url))
      })) || [];
      
      set({ photos: photosWithTimestamp as Photo[], loading: false });
    } catch (error: any) {
      console.error('Error in fetchPhotosByCollageId:', error);
      set({ error: error.message, loading: false });
    }
  }
}));