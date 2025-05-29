import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

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
  transform?: { width?: number; height?: number; quality?: number; format?: 'origin' | 'webp' }
} = {}) => {
  try {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath, options);
    return data.publicUrl;
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