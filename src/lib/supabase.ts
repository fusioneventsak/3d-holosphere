import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
  }
);

export const checkSupabaseConnection = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return true;
  } catch (err) {
    return false;
  }
};

export const verifyAuthSetup = async () => {
  try {
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch (err) {
    return false;
  }
};