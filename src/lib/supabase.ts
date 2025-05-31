import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Get environment variables
const supabaseUrl = 'https://boxrxooisgvzgfqdhjhw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveHJ4b29pc2d2emdmcWRoamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDU5NTc2MDAsImV4cCI6MjAyMTUzMzYwMH0.SZEpZ6WqQdG0vc7UtfQ4aNKh4TkPF_Jj0c7jBbFnxwk';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY are set in your .env file and click "Connect to Supabase" ' +
    'to configure your project.'
  );
}

// Configure the Supabase client with additional options
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-client-info': 'photosphere@1.0.0'
    },
    // Configure fetch with retries and better error handling
    fetch: (url, options = {}) => {
      // Add retry logic for failed requests
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second

      const fetchWithRetry = async (attempt = 0): Promise<Response> => {
        try {
          // Add credentials and cache control
          const response = await fetch(url, {
            ...options,
            credentials: 'include',
            // Add cache control headers to prevent caching
            headers: {
              ...options.headers,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return response;
        } catch (error) {
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
            console.log(`Retrying request (attempt ${attempt + 1} of ${MAX_RETRIES})...`);
            return fetchWithRetry(attempt + 1);
          }
          
          console.error('Supabase request failed after retries:', error);
          
          if (error instanceof Error && error.message.includes('Failed to fetch')) {
            throw new Error(
              'Unable to connect to Supabase. Please:\n' +
              '1. Check your internet connection\n' +
              '2. Ensure you\'ve clicked "Connect to Supabase" in the top right\n' +
              '3. Verify your Supabase project is running'
            );
          } else if (error instanceof Error) {
            throw new Error(`Supabase request failed: ${error.message}`);
          }
          throw error;
        }
      };

      return fetchWithRetry();
    }
  },
  db: {
    schema: 'public'
  }
});

// Normalize file extension to lowercase
export const normalizeFileExtension = (url: string): string => {
  if (!url) return '';
  
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
  if (!url) return '';
  
  const urlObj = new URL(url);
  urlObj.searchParams.set('_t', Date.now().toString());
  return urlObj.toString();
};

// Get file URL with optional cache busting
export const getFileUrl = (bucket: string, path: string): string => {
  if (!bucket || !path) {
    console.warn('No path provided to getFileUrl');
    return '';
  }
  
  if (!supabaseUrl) {
    console.error('Supabase URL is not configured');
    return '';
  }
  
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  return normalizeFileExtension(baseUrl);
};