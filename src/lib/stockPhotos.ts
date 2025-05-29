import { supabase } from './supabase';

// This file is maintained for backward compatibility but no longer actively used

// Fallback stock photos in case database call fails
const FALLBACK_STOCK_PHOTOS = [
  'https://images.pexels.com/photos/1839564/pexels-photo-1839564.jpeg',
  'https://images.pexels.com/photos/2896853/pexels-photo-2896853.jpeg',
  'https://images.pexels.com/photos/3876394/pexels-photo-3876394.jpeg',
  'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg',
  'https://images.pexels.com/photos/3812207/pexels-photo-3812207.jpeg',
  'https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg',
  'https://images.pexels.com/photos/789822/pexels-photo-789822.jpeg',
  'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg',
  'https://images.pexels.com/photos/1987301/pexels-photo-1987301.jpeg',
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg'
];

export const getStockPhotos = async (): Promise<string[]> => {
  console.log('Stock photos functionality is disabled');
  return [];
};

// Clear cache when needed
export const clearStockPhotoCache = () => {
  // No-op function maintained for backward compatibility
};