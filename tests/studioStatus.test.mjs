import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityLabel,buildActivityTurns} from '../src/lib/agentActivity.ts';
test('production steps show real human-readable action labels',()=>{
 assert.equal(activityLabel('search_media'),'Recherche de médias');
 assert.equal(activityLabel('set_scene_narration'),'Écriture de la narration');
 assert.equal(activityLabel('request_render'),'Demande de rendu');
 assert.equal(activityLabel('unexpected_internal_tool'),'Étape de production');
});
test('activity journal only confirms outcomes persisted by the server',()=>{
 const now='2026-11-22T09:00:00Z';
 const turns=buildActivityTurns([
  {id:'u',role:'user',created_at:now,metadata:{}},
  {id:'a',role:'assistant',created_at:now,metadata:{tool_calls:[{id:'call-1',name:'search_media',args:{query:'images IA'}}]}},
 ]);
 assert.equal(turns[0].events[0].status,'planned');
 const done=buildActivityTurns([
  {id:'u',role:'user',created_at:now,metadata:{}},
  {id:'a',role:'assistant',created_at:now,metadata:{tool_calls:[{id:'call-1',name:'search_media',args:{query:'images IA'}}]}},
  {id:'result',role:'tool',created_at:now,metadata:{tool_call_id:'call-1',name:'search_media',is_error:false}},
 ]);
 assert.equal(done[0].events[0].status,'done');
});

test('new audiovisual operations have explicit labels in native and web journals',async()=>{
 const native=await import('../src/lib/agentActivity.ts');
 const web=await import('../web/src/agentActivity.ts');
 for(const lib of [native,web]){
  for(const key of ['add_code_shot','turn_shot_into_code','verify_shot_media','apply_scene_montage','review_documentary_scene'])assert.notEqual(lib.activityLabel(key),'Étape de production');
  assert.match(lib.missionBlockReason('no_action_selected'),/action exploitable/);
  assert.equal(lib.missionBlockReason('unknown_secret_error'),null);
  assert.match(lib.taskFailureDetail({kind:'add_code_shot',status:'failed',error_detail:"Nombre d'éléments non pris en charge"}),/Nombre d’éléments/);
  assert.equal(lib.taskFailureDetail({kind:'add_code_shot',status:'done',error_detail:'visualItems manquant'}),null);
  assert.equal(lib.taskFailureDetail({kind:'add_code_shot',status:'failed',error_detail:'raw_private_details'}),null);
 }
});
