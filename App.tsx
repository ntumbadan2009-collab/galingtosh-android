import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, View } from "react-native";
import * as Linking from "expo-linking";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { AuthScreen } from "@/screens/AuthScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { Sidebar } from "@/components/Sidebar";
import { LibraryScreen } from "@/screens/LibraryScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import type { Conversation } from "@/types/database";

type Screen = "chat" | "library" | "settings";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("chat");
  const [drawer, setDrawer] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);

  useEffect(() => {
    const handleAuthUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) Alert.alert("Confirmation impossible", "Le lien a expiré ou a déjà été utilisé. Demandez un nouveau lien.");
    };
    void Linking.getInitialURL().then(url => { if (url) void handleAuthUrl(url); });
    const linkSubscription = Linking.addEventListener("url", event => { void handleAuthUrl(event.url); });
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session); setReady(true); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setActive(null); setConversations([]); setScreen("chat"); }
    });
    return () => { mounted = false; subscription.unsubscribe(); linkSubscription.remove(); };
  }, []);

  const loadConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("conversations").select("*")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(60);
    if (!error) setConversations((data ?? []) as Conversation[]);
  }, []);

  useEffect(() => { if (session) void loadConversations(); }, [session, loadConversations]);

  const chooseConversation = (id: string) => {
    const found = conversations.find(item => item.id === id);
    if (!found) return;
    setActive(found); setScreen("chat"); setDrawer(false);
  };

  const openProject = async (projectId: string) => {
    const existing = conversations.find(item => item.project_id === projectId);
    if (existing) { setActive(existing); setScreen("chat"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: project } = await supabase.from("projects").select("title").eq("id", projectId).single();
    const { data, error } = await supabase.from("conversations")
      .insert({ user_id: user.id, project_id: projectId, title: project?.title ?? "Production" })
      .select("*").single();
    if (error) { Alert.alert("Ouverture impossible", error.message); return; }
    const created = data as Conversation;
    setActive(created); setConversations(previous => [created, ...previous]); setScreen("chat");
  };

  const newChat = () => { setActive(null); setScreen("chat"); setDrawer(false); };
  const signOut = () => Alert.alert("Déconnexion", "Voulez-vous vous déconnecter de Galingtosh ?", [
    { text: "Annuler", style: "cancel" },
    { text: "Se déconnecter", style: "destructive", onPress: () => { void supabase.auth.signOut(); } }
  ]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        {!ready ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.violetBright} size="large" />
          </View>
        ) : !session ? <AuthScreen /> : <>
          {screen === "chat" && <ChatScreen
            onMenu={() => { void loadConversations(); setDrawer(true); }}
            conversation={active}
            onConversation={conversation => {
              setActive(conversation);
              if (conversation) void loadConversations();
            }}
            onProject={() => { void loadConversations(); }}
          />}
          {screen === "library" && <LibraryScreen onBack={() => setScreen("chat")} onOpenProject={id => { void openProject(id); }} />}
          {screen === "settings" && <SettingsScreen email={session.user.email ?? ""} onBack={() => setScreen("chat")} onSignOut={signOut} />}
          <Sidebar
            visible={drawer}
            conversations={conversations}
            activeId={active?.id ?? null}
            onClose={() => setDrawer(false)}
            onNew={newChat}
            onLibrary={() => { setDrawer(false); setScreen("library"); }}
            onSettings={() => { setDrawer(false); setScreen("settings"); }}
            onSelect={chooseConversation}
          />
        </>}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
