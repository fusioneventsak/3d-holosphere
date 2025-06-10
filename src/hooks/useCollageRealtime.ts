import { useEffect, useState, useCallback } from 'react';
import { useCollageStore, Photo } from '../store/collageStore';
import { supabase } from '../lib/supabase';

/**
 * Custom hook for handling realtime updates to collage photos
 * This ensures photos uploaded from the photobooth appear instantly in the collage viewer
 */
export const useCollageRealtime = (collageId?: string) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { fetchPhotosByCollageId } = useCollageStore();

  // Initial fetch and subscription setup
  useEffect(() => {
    if (!collageId) return;

    // Fetch initial photos
    const fetchPhotos = async () => {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .eq('collage_id', collageId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPhotos(data as Photo[]);
      } catch (error) {
        console.error('Error fetching photos:', error);
      }
    };

    fetchPhotos();

    // Set up realtime subscription
    const channel = supabase
      .channel(`collage-photos-${collageId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'photos',
        filter: `collage_id=eq.${collageId}`
      }, (payload) => {
        console.log('New photo inserted:', payload.new);
        const newPhoto = payload.new as Photo;
        setPhotos(prev => [newPhoto, ...prev]);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'photos',
        filter: `collage_id=eq.${collageId}`
      }, (payload) => {
        console.log('Photo deleted:', payload.old);
        setPhotos(prev => prev.filter(photo => photo.id !== payload.old.id));
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    // Cleanup subscription
    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [collageId]);

  // Manual refresh function
  const refreshPhotos = useCallback(() => {
    if (collageId) {
      fetchPhotosByCollageId(collageId);
    }
  }, [collageId, fetchPhotosByCollageId]);

  return { photos, isSubscribed, refreshPhotos };
};