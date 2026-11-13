import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lmlwekcytivszlszmfvy.supabase.co';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_kmotb1BBdQ20kWuB-ryirQ_9Rqcq88U';
export const supabaseConfigured = Boolean(anonKey && !anonKey.includes('YOUR_'));
export const supabase = createClient(SUPABASE_URL, anonKey || 'missing-anon-key', {
 auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false,flowType:'pkce'}
});
