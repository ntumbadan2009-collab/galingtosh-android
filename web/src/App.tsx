import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent,type ChangeEvent} from 'react';
import {Activity,ArrowRight,Check,CheckCircle2,ChevronDown,ChevronRight,CirclePlus,Clapperboard,Clock3,Download,Edit3,ExternalLink,Film,FolderOpen,Grid2X2,Image as ImageIcon,Layers3,LoaderCircle,LogOut,MessageCircle,MoreVertical,Music2,Paperclip,Pause,Play,Plus,Send,Settings,Settings2,ShieldCheck,Sparkles,Video,X,AlertCircle,Copy,Eye,EyeOff} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
// Import the same pure, security-filtered activity parser used by Android.
import {buildActivityTurns,type ActivityTurn} from './agentActivity';
import {db,listProjects,listRenders,listAssets,listConversations,listMessages,listActivityRows,listMissionTasks,latestMission,latestFilm,createProject,sendChat,missionCommand,requestRender,signedOutput,signedAsset,uploadAsset,stageName,statusLabel,planTitle,type Project,type Message,type Asset,type Render,type Mission,type Task,type Film as FilmData,type Tab} from './api';
type Attachment={id:string;name:string};
type Dialog='create'|'plan'|'scenes'|'settings'|null;
type SessionUser={id:string;email?:string};
function FilmstripLogo(){return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="25" height="25" aria-hidden="true"><path d="M436,80H76a44.05,44.05,0,0,0-44,44V388a44.05,44.05,0,0,0,44,44H436a44.05,44.05,0,0,0,44-44V124A44.05,44.05,0,0,0,436,80ZM112,388a12,12,0,0,1-12,12H76a12,12,0,0,1-12-12V364a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Zm0-80a12,12,0,0,1-12,12H76a12,12,0,0,1-12-12V284a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Zm0-80a12,12,0,0,1-12,12H76a12,12,0,0,1-12-12V204a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Zm0-80a12,12,0,0,1-12,12H76a12,12,0,0,1-12-12V124a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12ZM353.68,272H158.32a16,16,0,0,1,0-32H353.68a16,16,0,1,1,0,32ZM448,388a12,12,0,0,1-12,12H412a12,12,0,0,1-12-12V364a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Zm0-80a12,12,0,0,1-12,12H412a12,12,0,0,1-12-12V284a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Zm0-80a12,12,0,0,1-12,12H412a12,12,0,0,1-12-12V204a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Zm0-80a12,12,0,0,1-12,12H412a12,12,0,0,1-12-12V124a12,12,0,0,1,12-12h24a12,12,0,0,1,12,12Z" fill="#130D24"/></svg>}
function Brand({small=false}:{small?:boolean}){return <div className={'brand '+(small?'brand--small':'')}><span className="brand-icon"><FilmstripLogo/></span><div className="brand-copy"><strong>Galingtosh</strong>{!small&&<span>STUDIO AUDIOVISUEL IA</span>}</div></div>}
function IconButton({icon:Icon,label,onClick,disabled}:{icon:LucideIcon;label:string;onClick:()=>void;disabled?:boolean}){return <button className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={19}/></button>}
function Empty({icon:Icon,title,desc}:{icon:LucideIcon;title:string;desc:string}){return <div className="empty"><span className="empty-icon"><Icon size={29}/></span><h3>{title}</h3><p>{desc}</p></div>}
function Alert({text,onClose}:{text:string;onClose:()=>void}){return <div className="notice" role="alert"><AlertCircle size={17}/><span>{text}</span><button aria-label="Fermer le message" onClick={onClose}><X size={17}/></button></div>}
function Auth({onAuth}:{onAuth:()=>void}){
 const[email,setEmail]=useState('');
 const[password,setPassword]=useState('');
 const[confirmPassword,setConfirmPassword]=useState('');
 const[showPassword,setShowPassword]=useState(false);
 const[showConfirmPassword,setShowConfirmPassword]=useState(false);
 const[signup,setSignup]=useState(false);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const[success,setSuccess]=useState('');
 const switchMode=()=>{
  setSignup(v=>!v);
  setError('');
  setSuccess('');
  setPassword('');
  setConfirmPassword('');
  setShowPassword(false);
  setShowConfirmPassword(false);
 };
 async function submit(e:FormEvent){
  e.preventDefault();
  if(busy)return;
  setError('');setSuccess('');
  const normalizedEmail=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)){setError('Saisissez une adresse e-mail valide.');return}
  if(password.length<6){setError('Le mot de passe doit contenir au moins 6 caractères.');return}
  if(signup&&password!==confirmPassword){setError('Les deux mots de passe ne correspondent pas.');return}
  setBusy(true);
  try{
   if(signup){
    const{data,error:signupError}=await db.auth.signUp({email:normalizedEmail,password});
    if(signupError)throw signupError;
    if(data.session)onAuth();
    else{
     setSuccess('Votre demande est enregistrée. Consultez votre boîte e-mail et confirmez votre adresse pour activer votre compte. Pensez aussi aux spams.');
     setPassword('');setConfirmPassword('');
    }
   }else{
    const{error:signinError}=await db.auth.signInWithPassword({email:normalizedEmail,password});
    if(signinError)throw signinError;
    onAuth();
   }
  }catch(e){
   const raw=e instanceof Error?e.message:'';
   const msg=/already registered|user already exists/i.test(raw)?'Cette adresse e-mail possède déjà un compte. Utilisez « Se connecter ».'
    :/invalid login credentials/i.test(raw)?'E-mail ou mot de passe incorrect.'
    :/email not confirmed/i.test(raw)?'Votre adresse e-mail n’est pas encore confirmée. Vérifiez votre messagerie.'
    :/password should be at least/i.test(raw)?'Choisissez un mot de passe plus long.'
    :/rate limit|too many requests/i.test(raw)?'Trop de tentatives. Réessayez un peu plus tard.'
    :raw||'Une erreur est survenue. Veuillez réessayer.';
   setError(msg);
  }finally{setBusy(false)}
 }
 return <div className="auth-page"><div className="auth-aurora"/>
  <div className="auth-cinematic-bg" aria-hidden="true">
   <div className="auth-film-grid"/>
   <div className="auth-cinematic-orb auth-orb-one"/>
   <div className="auth-cinematic-orb auth-orb-two"/>
   <div className="auth-film-track auth-film-track-left"><span/><span/><span/><span/><span/><span/></div>
   <div className="auth-film-track auth-film-track-right"><span/><span/><span/><span/><span/><span/></div>
   <div className="auth-motion-card auth-motion-storyboard"><Layers3 size={20}/><span>Storyboard</span><i>01 — 06</i></div>
   <div className="auth-motion-card auth-motion-studio"><Clapperboard size={20}/><span>Studio</span><i>REC</i></div>
   <div className="auth-motion-card auth-motion-scenes"><Film size={20}/><span>Scènes</span><i>24 FPS</i></div>
   <div className="auth-motion-card auth-motion-create"><Sparkles size={20}/><span>Création IA</span><i>✦</i></div>
   <div className="auth-scene-frame auth-scene-frame-one"><span className="auth-scene-label">SCÈNE 01</span><span className="auth-frame-horizon"/></div>
   <div className="auth-scene-frame auth-scene-frame-two"><span className="auth-scene-label">SCÈNE 02</span><span className="auth-frame-horizon"/></div>
  </div>
  <div className="auth-layout">
  <section className="auth-story">
   <Brand/>
   <div className="hero-pill"><Sparkles size={15}/> L’intelligence au service de votre imagination</div>
   <h1>Une idée.<br/><span>Un film.</span><br/>Votre studio.</h1>
   <p>Concevez vos histoires, orchestrez les scènes, organisez les médias et retrouvez vos productions dans un espace créatif unique.</p>
   <div className="auth-benefits"><span><CheckCircle2 size={18}/> Studio intelligent</span><span><CheckCircle2 size={18}/> Projets synchronisés</span><span><CheckCircle2 size={18}/> Production audiovisuelle</span></div>
  </section>
  <section className="auth-box" aria-labelledby="auth-heading">
   <div className="auth-cinema-stage" aria-hidden="true">
    <div className="auth-stage-glow"/>
    <div className="auth-stage-caption"><span className="auth-stage-live-dot"/> GALINGTOSH · STUDIO CRÉATIF <span className="auth-stage-counter">00:24</span></div>
    <div className="auth-stage-scenes">
     <div className="auth-stage-panel"><span className="auth-panel-number">01 · IDÉE</span><Sparkles size={29}/><span className="auth-panel-wave"/></div>
     <div className="auth-stage-panel"><span className="auth-panel-number">02 · STORYBOARD</span><Layers3 size={29}/><span className="auth-panel-wave"/></div>
     <div className="auth-stage-panel"><span className="auth-panel-number">03 · STUDIO</span><Clapperboard size={29}/><span className="auth-panel-wave"/></div>
    </div>
    <div className="auth-stage-timeline"><span className="auth-stage-progress"/></div>
   </div>
   <div className="auth-box-icon"><Film size={26}/></div>
   <div className="auth-eyebrow">{signup?'BIENVENUE DANS GALINGTOSH':'BON RETOUR'}</div>
   <h2 id="auth-heading">{signup?'Créer mon compte':'Se connecter'}</h2>
   <p>{signup?'Créez un compte pour retrouver vos projets sur Android et sur le web.':'Retrouvez le même studio et les mêmes projets que dans votre application Android.'}</p>
   <div className="auth-mode-switch" role="group" aria-label="Mode d’authentification">
    <button type="button" className={!signup?'selected':''} aria-pressed={!signup} onClick={()=>{if(signup)switchMode()}} disabled={busy}>Connexion</button>
    <button type="button" className={signup?'selected':''} aria-pressed={signup} onClick={()=>{if(!signup)switchMode()}} disabled={busy}>Inscription</button>
   </div>
   <form onSubmit={e=>void submit(e)} noValidate>
    <label>Adresse e-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.com" required autoComplete="email" inputMode="email" disabled={busy}/></label>
    <label>Mot de passe<span className="auth-password-field"><input type={showPassword?'text':'password'} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Au moins 6 caractères" required autoComplete={signup?'new-password':'current-password'} disabled={busy}/><button type="button" className="auth-password-toggle" aria-label={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'} title={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={21}/>:<Eye size={21}/>}</button></span></label>
    {signup&&<label>Confirmer le mot de passe<span className="auth-password-field"><input type={showConfirmPassword?'text':'password'} minLength={6} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Répétez votre mot de passe" required autoComplete="new-password" disabled={busy}/><button type="button" className="auth-password-toggle" aria-label={showConfirmPassword?'Masquer la confirmation du mot de passe':'Afficher la confirmation du mot de passe'} title={showConfirmPassword?'Masquer la confirmation du mot de passe':'Afficher la confirmation du mot de passe'} aria-pressed={showConfirmPassword} onClick={()=>setShowConfirmPassword(v=>!v)}>{showConfirmPassword?<EyeOff size={21}/>:<Eye size={21}/>}</button></span></label>}
    {error&&<div className="auth-error" role="alert">{error}</div>}
    {success&&<div className="auth-success" role="status">{success}</div>}
    <button className="primary full" disabled={busy} type="submit">{busy?<LoaderCircle className="spin" size={18}/>:<ArrowRight size={18}/>} {busy?'Veuillez patienter…':signup?'Créer mon compte':'Se connecter'}</button>
   </form>
   <div className="auth-login-prompt">{signup?'Vous possédez déjà un compte ?':'Vous découvrez Galingtosh ?'} <button className="link-button" type="button" disabled={busy} onClick={switchMode}>{signup?'Se connecter':'Créer un compte'}</button></div>
   <div className="secure-note"><ShieldCheck size={16}/> Vos projets restent privés et synchronisés via Supabase.</div>
  </section>
 </div></div>;
}
export function App(){
 const[user,setUser]=useState<SessionUser|null>(null),[authReady,setAuthReady]=useState(false);
 const[tab,setTab]=useState<Tab>('studio'),[sidebarOpen,setSidebarOpen]=useState(false);
 const[projects,setProjects]=useState<Project[]>([]),[jobs,setJobs]=useState<Render[]>([]),[assets,setAssets]=useState<Asset[]>([]);
 const[projectId,setProjectId]=useState<string|null>(null),[conversationId,setConversationId]=useState<string|null>(null);
 const[messages,setMessages]=useState<Message[]>([]),[film,setFilm]=useState<FilmData|null>(null);
 const[mission,setMission]=useState<Mission|null>(null),[tasks,setTasks]=useState<Task[]>([]);
 const[dialog,setDialog]=useState<Dialog>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[actionBusy,setActionBusy]=useState(false);
 const[composer,setComposer]=useState(''),[attachments,setAttachments]=useState<Attachment[]>([]);
 const[createTitle,setCreateTitle]=useState(''),[createBrief,setCreateBrief]=useState('');
 const[search,setSearch]=useState(''),[mediaSearch,setMediaSearch]=useState(''),[projectFilter,setProjectFilter]=useState<'all'|'active'|'ready'>('all'),[projectMenuId,setProjectMenuId]=useState<string|null>(null),[mediaFilter,setMediaFilter]=useState<'all'|'image'|'video'|'audio'>('all');
 const[previewUrl,setPreviewUrl]=useState<string|null>(null),[previewAsset,setPreviewAsset]=useState<Asset|null>(null),[assetDetail,setAssetDetail]=useState<Asset|null>(null);
 const[showActivity,setShowActivity]=useState(false);
 const[activityTurns,setActivityTurns]=useState<ActivityTurn[]>([]),[chatJournalExpanded,setChatJournalExpanded]=useState(false);
 const[projectMenu,setProjectMenu]=useState(false),[renameValue,setRenameValue]=useState('');
 const chatEnd=useRef<HTMLDivElement>(null),uploadInput=useRef<HTMLInputElement>(null),scrollBox=useRef<HTMLDivElement>(null);
 const [keyboardOpen,setKeyboardOpen]=useState(false);
 // Android Chrome and embedded Google browsers can keep the layout viewport
 // unchanged when the software keyboard opens. Follow the *visible* viewport.
 useEffect(()=>{
  if(typeof window==='undefined')return;
  const root=document.documentElement;
  let baseline=Math.max(window.innerHeight,window.visualViewport?.height||0);
  let frame=0;
  const update=()=>{
   const viewport=window.visualViewport;
   const active=document.activeElement;
   const editing=active instanceof HTMLElement &&
    (active.matches('textarea,input:not([type="checkbox"]):not([type="radio"])')||active.isContentEditable);
   const height=viewport?.height||window.innerHeight;
   if(!editing)baseline=Math.max(window.innerHeight,height);
   const open=window.innerWidth<=900 && editing && baseline-height>120;
   root.style.setProperty('--galingtosh-visible-height',Math.max(280,Math.round(height))+'px');
   root.style.setProperty('--galingtosh-viewport-top',Math.max(0,Math.round(viewport?.offsetTop||0))+'px');
   setKeyboardOpen(previous=>previous===open?previous:open);
  };
  const schedule=()=>{window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(update)};
  schedule();
  window.visualViewport?.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);
  document.addEventListener('focusin',schedule);
  document.addEventListener('focusout',schedule);
  return()=>{
   window.cancelAnimationFrame(frame);
   window.visualViewport?.removeEventListener('resize',schedule);
   window.visualViewport?.removeEventListener('scroll',schedule);
   window.removeEventListener('resize',schedule);
   document.removeEventListener('focusin',schedule);
   document.removeEventListener('focusout',schedule);
   root.style.removeProperty('--galingtosh-visible-height');
   root.style.removeProperty('--galingtosh-viewport-top');
  };
 },[]);

 const latestRef=useRef({projectId:null as string|null,conversationId:null as string|null}),activeCall=useRef(false);
 const activeProject=projects.find(p=>p.id===projectId)||null;
 const activeRender=jobs.find(j=>j.project_id===projectId&&['queued','running'].includes(j.status));
 const latestRender=jobs.find(j=>j.project_id===projectId);
 const readyRender=jobs.find(j=>j.project_id===projectId&&j.status==='done'&&j.output_path);
 const missionRender=jobs.find(j=>j.id===mission?.render_job_id);
 const isActiveMission=!!mission&&['queued','running','waiting_render','paused','needs_review'].includes(mission.status);
 // Exact project filters from Android App.tsx:visibleProjects.
 const latestPromptId=[...messages].reverse().find(m=>m.role==='user')?.id||null;
 const lastActivityTurn=activityTurns.find(t=>t.id===latestPromptId);
 const liveEvents=lastActivityTurn?.events||[];
 const visibleProjects=useMemo(()=>projects.filter(p=>{
  const related=jobs.filter(j=>j.project_id===p.id);
  return p.title.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))&&
   (projectFilter==='all'||(projectFilter==='active'?
    related.some(j=>['queued','running'].includes(j.status)):
    related.some(j=>j.status==='done'&&j.output_path)));
 }),[projects,jobs,projectFilter,search]);
 // Same filtering as Android App.tsx:visibleAssets; thumbnails come from loadAssets.
 const visibleAssets=useMemo(()=>assets.filter(a=>
  (mediaFilter==='all'||a.kind===mediaFilter)&&
  String(a.provenance?.title||a.analysis?.original_name||a.kind).toLocaleLowerCase('fr')
    .includes(mediaSearch.trim().toLocaleLowerCase('fr'))
 ),[assets,mediaFilter,mediaSearch]);
 const alertError=(e:unknown)=>setError(e instanceof Error?e.message:'Opération impossible. Vérifie ta connexion.');
 useEffect(()=>{let mounted=true;void db.auth.getSession().then(({data})=>{if(mounted){setUser(data.session?.user?{id:data.session.user.id,email:data.session.user.email}:null);setAuthReady(true);}});const{subscription}=db.auth.onAuthStateChange((_event,session)=>{if(mounted){setUser(session?.user?{id:session.user.id,email:session.user.email}:null);setAuthReady(true);}}).data;return()=>{mounted=false;subscription.unsubscribe();}},[]);
 const refreshGlobal=useCallback(async()=>{if(!user)return;try{const [p,j,a]=await Promise.all([listProjects(),listRenders(),listAssets()]);setProjects(p);setJobs(j);setAssets(a);}catch(e){alertError(e);}},[user?.id]);
 const refreshProject=useCallback(async(id:string,includeHistory=false)=>{
  try{
   const [m,f,j]=await Promise.all([latestMission(id),latestFilm(id),listRenders()]);
   if(latestRef.current.projectId!==id)return;
   setMission(m);setFilm(f);setJobs(j);
   if(m){const t=await listMissionTasks(m.id);if(latestRef.current.projectId===id)setTasks(t);}else setTasks([]);
   if(includeHistory){
    const cs=await listConversations(id);
    if(latestRef.current.projectId!==id)return;
    const c=cs[0]||null;setConversationId(c?.id||null);latestRef.current.conversationId=c?.id||null;
    const [ms,rows]=c?await Promise.all([listMessages(c.id),listActivityRows(c.id)]):[[],[]];
    if(latestRef.current.projectId===id){
      setMessages([...ms].reverse().filter(x=>x.content?.trim()));
      setActivityTurns(buildActivityTurns([...rows].reverse()));
    }
   }
  }catch(e){if(latestRef.current.projectId===id)alertError(e)}
 },[]);
 function startNewConversation(){
  if(busy||actionBusy)return;
  latestRef.current={projectId:null,conversationId:null};
  setProjectId(null);setConversationId(null);setMessages([]);setFilm(null);
  setMission(null);setTasks([]);setActivityTurns([]);setChatJournalExpanded(false);setComposer('');setAttachments([]);
  setShowActivity(false);setDialog(null);setPreviewUrl(null);
  setTab('studio');setError('');setSidebarOpen(false);
 }
 async function openProject(id:string){
  latestRef.current={projectId:id,conversationId:null};setProjectId(id);setConversationId(null);setMessages([]);setFilm(null);setMission(null);setTasks([]);setActivityTurns([]);setChatJournalExpanded(false);setDialog(null);setSidebarOpen(false);setTab('studio');setLoading(true);setError('');
  try{await refreshProject(id,true);}finally{setLoading(false)}
 }
 useEffect(()=>{if(!user){setProjects([]);setJobs([]);setAssets([]);setProjectId(null);setMessages([]);return;}void refreshGlobal();},[user?.id,refreshGlobal]);
 useEffect(()=>{if(!user)return;let inFlight=false;const poll=async()=>{if(inFlight||document.visibilityState!=='visible'||activeCall.current)return;inFlight=true;try{const j=await listRenders();setJobs(j);if(latestRef.current.projectId){const m=await latestMission(latestRef.current.projectId);if(m){setMission(m);setTasks(await listMissionTasks(m.id));}else{setMission(null);setTasks([]);}}}catch{/* preserve last confirmed state */}finally{inFlight=false;}};const timer=window.setInterval(()=>void poll(),5000);return()=>window.clearInterval(timer);},[user?.id]);
 useEffect(()=>{
  if(!user||!conversationId||tab!=='studio'||(!busy&&!isActiveMission))return;
  let disposed=false,reading=false;
  const id=conversationId;
  const poll=async()=>{
   if(disposed||reading||document.visibilityState!=='visible')return;
   reading=true;
   try{
    const rows=await listActivityRows(id);
    if(!disposed&&latestRef.current.conversationId===id)setActivityTurns(buildActivityTurns([...rows].reverse()));
   }catch{/* retain last confirmed operations; never fabricate progress */}finally{reading=false;}
  };
  void poll();
  const handle=window.setInterval(()=>void poll(),2500);
  return()=>{disposed=true;window.clearInterval(handle)};
 },[user?.id,conversationId,tab,busy,isActiveMission]);
 const scrollLatest=()=>window.requestAnimationFrame(()=>chatEnd.current?.scrollIntoView({behavior:'smooth',block:'end'}));
 async function sendMessage(e:FormEvent){
  e.preventDefault();const message=composer.trim();if((!message&&!attachments.length)||busy||actionBusy||!user)return;
  setBusy(true);activeCall.current=true;setError('');
  const requestStartedAt=Date.now();
  const thisProject=projectId;
  const optimistic:Message={id:'local-'+Date.now(),role:'user',content:message||'Médias joints',created_at:new Date().toISOString()};
  setMessages(v=>[...v,optimistic]);setComposer('');scrollLatest();
  let cid=conversationId;
  try{
   if(!cid){const {data,error}=await db.from('conversations').insert({user_id:user.id,project_id:thisProject,title:(message||'Médias joints').slice(0,60)}).select('id').single();if(error)throw error;cid=data.id;setConversationId(cid);latestRef.current.conversationId=cid;}
   const result=await sendChat(message||'Analyse les médias joints et propose un montage.',thisProject,cid,attachments.map(a=>a.id));
   if(latestRef.current.projectId!==thisProject)return;
   setAttachments([]);setMessages(v=>[...v,{id:'reply-'+Date.now(),role:'assistant',content:result.reply,created_at:new Date().toISOString()}]);scrollLatest();
   if(result.project_id&&result.project_id!==thisProject){await refreshGlobal();void openProject(result.project_id);}
   else {
    if(cid){
      try{
       const [saved,rows]=await Promise.all([listMessages(cid),listActivityRows(cid)]);
       if(latestRef.current.projectId===thisProject){
        setMessages([...saved].reverse().filter(m=>m.content?.trim()));
        setActivityTurns(buildActivityTurns([...rows].reverse()));
       }
      }catch{/* retain already displayed confirmed assistant response */}
    }
    if(thisProject)await refreshProject(thisProject);
   }
  }catch(e){
   // The Edge Function may have committed a response before the browser lost
   // the HTTP reply. Reconcile persisted state before displaying a failure.
   let recovered=false;
   if(cid){
    try{
     const saved=[...(await listMessages(cid))].reverse();
     const expected=message||'Analyse les médias joints et propose un montage.';
     const recentUserIndex=saved.findIndex(m=>m.role==='user'&&m.content?.trim()===expected&&new Date(m.created_at).getTime()>=requestStartedAt-5000);
     const reply=recentUserIndex>=0?saved.slice(recentUserIndex+1).find(m=>m.role==='assistant'&&m.content?.trim()):undefined;
     if(latestRef.current.projectId===thisProject){
      setMessages(saved.filter(m=>m.content?.trim()));
      const rows=await listActivityRows(cid);
      setActivityTurns(buildActivityTurns([...rows].reverse()));
      if(reply){
       recovered=true;
       setError('');
       // The agent may have created and linked a project while the reply was lost.
       const {data:linked}=await db.from('conversations').select('project_id').eq('id',cid).eq('user_id',user.id).maybeSingle();
       if(linked?.project_id&&linked.project_id!==thisProject){
        await refreshGlobal();
        await openProject(linked.project_id);
       }else if(thisProject){await refreshProject(thisProject);}
       scrollLatest();
      }else if(recentUserIndex>=0){
       setError('Votre demande est enregistrée, mais sa réponse n’est pas encore confirmée. Rouvrez cette conversation pour vérifier son avancement avant de renvoyer.');
       recovered=true;
      }
     }else{recovered=true;}
    }catch{/* Keep the original uncertainty; never automatically resend. */}
   }
   if(!recovered){
    alertError(e);
    // The unsent text remains recoverable without duplicating the request.
    setComposer(current=>current.trim()?current:message);
   }
  }
  finally{setBusy(false);activeCall.current=false;}
 }
 async function runMission(command:'approve'|'pause'|'resume'|'cancel'){
  if(!mission||actionBusy)return;setActionBusy(true);try{const result=await missionCommand(mission.id,command);if(result.reply){setMessages(v=>[...v,{id:'system-'+Date.now(),role:'assistant',content:result.reply!,created_at:new Date().toISOString()}]);}await refreshProject(mission.project_id);}catch(e){alertError(e)}finally{setActionBusy(false)}
 }
 async function create(e:FormEvent){e.preventDefault();if(!createTitle.trim()||actionBusy)return;setActionBusy(true);try{const p=await createProject(createTitle.trim(),createBrief.trim());setDialog(null);setCreateTitle('');setCreateBrief('');await refreshGlobal();setProjects(v=>[p,...v.filter(x=>x.id!==p.id)]);await openProject(p.id);}catch(e){alertError(e)}finally{setActionBusy(false)}}
 async function upload(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file||!user||!projectId||busy)return;setActionBusy(true);try{const id=await uploadAsset(file,projectId,user.id);setAttachments(v=>[...v,{id,name:file.name}]);setAssets(await listAssets());setTab('studio');}catch(e){alertError(e)}finally{setActionBusy(false)}}
 async function renderSpecificProject(id:string){if(actionBusy)return;setActionBusy(true);try{await requestRender(id);setJobs(await listRenders());setProjectMenuId(null);}catch(e){alertError(e)}finally{setActionBusy(false)}}
 async function cancelSpecificRender(jobId:string){
  if(actionBusy)return;setActionBusy(true);
  try{const {error}=await db.rpc('cancel_render',{p_job_id:jobId});if(error)throw error;setJobs(await listRenders());}
  catch(e){alertError(e)}finally{setActionBusy(false)}
 }
 async function playRender(path:string){try{setPreviewAsset(null);setPreviewUrl(await signedOutput(path));}catch(e){alertError(e)}}
 async function playAsset(a:Asset){
  try{const url=await signedAsset(a);if(!url)throw Error('Aucun aperçu disponible pour ce média.');setPreviewAsset(a);setPreviewUrl(url);}catch(e){alertError(e)}
 }
 function attachExistingAsset(a:Asset){
  if(!projectId||a.project_id!==projectId){setError('Ouvre d’abord le projet associé pour joindre ce média.');return;}
  if(attachments.length>=10){setError('Limite de 10 médias par message atteinte.');return;}
  setAttachments(v=>v.some(item=>item.id===a.id)?v:[...v,{id:a.id,name:String(a.provenance?.title||a.analysis?.original_name||'Média')}]);
  setAssetDetail(null);setTab('studio');
 }
 async function renameProject(){const id=projectMenuId||projectId;if(!id||!renameValue.trim()||actionBusy||!user)return;setActionBusy(true);try{const{error}=await db.from('projects').update({title:renameValue.trim()}).eq('id',id).eq('user_id',user.id);if(error)throw error;setProjectMenu(false);setProjectMenuId(null);await refreshGlobal();}catch(e){alertError(e)}finally{setActionBusy(false)}}
 async function logout(){await db.auth.signOut();setDialog(null);setUser(null);}
 if(!authReady)return <div className="boot"><Brand/><LoaderCircle className="spin"/></div>;
 if(!user)return <Auth onAuth={()=>void refreshGlobal()}/>;
 return <div className={"shell"+(keyboardOpen?" keyboard-open":"")}>
  {sidebarOpen&&<div className="mobile-scrim" onClick={()=>setSidebarOpen(false)}/>}
  <aside className={'sidebar '+(sidebarOpen?'sidebar-open':'')}>
   <div className="sidebar-brand"><Brand/><IconButton icon={X} label="Fermer le menu" onClick={()=>setSidebarOpen(false)}/></div>
   <button className="new-project" onClick={()=>{setDialog('create');setSidebarOpen(false)}}><Plus size={19}/> Nouveau projet</button>
   <div className="sidebar-label">ESPACE DE TRAVAIL</div>
   <nav className="side-nav" aria-label="Navigation principale">
    {([{id:'studio',icon:MessageCircle,label:'Studio IA'},{id:'projects',icon:Film,label:'Mes projets'},{id:'media',icon:Grid2X2,label:'Médiathèque'}] as const).map(item=><button key={item.id} className={'nav-link '+(tab===item.id?'selected':'')} onClick={()=>{setTab(item.id);setSidebarOpen(false)}}><item.icon size={19}/>{item.label}{tab===item.id&&<span className="active-dot"/>}</button>)}
   </nav>
   <div className="sidebar-divider"/>
   <div className="sidebar-label row-between">PROJETS RÉCENTS <span>{projects.length}</span></div>
   <div className="project-mini-list">{projects.slice(0,9).map(p=><button key={p.id} title={p.title} className={'project-mini '+(p.id===projectId?'active':'')} onClick={()=>void openProject(p.id)}><span className="mini-film"><Clapperboard size={16}/></span><span>{p.title}</span></button>)}</div>
   <div className="sidebar-bottom"><div className="online-status"><span className="green-dot"/> Services synchronisés</div><button className="profile-row" onClick={()=>setDialog('settings')}><span className="avatar">{(user.email||'G')[0].toUpperCase()}</span><span className="profile-copy"><strong>Mon espace</strong><small>{user.email||'Compte Galingtosh'}</small></span><Settings2 size={18}/></button></div>
  </aside>
  <main className="workspace">
   <header className={'topbar android-header '+(tab==='studio'?'native-studio-head':'native-page-head')}>
    <div className="brand-with-tagline"><Brand small/>{tab!=='studio'&&<span className="android-tagline">CRÉEZ · MONTEZ · PARTAGEZ</span>}</div>
    <div className="top-actions">
     {tab==='studio'&&<button className="android-action" aria-label="Nouvelle conversation" title="Nouvelle conversation" onClick={startNewConversation}><Edit3 size={24}/></button>}
     <button className="android-action" aria-label="Paramètres" title="Paramètres" onClick={()=>setDialog('settings')}><Settings size={24}/></button>
    </div>
   </header>
   {error&&<Alert text={error} onClose={()=>setError('')}/>}
   {tab==='studio'&&<div className="studio">
    {activeProject?<div className="studio-head android-project-header"><div><div className="overline">PROJET</div><h1 title={activeProject.title}>{activeProject.title}</h1></div><button className="scenes-action" onClick={()=>setDialog('scenes')}><Layers3 size={18}/> Scènes</button></div>:null}
    <div className="studio-body"><section className="chat-column">
     {(mission?.status==='draft')&&<div className="proposal-banner"><div className="proposal-head"><span className="proposal-symbol"><Clapperboard size={20}/></span><div className="flex-grow"><strong>Direction créative proposée</strong><small>{planTitle(mission.plan)} · {Math.floor(mission.target_seconds/60)} min {mission.target_seconds%60} s</small></div><button className="text-link" onClick={()=>setDialog('plan')}>Voir le plan <ChevronRight size={14}/></button></div><div className="proposal-actions"><button className="primary" onClick={()=>void runMission('approve')} disabled={actionBusy}><Check size={17}/> Valider et produire</button><button className="outline" onClick={()=>{setComposer('Je souhaite modifier le plan : ');document.getElementById('composer')?.focus()}}><Edit3 size={16}/> Modifier</button></div><small>Vous pouvez aussi écrire « OK » dans le chat pour valider.</small></div>}
     {(isActiveMission&&mission?.status!=='draft')&&<button className="live-banner" onClick={()=>setShowActivity(v=>!v)}><span className={'live-pulse '+(mission?.status==='needs_review'?'warning':'')}/><span className="flex-grow"><strong>{statusLabel(mission!.status)}</strong><small>{missionRender?(missionRender.status==='queued'?'Rendu en attente':missionRender.status==='running'?'Encodage vidéo en cours':missionRender.status==='failed'?'Rendu interrompu':missionRender.status==='done'?'Vidéo terminée':'Suivi du moteur'):'Préparation IA'} · {mission!.step_count} opérations de préparation{missionRender&&missionRender.attempts>1?' · tentative '+missionRender.attempts:''}</small></span>{(missionRender?.status==='running'||missionRender?.status==='queued')&&<strong className="progress-number">{missionRender.progress}%</strong>}<ChevronDown size={18} className={showActivity?'rotate':''}/></button>}
     {activeRender&&!isActiveMission&&<button className="live-banner" onClick={()=>setTab('projects')}><span className="live-pulse"/><span className="flex-grow"><strong>Rendu vidéo en cours · v{activeRender.film_version}</strong><small>Suivre le rendu dans vos projets</small></span><strong>{activeRender.progress}%</strong><ChevronRight size={18}/></button>}
     {showActivity&&mission&&<div className="activity-details">{missionRender&&missionRender.attempts>1&&<p className="muted" role="status">Le moteur a repris le rendu après une interruption (tentative {missionRender.attempts}). La progression vidéo peut repartir de 0 %, sans supprimer les opérations de préparation.</p>}<div className="row-between"><strong>Journal de production</strong><span className="muted">{mission.step_count} opérations</span></div>{tasks.length?tasks.map(t=><div className="task" key={t.id}><span className={'task-icon '+t.status}>{t.status==='done'?<Check size={14}/>:<Clock3 size={14}/>}</span><span>{stageName(t)}</span><small>{t.status==='done'?'Confirmée':t.status==='started'?'En cours':t.status==='uncertain'?'À vérifier':'Échec'}</small></div>):<p className="muted">Aucune opération encore enregistrée.</p>}<div className="mission-buttons">{mission.status==='paused'?<button className="outline" onClick={()=>void runMission('resume')}><Play size={16}/> Reprendre</button>:['queued','running','waiting_render'].includes(mission.status)&&<button className="outline" onClick={()=>void runMission('pause')}><Pause size={16}/> Pause</button>}{isActiveMission&&<button className="outline danger" onClick={()=>{if(window.confirm('Annuler la mission ? Les modifications restent conservées.'))void runMission('cancel')}}>Annuler la mission</button>}</div></div>}
     <div className="conversation" ref={scrollBox} aria-label="Conversation avec Galingtosh">
      {loading?<div className="loading-line"><LoaderCircle size={21} className="spin"/> Chargement du projet…</div>:null}
      {messages.length===0?null:messages.map(m=><div key={m.id} className="chat-turn-part">
       <article className={'bubble-row '+(m.role==='user'?'is-user':'is-agent')}>
        {m.role==='assistant'&&<span className="bot-avatar"><FilmstripLogo/></span>}
        <div className="message-bubble">
         {m.role==='assistant'&&<span className="bot-name">Galingtosh</span>}
         <div className="message-text">{m.content}</div>
         {m.role==='assistant'&&<button className="copy-message" title="Copier la réponse" onClick={()=>void navigator.clipboard.writeText(m.content)}><Copy size={14}/> Copier</button>}
        </div>
       </article>
       {m.role==='user'&&m.id===latestPromptId&&(busy||liveEvents.length>0)&&
        <div className="chat-agent-activity">
          <span className="bot-avatar"><FilmstripLogo/></span>
          <div className="chat-agent-panel">
           <button className="chat-agent-trigger" aria-expanded={chatJournalExpanded} onClick={()=>setChatJournalExpanded(v=>!v)}>
            <Activity size={17}/><span><strong>Activité de Galingtosh</strong><small>{liveEvents.filter(x=>x.status==='done').length} confirmée(s){liveEvents.some(x=>x.status==='failed')?' · étapes en échec':''}{busy?' · en cours':''}</small></span>
            <ChevronDown size={17}/>
           </button>
           {chatJournalExpanded&&<div className="chat-agent-steps">
            {liveEvents.map(e=><div className="chat-agent-step" key={e.id}>
              {e.status==='done'?<Check size={15}/>:e.status==='failed'?<AlertCircle size={15}/>:<Clock3 size={15}/>}
              <span>{e.label}{e.detail?<small>{e.detail}</small>:null}</span>
             </div>)}
            {liveEvents.length===0&&<p>En attente des premières opérations confirmées.</p>}
           </div>}
          </div>
        </div>}
      </div>)}
      {busy&&<div className="assistant-thinking"><span className="bot-avatar"><Clapperboard size={15}/></span><LoaderCircle size={16} className="spin"/> Galingtosh travaille sur votre demande…</div>}
      <div ref={chatEnd}/>
     </div>
     <div className="compose-wrap">{attachments.length>0&&<div className="attached">{attachments.map(a=><span key={a.id}><Paperclip size={13}/>{a.name}<button title="Retirer" aria-label={'Retirer '+a.name} onClick={()=>setAttachments(v=>v.filter(x=>x.id!==a.id))}><X size={13}/></button></span>)}</div>}<form className="composer" onSubmit={e=>void sendMessage(e)}><button type="button" className="attach" title="Joindre un média" disabled={!projectId||actionBusy} onClick={()=>uploadInput.current?.click()}><Paperclip size={20}/></button><textarea id="composer" aria-label="Votre message" placeholder={mission?.status==='draft'?'OK pour valider, ou modifier le plan…':'Écrivez votre message…'} value={composer} rows={1} onChange={e=>setComposer(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!busy&&composer.trim())void sendMessage(e as unknown as FormEvent);}}}/><button type="submit" className="send-btn" aria-label="Envoyer" disabled={busy||actionBusy||(!composer.trim()&&!attachments.length)}>{busy?<LoaderCircle className="spin" size={20}/>:<Send size={20}/>}</button></form></div>
    </section>
    <aside className="inspector"><div className="inspector-title"><Sparkles size={17}/> Tableau de production</div><div className="inspector-card"><span className="eyebrow">PROJET ACTIF</span>{activeProject?<><strong className="inspector-heading">{activeProject.title}</strong><p>{film?.data?.info?.synopsis||'Votre réalisation prend forme scène après scène.'}</p><div className="stat-grid"><div><strong>{film?.data?.scenes?.length||0}</strong><small>Scènes</small></div><div><strong>{assets.filter(a=>a.project_id===projectId).length}</strong><small>Médias</small></div></div></>:<p>Aucun projet sélectionné. Lancez une création pour commencer.</p>}</div><div className="inspector-card"><div className="row-between"><span className="eyebrow">PRODUCTION</span><Activity size={16} color="#ad7bff"/></div><div className="inspector-status"><span className={activeRender||isActiveMission?'green-dot':'quiet-dot'}/><strong>{mission?statusLabel(mission.status):activeRender?'Rendu en cours':latestRender?.status==='failed'?'Dernier rendu interrompu':'En attente d’une demande'}</strong></div>{activeRender&&<><div className="progress-track"><span style={{width:Math.max(0,Math.min(100,activeRender.progress||0))+'%'}}/></div><small>{activeRender.progress}% du rendu déclaré par le moteur</small></>}{latestRender?.status==='failed'&&!activeRender&&<p>Le montage est conservé. Les détails de l’erreur se trouvent dans Projets.</p>}{readyRender?.output_path&&<button className="outline full" onClick={()=>void playRender(readyRender.output_path!)}><Play size={16}/> Dernière vidéo disponible</button>}</div><div className="inspector-card"><div className="row-between"><span className="eyebrow">MONTAGE</span><Layers3 size={17} color="#ad7bff"/></div>{(film?.data?.scenes||[]).slice(0,4).map((s,i)=><button className="scene-short" key={s.id} onClick={()=>setDialog('scenes')}><span>{String(i+1).padStart(2,'0')}</span><span>{s.title||'Scène'}</span><ChevronRight size={15}/></button>)}<button className="text-link" onClick={()=>setDialog('scenes')}>Voir le storyboard <ArrowRight size={14}/></button></div></aside></div>
   </div>}
   {tab==='projects'&&<section className="page android-projects">
    <div className="android-project-title">
      <h1>Mes projets</h1>
      <button className="project-add" aria-label="Créer un projet" title="Créer un projet" onClick={()=>setDialog('create')}><CirclePlus size={27}/></button>
    </div>
    <div className="project-search"><input aria-label="Rechercher un projet" placeholder="Rechercher un projet" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="project-filters" role="group" aria-label="Filtrer les projets">
     {([{id:'all',label:'Tous'},{id:'active',label:'En cours'},{id:'ready',label:'Terminés'}] as const).map(f=><button type="button" key={f.id} aria-pressed={projectFilter===f.id} className={'project-filter '+(projectFilter===f.id?'is-active':'')} onClick={()=>setProjectFilter(f.id)}>{f.label}</button>)}
    </div>
    {visibleProjects.length===0?<Empty icon={FolderOpen} title="Aucun projet" desc="Aucun projet ne correspond à cette sélection."/>:
    <div className="android-project-list">{visibleProjects.map(p=>{
      const related=jobs.filter(j=>j.project_id===p.id);
      const r=related[0],rendering=related.find(j=>j.status==='queued'||j.status==='running');
      const ready=related.find(j=>j.status==='done'&&j.output_path);
      const failure=r?.status==='failed';
      const description=rendering?`Production v${rendering.film_version} · ${rendering.progress||0}%`:
        failure?'Dernière production interrompue':ready?`Vidéo v${ready.film_version} disponible`:'Montage en préparation';
      return <article className="android-project-item" key={p.id}>
        <button className="project-item-main" onClick={()=>void openProject(p.id)} title={'Ouvrir '+p.title}>
          <span className="project-item-art">{ready?<Play size={30}/>:<Film size={33}/>}</span>
          <span className="project-item-copy">
            <strong>{p.title}</strong>
            <span>{description}</span>
            {rendering&&<span className="progress-track project-item-progress"><span style={{width:Math.max(0,Math.min(100,rendering.progress||0))+'%'}}/></span>}
            {ready&&rendering&&<span className="project-previous-ready">Vidéo précédente v{ready.film_version} disponible</span>}
            <time dateTime={p.updated_at}>{new Date(p.updated_at).toLocaleDateString('fr-FR')}</time>
          </span>
        </button>
        <button className="project-item-menu" aria-label={'Options du projet '+p.title} aria-expanded={projectMenuId===p.id} onClick={()=>setProjectMenuId(id=>id===p.id?null:p.id)}><MoreVertical size={22}/></button>
        {projectMenuId===p.id&&<div className="project-item-popover" role="group" aria-label={'Options de '+p.title}>
           <button onClick={()=>{setProjectMenuId(null);void openProject(p.id)}}><MessageCircle size={16}/> Ouvrir le Studio</button>
           <button onClick={()=>{setProjectMenuId(p.id);setRenameValue(p.title);setProjectMenu(true)}}><Edit3 size={16}/> Renommer</button>
           {ready?.output_path&&<button onClick={()=>{setProjectMenuId(null);void playRender(ready.output_path!)}}><Play size={16}/> Voir la dernière vidéo</button>}
           <button onClick={()=>setProjectMenuId(null)}><X size={16}/> Fermer</button>
         </div>}
      </article>
    })}</div>}
    {activeProject&&<section className="native-project-production">
     <h2>PRODUCTION</h2><strong>{activeProject.title}</strong>
     <button className="primary" disabled={busy||actionBusy||isActiveMission||loading||!!activeRender||!film?.data?.scenes?.length}
       onClick={()=>{if(window.confirm('Produire la vidéo avec la version actuelle du film ?'))void renderSpecificProject(activeProject.id);}}>
       <Play size={16}/> Lancer le rendu vidéo
     </button>
     {latestRender&&<div className="native-job-info">
      <p>Rendu : {latestRender.status==='done'?'Terminé':latestRender.status==='running'?'En production':latestRender.status==='failed'?'Échec':latestRender.status==='queued'?'En attente':latestRender.status} · {latestRender.progress||0}%</p>
      {['queued','running'].includes(latestRender.status)&&<div className="progress-track"><span style={{width:Math.max(0,Math.min(100,latestRender.progress||0))+'%'}}/></div>}
      {latestRender.error&&<button className="text-link" onClick={()=>window.alert(latestRender.error||'')}>Production interrompue · Détails</button>}
      {latestRender.warnings?.map((warning,i)=><p key={i}>{warning}</p>)}
      {['queued','running'].includes(latestRender.status)&&<button className="outline danger" onClick={()=>{if(window.confirm('Annuler ce rendu ? Le montage restera conservé.'))void cancelSpecificRender(latestRender.id);}}>Annuler le rendu</button>}
      {latestRender.output_path&&<button className="outline" onClick={()=>void playRender(latestRender.output_path!)}>Ouvrir la vidéo MP4</button>}
     </div>}
    </section>}
    <section className="native-recent-productions"><h2>VERSIONS ET PRODUCTIONS RÉCENTES</h2>
    {jobs.slice(0,8).map(j=><div className="native-recent-row" key={j.id}>
      <div><strong>{projects.find(p=>p.id===j.project_id)?.title||'Production'} · v{j.film_version}</strong>
      <p>{j.status==='done'?'Terminé':j.status==='failed'?'Échec':j.status==='running'?'En production':j.status==='queued'?'En attente':j.status} · {j.progress||0}%</p>
      {j.error&&<button className="text-link" onClick={()=>window.alert(j.error||'')}>Production interrompue · Détails</button>}
      {j.warnings?.map((warning,i)=><p key={i}>{warning}</p>)}
      </div>
      {j.output_path&&<button className="project-item-menu" aria-label="Ouvrir cette vidéo" onClick={()=>void playRender(j.output_path!)}><Download size={20}/></button>}
    </div>)}
    </section>
   </section>}
   {tab==='media'&&<section className="page android-media">
    <div className="android-media-title"><h1>Médias</h1><button className="project-add" aria-label="Importer un média" title="Importer un média" onClick={()=>{
     if(!projectId){setError('Ouvre d’abord un projet pour y importer un média.');setTab('projects');return;}
     uploadInput.current?.click();
    }}><CirclePlus size={27}/></button></div>
    <div className="project-search"><input aria-label="Rechercher un média" placeholder="Rechercher un média" value={mediaSearch} onChange={e=>setMediaSearch(e.target.value)}/></div>
    <div className="project-filters media-filters" role="group" aria-label="Filtrer les médias">
     {([{id:'all',label:'Tous'},{id:'image',label:'Images'},{id:'video',label:'Vidéos'},{id:'audio',label:'Audio'}] as const).map(f=><button type="button" key={f.id} aria-pressed={mediaFilter===f.id} className={'project-filter '+(mediaFilter===f.id?'is-active':'')} onClick={()=>setMediaFilter(f.id)}>{f.label}</button>)}
    </div>
    {(mediaFilter==='all'||mediaFilter==='video')&&jobs.some(j=>j.status==='done'&&j.output_path)&&<section className="media-section">
      <h2>VIDÉOS PRODUITES</h2>
      <div className="media-list">{jobs.filter(j=>j.status==='done'&&j.output_path&&
       String(projects.find(p=>p.id===j.project_id)?.title||'Vidéo').toLocaleLowerCase('fr')
        .includes(mediaSearch.trim().toLocaleLowerCase('fr'))).map(j=>
       <button key={j.id} className="media-row" onClick={()=>void playRender(j.output_path!)} aria-label={'Regarder '+(projects.find(p=>p.id===j.project_id)?.title||'Vidéo')}>
        <span className="media-row-info"><strong>{projects.find(p=>p.id===j.project_id)?.title||'Vidéo'}</strong><small>MP4 · version {j.film_version}</small></span><span className="media-row-play"><Play size={19}/></span>
       </button>
      )}</div>
     </section>}
    <section className="media-section media-resources">
     <h2>RESSOURCES</h2>
     {visibleAssets.length===0?<p className="muted">{assets.length?'Aucun média correspondant':'Aucune ressource enregistrée'}</p>:
      <div className="native-asset-grid">{visibleAssets.map(a=>
       <button className="native-asset-card" key={a.id} onClick={()=>setAssetDetail(a)} aria-label={'Détails du média '+String(a.provenance?.title||a.analysis?.original_name||'Média')}>
        {a.preview&&['image','video'].includes(a.kind)?
          <img src={a.preview} alt="" loading="lazy" referrerPolicy="no-referrer" className="native-asset-thumb"/>:
          <div className="native-asset-thumb native-asset-fallback">
            {a.kind==='audio'?<Music2 size={30}/>:a.kind==='video'?<Video size={30}/>:<ImageIcon size={30}/>}
          </div>}
        <span className="native-asset-caption"><strong>{String(a.provenance?.title||a.analysis?.original_name||'Média importé')}</strong><small>{a.kind==='image'?'Image':a.kind==='video'?'Vidéo':'Audio'} · {a.license||'Droits à vérifier'}</small></span>
       </button>
      )}</div>}
    </section>
   </section>}
  </main>
  <nav className="mobile-nav android-tabs" aria-label="Navigation mobile">{([{id:'studio',icon:MessageCircle,label:'Studio'},{id:'projects',icon:Film,label:'Projets'},{id:'media',icon:Grid2X2,label:'Médias'}] as const).map(item=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
  {dialog==='settings'&&<section className="settings-screen" aria-label="Compte et paramètres">
    <header className="settings-screen-header">
      <div className="settings-screen-brand"><Brand small/><span>CRÉEZ · MONTEZ · PARTAGEZ</span></div>
      <button className="settings-screen-gear" type="button" title="Retour à Galingtosh" aria-label="Fermer les paramètres" onClick={()=>setDialog(null)}><Settings size={24}/></button>
    </header>
    <div className="settings-screen-content">
      <div className="settings-screen-eyebrow">PRÉFÉRENCES</div>
      <h1>Compte &amp; paramètres</h1>
      <section className="settings-account-card" aria-label="Compte connecté">
        <div className="settings-account-person">
          <span className="settings-account-avatar" aria-hidden="true">{(user.email||'G')[0].toUpperCase()}</span>
          <span className="settings-account-ident">
            <strong title={user.email||'Compte Galingtosh'}>{user.email||'Compte Galingtosh'}</strong>
            <span>Session authentifiée</span>
          </span>
        </div>
        <button className="settings-logout-button" type="button" onClick={()=>void logout()}><LogOut size={21}/> Se déconnecter</button>
      </section>
      <footer className="settings-screen-credit"><span>GALINGTOSH · ANDROID</span><span>Une création Dan Production</span></footer>
    </div>
    <nav className="settings-screen-tabs" aria-label="Navigation Galingtosh">
      {([{id:'studio',icon:MessageCircle,label:'Studio'},{id:'projects',icon:Film,label:'Projets'},{id:'media',icon:Grid2X2,label:'Médias'}] as const).map(item=><button key={item.id} type="button" onClick={()=>{setDialog(null);setTab(item.id)}} className={tab===item.id?'active':''}><item.icon size={23}/><span>{item.label}</span></button>)}
    </nav>
  </section>}
  <input ref={uploadInput} type="file" accept="image/*,video/*,audio/*" hidden onChange={e=>void upload(e)}/>
  {dialog&&dialog!=='settings'&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(null)}}><section className="dialog" role="dialog" aria-modal="true" aria-label={dialog==='plan'?'Plan de production':dialog==='scenes'?'Storyboard':'Nouveau projet'}><div className="dialog-head"><h2>{dialog==='create'?'Nouveau projet':dialog==='plan'?'Direction créative':dialog==='scenes'?'Storyboard':'Compte et paramètres'}</h2><IconButton icon={X} label="Fermer" onClick={()=>setDialog(null)}/></div>{dialog==='create'&&<form className="dialog-body" onSubmit={e=>void create(e)}><label>Titre du projet<input required autoFocus maxLength={100} value={createTitle} onChange={e=>setCreateTitle(e.target.value)} placeholder="Ex. La bataille mondiale de l’IA"/></label><label>Votre idée<textarea rows={4} value={createBrief} onChange={e=>setCreateBrief(e.target.value)} placeholder="Décrivez le sujet, la durée et l’intention…"/></label><button className="primary" type="submit" disabled={actionBusy||!createTitle.trim()}><Plus size={17}/> Créer le projet</button></form>}{dialog==='plan'&&mission&&<div className="dialog-body"><div className="plan-meta">Durée visée : {mission.target_seconds} secondes</div><div className="plan-full">{mission.plan}</div>{mission.status==='draft'&&<div className="proposal-actions"><button className="primary" onClick={()=>{setDialog(null);void runMission('approve')}}><Check size={17}/> Valider et produire</button><button className="outline" onClick={()=>{setDialog(null);setComposer('Je souhaite modifier le plan : ');document.getElementById('composer')?.focus()}}><Edit3 size={16}/> Modifier</button></div>}</div>}{dialog==='scenes'&&<div className="dialog-body">{film?.data?.scenes?.length?<div className="scenes-grid">{[...film.data.scenes].sort((a,b)=>(a.order||0)-(b.order||0)).map((s,i)=><div className="scene-card" key={s.id}><div className="scene-num">{String(i+1).padStart(2,'0')} <span>{s.durationSec||0} s</span></div><h3>{s.title||'Scène'}</h3><p>{s.narrativeGoal||'Narration en préparation'}</p>{s.narration?.text&&<blockquote>{s.narration.text}</blockquote>}<small>{s.shots?.length||0} plans</small><button className="text-link" onClick={()=>{setDialog(null);setTab('studio');setComposer('Modifie uniquement la scène '+(i+1)+' : '+(s.title||'')+'. ');document.getElementById('composer')?.focus()}}>Modifier la scène <ArrowRight size={14}/></button></div>)}</div>:<Empty icon={Layers3} title="Aucune scène" desc="Demandez à Galingtosh de construire le storyboard depuis le Studio."/>}</div>}</section></div>}
  {projectMenu&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setProjectMenu(false)}}><section className="dialog small" role="dialog" aria-modal="true"><div className="dialog-head"><h2>Renommer le projet</h2><IconButton icon={X} label="Fermer" onClick={()=>setProjectMenu(false)}/></div><form className="dialog-body" onSubmit={e=>{e.preventDefault();void renameProject()}}><input value={renameValue} autoFocus onChange={e=>setRenameValue(e.target.value)}/><button className="primary" disabled={!renameValue.trim()||actionBusy}><Check size={17}/> Enregistrer</button></form></section></div>}
  {assetDetail&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAssetDetail(null)}}>
    <section className="dialog media-details-dialog" role="dialog" aria-modal="true" aria-label="Détails du média">
      <div className="dialog-head"><h2>Détails du média</h2><IconButton icon={X} label="Fermer" onClick={()=>setAssetDetail(null)}/></div>
      <div className="dialog-body media-detail-body">
        {assetDetail.preview&&<img src={assetDetail.preview} alt="" referrerPolicy="no-referrer" className="native-asset-detail-preview"/>}
        <h3>{String(assetDetail.provenance?.title||assetDetail.analysis?.original_name||'Média importé')}</h3>
        <p className="media-meta">Source : {assetDetail.source}</p>
        <p className="media-meta">Licence : {assetDetail.license||'Droits à vérifier'}</p>
        <p className="media-meta">Auteur : {String(assetDetail.provenance?.author||'Non renseigné')}</p>
        {Array.isArray(assetDetail.provenance?.restrictions)&&assetDetail.provenance.restrictions.map((r,i)=><p className="media-restriction" key={i}>{String(r)}</p>)}
        {typeof assetDetail.provenance?.url==='string'&&/^https?:\/\//.test(assetDetail.provenance.url)&&<a className="outline full" href={assetDetail.provenance.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Consulter la source</a>}
        <button className="primary" onClick={()=>attachExistingAsset(assetDetail)} disabled={!projectId||assetDetail.project_id!==projectId||attachments.length>=10}>
         <Paperclip size={17}/> Joindre à la conversation
        </button>
        {assetDetail.project_id!==projectId&&<p className="media-meta">Ouvre d’abord le projet associé pour joindre ce média.</p>}
        {assetDetail.storage_path&&<button className="outline" onClick={()=>{const a=assetDetail;setAssetDetail(null);void playAsset(a)}}><Play size={16}/> Ouvrir le fichier</button>}
      </div>
    </section>
   </div>}
  {previewUrl&&<div className="overlay media-overlay" onMouseDown={e=>{if(e.target===e.currentTarget){setPreviewUrl(null);setPreviewAsset(null)}}}><section className="dialog media-dialog"><div className="dialog-head"><h2>{previewAsset?String(previewAsset.provenance?.title||previewAsset.analysis?.original_name||'Média'):'Vidéo produite'}</h2><IconButton icon={X} label="Fermer" onClick={()=>{setPreviewUrl(null);setPreviewAsset(null)}}/></div><div className="media-view">{previewAsset?.kind==='image'?<img src={previewUrl} alt="Aperçu du média"/>:previewAsset?.kind==='audio'?<audio controls src={previewUrl}/>:<video controls playsInline src={previewUrl}/>}<a className="outline download-link" href={previewUrl} target="_blank" rel="noopener noreferrer"><Download size={16}/> Ouvrir ou télécharger <ExternalLink size={14}/></a><small>Accès privé temporaire (15 minutes). Respectez les licences des médias.</small></div></section></div>}
 </div>;
}
