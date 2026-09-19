'use strict';
const assert=require('node:assert/strict'),r=require('./renderer.js'),b=require('./boundaries.js');
const build=b.build,views=[];
for(let pitch=-60;pitch<=60;pitch+=30)for(let yaw=0;yaw<=180;yaw+=15)views.push([yaw,pitch]);
// Every integer yaw on the previously troublesome symmetry plane.
for(let yaw=-180;yaw<=180;yaw++)views.push([yaw,0]);
let seed=0xc60abc;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<40;i++)views.push([Math.round(random()*360-180),Math.round(random()*180-90)]);
let current,calls=0;const started=performance.now();
try{
 b.build=(...args)=>{
  calls++;const a=build(...args);assert.ok(a,`C60 arrangement fallback at ${current}`);
  assert.ok(a.validate(r.elementColor),`C60 fill topology at ${current}`);
  assert.ok(a.dotRegions(),`C60 surface-region fallback at ${current}`);
  return null; // No serialization or fallback grid needed for topology checks.
 };
 for(const view of views){current=view;r.render(r.examples.c60,{yaw:view[0]*Math.PI/180,pitch:view[1]*Math.PI/180,shadingSize:0,outlineWidth:0});}
 assert.equal(calls,466);
 console.log(`PASS ${calls} C60 rotations: analytic fill and shared dot regions, no fallback (${((performance.now()-started)/1000).toFixed(1)} s)`);
}finally{b.build=build;}
