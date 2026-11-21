import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityTurns } from '../src/lib/agentActivity.ts';
const row=(id,role,metadata={})=>({id,role,metadata,created_at:'2026-11-21T16:00:00Z'});
test('planned actions become confirmed only when matching tool results arrive',()=>{
 const rows=[row('user','user'),row('assistant','assistant',{tool_calls:[
  {id:'a',name:'add_scene',args:{title:'La Chine',secret:'hidden'}},
  {id:'b',name:'request_render',args:{}}]}),
  row('tool','tool',{tool_call_id:'a',name:'add_scene',is_error:false})];
 const [t]=buildActivityTurns(rows);
 assert.deepEqual(t.events.map(x=>x.status),['done','planned']);
 assert.equal(t.events[0].detail,'La Chine');
 assert.ok(!JSON.stringify(t).includes('hidden'));
});
test('failure is not success; subsequent requests remain separate',()=>{
 const turns=buildActivityTurns([
  row('1','user'),row('2','tool',{name:'request_render',tool_call_id:'a',is_error:true}),
  row('3','user'),row('4','tool',{name:'request_render',tool_call_id:'a',is_error:false}),
  row('5','assistant')]);
 assert.equal(turns.length,2);
 assert.equal(turns[0].events[0].status,'failed');
 assert.equal(turns[1].events[0].status,'done');
});
test('missing status is never inferred to be success',()=>{
 assert.equal(buildActivityTurns([row('a','tool',{name:'search_media'})])[0].events[0].status,'planned');
});
