'use strict';
// Paired same-process measurements. Capture the previous five renderer bundles in
// build/perf-before-fast-templates before changing/building the renderer.
const fs=require('node:fs'),path=require('node:path');
const before=require('../build/perf-before-fast-templates/renderer.js');
const after=require('../renderer.js');
const rows=[],base={renderMode:'fast',castShadows:false,quantizeShading:true,quality:'preview',textureScale:1,colorWash:true,atomRadiusScale:.75};
const median=a=>+a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)].toFixed(3);
const attr=(svg,name)=>+(svg.match(new RegExp(' '+name+'="([^"]+)"'))?.[1]??0);
fs.mkdirSync(path.resolve(__dirname,'../build/fast-template-comparison'),{recursive:true});
for(const bonds of [true,false])for(const shadingMode of ['hatch','stipple','halftone'])for(const shadingLevels of [16,64]){
 const options={...base,shadingMode,shadingLevels};
 const models=[before,after].map(api=>bonds?api.examples.c60:{...api.examples.c60,bonds:[]});
 const apis=[before,after],times=[[],[]],outputs=[];
 for(let warm=0;warm<2;warm++)for(let side=0;side<2;side++)apis[side].render(models[side],options);
 for(let pass=0;pass<5;pass++)for(const side of pass%2?[1,0]:[0,1]){
  const start=performance.now();outputs[side]=apis[side].render(models[side],options);times[side].push(performance.now()-start);
 }
 const [oldMs,newMs]=times.map(median),[oldBytes,newBytes]=outputs.map(s=>Buffer.byteLength(s));
 rows.push({model:bonds?'c60-with-bonds':'c60-atoms-only',shadingMode,shadingLevels,oldMs,newMs,speedup:+(oldMs/newMs).toFixed(2),oldBytes,newBytes,byteReductionPercent:+((1-newBytes/oldBytes)*100).toFixed(1),atomTemplates:attr(outputs[1],'data-atom-template-count'),atomInstances:attr(outputs[1],'data-atom-template-instances'),visibleBonds:attr(outputs[1],'data-bond-visible-count'),bondTextureBuilds:attr(outputs[1],'data-bond-texture-builds')});
 if(bonds&&shadingLevels===16)for(let side=0;side<2;side++)fs.writeFileSync(path.resolve(__dirname,`../build/fast-template-comparison/${shadingMode}-${side?'after':'before'}.svg`),outputs[side]);
}
const result={node:process.version,options:base,method:'2 warmups, 5 alternating before/after pairs per case; median SVG generation only, not browser paint. Real C60 with all 90 bonds plus a separate atoms-only fixture. Previous bundle snapshot includes the lighting-order fix.',rows};
fs.mkdirSync(path.resolve(__dirname,'../benchmarks'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../benchmarks/fast-templates.json'),JSON.stringify(result,null,2)+'\n');
console.table(rows);
