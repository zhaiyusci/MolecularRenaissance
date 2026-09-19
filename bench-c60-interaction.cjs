'use strict';
// Reproduce the formerly slow symmetric views. Force the old grid path to
// compare against the replacement on the same current renderer/options.
const assert=require('node:assert/strict'),r=require('./renderer.js'),b=require('./boundaries.js');
const build=b.build,results=[];
const median=a=>{a.sort((x,y)=>x-y);return +a[Math.floor(a.length/2)].toFixed(2);};
try{
 for(const yaw of [0,45,90]){
  const times={shared:[],grid:[]};
  for(let round=0;round<4;round++)for(const mode of round%2?['grid','shared']:['shared','grid']){
   b.build=mode==='shared'?build:()=>null;
   const start=performance.now(),svg=r.render(r.examples.c60,{yaw:yaw*Math.PI/180,pitch:0,quality:'preview',shadingSize:0,colorWash:true});
   const elapsed=performance.now()-start;
   assert.equal(svg.includes('data-boundaries="analytic"'),mode==='shared');
   if(round)times[mode].push(elapsed);
  }
  results.push({yaw,pitch:0,sharedMs:median(times.shared),gridMs:median(times.grid)});
 }
 console.log(JSON.stringify({node:process.version,warmups:1,runs:3,quality:'preview',shadingSize:0,colorWash:true,results},null,2));
}finally{b.build=build;}
