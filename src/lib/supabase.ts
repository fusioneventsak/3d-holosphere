import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Configure the Supabase client with additional options
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'photobooth-app'
    },
    // Add fetch options to handle network errors gracefully
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        credentials: 'include'
      }).catch(error => {
        console.error('Supabase fetch error:', error);
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          throw new Error(
            'Unable to connect to the server. Please ensure your Supabase project is configured correctly ' +
            'and that you have a stable internet connection.'
          );
        }
        throw error;
      });
    }
  }
});

// Normalize file extension to lowercase
export const normalizeFileExtension = (url: string): string => {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const lastDotIndex = path.lastIndexOf('.');
  
  if (lastDotIndex === -1) return url;
  
  const extension = path.slice(lastDotIndex);
  urlObj.pathname = path.slice(0, lastDotIndex) + extension.toLowerCase();
  return urlObj.toString();
};

// Add cache busting parameter to URL
export const addCacheBustToUrl = (url: string): string => {
  const urlObj = new URL(url);
  urlObj.searchParams.set('_t', Date.now().toString());
  return urlObj.toString();
};

// Get file URL with optional cache busting
export const getFileUrl = (bucket: string, path: string): string => {
  if (!path) {
    console.warn('No path provided to getFileUrl');
    return '';
  }
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  return normalizeFileExtension(baseUrl);
};