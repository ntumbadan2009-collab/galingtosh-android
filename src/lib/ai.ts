import {functionError} from './functionError';
import {supabase} from './supabase';
export type AgentResult={reply:string;conversation_id?:string|null;project_id?:string|null;film_version?:number|null;render_job_id?:string|null;tool_events?:unknown[]};
export async function sendToAgent(message:string,projectId?:string|null,attachments:unknown[]=[],conversationId?:string|null):Promise<AgentResult>{
 const {data,error}=await supabase.functions.invoke('chat-agent',{body:{message,conversation_id:conversationId||undefined,project_id:projectId||undefined,attachments}});
 if(error)throw await functionError(error,"La réponse n’a pas pu être reçue. Rouvrez le projet avant de réessayer : certaines opérations peuvent avoir été enregistrées.");
 if(!data||typeof data.reply!=='string')throw new Error("La réponse de chat-agent ne respecte pas le contrat attendu.");
 return data as AgentResult;
}


/**
 * Reconcile a request whose HTTP response was lost after the server committed
 * its conversation messages. Never re-run a mutation merely because the
 * network failed: doing so can duplicate scenes, media and render requests.
 */
export async function recoverAgentResponse(
 message:string,projectId:string|null,conversationId:string|null
):Promise<AgentResult|null>{
 let candidates:string[]=[];
 if(conversationId)candidates=[conversationId];
 else if(projectId){
  const {data,error}=await supabase.from('conversations')
   .select('id').eq('project_id',projectId)
   .order('created_at',{ascending:false}).limit(3);
  if(error)throw error;
  candidates=(data||[]).map(row=>row.id);
 }
 for(const id of candidates){
  const {data,error}=await supabase.from('messages')
   .select('role,content,created_at').eq('conversation_id',id)
   .in('role',['user','assistant'])
   .order('created_at',{ascending:false}).limit(80);
  if(error)throw error;
  const rows=data||[];
  // Newest exact user request is the only one eligible for recovery.
  // If it has no later assistant response, we must not return a stale answer.
  const requestIndex=rows.findIndex(row=>row.role==='user'&&row.content===message);
  if(requestIndex<0)continue;
  const reply=rows.slice(0,requestIndex).find(row=>row.role==='assistant'&&row.content?.trim());
  if(reply)return {
   reply:reply.content,conversation_id:id,project_id:projectId,
  };
  return null;
 }
 return null;
}
