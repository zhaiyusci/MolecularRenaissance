'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const r=require('./renderer.js'),b=require('./boundaries.js');
const expected={H:.31,C:.76,N:.71,O:.66,P:1.07,S:1.05};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function capture(model,options={}){
 const original=b.build;let args;
 b.build=(...a)=>{args=a;return null;};
 try{r.render(model,{...options,shadingSize:0,outlineWidth:0,colorWash:false,labels:false});}
 finally{b.build=original;}
 assert.ok(args);return {scene:args[0],project:args[2],scale:args[3]};
}
assert.deepEqual(Object.fromEntries(Object.keys(expected).map(k=>[k,r.covalentRadii[k]])),expected,'legacy radii remain unchanged');
assert.equal(r.covalentRadiusSource.doi,'10.1039/B801115J');
assert.equal(r.covalentRadiusSource.unit,'angstrom');
assert.equal(r.covalentRadiusSource.carbonReference,'sp3');
assert.ok(Object.isFrozen(r.covalentRadii));
for(const [element,radius] of Object.entries(expected)){
 const model={atoms:[{element,position:[0,0,0]}],bonds:[]};
 for(const options of [{},{width:200,height:200},{width:1800,height:1200},{yaw:1.2,pitch:.7},{scale:95}]){
  const c=capture(model,options);assert.equal(c.scene[0].r,radius);assert.equal(c.scale,options.scale??60);
  close(c.project([radius,0,0])[0]-c.project([0,0,0])[0],radius*c.scale);
 }
}
for(const model of [...Object.values(r.examples),{atoms:[{element:'C',position:[-1000,0,0]},{element:'H',position:[1000,0,0]}],bonds:[]}]){
 for(const size of [200,900,1600]){
  const c=capture(model,{width:size,height:size});assert.equal(c.scale,60);
  close(c.project([1,0,0])[0]-c.project([0,0,0])[0],60);
 }
}
// Radius display scaling is independent of coordinate/bond geometry and camera scale.
for(const model of Object.values(r.examples))for(const view of [{},{yaw:1.2,pitch:.4,width:1200,height:800}]){
 const base=capture(model,view);
 for(const factor of [.2,.5,.8,1,1.5,2]){
  const scaled=capture(model,{...view,atomRadiusScale:factor});assert.equal(scaled.scale,base.scale);
  for(let i=0;i<base.scene.length;i++){
   const a=base.scene[i],s=scaled.scene[i];
   if(a.kind==='sphere'){assert.deepEqual(s.c,a.c);close(s.r,a.r*factor);}
   else assert.deepEqual(s,a,'bond centerline, length and radius must not change');
  }
 }
}
const override={atoms:[{element:'C',position:[0,0,0],radius:.73},{element:'F',position:[3,0,0],radius:.57}],bonds:[]};
assert.deepEqual(capture(override).scene.map(s=>s.r),[.73,.57]);
assert.deepEqual(capture(override,{atomRadiusScale:.5}).scene.map(s=>s.r),[.365,.285]);
assert.equal(capture({atoms:[{element:'F',position:[0,0,0]}],bonds:[]}).scene[0].r,.57);
assert.throws(()=>capture({atoms:[{element:'Xx',position:[0,0,0]}],bonds:[]}),/No covalent radius/);
for(const value of [0,-1,NaN,Infinity,'60',null]){
 assert.throws(()=>capture(r.examples.sphere,{scale:value}),/Invalid scale/);
 assert.throws(()=>capture(r.examples.sphere,{atomRadiusScale:value}),/Invalid atomRadiusScale/);
 assert.throws(()=>capture({atoms:[{element:'C',position:[0,0,0],radius:value}],bonds:[]}),/Invalid atom radius/);
}
// Units and geometry are not rescaled to manufacture nonintersecting spheres.
const c60=capture(r.examples.c60,{yaw:0,pitch:0});
for(const [a,c] of r.examples.c60.bonds){
 const d=Math.hypot(...c60.scene[a].c.map((v,i)=>v-c60.scene[c].c[i]));
 close(d,1.42);assert.equal(c60.scene[a].r,.76);assert.ok(d<2*.76);
}
(async()=>{
 const esm=await import('./dist/molplotter.mjs'),browser=vm.createContext({});
 for(const name of ['dot-regions','boundaries','wash','dots','renderer'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),browser);
 for(const api of [r,esm,browser.MolEngraver])for(const [element,radius] of Object.entries(expected))for(const size of [200,900])for(const factor of [.5,1,1.5]){
  const svg=api.render({atoms:[{element,position:[0,0,0]}],bonds:[]},{width:size,height:size,quality:'preview',shadingSize:0,scale:60,atomRadiusScale:factor});
  const ink=svg.match(/<g data-role="engraving"[\s\S]*?<\/g>/)[0];
  const points=[...ink.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(m=>[+m[1],+m[2]]);assert.ok(points.length>10);
  // Preview vertices lie on the circle, rounded to .001 SVG units. The
  // polyline's bounding box need not attain its unsampled cardinal extrema.
  for(const [x,y] of points)assert.ok(Math.abs(Math.hypot(x-size/2,y-(size/2-12))-radius*factor*60)<=Math.SQRT2*.0005+1e-9);
 }
 console.log('PASS cited radii, overrides, unknown-element rejection, fixed scale across models/views/canvas and all three module formats');
})().catch(error=>{console.error(error);process.exitCode=1;});
