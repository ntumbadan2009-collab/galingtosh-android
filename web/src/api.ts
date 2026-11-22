import {createClient} from '@supabase/supabase-js';
export const endpoint=import.meta.env.VITE_SUPABASE_URL||'https://lmlwekcytivszlszmfvy.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_kmotb1BBdQ20kWuB-ryirQ_9Rqcq88U';
export const db=createClient(endpoint,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
export type Tab='studio'|'projects'|'media';
export type Project={id:string;title:string;type:string;created_at:string;updated_at:string};
export type Conversation={id:string;project_id:string|null;title:string|null;created_at:string};
export type Message={id:string;role:'user'|'assistant'|'tool';content:string;created_at:string;metadata?:Record<string,unknown>};
export type Asset={id:string;project_id:string;kind:string;source:string;storage_path:string|null;license:string|null;provenance:Record<string,unknown>|null;analysis:Record<string,unknown>|null};
export type Render={id:string;project_id:string;film_version:number;status:string;progress:number;output_path:string|null;error:string|null;created_at:string};
export type Mission={id:string;project_id:string;conversation_id:string;status:'draft'|'queued'|'running'|'waiting_render'|'paused'|'needs_review'|'done'|'failed'|'canceled';plan:string;target_seconds:number;step_count:number;render_job_id:string|null;requested_action:string|null;error_code:string|null};
export type Task={id:string;mission_id:string;step_no:number;kind:string;status:string;started_at:string};
export type Film={version:number;data:{info?:{title?:string;synopsis?:string};scenes?:Array<{id:string;title?:string;durationSec?:number;order?:number;narrativeGoal?:string;shots?:Array<{id:string;mediaRef?:string;inSec?:number;outSec?:number}>;narration?:{text?:string}}>;}};
async function checked<T>(result:{data:T;error:unknown}):Promise<T>{if(result.error)throw result.error;return result.data;}
export const listProjects=()=>checked(db.from('projects').select('id,title,type,created_at,updated_at').order('updated_at',{ascending:false}).limit(100));
export const listRenders=()=>checked(db.from('render_jobs').select('id,project_id,film_version,status,progress,output_path,error,created_at').order('created_at',{ascending:false}).limit(80));
export const listAssets=()=>checked(db.from('media_assets').select('id,project_id,kind,source,storage_path,license,provenance,analysis').order('created_at',{ascending:false}).limit(100));
export const listConversations=(projectId:string)=>checked(db.from('conversations').select('id,project_id,title,created_at').eq('project_id',projectId).order('created_at',{ascending:false}).limit(30));
export const listMessages=(id:string)=>checked(db.from('messages').select('id,role,content,created_at,metadata').eq('conversation_id',id).in('role',['user','assistant']).order('created_at',{ascending:false}).limit(140));
export const listMissionTasks=(missionId:string)=>checked(db.from('production_tasks').select('id,mission_id,step_no,kind,status,started_at').eq('mission_id',missionId).order('step_no',{ascending:false}).limit(40));
export async function latestMission(projectId:string){return checked(db.from('production_missions').select('id,project_id,conversation_id,status,plan,target_seconds,step_count,render_job_id,requested_action,error_code').eq('project_id',projectId).order('created_at',{ascending:false}).limit(1).maybeSingle());}
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
 if(!a.storage_path)return null;
 const bucket=a.source==='upload'?'user-uploads':'media';
 const {data,error}=await db.storage.from(bucket).createSignedUrl(a.storage_path,900);
 return error?null:data.signedUrl;
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
export function stageName(task:Task){const names:Record<string,string>={create_project:'Création du projet',set_format:'Format vidéo',set_render_params:'Configuration du rendu',add_scene:'Construction des scènes',set_scene_narration:'Écriture de narration',search_media:'Recherche de médias',inspect_video_clips:'Analyse des séquences',add_found_media:'Médias intégrés',add_shot:'Plans audiovisuels',measure_narration:'Mesure des voix',request_render:'Rendu final',update_subtitles:'Sous-titres'};return names[task.kind]||'Étape audiovisuelle';}
export function statusLabel(status:string){return ({draft:'Plan à valider',queued:'Mission en attente',running:'Production en cours',waiting_render:'Montage vidéo en cours',paused:'Production en pause',needs_review:'Vérification nécessaire',done:'Terminée',failed:'Échec',canceled:'Annulée'} as Record<string,string>)[status]||status;}
export function planTitle(plan:string){return plan.split(/\r?\n/).find(l=>/^titre(?: provisoire)?\s*:/i.test(l.trim()))?.replace(/^\s*titre(?: provisoire)?\s*:\s*/i,'')||plan.trim().split('\n')[0]||'Plan de création';}
