'use strict';
// Preserve all five original classic bundles in this directory before optimizing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const baselineDir=path.resolve(process.argv[2]||'build/engine-baseline');
const before=require(path.join(baselineDir,'renderer.js')),after=require('../renderer.js');
const options={width:360,height:320,scale:32,quality:'preview'};
// Removed defaults change the fast namespace hash, not SVG geometry.
function comparable(svg,mode){
  if(mode!=='fast')return svg;
  const prefixes=[...new Set(svg.match(/fast-painter-[0-9a-f]+-[0-9a-f]+/g)||[])];
  assert.equal(prefixes.length,1,'fast SVG must have exactly one hash namespace');
  return svg.split(prefixes[0]).join('fast-painter-NAMESPACE');
}
let count=0,byteIdentical=0,namespaceNormalized=0;
for(const [name,molecule] of Object.entries(before.examples)) {
  for(const renderMode of ['precise','fast'])for(const shadingMode of ['hatch','stipple','halftone']) {
    const o={...options,renderMode,shadingMode,elementTextures:true,labels:true,colorWash:true,yaw:.31,pitch:-.24};
    check(name+'/'+renderMode+'/'+shadingMode,molecule,o);
  }
}
for(const name of ['phenol','c60','water'])for(const lightAzimuth of [-.6,1.4]) {
  check(name+'/export/azimuth-'+lightAzimuth,before.examples[name],{...options,quality:'export',lightAzimuth,castShadows:true,elementTextures:true,labels:true,colorWash:true,shadingContrast:1.6,shadingBrightness:.1,optimizePaths:true});
}
function check(id,molecule,o) {
  const a=before.render(molecule,o),b=after.render(molecule,{...o,hatchMode:'continuous'});
  const left=comparable(a,o.renderMode),right=comparable(b,o.renderMode);
  if(left!==right){fs.mkdirSync('build/optimization-diff',{recursive:true});fs.writeFileSync('build/optimization-diff/before.svg',a);fs.writeFileSync('build/optimization-diff/after.svg',b);let i=0;while(a[i]===b[i]&&i<Math.min(a.length,b.length))i++;throw Error('SVG differs '+id+' at '+i+'; '+JSON.stringify(a.slice(i-40,i+100))+' vs '+JSON.stringify(b.slice(i-40,i+100)));}
  assert(!/NaN|Infinity/.test(b));count++;if(a===b)byteIdentical++;else namespaceNormalized++;
}
const report={baselineDir,hatchMode:'continuous',scenes:count,byteIdentical,namespaceNormalized,note:'Historical continuous-hatch compatibility, not the current layered default: baseline options unchanged; current bundle explicitly uses hatchMode=continuous. Precise SVG is byte-identical; fast SVG equality permits only replacement of one validated hash namespace and all its references. All geometry, styles and other metadata compare exactly. Includes selected directional shadow export cases at varied azimuths (not the former point-light matrix).'};
fs.writeFileSync('build/optimization-parity.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS '+count+' full-render scenarios: '+byteIdentical+' byte-identical, '+namespaceNormalized+' namespace-normalized');
