import { supabase } from './supabase';

let stockPhotoCache: string[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getStockPhotos = async (): Promise<string[]> => {
  const now = Date.now();
  if (stockPhotoCache && (now - lastFetchTime) < CACHE_DURATION) {
    return stockPhotoCache;
  }

  try {
    const { data, error } = await supabase
      .from('stock_photos')
      .select('url');

    if (error) {
      console.error('Error fetching stock photos:', error);
      // Return some fallback stock photos if we can't load from the database
      return [
        'https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg',
        'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
        'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
        'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
        'https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg'
      ];
    }

    if (!data || data.length === 0) {
      console.warn('No stock photos found in the database, using fallbacks');
      return [
        'https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg',
        'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
        'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
        'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
        'https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg'
      ];
    }

    stockPhotoCache = data.map(photo => photo.url);
    lastFetchTime = now;
    return stockPhotoCache;
  } catch (error) {
    console.error('Error fetching stock photos:', error);
    // Return fallback stock photos
    return [
      'https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg',
      'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
      'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
      'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
      'https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg'
    ];
  }
};

// Clear cache when needed
export const clearStockPhotoCache = () => {
  stockPhotoCache = null;
  lastFetchTime = 0;
};