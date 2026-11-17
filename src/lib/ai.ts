import {functionError} from './functionError';
import {supabase} from './supabase';
export type AgentResult={reply:string;conversation_id?:string|null;project_id?:string|null;film_version?:number|null;render_job_id?:string|null;tool_events?:unknown[]};
export async function sendToAgent(message:string,projectId?:string|null,attachments:unknown[]=[],conversationId?:string|null):Promise<AgentResult>{
 const {data,error}=await supabase.functions.invoke('chat-agent',{body:{message,conversation_id:conversationId||undefined,project_id:projectId||undefined,attachments}});
 if(error)throw await functionError(error,"La réponse n’a pas pu être reçue. Rouvrez le projet avant de réessayer : certaines opérations peuvent avoir été enregistrées.");
 if(!data||typeof data.reply!=='string')throw new Error("La réponse de chat-agent ne respecte pas le contrat attendu.");
 return data as AgentResult;
}

