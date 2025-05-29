import { supabase } from './supabase';

let stockPhotoCache: string[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fallback stock photos in case database call fails
const FALLBACK_STOCK_PHOTOS = [
  'https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg',
  'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg',
  'https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg',
  'https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg',
  'https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg',
  'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg',
  'https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg',
  'https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg',
  'https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg',
  'https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg'
];

export const getStockPhotos = async (): Promise<string[]> => {
  const now = Date.now();
  if (stockPhotoCache && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('Using cached stock photos, count:', stockPhotoCache.length);
    return stockPhotoCache;
  }

  try {
    console.log('Fetching stock photos from database');
    const { data, error } = await supabase
      .from('stock_photos')
      .select('url');

    if (error) {
      console.error('Error fetching stock photos:', error);
      return FALLBACK_STOCK_PHOTOS;
    }

    if (!data || data.length === 0) {
      console.warn('No stock photos found in database, using fallback');
      return FALLBACK_STOCK_PHOTOS;
    }

    console.log(`Successfully fetched ${data.length} stock photos`);
    stockPhotoCache = data.map(photo => photo.url);
    lastFetchTime = now;
    return stockPhotoCache;
  } catch (error) {
    console.error('Error fetching stock photos:', error);
    return FALLBACK_STOCK_PHOTOS;
  }
};

// Clear cache when needed
export const clearStockPhotoCache = () => {
  stockPhotoCache = null;
  lastFetchTime = 0;
};