import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trailingSpace,anchorOffset,canAnchor} from '../src/lib/chatLayout.ts';
test('short replies leave enough space to anchor the latest prompt',()=> {
 assert.equal(trailingSpace(600,120),480);
 assert.equal(trailingSpace(600,900),0);
});
test('scroll requests are clamped to real content bounds',()=>{
 assert.equal(anchorOffset(850,1500,600),850);
 assert.equal(anchorOffset(950,1500,600),900);
 assert.equal(anchorOffset(-1,20,500),0);
});
test('manual scrolling always cancels auto anchoring',()=>{
 assert.equal(canAnchor('new','new',true),false);
 assert.equal(canAnchor('new','old',false),false);
 assert.equal(canAnchor('new','new',false),true);
 assert.equal(canAnchor(null,null,false),false);
});
