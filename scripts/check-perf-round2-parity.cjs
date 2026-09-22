'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const before=require('../build/perf-round2/baseline/renderer.js'),after=require('../renderer.js');
// Normalize only the option-derived fast hash namespace, never geometry.
function comparable(svg,mode){
  if(mode!=='fast')return svg;
  const prefixes=[...new Set(svg.match(/fast-painter-[0-9a-f]+-[0-9a-f]+/g)||[])];
  assert.equal(prefixes.length,1,'fast SVG must have exactly one hash namespace');
  return svg.split(prefixes[0]).join('fast-painter-NAMESPACE');
}
let count=0;const rows=[];
function check(name,options){const afterOptions={...options,hatchMode:'continuous'},molecule=before.examples[name],a=before.render(molecule,options),b=after.render(molecule,afterOptions);assert.equal(comparable(b,options.renderMode),comparable(a,options.renderMode),`${name}/${JSON.stringify(options)}`);rows.push({name,options,afterOptions,bytes:Buffer.byteLength(b),byteIdentical:a===b,comparison:options.renderMode==='fast'?'namespace-normalized':'byte-identical'});count++;}
for(const name of Object.keys(before.examples))for(const renderMode of ['precise','fast'])for(const quality of ['preview','export'])for(const shadingMode of ['hatch','stipple','halftone'])check(name,{width:420,height:360,scale:35,renderMode,quality,shadingMode});
for(const name of Object.keys(before.examples))for(const quality of ['preview','export'])for(const lightAzimuth of [-.6,1.4])check(name,{width:420,height:360,scale:35,quality,lightAzimuth,labels:true,elementTextures:true,colorWash:true,castShadows:true,yaw:.73,pitch:.42});
const byteIdentical=rows.filter(row=>row.byteIdentical).length,namespaceNormalized=count-byteIdentical;
fs.writeFileSync('build/perf-round2/parity.json',JSON.stringify({hatchMode:'continuous',note:'Historical continuous-hatch compatibility, not the current layered default: baseline options unchanged; current bundle explicitly uses hatchMode=continuous.',count,byteIdentical:namespaceNormalized===0,byteIdenticalCount:byteIdentical,namespaceNormalizedCount:namespaceNormalized,rows},null,2));console.log(`PASS ${count} fixed-baseline comparisons: ${byteIdentical} byte-identical, ${namespaceNormalized} namespace-normalized; geometry unchanged`);
