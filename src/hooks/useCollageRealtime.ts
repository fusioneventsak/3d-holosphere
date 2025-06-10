import { useEffect, useRef } from 'react';
import { useCollageStore } from '../store/collageStore';

/**
 * Hook to ensure realtime photo updates are active for the current collage
 * This is CRITICAL for photobooth -> collage sync
 * 
 * Usage:
 * const { photos } = useCollageRealtime(collageId);
 */
export const useCollageRealtime = (collageId?: string) => {
  const { 
    photos, 
    setupRealtimeSubscription, 
    cleanupRealtimeSubscription,
    fetchPhotosByCollageId 
  } = useCollageStore();
  
  const currentCollageIdRef = useRef<string | null>(null);

  useEffect(() => {
    // If no collage ID, clean up any existing subscription
    if (!collageId) {
      if (currentCollageIdRef.current) {
        console.log('🧹 No collage ID, cleaning up realtime subscription');
        cleanupRealtimeSubscription();
        currentCollageIdRef.current = null;
      }
      return;
    }

    // Only setup subscription if collage ID changed
    if (currentCollageIdRef.current !== collageId) {
      console.log('🔄 Collage ID changed, setting up realtime for:', collageId);
      
      // Clean up previous subscription first
      if (currentCollageIdRef.current) {
        console.log('🧹 Cleaning up previous subscription for:', currentCollageIdRef.current);
        cleanupRealtimeSubscription();
      }
      
      // Setup new subscription - this is where the magic happens for photobooth sync
      console.log('🚀 Setting up new realtime subscription for:', collageId);
      setupRealtimeSubscription(collageId);
      currentCollageIdRef.current = collageId;
    }

    // Cleanup function for when component unmounts or collageId changes
    return () => {
      if (currentCollageIdRef.current === collageId) {
        console.log('🧹 useCollageRealtime cleanup for collage:', collageId);
        cleanupRealtimeSubscription();
        currentCollageIdRef.current = null;
      }
    };
  }, [collageId, setupRealtimeSubscription, cleanupRealtimeSubscription]);

  // Return photos and a manual refresh function (rarely needed with realtime)
  return {
    photos,
    refreshPhotos: () => {
      if (collageId) {
        console.log('🔄 Manual refresh requested for collage:', collageId);
        fetchPhotosByCollageId(collageId);
      }
    }
  };
};
</parameter>