import {supabase} from './supabase';
import {functionError} from './functionError';
export type ProductionStatus='draft'|'queued'|'running'|'waiting_render'|'paused'|'needs_review'|'done'|'failed'|'canceled';
export type ProductionMission={id:string;project_id:string;conversation_id:string;plan:string;target_seconds:number;status:ProductionStatus;step_count:number;requested_action:'pause'|'cancel'|null;error_code:string|null;render_job_id:string|null;updated_at:string};
export type MissionTask={step_no:number;kind:string;status:'started'|'done'|'failed'|'uncertain'};
export const activeProduction=(m:ProductionMission|null|undefined)=>!!m&&['queued','running','waiting_render','paused','needs_review'].includes(m.status);
export const PRODUCTION_LABELS:Record<ProductionStatus,string>={draft:'Direction créative proposée',queued:'Production en attente',running:'Production autonome en cours',waiting_render:'Montage transmis au moteur vidéo',paused:'Production en pause',needs_review:'Vérification nécessaire',done:'Production terminée',failed:'Production interrompue',canceled:'Production annulée'};
export async function readProduction(projectId:string):Promise<{mission:ProductionMission|null;tasks:MissionTask[]}>{
 const {data,error}=await supabase.from('production_missions').select('id,project_id,conversation_id,plan,target_seconds,status,step_count,requested_action,error_code,render_job_id,updated_at').eq('project_id',projectId).not('status','eq','canceled').order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw error;
 const mission=data as ProductionMission|null;
 if(!mission)return {mission:null,tasks:[]};
 const {data:tasks,error:taskError}=await supabase.from('production_tasks').select('step_no,kind,status').eq('mission_id',mission.id).order('step_no',{ascending:false}).limit(60);
 if(taskError)throw taskError;
 return {mission,tasks:(tasks||[]) as MissionTask[]};
}
export async function controlProduction(missionId:string,command:'approve'|'pause'|'resume'|'cancel'){
 const {data,error}=await supabase.functions.invoke('chat-agent',{body:{action:command==='approve'?'approve_production':'control_production',mission_id:missionId,command}});
 if(error)throw await functionError(error,'La commande n’a pas pu être confirmée.');
 if(!data?.ok)throw Error('La commande n’a pas été confirmée.');
}
