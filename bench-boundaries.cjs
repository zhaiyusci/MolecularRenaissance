'use strict';
// Run node bench-boundaries.cjs. Timings cover SVG generation, NOT browser paint.
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const renderer=require('./renderer.js'),boundaries=require('./boundaries.js'),wash=require('./wash.js');
const originalBuild=boundaries.build,originalWash=wash.buildWash;
let rays=0;
boundaries.build=(scene,depth,...rest)=>originalBuild(scene,(...args)=>{rays++;return depth(...args);},...rest);
wash.buildWash=(scene,depth,...rest)=>originalWash(scene,(...args)=>{rays++;return depth(...args);},...rest);
const analyticBuild=boundaries.build;
const snapshotPath='./build/perf-before-visibility/renderer.js';
const snapshot=fs.existsSync(snapshotPath)?require(snapshotPath):null;
const options={quality:'preview',shadingSize:0,colorWash:true};
const methods={
  analytic:()=>{boundaries.build=analyticBuild;return renderer.render(renderer.examples.ethanol,options);},
  'scalar+grid':()=>{boundaries.build=()=>null;return renderer.render(renderer.examples.ethanol,options);}
};
if(snapshot)methods['original+grid']=()=>snapshot.render(snapshot.examples.ethanol,options);
const samples={},outputs={};
try{
  for(let round=0;round<16;round++){
    const names=Object.keys(methods);if(round%2)names.reverse();
    for(const name of names){
      rays=0;const start=performance.now(),svg=methods[name](),elapsed=performance.now()-start;
      if(round>=4)(samples[name]??=[]).push(elapsed);
      outputs[name]={svgBytes:Buffer.byteLength(svg),boundaryDepthQueries:name==='original+grid'?null:rays,analytic:svg.includes('data-boundaries="analytic"')};
    }
  }
  const results={};
  for(const [name,times] of Object.entries(samples)){
    times.sort((a,b)=>a-b);results[name]={medianMs:+((times[5]+times[6])/2).toFixed(3),minMs:+times[0].toFixed(3),maxMs:+times.at(-1).toFixed(3),...outputs[name]};
  }
  console.log(JSON.stringify({node:process.version,options,warmups:4,measuredRuns:12,results},null,2));
}finally{boundaries.build=originalBuild;wash.buildWash=originalWash;}
