import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL("auth/callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true }
  });
  if (error) throw error;
  if (!data.url) throw new Error("Impossible de démarrer Google.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") return null;
    throw new Error("La connexion Google n'a pas abouti.");
  }

  const callback = new URL(result.url);
  const code = callback.searchParams.get("code");
  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
    return exchanged.data.session;
  }

  const hash = new URLSearchParams(callback.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const session = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (session.error) throw session.error;
    return session.data.session;
  }
  throw new Error("Réponse Google invalide.");
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(), password
  });
  if (error) throw error;
  return data.session;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: Linking.createURL("auth/callback") }
  });
  if (error) throw error;
  return data;
}