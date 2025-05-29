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