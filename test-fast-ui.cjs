'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),elements={},calls=[];
for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
  const tag=m[0];elements[m[1]]={value:tag.match(/\bvalue="([^"]*)"/)?.[1]||'',checked:/\bchecked\b/.test(tag),disabled:/\bdisabled\b/.test(tag),listeners:{},textContent:'',addEventListener(e,f){this.listeners[e]=f;},appendChild(o){if(!this.value)this.value=o.value;}};
}
for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))elements[m[1]].value=m[2].match(/<option\b[^>]*value="([^"]+)"/)?.[1]||'';
elements.preview.classList={add(){},remove(){}};
elements.preview.querySelector=()=>({hasAttribute:()=>true,setAttribute(){}});
elements.preview.setPointerCapture=()=>{};elements.preview.hasPointerCapture=()=>false;elements.preview.releasePointerCapture=()=>{};
let queued;const examples=require('./renderer.js').examples;
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
  document:{getElementById:id=>elements[id],body:{appendChild(){}},createElement:tag=>tag==='a'?{click(){},remove(){}}:{}},
  window:{addEventListener(){},MolEngraver:{examples,render(model,options){calls.push(JSON.parse(JSON.stringify(options)));return '<svg></svg>';}}},
  requestAnimationFrame:fn=>{queued=fn;return 1;},performance:{now:()=>0},Blob:class{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout(){}
});
function flush(){assert(queued);const fn=queued;queued=null;fn();}
function check(id,value){elements[id].checked=value;elements[id].listeners.change();flush();}
flush();assert.equal(calls.at(-1).renderMode,'precise');
check('point-light',true);assert.equal(calls.at(-1).lightType,'point');assert.equal(calls.at(-1).castShadows,true);
check('fast-overlay',true);
assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).lightType,'directional');assert.equal(calls.at(-1).castShadows,false);
assert(elements['point-light'].disabled&&elements['cast-shadows'].disabled);
assert.match(elements['render-mode-status'].textContent,/快速覆盖.*已启用/);
for(const mode of ['hatch','stipple','halftone']){
  elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();flush();
  assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).shadingMode,mode);
  elements.download.listeners.click();assert.equal(calls.at(-1).quality,'export');assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).castShadows,false);
}
check('fast-overlay',false);
assert.equal(calls.at(-1).renderMode,'precise');assert.equal(calls.at(-1).lightType,'point');assert.equal(calls.at(-1).castShadows,true);
assert(!elements['point-light'].disabled&&!elements['cast-shadows'].disabled);
check('fast-overlay',true);elements.reset.listeners.click();flush();
assert(!elements['fast-overlay'].checked);assert.equal(calls.at(-1).renderMode,'precise');assert.equal(calls.at(-1).lightType,'directional');assert.equal(calls.at(-1).castShadows,true);
console.log('Fast UI checks passed: all modes, constraints, preference restoration, export snapshot and reset.');
