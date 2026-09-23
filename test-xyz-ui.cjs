'use strict';
const assert=require('node:assert/strict'),api=require('./renderer.js');
const {makeUI}=require('./scripts/ui-harness.cjs');
const ui=makeUI(),{elements,calls,downloads,flush}=ui;
const initial=JSON.stringify(api.examples),water='3\nwater\nO 0 0 0\nH .9572 0 0\nH -.239 .927 0\n';
function select(key){elements.model.value=key;elements.model.listeners.change();flush();}
function upload(name,textOrPromise,size=200){elements['xyz-file'].files=[{name,size,text:()=>Promise.resolve(textOrPromise)}];elements['xyz-file'].value=name;return elements['xyz-file'].listeners.change();}
function pending(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
(async()=>{
 flush();const examplesCount=elements.model.children.length;
 await upload('water.xyz',water);flush();const importedKey=elements.model.value;
 assert.equal(elements['xyz-file'].value,'');assert.equal(calls.at(-1).model.name,'water.xyz');assert.equal(calls.at(-1).model.bonds.length,2);
 assert.equal(calls.at(-1).options.scale,60);assert.equal(calls.at(-1).options.atomRadiusScale,.75);
 elements.download.listeners.click();assert.equal(downloads.at(-1),'mol-water.svg');assert.equal(calls.at(-1).options.quality,'export');
 assert(!elements['xyz-infer-bonds'],'bond inference is automatic, not an extra control');
 assert.equal(calls.at(-1).model.bonds.length,2,'export keeps automatically inferred bonds');
 elements['fast-overlay'].checked=true;elements['fast-overlay'].listeners.change();flush();assert.equal(calls.at(-1).options.renderMode,'fast');
 // Reading a file blocks export even when another control triggers a render.
 const a=pending(),jobA=upload('old.xyz',a.promise);assert(elements.download.disabled);
 elements['shading-mode'].value='halftone';elements['shading-mode'].listeners.change();flush();
 const n=downloads.length;elements.download.listeners.click();assert.equal(downloads.length,n);
 await upload('new.xyz','1\nnew\nCl 0 0 0');flush();a.resolve(water);await jobA;
 assert.equal(calls.at(-1).model.name,'new.xyz');assert.equal(elements.model.children.length,examplesCount+1);
 // Invalid files leave the previous valid import and a persistent error.
 await upload('broken.xyz','2\nno records');flush();assert.equal(calls.at(-1).model.name,'new.xyz');assert.equal(elements['xyz-status'].attrs['data-error'],'true');
 elements['texture-scale'].listeners.input();flush();assert.equal(elements['xyz-status'].attrs['data-error'],'true');
 // Oversized input is rejected before text() is touched.
 let read=false;elements['xyz-file'].files=[{name:'huge.xyz',size:2097153,text(){read=true;throw Error('must not read');}}];await elements['xyz-file'].listeners.change();flush();assert(!read);
 // Switching models cancels a pending read without letting it select itself later.
 const b=pending(),jobB=upload('late.xyz',b.promise);select('ethanol');b.resolve(water);await jobB;assert.equal(elements.model.value,'ethanol');
 select(importedKey);assert.equal(calls.at(-1).model.name,'new.xyz');
 // Failed pending import retains the previous molecule and inferred bonds.
 await upload('water.xyz',water);flush();const c=pending(),jobC=upload('bad.xyz',c.promise);
 c.reject(Error('read failed'));await jobC;flush();
 assert.equal(calls.at(-1).model.bonds.length,2);
 const d=pending(),jobD=upload('reset-late.xyz',d.promise);elements.reset.listeners.click();flush();d.resolve(water);await jobD;assert.equal(elements.model.value,'water');
 assert.equal(JSON.stringify(api.examples),initial,'import never mutates built-in examples');
 await upload('<img onerror=alert(1)>.xyz',water);flush();assert(elements.model.children.at(-1).textContent.includes('<img'));
 assert.equal(elements.model.children.at(-1).querySelector('img'),null,'filename is assigned as text only');
 console.log('XYZ UI checks passed: file selection, inference, export, races, cancellation, failure recovery, size budget and no example mutation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
