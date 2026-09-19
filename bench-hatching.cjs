'use strict';
// CPU SVG generation only; no browser DOM/paint timing.
const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const renderer=require('./renderer.js'),boundaries=require('./boundaries.js');
const originalBuild=boundaries.build;
const oldPath='./build/perf-before-hatching/renderer.js';
const baseline=fs.existsSync(oldPath)?require(oldPath):null;
const median=a=>{a.sort((x,y)=>x-y);return +(a[Math.floor(a.length/2)]).toFixed(2);};
const results={};
try{
 for(const quality of ['preview','export']){
  const variants={interval:()=>{boundaries.build=originalBuild;return renderer;},sampled:()=>{
   boundaries.build=(...args)=>{const b=originalBuild(...args);if(b){b.clipCircle=null;b.clipLine=null;}return b;};return renderer;
  }};
  if(baseline)variants.before=()=>baseline;
  const times={},sizes={};
  for(let round=0;round<10;round++){
   const names=Object.keys(variants);if(round%2)names.reverse();
   for(const name of names){const engine=variants[name](),start=performance.now();const svg=engine.render(engine.examples.ethanol,{quality,colorWash:true});
    const elapsed=performance.now()-start;if(round>=3)(times[name]??=[]).push(elapsed);sizes[name]=Buffer.byteLength(svg);
   }
  }
  results[quality]=Object.fromEntries(Object.entries(times).map(([name,t])=>[name,{medianMs:median(t),svgBytes:sizes[name]}]));
 }
 // Separate instrumentation run, excluded from the timing comparison. Count
 // every renderer ray (including legacy sample visibility) in the SAME VM.
 const source=fs.readFileSync(require.resolve('./renderer.js'),'utf8');
 for(const mode of ['interval','sampled']){
  boundaries.build=(...args)=>{const b=originalBuild(...args);if(b&&mode==='sampled'){b.clipCircle=null;b.clipLine=null;}return b;};
  const context={module:{exports:{}},require:createRequire(require.resolve('./renderer.js')),rays:0};
  const signature=/function depthAt\s*\(s,\s*x,\s*y\)\s*\{/;
  if(!signature.test(source))throw new Error('depthAt instrumentation hook not found');
  vm.runInNewContext(source.replace(signature,match=>match+' globalThis.rays++;'),context);
  context.module.exports.render(renderer.examples.ethanol,{quality:'preview',colorWash:true});
  results[mode+'RayQueries']=context.rays;
 }
 console.log(JSON.stringify({node:process.version,warmups:3,runs:7,options:{colorWash:true,shadingMode:'hatch'},results},null,2));
}finally{boundaries.build=originalBuild;}
