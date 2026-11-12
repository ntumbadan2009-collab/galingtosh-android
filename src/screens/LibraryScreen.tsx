import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { ChevronLeft, Clapperboard, Film, RefreshCw } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import type { Project } from "@/types/database";

export function LibraryScreen({onBack,onOpenProject}:{onBack:()=>void;onOpenProject:(projectId:string)=>void}) {
  const [items,setItems]=useState<Project[]>([]);
  const [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);const {data:{user}}=await supabase.auth.getUser();if(user){const {data}=await supabase.from("projects").select("id,user_id,title,type,created_at,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false});setItems((data??[]) as Project[]);}setLoading(false);};
  useEffect(()=>{void load();},[]);
  return <View style={{flex:1,backgroundColor:colors.background}}>
    <View style={{height:58,flexDirection:"row",alignItems:"center",paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:colors.border,gap:14}}><Pressable onPress={onBack}><ChevronLeft color={colors.text} size={24}/></Pressable><Text style={{color:colors.text,fontSize:18,fontWeight:"700",flex:1}}>Bibliothèque</Text><Pressable onPress={load}><RefreshCw color={colors.muted} size={19}/></Pressable></View>
    {loading?<ActivityIndicator color={colors.violetBright} style={{marginTop:50}}/>:<FlatList data={items} keyExtractor={x=>x.id} contentContainerStyle={{padding:18,gap:12}} ListEmptyComponent={<View style={{alignItems:"center",marginTop:100,padding:24}}><Clapperboard color={colors.subtle} size={42}/><Text style={{color:colors.text,fontWeight:"600",fontSize:16,marginTop:18}}>Votre bibliothèque est vide</Text><Text style={{color:colors.muted,textAlign:"center",marginTop:8,lineHeight:20}}>Vos productions et leurs versions apparaîtront ici.</Text></View>} renderItem={({item})=><Pressable onPress={()=>onOpenProject(item.id)} style={{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:16,padding:16,flexDirection:"row",alignItems:"center",gap:14}}><View style={{width:52,height:52,borderRadius:13,backgroundColor:colors.surfaceSoft,alignItems:"center",justifyContent:"center"}}><Film color={colors.violetBright} size={24}/></View><View style={{flex:1}}><Text style={{color:colors.text,fontWeight:"650",fontSize:15}}>{item.title}</Text><Text style={{color:colors.muted,fontSize:12,marginTop:5}}>{new Date(item.updated_at).toLocaleDateString("fr-FR")} · {item.type.replace("_"," ")}</Text></View></Pressable>}/>}
  </View>;
}