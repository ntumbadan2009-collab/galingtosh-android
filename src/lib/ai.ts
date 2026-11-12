import {supabase} from './supabase';
export type AgentResult={reply:string;conversation_id?:string|null;project_id?:string|null;film_version?:number|null;render_job_id?:string|null;tool_events?:unknown[]};
export async function sendToAgent(message:string,projectId?:string|null,attachments:unknown[]=[]):Promise<AgentResult>{
 const {data,error}=await supabase.functions.invoke('chat-agent',{body:{message,project_id:projectId||undefined,attachments}});
 if(error)throw new Error(error.message||"L'assistant Galingtosh est momentanément indisponible.");
 if(!data||typeof data.reply!=='string')throw new Error("La réponse de chat-agent ne respecte pas le contrat attendu.");
 return data as AgentResult;
}
