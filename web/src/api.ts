import {createClient} from '@supabase/supabase-js';
export const endpoint=import.meta.env.VITE_SUPABASE_URL||'https://lmlwekcytivszlszmfvy.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_kmotb1BBdQ20kWuB-ryirQ_9Rqcq88U';
export const db=createClient(endpoint,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
export type Tab='studio'|'projects'|'media';
export type Project={id:string;title:string;type:string;created_at:string;updated_at:string};
export type Conversation={id:string;project_id:string|null;title:string|null;created_at:string};
export type Message={id:string;role:'user'|'assistant'|'tool';content:string;created_at:string;metadata?:Record<string,unknown>};
export type Asset={id:string;project_id:string;kind:string;source:string;storage_path:string|null;license:string|null;provenance:Record<string,unknown>|null;analysis:Record<string,unknown>|null;preview?:string|null};
export type Render={id:string;project_id:string;film_version:number;status:string;progress:number;output_path:string|null;error:string|null;warnings?:string[]|null;attempts:number;updated_at:string;created_at:string};
export type Mission={id:string;project_id:string;conversation_id:string;status:'draft'|'queued'|'running'|'waiting_render'|'paused'|'needs_review'|'done'|'failed'|'canceled';plan:string;target_seconds:number;step_count:number;render_job_id:string|null;requested_action:string|null;error_code:string|null};
export type Task={id:string;mission_id:string;step_no:number;kind:string;status:string;started_at:string;error_detail?:string|null;reason_detail?:string|null};
export type Film={version:number;data:{info?:{title?:string;synopsis?:string};scenes?:Array<{id:string;title?:string;durationSec?:number;order?:number;narrativeGoal?:string;shots?:Array<{id:string;mediaRef?:string;inSec?:number;outSec?:number}>;narration?:{text?:string}}>;}};
async function checked<T>(query:PromiseLike<{data:T|null;error:unknown}>):Promise<T>{const result=await query;if(result.error)throw result.error;return result.data as T;}
export const listProjects=()=>checked(db.from('projects').select('id,title,type,created_at,updated_at').order('updated_at',{ascending:false}).limit(100));
export const listRenders=()=>checked(db.from('render_jobs').select('id,project_id,film_version,status,progress,output_path,error,warnings,attempts,updated_at,created_at').order('created_at',{ascending:false}).limit(80));
/** Mirrors App.tsx:loadAssets on Android; never replace real previews with invented images. */
export async function listAssets():Promise<Asset[]>{
 const rows=(await checked(db.from('media_assets').select('id,project_id,kind,source,storage_path,license,provenance,analysis').order('created_at',{ascending:false}).limit(80))) as Asset[];
 return Promise.all(rows.map(async a=>{
  const sourcePreview=typeof a.provenance?.preview_url==='string'&&/^https:\/\//i.test(a.provenance.preview_url)?a.provenance.preview_url:null;
  if(a.kind==='image'&&a.storage_path){
   const {data}=await db.storage.from('user-uploads').createSignedUrl(a.storage_path,900);
   return {...a,preview:data?.signedUrl||sourcePreview};
  }
  return {...a,preview:sourcePreview};
 }));
}
export const listConversations=(projectId:string)=>checked(db.from('conversations').select('id,project_id,title,created_at').eq('project_id',projectId).order('created_at',{ascending:false}).limit(30));
export const listMessages=(id:string)=>checked(db.from('messages').select('id,role,content,created_at,metadata').eq('conversation_id',id).in('role',['user','assistant']).order('created_at',{ascending:false}).limit(140));
// The journal is built from persisted tool metadata (same as Android), not fake activity.
export const listActivityRows=(id:string)=>checked(db.from('messages').select('id,role,created_at,metadata').eq('conversation_id',id).in('role',['user','assistant','tool']).order('created_at',{ascending:false}).limit(500));
export const listMissionTasks=(missionId:string)=>checked(db.from('production_tasks').select('id,mission_id,step_no,kind,status,started_at,error_detail:result->>error,reason_detail:result->>reason').eq('mission_id',missionId).order('step_no',{ascending:false}).limit(40));
export async function latestMission(projectId:string):Promise<Mission|null>{return (await checked(db.from('production_missions').select('id,project_id,conversation_id,status,plan,target_seconds,step_count,render_job_id,requested_action,error_code').eq('project_id',projectId).order('created_at',{ascending:false}).limit(1).maybeSingle())) as Mission|null;}
export async function latestFilm(projectId:string){return checked(db.from('films').select('version,data').eq('project_id',projectId).order('version',{ascending:false}).limit(1).maybeSingle());}
export async function createProject(title:string,description:string){const value=await checked(db.rpc('create_studio_project',{p_title:title,p_synopsis:description}));const p=Array.isArray(value)?value[0]:value;if(!p?.id)throw Error('Projet non créé.');return p as Project;}
export async function sendChat(message:string,projectId:string|null,conversationId:string|null,attachments:string[]=[]){
 const {data,error}=await db.functions.invoke('chat-agent',{body:{message,project_id:projectId||undefined,conversation_id:conversationId||undefined,attachments}});
 if(error)throw Error('La requête n’a pas pu être confirmée. Recharge la conversation avant de la renvoyer.');
 if(!data||typeof data.reply!=='string')throw Error('Réponse de l’agent invalide.');
 return data as {reply:string;project_id?:string;conversation_id?:string;render_job_id?:string};
}
export async function missionCommand(id:string,command:'approve'|'pause'|'resume'|'cancel'){
 const {data,error}=await db.functions.invoke('chat-agent',{body:{action:command==='approve'?'approve_production':'control_production',mission_id:id,command}});
 if(error||!data?.ok)throw Error(data?.error||'Commande non confirmée.');
 return data as {ok:true;reply?:string};
}
export async function requestRender(projectId:string){
 const {data,error}=await db.functions.invoke('request-render',{body:{project_id:projectId}});
 if(error||!data?.job_id)throw Error('Le rendu n’a pas pu être confirmé.');
 return data as {job_id:string;status:string};
}
export async function signedOutput(path:string){const {data,error}=await db.storage.from('renders').createSignedUrl(path,900);if(error)throw error;return data.signedUrl;}
export async function signedAsset(a:Asset){
 if(!a.storage_path)return a.preview||null;
 const bucket=a.source==='upload'?'user-uploads':'media';
 const {data,error}=await db.storage.from(bucket).createSignedUrl(a.storage_path,900);
 return error?a.preview||null:data.signedUrl;
}
export async function uploadAsset(file:File,projectId:string,userId:string){
 const allowed=new Set(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','video/webm','audio/mpeg','audio/wav','audio/mp4','audio/ogg']);
 if(!allowed.has(file.type)||file.size>50*1024*1024||!file.size)throw Error('Fichier non pris en charge (50 Mo maximum).');
 const path=userId+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
 const {error:upError}=await db.storage.from('user-uploads').upload(path,file,{contentType:file.type,upsert:false});
 if(upError)throw upError;
 const {data,error}=await db.from('media_assets').insert({project_id:projectId,user_id:userId,kind:file.type.split('/')[0],source:'upload',storage_path:path,analysis:{original_name:file.name}}).select('id').single();
 if(error){await db.storage.from('user-uploads').remove([path]);throw error;}return data.id as string;
}
const taskNames:Record<string,string>={
 create_project:'Création du projet',activate_autonomous_level5:'Initialisation de la réalisation',creative_narrative:'Direction narrative',creative_visual:'Direction visuelle',creative_director:'Direction artistique',set_project_info:'Informations du film',set_editorial_profile:'Style éditorial',set_format:'Format vidéo',set_render_params:'Configuration du rendu',add_character:'Création des personnages',update_character:'Révision des personnages',
 add_scene:'Construction des scènes',update_scene:'Ajustement des scènes',remove_scene:'Révision des scènes',reorder_scenes:'Ordre narratif',set_scene_narration:'Écriture de la voix off',review_documentary_scene:'Vérification documentaire',measure_narration:'Mesure des voix',align_narration_durations:'Synchronisation de la narration',plan_scene_beats:'Découpage narratif',
 search_media:'Recherche de médias',list_media:'Inventaire des médias',inspect_video_clips:'Analyse des séquences',analyze_media:'Analyse visuelle',add_found_media:'Intégration de média',register_uploaded_media:'Import de média',attach_media:'Placement du média',verify_shot_media:'Contrôle de pertinence visuelle',
 add_shot:'Montage · placement des plans',add_code_shot:'Montage · illustration animée',turn_shot_into_code:'Montage · remplacement du visuel',set_motion_visual:'Montage · animation graphique',update_shot:'Montage · cadrage et minutage',remove_shot:'Montage · retrait de plan',set_transition:'Montage · raccord et transition',add_effect:'Montage · effet visuel',remove_effect:'Montage · retrait d’effet',
 set_scene_music:'Montage sonore · ambiance musicale',set_procedural_music:'Montage sonore · musique',set_editorial_accents:'Montage sonore · accents',add_audio_track:'Montage sonore · piste audio',update_audio_track:'Montage sonore · mixage',remove_audio_track:'Montage sonore · retrait de piste',verify_and_add_sound:'Montage sonore · validation d’effet',update_subtitles:'Montage · sous-titres',apply_scene_montage:'Montage · réalisation de scène',
 audit_editorial_rhythm:'Contrôle du rythme',audit_director_intelligence:'Contrôle de la réalisation',audit_production_foundations:'Contrôle des fondations',director_review_requested:'Préparation du contrôle final',director_plan_review:'Contrôle artistique avant rendu',get_film:'Lecture du montage',request_render:'Validation et mise en file du rendu'
};
export function stageName(task:Task){return taskNames[task.kind]||'Opération de production';}
export function taskDetail(task:Task):string|null{
 if(task.status!=='failed')return null;
 const error=(task.error_detail||'').toLowerCase();
 if(task.reason_detail&&task.kind==='verify_shot_media')return 'Le visuel ne correspond pas assez à la narration.';
 if(error.includes('citation')||error.includes('citer exactement'))return 'La citation ne correspond pas exactement à la narration.';
 if(error.includes('causalité'))return 'La relation de cause à effet n’est pas exprimée dans cet ordre.';
 if(error.includes('nombre d’éléments')||error.includes("nombre d'éléments"))return 'Le schéma contient un nombre d’éléments non pris en charge.';
 if(error.includes('durée')||error.includes('secondes'))return 'La durée ou le minutage doit être corrigé.';
 if(error.includes('introuvable'))return 'Le plan ou le média référencé est introuvable.';
 if(task.kind==='request_render')return 'Le rendu n’a pas été accepté. Le montage doit être vérifié avant l’encodage.';
 if(task.kind==='verify_shot_media')return 'Le contrôle visuel n’a pas abouti.';
 return null;
}
export function taskStatus(task:Task){return task.status==='done'?'Confirmée':task.status==='started'?'En cours':task.status==='uncertain'?'À vérifier':task.status==='failed'&&task.kind==='verify_shot_media'&&!!task.reason_detail?'Visuel rejeté':task.status==='failed'&&!!taskDetail(task)?'À corriger':'Échec';}
export function statusLabel(status:string){return ({draft:'Plan à valider',queued:'Mission en attente',running:'Production en cours',waiting_render:'Rendu et contrôle final',paused:'Production en pause',needs_review:'Vérification nécessaire',done:'Terminée',failed:'Échec',canceled:'Annulée'} as Record<string,string>)[status]||status;}
export function planTitle(plan:string){return plan.split(/\r?\n/).find(l=>/^titre(?: provisoire)?\s*:/i.test(l.trim()))?.replace(/^\s*titre(?: provisoire)?\s*:\s*/i,'')||plan.trim().split('\n')[0]||'Plan de création';}
