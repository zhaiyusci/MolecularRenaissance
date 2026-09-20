'use strict';
const assert=require('node:assert/strict'),{makeUI,rotateRing}=require('./scripts/ui-harness.cjs');
const same=(a,b)=>assert(Math.abs(Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))-1)<1e-10);
(async()=>{
 const ui=makeUI(),e=ui.elements;ui.flush();const initial=ui.calls.at(-1).options.orientation.slice();
 assert(!e['rotation-step']&&!e.yaw&&!e.pitch);
 for(const axis of ['x','y','z']){assert.equal(e['euler-'+axis].tagName,'OUTPUT');assert(!e['rotate-'+axis+'-positive']);assert.equal(e['euler-'+axis].listeners.input,undefined);assert.equal(e['euler-'+axis].listeners.change,undefined);}
 for(const event of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','mousedown','touchstart'])assert.equal(e.preview.listeners[event],undefined);
 let expected=initial,oldCount=ui.calls.length;
 for(const axis of ['x','y','z','x','y','screen']){ui.key(axis,'ArrowRight',true);expected=rotateRing(expected,axis,Math.PI/12);}
 assert(e.download.disabled);e.download.click();assert.equal(ui.calls.length,oldCount,'pending frame cannot export stale orientation');ui.flush();same(ui.calls.at(-1).options.orientation,expected);
 assert.equal(ui.calls.length,oldCount+1,'rapid ring keys coalesce rendering but preserve every rotation');
 const previous=ui.calls.at(-1).options.orientation.slice(),outputs=['x','y','z'].map(a=>e['euler-'+a].textContent),ring=ui.ring('x'),label=ring.getAttribute('aria-label');ring.focus();
 ui.locale('zh-CN');assert.deepEqual(['x','y','z'].map(a=>e['euler-'+a].textContent),outputs);same(ui.calls.at(-1).options.orientation,previous);
 assert.equal(ui.ring('x'),ring);assert.equal(ui.document.activeElement,ring);assert.notEqual(ring.getAttribute('aria-label'),label);
 e.download.click();assert.equal(ui.calls.at(-1).options.quality,'export');same(ui.calls.at(-1).options.orientation,expected);
 for(let i=0;i<72;i++)ui.key('z');ui.flush();same(ui.calls.at(-1).options.orientation,expected);
 const retained=ui.calls.at(-1).options.orientation.slice();ui.change('model','glucose');ui.flush();same(ui.calls.at(-1).options.orientation,retained);
 await ui.upload('one.xyz','1\nexample\nC 0 0 0');ui.flush();same(ui.calls.at(-1).options.orientation,retained);
 // Real mouse/touch ring drags suppress texture and block export until a full frame is restored.
 const svg=e['rotation-gizmo-svg'];
 for(const pointerType of ['mouse','touch'])for(const end of ['pointerup','pointercancel','lostpointercapture','blur']){
  const start=ui.calls.at(-1).options.orientation.slice();
  ui.pointer(ui.ring('screen'),'pointerdown',{pointerType});assert(svg.hasPointerCapture(7));ui.flush();
  assert.equal(ui.calls.at(-1).options.shadingSize,0);assert.equal(ui.calls.at(-1).options.castShadows,false);assert(e.download.disabled);
  const count=ui.calls.length;e.download.click();assert.equal(ui.calls.length,count);
  ui.pointer(svg,'pointermove',{clientX:120,clientY:20,pointerType});ui.flush();same(ui.calls.at(-1).options.orientation,rotateRing(start,'screen',Math.PI/2));
  const focused=ui.document.activeElement;ui.locale(pointerType==='mouse'?'en':'zh-CN');assert.equal(ui.document.activeElement,focused);assert(svg.hasPointerCapture(7));assert.equal(e['rotation-gizmo-svg'],svg);
  if(end==='lostpointercapture')svg.releasePointerCapture(7);else ui.pointer('window',end);
  assert(!svg.hasPointerCapture(7));ui.flush();assert(!Object.hasOwn(ui.calls.at(-1).options,'shadingSize'));assert.equal(ui.calls.at(-1).options.castShadows,true);
  assert(!e.download.disabled);e.download.click();assert.equal(ui.calls.at(-1).options.quality,'export');same(ui.calls.at(-1).options.orientation,rotateRing(start,'screen',Math.PI/2));
 }
 ui.change('fast-overlay',true);ui.flush();ui.change('shading-enabled',false);ui.flush();e.scale.value='83';e.scale.listeners.input();ui.flush();
 ui.pointer(ui.ring('screen'),'pointerdown');ui.flush();e['rotation-reset'].click();ui.flush();assert(!svg.hasPointerCapture(7));same(ui.calls.at(-1).options.orientation,initial);assert.equal(e.scale.value,'83');assert(e['fast-overlay'].checked);assert(!e['shading-enabled'].checked);assert.equal(e.model.value,'__local_xyz__');
 ui.pointer(svg,'pointermove',{clientX:120,clientY:20});assert.equal(ui.queue.length,0,'reset cancels drag');
 ui.pointer(ui.ring('screen'),'pointerdown');ui.pointer(svg,'pointermove',{clientX:120,clientY:20});ui.flush();
 e.reset.click();ui.flush();assert(!svg.hasPointerCapture(7));same(ui.calls.at(-1).options.orientation,initial);assert.equal(e.scale.value,'60');
 ui.pointer(svg,'pointermove',{clientX:20,clientY:120});assert.equal(ui.queue.length,0,'full reset also cancels active drag');
 const final=ui.calls.at(-1).options.orientation.slice();ui.key('x','Enter');assert.equal(ui.queue.length,0);same(ui.calls.at(-1).options.orientation,final);
 // Readout text is not fed back into the orientation state.
 e['euler-x'].textContent='999°';ui.key('y','ArrowLeft',true);ui.flush();same(ui.calls.at(-1).options.orientation,rotateRing(final,'y',-Math.PI/12));
 assert(!['x','y','z'].some(a=>e['euler-'+a].textContent==='-0.0°'));
 console.log('Orientation UI passed: real keyboard/pointer rings, readonly Euler, focus/capture/locale, import/model retention, full turns, snapshot export and reset cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
