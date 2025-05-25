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
      return [];
    }

    stockPhotoCache = data.map(photo => photo.url);
    lastFetchTime = now;
    return stockPhotoCache;
  } catch (error) {
    console.error('Error fetching stock photos:', error);
    return [];
  }
};

// Clear cache when needed
export const clearStockPhotoCache = () => {
  stockPhotoCache = null;
  lastFetchTime = 0;
};