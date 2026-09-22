'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const before=require('../build/layered-hatching/baseline/renderer.js'),after=require('../renderer.js');let count=0;
assert.deepStrictEqual(after.examples,before.examples);
// Historical snapshots predate layered hatching. Compare explicit continuous
// hatch compatibility, while keeping other styles and fast mode on their defaults.
function check(name,o){const current=o.renderMode!=='fast'&&(!o.shadingMode||o.shadingMode==='hatch')?{...o,hatchMode:'continuous'}:o;assert(after.render(after.examples[name],current)===before.render(before.examples[name],o),'Legacy compatibility changed: '+name+' '+JSON.stringify(o));count++;}
for(const name of Object.keys(before.examples))for(const renderMode of ['precise','fast'])for(const quality of ['preview','export'])for(const shadingMode of ['hatch','stipple','halftone'])check(name,{width:420,height:360,scale:35,renderMode,quality,shadingMode});
for(const name of Object.keys(before.examples))for(const quality of ['preview','export'])for(const castShadows of [false,true])check(name,{width:420,height:360,scale:35,quality,castShadows,labels:true,elementTextures:true,colorWash:true,lightAzimuth:1.1,lightElevation:.45,yaw:.73,pitch:.42});
fs.writeFileSync('build/layered-hatching/continuous-parity.json',JSON.stringify({count,byteIdentical:true,baseline:'Renderer immediately before layered hatching; baseline options omit hatchMode',scope:'Explicit continuous precise hatches; default other styles and fast mode. 17 models, qualities, shadows, labels and textures; no ID normalization. Not a claim that the new layered default matches historical output.'},null,2)+'\n');
console.log(`PASS ${count} legacy-compatibility SVGs byte-identical (explicit continuous hatches; default fast/other styles)`);
