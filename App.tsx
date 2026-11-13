import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Image,Keyboard,KeyboardAvoidingView,Linking,Modal,Platform,Pressable,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar as ExpoStatusBar} from 'expo-status-bar';
import {Feather,Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import {supabase,supabaseConfigured,SUPABASE_URL} from './src/lib/supabase';
import {sendToAgent} from './src/lib/ai';
import {getRenderDownloadUrl,getRenderJob,listRenderJobs,requestRender,RenderJob} from './src/lib/render';

WebBrowser.maybeCompleteAuthSession();
type Tab='studio'|'projects'|'media'|'account';
type Message={id:string;role:'user'|'assistant';text:string};
type Project={id:string;titre:string;brief:string|null;format:string|null;statut:string|null;version:number|null;duree_cible:number|null};
type Asset={id:string;type:string;source_kind:string;titre:string;provenance:any;licence:string;licence_ok:boolean;duree:number|null;proxy_url:string|null;score:number|null;fiche:any;utilisation:number|null};
type Attachment={bucket:'user-uploads';path:string;name:string;mime_type:string};
const REDIRECT='galingtosh://auth/callback';
const C={bg:'#080611',surface:'#12101E',surface2:'#191629',surface3:'#211B35',border:'#332846',text:'#F7F3FF',muted:'#B2A7C8',dim:'#81758F',purple:'#783BFF',violet:'#A75BFF',pink:'#F17BCB',green:'#55D6A1',amber:'#FFC66D',red:'#FF7187'};

function BrandMark({size=43}:{size?:number}){return <LinearGradient colors={['#FFC66D','#F16BCB','#793BFF']} start={{x:0,y:0}} end={{x:1,y:1}} style={{width:size,height:size,borderRadius:size*.35,alignItems:'center',justifyContent:'center'}}><Ionicons name="film" size={size*.58} color="#130D24"/></LinearGradient>;}
function Button({title,onPress,secondary=false,loading=false,disabled=false,icon}:{title:string;onPress:()=>void;secondary?:boolean;loading?:boolean;disabled?:boolean;icon?:any}){return <Pressable onPress={onPress} disabled={disabled||loading} style={({pressed})=>[s.button,secondary&&s.buttonSecondary,(pressed||disabled)&&{opacity:.55}]}>{loading?<ActivityIndicator color={C.text}/>:icon?<Feather name={icon} size={17} color={secondary?C.violet:'#FFF'}/>:null}<Text style={s.buttonText}>{title}</Text></Pressable>;}
function Field({value,onChangeText,placeholder,multiline=false,secureTextEntry=false,keyboardType='default',autoCapitalize='sentences',style}:any){return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.dim} multiline={multiline} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize} textAlignVertical={multiline?'top':'center'} selectionColor={C.violet} style={[s.field,multiline&&s.multiline,style]}/>;}
function Panel({children,style}:any){return <View style={[s.panel,style]}>{children}</View>;}

export default function App(){
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

 const user=session?.user;
 const activeProject=useMemo(()=>projects.find(p=>p.id===activeProjectId)||null,[projects,activeProjectId]);

 useEffect(()=>{
  const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
  const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
  return ()=>{show.remove();hide.remove();};
 },[]);

 useEffect(()=>{
  if(!supabaseConfigured){setAuthReady(true);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true);}).catch(()=>setAuthReady(true));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
  return ()=>subscription.unsubscribe();
 },[]);

 const loadProjects=useCallback(async()=>{
  if(!user)return;
  const {data,error}=await supabase.from('projects').select('id,titre,brief,format,statut,version,duree_cible').order('id',{ascending:false}).limit(50);
  if(error){setPageError('Impossible de charger ces données pour le moment.');return;}
  setProjects((data||[]) as Project[]);
 },[user?.id]);

 const loadAssets=useCallback(async()=>{
  if(!user)return;
  const {data,error}=await supabase.from('media_assets').select('id,type,source_kind,titre,provenance,licence,licence_ok,duree,proxy_url,score,fiche,utilisation').order('score',{ascending:false}).limit(80);
  if(error){setPageError('Impossible de charger les médias pour le moment.');return;}
  setAssets((data||[]) as Asset[]);
 },[user?.id]);

 const loadJobs=useCallback(async(projectId?:string)=>{
  if(!user)return;
  try{setJobs(await listRenderJobs(projectId));}catch{setPageError('Impossible de charger les productions pour le moment.');}
 },[user?.id]);

 useEffect(()=>{if(user){loadProjects();loadAssets();loadJobs();}else{setProjects([]);setAssets([]);setJobs([]);setActiveProjectId(null);}},[user?.id,loadProjects,loadAssets,loadJobs]);

 useEffect(()=>{
  if(!job||!['queued','running'].includes(job.status))return;
  const timer=setInterval(async()=>{try{const next=await getRenderJob(job.id);setJob(next);if(!['queued','running'].includes(next.status)){loadJobs(activeProjectId||undefined);}}catch{}},5000);
  return ()=>clearInterval(timer);
 },[job?.id,job?.status,activeProjectId,loadJobs]);

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
   if(result.type==='success'&&result.url){
    const callback=new URL(result.url);const code=callback.searchParams.get('code');
    if(code){const exchanged=await supabase.auth.exchangeCodeForSession(code);if(exchanged.error)throw exchanged.error;}
    else{const params=new URLSearchParams(callback.hash.replace(/^#/,''));
     const access_token=params.get('access_token');const refresh_token=params.get('refresh_token');
     if(access_token&&refresh_token){const saved=await supabase.auth.setSession({access_token,refresh_token});if(saved.error)throw saved.error;}
     else throw new Error("Le retour Google ne contient pas de code d'authentification.");
    }
   }
  }catch(e:any){Alert.alert('Connexion Google impossible','Veuillez réessayer ou utiliser la connexion par e-mail.');}
  finally{setAuthBusy(false);}
 }

 async function resetPassword(){
  if(!supabaseConfigured||!email.trim()){Alert.alert('E-mail requis','Saisissez votre adresse e-mail.');return;}
  const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:REDIRECT});
  Alert.alert(error?'Échec':'E-mail envoyé',error?.message||'Consultez votre boîte e-mail pour réinitialiser votre mot de passe.');
 }

 async function signOut(){await supabase.auth.signOut();setMessages([]);setConversationId(null);}

 async function createProject(){
  if(!user||!projectTitle.trim())return;
  setSavingProject(true);
  try{
   const {data,error}=await supabase.from('projects').insert({owner:user.id,titre:projectTitle.trim(),brief:projectBrief.trim()||null}).select('id,titre,brief,format,statut,version,duree_cible').single();
   if(error)throw error;
   setProjects(p=>[data as Project,...p]);setActiveProjectId(data.id);setProjectModal(false);setProjectTitle('');setProjectBrief('');setTab('studio');
   setMessages([{id:String(Date.now()),role:'assistant',text:'Projet « '+data.titre+' » créé. Décris maintenant le film que tu souhaites réaliser.'}]);
  }catch{Alert.alert('Création impossible','Veuillez réessayer dans quelques instants.');}
  finally{setSavingProject(false);}
 }

 async function addAttachment(){
  if(!user){Alert.alert('Connexion requise','Connectez-vous pour joindre un média.');return;}
  try{
   const picked=await DocumentPicker.getDocumentAsync({type:['image/*','video/*','audio/*'],copyToCacheDirectory:true,multiple:false});
   if(picked.canceled||!picked.assets?.length)return;
   const file=picked.assets[0];const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
   const path=user.id+'/'+Date.now()+'-'+safeName;
   const response=await fetch(file.uri);const blob=await response.blob();
   const {error}=await supabase.storage.from('user-uploads').upload(path,blob,{contentType:file.mimeType||'application/octet-stream',upsert:false});
   if(error)throw error;
   setAttachments(a=>[...a,{bucket:'user-uploads',path,name:file.name,mime_type:file.mimeType||'application/octet-stream'}]);
  }catch{Alert.alert('Ajout du média impossible','Vérifiez le fichier puis réessayez.');}
 }

 async function sendMessage(){
  const text=draft.trim();if((!text&&!attachments.length)||busy)return;
  if(!supabaseConfigured||!user){Alert.alert('Connexion requise','Connectez-vous avec votre compte Galingtosh avant d’utiliser le Studio.');setTab('account');return;}
  const attached=[...attachments];setMessages(m=>[...m,{id:String(Date.now()),role:'user',text:text||'Média joint',}]);
  setDraft('');setAttachments([]);setBusy(true);
  try{
   const result=await sendToAgent(text||'Analyse les médias joints et aide-moi à préparer mon film.',activeProjectId,attached,conversationId);
   setMessages(m=>[...m,{id:String(Date.now()+1),role:'assistant',text:result.reply}]);
   if(result.conversation_id)setConversationId(result.conversation_id);
   if(result.project_id){setActiveProjectId(result.project_id);loadProjects();}
   if(result.render_job_id){const next=await getRenderJob(result.render_job_id);setJob(next);loadJobs(result.project_id||activeProjectId||undefined);}
  }catch{setMessages(m=>[...m,{id:String(Date.now()+2),role:'assistant',text:'Une erreur est survenue pendant le traitement. Veuillez réessayer.'}]);}
  finally{setBusy(false);}
 }

 async function startRender(projectId:string){
  try{setBusy(true);const queued=await requestRender(projectId);const next=await getRenderJob(queued.job_id);setJob(next);await loadJobs(projectId);Alert.alert('Rendu lancé','Votre film est dans la file de production.');}
  catch{Alert.alert('Impossible de lancer la production','Veuillez réessayer dans quelques instants.');}
  finally{setBusy(false);}
 }

 async function openRender(path?:string|null){
  if(!path)return;
  try{const url=await getRenderDownloadUrl(path);await Linking.openURL(url);}
  catch{Alert.alert('Téléchargement impossible','La vidéo n’est pas disponible pour le moment.');}
 }

 const screenTitle=tab==='studio'?'Studio':tab==='projects'?'Mes projets':tab==='media'?'Médiathèque':'Compte';

 if(!authReady)return <SafeAreaProvider><SafeAreaView style={s.safe}><View style={s.loading}><BrandMark size={58}/><ActivityIndicator color={C.violet} style={{marginTop:20}}/><Text style={s.muted}>Initialisation de Galingtosh…</Text></View></SafeAreaView></SafeAreaProvider>;

 return <SafeAreaProvider><SafeAreaView style={s.safe} edges={['top','left','right']}><ExpoStatusBar style="light"/><StatusBar barStyle="light-content" backgroundColor={C.bg}/>
  <LinearGradient colors={['#080611','#090714','#07050D']} style={StyleSheet.absoluteFill}/>
  <View pointerEvents="none" style={s.glowTop}/><View pointerEvents="none" style={s.glowBottom}/>
  <View style={s.header}>
   <Pressable style={s.brand} onPress={()=>setTab('studio')}><BrandMark/><View><Text style={s.brandName}>Galingtosh</Text><Text style={s.brandSub}>CRÉEZ · MONTEZ · PARTAGEZ</Text></View></Pressable>
   <Pressable style={s.headerButton} onPress={()=>setTab('account')}><Feather name="settings" size={22} color={C.muted}/></Pressable>
  </View>
  {pageError? <Pressable onPress={()=>setPageError('')} style={s.errorBanner}><Text style={s.errorText}>{pageError}  ×</Text></Pressable>:null}
  <View style={s.main}>
   {tab==='studio'?<KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={0}>
    <ScrollView style={s.flex} contentContainerStyle={[s.chatContent,messages.length===0&&s.center]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'}>
     {messages.length===0?<View style={s.welcome}>
      <View style={s.heroOuter}><View style={s.heroGlow}/><LinearGradient colors={['#783BFF','#B84CEB','#F17BCB']} style={s.hero}><Ionicons name="film" size={58} color="#160C2D"/></LinearGradient></View>
      <Text style={s.welcomeText}>Posez votre question{ '\n'}à Galingtosh...</Text><Text style={s.welcomeSub}>Imaginez. Décrivez. Réalisez.</Text>
      <View style={s.suggestions}><Text style={s.sectionLabel}>POUR COMMENCER</Text>{['Prépare un documentaire à partir de mes médias','Aide-moi à construire un clip musical','Crée le scénario d’un court-métrage'].map((v,i)=><Pressable key={i} style={s.suggestion} onPress={()=>setDraft(v)}><Feather name="star" size={16} color={C.violet}/><Text style={s.suggestionText}>{v}</Text><Feather name="arrow-up-right" size={15} color={C.dim}/></Pressable>)}</View>
     </View>:<View style={s.messages}>{messages.map(m=><View key={m.id} style={[s.message,m.role==='user'?s.userMessage:s.assistantMessage]}><Text style={s.messageRole}>{m.role==='user'?'VOUS':'GALINGTOSH'}</Text><Text style={s.messageText}>{m.text}</Text></View>)}{busy?<View style={s.assistantMessage}><ActivityIndicator color={C.violet}/><Text style={[s.messageText,{marginTop:8}]}>Galingtosh analyse votre demande…</Text></View>:null}</View>}
    </ScrollView>
    {attachments.length>0?<ScrollView horizontal style={s.attachmentStrip}>{attachments.map(a=><Pressable key={a.path} style={s.attachmentChip} onPress={()=>setAttachments(v=>v.filter(x=>x.path!==a.path))}><Feather name="paperclip" size={13} color={C.violet}/><Text numberOfLines={1} style={s.attachmentName}>{a.name}</Text><Feather name="x" size={13} color={C.muted}/></Pressable>)}</ScrollView>:null}
    <View style={s.composer}><Pressable style={s.attachButton} onPress={addAttachment} accessibilityRole="button" accessibilityLabel="Joindre un média"><Feather name="paperclip" size={23} color={C.muted}/></Pressable><TextInput value={draft} onChangeText={setDraft} placeholder="Écrivez votre message..." placeholderTextColor={C.dim} style={s.composerInput} multiline maxLength={5000} blurOnSubmit={false} returnKeyType="default" textAlignVertical="center" scrollEnabled/><Pressable onPress={sendMessage} disabled={busy||(!draft.trim()&&!attachments.length)} accessibilityRole="button" accessibilityLabel="Envoyer le message"><LinearGradient colors={['#8C43FF','#5D22E8']} style={s.sendButton}><Feather name="send" size={21} color="#FFF"/></LinearGradient></Pressable></View>
     </KeyboardAvoidingView>:null}
   {tab==='projects'?<ScrollView contentContainerStyle={s.pageContent}>
    <Text style={s.kicker}>VOTRE ESPACE DE TRAVAIL</Text><Text style={s.pageTitle}>Mes projets</Text><Text style={s.pageDesc}>Retrouvez vos productions et reprenez votre travail.</Text>
    <Button title="Nouveau projet" onPress={()=>setProjectModal(true)} icon="plus"/>
    {projects.length===0?<Panel style={s.emptyPanel}><Feather name="film" size={34} color={C.dim}/><Text style={s.cardTitle}>Aucun projet enregistré</Text><Text style={s.muted}>Vos projets apparaîtront ici après leur création.</Text></Panel>:projects.map(p=><Pressable key={p.id} onPress={()=>{setActiveProjectId(p.id);setTab('studio');}}><Panel style={s.projectCard}><View style={s.projectIcon}><Feather name="film" size={21} color={C.violet}/></View><View style={{flex:1}}><Text style={s.cardTitle}>{p.titre}</Text><Text style={s.cardSub}>{p.brief||'Aucune description'} · {p.statut||'Projet'}</Text><Text style={s.cardMeta}>Version {p.version??1} {p.format?'· '+p.format:''}</Text></View><Feather name="chevron-right" size={19} color={C.dim}/></Panel></Pressable>)}
    {activeProject?<Panel style={s.renderPanel}><Text style={s.sectionLabel}>PRODUCTION</Text><Text style={s.cardTitle}>{activeProject.titre}</Text><Button title="Lancer le rendu vidéo" onPress={()=>startRender(activeProject.id)} loading={busy} icon="play"/>{job&&job.project_id===activeProject.id?<View style={s.jobBox}><Text style={s.cardSub}>Rendu : {job.status} · {job.progress||0}%</Text><View style={s.progressTrack}><View style={[s.progressFill,{width:((Math.max(0,Math.min(100,job.progress||0)))+'%') as any}]}/></View>{job.error?<Text style={s.cardSub}>Un problème est survenu pendant cette production.</Text>:null}{job.output_path?<Button title="Ouvrir la vidéo MP4" onPress={()=>openRender(job.output_path)} secondary icon="download"/>:null}</View>:null}</Panel>:null}
    <Text style={s.sectionLabel}>RENDU RÉCENT</Text>{jobs.slice(0,8).map(j=><Panel key={j.id} style={s.jobRow}><View style={{flex:1}}><Text style={s.cardTitle}>Production · v{j.film_version}</Text><Text style={s.cardSub}>{j.status} · {j.progress||0}%</Text></View>{j.output_path?<Pressable onPress={()=>openRender(j.output_path)}><Feather name="download" size={20} color={C.violet}/></Pressable>:null}</Panel>)}
   </ScrollView>:null}
   {tab==='media'?<ScrollView contentContainerStyle={s.pageContent}><Text style={s.kicker}>RESSOURCES AUTORISÉES</Text><Text style={s.pageTitle}>Médiathèque</Text><Text style={s.pageDesc}>Catalogue des médias disponibles et de leurs licences.</Text><Button title="Joindre un média à une conversation" onPress={()=>{setTab('studio');addAttachment();}} icon="paperclip"/>{assets.length===0?<Panel style={s.emptyPanel}><Feather name="image" size={32} color={C.dim}/><Text style={s.cardTitle}>Aucun média dans le catalogue</Text><Text style={s.muted}>Les médias autorisés apparaîtront ici lorsqu’ils seront référencés dans la base.</Text></Panel>:assets.map(a=><Panel key={a.id} style={s.assetCard}>{a.proxy_url&&a.type==='image'?<Image source={{uri:a.proxy_url}} style={s.assetImage}/>:<View style={s.assetIcon}><Feather name={a.type==='video'?'video':a.type==='audio'?'music':'image'} size={23} color={C.violet}/></View>}<View style={{flex:1}}><Text style={s.cardTitle}>{a.titre||'Média sans titre'}</Text><Text style={s.cardSub}>{a.type} · {a.source_kind}</Text><Text style={s.cardMeta}>{a.licence||'Licence non précisée'} · {a.licence_ok?'Utilisable':'À vérifier'}</Text></View><Text style={s.score}>{a.score??'—'}</Text></Panel>)}</ScrollView>:null}
   {tab==='account'?<ScrollView contentContainerStyle={s.pageContent}><Text style={s.kicker}>PRÉFÉRENCES</Text><Text style={s.pageTitle}>Compte & paramètres</Text>
    {!user?<Panel style={s.authPanel}><Text style={s.cardTitle}>{authMode==='login'?'Connexion à Galingtosh':'Créer un compte'}</Text><Text style={s.cardSub}>Utilisez votre adresse Gmail ou votre compte Google.</Text><Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" autoCapitalize="none" keyboardType="email-address" style={{marginTop:18}}/><Field value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry style={{marginTop:10}}/><Button title={authMode==='login'?'Se connecter':'Créer mon compte'} onPress={signIn} loading={authBusy}/><Button title="Continuer avec Google" onPress={googleAuth} secondary loading={authBusy} icon="chrome"/><Pressable onPress={()=>setAuthMode(v=>v==='login'?'signup':'login')}><Text style={s.link}>{authMode==='login'?'Créer un compte':'J’ai déjà un compte'}</Text></Pressable>{authMode==='login'?<Pressable onPress={resetPassword}><Text style={s.forgot}>Mot de passe oublié ?</Text></Pressable>:null}</Panel>:<Panel style={s.authPanel}><View style={s.accountRow}><View style={s.avatar}><Text style={s.avatarText}>{(user.email||'G').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>{user.email||'Compte Galingtosh'}</Text><Text style={s.cardSub}>Session authentifiée</Text></View></View><Button title="Se déconnecter" onPress={signOut} secondary icon="log-out"/></Panel>}
    <Text style={s.footer}>GALINGTOSH · ANDROID{ '\n'}Une création Dan Production</Text>
   </ScrollView>:null}
  </View>
  {!keyboardVisible&&<View style={s.nav}>{([{id:'studio',label:'Studio',icon:'message-circle'},{id:'projects',label:'Projets',icon:'film'},{id:'media',label:'Médias',icon:'grid'}] as const).map(item=><Pressable key={item.id} onPress={()=>setTab(item.id)} style={s.navItem}><Feather name={item.icon as any} size={20} color={tab===item.id?C.violet:C.dim}/><Text style={[s.navText,tab===item.id&&{color:C.text}]}>{item.label}</Text>{tab===item.id?<View style={s.navIndicator}/>:null}</Pressable>)}</View>}

  <Modal visible={projectModal} transparent animationType="fade" onRequestClose={()=>setProjectModal(false)}><View style={s.modalRoot}><Pressable style={s.scrim} onPress={()=>setProjectModal(false)}/><View style={s.modalCard}><Text style={s.cardTitle}>Créer un projet</Text><Text style={s.cardSub}>Définissez le titre et l’idée de départ.</Text><Field value={projectTitle} onChangeText={setProjectTitle} placeholder="Titre du projet" style={{marginTop:18}}/><Field value={projectBrief} onChangeText={setProjectBrief} placeholder="Décrivez brièvement votre idée…" multiline style={{marginTop:10,minHeight:90}}/><Button title="Créer le projet" onPress={createProject} loading={savingProject} disabled={!projectTitle.trim()}/><Button title="Annuler" onPress={()=>setProjectModal(false)} secondary/></View></View></Modal>

 </SafeAreaView></SafeAreaProvider>;
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},flex:{flex:1},main:{flex:1},header:{height:70,paddingHorizontal:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:11},brandName:{fontSize:21,fontWeight:'800',color:C.text,letterSpacing:-.4},brandSub:{fontSize:8,color:C.dim,fontWeight:'800',letterSpacing:1.25,marginTop:3},headerButton:{width:44,height:44,borderRadius:22,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},glowTop:{position:'absolute',width:320,height:320,borderRadius:180,backgroundColor:'#5417A5',opacity:.17,top:-220,right:-130},glowBottom:{position:'absolute',width:330,height:330,borderRadius:180,backgroundColor:'#3613A0',opacity:.14,bottom:-220,left:-190},errorBanner:{marginHorizontal:16,backgroundColor:'#391A2A',padding:9,borderRadius:10},errorText:{color:C.red,fontSize:11},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.bg},muted:{color:C.muted,fontSize:12,marginTop:10},chatContent:{flexGrow:1,paddingHorizontal:19,paddingTop:12,paddingBottom:20},center:{justifyContent:'center'},welcome:{alignItems:'center',width:'100%'},heroOuter:{width:160,height:160,borderRadius:80,alignItems:'center',justifyContent:'center',backgroundColor:'#171027',borderWidth:1,borderColor:'#382453',marginBottom:25},heroGlow:{position:'absolute',width:220,height:220,borderRadius:120,backgroundColor:'#6322B9',opacity:.13},hero:{width:112,height:112,borderRadius:56,alignItems:'center',justifyContent:'center'},welcomeText:{fontSize:24,lineHeight:34,color:'#D8CFF0',fontWeight:'400',textAlign:'center'},welcomeSub:{fontSize:12,color:C.dim,marginTop:9,letterSpacing:.5},suggestions:{width:'100%',marginTop:30,gap:9},sectionLabel:{fontSize:9,color:C.dim,fontWeight:'900',letterSpacing:1.45,marginBottom:11},suggestion:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13},suggestionText:{flex:1,color:C.muted,fontSize:12},messages:{gap:12,paddingBottom:18},message:{maxWidth:'90%',padding:14,borderRadius:17},userMessage:{alignSelf:'flex-end',backgroundColor:'#34205D',borderBottomRightRadius:5},assistantMessage:{alignSelf:'flex-start',backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderBottomLeftRadius:5,padding:14},messageRole:{fontSize:9,color:C.violet,fontWeight:'900',letterSpacing:1.2,marginBottom:6},messageText:{fontSize:14,color:C.text,lineHeight:21},composer:{marginHorizontal:14,marginBottom:8,minHeight:62,maxHeight:118,borderRadius:30,borderWidth:1.5,borderColor:'#55456E',backgroundColor:'#151220',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},attachButton:{width:38,height:45,alignItems:'center',justifyContent:'center'},composerInput:{flex:1,minHeight:42,maxHeight:92,color:C.text,fontSize:14,paddingVertical:8,includeFontPadding:false},sendButton:{width:46,height:46,borderRadius:24,alignItems:'center',justifyContent:'center'},disclaimer:{color:C.dim,fontSize:9,textAlign:'center',marginBottom:7,marginHorizontal:18},attachmentStrip:{maxHeight:39,marginHorizontal:15,marginBottom:6},attachmentChip:{height:32,borderRadius:16,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,marginRight:7},attachmentName:{color:C.muted,fontSize:10,maxWidth:130},nav:{height:64,backgroundColor:'#0E0C18',borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},navItem:{flex:1,height:'100%',alignItems:'center',justifyContent:'center',gap:4},navText:{fontSize:9,color:C.dim,fontWeight:'800'},navIndicator:{position:'absolute',top:0,width:25,height:2,borderRadius:2,backgroundColor:C.violet},pageContent:{padding:21,paddingBottom:42},kicker:{fontSize:9,color:C.violet,fontWeight:'900',letterSpacing:1.5,marginTop:9},pageTitle:{fontSize:29,color:C.text,fontWeight:'800',marginTop:7},pageDesc:{fontSize:13,color:C.muted,lineHeight:20,marginTop:7,marginBottom:22},button:{minHeight:48,borderRadius:15,backgroundColor:C.purple,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:9},buttonSecondary:{backgroundColor:C.surface2,borderWidth:1,borderColor:C.border},buttonText:{color:C.text,fontSize:13,fontWeight:'800'},panel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:18,padding:15},emptyPanel:{alignItems:'center',paddingVertical:32,marginTop:20,gap:10},cardTitle:{fontSize:14,color:C.text,fontWeight:'800'},cardSub:{fontSize:11,color:C.muted,lineHeight:17,marginTop:4},cardMeta:{fontSize:9,color:C.dim,marginTop:5},projectCard:{flexDirection:'row',alignItems:'center',gap:12,marginTop:10},projectIcon:{width:43,height:43,borderRadius:13,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},renderPanel:{marginTop:18,borderColor:'#49316F'},jobBox:{marginTop:12},progressTrack:{height:6,backgroundColor:C.surface3,borderRadius:4,marginTop:8,overflow:'hidden'},progressFill:{height:6,backgroundColor:C.violet,borderRadius:4},jobRow:{marginTop:8,flexDirection:'row',alignItems:'center'},assetCard:{marginTop:9,flexDirection:'row',alignItems:'center',gap:11},assetIcon:{width:42,height:42,borderRadius:13,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},assetImage:{width:48,height:48,borderRadius:12,backgroundColor:C.surface3},score:{fontSize:11,color:C.violet,fontWeight:'900'},authPanel:{marginTop:10},field:{minHeight:49,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface2,paddingHorizontal:14,color:C.text,fontSize:14},multiline:{minHeight:100,paddingTop:12,textAlignVertical:'top'},link:{textAlign:'center',color:C.violet,fontWeight:'800',fontSize:12,marginTop:17},forgot:{textAlign:'center',color:C.muted,fontSize:11,marginTop:13},smallNote:{fontSize:10,color:C.dim,lineHeight:16,marginTop:13,textAlign:'center'},accountRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},avatar:{width:44,height:44,borderRadius:22,backgroundColor:C.surface3,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:17,color:C.violet,fontWeight:'900'},serviceRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},serviceValue:{fontSize:11,fontWeight:'800'},footer:{fontSize:9,color:C.dim,textAlign:'center',letterSpacing:1.1,lineHeight:17,marginTop:25},modalRoot:{flex:1,justifyContent:'center',padding:20},scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.72)'},modalCard:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:22,padding:19},filmModal:{flex:1,backgroundColor:C.bg,padding:18},modalHeader:{height:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.border},filmJson:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',fontSize:10,color:'#D6C9F2',lineHeight:16,paddingVertical:16}
});
