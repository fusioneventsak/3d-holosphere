import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

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
    const publicIndex = pathParts.indexOf('public');
    
    if (publicIndex !== -1 && publicIndex + 2 < pathParts.length) {
      const bucket = pathParts[publicIndex + 1];
      const collageId = pathParts[publicIndex + 2];
      const filePath = pathParts.slice(publicIndex + 2).join('/');
      return { collageId, filePath };
    }
    
    return { collageId: null, filePath: null };
  } catch (e) {
    console.warn('Failed to extract Supabase info from URL:', url);
    return { collageId: null, filePath: null };
  }
};

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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'Content-Type': 'application/json'
      },
    },
    // Add better error handling
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        // Add a timeout to prevent indefinite hanging requests
        signal: options?.signal || (new AbortController()).signal
      }).catch(error => {
        console.error('Supabase fetch error:', error);
        throw error;
      });
    }
  }
);

// Helper function to get a storage file URL with configured options
export const getFileUrl = (bucketName: string, filePath: string, options: { 
  download?: boolean, 
  transform?: { width?: number; height?: number; quality?: number; format?: 'origin' | 'webp' },
  cacheBust?: boolean
} = {}) => {
  try {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath, {
      download: options.download,
      transform: options.transform
    });
    
    let url = data.publicUrl;
    
    // Normalize file extension
    url = normalizeFileExtension(url);
    
    // Add cache busting if requested
    if (options.cacheBust) {
      url = addCacheBustToUrl(url);
    }
    
    return url;
  } catch (error) {
    console.error('Error generating public URL:', error);
    return '';
  }
};

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('settings').select('id').limit(1);
    if (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
};

export const verifyAuthSetup = async () => {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      console.error('Auth setup verification failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Auth setup verification error:', err);
    return false;
  }
};

// Utility function to retry failed operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
};

// Function to check if a file exists in storage
export const checkFileExists = async (bucket: string, path: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(path.split('/').slice(0, -1).join('/'));
    
    if (error) {
      console.error('Error checking if file exists:', error);
      return false;
    }
    
    const fileName = path.split('/').pop();
    return data?.some(file => file.name === fileName) || false;
  } catch (error) {
    console.error('Error checking if file exists:', error);
    return false;
  }
};