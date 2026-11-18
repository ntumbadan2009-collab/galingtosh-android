import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,FlatList,Image,Keyboard,Linking,Modal,Platform,Pressable,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {KeyboardProvider,KeyboardStickyView} from 'react-native-keyboard-controller';
import {StatusBar as ExpoStatusBar} from 'expo-status-bar';
import {Feather,Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {File} from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import {supabase,supabaseConfigured,SUPABASE_URL} from './src/lib/supabase';
import {sendToAgent} from './src/lib/ai';
import {getRenderDownloadUrl,getRenderJob,listRenderJobs,requestRender,RenderJob} from './src/lib/render';

WebBrowser.maybeCompleteAuthSession();
type Tab='studio'|'projects'|'media'|'account';
type Message={id:string;role:'user'|'assistant';text:string};
type Project={id:string;title:string;type:string;created_at:string;updated_at:string};
type Asset={id:string;project_id:string;kind:string;source:string;storage_path:string|null;license:string|null;provenance:any;analysis:any;preview?:string};
type Attachment={id:string;path:string;name:string};
const JOB_LABELS:Record<string,string>={queued:'En attente',running:'En production',done:'Terminé',failed:'Échec',canceled:'Annulé'};
const REDIRECT='galingtosh://auth/callback';
const C={bg:'#080611',surface:'#12101E',surface2:'#191629',surface3:'#211B35',border:'#332846',text:'#F7F3FF',muted:'#B2A7C8',dim:'#81758F',purple:'#783BFF',violet:'#A75BFF',pink:'#F17BCB',green:'#55D6A1',amber:'#FFC66D',red:'#FF7187'};

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
 const [activeProjectId,setActiveProjectId]=useState<string|null>(null);
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

 const user=session?.user;
 const activeProject=useMemo(()=>projects.find(p=>p.id===activeProjectId)||null,[projects,activeProjectId]);

 useEffect(()=>{
  const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
  const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
  return ()=>{show.remove();hide.remove();};
 },[]);
 useEffect(()=>{if(keyboardVisible)requestAnimationFrame(()=>chatScroll.current?.scrollToEnd({animated:true}));},[keyboardVisible]);

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
  if(error){setPageError('Impossible de charger les médias. Utilisez Actualiser pour réessayer.');return;}
  const rows=await Promise.all((data||[]).map(async(a:Asset)=>{
   if(a.kind==='image'&&a.storage_path){const r=await supabase.storage.from('user-uploads').createSignedUrl(a.storage_path,900);return {...a,preview:r.data?.signedUrl};}
   return {...a,preview:a.provenance?.preview_url};
  }));
  if(epoch===requestEpoch.current)setAssets(rows);
 },[user?.id]);

 const loadJobs=useCallback(async(projectId?:string)=>{
  if(!user)return;
  const epoch=requestEpoch.current;
  try{const rows=await listRenderJobs(projectId);if(epoch!==requestEpoch.current)return;setJobs(rows);setJob(rows.find(j=>['queued','running'].includes(j.status))||rows[0]||null);}
  catch{setPageError('Impossible de charger les productions. Utilisez Actualiser pour réessayer.');}
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
  setActiveProjectId(id);setConversationId(null);setMessages([]);setAttachments([]);setDraft('');setFilm(null);setJob(null);setJobs([]);setAssets([]);setTab('studio');setLoadingProject(true);setPageError('');
  try{
   const {data:c,error}=await supabase.from('conversations').select('id').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(error)throw error;
   if(epoch!==requestEpoch.current)return;
   if(c){
    const {data:history,error:he}=await supabase.from('messages').select('id,role,content').eq('conversation_id',c.id).in('role',['user','assistant']).order('created_at',{ascending:false}).limit(100);
    if(he)throw he;if(epoch!==requestEpoch.current)return;
    setConversationId(c.id);setMessages((history||[]).reverse().filter(m=>m.content).map(m=>({id:m.id,role:m.role,text:m.content})));
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
  const refresh=()=>{loadJobs(activeProjectId||undefined);};
  const sub=AppState.addEventListener('change',state=>{if(state==='active'){supabase.auth.startAutoRefresh();refresh();}else supabase.auth.stopAutoRefresh();});
  const timer=setInterval(refresh,5000);
  return ()=>{sub.remove();clearInterval(timer);};
 },[user?.id,activeProjectId,loadJobs]);

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
  const text=draft.trim();if((!text&&!attachments.length)||busy||uploading||loadingProject)return;
  if(!supabaseConfigured||!user){Alert.alert('Connexion requise','Connectez-vous avec votre compte Galingtosh avant d’utiliser le Studio.');setTab('account');return;}
  const epoch=requestEpoch.current;const attached=[...attachments];setMessages(m=>[...m,{id:String(Date.now()),role:'user',text:text||'Média joint',}]);
  setDraft('');setAttachments([]);setBusy(true);
  try{
   const result=await sendToAgent(text||'Analyse les médias joints et aide-moi à préparer mon film.',activeProjectId,attached.map(a=>a.id),conversationId);
   if(epoch!==requestEpoch.current)return;
   setMessages(m=>[...m,{id:String(Date.now()+1),role:'assistant',text:result.reply}]);
   if(result.conversation_id)setConversationId(result.conversation_id);
   if(result.project_id){setActiveProjectId(result.project_id);loadProjects();await Promise.all([loadFilm(result.project_id),loadAssets(result.project_id)]);}
   if(result.render_job_id){const next=await getRenderJob(result.render_job_id);setJob(next);loadJobs(result.project_id||activeProjectId||undefined);}
  }catch(e:any){if(epoch!==requestEpoch.current)return;setDraft(text);setAttachments(attached);setPageError(e.message||'La réponse n’a pas pu être reçue. Vérifiez le projet avant de renvoyer : certaines opérations peuvent avoir été enregistrées.');}
  finally{setBusy(false);}
 }

 function startNewConversation(){
  if(busy||uploading||loadingProject){Alert.alert('Opération en cours','Attendez la fin de l’opération avant de démarrer une nouvelle conversation.');return;}
  requestEpoch.current++;
  setConversationId(null);setMessages([]);setDraft('');setAttachments([]);setPageError('');setTab('studio');
 }

 async function startRender(projectId:string){
  if(renderBusy)return;
  try{setRenderBusy(true);const queued=await requestRender(projectId);const next=await getRenderJob(queued.job_id);setJob(next);await loadJobs(projectId);Alert.alert('Rendu lancé','Votre film est dans la file de production.');}
  catch(e:any){Alert.alert('Production impossible',e.message||'Vérifiez les plans et les médias du film.');}
  finally{setRenderBusy(false);}
 }

 async function openRender(path?:string|null){
  if(!path)return;
  try{const url=await getRenderDownloadUrl(path);await Linking.openURL(url);}
  catch{Alert.alert('Téléchargement impossible','La vidéo n’est pas disponible pour le moment.');}
 }

 const screenTitle=tab==='studio'?'Studio':tab==='projects'?'Mes projets':tab==='media'?'Médiathèque':'Compte';

 if(!authReady)return <SafeAreaProvider><SafeAreaView style={s.safe}><View style={s.loading}><BrandMark size={58}/><ActivityIndicator color={C.violet} style={{marginTop:20}}/><Text style={s.muted}>Initialisation de Galingtosh…</Text></View></SafeAreaView></SafeAreaProvider>;

 return <SafeAreaProvider><SafeAreaView style={s.safe} edges={['top','left','right','bottom']}><ExpoStatusBar style="light"/><StatusBar barStyle="light-content" backgroundColor={C.bg}/>
  <LinearGradient colors={['#080611','#090714','#07050D']} style={StyleSheet.absoluteFill}/>
  <View pointerEvents="none" style={s.glowTop}/><View pointerEvents="none" style={s.glowBottom}/>
  {tab==='studio'?<View style={s.studioToolbar}>
   <Pressable style={s.toolbarBrand} onPress={()=>setTab('studio')}><BrandMark size={35}/><Text style={s.toolbarTitle}>Galingtosh</Text></Pressable>
   <View style={s.toolbarActions}><Pressable style={s.toolbarButton} onPress={startNewConversation} accessibilityRole="button" accessibilityLabel="Nouvelle conversation"><Feather name="edit-3" size={19} color={C.text}/></Pressable><Pressable style={s.toolbarButton} onPress={()=>setTab('account')} accessibilityRole="button" accessibilityLabel="Ouvrir les paramètres"><Feather name="settings" size={19} color={C.muted}/></Pressable></View>
  </View>:<View style={s.header}>
   <Pressable style={s.brand} onPress={()=>setTab('studio')}><BrandMark/><View><Text style={s.brandName}>Galingtosh</Text><Text style={s.brandSub}>CRÉEZ · MONTEZ · PARTAGEZ</Text></View></Pressable>
   <Pressable style={s.headerButton} onPress={()=>setTab('account')}><Feather name="settings" size={22} color={C.muted}/></Pressable>
  </View>}
  {pageError? <Pressable onPress={()=>setPageError('')} style={s.errorBanner}><Text style={s.errorText}>{pageError}  ×</Text></Pressable>:null}
  <View style={s.main}>
   {tab==='studio'?<View style={s.flex}>
    <View style={s.projectToolbar}><View style={{flex:1}}><Text style={s.sectionLabel}>{activeProject?'PROJET':'ESPACE DE TRAVAIL'}</Text><Text numberOfLines={1} style={s.projectName}>{activeProject?.title||'Aucun projet sélectionné'}</Text></View>{activeProjectId?<Pressable style={s.scenesButton} onPress={()=>{setShowFilm(true);loadFilm(activeProjectId).catch(()=>setPageError('Impossible de charger le film.'));}}><Feather name="layers" size={16} color={C.violet}/><Text style={s.scenesText}>Scènes</Text></Pressable>:<Pressable style={s.scenesButton} onPress={()=>setTab('projects')}><Feather name="folder" size={16} color={C.violet}/><Text style={s.scenesText}>Projets</Text></Pressable>}</View>
    {activeProject&&job?.project_id===activeProject.id&&job.status==='done'&&job.output_path?<Pressable onPress={()=>openRender(job.output_path)} style={{marginHorizontal:18,marginTop:8,marginBottom:8,padding:14,borderRadius:16,backgroundColor:'#211638',borderWidth:1,borderColor:'#60418A',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{flex:1,paddingRight:10}}><Text style={{color:C.text,fontSize:13,fontWeight:'800'}}>Vidéo prête à regarder</Text><Text style={{color:C.muted,fontSize:11,marginTop:3}}>{activeProject.title} · Appuie pour ouvrir le MP4</Text></View><Feather name="play-circle" size={24} color={C.violet}/></Pressable>:null}
    {loadingProject?<ActivityIndicator color={C.violet}/>:null}
    <ScrollView ref={chatScroll} onContentSizeChange={()=>chatScroll.current?.scrollToEnd({animated:true})} style={s.flex} contentContainerStyle={[s.chatContent,messages.length===0&&s.center]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'}>
     {messages.length===0?<View style={s.welcome}>
      <View style={s.welcomeMark}><BrandMark size={43}/><View style={s.onlineDot}/></View>
      <Text style={s.welcomeText}>On commence par ton idée.</Text><Text style={s.welcomeSub}>Décris ce que tu veux raconter. On construira le film ensemble, étape par étape.</Text>
      <View style={s.suggestions}><Text style={s.sectionLabel}>OU CHOISIS UN POINT DE DÉPART</Text>{['Je veux raconter une histoire','Je prépare un documentaire','Je crée une vidéo pour les réseaux'].map((v,i)=><Pressable key={i} style={s.suggestion} onPress={()=>setDraft(v)}><Feather name={['book-open','video','smartphone'][i] as any} size={16} color={C.violet}/><Text style={s.suggestionText}>{v}</Text><Feather name="arrow-up-right" size={15} color={C.dim}/></Pressable>)}</View>
     </View>:<View style={s.messages}>{messages.map(m=>m.role==='user'?<View key={m.id} style={[s.message,s.userMessage]}><Text style={s.messageText}>{m.text}</Text></View>:<View key={m.id} style={s.assistantRow}><BrandMark size={25}/><View style={s.assistantBody}><Text style={s.assistantName}>Galingtosh</Text><AssistantMessage text={m.text}/></View></View>)}{busy?<View style={s.assistantRow}><BrandMark size={25}/><View style={s.assistantBody}><Text style={s.assistantName}>Galingtosh</Text><View style={s.thinking}><ActivityIndicator color={C.violet} size="small"/><Text style={s.thinkingText}>Je réfléchis à ta demande…</Text></View></View></View>:null}</View>}
    </ScrollView>
    <KeyboardStickyView style={{backgroundColor:C.bg}}>
     <View style={{backgroundColor:C.bg}}>
     {uploading?<Text style={[s.muted,{textAlign:'center',padding:8}]}>Import du média en cours…</Text>:null}
    {attachments.length>0?<ScrollView horizontal style={s.attachmentStrip}>{attachments.map(a=><Pressable key={a.path} style={s.attachmentChip} onPress={()=>setAttachments(v=>v.filter(x=>x.path!==a.path))}><Feather name="paperclip" size={13} color={C.violet}/><Text numberOfLines={1} style={s.attachmentName}>{a.name}</Text><Feather name="x" size={13} color={C.muted}/></Pressable>)}</ScrollView>:null}
    <View style={s.composer}><Pressable style={s.attachButton} onPress={addAttachment} accessibilityRole="button" accessibilityLabel="Joindre un média"><Feather name="paperclip" size={23} color={C.muted}/></Pressable><TextInput value={draft} onChangeText={setDraft} placeholder="Écrivez votre message..." placeholderTextColor={C.dim} style={s.composerInput} multiline maxLength={5000} blurOnSubmit={false} returnKeyType="default" textAlignVertical="center" scrollEnabled/><Pressable onPress={sendMessage} disabled={busy||uploading||loadingProject||(!draft.trim()&&!attachments.length)} accessibilityRole="button" accessibilityLabel="Envoyer le message"><LinearGradient colors={['#8C43FF','#5D22E8']} style={s.sendButton}><Feather name="send" size={21} color="#FFF"/></LinearGradient></Pressable></View>
     </View></KeyboardStickyView></View>:null}
   {tab==='projects'?<ScrollView contentContainerStyle={s.pageContent}>
    <Text style={s.kicker}>VOTRE ESPACE DE TRAVAIL</Text><Text style={s.pageTitle}>Mes projets</Text><Text style={s.pageDesc}>Retrouvez vos productions et reprenez votre travail.</Text>
    <Button title="Actualiser" secondary onPress={()=>{setPageError('');loadProjects();loadJobs(activeProjectId||undefined);}} icon="refresh-cw"/><Button title="Nouveau projet" onPress={()=>{if(!user){setTab('account');return;}setProjectModal(true);}} icon="plus"/>
    {projects.length===0?<Panel style={s.emptyPanel}><Feather name="film" size={34} color={C.dim}/><Text style={s.cardTitle}>Aucun projet enregistré</Text><Text style={s.muted}>Vos projets apparaîtront ici après leur création.</Text></Panel>:projects.map(p=><Pressable key={p.id} onPress={()=>openProject(p.id)}><Panel style={s.projectCard}><View style={s.projectIcon}><Feather name="film" size={21} color={C.violet}/></View><View style={{flex:1}}><Text style={s.cardTitle}>{p.title}</Text><Text style={s.cardSub}>{p.type}</Text><Text style={s.cardMeta}>Mis à jour le {new Date(p.updated_at).toLocaleDateString('fr-FR')}</Text></View><Feather name="chevron-right" size={19} color={C.dim}/></Panel></Pressable>)}
    {activeProject?<Panel style={s.renderPanel}><Text style={s.sectionLabel}>PRODUCTION</Text><Text style={s.cardTitle}>{activeProject.title}</Text><Button title="Lancer le rendu vidéo" onPress={()=>Alert.alert('Produire la vidéo ?', 'Le rendu utilisera la version actuelle du film. Vous pourrez continuer le montage pendant la production.',[{text:'Annuler',style:'cancel'},{text:'Lancer',onPress:()=>startRender(activeProject.id)}])} loading={renderBusy} disabled={busy||loadingProject||!!jobs.find(j=>j.project_id===activeProject.id&&['queued','running'].includes(j.status))} icon="play"/>{job&&job.project_id===activeProject.id?<View style={s.jobBox}><Text style={s.cardSub}>Rendu : {JOB_LABELS[job.status]||job.status} · {job.progress||0}%</Text><View style={s.progressTrack}><View style={[s.progressFill,{width:((Math.max(0,Math.min(100,job.progress||0)))+'%') as any}]}/></View>{job.error?<Text style={s.cardSub}>{job.error}</Text>:null}{job.warnings?.map((w,i)=><Text key={i} style={[s.cardSub,{color:C.amber}]}>{w}</Text>)}{['queued','running'].includes(job.status)?<Button title="Annuler le rendu" secondary onPress={()=>Alert.alert('Annuler cette production ?','Le montage sera conservé.',[{text:'Continuer',style:'cancel'},{text:'Annuler le rendu',style:'destructive',onPress:async()=>{const {error}=await supabase.rpc('cancel_render',{p_job_id:job.id});if(error)Alert.alert('Annulation impossible','Réessayez.');else loadJobs(activeProjectId||undefined);}}])}/>:null}{job.output_path?<Button title="Ouvrir la vidéo MP4" onPress={()=>openRender(job.output_path)} secondary icon="download"/>:null}</View>:null}</Panel>:null}
    <Text style={s.sectionLabel}>RENDU RÉCENT</Text>{jobs.slice(0,8).map(j=><Panel key={j.id} style={s.jobRow}><View style={{flex:1}}><Text style={s.cardTitle}>Production · v{j.film_version}</Text><Text style={s.cardSub}>{JOB_LABELS[j.status]||j.status} · {j.progress||0}%</Text>{j.error?<Text style={[s.cardSub,{color:C.red}]}>{j.error}</Text>:null}{j.warnings?.map((w,i)=><Text key={i} style={[s.cardSub,{color:C.amber}]}>{w}</Text>)}</View>{j.output_path?<Pressable onPress={()=>openRender(j.output_path)}><Feather name="download" size={20} color={C.violet}/></Pressable>:null}</Panel>)}
   </ScrollView>:null}
   {tab==='media'?<ScrollView contentContainerStyle={s.pageContent}><Text style={s.kicker}>RESSOURCES AUTORISÉES</Text><Text style={s.pageTitle}>Médiathèque</Text><Text style={s.pageDesc}>Catalogue des médias disponibles et de leurs licences.</Text><Button title="Actualiser les médias" secondary onPress={()=>loadAssets(activeProjectId)} icon="refresh-cw"/><Button title="Joindre un média à une conversation" onPress={()=>{setTab('studio');addAttachment();}} icon="paperclip"/>{jobs.some(j=>j.status==='done'&&j.output_path)?<><Text style={[s.sectionLabel,{marginTop:23}]}>VIDÉOS RENDUES</Text>{jobs.filter(j=>j.status==='done'&&j.output_path).map(j=><Pressable key={'render-'+j.id} onPress={()=>openRender(j.output_path)}><Panel style={[s.jobRow,{marginTop:8,borderColor:'#49316F'}]}><View style={{flex:1}}><Text style={s.cardTitle}>{projects.find(p=>p.id===j.project_id)?.title||'Vidéo rendue'}</Text><Text style={s.cardSub}>MP4 prêt · version {j.film_version}</Text></View><Feather name="play-circle" size={23} color={C.violet}/></Panel></Pressable>)}</>:null}{assets.length===0?<Panel style={s.emptyPanel}><Feather name="image" size={32} color={C.dim}/><Text style={s.cardTitle}>Aucun média dans le catalogue</Text><Text style={s.muted}>Les médias autorisés apparaîtront ici lorsqu’ils seront référencés dans la base.</Text></Panel>:assets.map(a=><Panel key={a.id} style={s.assetCard}>{a.preview&&a.kind==='image'?<Image source={{uri:a.preview}} style={s.assetImage as any}/>:<View style={s.assetIcon}><Feather name={a.kind==='video'?'video':a.kind==='audio'?'music':'image'} size={23} color={C.violet}/></View>}<View style={{flex:1}}><Text style={s.cardTitle}>{a.provenance?.title||a.analysis?.original_name||'Média importé'}</Text><Text style={s.cardSub}>{a.kind} · {a.source}</Text><Text style={s.cardMeta}>{a.license||'Droits à vérifier'}</Text><Text style={s.cardMeta}>{a.provenance?.author||'Import personnel'}</Text>{a.provenance?.restrictions?.map((r:string,i:number)=><Text key={i} style={[s.cardMeta,{color:C.amber}]}>{r}</Text>)}{a.provenance?.url&&/^https?:\/\//.test(a.provenance.url)?<Pressable onPress={()=>Linking.openURL(a.provenance.url).catch(()=>Alert.alert('Lien indisponible','Impossible d’ouvrir la source.'))}><Text style={s.link}>Consulter la source et la licence</Text></Pressable>:null}</View><Pressable accessibilityLabel="Joindre ce média" onPress={()=>{if(a.project_id!==activeProjectId){Alert.alert('Autre projet','Ouvrez le projet de ce média pour le joindre.');return;}if(attachments.length>=10)return;setAttachments(v=>v.some(x=>x.id===a.id)?v:[...v,{id:a.id,path:a.storage_path||a.id,name:a.provenance?.title||a.analysis?.original_name||'Média'}]);setTab('studio');}}><Feather name="plus-circle" size={24} color={C.violet}/></Pressable></Panel>)}</ScrollView>:null}
   {tab==='account'?<ScrollView contentContainerStyle={s.pageContent}><Text style={s.kicker}>PRÉFÉRENCES</Text><Text style={s.pageTitle}>Compte & paramètres</Text>
    {recovery&&user?<Panel><Text style={s.cardTitle}>Nouveau mot de passe</Text><Field value={newPassword} onChangeText={setNewPassword} placeholder="Au moins 8 caractères" secureTextEntry/><Button title="Enregistrer le mot de passe" loading={authBusy} onPress={savePassword}/></Panel>:null}
    {!user?<Panel style={s.authPanel}><Text style={s.cardTitle}>{authMode==='login'?'Connexion à Galingtosh':'Créer un compte'}</Text><Text style={s.cardSub}>Utilisez votre adresse Gmail ou votre compte Google.</Text><Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" autoCapitalize="none" keyboardType="email-address" style={{marginTop:18}}/><Field value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry style={{marginTop:10}}/><Button title={authMode==='login'?'Se connecter':'Créer mon compte'} onPress={signIn} loading={authBusy}/><Button title="Continuer avec Google" onPress={googleAuth} secondary loading={authBusy} icon="chrome"/><Pressable onPress={()=>setAuthMode(v=>v==='login'?'signup':'login')}><Text style={s.link}>{authMode==='login'?'Créer un compte':'J’ai déjà un compte'}</Text></Pressable>{authMode==='login'?<Pressable onPress={resetPassword}><Text style={s.forgot}>Mot de passe oublié ?</Text></Pressable>:null}</Panel>:<Panel style={s.authPanel}><View style={s.accountRow}><View style={s.avatar}><Text style={s.avatarText}>{(user.email||'G').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>{user.email||'Compte Galingtosh'}</Text><Text style={s.cardSub}>Session authentifiée</Text></View></View><Button title="Se déconnecter" onPress={signOut} secondary icon="log-out"/></Panel>}
    <Text style={s.footer}>GALINGTOSH · ANDROID{ '\n'}Une création Dan Production</Text>
   </ScrollView>:null}
  </View>
  {!keyboardVisible&&<View style={s.nav}>{([{id:'studio',label:'Studio',icon:'message-circle'},{id:'projects',label:'Projets',icon:'film'},{id:'media',label:'Médias',icon:'grid'}] as const).map(item=><Pressable key={item.id} onPress={()=>setTab(item.id)} style={s.navItem}><Feather name={item.icon as any} size={20} color={tab===item.id?C.violet:C.dim}/><Text style={[s.navText,tab===item.id&&{color:C.text}]}>{item.label}</Text>{tab===item.id?<View style={s.navIndicator}/>:null}</Pressable>)}</View>}

  <Modal visible={showFilm} animationType="slide" onRequestClose={()=>setShowFilm(false)}><SafeAreaView style={s.filmModal}><View style={s.modalHeader}><Text style={s.cardTitle}>Montage · version {filmVersion}</Text><Button title="Fermer" secondary onPress={()=>setShowFilm(false)}/></View><ScrollView contentContainerStyle={{paddingVertical:16,gap:12}}>{film?<><Text style={s.cardTitle}>{film.info?.title}</Text><Text style={s.cardSub}>{film.info?.synopsis||'Décrivez votre idée au Studio.'}</Text><Text style={s.cardMeta}>{film.format?.aspect} · {film.render?.resolution} · {film.format?.fps} images/s</Text>{(film.scenes||[]).length===0?<Text style={s.muted}>Aucune scène. Demandez à l’assistant de construire le scénario et les plans.</Text>:null}{[...(film.scenes||[])].sort((a,b)=>a.order-b.order).map((scene:any)=><Panel key={scene.id}><Text style={s.cardTitle}>{scene.order}. {scene.title}</Text><Text style={s.cardSub}>{scene.narrativeGoal}</Text><Text style={s.cardMeta}>{scene.durationSec} secondes · {scene.shots?.length||0} plans</Text>{(scene.shots||[]).map((shot:any)=><View key={shot.id} style={{paddingTop:12}}><Text style={s.cardSub}>Plan {shot.order} · {shot.inSec}–{shot.outSec} s · {shot.camera?.type||'none'}</Text><Text style={[s.cardMeta,!shot.mediaRef&&{color:C.amber}]}>{shot.mediaRef?'Média associé':'Média manquant : demandez à l’assistant de compléter ce plan.'}</Text></View>)}</Panel>)}<Text style={s.cardSub}>{film.audio?.tracks?.length||0} pistes audio · {film.subtitles?.length||0} pistes de sous-titres</Text><Button title="Modifier avec le Studio" onPress={()=>{setShowFilm(false);setTab('studio');}}/></>:<Text style={s.muted}>Le film est en cours de chargement ou n’a pas encore été créé.</Text>}</ScrollView></SafeAreaView></Modal>
  <Modal visible={projectModal} transparent animationType="fade" onRequestClose={()=>setProjectModal(false)}><View style={s.modalRoot}><Pressable style={s.scrim} onPress={()=>setProjectModal(false)}/><View style={s.modalCard}><Text style={s.cardTitle}>Créer un projet</Text><Text style={s.cardSub}>Définissez le titre et l’idée de départ.</Text><Field value={projectTitle} onChangeText={setProjectTitle} placeholder="Titre du projet" style={{marginTop:18}}/><Field value={projectBrief} onChangeText={setProjectBrief} placeholder="Décrivez brièvement votre idée…" multiline style={{marginTop:10,minHeight:90}}/><Button title="Créer le projet" onPress={createProject} loading={savingProject} disabled={!projectTitle.trim()}/><Button title="Annuler" onPress={()=>setProjectModal(false)} secondary/></View></View></Modal>

 </SafeAreaView></SafeAreaProvider>;
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},flex:{flex:1},main:{flex:1},header:{height:70,paddingHorizontal:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},studioToolbar:{height:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},toolbarBrand:{flexDirection:'row',alignItems:'center',gap:10},toolbarTitle:{fontSize:19,fontWeight:'800',color:C.text,letterSpacing:-.4},toolbarActions:{flexDirection:'row',gap:8},toolbarButton:{width:40,height:40,borderRadius:20,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},brand:{flexDirection:'row',alignItems:'center',gap:11},brandName:{fontSize:21,fontWeight:'800',color:C.text,letterSpacing:-.4},brandSub:{fontSize:8,color:C.dim,fontWeight:'800',letterSpacing:1.25,marginTop:3},headerButton:{width:44,height:44,borderRadius:22,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},projectToolbar:{minHeight:55,paddingHorizontal:19,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:12},projectName:{fontSize:14,color:C.text,fontWeight:'700'},scenesButton:{height:38,borderRadius:15,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border},scenesText:{fontSize:11,color:C.text,fontWeight:'700'},glowTop:{position:'absolute',width:320,height:320,borderRadius:180,backgroundColor:'#5417A5',opacity:.17,top:-220,right:-130},glowBottom:{position:'absolute',width:330,height:330,borderRadius:180,backgroundColor:'#3613A0',opacity:.14,bottom:-220,left:-190},errorBanner:{marginHorizontal:16,backgroundColor:'#391A2A',padding:9,borderRadius:10},errorText:{color:C.red,fontSize:11},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.bg},muted:{color:C.muted,fontSize:12,marginTop:10},chatContent:{flexGrow:1,paddingHorizontal:20,paddingTop:12,paddingBottom:14},center:{justifyContent:'center'},welcome:{alignItems:'flex-start',width:'100%',paddingHorizontal:2},welcomeMark:{width:52,height:52,borderRadius:18,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:18},onlineDot:{position:'absolute',right:1,bottom:1,width:12,height:12,borderRadius:7,backgroundColor:C.green,borderWidth:2,borderColor:C.bg},welcomeText:{fontSize:23,lineHeight:30,color:C.text,fontWeight:'700',textAlign:'left'},welcomeSub:{fontSize:14,color:C.muted,marginTop:8,lineHeight:21,letterSpacing:0},suggestions:{width:'100%',marginTop:24,gap:8},sectionLabel:{fontSize:9,color:C.dim,fontWeight:'900',letterSpacing:1.45,marginBottom:11},suggestion:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13},suggestionText:{flex:1,color:C.muted,fontSize:12},messages:{gap:19,paddingBottom:18},message:{maxWidth:'88%',paddingHorizontal:15,paddingVertical:11,borderRadius:20},userMessage:{alignSelf:'flex-end',backgroundColor:'#30204D',borderBottomRightRadius:6,borderWidth:1,borderColor:'#493365'},assistantRow:{alignSelf:'stretch',flexDirection:'row',alignItems:'flex-start',gap:10,paddingRight:3},assistantBody:{flex:1,paddingTop:2},assistantName:{fontSize:11,color:C.violet,fontWeight:'800',letterSpacing:.25,marginBottom:5},thinking:{flexDirection:'row',alignItems:'center',gap:9,paddingTop:5},thinkingText:{fontSize:13,color:C.muted},messageText:{fontSize:15,color:C.text,lineHeight:23},composer:{marginHorizontal:14,marginBottom:8,minHeight:62,maxHeight:118,borderRadius:30,borderWidth:1.5,borderColor:'#55456E',backgroundColor:'#151220',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},attachButton:{width:38,height:45,alignItems:'center',justifyContent:'center'},composerInput:{flex:1,minHeight:42,maxHeight:92,color:C.text,fontSize:14,paddingVertical:8,includeFontPadding:false},sendButton:{width:46,height:46,borderRadius:24,alignItems:'center',justifyContent:'center'},disclaimer:{color:C.dim,fontSize:9,textAlign:'center',marginBottom:7,marginHorizontal:18},attachmentStrip:{maxHeight:39,marginHorizontal:15,marginBottom:6},attachmentChip:{height:32,borderRadius:16,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,marginRight:7},attachmentName:{color:C.muted,fontSize:10,maxWidth:130},nav:{height:64,backgroundColor:'#0E0C18',borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},navItem:{flex:1,height:'100%',alignItems:'center',justifyContent:'center',gap:4},navText:{fontSize:9,color:C.dim,fontWeight:'800'},navIndicator:{position:'absolute',top:0,width:25,height:2,borderRadius:2,backgroundColor:C.violet},pageContent:{padding:21,paddingBottom:42},kicker:{fontSize:9,color:C.violet,fontWeight:'900',letterSpacing:1.5,marginTop:9},pageTitle:{fontSize:29,color:C.text,fontWeight:'800',marginTop:7},pageDesc:{fontSize:13,color:C.muted,lineHeight:20,marginTop:7,marginBottom:22},button:{minHeight:48,borderRadius:15,backgroundColor:C.purple,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:9},buttonSecondary:{backgroundColor:C.surface2,borderWidth:1,borderColor:C.border},buttonText:{color:C.text,fontSize:13,fontWeight:'800'},panel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:18,padding:15},emptyPanel:{alignItems:'center',paddingVertical:32,marginTop:20,gap:10},cardTitle:{fontSize:14,color:C.text,fontWeight:'800'},cardSub:{fontSize:11,color:C.muted,lineHeight:17,marginTop:4},cardMeta:{fontSize:9,color:C.dim,marginTop:5},projectCard:{flexDirection:'row',alignItems:'center',gap:12,marginTop:10},projectIcon:{width:43,height:43,borderRadius:13,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},renderPanel:{marginTop:18,borderColor:'#49316F'},jobBox:{marginTop:12},progressTrack:{height:6,backgroundColor:C.surface3,borderRadius:4,marginTop:8,overflow:'hidden'},progressFill:{height:6,backgroundColor:C.violet,borderRadius:4},jobRow:{marginTop:8,flexDirection:'row',alignItems:'center'},assetCard:{marginTop:9,flexDirection:'row',alignItems:'center',gap:11},assetIcon:{width:42,height:42,borderRadius:13,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},assetImage:{width:48,height:48,borderRadius:12,backgroundColor:C.surface3},score:{fontSize:11,color:C.violet,fontWeight:'900'},authPanel:{marginTop:10},field:{minHeight:49,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface2,paddingHorizontal:14,color:C.text,fontSize:14},multiline:{minHeight:100,paddingTop:12,textAlignVertical:'top'},link:{textAlign:'center',color:C.violet,fontWeight:'800',fontSize:12,marginTop:17},forgot:{textAlign:'center',color:C.muted,fontSize:11,marginTop:13},smallNote:{fontSize:10,color:C.dim,lineHeight:16,marginTop:13,textAlign:'center'},accountRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},avatar:{width:44,height:44,borderRadius:22,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:17,color:C.violet,fontWeight:'900'},serviceRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},serviceValue:{fontSize:11,fontWeight:'800'},footer:{fontSize:9,color:C.dim,textAlign:'center',letterSpacing:1.1,lineHeight:17,marginTop:25},modalRoot:{flex:1,justifyContent:'center',padding:20},scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.72)'},modalCard:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:22,padding:19},filmModal:{flex:1,backgroundColor:C.bg,padding:18},modalHeader:{height:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.border},filmJson:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',fontSize:10,color:'#D6C9F2',lineHeight:16,paddingVertical:16}
});

