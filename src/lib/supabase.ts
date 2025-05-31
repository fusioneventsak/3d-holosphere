import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Get environment variables
const supabaseUrl = 'https://boxrxooisgvzgfqdjjhw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveHJ4b29pc2d2emdmcWRoamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwNDg1ODksImV4cCI6MjA2MzYyNDU4OX0.murfx7ur3bkX4yf-n_iGtjAOaPzwbDOX5Rhtql6LI6E';

// Validate Supabase URL format
const isValidUrl = (urlString: string): boolean => {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY are set in your .env file and click "Connect to Supabase" ' +
    'to configure your project.'
  );
}

if (!isValidUrl(supabaseUrl)) {
  throw new Error(
    `Invalid Supabase URL: "${supabaseUrl}". Please ensure your Supabase URL is correct.`
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
    fetch: async (url, options = {}) => {
      console.log('Supabase request:', url); // Log the request URL

      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000;

      const fetchWithRetry = async (attempt = 0): Promise<Response> => {
        try {
          console.log(`Attempt ${attempt + 1} of ${MAX_RETRIES}`);
          
          const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options.headers,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });

          if (!response.ok) {
            console.error('Response not OK:', {
              status: response.status,
              statusText: response.statusText
            });
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return response;
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error);

          if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY * (attempt + 1);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(attempt + 1);
          }
          
          if (error instanceof Error) {
            if (error.message.includes('Failed to fetch')) {
              console.error('Network error details:', {
                url: supabaseUrl,
                error: error.message
              });
              throw new Error(
                'Unable to connect to Supabase. Please check:\n' +
                '1. Your internet connection\n' +
                '2. The Supabase project status\n' +
                '3. Your project configuration'
              );
            }
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