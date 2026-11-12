import {supabase} from './supabase';
export type RenderJob={id:string;project_id:string;user_id:string;film_version:number;status:string;progress:number;output_path?:string|null;error?:string|null;warnings?:string[]|null;attempts?:number;created_at?:string;finished_at?:string|null};
export async function requestRender(projectId:string):Promise<{job_id:string;status:string}>{
 const {data,error}=await supabase.functions.invoke('request-render',{body:{project_id:projectId}});
 if(error)throw new Error(error.message||'Impossible de mettre le rendu en file.');
 if(!data?.job_id)throw new Error('La réponse request-render ne contient pas job_id.');
 return data;
}
export async function getRenderJob(jobId:string):Promise<RenderJob>{
 const {data,error}=await supabase.from('render_jobs').select('id,project_id,user_id,film_version,status,progress,output_path,error,warnings,attempts,created_at,finished_at').eq('id',jobId).single();
 if(error)throw error;return data as RenderJob;
}
export async function listRenderJobs(projectId?:string):Promise<RenderJob[]>{
 let q=supabase.from('render_jobs').select('id,project_id,user_id,film_version,status,progress,output_path,error,warnings,attempts,created_at,finished_at').order('created_at',{ascending:false}).limit(30);
 if(projectId)q=q.eq('project_id',projectId);const {data,error}=await q;if(error)throw error;return(data||[]) as RenderJob[];
}
export async function getRenderDownloadUrl(path:string):Promise<string>{
 const {data,error}=await supabase.storage.from('renders').createSignedUrl(path,900);if(error)throw error;return data.signedUrl;
}
