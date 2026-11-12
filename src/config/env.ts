const DEFAULT_SUPABASE_URL = "https://lmlwekcytivszlszmfvy.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_kmotb1BBdQ20kWuB-ryirQ_9Rqcq88U";

export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() || DEFAULT_SUPABASE_KEY
};
