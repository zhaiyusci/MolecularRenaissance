'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {examples}=require('./renderer.js');
const baseModels=JSON.stringify(examples);
const html=fs.readFileSync('index.html','utf8'),elements={};
const viewportCSS=html.match(/#preview\s*\{([^}]+)\}/)[1];
const svgCSS=html.match(/#preview svg\s*\{([^}]+)\}/)[1];
assert.match(viewportCSS,/display:\s*flex;/,'viewport distributes spare space without scaling');
assert.match(svgCSS,/flex:\s*0\s+0\s+auto;/,'SVG never flex-shrinks');
assert.match(svgCSS,/margin:\s*auto;/,'auto margins center when there is space and become zero on overflow');
assert.match(html,/<title>分子文艺复兴 · Molecular Renaissance<\/title>/);
assert.match(html,/<h1>分子文艺复兴<\/h1>/);
assert.match(html,/<p lang="en">Molecular Renaissance<\/p>/);
assert.match(viewportCSS,/overflow:\s*auto;/,'responsive viewport scrolls instead of shrinking SVG');
assert.match(viewportCSS,/aspect-ratio:\s*9\s*\/\s*7;/);
assert.doesNotMatch(viewportCSS,/place-items:\s*center/);
for(const property of ['width','height']) {
 assert.match(svgCSS,new RegExp('(?:^|;)\\s*'+property+':\\s*auto;'),'SVG keeps intrinsic dimensions');
 assert.match(svgCSS,new RegExp('max-'+property+':\\s*none;'),'SVG must not auto-fit viewport');
}
for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
 const tag=m[0];elements[m[1]]={value:(tag.match(/\bvalue="([^"]*)"/)||[])[1]||'',checked:/\bchecked\b/.test(tag),disabled:/\bdisabled\b/.test(tag),listeners:{},textContent:'',addEventListener(e,f){this.listeners[e]=f;},appendChild(o){if(!this.value)this.value=o.value;}};
}
for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
 const first=m[2].match(/<option\b[^>]*value="([^"]+)"/);if(first)elements[m[1]].value=first[1];
}
elements.preview.querySelector=()=>({hasAttribute:()=>true,setAttribute(){}});
let queued,fail=null,calls=[],blobs=[],links=[],timers=[],revoked=[];
const windowListeners={},captures=new Set();
elements.preview.classList={add(){},remove(){}};
elements.preview.setPointerCapture=id=>captures.add(id);
elements.preview.hasPointerCapture=id=>captures.has(id);
elements.preview.releasePointerCapture=id=>captures.delete(id);
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
 document:{getElementById:id=>elements[id],body:{appendChild(){}},createElement:tag=>tag==='a'?{click(){links.push(this);},remove(){this.removed=true;}}:{}},
 window:{addEventListener:(name,fn)=>{windowListeners[name]=fn;},MolEngraver:{examples,render(model,options){calls.push({model,options:JSON.parse(JSON.stringify(options))});if(fail===options.quality)throw new Error('test failure');return `<svg data-quality="${options.quality}">mark-${calls.length}</svg>`;}}},
 requestAnimationFrame:f=>{queued=f;return 1;},performance:{now:()=>0},
 XMLSerializer:class{constructor(){throw new Error('UI must not serialize preview DOM');}},
 Blob:class{constructor(parts,options){this.parts=parts;this.options=options;blobs.push(this);}},
 URL:{createObjectURL:()=>`blob:${blobs.length}`,revokeObjectURL:url=>revoked.push(url)},setTimeout:f=>timers.push(f)
});
function flush(){assert.ok(queued);const fn=queued;queued=null;fn();}
function change(id,value,event='input'){elements[id].value=value;elements[id].listeners[event]();}
function click(){elements.download.listeners.click();}
click();assert.equal(calls.length,0,'no export before first preview');
flush();assert.equal(calls.at(-1).options.quality,'preview');
assert.equal(calls.at(-1).options.scale,60,'initial physical scale is fixed at 60 SVG units/angstrom');
assert.match(html, /id="scale"[^>]*min="20"[^>]*max="200"[^>]*value="60"/);
assert.equal(calls.at(-1).options.atomRadiusScale,1,'initial atom radius multiplier is exactly one');
assert.equal(elements['atom-radius-scale-value'].textContent,'1.00×');
assert.match(html, /id="atom-radius-scale"[^>]*type="range"[^>]*min="0.2"[^>]*max="2"[^>]*step="0.05"[^>]*value="1"/);
assert.match(html, /<label for="atom-radius-scale">原子半径倍率<\/label>/);
assert.match(html, /整图比例（SVG 单位\/Å）/);
function verifyDownload(){
 const previewCall=calls.at(-1),display=elements.preview.innerHTML,previous=blobs.length;
 click();const exported=calls.at(-1);
 assert.equal(exported.options.quality,'export');assert.equal(exported.model,previewCall.model);
 assert.equal(exported.options.atomRadiusScale,Number(elements['atom-radius-scale'].value),'export uses the manual atom radius multiplier');
 const expected={...previewCall.options,quality:'export'};assert.deepEqual(exported.options,expected);
 assert.equal(blobs.length,previous+1);assert.ok(blobs.at(-1).parts.join('').includes('data-quality="export"'));assert.ok(!blobs.at(-1).parts.join('').includes('data-quality="preview"'));
 assert.equal(elements.preview.innerHTML,display,'export leaves preview untouched');assert.equal(elements.download.disabled,false);
 assert.ok(links.at(-1).download.endsWith('.svg'));assert.ok(links.at(-1).removed);
}
verifyDownload();
change('atom-radius-scale','0.65');flush();
assert.equal(calls.at(-1).options.atomRadiusScale,.65,'manual multiplier reaches preview');
assert.equal(calls.at(-1).options.scale,60,'radius multiplier does not change whole drawing scale');
verifyDownload();
change('scale','95');change('yaw','80');change('shading-density','165');change('shading-size','125');
const before=calls.length;click();assert.equal(calls.length,before,'pending preview blocks stale export');
flush();assert.equal(calls.at(-1).options.shadingDensity,1.65);verifyDownload();
change('model','ethanol','change');change('shading-mode','halftone','change');change('color-mode','ink','change');flush();verifyDownload();
assert.equal(links.at(-1).download,'mol-ethanol.svg');
assert.equal(calls.at(-1).options.scale,95,'model/shading changes and export preserve manual scale');
assert.equal(calls.at(-1).options.atomRadiusScale,.65,'model/shading changes and export preserve manual radius multiplier');
fail='export';const count=links.length,display=elements.preview.innerHTML;click();
assert.equal(links.length,count);assert.equal(elements.error.hidden,false);assert.match(elements.error.textContent,/导出失败/);assert.equal(elements.preview.innerHTML,display);assert.equal(elements.download.disabled,false,'export can be retried');
fail=null;verifyDownload();
fail='preview';change('pitch','20');flush();assert.equal(elements.download.disabled,true);
const failed=calls.length;click();assert.equal(calls.length,failed,'failed preview invalidates old snapshot');
fail=null;change('pitch','21');flush();verifyDownload();
function pointer(target,name,extra={}){
 const event={button:0,pointerId:7,clientX:100,clientY:100,preventDefault(){},...extra};
 (target==='window'?windowListeners[name]:elements[target].listeners[name])(event);
}
for(const mode of ['hatch','stipple','halftone']){
 change('shading-mode',mode,'change');flush();
 const size=Number(elements['shading-size'].value)/100,timerCount=timers.length;
 pointer('preview','pointerdown');flush();
 assert.equal(calls.at(-1).options.shadingSize,0);assert.equal(elements.download.disabled,true);
 const n=calls.length;click();assert.equal(calls.length,n,'temporary unshaded frame cannot be exported');
 pointer('preview','pointermove',{clientX:140,clientY:120});flush();
 assert.equal(calls.at(-1).options.shadingSize,0);assert.equal(calls.at(-1).options.shadingMode,mode);
 assert.equal(calls.at(-1).options.scale,95,'rotation never auto-fits scale');
 assert.equal(calls.at(-1).options.atomRadiusScale,.65,'rotation never auto-adjusts atom radii');
 pointer('preview','pointerup',{pointerId:99});assert.equal(queued,null,'another pointer must not finish the drag');
 pointer('preview','pointerup');assert.ok(queued,'release queues full render immediately');flush();
 assert.equal(calls.at(-1).options.shadingSize,size);assert.equal(timers.length,timerCount,'no interaction delay timer');
 verifyDownload();
}
// Manual scale slider uses the same no-delay interaction path and export value.
const scaleTimerCount=timers.length;
pointer('scale','pointerdown');change('scale','120');flush();
assert.equal(calls.at(-1).options.scale,120);assert.equal(calls.at(-1).options.shadingSize,0);
assert.equal(elements['scale-value'].textContent,'120');
pointer('window','pointerup');flush();
assert.equal(calls.at(-1).options.scale,120);assert.equal(calls.at(-1).options.shadingSize,1.25);
assert.equal(timers.length,scaleTimerCount,'scale drag has no delay timer');verifyDownload();
assert.equal(calls.at(-1).options.atomRadiusScale,.65,'whole drawing scale does not change radius multiplier');
// Radius slider renders lightweight frames immediately and restores texture on release.
const radiusTimerCount=timers.length;
pointer('atom-radius-scale','pointerdown');change('atom-radius-scale','1.35');flush();
assert.equal(calls.at(-1).options.atomRadiusScale,1.35);
assert.equal(calls.at(-1).options.scale,120);assert.equal(calls.at(-1).options.shadingSize,0);
assert.equal(elements['atom-radius-scale-value'].textContent,'1.35×');
const radiusDragCalls=calls.length;click();assert.equal(calls.length,radiusDragCalls,'radius drag cannot export an unshaded frame');
pointer('window','pointerup');assert.ok(queued,'radius release queues restoration immediately');flush();
assert.equal(calls.at(-1).options.atomRadiusScale,1.35);assert.equal(calls.at(-1).options.shadingSize,1.25);
assert.equal(timers.length,radiusTimerCount,'radius drag has no delay timer');verifyDownload();
for(const [target,event] of [['window','pointercancel'],['atom-radius-scale','lostpointercapture'],['window','blur']]){
 pointer('atom-radius-scale','pointerdown');flush();assert.equal(calls.at(-1).options.shadingSize,0);
 pointer(target,event);flush();assert.equal(calls.at(-1).options.shadingSize,1.25);
 assert.equal(calls.at(-1).options.atomRadiusScale,1.35);
}
// Native slider drag, including release outside its element.
const timerCount=timers.length;
pointer('shading-size','pointerdown');change('shading-size','75');flush();
assert.equal(calls.at(-1).options.shadingSize,0);assert.equal(elements['shading-size'].value,'75');
change('shading-size','80');flush();assert.equal(calls.at(-1).options.shadingSize,0);
pointer('window','pointerup');assert.ok(queued);flush();assert.equal(calls.at(-1).options.shadingSize,.8);
assert.equal(timers.length,timerCount);verifyDownload();
for(const event of ['pointercancel','lostpointercapture']){
 pointer('preview','pointerdown');flush();pointer('preview',event);flush();assert.equal(calls.at(-1).options.shadingSize,.8);
}
pointer('yaw','pointerdown');flush();pointer('window','pointercancel');flush();assert.equal(calls.at(-1).options.shadingSize,.8);
pointer('yaw','pointerdown');flush();pointer('yaw','lostpointercapture');flush();assert.equal(calls.at(-1).options.shadingSize,.8);
pointer('preview','pointerdown');flush();windowListeners.blur();flush();assert.equal(calls.at(-1).options.shadingSize,.8);
pointer('yaw','pointerdown');flush();windowListeners.blur();flush();assert.equal(calls.at(-1).options.shadingSize,.8);
change('shading-size','0');flush();pointer('preview','pointerdown');flush();pointer('preview','pointerup');flush();assert.equal(calls.at(-1).options.shadingSize,0,'release preserves an intentionally unshaded setting');
verifyDownload();
pointer('preview','pointerdown');flush();elements.reset.listeners.click();flush();
assert.equal(calls.at(-1).options.shadingSize,1,'reset clears active drag and restores configured texture');
assert.equal(calls.at(-1).options.scale,60,'reset restores fixed default scale');
assert.equal(elements.scale.value,'60');assert.equal(elements['scale-value'].textContent,'60');
assert.equal(calls.at(-1).options.atomRadiusScale,1,'reset restores radius multiplier to one');
assert.equal(elements['atom-radius-scale'].value,'1');assert.equal(elements['atom-radius-scale-value'].textContent,'1.00×');
verifyDownload();
assert.equal(JSON.stringify(examples),baseModels,'UI never rewrites scientific radii, centers or bonds');
assert.ok(calls.every(call=>typeof call.options.atomRadiusScale==='number'),'every preview/export explicitly passes atomRadiusScale');
timers.forEach(f=>f());assert.equal(revoked.length,links.length);
console.log('PASS preview/export, no-delay lightweight drags/sliders, cancellation, settings, full downloads and recovery');
