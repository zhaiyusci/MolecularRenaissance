'use strict';
// Topology/acceleration stress test; independent geometry probes are in
// test-dot-regions.cjs. No legacy dot visibility fallback is accepted here.
const assert=require('node:assert/strict'),renderer=require('./renderer.js'),boundaries=require('./boundaries.js');
let seed=0x78374bad;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const views=Array.from({length:1000},()=>[(random()*2-1)*Math.PI,(random()-.5)*Math.PI]);
for(let yaw=-180;yaw<=180;yaw+=15)for(let pitch=-90;pitch<=90;pitch+=15)views.push([yaw*Math.PI/180,pitch*Math.PI/180]);
const original=boundaries.build;let index=0,calls=0;
try{
 boundaries.build=(...args)=>{
  calls++;const b=original(...args);
  assert.ok(b,`boundary build failed at ${index}: ${views[index]}`);
  const regions=b.dotRegions();
  assert.ok(regions,`dot regions fell back at ${index}: ${views[index]}`);
  assert.equal(b.dotRegions(),regions,'surface index is cached, not rebuilt for every dot');
  return null; // Skip serialization in this topology-only test.
 };
 for(;index<views.length;index++){
  const [yaw,pitch]=views[index];renderer.render(renderer.examples.ethanol,{yaw,pitch,shadingSize:0,outlineWidth:0});
 }
 assert.equal(calls,1325);
 console.log('PASS 1325 ethanol views reuse certified dot regions without legacy visibility fallback');
}finally{boundaries.build=original;}
