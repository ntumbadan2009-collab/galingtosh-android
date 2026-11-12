import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronLeft, UserRound, LogOut, ShieldCheck, Info, Bell } from "lucide-react-native";
import { colors } from "@/theme/colors";

export function SettingsScreen({email,onBack,onSignOut}:{email:string;onBack:()=>void;onSignOut:()=>void}) {
  const row=(icon:React.ReactNode,label:string,value?:string)=><View style={{flexDirection:"row",alignItems:"center",paddingVertical:17,borderBottomWidth:1,borderBottomColor:colors.border,gap:13}}>{icon}<View style={{flex:1}}><Text style={{color:colors.text,fontSize:14,fontWeight:"500"}}>{label}</Text>{value?<Text style={{color:colors.muted,fontSize:12,marginTop:4}}>{value}</Text>:null}</View></View>;
  return <View style={{flex:1,backgroundColor:colors.background}}>
    <View style={{height:58,flexDirection:"row",alignItems:"center",paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:colors.border,gap:14}}><Pressable onPress={onBack}><ChevronLeft color={colors.text} size={24}/></Pressable><Text style={{color:colors.text,fontSize:18,fontWeight:"700"}}>Paramètres</Text></View>
    <ScrollView contentContainerStyle={{padding:22}}>
      <Text style={{color:colors.subtle,fontSize:11,fontWeight:"700",letterSpacing:1.1,marginBottom:8}}>COMPTE</Text>
      {row(<UserRound color={colors.violetBright} size={20}/>,"Adresse e-mail",email)}
      <Text style={{color:colors.subtle,fontSize:11,fontWeight:"700",letterSpacing:1.1,marginTop:28,marginBottom:8}}>APPLICATION</Text>
      {row(<Bell color={colors.muted} size={20}/>,"Notifications","Les alertes de production apparaîtront ici.")}
      {row(<ShieldCheck color={colors.muted} size={20}/>,"Confidentialité et sécurité")}
      {row(<Info color={colors.muted} size={20}/>,"À propos","Galingtosh · Version 1.0.0")}
      <Pressable onPress={onSignOut} style={{flexDirection:"row",alignItems:"center",gap:12,marginTop:34,padding:16,borderRadius:14,backgroundColor:"#291522"}}><LogOut color={colors.danger} size={19}/><Text style={{color:colors.danger,fontWeight:"600"}}>Se déconnecter</Text></Pressable>
    </ScrollView>
  </View>;
}