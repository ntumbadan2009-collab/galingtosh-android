const required = (value: string | undefined, name: string) => {
  if (!value?.trim()) throw new Error(`Configuration manquante : ${name}`);
  return value.trim();
};

export const ENV = {
  supabaseUrl: required(process.env.EXPO_PUBLIC_SUPABASE_URL, "EXPO_PUBLIC_SUPABASE_URL"),
  supabaseKey: required(process.env.EXPO_PUBLIC_SUPABASE_KEY, "EXPO_PUBLIC_SUPABASE_KEY"),
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ""
};