import React from "react";
import { View, Text, Pressable } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Play, Film } from "lucide-react-native";
import { colors } from "@/theme/colors";

export function VideoCard({ uri, title, version }: { uri: string; title: string; version?: number }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });
  return (
    <View style={{marginTop:12,borderRadius:18,overflow:"hidden",borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface}}>
      <VideoView player={player} style={{width:"100%",height:210,backgroundColor:"#05040A"}} contentFit="contain" nativeControls />
      <View style={{padding:13,flexDirection:"row",alignItems:"center",gap:10}}>
        <View style={{width:34,height:34,borderRadius:10,backgroundColor:colors.surfaceSoft,alignItems:"center",justifyContent:"center"}}><Film color={colors.violetBright} size={18}/></View>
        <View style={{flex:1}}>
          <Text numberOfLines={1} style={{color:colors.text,fontWeight:"600"}}>{title}</Text>
          <Text style={{color:colors.muted,fontSize:12}}>{version ? `Version ${version}` : "Production terminée"}</Text>
        </View>
        <Pressable onPress={()=>player.play()} style={{width:38,height:38,borderRadius:19,backgroundColor:colors.violet,alignItems:"center",justifyContent:"center"}}><Play color="white" size={17} fill="white"/></Pressable>
      </View>
    </View>
  );
}