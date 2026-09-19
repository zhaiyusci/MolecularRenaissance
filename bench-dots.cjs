'use strict';
// CPU SVG generation only; paired warm runs, no DOM/paint timing.
const renderer=require('./renderer.js'),boundaries=require('./boundaries.js'),dots=require('./dots.js');
const originalBuild=boundaries.build,originalDots=dots.buildDots;
const median=a=>{a.sort((x,y)=>x-y);return +a[Math.floor(a.length/2)].toFixed(2);};
const results={};
function mode(shared){
 boundaries.build=shared?originalBuild:(...args)=>{const b=originalBuild(...args);if(b)b.dotRegions=()=>null;return b;};
}
try{
 for(const shadingMode of ['stipple','halftone']){
  const options={shadingMode,colorWash:true,quality:'preview'},times={shared:[],legacy:[]},sizes={};
  for(let round=0;round<12;round++)for(const name of round%2?['legacy','shared']:['shared','legacy']){
   mode(name==='shared');const start=performance.now(),svg=renderer.render(renderer.examples.ethanol,options),elapsed=performance.now()-start;
   if(round>=4)times[name].push(elapsed);sizes[name]=Buffer.byteLength(svg);
  }
  results[shadingMode]={};
  for(const name of ['shared','legacy']){
   let rays=0,queries=0,shared=false,circles=0;
   dots.buildDots=(scene,depth,project,scale,illumination,opts,color,regions)=>{
    shared=!!regions;
    const proxy=regions?{query(...args){queries++;return regions.query(...args);}}:null;
    const out=originalDots(scene,(...args)=>{rays++;return depth(...args);},project,scale,illumination,opts,color,proxy);
    circles=(out.match(/<circle\b/g)||[]).length;return out;
   };
   mode(name==='shared');renderer.render(renderer.examples.ethanol,options);dots.buildDots=originalDots;
   results[shadingMode][name]={medianMs:median(times[name]),svgBytes:sizes[name],dotDepthQueries:rays,regionQueries:queries,shared,circles};
  }
 }
 console.log(JSON.stringify({node:process.version,warmups:4,runs:8,results},null,2));
}finally{boundaries.build=originalBuild;dots.buildDots=originalDots;}
