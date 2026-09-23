'use strict';
const assert=require('node:assert/strict');
const {makeUI,rotateRing}=require('./scripts/ui-harness.cjs');
const {examples,rotateOrientation,orientationToEulerXYZ}=require('./renderer.js');
const radians=degrees=>degrees*Math.PI/180;
const initialOrientation=()=>rotateOrientation(rotateOrientation([0,0,0,1],'y',radians(25)),'x',radians(-15));
function nearQuaternion(actual,expected){assert.equal(actual.length,4);actual.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-12,`quaternion component ${i}`));}
const baseModels=JSON.stringify(examples);
let fail=null;
const calls=[],blobs=[],links=[],timers=[],revoked=[],captures=new Set();
const ui=makeUI({browserLanguage:'zh-CN',configureContext(context){
 context.MolEngraver.render=(model,options)=>{
  calls.push({model,options:JSON.parse(JSON.stringify(options))});
  if(fail===options.quality)throw new Error('test failure');
  return `<svg data-quality="${options.quality}"><title></title><circle/>mark-${calls.length}</svg>`;
 };
 context.XMLSerializer=class{constructor(){throw new Error('UI must not serialize preview DOM');}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.options=options;blobs.push(this);}};
 context.URL={createObjectURL:()=>`blob:${blobs.length}`,revokeObjectURL:url=>revoked.push(url)};
 context.setTimeout=f=>timers.push(f);
 const create=context.document.createElement;
 context.document.createElement=tag=>{
  const el=create(tag);
  if(tag==='a'){const click=el.click.bind(el),remove=el.remove.bind(el);el.click=()=>{links.push(el);click();};el.remove=()=>{el.removed=true;remove();};}
  return el;
 };
}});
const {html,elements,document,flush,windowListeners,queue}=ui;
elements.preview.setPointerCapture=id=>captures.add(id);
elements.preview.hasPointerCapture=id=>captures.has(id);
elements.preview.releasePointerCapture=id=>captures.delete(id);
const viewportCSS=html.match(/#preview\s*\{([^}]+)\}/)[1];
const svgCSS=html.match(/#preview svg\s*\{([^}]+)\}/)[1];
assert.match(viewportCSS,/display:\s*flex;/,'viewport distributes spare space without scaling');
assert.match(svgCSS,/flex:\s*0\s+0\s+auto;/,'SVG never flex-shrinks');
assert.match(svgCSS,/margin:\s*auto;/,'auto margins center when there is space and become zero on overflow');
assert.equal(document.title,'分子文艺复兴');
assert.equal(document.querySelector('h1').textContent,'分子文艺复兴');
ui.locale('en');assert.equal(document.title,'Molecular Renaissance');
assert.equal(document.querySelector('h1').textContent,'Molecular Renaissance');
ui.locale('zh-CN');
assert.match(viewportCSS,/overflow:\s*auto;/,'responsive viewport scrolls instead of shrinking SVG');
assert.match(viewportCSS,/aspect-ratio:\s*9\s*\/\s*7;/);
assert.doesNotMatch(viewportCSS,/place-items:\s*center/);
assert.doesNotMatch(viewportCSS,/cursor:\s*grabb?ing|cursor:\s*grab\b|touch-action:\s*none/,'preview remains a scrolling viewport, not a drag surface');
assert.doesNotMatch(html,/#preview\.dragging\b/);
for(const property of ['width','height']){
 assert.match(svgCSS,new RegExp('(?:^|;)\\s*'+property+':\\s*auto;'),'SVG keeps intrinsic dimensions');
 assert.match(svgCSS,new RegExp('max-'+property+':\\s*none;'),'SVG must not auto-fit viewport');
}
function change(id,value,event='input'){elements[id].value=value;elements[id].listeners[event]();}
function check(id,value){elements[id].checked=value;elements[id].listeners.change();}
function click(){elements.download.listeners.click();}
function restored(texture){assert.ok(!Object.hasOwn(calls.at(-1).options,'shadingSize'),'normal frames restore shading instead of passing legacy shadingSize');assert.equal(calls.at(-1).options.textureScale,texture);assert.equal(calls.at(-1).options.castShadows,true);}
click();assert.equal(calls.length,0,'no export before first preview');
flush();assert.equal(calls.at(-1).options.quality,'preview');
assert.equal(calls.at(-1).options.scale,60);
assert.match(html,/id="scale"[^>]*min="20"[^>]*max="200"[^>]*value="60"/);
assert.equal(calls.at(-1).options.atomRadiusScale,.75);
assert.equal(elements['atom-radius-scale-value'].textContent,'0.75×');
assert.match(html,/id="atom-radius-scale"[^>]*type="range"[^>]*min="0.2"[^>]*max="2"[^>]*step="0.05"[^>]*value="0.75"/);
assert.equal(document.querySelector('[data-i18n="static.atomRadius"]').textContent,ui.context.MolI18n.t('static.atomRadius'));
function verifyDownload(){
 const previewCall=calls.at(-1),display=elements.preview.innerHTML,previous=blobs.length;
 click();const exported=calls.at(-1);
 assert.equal(exported.options.quality,'export');assert.deepEqual(exported.model,previewCall.model);
 assert.equal(exported.model.atoms,previewCall.model.atoms,'localized model copies retain scientific geometry');
 assert.equal(exported.options.atomRadiusScale,Number(elements['atom-radius-scale'].value));
 assert.deepEqual(exported.options,{...previewCall.options,quality:'export'});
 assert.equal(blobs.length,previous+1);assert.match(blobs.at(-1).parts.join(''),/data-quality="export"/);assert.doesNotMatch(blobs.at(-1).parts.join(''),/data-quality="preview"/);
 assert.equal(blobs.at(-1).options.type,'image/svg+xml;charset=utf-8');
 assert.equal(elements.preview.innerHTML,display);assert.equal(elements.download.disabled,false);
 assert.ok(links.at(-1).download.endsWith('.svg'));assert.ok(links.at(-1).removed);
}
assert.equal(calls.at(-1).options.quantizeShading,true);
assert(elements['quantized-shading'].checked);verifyDownload();
assert.equal(document.querySelector('[data-i18n="static.quantizedShading"]').textContent,'16级明暗');
ui.locale('en');
assert.equal(document.querySelector('[data-i18n="static.quantizedShading"]').textContent,'16-level shading');
ui.locale('zh-CN');
for(const mode of ['hatch','stipple','halftone']){
 change('shading-mode',mode,'change');flush();
 assert(!elements['quantized-shading'].disabled);
 for(const preference of [false,true,false]){
  check('quantized-shading',preference);
  assert(elements.download.disabled,'checkbox change invalidates the export snapshot');
  const beforePreview=calls.length;click();assert.equal(calls.length,beforePreview);
  flush();assert.equal(calls.at(-1).options.quantizeShading,preference);verifyDownload();
  // Export uses the successful preview snapshot, not an unannounced checkbox edit.
  elements['quantized-shading'].checked=!preference;click();assert.equal(calls.at(-1).options.quantizeShading,preference);
  elements['quantized-shading'].checked=preference;
 }
}
change('shading-mode','hatch','change');flush();
nearQuaternion(calls.at(-1).options.orientation,initialOrientation());
assert.equal(elements.yaw,undefined);assert.equal(elements.pitch,undefined);
assert.equal(elements['rotation-step'],undefined,'obsolete step selector removed');
assert(elements['rotation-gizmo-svg']);
function verifyEuler(){
 const angles=orientationToEulerXYZ(calls.at(-1).options.orientation);
 for(const [i,axis] of ['x','y','z'].entries()){
  const output=elements['euler-'+axis];assert.equal(output.tagName,'OUTPUT');
  assert.equal(output.listeners.input,undefined);assert.equal(output.listeners.change,undefined);
  assert.ok(Math.abs(parseFloat(output.textContent)-angles[i]*180/Math.PI)<=.051,'Euler outputs calculated from current quaternion');
 }
 assert.equal(Object.hasOwn(calls.at(-1).options,'yaw'),false);assert.equal(Object.hasOwn(calls.at(-1).options,'pitch'),false);
}
verifyEuler();verifyDownload();
for(const step of [5,15])for(const axis of ['x','y','z','screen'])for(const direction of [-1,1]){
 const previous=calls.at(-1).options.orientation.slice();
 ui.key(axis,direction===1?'ArrowRight':'ArrowLeft',step===15);flush();
 nearQuaternion(calls.at(-1).options.orientation,rotateRing(previous,axis,radians(step)*direction));
 restored(1);verifyEuler();verifyDownload();
}
change('atom-radius-scale','0.65');flush();assert.equal(calls.at(-1).options.atomRadiusScale,.65);assert.equal(calls.at(-1).options.scale,60);verifyDownload();
change('scale','95');ui.key('y','ArrowRight',true);change('shading-brightness','25');change('texture-scale','125');
const before=calls.length;click();assert.equal(calls.length,before,'pending preview blocks stale export');
flush();assert.equal(calls.at(-1).options.shadingBrightness,.25);restored(1.25);verifyDownload();
change('model','ethanol','change');change('shading-mode','halftone','change');change('color-scheme','rasmol','change');flush();verifyDownload();
assert.equal(links.at(-1).download,'mol-ethanol.svg');
assert.equal(calls.at(-1).options.scale,95);assert.equal(calls.at(-1).options.atomRadiusScale,.65);
// Orientation reset must not reset any non-orientation render parameters.
const beforeOrientationReset=calls.at(-1).options;
elements['rotation-reset'].click();flush();
nearQuaternion(calls.at(-1).options.orientation,initialOrientation());
assert.deepEqual({...calls.at(-1).options,orientation:null,quality:null},{...beforeOrientationReset,orientation:null,quality:null});
verifyEuler();verifyDownload();
// Unannounced DOM edits cannot contaminate the last successful render snapshot.
const savedOrientation=calls.at(-1).options.orientation.slice();
elements.scale.value='150';elements['euler-x'].textContent='123°';
click();assert.equal(calls.at(-1).options.scale,95);nearQuaternion(calls.at(-1).options.orientation,savedOrientation);
elements.scale.value='95';
fail='export';const count=links.length,display=elements.preview.innerHTML;click();
assert.equal(links.length,count);assert.equal(elements.error.hidden,false);assert.match(elements.error.textContent,/导出失败/);assert.equal(elements.preview.innerHTML,display);assert.equal(elements.download.disabled,false);
ui.locale('en');assert.match(elements.error.textContent,/Export failed/i);ui.locale('zh-CN');
fail=null;verifyDownload();assert.equal(elements.error.hidden,true);
fail='preview';ui.key('x','ArrowRight',true);flush();assert.equal(elements.download.disabled,true);
const failed=calls.length;click();assert.equal(calls.length,failed,'failed preview invalidates old snapshot');
fail=null;ui.key('x','ArrowRight',true);flush();verifyDownload();
function pointer(target,name,extra={}){(target==='window'?windowListeners[name]:elements[target].listeners[name])?.({button:0,pointerId:7,clientX:100,clientY:100,preventDefault(){},...extra});}
function suppressed(){assert.equal(calls.at(-1).options.shadingSize,0);assert.equal(calls.at(-1).options.castShadows,false);assert.equal(elements.download.disabled,true);}
for(const mode of ['hatch','stipple','halftone']){
 change('shading-mode',mode,'change');flush();const timerCount=timers.length,n=calls.length,orientation=calls.at(-1).options.orientation.slice();
 for(const event of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','mousedown','mousemove','mouseup','touchstart','touchmove','touchend']){
  assert.equal(elements.preview.listeners[event],undefined,`preview has no ${event} drag handler`);
  pointer('preview',event,{clientX:140,clientY:120});
 }
 assert.equal(queue.length,0,'preview gestures never schedule a render');assert.equal(calls.length,n);assert.equal(captures.size,0);
 nearQuaternion(calls.at(-1).options.orientation,orientation);
 ui.key('z','ArrowRight',true);assert.equal(queue.length,1);flush();restored(1.25);
 nearQuaternion(calls.at(-1).options.orientation,rotateRing(orientation,'z',radians(15)));
 assert.equal(calls.at(-1).options.shadingMode,mode);
 assert.equal(calls.at(-1).options.scale,95);assert.equal(calls.at(-1).options.atomRadiusScale,.65);
 assert.equal(timers.length,timerCount);verifyDownload();
}
for(const [id,value,option,expected,output] of [['scale','120','scale',120,'120'],['atom-radius-scale','1.35','atomRadiusScale',1.35,'1.35×'],['texture-scale','80','textureScale',.8,'0.80×'],['light-azimuth','90','lightAzimuth',Math.PI/2,'90°'],['light-elevation','45','lightElevation',Math.PI/4,'45°'],['shading-brightness','30','shadingBrightness',.3,'+30'],['shading-contrast','2','shadingContrast',2,'2.0']]){
 const timerCount=timers.length;
 pointer(id,'pointerdown');change(id,value);flush();suppressed();assert.equal(calls.at(-1).options[option],expected);assert.equal(elements[id+'-value'].textContent,output);
 const n=calls.length;click();assert.equal(calls.length,n,'slider drag cannot export lightweight frames');
 pointer('window','pointerup',{pointerId:99});assert.equal(queue.length,0);
 pointer('window','pointerup');assert.equal(queue.length,1);flush();restored(Number(elements['texture-scale'].value)/100);
 assert.equal(calls.at(-1).options[option],expected);assert.equal(timers.length,timerCount);verifyDownload();
}
assert.equal(calls.at(-1).options.scale,120);assert.equal(calls.at(-1).options.atomRadiusScale,1.35);
for(const id of ['point-light','light-distance','light-distance-value','light-attenuation','light-attenuation-value'])assert.equal(elements[id],undefined);
for(const option of ['lightType','lightDistance','lightAttenuation'])assert(calls.every(call=>!Object.hasOwn(call.options,option)));
for(const id of ['scale','atom-radius-scale','light-azimuth','light-elevation','shadow-strength','texture-scale'])for(const [target,event] of [['window','pointercancel'],[id,'lostpointercapture'],['window','blur']]){
 pointer(id,'pointerdown');flush();suppressed();pointer(target,event);flush();restored(.8);assert.equal(calls.at(-1).options.atomRadiusScale,1.35);
}
check('shading-enabled',false);flush();pointer('scale','pointerdown');flush();pointer('window','pointerup');flush();
assert.equal(calls.at(-1).options.shadingSize,0,'release preserves intentionally disabled shading');assert.equal(calls.at(-1).options.textureScale,.8);verifyDownload();
pointer('scale','pointerdown');flush();elements.reset.listeners.click();flush();restored(1);
assert(elements['quantized-shading'].checked);assert.equal(calls.at(-1).options.quantizeShading,true);
change('shading-mode','stipple','change');flush();
assert(!elements['quantized-shading'].disabled);assert.equal(calls.at(-1).options.quantizeShading,true);verifyDownload();
assert(calls.every(call=>!Object.hasOwn(call.options,'hatchMode')));
nearQuaternion(calls.at(-1).options.orientation,initialOrientation());
assert.equal(elements['rotation-step'],undefined);
assert.equal(calls.at(-1).options.scale,60);assert.equal(elements.scale.value,'60');assert.equal(elements['scale-value'].textContent,'60');
assert.equal(calls.at(-1).options.atomRadiusScale,.75);assert.equal(elements['atom-radius-scale'].value,'0.75');assert.equal(elements['atom-radius-scale-value'].textContent,'0.75×');verifyDownload();
(async()=>{
 for(const [name,expected] of [['../CON:<bad>|?.xyz','mol-CON--bad.svg'],['... .xyz','mol-molecule.svg'],['ＡＵＸ.xyz','mol-AUX.svg'],['x'.repeat(100)+'.xyz','mol-'+ 'x'.repeat(72)+'.svg']]){
  await ui.upload(name,'1\nfixture\nC 0 0 0\n');flush();verifyDownload();assert.equal(links.at(-1).download,expected,'sanitize local filenames');
 }
 assert.equal(JSON.stringify(examples),baseModels,'UI never rewrites scientific radii, centers or bonds');
 assert.ok(calls.every(call=>typeof call.options.atomRadiusScale==='number'));
 timers.forEach(f=>f());assert.equal(revoked.length,links.length);
 console.log('PASS localized preview/export, lightweight interactions, snapshot recovery, safe filenames and immutable examples');
})().catch(error=>{console.error(error);process.exitCode=1;});
