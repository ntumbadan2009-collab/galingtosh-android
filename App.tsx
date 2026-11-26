import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Alert,AppState,BackHandler,FlatList,Image,Keyboard,Linking,Modal,Platform,Pressable,ScrollView,Share,StatusBar,StyleSheet,Text,TextInput,ToastAndroid,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {KeyboardProvider,KeyboardStickyView} from 'react-native-keyboard-controller';
import {StatusBar as ExpoStatusBar} from 'expo-status-bar';
import {Feather,Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {File} from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import {VideoView,useVideoPlayer} from 'expo-video';
import {supabase,supabaseConfigured,SUPABASE_URL} from './src/lib/supabase';
import {sendToAgent,recoverAgentResponse} from './src/lib/ai';
import {buildActivityTurns,activityLabel,missionBlockReason,taskFailureDetail,type ActivityRow,type ActivityTurn} from './src/lib/agentActivity';
import {trailingSpace,anchorOffset,canAnchor} from './src/lib/chatLayout';
import {readProduction,controlProduction,activeProduction,creativePlanHeadline,creativePlanFormat,PRODUCTION_LABELS,type ProductionMission,type MissionTask} from './src/lib/production';
import {getRenderDownloadUrl,getRenderJob,listRenderJobs,requestRender,RenderJob} from './src/lib/render';

WebBrowser.maybeCompleteAuthSession();
type Tab='studio'|'projects'|'media'|'account';
type Message={id:string;role:'user'|'assistant';text:string};
type Project={id:string;title:string;type:string;created_at:string;updated_at:string};
type Asset={id:string;project_id:string;kind:string;source:string;storage_path:string|null;license:string|null;provenance:any;analysis:any;preview?:string};
type Attachment={id:string;path:string;name:string};
const JOB_LABELS:Record<string,string>={queued:'En attente',running:'En production',done:'Terminé',failed:'Échec',canceled:'Annulé'};
const REDIRECT='galingtosh://auth/callback';
const C={bg:'#080611',surface:'#12101E',surface2:'#191629',surface3:'#211B35',border:'#332846',text:'#F7F3FF',muted:'#B2A7C8',dim:'#A096AD',purple:'#783BFF',violet:'#A75BFF',pink:'#F17BCB',green:'#55D6A1',amber:'#FFC66D',red:'#FF7187'};

function BrandMark({size=43}:{size?:number}){return <LinearGradient colors={['#FFC66D','#F16BCB','#793BFF']} start={{x:0,y:0}} end={{x:1,y:1}} style={{width:size,height:size,borderRadius:size*.35,alignItems:'center',justifyContent:'center'}}><Ionicons name="film" size={size*.58} color="#130D24"/></LinearGradient>;}
function Button({title,onPress,secondary=false,loading=false,disabled=false,icon}:{title:string;onPress:()=>void;secondary?:boolean;loading?:boolean;disabled?:boolean;icon?:any}){return <Pressable onPress={onPress} disabled={disabled||loading} style={({pressed})=>[s.button,secondary&&s.buttonSecondary,(pressed||disabled)&&{opacity:.55}]}>{loading?<ActivityIndicator color={C.text}/>:icon?<Feather name={icon} size={17} color={secondary?C.violet:'#FFF'}/>:null}<Text style={s.buttonText}>{title}</Text></Pressable>;}
function Field({value,onChangeText,placeholder,multiline=false,secureTextEntry=false,keyboardType='default',autoCapitalize='sentences',style}:any){return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.dim} multiline={multiline} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize} textAlignVertical={multiline?'top':'center'} selectionColor={C.violet} style={[s.field,multiline&&s.multiline,style]}/>;}
function Panel({children,style}:any){return <View style={[s.panel,style]}>{children}</View>;}
function inlineMarkdown(value:string,keyPrefix:string){
 const parts=value.split(/(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+`|\*[^*\n]+?\*|_[^_\n]+?_)/g).filter(Boolean);
 return parts.map((part,index)=>{
  if(part.startsWith('**')||part.startsWith('__'))return <Text key={keyPrefix+index} style={{fontWeight:'800'}}>{part.slice(2,-2)}</Text>;
  if(part.startsWith('`'))return <Text key={keyPrefix+index} style={{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',color:C.violet}}>{part.slice(1,-1)}</Text>;
  if(part.startsWith('*')||part.startsWith('_'))return <Text key={keyPrefix+index} style={{fontStyle:'italic'}}>{part.slice(1,-1)}</Text>;
  return part;
 });
}
function AssistantMessage({text}:{text:string}){
 const blocks=text.trim().split(/\n{2,}/).filter(Boolean);
 return <View style={{gap:10}}>{blocks.map((block,blockIndex)=>{
  const lines=block.split('\n').filter(line=>line.trim());
  const items=lines.map(line=>({line,match:line.match(/^\s*(?:(- |\* |• )|(\d+[.)]\s+))(.+)$/)}));
  if(items.length&&items.every(item=>item.match))return <View key={'list'+blockIndex} style={{gap:6}}>{items.map((item,index)=>{const m=item.match!;const marker=m[2]?.trim()||'•';return <View key={'item'+index} style={{flexDirection:'row',alignItems:'flex-start',gap:7}}><Text style={{color:C.violet,fontSize:15,fontWeight:'800',minWidth:18}}>{marker}</Text><Text style={[s.messageText,{flex:1}]}>{inlineMarkdown(m[3],`i${blockIndex}-${index}-`)}</Text></View>;})}</View>;
  const heading=block.match(/^#{1,3}\s+(.+)$/);
  const content=heading?heading[1]:lines.join(' ');
  return <Text key={'p'+blockIndex} style={[s.messageText,heading&&{fontWeight:'800',fontSize:16}]}>{inlineMarkdown(content,`p${blockIndex}-`)}</Text>;
 })}</View>;
}

function NativeVideo({url}:{url:string}){
 const player=useVideoPlayer(url,p=>{p.loop=false;});
 return <VideoView player={player} style={{width:'100%',aspectRatio:16/9,backgroundColor:'#000',borderRadius:12}} nativeControls fullscreenOptions={{enable:true}} contentFit="contain"/>;
}
function AgentJournal({turns,busy,stale}:{turns:ActivityTurn[];busy:boolean;stale:boolean}){
 const [expanded,setExpanded]=useState(false);
 const [showHistory,setShowHistory]=useState(false);
 const withEvents=turns.filter(t=>t.events.length>0);
 const latest=turns[turns.length-1];
 const latestEvents=latest?.events||[];
 const historical=withEvents.filter(t=>t.id!==latest?.id).reverse();
 const displayed=showHistory?[...(latestEvents.length?[latest!]:[]),...historical]:latestEvents.length?[latest!]:[];
 const done=latestEvents.filter(e=>e.status==='done').length;
 const failures=latestEvents.filter(e=>e.status==='failed').length;
 if(!busy&&!withEvents.length&&!stale)return null;
 const open=expanded;
 return <View style={{marginVertical:7,borderWidth:1,borderColor:C.border,borderRadius:15,backgroundColor:C.surface,overflow:'hidden'}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Journal des actions de Galingtosh" accessibilityState={{expanded:open}} onPress={()=>setExpanded(v=>!v)} style={{flexDirection:'row',alignItems:'center',gap:9,padding:12}}>
   {busy?<ActivityIndicator size="small" color={C.violet}/>:<Feather name="activity" size={19} color={C.violet}/>}
   <View style={{flex:1,gap:3}}><Text style={{color:C.text,fontWeight:'700',fontSize:14}}>Activité de Galingtosh</Text><Text style={{color:C.muted,fontSize:12}}>{latestEvents.length?`${latestEvents[latestEvents.length-1].label} · ${done} confirmée(s)${failures?` · ${failures} en échec`:''}`:busy?'En attente des actions du serveur':stale?'Historique momentanément indisponible':'Journal des demandes précédentes'}</Text></View>
   <Feather name={open?'chevron-up':'chevron-down'} size={18} color={C.muted}/>
  </Pressable>
  {open?<View style={{padding:12,paddingTop:0,gap:10}}>
   {stale?<Text style={{color:C.amber,fontSize:12}}>Actualisation indisponible. Les dernières actions reçues restent affichées.</Text>:null}
   {!latestEvents.length&&busy?<Text style={{color:C.muted,fontSize:12}}>En attente des premières actions enregistrées par le serveur…</Text>:null}
   {displayed.map((turn,index)=><View key={turn.id} style={{gap:9}}>
    {showHistory?<Text style={{color:C.dim,fontSize:11}}>{turn.id===latest?.id?'Dernière demande':`Demande précédente · ${new Date(turn.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`}</Text>:null}
    {turn.events.map(e=><View key={e.id} style={{flexDirection:'row',alignItems:'flex-start',gap:9}}>
     <Feather name={e.status==='done'?'check-circle':e.status==='failed'?'alert-circle':'clock'} size={16} color={e.status==='done'?C.green:e.status==='failed'?C.amber:C.dim} style={{marginTop:2}}/>
     <View style={{flex:1,gap:2}}><Text style={{color:C.text,fontSize:13,fontWeight:'600'}}>{e.label}</Text>
      {e.detail?<Text style={{color:C.muted,fontSize:12}}>{e.detail}</Text>:null}
      <Text style={{color:e.status==='failed'?C.amber:C.dim,fontSize:11}}>{e.status==='done'?(e.name==='request_render'?'Demande enregistrée — rendu distinct':'Action confirmée'):e.status==='failed'?'Action en échec':'Résultat non confirmé'}</Text>
     </View>
    </View>)}
   </View>)}
   {historical.length>0?<Pressable accessibilityRole="button" accessibilityState={{expanded:showHistory}} onPress={()=>setShowHistory(v=>!v)} style={{paddingVertical:6}}><Text style={{color:C.violet,fontWeight:'600',fontSize:12}}>{showHistory?'Masquer les demandes précédentes':`Voir les demandes précédentes (${historical.length})`}</Text></Pressable>:null}
   <Text style={{color:C.dim,fontSize:11}}>Actions enregistrées par le serveur.</Text>
  </View>:null}
 </View>;
}

export default function App(){
 return <KeyboardProvider preload={false}><AppContent/></KeyboardProvider>;
}

function AppContent(){
 const [tab,setTab]=useState<Tab>('studio');
 const [session,setSession]=useState<any>(null);
 const [authReady,setAuthReady]=useState(false);
 const [keyboardVisible,setKeyboardVisible]=useState(false);
 const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [conversationId,setConversationId]=useState<string|null>(null);
 const [activity,setActivity]=useState<{conversationId:string;rows:ActivityRow[];stale:boolean}|null>(null);
 const [priorTurnId,setPriorTurnId]=useState<string|null>(null);
 const activityTurns=useMemo(()=>activity&&activity.conversationId===conversationId?buildActivityTurns(activity.rows):[],[activity,conversationId]);
 const visibleActivityTurns=busy&&priorTurnId&&activityTurns[activityTurns.length-1]?.id===priorTurnId?[...activityTurns,{id:'awaiting-new-turn',time:'',events:[]}]:activityTurns;
 const [activeProjectId,setActiveProjectId]=useState<string|null>(null);
 const [production,setProduction]=useState<{mission:ProductionMission|null;tasks:MissionTask[]}|null>(null);
 const [productionControlBusy,setProductionControlBusy]=useState(false);
 const [missionDetailsOpen,setMissionDetailsOpen]=useState(false);
 const mission=production?.mission?.project_id===activeProjectId?production.mission:null;
 const missionActive=activeProduction(mission);
 const missionWorking=!!mission&&['queued','running','waiting_render'].includes(mission.status);
 const [projects,setProjects]=useState<Project[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [attachments,setAttachments]=useState<Attachment[]>([]);
 const [job,setJob]=useState<RenderJob|null>(null);
 const [jobs,setJobs]=useState<RenderJob[]>([]);
 const [projectModal,setProjectModal]=useState(false);
 const [projectTitle,setProjectTitle]=useState('');
 const [projectBrief,setProjectBrief]=useState('');
 const [savingProject,setSavingProject]=useState(false);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
 const [authBusy,setAuthBusy]=useState(false);
 const [pageError,setPageError]=useState('');
 const [loadingProject,setLoadingProject]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [renderBusy,setRenderBusy]=useState(false);
 const [recovery,setRecovery]=useState(false);
 const [newPassword,setNewPassword]=useState('');
 const [film,setFilm]=useState<any>(null);
 const [filmVersion,setFilmVersion]=useState(1);
 const [showFilm,setShowFilm]=useState(false);
 const requestEpoch=useRef(0);
 const handledUrls=useRef(new Set<string>());
 const chatScroll=useRef<ScrollView>(null);
 const chatInputRef=useRef<TextInput>(null);
 const viewportRef=useRef(0);
 const contentRef=useRef(0);
 const lastTurnRef=useRef({id:null as string|null,y:0,height:0});
 const pendingAnchor=useRef<string|null>(null);
 const scrollPosition=useRef(0);
 const reduceMotion=useRef(false);
 const manualScroll=useRef(false);
 const [viewport,setViewport]=useState(0);
 const [turnHeight,setTurnHeight]=useState(0);
 const [showJump,setShowJump]=useState(false);
 const [messageMenu,setMessageMenu]=useState<Message|null>(null);
 const [selectedText,setSelectedText]=useState<string|null>(null);
 const [copiedId,setCopiedId]=useState<string|null>(null);
 const [videoSharing,setVideoSharing]=useState(false);
 const [video,setVideo]=useState<{url:string;path:string;job?:RenderJob}|null>(null);
 const [videoLoading,setVideoLoading]=useState(false);
 const [projectQuery,setProjectQuery]=useState('');
 const [projectFilter,setProjectFilter]=useState<'all'|'active'|'ready'>('all');
 const [mediaQuery,setMediaQuery]=useState('');
 const [mediaFilter,setMediaFilter]=useState<'all'|'image'|'video'|'audio'>('all');
 const [assetDetail,setAssetDetail]=useState<Asset|null>(null);
 const [projectMenu,setProjectMenu]=useState<Project|null>(null);
 const [renameProject,setRenameProject]=useState<Project|null>(null);
 const [renameTitle,setRenameTitle]=useState('');
 const projectPositions=useRef(new Map<string,number>());
 const restoreOnMount=useRef(false);
 const previousTab=useRef<Tab>('studio');
 const latestPromptIndex=messages.reduce((last,m,i)=>m.role==='user'?i:last,-1);
 const latestPromptId=latestPromptIndex>=0?messages[latestPromptIndex].id:null;
 const anchorLatest=useCallback(()=>{
  const measured=lastTurnRef.current;
  if(!canAnchor(pendingAnchor.current,measured.id,manualScroll.current)||!viewportRef.current)return;
  const max=contentRef.current-viewportRef.current;
  if(max+2<measured.y)return;
  pendingAnchor.current=null;
  chatScroll.current?.scrollTo({y:anchorOffset(measured.y,contentRef.current,viewportRef.current),animated:!reduceMotion.current});
 },[]);
 useEffect(()=>{
  AccessibilityInfo.isReduceMotionEnabled().then(v=>{reduceMotion.current=v;});
  const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{reduceMotion.current=v;});
  return()=>sub.remove();
 },[]);
 useLayoutEffect(()=>{if(previousTab.current!=='studio'&&tab==='studio')restoreOnMount.current=true;previousTab.current=tab;},[tab]);
 useEffect(()=>{
  if(tab==='studio')return;
  const sub=BackHandler.addEventListener('hardwareBackPress',()=>{setTab('studio');return true;});
  return()=>sub.remove();
 },[tab]);

 const user=session?.user;
 const activeProject=useMemo(()=>projects.find(p=>p.id===activeProjectId)||null,[projects,activeProjectId]);
 const currentJobs=jobs.filter(j=>j.project_id===activeProjectId);
 const latestJob=currentJobs[0];
 const readyJob=currentJobs.find(j=>j.status==='done'&&!!j.output_path);
 const activeJob=currentJobs.find(j=>j.status==='queued'||j.status==='running');
 const missionRender=mission?.render_job_id?currentJobs.find(j=>j.id===mission.render_job_id):undefined;
 const latestMissionTask=mission&&production?.mission?.id===mission.id?production.tasks[0]:undefined;
 const lastStepLabel=latestMissionTask?activityLabel(latestMissionTask.kind):null;
 const missionStage=mission?.status==='waiting_render'
  ?(missionRender?.status==='running'?'Encodage vidéo en cours':missionRender?.status==='queued'?'Rendu vidéo en attente':'Vérification du rendu vidéo')
  :mission?.status==='running'
   ?(lastStepLabel?(latestMissionTask?.status==='started'?'En cours : ':'Dernière étape : ')+lastStepLabel:'Organisation des étapes de production')
   :mission?.status==='queued'?'En attente du moteur de production'
   :mission?.status==='paused'?'Opérations suspendues'
   :mission?.status==='needs_review'?(missionBlockReason(mission.error_code)||'Une étape nécessite une vérification')
   :mission?.status==='done'?'Production terminée'
   :'';

 const visibleProjects=projects.filter(p=>{
  const related=jobs.filter(j=>j.project_id===p.id);
  return p.title.toLocaleLowerCase().includes(projectQuery.trim().toLocaleLowerCase())&&
   (projectFilter==='all'||(projectFilter==='active'?related.some(j=>['queued','running'].includes(j.status)):related.some(j=>j.status==='done'&&j.output_path)));
 });
 const visibleAssets=assets.filter(a=>(mediaFilter==='all'||a.kind===mediaFilter)&&
  String(a.provenance?.title||a.analysis?.original_name||a.kind).toLocaleLowerCase().includes(mediaQuery.trim().toLocaleLowerCase()));

 useEffect(()=>{
  const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
  const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
  return ()=>{show.remove();hide.remove();};
 },[]);
 // Opening or closing the keyboard must not move the conversation to its end.

 useEffect(()=>{
  if(!supabaseConfigured){setAuthReady(true);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true);}).catch(()=>setAuthReady(true));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);if(event==='PASSWORD_RECOVERY'){setRecovery(true);setTab('account');}if(!next)requestEpoch.current++;});
  return ()=>subscription.unsubscribe();
 },[]);

 const loadProjects=useCallback(async()=>{
  if(!user)return;
  const epoch=requestEpoch.current;
  const {data,error}=await supabase.from('projects').select('id,title,type,created_at,updated_at').order('updated_at',{ascending:false}).limit(50);
  if(error){setPageError('Impossible de charger ces données pour le moment.');return;}
  if(epoch===requestEpoch.current)setProjects((data||[]) as Project[]);
 },[user?.id]);

 const loadAssets=useCallback(async(projectId?:string|null)=>{
  if(!user)return;
  const epoch=requestEpoch.current;
  let q=supabase.from('media_assets').select('id,project_id,kind,source,storage_path,license,provenance,analysis').order('created_at',{ascending:false}).limit(80);
  if(projectId)q=q.eq('project_id',projectId);
  const {data,error}=await q;
  if(epoch!==requestEpoch.current)return;
  if(error){setPageError('Impossible de charger les médias. Les ressources déjà affichées sont conservées.');return;}
  const rows=await Promise.all((data||[]).map(async(a:Asset)=>{
   if(a.kind==='image'&&a.storage_path){const r=await supabase.storage.from('user-uploads').createSignedUrl(a.storage_path,900);return {...a,preview:r.data?.signedUrl};}
   return {...a,preview:a.provenance?.preview_url};
  }));
  if(epoch===requestEpoch.current)setAssets(rows);
 },[user?.id]);

 const loadJobs=useCallback(async(projectId?:string)=>{
  if(!user)return;
  const epoch=requestEpoch.current;
  try{const rows=await listRenderJobs();if(epoch!==requestEpoch.current)return;setJobs(rows);const relevant=projectId?rows.filter(j=>j.project_id===projectId):[];setJob(relevant[0]||null);}
  catch{/* Background refresh is intentionally silent; retain the last confirmed state. */}
 },[user?.id]);

 async function loadFilm(projectId:string){
  const epoch=requestEpoch.current;
  const {data,error}=await supabase.from('films').select('data,version').eq('project_id',projectId).order('version',{ascending:false}).limit(1).maybeSingle();
  if(epoch!==requestEpoch.current)return;
  if(error)throw error;setFilm(data?.data||null);setFilmVersion(data?.version||1);
 }
 async function openProject(id:string){
  if(busy||uploading||loadingProject){Alert.alert('Opération en cours','Attendez la fin de l’opération avant de changer de projet.');return;}
  const epoch=++requestEpoch.current;
  pendingAnchor.current=null;manualScroll.current=false;lastTurnRef.current={id:null,y:0,height:0};setTurnHeight(0);setShowJump(false);
  setProduction(null);setMissionDetailsOpen(false);setActiveProjectId(id);setConversationId(null);setMessages([]);setAttachments([]);setDraft('');setFilm(null);setJob(null);setJobs([]);setAssets([]);setTab('studio');setLoadingProject(true);setPageError('');
  try{
   const {data:c,error}=await supabase.from('conversations').select('id').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(error)throw error;
   if(epoch!==requestEpoch.current)return;
   if(c){
    const {data:history,error:he}=await supabase.from('messages').select('id,role,content').eq('conversation_id',c.id).in('role',['user','assistant']).order('created_at',{ascending:false}).limit(100);
    if(he)throw he;if(epoch!==requestEpoch.current)return;
    const restored=(history||[]).reverse().filter(m=>m.content).map(m=>({id:m.id,role:m.role,text:m.content}));setConversationId(c.id);setMessages(restored);pendingAnchor.current=[...restored].reverse().find(m=>m.role==='user')?.id||null;manualScroll.current=false;setTurnHeight(0);
   }
   await Promise.all([loadFilm(id),loadAssets(id),loadJobs(id)]);
  }catch{if(epoch===requestEpoch.current)setPageError('Le projet n’a pas pu être chargé complètement. Rouvrez-le pour réessayer.');}
  finally{if(epoch===requestEpoch.current)setLoadingProject(false);}
 }
 useEffect(()=>{
  requestEpoch.current++;
  if(user){loadProjects();loadAssets();loadJobs();}
  else{setProjects([]);setAssets([]);setJobs([]);setActiveProjectId(null);setConversationId(null);setMessages([]);setAttachments([]);setDraft('');setJob(null);setFilm(null);setPassword('');setRecovery(false);setPageError('');}
 },[user?.id,loadProjects,loadAssets,loadJobs]);

 useEffect(()=>{
  if(!user)return;
  let refreshing=false;const refresh=async()=>{if(refreshing||AppState.currentState!=='active')return;refreshing=true;try{await loadJobs(activeProjectId||undefined);}finally{refreshing=false;}};
  const sub=AppState.addEventListener('change',state=>{if(state==='active'){supabase.auth.startAutoRefresh();refresh();}else supabase.auth.stopAutoRefresh();});
  const timer=setInterval(refresh,5000);
  return ()=>{sub.remove();clearInterval(timer);};
 },[user?.id,activeProjectId,loadJobs]);
 useEffect(()=>{if(!user)return;if(tab==='projects'){void loadProjects();void loadJobs(activeProjectId||undefined);}if(tab==='media'){void loadAssets();void loadJobs(activeProjectId||undefined);}},[tab,user?.id,activeProjectId,loadProjects,loadAssets,loadJobs]);

 // The existing messages table is protected by owner-only RLS. Read metadata
 // instead of raw tool payloads. Refresh while this Studio is in use, with
 // no overlapping reads and no stale results crossing project boundaries.
 useEffect(()=>{
  if(!user||!conversationId||tab!=='studio')return;
  const currentId=conversationId;
  const epoch=requestEpoch.current;
  let disposed=false,reading=false;
  const refresh=async()=>{
   if(disposed||reading||AppState.currentState!=='active')return;
   reading=true;
   try{
    const {data,error}=await supabase.from('messages').select('id,role,created_at,metadata')
     .eq('conversation_id',currentId).eq('user_id',user.id)
     .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);
    if(disposed||epoch!==requestEpoch.current)return;
    if(error)throw error;
    setActivity({conversationId:currentId,rows:((data||[]) as ActivityRow[]).reverse(),stale:false});
   }catch{
    if(!disposed&&epoch===requestEpoch.current)setActivity(old=>({conversationId:currentId,rows:old?.conversationId===currentId?old.rows:[],stale:true}));
   }finally{reading=false;}
  };
  void refresh();
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  const timer=busy||missionWorking?setInterval(()=>void refresh(),2500):null;
  return()=>{disposed=true;sub.remove();if(timer)clearInterval(timer);};
 },[user?.id,conversationId,tab,busy,missionWorking]);

 useEffect(()=>{
  if(!user||!activeProjectId)return;
  const id=activeProjectId,epoch=requestEpoch.current;
  let disposed=false,reading=false;
  const refresh=async()=>{
   if(disposed||reading||AppState.currentState!=='active')return;
   reading=true;
   try{
    const value=await readProduction(id);
    if(!disposed&&epoch===requestEpoch.current)setProduction(value);
   }catch{/* Older backend or connectivity loss: do not invent a mission state. */}
   finally{reading=false;}
  };
  void refresh();
  const sub=AppState.addEventListener('change',v=>{if(v==='active')void refresh();});
  const timer=setInterval(()=>void refresh(),4000);
  return()=>{disposed=true;clearInterval(timer);sub.remove();};
 },[user?.id,activeProjectId,busy]);
 useEffect(()=>{
  if(mission?.status!=='done'||!activeProjectId)return;
  void loadJobs(activeProjectId);void loadFilm(activeProjectId).catch(()=>{});void loadAssets(activeProjectId);
 },[mission?.id,mission?.status]);
 async function runMissionCommand(command:'approve'|'pause'|'resume'|'cancel'){
  if(!mission||productionControlBusy)return;
  const id=mission.id,projectId=mission.project_id,epoch=requestEpoch.current;
  const wasDraft=mission.status==='draft';
  setProductionControlBusy(true);
  try{
   const reply=await controlProduction(id,command);
   const current=await readProduction(projectId);
   if(epoch===requestEpoch.current){
    setProduction(current);
    setMissionDetailsOpen(false);
    if(wasDraft&&reply){
     const now=Date.now();
     setMessages(rows=>[...rows,
      {id:'action-user-'+now,role:'user',text:command==='approve'?'Je valide le plan':'Je refuse ce plan'},
      {id:'action-reply-'+now,role:'assistant',text:reply}]);
    }
   }
  }catch{if(epoch===requestEpoch.current)Alert.alert('Commande non confirmée','Le projet reste enregistré. Réessaie après avoir vérifié la connexion.');}
  finally{setProductionControlBusy(false);}
 }

 async function handleAuthUrl(url:string){
  if(!url.startsWith(REDIRECT)||handledUrls.current.has(url))return;
  handledUrls.current.add(url);
  try{
   const parsed=new URL(url);const hash=new URLSearchParams(parsed.hash.slice(1));
   if(parsed.searchParams.get('error')||hash.get('error'))throw new Error('Lien expiré ou invalide.');
   const code=parsed.searchParams.get('code');
   if(code){const {error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw error;}
   else{const access_token=hash.get('access_token');const refresh_token=hash.get('refresh_token');if(!access_token||!refresh_token)throw new Error('Lien incomplet.');const {error}=await supabase.auth.setSession({access_token,refresh_token});if(error)throw error;}
   if(hash.get('type')==='recovery'||parsed.searchParams.get('type')==='recovery'){setRecovery(true);setTab('account');}
  }catch{Alert.alert('Lien inutilisable','Demandez un nouveau lien puis ouvrez-le sur cet appareil.');}
 }
 useEffect(()=>{Linking.getInitialURL().then(url=>{if(url)handleAuthUrl(url);});const sub=Linking.addEventListener('url',e=>{handleAuthUrl(e.url);});return()=>sub.remove();},[]);
 async function savePassword(){
  if(newPassword.length<8){Alert.alert('Mot de passe trop court','Utilisez au moins 8 caractères.');return;}
  setAuthBusy(true);try{const {error}=await supabase.auth.updateUser({password:newPassword});if(error)throw error;setNewPassword('');setRecovery(false);Alert.alert('Mot de passe modifié','Votre nouveau mot de passe est enregistré.');}catch{Alert.alert('Modification impossible','Réessayez ou demandez un nouveau lien de réinitialisation.');}finally{setAuthBusy(false);}
 }

 async function signIn(){
  if(!supabaseConfigured){Alert.alert('Service temporairement indisponible','Veuillez réessayer ultérieurement.');return;}
  if(!email.trim()||!password){Alert.alert('Champs manquants','Saisissez votre e-mail et votre mot de passe.');return;}
  setAuthBusy(true);
  try{
   const result=authMode==='login'?await supabase.auth.signInWithPassword({email:email.trim(),password}):await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:REDIRECT}});
   if(result.error)throw result.error;
   if(authMode==='signup'&&!result.data.session)Alert.alert('Vérifiez votre e-mail','Un lien de confirmation vient de vous être envoyé.');
   else Alert.alert('Connexion réussie','Votre session Galingtosh est active.');
  }catch(e:any){Alert.alert('Authentification impossible','Vérifiez vos identifiants puis réessayez.');}
  finally{setAuthBusy(false);}
 }

 async function googleAuth(){
  if(!supabaseConfigured){Alert.alert('Service temporairement indisponible','Veuillez réessayer ultérieurement.');return;}
  setAuthBusy(true);
  try{
   const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:REDIRECT,skipBrowserRedirect:true}});
   if(error)throw error;if(!data.url)throw new Error("URL OAuth Google absente.");
   const result=await WebBrowser.openAuthSessionAsync(data.url,REDIRECT);
   if(result.type==='success'&&result.url)await handleAuthUrl(result.url);
  }catch(e:any){Alert.alert('Connexion Google impossible','Veuillez réessayer ou utiliser la connexion par e-mail.');}
  finally{setAuthBusy(false);}
 }

 async function resetPassword(){
  if(!supabaseConfigured||!email.trim()){Alert.alert('E-mail requis','Saisissez votre adresse e-mail.');return;}
  const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:REDIRECT});
  Alert.alert(error?'Échec':'E-mail envoyé',error?.message||'Consultez votre boîte e-mail pour réinitialiser votre mot de passe.');
 }

 async function signOut(){if(busy||uploading){Alert.alert('Opération en cours','Attendez la fin de l’envoi.');return;}const {error}=await supabase.auth.signOut();if(error)Alert.alert('Déconnexion impossible','Vérifiez votre connexion puis réessayez.');}

 async function createProject(){
  if(!user||!projectTitle.trim()||savingProject||busy||uploading)return;
  setSavingProject(true);
  try{
   const {data,error}=await supabase.rpc('create_studio_project',{p_title:projectTitle.trim(),p_synopsis:projectBrief.trim()});
   if(error)throw error;
   const created=(Array.isArray(data)?data[0]:data) as Project;
   await loadProjects();setProjectModal(false);setProjectTitle('');setProjectBrief('');
   await openProject(created.id);
   Alert.alert('Projet créé','Votre projet est prêt. Décrivez le film à réaliser dans le Studio.');
  }catch{Alert.alert('Création impossible','Veuillez réessayer dans quelques instants.');}
  finally{setSavingProject(false);}
 }

 async function addAttachment(){
  if(!user){setTab('account');return;}
  if(!activeProjectId){Alert.alert('Choisissez un projet','Ouvrez ou créez un projet avant d’importer vos médias.');setTab('projects');return;}
  if(uploading||busy||loadingProject)return;
  if(attachments.length>=10){Alert.alert('Limite atteinte','Vous pouvez joindre 10 médias par message.');return;}
  setUploading(true);
  try{
   const picked=await DocumentPicker.getDocumentAsync({type:['image/*','video/*','audio/*'],copyToCacheDirectory:true,multiple:false});
   if(picked.canceled||!picked.assets?.length)return;
   const file=picked.assets[0];const local=new File(file.uri);
   const mime=file.mimeType||local.type;
   const allowed=['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','video/webm','audio/mpeg','audio/wav','audio/mp4','audio/ogg'];
   if(!allowed.includes(mime))throw new Error('Format non pris en charge. Utilisez JPG, PNG, WebP, GIF, MP4, MOV, WebM, MP3, WAV, M4A ou OGG.');
   if(!local.size||local.size>50*1024*1024)throw new Error('Le fichier doit être non vide et ne pas dépasser 50 Mo.');
   const path=user.id+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
   const {error}=await supabase.storage.from('user-uploads').upload(path,await local.arrayBuffer(),{contentType:mime,upsert:false});
   if(error)throw error;
   const {data,error:insertError}=await supabase.from('media_assets').insert({project_id:activeProjectId,user_id:user.id,kind:mime.split('/')[0],source:'upload',storage_path:path,analysis:{original_name:file.name}}).select('id').single();
   if(insertError){await supabase.storage.from('user-uploads').remove([path]);throw insertError;}
   setAttachments(a=>[...a,{id:data.id,path,name:file.name}]);await loadAssets(activeProjectId);
  }catch(e:any){Alert.alert('Import impossible',e.message||'Vérifiez le fichier et votre connexion.');}
  finally{setUploading(false);}
 }

 async function sendMessage(){
  const text=draft.trim();if((!text&&!attachments.length)||busy||uploading||loadingProject||productionControlBusy)return;
  if(!supabaseConfigured||!user){Alert.alert('Connexion requise','Connectez-vous avec votre compte Galingtosh avant d’utiliser le Studio.');setTab('account');return;}
  const epoch=requestEpoch.current;const attached=[...attachments];setPriorTurnId(activityTurns[activityTurns.length-1]?.id||null);const msgId=String(Date.now());pendingAnchor.current=msgId;manualScroll.current=false;setShowJump(false);setTurnHeight(0);setMessages(m=>[...m,{id:msgId,role:'user',text:text||'Média joint',}]);Keyboard.dismiss();
  setDraft('');setAttachments([]);setBusy(true);
  let requestConversationId=conversationId;
  try{
   // Start the owned conversation first, so activity is available even on
   // the first request, before the HTTP response from chat-agent returns.
   if(!requestConversationId){
    const {data,error}=await supabase.from('conversations').insert({user_id:user.id,project_id:activeProjectId,title:(text||'Média joint').slice(0,60)}).select('id').single();
    if(error||!data?.id)throw new Error('Impossible de préparer la conversation.');
    if(epoch!==requestEpoch.current)return;
    requestConversationId=data.id;
    setConversationId(requestConversationId);
   }
   const result=await sendToAgent(text||'Analyse les médias joints et aide-moi à préparer mon film.',activeProjectId,attached.map(a=>a.id),requestConversationId);
   if(epoch!==requestEpoch.current)return;
   setMessages(m=>[...m,{id:String(Date.now()+1),role:'assistant',text:result.reply}]);
   if(result.conversation_id)setConversationId(result.conversation_id);
   const projectWithMission=result.project_id||activeProjectId;
   if(projectWithMission)void readProduction(projectWithMission).then(value=>{
    if(epoch===requestEpoch.current)setProduction(value);
   }).catch(()=>{});
   if(result.project_id){setActiveProjectId(result.project_id);loadProjects();await Promise.all([loadFilm(result.project_id),loadAssets(result.project_id)]);}
   if(result.render_job_id){const next=await getRenderJob(result.render_job_id);setJob(next);loadJobs(result.project_id||activeProjectId||undefined);}
  }catch(e:any){
   if(epoch!==requestEpoch.current)return;
   // A lost HTTP response is not evidence that the agent failed. Recover the
   // last persisted reply first so the user does not accidentally duplicate
   // scenes, audio tracks or render requests by pressing Send again.
   let recovered=null;
   try{
    recovered=await recoverAgentResponse(
     text||'Analyse les médias joints et aide-moi à préparer mon film.',
     activeProjectId,requestConversationId
    );
   }catch{/* The network may also be unavailable for recovery. */}
   if(epoch!==requestEpoch.current)return;
   if(recovered){
    setMessages(m=>[...m,{id:'recovered-'+Date.now(),role:'assistant',text:recovered!.reply}]);
    if(recovered.conversation_id)setConversationId(recovered.conversation_id);
    if(recovered.project_id){
     await Promise.allSettled([loadFilm(recovered.project_id),loadAssets(recovered.project_id)]);
    }
    setPageError('');
   }else{
    // Do not silently resend a mutating instruction. Reopen the project to
    // fetch operations committed after the response was lost.
    setDraft('');
    setAttachments([]);
    setPageError('La connexion à l’agent a été interrompue. La demande a peut-être continué côté serveur. Rouvrez le projet pour récupérer les modifications avant de donner une nouvelle instruction.');
   }
  }
  finally{setBusy(false);}
 }

 function startNewConversation(){
  if(busy||uploading||loadingProject){Alert.alert('Opération en cours','Attendez la fin de l’opération avant de démarrer une nouvelle conversation.');return;}
  requestEpoch.current++;
  pendingAnchor.current=null;manualScroll.current=false;lastTurnRef.current={id:null,y:0,height:0};setTurnHeight(0);setShowJump(false);
  setConversationId(null);setMessages([]);setDraft('');setAttachments([]);setPageError('');projectPositions.current.delete(activeProjectId||'new');setPriorTurnId(null);setTab('studio');
 }

 async function startRender(projectId:string){
  if(renderBusy)return;
  if(missionActive){Alert.alert('Production autonome active','Cette mission gère elle-même le rendu.');return;}
  try{setRenderBusy(true);const queued=await requestRender(projectId);const next=await getRenderJob(queued.job_id);setJob(next);await loadJobs(projectId);Alert.alert('Rendu lancé','Votre film est dans la file de production.');}
  catch(e:any){Alert.alert('Production impossible',e.message||'Vérifiez les plans et les médias du film.');}
  finally{setRenderBusy(false);}
 }

 async function openRender(path?:string|null){
  if(!path||videoLoading)return;
  setVideoLoading(true);
  const epoch=requestEpoch.current;
  try{const url=await getRenderDownloadUrl(path);if(epoch!==requestEpoch.current)return;setVideo({url,path,job:jobs.find(j=>j.output_path===path)});}
  catch{Alert.alert('Vidéo indisponible','Impossible de charger la vidéo pour le moment.');}
  finally{setVideoLoading(false);}
 }
 async function copyMessage(m:Message){
  try{const ok=await Clipboard.setStringAsync(m.text);if(!ok)throw Error('copy');setCopiedId(m.id);setMessageMenu(null);if(Platform.OS==='android'&&Number(Platform.Version)<33)ToastAndroid.show('Texte copié',ToastAndroid.SHORT);}
  catch{Alert.alert('Copie impossible','Sélectionne le texte pour le copier manuellement.');}
 }
 useEffect(()=>{if(!copiedId)return;const timeout=setTimeout(()=>setCopiedId(null),1800);return()=>clearTimeout(timeout);},[copiedId]);

 function renderChatMessage(m:Message){
  return m.role==='user'?<Pressable key={m.id} onLongPress={()=>setMessageMenu(m)} accessibilityRole="text" style={[s.message,s.userMessage]}><Text style={s.messageText}>{m.text}</Text></Pressable>:<View key={m.id} style={s.assistantRow}><BrandMark size={25}/><View style={s.assistantBody}><Text style={s.assistantName}>Galingtosh</Text><Pressable onLongPress={()=>setMessageMenu(m)}><AssistantMessage text={m.text}/></Pressable><View style={{flexDirection:'row',marginTop:6}}><Pressable accessibilityRole="button" accessibilityLabel={copiedId===m.id?'Texte copié':'Copier la réponse'} onPress={()=>void copyMessage(m)} style={s.inlineAction}><Feather name={copiedId===m.id?'check':'copy'} size={20} color={copiedId===m.id?C.green:C.muted}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Sélectionner le texte de la réponse" onPress={()=>setSelectedText(m.text)} style={s.inlineAction}><Feather name="type" size={19} color={C.muted}/></Pressable></View></View></View>;
 }
 const screenTitle=tab==='studio'?'Studio':tab==='projects'?'Mes projets':tab==='media'?'Médiathèque':'Compte';

 if(!authReady)return <SafeAreaProvider><SafeAreaView style={s.safe}><View style={s.loading}><BrandMark size={58}/><ActivityIndicator color={C.violet} style={{marginTop:20}}/><Text style={s.muted}>Initialisation de Galingtosh…</Text></View></SafeAreaView></SafeAreaProvider>;

 return <SafeAreaProvider><SafeAreaView style={s.safe} edges={['top','left','right','bottom']}><ExpoStatusBar style="light"/><StatusBar barStyle="light-content" backgroundColor={C.bg}/>
  <LinearGradient colors={['#080611','#090714','#07050D']} style={StyleSheet.absoluteFill}/>
  <View pointerEvents="none" style={[s.glowTop,{opacity:.07}]}/>
  {tab==='studio'?(!keyboardVisible?<View style={s.studioToolbar}>
   <Pressable style={s.toolbarBrand} onPress={()=>setTab('studio')}><BrandMark size={35}/><Text style={s.toolbarTitle}>Galingtosh</Text></Pressable>
   <View style={s.toolbarActions}><Pressable style={s.toolbarButton} onPress={startNewConversation} accessibilityRole="button" accessibilityLabel="Nouvelle conversation"><Feather name="edit-3" size={19} color={C.text}/></Pressable><Pressable style={s.toolbarButton} onPress={()=>setTab('account')} accessibilityRole="button" accessibilityLabel="Ouvrir les paramètres"><Feather name="settings" size={19} color={C.muted}/></Pressable></View>
  </View>:null):<View style={s.header}>
   <Pressable style={s.brand} onPress={()=>setTab('studio')}><BrandMark/><View><Text style={s.brandName}>Galingtosh</Text><Text style={s.brandSub}>CRÉEZ · MONTEZ · PARTAGEZ</Text></View></Pressable>
   <Pressable style={s.headerButton} onPress={()=>setTab('account')}><Feather name="settings" size={22} color={C.muted}/></Pressable>
  </View>}
  {pageError? <Pressable onPress={()=>setPageError('')} style={s.errorBanner}><Text style={s.errorText}>{pageError}  ×</Text></Pressable>:null}
  <View style={s.main}>
   {tab==='studio'?<View style={s.flex}>
    {activeProjectId&&!keyboardVisible?<View style={s.projectToolbar}><View style={{flex:1}}><Text style={s.sectionLabel}>PROJET</Text><Text numberOfLines={1} style={s.projectName}>{activeProject?.title||'Aucun projet sélectionné'}</Text>{!missionActive&&!activeJob&&latestJob?.status==='failed'?<Pressable onPress={()=>setTab('projects')} accessibilityRole="button" accessibilityLabel="Voir le dernier rendu interrompu"><Text numberOfLines={1} style={[s.cardMeta,{color:C.amber,marginTop:1}]}>Dernier rendu interrompu · détails dans Projets</Text></Pressable>:null}</View>{readyJob?<Pressable style={s.inlineAction} accessibilityRole="button" accessibilityLabel="Lire la dernière vidéo" onPress={()=>void openRender(readyJob.output_path)}><Feather name="play-circle" size={22} color={C.violet}/></Pressable>:null}{activeProjectId?<Pressable style={s.scenesButton} onPress={()=>{setShowFilm(true);loadFilm(activeProjectId).catch(()=>setPageError('Impossible de charger le film.'));}}><Feather name="layers" size={16} color={C.violet}/><Text style={s.scenesText}>Scènes</Text></Pressable>:<Pressable style={s.scenesButton} onPress={()=>setTab('projects')}><Feather name="folder" size={16} color={C.violet}/><Text style={s.scenesText}>Projets</Text></Pressable>}</View>:null}
    {mission?.status==='draft'&&!keyboardVisible?<View style={s.proposalStrip}>
     <Pressable accessibilityRole="button" accessibilityLabel="Lire le plan créatif" onPress={()=>{Keyboard.dismiss();setMissionDetailsOpen(true);}} style={{flexDirection:'row',gap:8,alignItems:'center'}}>
      <Feather name="film" size={18} color={C.violet}/>
      <View style={{flex:1}}><Text style={s.cardTitle}>Plan prêt · {Math.floor(mission.target_seconds/60)} min {mission.target_seconds%60} s</Text><Text numberOfLines={1} style={s.cardSub}>{creativePlanHeadline(mission.plan)}</Text></View>
      <Feather name="chevron-right" size={20} color={C.muted}/>
     </Pressable>
     <View style={{flexDirection:'row',gap:8}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Valider et produire" disabled={busy||productionControlBusy} style={[s.proposalButton,{backgroundColor:C.purple}]} onPress={()=>void runMissionCommand('approve')}><Feather name="check" color={C.text} size={15}/><Text style={s.proposalButtonText}>Valider</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Modifier le plan" disabled={busy||productionControlBusy} style={[s.proposalButton,{backgroundColor:C.surface3}]} onPress={()=>{setDraft(v=>v.trim()?v:'Je souhaite modifier le plan : ');chatInputRef.current?.focus();}}><Feather name="edit-3" size={15} color={C.violet}/><Text style={s.proposalButtonText}>Modifier</Text></Pressable>
     </View>
     <Text style={[s.cardMeta,{marginTop:0}]}>Ou écris « OK » pour valider.</Text>
    </View>:null}
    {mission?.status==='draft'&&keyboardVisible?<View style={s.keyboardContext}><Feather name="film" size={15} color={C.violet}/><Text style={s.keyboardContextText}>Plan en attente · « OK » pour valider</Text></View>:null}
    {mission&&missionActive&&mission.status!=='draft'?<Pressable accessibilityRole="button" accessibilityLabel="Consulter les étapes de production" onPress={()=>{Keyboard.dismiss();setMissionDetailsOpen(true);}} style={[s.productionStrip,keyboardVisible&&{paddingVertical:7}]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
       <Feather name={mission.status==='needs_review'?'alert-circle':'activity'} size={18} color={mission.status==='needs_review'?C.amber:C.violet}/>
       <View style={{flex:1}}><Text numberOfLines={1} style={s.cardTitle}>{PRODUCTION_LABELS[mission.status]}{missionRender?.status==='running'?' · '+(missionRender.progress||0)+'%':''}</Text>{!keyboardVisible?<Text numberOfLines={1} style={s.cardSub}>{missionStage}{mission.step_count?' · étape '+mission.step_count:''}</Text>:null}</View>
       <Feather name="chevron-right" size={19} color={C.muted}/>
      </View>
      {missionRender?.status==='running'?<View style={s.progressTrack}><View style={[s.progressFill,{width:(Math.max(0,Math.min(100,missionRender.progress||0))+'%') as any}]}/></View>:null}
    </Pressable>:null}
    {!missionActive&&activeJob?<Pressable accessibilityRole="button" accessibilityLabel="Voir le rendu en cours" onPress={()=>setTab('projects')} style={[s.productionStrip,keyboardVisible&&{paddingVertical:7}]}>
     <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Feather name="film" size={18} color={C.violet}/><View style={{flex:1}}><Text style={s.cardTitle}>Rendu v{activeJob.film_version} · {activeJob.progress||0}%</Text>{!keyboardVisible?<Text style={s.cardSub}>{JOB_LABELS[activeJob.status]} · suivi dans Projets</Text>:null}</View><Feather name="chevron-right" size={18} color={C.muted}/></View>
     <View style={s.progressTrack}><View style={[s.progressFill,{width:(Math.max(0,Math.min(100,activeJob.progress||0))+'%') as any}]}/></View>
    </Pressable>:null}
    {loadingProject?<ActivityIndicator color={C.violet}/>:null}
    <View style={s.flex}>
    <ScrollView ref={chatScroll} style={s.flex} contentContainerStyle={s.chatContent}
     keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'none'}
     decelerationRate="normal" scrollEventThrottle={32}
     onLayout={e=>{const h=e.nativeEvent.layout.height;viewportRef.current=h;setViewport(h);if(restoreOnMount.current&&!pendingAnchor.current){restoreOnMount.current=false;const saved=projectPositions.current.get(activeProjectId||'new')||0;requestAnimationFrame(()=>chatScroll.current?.scrollTo({y:saved,animated:false}));}anchorLatest();}}
     onContentSizeChange={(_,h)=>{contentRef.current=h;anchorLatest();}}
     onScrollBeginDrag={()=>{manualScroll.current=true;pendingAnchor.current=null;}}
     onScroll={e=>{const y=e.nativeEvent.contentOffset.y;scrollPosition.current=y;projectPositions.current.set(activeProjectId||'new',y);setShowJump(!!lastTurnRef.current.id&&y<lastTurnRef.current.y-80);}}>
     {messages.length>0?<View style={s.messages}>
      {messages.slice(0,Math.max(0,latestPromptIndex)).map(m=>renderChatMessage(m))}
      {latestPromptId?<View key={latestPromptId} style={{gap:18}} onLayout={e=>{const {y,height}=e.nativeEvent.layout;lastTurnRef.current={id:latestPromptId,y:y+12,height};setTurnHeight(height);anchorLatest();}}>
       {renderChatMessage(messages[latestPromptIndex])}
       {(busy||missionWorking||activityTurns.some(t=>t.events.length)||activity?.conversationId===conversationId&&activity?.stale)?<View style={s.assistantRow}><BrandMark size={25}/><View style={s.assistantBody}><AgentJournal key={latestPromptId} turns={visibleActivityTurns} busy={busy||missionWorking} stale={Boolean(activity?.conversationId===conversationId&&activity?.stale)}/></View></View>:null}
       {messages.slice(latestPromptIndex+1).map(m=>renderChatMessage(m))}
      </View>:messages.map(m=>renderChatMessage(m))}
      {latestPromptId?<View pointerEvents="none" style={{height:trailingSpace(viewport,turnHeight)}}/>:null}
     </View>:null}
    </ScrollView>
    {showJump?<Pressable accessibilityRole="button" accessibilityLabel="Rejoindre le dernier échange" onPress={()=>{pendingAnchor.current=null;chatScroll.current?.scrollTo({y:anchorOffset(lastTurnRef.current.y,contentRef.current,viewportRef.current),animated:!reduceMotion.current});setShowJump(false);}} style={s.jumpButton}><Feather name="arrow-down" size={19} color={C.text}/></Pressable>:null}
    </View>
    <KeyboardStickyView style={{backgroundColor:C.bg}}>
     <View style={{backgroundColor:C.bg}}>
     {uploading?<Text style={[s.muted,{textAlign:'center',padding:8}]}>Import du média en cours…</Text>:null}
    {attachments.length>0?<ScrollView horizontal style={s.attachmentStrip}>{attachments.map(a=><Pressable key={a.path} style={s.attachmentChip} onPress={()=>setAttachments(v=>v.filter(x=>x.path!==a.path))}><Feather name="paperclip" size={13} color={C.violet}/><Text numberOfLines={1} style={s.attachmentName}>{a.name}</Text><Feather name="x" size={13} color={C.muted}/></Pressable>)}</ScrollView>:null}
    <View style={s.composer}><Pressable style={s.attachButton} onPress={addAttachment} accessibilityRole="button" accessibilityLabel="Joindre un média"><Feather name="paperclip" size={23} color={C.muted}/></Pressable><TextInput ref={chatInputRef} value={draft} onChangeText={setDraft} onFocus={()=>setKeyboardVisible(true)} onBlur={()=>setKeyboardVisible(false)} placeholder={mission?.status==='draft'?"OK pour valider, ou vos modifications...":"Écrivez votre message..."} placeholderTextColor={C.dim} style={s.composerInput} multiline maxLength={5000} blurOnSubmit={false} returnKeyType="default" textAlignVertical="center" scrollEnabled/><Pressable style={{opacity:busy||uploading||loadingProject||productionControlBusy||(!draft.trim()&&!attachments.length)?0.45:1}} onPress={sendMessage} disabled={busy||uploading||loadingProject||productionControlBusy||(!draft.trim()&&!attachments.length)} accessibilityRole="button" accessibilityLabel="Envoyer le message"><LinearGradient colors={['#8C43FF','#5D22E8']} style={s.sendButton}><Feather name="send" size={21} color="#FFF"/></LinearGradient></Pressable></View>
     </View></KeyboardStickyView></View>:null}
   {tab==='projects'?<ScrollView contentContainerStyle={s.pageContent}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13}}><Text style={s.pageTitle}>Mes projets</Text><Pressable style={s.inlineAction} accessibilityRole="button" accessibilityLabel="Nouveau projet" onPress={()=>{if(!user){setTab('account');return;}setProjectModal(true);}}><Feather name="plus-circle" color={C.violet} size={27}/></Pressable></View>
    <Field value={projectQuery} onChangeText={setProjectQuery} placeholder="Rechercher un projet"/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:12}}>{([{id:'all',label:'Tous'},{id:'active',label:'En cours'},{id:'ready',label:'Terminés'}] as const).map(f=><Pressable key={f.id} accessibilityRole="button" accessibilityState={{selected:projectFilter===f.id}} onPress={()=>setProjectFilter(f.id)} style={[s.filterChip,projectFilter===f.id&&s.filterSelected]}><Text style={s.cardTitle}>{f.label}</Text></Pressable>)}</ScrollView>
    {visibleProjects.length===0?<Panel style={s.emptyPanel}><Feather name="film" size={30} color={C.muted}/><Text style={s.cardTitle}>{projects.length?'Aucun résultat':'Aucun projet enregistré'}</Text>{projects.length?null:<Text style={s.muted}>Crée un projet depuis le Studio.</Text>}</Panel>:visibleProjects.map(p=>{
     const related=jobs.filter(j=>j.project_id===p.id);const rendering=related.find(j=>['queued','running'].includes(j.status));const ready=related.find(j=>j.status==='done'&&j.output_path);
     const failure=related[0]?.status==='failed';
     return <Panel key={p.id} style={s.projectCard}><Pressable onPress={()=>openProject(p.id)} onLongPress={()=>setProjectMenu(p)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:11}} accessibilityRole="button" accessibilityLabel={p.title}>
      <View style={[s.projectIcon,{width:78,height:58}]}><Feather name={ready?'play-circle':'film'} size={26} color={C.violet}/></View><View style={{flex:1}}><Text numberOfLines={2} style={s.cardTitle}>{p.title}</Text><Text style={s.cardSub}>{rendering?`Production v${rendering.film_version} · ${rendering.progress||0}%`:failure?'Dernière production interrompue':ready?`Vidéo v${ready.film_version} disponible`:'Montage en préparation'}</Text>{rendering?<View style={s.progressTrack}><View style={[s.progressFill,{width:`${Math.max(0,Math.min(100,rendering.progress||0))}%`}]}/></View>:null}{ready&&rendering?<Text style={s.cardMeta}>Vidéo précédente v{ready.film_version} disponible</Text>:null}<Text style={s.cardMeta}>{new Date(p.updated_at).toLocaleDateString('fr-FR')}</Text></View></Pressable>
      <Pressable onPress={()=>setProjectMenu(p)} accessibilityRole="button" accessibilityLabel={`Options de ${p.title}`} style={s.inlineAction}><Feather name="more-vertical" size={20} color={C.muted}/></Pressable></Panel>;
    })}
    {activeProject?<Panel style={s.renderPanel}><Text style={s.sectionLabel}>PRODUCTION</Text><Text style={s.cardTitle}>{activeProject.title}</Text><Button title="Lancer le rendu vidéo" onPress={()=>Alert.alert('Produire la vidéo ?', 'Le rendu utilisera la version actuelle du film. Vous pourrez continuer le montage pendant la production.',[{text:'Annuler',style:'cancel'},{text:'Lancer',onPress:()=>startRender(activeProject.id)}])} loading={renderBusy} disabled={busy||missionActive||loadingProject||!!jobs.find(j=>j.project_id===activeProject.id&&['queued','running'].includes(j.status))} icon="play"/>{job&&job.project_id===activeProject.id?<View style={s.jobBox}><Text style={s.cardSub}>Rendu : {JOB_LABELS[job.status]||job.status} · {job.progress||0}%</Text><View style={s.progressTrack}><View style={[s.progressFill,{width:((Math.max(0,Math.min(100,job.progress||0)))+'%') as any}]}/></View>{job.error?<Pressable accessibilityRole="button" onPress={()=>Alert.alert('Détails de la production',job.error||'')}><Text style={[s.cardSub,{color:C.amber}]}>La production a échoué. Consulter les détails.</Text></Pressable>:null}{job.warnings?.map((w,i)=><Text key={i} style={[s.cardSub,{color:C.amber}]}>{w}</Text>)}{['queued','running'].includes(job.status)?<Button title="Annuler le rendu" secondary onPress={()=>Alert.alert('Annuler cette production ?','Le montage sera conservé.',[{text:'Continuer',style:'cancel'},{text:'Annuler le rendu',style:'destructive',onPress:async()=>{const {error}=await supabase.rpc('cancel_render',{p_job_id:job.id});if(error)Alert.alert('Annulation impossible','Réessayez.');else loadJobs(activeProjectId||undefined);}}])}/>:null}{job.output_path?<Button title="Ouvrir la vidéo MP4" onPress={()=>openRender(job.output_path)} secondary icon="download"/>:null}</View>:null}</Panel>:null}
    <Text style={[s.sectionLabel,{marginTop:22}]}>VERSIONS ET PRODUCTIONS RÉCENTES</Text>{jobs.slice(0,8).map(j=><Panel key={j.id} style={s.jobRow}><View style={{flex:1}}><Text style={s.cardTitle}>{projects.find(p=>p.id===j.project_id)?.title||"Production"} · v{j.film_version}</Text><Text style={s.cardSub}>{JOB_LABELS[j.status]||j.status} · {j.progress||0}%</Text>{j.error?<Pressable onPress={()=>Alert.alert('Détails de la production',j.error||'')} accessibilityRole="button"><Text style={[s.cardSub,{color:C.amber}]}>Production interrompue · Détails</Text></Pressable>:null}{j.warnings?.map((w,i)=><Text key={i} style={[s.cardSub,{color:C.amber}]}>{w}</Text>)}</View>{j.output_path?<Pressable onPress={()=>openRender(j.output_path)}><Feather name="download" size={20} color={C.violet}/></Pressable>:null}</Panel>)}
   </ScrollView>:null}
   {tab==='media'?<ScrollView contentContainerStyle={s.pageContent}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13}}><Text style={s.pageTitle}>Médias</Text><Pressable accessibilityRole="button" accessibilityLabel="Importer un média" style={s.inlineAction} onPress={()=>{setTab('studio');addAttachment();}}><Feather name="plus-circle" size={27} color={C.violet}/></Pressable></View>
    <Field value={mediaQuery} onChangeText={setMediaQuery} placeholder="Rechercher un média"/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:12}}>{([{id:'all',label:'Tous'},{id:'image',label:'Images'},{id:'video',label:'Vidéos'},{id:'audio',label:'Audio'}] as const).map(f=><Pressable key={f.id} accessibilityRole="button" accessibilityState={{selected:mediaFilter===f.id}} onPress={()=>setMediaFilter(f.id)} style={[s.filterChip,mediaFilter===f.id&&s.filterSelected]}><Text style={s.cardTitle}>{f.label}</Text></Pressable>)}</ScrollView>
    {(mediaFilter==='all'||mediaFilter==='video')&&jobs.some(j=>j.status==='done'&&j.output_path)?<><Text style={s.sectionLabel}>VIDÉOS PRODUITES</Text>{jobs.filter(j=>j.status==='done'&&j.output_path&&String(projects.find(p=>p.id===j.project_id)?.title||'Vidéo').toLocaleLowerCase().includes(mediaQuery.trim().toLocaleLowerCase())).map(j=><Pressable key={j.id} onPress={()=>openRender(j.output_path)} accessibilityRole="button"><Panel style={s.jobRow}><View style={{flex:1}}><Text style={s.cardTitle}>{projects.find(p=>p.id===j.project_id)?.title||'Vidéo'}</Text><Text style={s.cardSub}>MP4 · version {j.film_version}</Text></View><Feather name="play-circle" size={25} color={C.violet}/></Panel></Pressable>)}</>:null}
    <Text style={[s.sectionLabel,{marginTop:20}]}>RESSOURCES</Text>
    {visibleAssets.length===0?<Text style={s.muted}>{assets.length?'Aucun média correspondant':'Aucune ressource enregistrée'}</Text>:<View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{visibleAssets.map(a=><Pressable key={a.id} onPress={()=>setAssetDetail(a)} accessibilityRole="button" accessibilityLabel={String(a.provenance?.title||a.analysis?.original_name||'Média')} style={{width:'47.5%',backgroundColor:C.surface,borderRadius:14,overflow:'hidden'}}>
      {a.preview&&['image','video'].includes(a.kind)?<Image source={{uri:a.preview}} style={{width:'100%',aspectRatio:4/3,backgroundColor:C.surface3}} resizeMode="cover"/>:<View style={{width:'100%',aspectRatio:4/3,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'}}><Feather name={a.kind==='audio'?'music':a.kind==='video'?'video':'image'} color={C.violet} size={30}/></View>}
      <View style={{padding:10}}><Text style={s.cardTitle} numberOfLines={2}>{a.provenance?.title||a.analysis?.original_name||'Média importé'}</Text><Text style={s.cardSub} numberOfLines={1}>{a.kind==='image'?'Image':a.kind==='video'?'Vidéo':'Audio'} · {a.license||'Droits à vérifier'}</Text></View>
    </Pressable>)}</View>}
   </ScrollView>:null}
   {tab==='account'?<ScrollView contentContainerStyle={s.pageContent}><Text style={s.kicker}>PRÉFÉRENCES</Text><Text style={s.pageTitle}>Compte & paramètres</Text>
    {recovery&&user?<Panel><Text style={s.cardTitle}>Nouveau mot de passe</Text><Field value={newPassword} onChangeText={setNewPassword} placeholder="Au moins 8 caractères" secureTextEntry/><Button title="Enregistrer le mot de passe" loading={authBusy} onPress={savePassword}/></Panel>:null}
    {!user?<Panel style={s.authPanel}><Text style={s.cardTitle}>{authMode==='login'?'Connexion à Galingtosh':'Créer un compte'}</Text><Text style={s.cardSub}>Utilisez votre adresse Gmail ou votre compte Google.</Text><Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" autoCapitalize="none" keyboardType="email-address" style={{marginTop:18}}/><Field value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry style={{marginTop:10}}/><Button title={authMode==='login'?'Se connecter':'Créer mon compte'} onPress={signIn} loading={authBusy}/><Button title="Continuer avec Google" onPress={googleAuth} secondary loading={authBusy} icon="chrome"/><Pressable onPress={()=>setAuthMode(v=>v==='login'?'signup':'login')}><Text style={s.link}>{authMode==='login'?'Créer un compte':'J’ai déjà un compte'}</Text></Pressable>{authMode==='login'?<Pressable onPress={resetPassword}><Text style={s.forgot}>Mot de passe oublié ?</Text></Pressable>:null}</Panel>:<Panel style={s.authPanel}><View style={s.accountRow}><View style={s.avatar}><Text style={s.avatarText}>{(user.email||'G').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>{user.email||'Compte Galingtosh'}</Text><Text style={s.cardSub}>Session authentifiée</Text></View></View><Button title="Se déconnecter" onPress={signOut} secondary icon="log-out"/></Panel>}
    <Text style={s.footer}>GALINGTOSH · ANDROID{ '\n'}Une création Dan Production</Text>
   </ScrollView>:null}
  </View>
  {!keyboardVisible&&<View style={s.nav}>{([{id:'studio',label:'Studio',icon:'message-circle'},{id:'projects',label:'Projets',icon:'film'},{id:'media',label:'Médias',icon:'grid'}] as const).map(item=><Pressable key={item.id} onPress={()=>setTab(item.id)} accessibilityRole="tab" accessibilityState={{selected:tab===item.id}} style={s.navItem}><Feather name={item.icon as any} size={20} color={tab===item.id?C.violet:C.dim}/><Text style={[s.navText,tab===item.id&&{color:C.text}]}>{item.label}</Text>{tab===item.id?<View style={s.navIndicator}/>:null}</Pressable>)}</View>}

  <Modal visible={missionDetailsOpen&&!!mission} animationType="slide" onRequestClose={()=>setMissionDetailsOpen(false)}>
   <SafeAreaView style={s.filmModal}>
    <View style={s.modalHeader}><Text numberOfLines={1} style={[s.cardTitle,{flex:1}]}>{mission?PRODUCTION_LABELS[mission.status]:'Production'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer les détails" style={s.inlineAction} onPress={()=>setMissionDetailsOpen(false)}><Feather name="x" size={24} color={C.text}/></Pressable></View>
    <ScrollView contentContainerStyle={{paddingTop:18,paddingBottom:40,gap:14}} keyboardShouldPersistTaps="handled">
     {mission?<View style={{gap:13}}>
      <Text style={s.cardTitle}>{creativePlanHeadline(mission.plan)}</Text>
      <Text style={s.cardSub}>Durée visée : {Math.floor(mission.target_seconds/60)} min {mission.target_seconds%60} s</Text>
      {mission.status==='draft'?<Text style={s.cardMeta}>Valide ce plan avec le bouton ou en écrivant « OK » dans le chat.</Text>:<Text style={s.cardSub}>{missionStage}{mission.step_count?' · étape '+mission.step_count:''}</Text>}
      <Text selectable style={[s.messageText,{fontSize:14,lineHeight:22}]}>{mission.plan}</Text>
      {mission.status==='draft'?<View style={{gap:8}}>
       <Button title="Valider et produire" icon="check" disabled={busy} loading={productionControlBusy} onPress={()=>void runMissionCommand('approve')}/>
       <Button title="Modifier dans le chat" icon="edit-3" secondary disabled={busy||productionControlBusy} onPress={()=>{setMissionDetailsOpen(false);setDraft(v=>v.trim()?v:'Je souhaite modifier le plan : ');requestAnimationFrame(()=>chatInputRef.current?.focus());}}/>
       <Button title="Refuser ce plan" secondary disabled={busy||productionControlBusy} onPress={()=>Alert.alert('Refuser cette proposition ?','Tu pourras en demander une nouvelle.',[{text:'Conserver',style:'cancel'},{text:'Refuser',style:'destructive',onPress:()=>void runMissionCommand('cancel')}])}/>
      </View>:<View style={{gap:12}}>
       {missionRender?<View style={{gap:6}}><Text style={s.cardSub}>Rendu : {JOB_LABELS[missionRender.status]||missionRender.status}{missionRender.status==='running'?' · '+(missionRender.progress||0)+'%':''}</Text>{missionRender.status==='running'?<View style={s.progressTrack}><View style={[s.progressFill,{width:(Math.max(0,Math.min(100,missionRender.progress||0))+'%') as any}]}/></View>:null}</View>:null}
       <Text style={s.cardTitle}>Journal des étapes</Text>
       {mission.status==='needs_review'&&missionBlockReason(mission.error_code)?<Text style={[s.cardSub,{color:C.amber}]}>{missionBlockReason(mission.error_code)}</Text>:null}
       {production?.tasks.length?production.tasks.slice(0,25).map(t=><View key={t.step_no} style={{flexDirection:'row',gap:9,alignItems:'center'}}><Feather name={t.status==='done'?'check-circle':t.status==='failed'||t.status==='uncertain'?'alert-circle':'clock'} color={t.status==='done'?C.green:t.status==='failed'||t.status==='uncertain'?C.amber:C.muted} size={17}/><View style={{flex:1}}><Text style={s.cardSub}>Étape {t.step_no} · {activityLabel(t.kind)}</Text><Text style={s.cardMeta}>{t.status==='done'?'Confirmée':t.status==='failed'?'Échouée':t.status==='uncertain'?'À vérifier':'En cours'}</Text>{taskFailureDetail(t)?<Text style={[s.cardMeta,{color:C.amber}]}>{taskFailureDetail(t)}</Text>:null}</View></View>):<Text style={s.cardSub}>Aucune opération enregistrée pour le moment.</Text>}
       {missionWorking&&!mission.requested_action?<Button title="Mettre en pause" secondary disabled={productionControlBusy} icon="pause" onPress={()=>void runMissionCommand('pause')}/>:null}
       {mission.status==='paused'?<Button title="Reprendre" icon="play" disabled={productionControlBusy} onPress={()=>void runMissionCommand('resume')}/>:null}
       {missionActive&&!mission.requested_action?<Button title="Annuler la mission" secondary disabled={productionControlBusy} onPress={()=>Alert.alert('Annuler cette production ?','Les éléments déjà réalisés seront conservés.',[{text:'Conserver',style:'cancel'},{text:'Annuler',style:'destructive',onPress:()=>void runMissionCommand('cancel')}])}/>:null}
      </View>}
     </View>:null}
    </ScrollView>
   </SafeAreaView>
  </Modal>
  <Modal visible={!!video} animationType="slide" onRequestClose={()=>setVideo(null)}><SafeAreaView style={s.filmModal}><View style={s.modalHeader}><Pressable style={s.inlineAction} accessibilityRole="button" accessibilityLabel="Fermer la vidéo" onPress={()=>setVideo(null)}><Feather name="arrow-left" size={22} color={C.text}/></Pressable><Text style={s.cardTitle}>Aperçu du film</Text><View style={{width:48}}/></View>{video?<ScrollView contentContainerStyle={{gap:14,paddingVertical:18}}><NativeVideo key={video.path} url={video.url}/><Text style={s.pageTitle}>{projects.find(p=>p.id===video.job?.project_id)?.title||'Vidéo produite'}</Text><Text style={s.cardSub}>MP4{video.job?` · Version ${video.job.film_version}`:''}</Text><Button title="Télécharger le MP4" secondary icon="download" onPress={async()=>{try{const url=await getRenderDownloadUrl(video.path);await Linking.openURL(url);}catch{Alert.alert('Téléchargement impossible','Vérifiez la connexion.');}}}/><Button title="Modifier dans le Studio" icon="edit-3" disabled={!video.job?.project_id||busy} onPress={()=>{const id=video.job?.project_id;setVideo(null);if(id){if(id===activeProjectId)setTab('studio');else void openProject(id);}}}/><Button title="Partager un lien temporaire" secondary icon="share-2" loading={videoSharing} onPress={async()=>{setVideoSharing(true);try{const url=await getRenderDownloadUrl(video.path);await Share.share({message:'Vidéo Galingtosh — lien privé temporaire (15 minutes) : '+url});}catch{Alert.alert('Partage impossible','Réessayez.');}finally{setVideoSharing(false);}}}/><Text style={s.cardMeta}>Les versions précédentes restent disponibles dans Projets.</Text></ScrollView>:null}</SafeAreaView></Modal>
  <Modal visible={!!projectMenu} transparent animationType="fade" onRequestClose={()=>setProjectMenu(null)}><View style={s.modalRoot}><Pressable style={s.scrim} onPress={()=>setProjectMenu(null)}/><View style={s.modalCard}><Text style={s.cardTitle}>{projectMenu?.title}</Text><Button title="Ouvrir dans le Studio" onPress={()=>{const p=projectMenu;setProjectMenu(null);if(p)void openProject(p.id);}} icon="message-circle"/><Button title="Renommer" secondary icon="edit-3" onPress={()=>{setRenameProject(projectMenu);setRenameTitle(projectMenu?.title||'');setProjectMenu(null);}}/>{jobs.find(j=>j.project_id===projectMenu?.id&&j.status==='done'&&j.output_path)?<Button title="Regarder la dernière vidéo" secondary icon="play" onPress={()=>{const j=jobs.find(j=>j.project_id===projectMenu?.id&&j.status==='done'&&j.output_path);setProjectMenu(null);if(j)void openRender(j.output_path);}}/>:null}<Button title="Fermer" secondary onPress={()=>setProjectMenu(null)}/></View></View></Modal>
  <Modal visible={!!renameProject} transparent animationType="fade" onRequestClose={()=>setRenameProject(null)}><View style={s.modalRoot}><Pressable style={s.scrim} onPress={()=>setRenameProject(null)}/><View style={s.modalCard}><Text style={s.cardTitle}>Renommer le projet</Text><Field value={renameTitle} onChangeText={setRenameTitle} placeholder="Nom du projet"/><Button title="Enregistrer" disabled={!renameTitle.trim()||savingProject} loading={savingProject} onPress={async()=>{if(!renameProject||!renameTitle.trim()||!user)return;setSavingProject(true);try{const {error}=await supabase.from('projects').update({title:renameTitle.trim()}).eq('id',renameProject.id).eq('user_id',user.id);if(error)throw error;setRenameProject(null);await loadProjects();}catch{Alert.alert('Modification impossible','Le nom du projet est conservé.');}finally{setSavingProject(false);}}}/><Button title="Annuler" secondary onPress={()=>setRenameProject(null)}/></View></View></Modal>
  <Modal visible={!!assetDetail} animationType="slide" onRequestClose={()=>setAssetDetail(null)}><SafeAreaView style={s.filmModal}><View style={s.modalHeader}><Text style={s.cardTitle}>Détails du média</Text><Pressable style={s.inlineAction} accessibilityRole="button" accessibilityLabel="Fermer" onPress={()=>setAssetDetail(null)}><Feather name="x" size={23} color={C.text}/></Pressable></View>{assetDetail?<ScrollView contentContainerStyle={{paddingVertical:16,gap:12}}>{assetDetail.preview?<Image source={{uri:assetDetail.preview}} style={{width:'100%',aspectRatio:16/9,borderRadius:12}} resizeMode="contain"/>:null}<Text style={s.cardTitle}>{assetDetail.provenance?.title||assetDetail.analysis?.original_name||'Média importé'}</Text><Text style={s.cardSub}>Source : {assetDetail.source}</Text><Text style={s.cardSub}>Licence : {assetDetail.license||'Droits à vérifier'}</Text><Text style={s.cardSub}>Auteur : {assetDetail.provenance?.author||'Non renseigné'}</Text>{Array.isArray(assetDetail.provenance?.restrictions)?assetDetail.provenance.restrictions.map((r:string,i:number)=><Text key={i} style={[s.cardSub,{color:C.amber}]}>{r}</Text>):null}{assetDetail.provenance?.url&&/^https?:\/\//.test(assetDetail.provenance.url)?<Button title="Consulter la source" secondary onPress={()=>Linking.openURL(assetDetail.provenance.url).catch(()=>Alert.alert('Lien indisponible'))} icon="external-link"/>:null}<Button title="Joindre à la conversation" disabled={assetDetail.project_id!==activeProjectId||attachments.length>=10} onPress={()=>{const a=assetDetail;if(a){setAttachments(v=>v.some(x=>x.id===a.id)?v:[...v,{id:a.id,path:a.storage_path||a.id,name:a.provenance?.title||a.analysis?.original_name||'Média'}]);setAssetDetail(null);setTab('studio');}}} icon="paperclip"/>{assetDetail.project_id!==activeProjectId?<Text style={s.cardSub}>Ouvre d’abord le projet associé pour joindre ce média.</Text>:null}</ScrollView>:null}</SafeAreaView></Modal>
  <Modal visible={!!messageMenu} transparent animationType="fade" onRequestClose={()=>setMessageMenu(null)}><View style={s.modalRoot}><Pressable style={s.scrim} onPress={()=>setMessageMenu(null)}/><View style={s.modalCard}><Text style={s.cardTitle}>Options du message</Text><Button title="Copier" icon="copy" onPress={()=>{if(messageMenu)void copyMessage(messageMenu);}}/><Button title="Sélectionner le texte" secondary icon="type" onPress={()=>{setSelectedText(messageMenu?.text||'');setMessageMenu(null);}}/><Button title="Fermer" secondary onPress={()=>setMessageMenu(null)}/></View></View></Modal>
  <Modal visible={selectedText!==null} animationType="slide" onRequestClose={()=>setSelectedText(null)}><SafeAreaView style={s.filmModal}><View style={s.modalHeader}><Text style={s.cardTitle}>Sélectionner le texte</Text><Pressable onPress={()=>setSelectedText(null)} accessibilityRole="button" accessibilityLabel="Fermer la sélection" style={s.inlineAction}><Feather name="x" color={C.text} size={23}/></Pressable></View><ScrollView contentContainerStyle={{paddingVertical:20}}><Text selectable selectionColor={C.violet} style={s.messageText}>{selectedText}</Text></ScrollView></SafeAreaView></Modal>
  <Modal visible={showFilm} animationType="slide" onRequestClose={()=>setShowFilm(false)}><SafeAreaView style={s.filmModal}><View style={s.modalHeader}><Text style={s.cardTitle}>Montage · version {filmVersion}</Text><Button title="Fermer" secondary onPress={()=>setShowFilm(false)}/></View><ScrollView contentContainerStyle={{paddingVertical:16,gap:12}}>{film?<><Text style={s.cardTitle}>{film.info?.title}</Text><Text style={s.cardSub}>{film.info?.synopsis||'Décrivez votre idée au Studio.'}</Text><Text style={s.cardMeta}>{film.format?.aspect} · {film.render?.resolution} · {film.format?.fps} images/s</Text>{(film.scenes||[]).length===0?<Text style={s.muted}>Aucune scène. Demandez à l’assistant de construire le scénario et les plans.</Text>:null}{[...(film.scenes||[])].sort((a,b)=>a.order-b.order).map((scene:any)=><Panel key={scene.id}><View style={{flexDirection:'row',alignItems:'center',gap:12}}>{(()=>{const media=film.media?.find((m:any)=>m.id===scene.shots?.[0]?.mediaRef);const asset=assets.find(a=>a.id===scene.shots?.[0]?.mediaRef||a.id===media?.assetId);return asset?.preview?<Image source={{uri:asset.preview}} style={{width:104,aspectRatio:16/9,borderRadius:10}}/>:<View style={{width:88,height:52,backgroundColor:C.surface3,borderRadius:10,alignItems:'center',justifyContent:'center'}}><Feather name="film" color={C.violet} size={21}/></View>})()}<View style={{flex:1}}><Text style={s.cardMeta}>SCÈNE {scene.order} · {Number(scene.durationSec||0).toFixed(1)} s</Text><Text style={s.cardTitle}>{scene.title}</Text><Text style={s.cardSub}>{scene.narrativeGoal}</Text><Text style={s.cardMeta}>{scene.shots?.length||0} plans</Text></View></View>{scene.narration?.text?<Text selectable style={[s.cardSub,{marginTop:10}]}>{scene.narration.text}</Text>:null}<Button title="Modifier cette scène" secondary icon="edit-3" onPress={()=>{setDraft(`Modifie uniquement la scène ${scene.order} : ${scene.title}. `);setShowFilm(false);setTab('studio');}}/>{(scene.shots||[]).map((shot:any)=><View key={shot.id} style={{paddingTop:12}}><Text style={s.cardSub}>Plan {shot.order} · {shot.inSec}–{shot.outSec} s · {shot.camera?.type||'none'}</Text><Text style={[s.cardMeta,!shot.mediaRef&&{color:C.amber}]}>{shot.mediaRef?'Média associé':'Média manquant : demandez à l’assistant de compléter ce plan.'}</Text></View>)}</Panel>)}<Text style={s.cardSub}>{film.audio?.tracks?.length||0} pistes audio · {film.subtitles?.length||0} pistes de sous-titres</Text><Button title="Modifier avec le Studio" onPress={()=>{setShowFilm(false);setTab('studio');}}/></>:<Text style={s.muted}>Le film est en cours de chargement ou n’a pas encore été créé.</Text>}</ScrollView></SafeAreaView></Modal>
  <Modal visible={projectModal} transparent animationType="fade" onRequestClose={()=>setProjectModal(false)}><View style={s.modalRoot}><Pressable style={s.scrim} onPress={()=>setProjectModal(false)}/><View style={s.modalCard}><Text style={s.cardTitle}>Créer un projet</Text><Text style={s.cardSub}>Définissez le titre et l’idée de départ.</Text><Field value={projectTitle} onChangeText={setProjectTitle} placeholder="Titre du projet" style={{marginTop:18}}/><Field value={projectBrief} onChangeText={setProjectBrief} placeholder="Décrivez brièvement votre idée…" multiline style={{marginTop:10,minHeight:90}}/><Button title="Créer le projet" onPress={createProject} loading={savingProject} disabled={!projectTitle.trim()}/><Button title="Annuler" onPress={()=>setProjectModal(false)} secondary/></View></View></Modal>

 </SafeAreaView></SafeAreaProvider>;
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},flex:{flex:1},main:{flex:1},header:{height:70,paddingHorizontal:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},studioToolbar:{height:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},toolbarBrand:{flexDirection:'row',alignItems:'center',gap:10},toolbarTitle:{fontSize:19,fontWeight:'800',color:C.text,letterSpacing:-.4},toolbarActions:{flexDirection:'row',gap:8},toolbarButton:{width:48,height:48,borderRadius:20,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},brand:{flexDirection:'row',alignItems:'center',gap:11},brandName:{fontSize:21,fontWeight:'800',color:C.text,letterSpacing:-.4},brandSub:{fontSize:8,color:C.dim,fontWeight:'800',letterSpacing:1.25,marginTop:3},headerButton:{width:44,height:44,borderRadius:22,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},projectToolbar:{minHeight:55,paddingHorizontal:19,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:12},projectName:{fontSize:14,color:C.text,fontWeight:'700'},scenesButton:{height:48,borderRadius:15,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border},scenesText:{fontSize:11,color:C.text,fontWeight:'700'},glowTop:{position:'absolute',width:320,height:320,borderRadius:180,backgroundColor:'#5417A5',opacity:.17,top:-220,right:-130},glowBottom:{position:'absolute',width:330,height:330,borderRadius:180,backgroundColor:'#3613A0',opacity:.14,bottom:-220,left:-190},errorBanner:{marginHorizontal:16,backgroundColor:'#391A2A',padding:9,borderRadius:10},errorText:{color:C.red,fontSize:11},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.bg},muted:{color:C.muted,fontSize:12,marginTop:10},filterChip:{minHeight:44,borderRadius:22,backgroundColor:C.surface2,paddingHorizontal:15,justifyContent:'center'},filterSelected:{backgroundColor:'#472C77',borderWidth:1,borderColor:C.violet},jumpButton:{position:'absolute',bottom:10,alignSelf:'center',width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:C.surface3,borderWidth:1,borderColor:C.border},inlineAction:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},proposalStrip:{marginHorizontal:14,marginVertical:4,paddingHorizontal:12,paddingVertical:10,borderRadius:14,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,gap:8},
 proposalButton:{flex:1,minHeight:42,alignItems:'center',justifyContent:'center',borderRadius:12,flexDirection:'row',gap:6},
 proposalButtonText:{color:C.text,fontWeight:'700',fontSize:12},
 productionStrip:{marginHorizontal:14,marginVertical:4,paddingHorizontal:12,paddingVertical:9,borderRadius:13,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border},
 keyboardContext:{marginHorizontal:14,minHeight:30,flexDirection:'row',alignItems:'center',gap:8},
 keyboardContextText:{color:C.muted,fontSize:12,fontWeight:'600',flex:1},
 chatContent:{flexGrow:1,paddingHorizontal:18,paddingTop:12,paddingBottom:0},center:{justifyContent:'center'},welcome:{alignItems:'flex-start',width:'100%',paddingHorizontal:2},welcomeMark:{width:52,height:52,borderRadius:18,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:18},onlineDot:{position:'absolute',right:1,bottom:1,width:12,height:12,borderRadius:7,backgroundColor:C.green,borderWidth:2,borderColor:C.bg},welcomeText:{fontSize:23,lineHeight:30,color:C.text,fontWeight:'700',textAlign:'left'},welcomeSub:{fontSize:14,color:C.muted,marginTop:8,lineHeight:21,letterSpacing:0},suggestions:{width:'100%',marginTop:24,gap:8},sectionLabel:{fontSize:9,color:C.dim,fontWeight:'900',letterSpacing:1.45,marginBottom:11},suggestion:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13},suggestionText:{flex:1,color:C.muted,fontSize:12},messages:{gap:18,paddingBottom:0},message:{maxWidth:'88%',paddingHorizontal:15,paddingVertical:11,borderRadius:20},userMessage:{alignSelf:'flex-end',backgroundColor:'#30204D',borderBottomRightRadius:6,borderWidth:1,borderColor:'#493365'},assistantRow:{alignSelf:'stretch',flexDirection:'row',alignItems:'flex-start',gap:10,paddingRight:3},assistantBody:{flex:1,paddingTop:2},assistantName:{fontSize:11,color:C.violet,fontWeight:'800',letterSpacing:.25,marginBottom:5},thinking:{flexDirection:'row',alignItems:'center',gap:9,paddingTop:5},thinkingText:{fontSize:13,color:C.muted},messageText:{fontSize:15,color:C.text,lineHeight:23},composer:{marginHorizontal:14,marginBottom:8,minHeight:62,maxHeight:118,borderRadius:30,borderWidth:1.5,borderColor:'#55456E',backgroundColor:'#151220',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},attachButton:{width:48,height:48,alignItems:'center',justifyContent:'center'},composerInput:{flex:1,minHeight:42,maxHeight:92,color:C.text,fontSize:14,paddingVertical:8,includeFontPadding:false},sendButton:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},disclaimer:{color:C.dim,fontSize:9,textAlign:'center',marginBottom:7,marginHorizontal:18},attachmentStrip:{maxHeight:39,marginHorizontal:15,marginBottom:6},attachmentChip:{height:32,borderRadius:16,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,marginRight:7},attachmentName:{color:C.muted,fontSize:10,maxWidth:130},nav:{height:64,backgroundColor:'#0E0C18',borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},navItem:{flex:1,height:'100%',alignItems:'center',justifyContent:'center',gap:4},navText:{fontSize:11,color:C.dim,fontWeight:'800'},navIndicator:{position:'absolute',top:0,width:25,height:2,borderRadius:2,backgroundColor:C.violet},pageContent:{padding:21,paddingBottom:42},kicker:{fontSize:9,color:C.violet,fontWeight:'900',letterSpacing:1.5,marginTop:9},pageTitle:{fontSize:29,color:C.text,fontWeight:'800',marginTop:7},pageDesc:{fontSize:13,color:C.muted,lineHeight:20,marginTop:7,marginBottom:22},button:{minHeight:48,borderRadius:15,backgroundColor:C.purple,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:9},buttonSecondary:{backgroundColor:C.surface2,borderWidth:1,borderColor:C.border},buttonText:{color:C.text,fontSize:13,fontWeight:'800'},panel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:18,padding:15},emptyPanel:{alignItems:'center',paddingVertical:32,marginTop:20,gap:10},cardTitle:{fontSize:14,color:C.text,fontWeight:'800'},cardSub:{fontSize:13,color:C.muted,lineHeight:17,marginTop:4},cardMeta:{fontSize:11,color:C.dim,marginTop:5},projectCard:{flexDirection:'row',alignItems:'center',gap:12,marginTop:10},projectIcon:{width:43,height:43,borderRadius:13,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},renderPanel:{marginTop:18,borderColor:'#49316F'},jobBox:{marginTop:12},progressTrack:{height:6,backgroundColor:C.surface3,borderRadius:4,marginTop:8,overflow:'hidden'},progressFill:{height:6,backgroundColor:C.violet,borderRadius:4},jobRow:{marginTop:8,flexDirection:'row',alignItems:'center'},assetCard:{marginTop:9,flexDirection:'row',alignItems:'center',gap:11},assetIcon:{width:42,height:42,borderRadius:13,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},assetImage:{width:48,height:48,borderRadius:12,backgroundColor:C.surface3},score:{fontSize:11,color:C.violet,fontWeight:'900'},authPanel:{marginTop:10},field:{minHeight:49,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface2,paddingHorizontal:14,color:C.text,fontSize:14},multiline:{minHeight:100,paddingTop:12,textAlignVertical:'top'},link:{textAlign:'center',color:C.violet,fontWeight:'800',fontSize:12,marginTop:17},forgot:{textAlign:'center',color:C.muted,fontSize:11,marginTop:13},smallNote:{fontSize:10,color:C.dim,lineHeight:16,marginTop:13,textAlign:'center'},accountRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},avatar:{width:44,height:44,borderRadius:22,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:17,color:C.violet,fontWeight:'900'},serviceRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},serviceValue:{fontSize:11,fontWeight:'800'},footer:{fontSize:9,color:C.dim,textAlign:'center',letterSpacing:1.1,lineHeight:17,marginTop:25},modalRoot:{flex:1,justifyContent:'center',padding:20},scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.72)'},modalCard:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:22,padding:19},filmModal:{flex:1,backgroundColor:C.bg,padding:18},modalHeader:{height:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.border},filmJson:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',fontSize:10,color:'#D6C9F2',lineHeight:16,paddingVertical:16}
});

