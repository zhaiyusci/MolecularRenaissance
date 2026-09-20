'use strict';
// Execute the production widget, not a behavior stub. DOM-only fixture; no raster/browser dependency.
const assert=require('node:assert/strict'),api=require('./renderer.js');
const {makeUI,rotateRing}=require('./scripts/ui-harness.cjs');
const rad=d=>d*Math.PI/180;
function same(a,b,tolerance=1e-10){assert.equal(a.length,4);assert(a.every(Number.isFinite));assert(Math.abs(Math.hypot(...a)-1)<tolerance);assert(Math.abs(Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))-1)<tolerance,`different rotations: ${a} vs ${b}`);}
function different(a,b){assert(Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))<.99999);}
// Independent quaternion sandwich, used to generate physical projected pointer coordinates.
function transform(v,q){const [x,y,z,w]=q,[a,b,c]=v;return [(1-2*y*y-2*z*z)*a+(2*x*y-2*w*z)*b+(2*x*z+2*w*y)*c,(2*x*y+2*w*z)*a+(1-2*x*x-2*z*z)*b+(2*y*z-2*w*x)*c,(2*x*z-2*w*y)*a+(2*y*z+2*w*x)*b+(1-2*x*x-2*y*y)*c];}
const seed=api.orientationFromEulerXYZ([rad(32),rad(41),rad(-23)]);
function fixture(initial=seed){
 const ui=makeUI({skipApp:true});let q=initial.slice();const changes=[],interactions=[];
 const widget=ui.context.MolRotationGizmo.create({root:ui.elements['rotation-gizmo'],engine:api,getOrientation:()=>q.slice(),onChange:next=>{q=Array.from(next);changes.push(q);},onInteraction:active=>interactions.push(active)});
 const svg=ui.elements['rotation-gizmo-svg'];
 return {ui,widget,svg,changes,interactions,get q(){return q;},set q(next){q=next.slice();widget.sync();}};
}
function projected(axis,q,angle,rect){
 let p;if(axis==='screen')p=[100*Math.cos(angle),100*Math.sin(angle),0];
 else {const c=76*Math.cos(angle),s=76*Math.sin(angle);p=transform(axis==='x'?[0,c,s]:axis==='y'?[s,0,c]:[c,s,0],q);}
 const scale=Math.min(rect.width,rect.height)/240;
 return {clientX:rect.left+rect.width/2+p[0]*scale,clientY:rect.top+rect.height/2-p[1]*scale};
}
// Transparent, real vector geometry; focused rings highlight their stroke, not a white rectangle.
{
 const f=fixture(),root=f.ui.elements['rotation-gizmo'];
 assert(f.svg.style.cssText.includes('background:transparent'));
 assert(f.svg.style.cssText.includes('outline:none'));
 assert.equal(root.querySelector('img'),null);assert.equal(root.querySelector('image'),null);
 assert(!f.ui.html.includes('#e4f0ff'));assert(!f.ui.html.includes('background: #363839'));
 const hit=f.svg.querySelector('[data-axis="x"]');assert.equal(hit.style.outline,'none');
 f.widget.destroy();
}
const rectangles=[{left:0,top:0,width:240,height:240},{left:73,top:31,width:120,height:120},{left:-50,top:250,width:480,height:480},{left:29,top:17,width:480,height:240},{left:140,top:70,width:120,height:300}];
for(const rect of rectangles)for(const axis of ['x','y','z','screen']){
 const f=fixture(),{ui,svg,widget}=f;svg.rect=rect;
 const hit=ui.ring(axis);hit.focus();const nodes=svg.querySelectorAll('path').slice();
 const start=seed.slice();ui.pointer(hit,'pointerdown',projected(axis,start,.4,rect));
 assert(svg.hasPointerCapture(7));assert.equal(ui.document.activeElement,hit);
 // Cross the +/-pi branch cut and complete TWO turns without losing accumulation.
 for(let i=1;i<=144;i++){
  const angle=i*Math.PI/36;
  ui.pointer(svg,'pointermove',projected(axis,start,.4+angle,rect));
  same(f.q,rotateRing(start,axis,angle));widget.sync();assert(svg.hasPointerCapture(7));assert.equal(ui.document.activeElement,hit);
 }
 same(f.q,start);assert.deepEqual(svg.querySelectorAll('path'),nodes,'sync updates attributes rather than remounting focused/captured SVG');
 ui.pointer(svg,'pointerup');assert(!svg.hasPointerCapture(7));assert.deepEqual(f.interactions,[true,false]);
 for(const path of svg.querySelectorAll('path'))assert(!/NaN|Infinity|undefined/.test(path.getAttribute('d')));
 widget.destroy();assert(!ui.elements['rotation-gizmo'].contains(svg));
}
// Local axes are postmultiplication, the outer ring is camera/world Z premultiplication.
{
 const f=fixture();for(const axis of ['x','y','z','screen'])for(const shift of [false,true])for(const key of ['ArrowLeft','ArrowRight']){
  f.q=seed;f.ui.key(axis,key,shift);const angle=rad(shift?15:5)*(key==='ArrowLeft'?-1:1);same(f.q,rotateRing(seed,axis,angle));
  if(axis==='screen')different(f.q,rotateRing(seed,'z',angle));else different(f.q,api.rotateOrientation(seed,axis,angle));
 }
 const before=f.q.slice(),count=f.changes.length;
 for(const extra of [{key:'Enter'},{key:'ArrowUp'},{key:'ArrowRight',ctrlKey:true},{key:'ArrowRight',altKey:true},{key:'ArrowRight',metaKey:true}])f.ui.ring('x').dispatchEvent({type:'keydown',bubbles:true,...extra});
 same(f.q,before);assert.equal(f.changes.length,count);f.widget.destroy();
}
// Reject right/middle buttons, non-primary pointers, center hits and unrelated targets.
{
 const f=fixture(),{ui,svg}=f;
 for(const extra of [{button:1},{button:2},{isPrimary:false},{clientX:120,clientY:120}])ui.pointer(ui.ring('screen'),'pointerdown',extra);
 ui.pointer(svg,'pointerdown');assert.equal(f.interactions.length,0);same(f.q,seed);
 ui.pointer(ui.ring('screen'),'pointerdown');ui.pointer(ui.ring('x'),'pointerdown',{pointerId:8});
 ui.pointer(svg,'pointermove',{pointerId:8,clientX:120,clientY:20});ui.pointer('window','pointerup',{pointerId:8});ui.pointer('window','pointercancel',{pointerId:8});ui.pointer(svg,'lostpointercapture',{pointerId:8});
 assert(svg.hasPointerCapture(7));same(f.q,seed);ui.key('y');same(f.q,seed);
 ui.pointer(svg,'pointermove',{clientX:120,clientY:20});same(f.q,rotateRing(seed,'screen',Math.PI/2));assert.deepEqual(f.interactions,[true]);
 ui.pointer('window','pointerup');assert.deepEqual(f.interactions,[true,false]);f.widget.destroy();
}
// Every termination is idempotent, releases capture, and makes subsequent moves inert.
for(const end of ['pointerup','pointercancel','lostpointercapture','blur','buttons-zero','cancel','destroy']){
 const f=fixture(),{ui,svg,widget}=f;ui.pointer(ui.ring('screen'),'pointerdown',{pointerType:'touch'});ui.pointer(svg,'pointermove',{clientX:120,clientY:20,pointerType:'touch'});const q=f.q.slice();
 if(end==='cancel'||end==='destroy')widget[end]();else if(end==='lostpointercapture')svg.releasePointerCapture(7);else if(end==='buttons-zero')ui.pointer(svg,'pointermove',{buttons:0});else ui.pointer('window',end);
 assert(!svg.hasPointerCapture(7));assert.deepEqual(f.interactions,[true,false]);widget.cancel();ui.pointer(svg,'pointermove',{clientX:20,clientY:120});same(f.q,q);assert.deepEqual(f.interactions,[true,false]);
 widget.destroy();assert(!svg.listeners.pointerdown&&!svg.listeners.pointermove&&!svg.listeners.keydown);assert(!ui.windowListeners.pointerup&&!ui.windowListeners.pointercancel&&!ui.windowListeners.blur);widget.destroy();
}
// Edge-on local planes must respond smoothly, remain unit/finite and never amplify to a flip.
for(const axis of ['x','y'])for(const tilt of [0,1e-9,1e-4,.05])for(const rect of rectangles.slice(0,3)){
 const initial=api.orientationFromEulerXYZ([tilt,tilt,0]),f=fixture(initial),{ui,svg}=f;svg.rect=rect;
 const point=projected(axis,initial,Math.PI/4,rect),scale=rect.width/240;
 ui.pointer(ui.ring(axis),'pointerdown',point);let previous=f.q.slice();
 for(let i=1;i<=30;i++){
  ui.pointer(svg,'pointermove',{clientX:point.clientX+(axis==='y'?i:0)*scale,clientY:point.clientY+(axis==='x'?i:0)*scale});
  same(f.q,f.q);const dot=Math.abs(f.q.reduce((s,v,j)=>s+v*previous[j],0));assert(dot>.999,'edge-on small pixel steps stay smooth');previous=f.q.slice();
  for(const path of svg.querySelectorAll('path'))assert(!/NaN|Infinity/.test(path.getAttribute('d')));
 }
 different(f.q,initial);ui.pointer('window','pointercancel');f.widget.destroy();
}
// Crossing the center deadzone cannot introduce a spurious half-turn.
{
 const f=fixture(),{ui,svg}=f;ui.pointer(ui.ring('screen'),'pointerdown');ui.pointer(svg,'pointermove',{clientX:120,clientY:120});ui.pointer(svg,'pointermove',{clientX:20,clientY:120});same(f.q,seed);
 ui.pointer(svg,'pointermove',{clientX:120,clientY:220});same(f.q,rotateRing(seed,'screen',Math.PI/2));f.widget.destroy();
}
console.log('Gizmo passed: real widget, CSS-scaled/letterboxed drags, two full turns, local/world math, keys, singular planes, deadzone, capture/focus, pointer filtering and cleanup.');
