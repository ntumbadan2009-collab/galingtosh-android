// Public, user-facing summaries of persisted tool calls. Do not display model
// scratchpads, entire tool arguments, URLs, credentials, or raw tool outputs.
export type ActivityRow = {
 id:string; role:string; created_at:string; metadata:unknown
};
export type ActivityEvent = {
 id:string; callId:string; name:string; label:string; detail?:string;
 status:'planned'|'done'|'failed'; time:string
};
export type ActivityTurn = {id:string; time:string; events:ActivityEvent[]};
const LABELS:Record<string,string>={
 create_project:'Création du projet',get_film:'Lecture du montage',
 set_project_info:'Organisation du projet',set_format:'Choix du format',
 set_render_params:'Réglages de production',add_character:'Création d’un personnage',
 update_character:'Modification d’un personnage',add_scene:'Création d’une scène',
 update_scene:'Ajustement d’une scène',remove_scene:'Retrait d’une scène',
 reorder_scenes:'Organisation des scènes',set_scene_narration:'Écriture de la narration',
 measure_narration:'Mesure de la durée des voix',align_narration_durations:'Synchronisation des voix',
 add_shot:'Ajout d’un plan',update_shot:'Ajustement d’un plan',remove_shot:'Retrait d’un plan',
 set_transition:'Réglage d’une transition',add_effect:'Ajout d’un effet visuel',
 remove_effect:'Retrait d’un effet',add_audio_track:'Ajout d’une piste sonore',
 update_audio_track:'Ajustement du son',remove_audio_track:'Retrait d’une piste sonore',
 set_procedural_music:'Réglage de la musique procédurale',set_scene_music:'Ambiance sonore de la scène',
 update_subtitles:'Préparation des sous-titres',search_media:'Recherche de médias',
 add_found_media:'Enregistrement d’un média',list_media:'Consultation de la médiathèque',
 register_uploaded_media:'Enregistrement du média importé',attach_media:'Placement d’un média',
 inspect_video_clips:'Analyse des passages vidéo',analyze_media:'Analyse d’un média',
 request_render:'Demande de rendu',undo_last_operation:'Annulation d’une opération'
};
/** Human-facing description of a persisted backend task. Never leak raw tool ids. */
export function activityLabel(name:string):string{
 return LABELS[name]||'Étape de production';
}
function record(value:unknown):Record<string,unknown>{
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function short(value:unknown):string|undefined{
 if(typeof value!=='string')return undefined;
 // Only user-facing descriptive fields, bounded and stripped of control chars.
 const s=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 if(!s)return undefined;
 return s.length>140?s.slice(0,137)+'…':s;
}
function getDetail(name:string,args:Record<string,unknown>):string|undefined{
 switch(name){
  case 'create_project':case 'add_scene':case 'update_scene':case 'set_project_info':return short(args.title);
  case 'search_media':return short(args.query);
  case 'inspect_video_clips':return short(args.visual_intent);
  case 'set_format':return short(args.aspect);
  case 'set_render_params':return typeof args.targetDurationSec==='number'?`Durée visée : ${args.targetDurationSec} s`:short(args.resolution);
  case 'update_subtitles':return Array.isArray(args.cues)?`${args.cues.length} segments proposés`:undefined;
  default:return undefined;
 }
}
export function buildActivityTurns(rows:ActivityRow[]):ActivityTurn[]{
 const turns:ActivityTurn[]=[];
 let turn:ActivityTurn|undefined;
 for(const row of rows){
  if(row.role==='user'){
   turn={id:row.id,time:row.created_at,events:[]};turns.push(turn);continue;
  }
  const m=record(row.metadata);
  if(row.role==='assistant'&&!Array.isArray(m.tool_calls))continue;
  if(row.role!=='tool'&&row.role!=='assistant')continue;
  if(!turn){turn={id:'older-'+row.id,time:row.created_at,events:[]};turns.push(turn);}
  if(row.role==='assistant'&&Array.isArray(m.tool_calls)){
   m.tool_calls.forEach((raw,i)=>{
    const c=record(raw);if(typeof c.name!=='string')return;
    const name=c.name;
    turn!.events.push({id:row.id+'-'+i,callId:typeof c.id==='string'?c.id:'',name,
     label:LABELS[name]||'Opération de production',detail:getDetail(name,record(c.args)),
     status:'planned',time:row.created_at});
   });
  }
  if(row.role==='tool'){
   const name=typeof m.name==='string'?m.name:'';
   const callId=typeof m.tool_call_id==='string'?m.tool_call_id:'';
   const status=m.is_error===true?'failed':m.is_error===false?'done':'planned';
   const match=[...turn.events].reverse().find(e=>e.status==='planned'&&e.callId===callId&&e.name===name);
   if(match){match.status=status;match.time=row.created_at;}
   else turn.events.push({id:row.id,callId,name,label:LABELS[name]||'Opération de production',status,time:row.created_at});
  }
 }
 return turns;
}
