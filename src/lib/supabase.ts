import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper function to normalize file extensions in URLs
export const normalizeFileExtension = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    
    const pathname = urlObj.pathname;
    const lastDotIndex = pathname.lastIndexOf('.');
    
    if (lastDotIndex !== -1) {
      const extension = pathname.substring(lastDotIndex);
      const lowercaseExt = extension.toLowerCase();
      
      if (extension !== lowercaseExt) {
        const newPathname = pathname.substring(0, lastDotIndex) + lowercaseExt;
        urlObj.pathname = newPathname;
        return urlObj.toString();
      }
    }
    
    return url;
  } catch (e) {
    console.warn('Failed to normalize file extension:', url, e);
    return url;
  }
};

// Helper function to add cache busting to URLs
export const addCacheBustToUrl = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Remove any existing cache-busting parameter
    urlObj.searchParams.delete('t');
    // Add new cache-busting parameter
    urlObj.searchParams.set('t', Date.now().toString());
    return urlObj.toString();
  } catch (e) {
    console.warn('Failed to add cache bust to URL:', url, e);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
};

// Check if URL is a Supabase storage URL
export const isSupabaseStorageUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.includes('/storage/v1/object/public/');
  } catch (e) {
    return false;
  }
};

// Extract collage ID and file path from Supabase URL
export const extractSupabaseInfo = (url: string): { collageId: string | null; filePath: string | null } => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    // Find the index after 'photos' in the path
    const photosIndex = pathParts.indexOf('photos');
    
    if (photosIndex !== -1 && photosIndex + 2 < pathParts.length) {
      // The collage ID should be in the 'collages' folder
      const collagesIndex = pathParts.indexOf('collages', photosIndex);
      if (collagesIndex !== -1 && collagesIndex + 1 < pathParts.length) {
        const collageId = pathParts[collagesIndex + 1];
        // Get everything after 'photos'
        const filePath = pathParts.slice(photosIndex + 1).join('/');
        console.log('Extracted info:', { collageId, filePath });
        return { collageId, filePath };
      }
    }
    
    console.warn('Could not extract info from URL:', url);
    return { collageId: null, filePath: null };
  } catch (e) {
    console.error('Failed to extract Supabase info from URL:', url, e);
      return { collageId, filePath };
    }
};

// Get file URL with optional cache busting
export const getFileUrl = (bucket: string, path: string, options: { cacheBust?: boolean } = {}): string => {
  // Ensure the path is properly formatted for collage photos
  if (bucket === 'photos' && !path.startsWith('collages/')) {
    path = `collages/${path}`;
  }
  
  let url = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  url = normalizeFileExtension(url);
  if (options.cacheBust) {
    url = addCacheBustToUrl(url);
  }
  console.log('Generated URL:', url);
  return url;
};