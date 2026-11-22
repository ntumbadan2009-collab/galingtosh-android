// Pure scroll policy: keep space below the newest turn so the prompt can
// reach the viewport top even while the answer is still very short.
export function trailingSpace(viewport:number,turnHeight:number):number {
 return Math.max(0,Math.ceil(viewport-turnHeight));
}
export function anchorOffset(y:number,contentHeight:number,viewport:number):number {
 return Math.max(0,Math.min(y,Math.max(0,contentHeight-viewport)));
}
export function canAnchor(pendingId:string|null,measuredId:string|null,userDragging:boolean):boolean {
 return !!pendingId&&pendingId===measuredId&&!userDragging;
}
