import { supabase } from './supabase';

let stockPhotoCache: string[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fallback stock photos in case database call fails
const FALLBACK_STOCK_PHOTOS = [
  'https://images.pexels.com/photos/1839564/pexels-photo-1839564.jpeg',
  'https://images.pexels.com/photos/2896853/pexels-photo-2896853.jpeg',
  'https://images.pexels.com/photos/3876394/pexels-photo-3876394.jpeg',
  'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg',
  'https://images.pexels.com/photos/3812207/pexels-photo-3812207.jpeg',
  'https://images.pexels.com/photos/6321143/pexels-photo-6321143.jpeg', // Replaced broken URL
  'https://images.pexels.com/photos/7108133/pexels-photo-7108133.jpeg',
  'https://images.pexels.com/photos/789822/pexels-photo-789822.jpeg',
  'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg',
  'https://images.pexels.com/photos/1987301/pexels-photo-1987301.jpeg'
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
      .select('url')
      .eq('category', 'people')
      .limit(20);

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