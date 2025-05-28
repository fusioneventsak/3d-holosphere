import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { supabase, getSupabaseClient } from '../lib/supabase';

type Collage = {
  id: string;
  code: string;
  name: string;
  user_id: string;
  created_at: string;
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
  subscribeToPhotos: (collageId: string) => () => void;
  
  fetchCollages: () => Promise<void>;
  fetchCollageByCode: (code: string) => Promise<Collage | null>;
  fetchCollageById: (id: string) => Promise<Collage | null>;
  createCollage: (name: string) => Promise<Collage | null>;
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
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${collageId}`
        },
        async (payload) => {
          const newPhoto = payload.new as Photo;
          console.log('New photo received:', newPhoto);
          
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
      const { data, error } = await supabase
        .from('collages')
        .select('*')
        .eq('code', code)
        .single();

      if (error) throw error;
      set({ currentCollage: data as Collage, loading: false });
      await get().fetchPhotosByCollageId(data.id);
      return data as Collage;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  fetchCollageById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('collages')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      set({ currentCollage: data as Collage, loading: false });
      await get().fetchPhotosByCollageId(data.id);
      return data as Collage;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  createCollage: async (name: string) => {
    set({ loading: true, error: null });
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('You must be logged in to create a collage');
      }

      const code = nanoid(6).toLowerCase();
      
      const newCollage = {
        name,
        code,
        user_id: user.id
      };

      const { data, error } = await supabase
        .from('collages')
        .insert([newCollage])
        .select()
        .single();

      if (error) throw error;
      
      const collages = [...get().collages, data as Collage];
      set({ 
        collages, 
        loading: false, 
        currentCollage: data as Collage,
        error: null
      });
      return data as Collage;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return null;
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