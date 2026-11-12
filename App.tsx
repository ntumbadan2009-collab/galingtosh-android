import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { AuthScreen } from "@/screens/AuthScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { Sidebar } from "@/components/Sidebar";
import { LibraryScreen } from "@/screens/LibraryScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import type { Conversation } from "@/types/database";

type Screen="chat"|"library"|"settings";
export default function App() {
  const [session,setSession]=useState<any>(null);
  const [ready,setReady]=useState(false);
  const [screen,setScreen]=useState<Screen>("chat");
  const [drawer,setDrawer]=useState(false);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [active,setActive]=useState<Conversation|null>(null);
  const [projectId,setProjectId]=useState<string|null>(null);

  useEffect(()=>{let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true);}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);if(!next){setActive(null);setConversations([]);setScreen("chat");}});return()=>{mounted=false;subscription.unsubscribe();};},[]);
  const loadConversations=async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {data}=await supabase.from("conversations").select("*").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(60);setConversations((data??[]) as Conversation[]);};
  useEffect(()=>{if(session)void loadConversations();},[session]);
  const chooseConversation=async(id:string)=>{const found=conversations.find(c=>c.id===id);if(found){setActive(found);setProjectId(found.project_id);setScreen("chat");setDrawer(false);}};
  const newChat=()=>{setActive(null);setProjectId(null);setScreen("chat");setDrawer(false);};
  const signOut=()=>Alert.alert("Déconnexion","Voulez-vous vous déconnecter de Galingtosh ?",[{text:"Annuler",style:"cancel"},{text:"Se déconnecter",style:"destructive",onPress:()=>void supabase.auth.signOut()}]);
  if(!ready)return <View style={{flex:1,backgroundColor:colors.background,alignItems:"center",justifyContent:"center"}}><ActivityIndicator color={colors.violetBright} size="large"/></View>;
  return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:colors.background}} edges={["top","bottom"]}><StatusBar barStyle="light-content" backgroundColor={colors.background}/>{!session?<AuthScreen/>:<>
    {screen==="chat"?<ChatScreen onMenu={()=>{void loadConversations();setDrawer(true);}} conversation={active} onConversation={c=>{setActive(c);void loadConversations();}} onProject={id=>setProjectId(id)}/>:null}
    {screen==="library"?<LibraryScreen onBack={()=>setScreen("chat")} onOpenProject={id=>{setProjectId(id);const found=conversations.find(c=>c.project_id===id);if(found)setActive(found);setScreen("chat");}}/>:null}
    {screen==="settings"?<SettingsScreen email={session.user.email??""} onBack={()=>setScreen("chat")} onSignOut={signOut}/>:null}
    <Sidebar visible={drawer} conversations={conversations} activeId={active?.id??null} onClose={()=>setDrawer(false)} onNew={newChat} onLibrary={()=>{setDrawer(false);setScreen("library");}} onSettings={()=>{setDrawer(false);setScreen("settings");}} onSelect={chooseConversation}/>
  </>}</SafeAreaView></SafeAreaProvider>;
}