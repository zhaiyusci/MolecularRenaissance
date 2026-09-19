'use strict';
// Topology stress corpus; geometric membership/precision is checked separately
// by test-analytic-boundaries.cjs, including every formerly failing view here.
const assert=require('node:assert/strict');
const renderer=require('./renderer.js'),boundaries=require('./boundaries.js');
let seed=0x78374bad;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const views=Array.from({length:1000},()=>[(random()*2-1)*Math.PI,(random()-.5)*Math.PI]);
for(let yaw=-180;yaw<=180;yaw+=15)for(let pitch=-90;pitch<=90;pitch+=15)views.push([yaw*Math.PI/180,pitch*Math.PI/180]);
const original=boundaries.build;
let calls=0,index=0;
boundaries.build=(...args)=>{
  calls++;const result=original(...args),view=JSON.stringify(views[index]);
  assert.ok(result,`analytic build rejected ordinary rotation ${index}: ${view}`);
  assert.ok(result.validate(renderer.elementColor),`unclosed ordinary rotation ${index}: ${view}`);
  // Skip serialization in this topology-only test, not a production option.
  return null;
};
try{
  for(index=0;index<views.length;index++){
    const [yaw,pitch]=views[index];
    renderer.render(renderer.examples.ethanol,{yaw,pitch,shadingSize:0,outlineWidth:0,quality:'preview'});
  }
  assert.equal(calls,1325);
  console.log(`PASS ${calls} ethanol rotations: 1000 deterministic random + 325 regular/axial views; no grid fallback required`);
}finally{boundaries.build=original;}
