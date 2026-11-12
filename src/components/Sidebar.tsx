import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Archive, ChevronRight, Clapperboard, MessageSquarePlus, Settings2, X } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { colors } from "@/theme/colors";
import type { Conversation } from "@/types/database";

type Props = {
  visible: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onClose: () => void;
  onNew: () => void;
  onLibrary: () => void;
  onSettings: () => void;
  onSelect: (id: string) => void;
};

export function Sidebar({ visible, conversations, activeId, onClose, onNew, onLibrary, onSettings, onSelect }: Props) {
  const action = (label: string, icon: React.ReactNode, fn: () => void) => (
    <Pressable onPress={fn} style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:13,paddingVertical:14,paddingHorizontal:13,borderRadius:13,backgroundColor:pressed?colors.surfaceSoft:"transparent"})}>
      {icon}<Text style={{color:colors.text,fontSize:15,fontWeight:"500",flex:1}}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{flex:1,flexDirection:"row",backgroundColor:"rgba(0,0,0,0.58)"}}>
        <View style={{width:"82%",maxWidth:340,backgroundColor:"#0D0B18",paddingTop:58,paddingHorizontal:16,paddingBottom:24,borderRightWidth:1,borderRightColor:colors.border}}>
          <View style={{flexDirection:"row",alignItems:"center",marginBottom:28,gap:11}}>
            <BrandMark size={34}/>
            <Text style={{fontSize:21,fontWeight:"700",color:colors.text,flex:1}}>Galingtosh</Text>
            <Pressable onPress={onClose} hitSlop={12}><X color={colors.muted} size={22}/></Pressable>
          </View>
          {action("Nouvelle production",<MessageSquarePlus color={colors.text} size={20}/>,onNew)}
          {action("Bibliothèque",<Clapperboard color={colors.text} size={20}/>,onLibrary)}
          {action("Paramètres",<Settings2 color={colors.text} size={20}/>,onSettings)}
          <View style={{height:1,backgroundColor:colors.border,marginVertical:16}}/>
          <Text style={{color:colors.subtle,fontSize:11,fontWeight:"700",letterSpacing:1.2,marginHorizontal:12,marginBottom:10}}>RÉCENTES</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {conversations.map((item)=>(
              <Pressable key={item.id} onPress={()=>onSelect(item.id)} style={{paddingHorizontal:12,paddingVertical:12,borderRadius:11,backgroundColor:item.id===activeId?colors.surfaceSoft:"transparent",flexDirection:"row",alignItems:"center",gap:10}}>
                <MessageSquarePlus size={16} color={item.id===activeId?colors.violetBright:colors.subtle}/>
                <Text numberOfLines={1} style={{color:item.id===activeId?colors.text:colors.muted,fontSize:13,flex:1}}>{item.title || "Nouvelle conversation"}</Text>
              </Pressable>
            ))}
            {conversations.length===0 && <Text style={{color:colors.subtle,fontSize:13,padding:12}}>Vos conversations apparaîtront ici.</Text>}
          </ScrollView>
          <View style={{borderTopWidth:1,borderTopColor:colors.border,paddingTop:14,marginTop:12}}>
            <View style={{flexDirection:"row",alignItems:"center",gap:9,padding:9}}>
              <View style={{width:34,height:34,borderRadius:17,backgroundColor:colors.surfaceSoft,alignItems:"center",justifyContent:"center"}}><Archive color={colors.muted} size={17}/></View>
              <Text style={{color:colors.muted,fontSize:12,flex:1}}>Vos créations, au même endroit</Text>
              <ChevronRight color={colors.subtle} size={16}/>
            </View>
          </View>
        </View>
        <Pressable onPress={onClose} style={{flex:1}}/>
      </View>
    </Modal>
  );
}