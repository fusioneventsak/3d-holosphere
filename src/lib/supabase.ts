import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Get file URL with optional cache busting
export const getFileUrl = (bucket: string, path: string): string => {
  if (!path) {
    console.warn('No path provided to getFileUrl');
    return '';
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
};