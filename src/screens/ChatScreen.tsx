import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { Menu, Plus, Paperclip, Send, Sparkles, Clapperboard, LoaderCircle, X, Image as ImageIcon, Video, Music2 } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import type { Conversation, Message, RenderJob, FilmData } from "@/types/database";
import { VideoCard } from "@/components/VideoCard";

type Props={onMenu:()=>void;conversation:Conversation|null;onConversation:(c:Conversation)=>void;onProject:(id:string)=>void};
export function ChatScreen({onMenu,conversation,onConversation,onProject}:Props) {
  const [messages,setMessages]=useState<Message[]>([]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [job,setJob]=useState<RenderJob|null>(null);
  const [videoUrl,setVideoUrl]=useState<string|null>(null);
  const [filmTitle,setFilmTitle]=useState("Votre production");
  const [version,setVersion]=useState<number|undefined>();
  const list=useRef<FlatList<Message>>(null);

  const loadMessages=async(id:string)=>{const {data}=await supabase.from("messages").select("*").eq("conversation_id",id).order("created_at",{ascending:true});setMessages(((data??[]) as Message[]).filter(m=>m.role==="user"||m.role==="assistant"));};
  useEffect(()=>{if(conversation?.id){void loadMessages(conversation.id);}else{setMessages([]);setJob(null);setVideoUrl(null);}},[conversation?.id]);
  useEffect(()=>{if(!conversation?.id)return;const channel=supabase.channel("messages-"+conversation.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+conversation.id},()=>void loadMessages(conversation.id)).subscribe();return()=>{void supabase.removeChannel(channel);};},[conversation?.id]);
  useEffect(()=>{if(!job?.id)return;const channel=supabase.channel("job-"+job.id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"render_jobs",filter:"id=eq."+job.id},payload=>{const next=payload.new as RenderJob;setJob(next);if(next.status==="done"&&next.output_path)void getVideo(next);}).subscribe();return()=>{void supabase.removeChannel(channel);};},[job?.id]);
  const getVideo=async(j:RenderJob)=>{const {data,error}=await supabase.storage.from("renders").createSignedUrl(j.output_path!,3600);if(!error&&data?.signedUrl)setVideoUrl(data.signedUrl);};
  const watchJob=async(id:string)=>{const {data,error}=await supabase.from("render_jobs").select("*").eq("id",id).maybeSingle();if(!error&&data){setJob(data as RenderJob);if(data.status==="done"&&data.output_path)await getVideo(data as RenderJob);}};
  const send=async()=>{const message=input.trim();if(!message||busy)return;setInput("");setBusy(true);try{
    const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session expirée.");
    let active=conversation;
    if(!active){const {data,error}=await supabase.from("conversations").insert({user_id:user.id,title:message.slice(0,70)}).select("*").single();if(error)throw error;active=data as Conversation;onConversation(active);}
    const {data,error}=await supabase.functions.invoke("chat-agent",{body:{message,conversation_id:active.id,project_id:active.project_id??undefined}});
    if(error){let detail=error.message;try{const body=await error.context?.json();detail=body?.error||body?.message||detail;}catch{}throw new Error(detail);}
    if(data?.project_id&&!active.project_id){active={...active,project_id:data.project_id};onConversation(active);onProject(data.project_id);}
    if(data?.render_job_id)await watchJob(data.render_job_id);
    await loadMessages(active.id);
  }catch(e){Alert.alert("Message non envoyé",e instanceof Error?e.message:"Une erreur est survenue.");}finally{setBusy(false);}};
  const attach=async()=>{if(!conversation?.project_id){Alert.alert("Commencez votre production","Envoyez d'abord votre première instruction à Galingtosh. Vous pourrez ensuite joindre vos médias.");return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images","videos"],allowsMultipleSelection:true,quality:0.85,base64:true});
    if(result.canceled)return;
    try{setBusy(true);const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session expirée.");
      const ids:string[]=[];
      for(const asset of result.assets){const ext=(asset.fileName?.split(".").pop()|| (asset.type==="video"?"mp4":"jpg")).toLowerCase();const path=`${user.id}/${conversation.project_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;let base64=asset.base64;if(!base64)base64=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.Base64});const kind=asset.type==="video"?"video":"image";const {error:upErr}=await supabase.storage.from("user-uploads").upload(path,decode(base64),{contentType:asset.mimeType|| (kind==="video"?"video/mp4":"image/jpeg"),upsert:false});if(upErr)throw upErr;const {data,error}=await supabase.from("media_assets").insert({project_id:conversation.project_id,user_id:user.id,kind,source:"upload",storage_path:path}).select("id").single();if(error)throw error;ids.push(data.id);}
      if(ids.length)setInput(v=>(v?v+"\n":"")+"Analyse ces médias joints à ma production.");
    }catch(e){Alert.alert("Import impossible",e instanceof Error?e.message:"Erreur d'import.");}finally{setBusy(false);}
  };
  const renderMessage=({item}: {item:Message})=><View style={{alignSelf:item.role==="user"?"flex-end":"stretch",maxWidth:item.role==="user"?"88%":"100%",marginBottom:18,backgroundColor:item.role==="user"?colors.surfaceSoft:"transparent",borderRadius:18,padding:item.role==="user"?14:0,borderWidth:item.role==="user"?1:0,borderColor:colors.border}}>
    {item.role==="assistant"&&<View style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:8}}><Sparkles color={colors.violetBright} size={17}/><Text style={{color:colors.violetBright,fontSize:12,fontWeight:"700"}}>GALINGTOSH</Text></View>}
    <Text selectable style={{color:colors.text,fontSize:15,lineHeight:23}}>{item.content}</Text>
    {item.role==="assistant"&&item.metadata?.kind==="render_job"?null:null}
  </View>;
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:colors.background}} behavior={Platform.OS==="ios"?"padding":undefined} keyboardVerticalOffset={Platform.OS==="ios"?8:0}>
    <View style={{height:60,paddingHorizontal:16,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:colors.border,gap:14}}>
      <Pressable onPress={onMenu} hitSlop={10}><Menu color={colors.text} size={24}/></Pressable>
      <View style={{flex:1}}><Text style={{color:colors.text,fontSize:17,fontWeight:"750"}}>Galingtosh</Text><Text style={{color:colors.subtle,fontSize:10,letterSpacing:1.1}}>STUDIO IA</Text></View>
      <Pressable onPress={()=>{setMessages([]);setJob(null);setVideoUrl(null);onConversation(null as never);}} hitSlop={10} style={{width:38,height:38,borderRadius:12,backgroundColor:colors.surfaceSoft,alignItems:"center",justifyContent:"center"}}><Plus color={colors.text} size={21}/></Pressable>
    </View>
    {messages.length===0?<View style={{flex:1,justifyContent:"center",alignItems:"center",paddingHorizontal:30,paddingBottom:38}}>
      <View style={{width:118,height:118,borderRadius:42,backgroundColor:"#1A1030",borderWidth:1,borderColor:"#56318C",alignItems:"center",justifyContent:"center",shadowColor:"#8B42FF",shadowOpacity:0.25,shadowRadius:28}}><Clapperboard color={colors.violetBright} size={52} strokeWidth={1.3}/></View>
      <Text style={{color:colors.text,fontSize:24,fontWeight:"650",textAlign:"center",marginTop:28}}>Que souhaitez-vous créer ?</Text>
      <Text style={{color:colors.muted,fontSize:14,textAlign:"center",marginTop:10,lineHeight:21}}>Décrivez votre idée. Galingtosh s'occupe de la production.</Text>
      <View style={{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",gap:9,marginTop:25}}>
        {["Un court-métrage","Un documentaire","Un clip musical"].map(s=><Pressable key={s} onPress={()=>setInput(s+" : ")} style={{paddingHorizontal:13,paddingVertical:10,borderRadius:22,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface}}><Text style={{color:colors.muted,fontSize:12}}>{s}</Text></Pressable>)}
      </View>
    </View>:<FlatList ref={list} data={messages} keyExtractor={m=>m.id} renderItem={renderMessage} contentContainerStyle={{paddingHorizontal:20,paddingTop:22,paddingBottom:24}} onContentSizeChange={()=>list.current?.scrollToEnd({animated:true})}/>}
    {job&&<View style={{marginHorizontal:16,marginBottom:10,padding:14,borderRadius:15,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:9}}>{job.status==="done"?<Clapperboard color={colors.success} size={18}/>:job.status==="failed"?<X color={colors.danger} size={18}/>:<LoaderCircle color={colors.violetBright} size={18}/>}<Text style={{color:colors.text,fontWeight:"600",flex:1}}>{job.status==="done"?"Production terminée":job.status==="failed"?"Échec de la production":job.status==="queued"?"En attente de rendu":"Production en cours"}</Text><Text style={{color:colors.muted,fontSize:12}}>{job.progress}%</Text></View>
      <View style={{height:5,backgroundColor:colors.surfaceSoft,borderRadius:4,marginTop:12,overflow:"hidden"}}><View style={{height:5,width:`${Math.max(0,Math.min(100,job.progress))}%`,backgroundColor:colors.violet,borderRadius:4}}/></View>
      {job.error?<Text style={{color:colors.danger,fontSize:12,marginTop:9}}>{job.error}</Text>:null}
    </View>}
    {videoUrl&&<View style={{paddingHorizontal:16,marginBottom:10}}><VideoCard uri={videoUrl} title={filmTitle} version={version}/></View>}
    <View style={{paddingHorizontal:14,paddingTop:9,paddingBottom:Platform.OS==="android"?10:14,borderTopWidth:1,borderTopColor:colors.border}}>
      <View style={{minHeight:56,maxHeight:130,borderRadius:29,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface,flexDirection:"row",alignItems:"center",paddingHorizontal:10,gap:8}}>
        <Pressable onPress={attach} disabled={busy} style={{width:38,height:38,alignItems:"center",justifyContent:"center"}}><Paperclip color={colors.muted} size={21}/></Pressable>
        <TextInput value={input} onChangeText={setInput} placeholder="Décrivez votre production..." placeholderTextColor={colors.subtle} multiline style={{flex:1,color:colors.text,fontSize:14,maxHeight:110,paddingTop:12,paddingBottom:12}}/>
        <Pressable onPress={send} disabled={busy||!input.trim()} style={{width:40,height:40,borderRadius:20,backgroundColor:busy||!input.trim()?colors.surfaceSoft:colors.violet,alignItems:"center",justifyContent:"center"}}>{busy?<ActivityIndicator color="white" size="small"/>:<Send color="white" size={18}/>}</Pressable>
      </View>
    </View>
  </KeyboardAvoidingView>;
}