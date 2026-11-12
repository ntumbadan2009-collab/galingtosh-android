import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Auth is prepared now; add the public Supabase key when the project is configured.
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'));
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;
