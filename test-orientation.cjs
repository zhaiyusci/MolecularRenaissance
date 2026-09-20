'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('./renderer.js'),boundaries=require('./boundaries.js');
const I=[0,0,0,1],pi=Math.PI;
const near=(a,b,t=1e-9)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
const vector=(a,b,t)=>a.forEach((v,i)=>near(v,b[i],t));
const sameRotation=(a,b,t=1e-9)=>near(Math.abs(a.reduce((s,v,i)=>s+v*b[i],0)),1,t);
const model={name:'orientation test',atoms:[{element:'C',position:[1,0,0]},{element:'O',position:[0,2,0]},{element:'N',position:[0,0,3]}],bonds:[[0,1],[1,2]]};
const original=JSON.stringify(model);
function capture(options){let scene,project,scale;const saved=boundaries.build;boundaries.build=(s,o,p,k)=>{scene=s;project=p;scale=k;return null;};try{api.render(model,{...options,shadingSize:0,outlineWidth:0,colorWash:false,labels:false});}finally{boundaries.build=saved;}assert(scene);return {scene,project,scale};}
function xyz(p,[x,y,z]){const [cx,sx,cy,sy,cz,sz]=[Math.cos(x),Math.sin(x),Math.cos(y),Math.sin(y),Math.cos(z),Math.sin(z)];const a=[p[0],p[1]*cx-p[2]*sx,p[1]*sx+p[2]*cx],b=[a[0]*cy+a[2]*sy,a[1],-a[0]*sy+a[2]*cy];return [b[0]*cz-b[1]*sz,b[0]*sz+b[1]*cz,b[2]];}
const base=capture({yaw:0,pitch:0,scale:73});
for(const angles of [[pi/2,0,0],[0,pi/2,0],[0,0,pi/2],[.63,-.27,1.12],[-1.1,pi/2,.8],[.4,-pi/2,-1]]){
 const q=api.orientationFromEulerXYZ(angles),s=capture({orientation:q,scale:73});
 sameRotation(api.orientationFromEulerXYZ(api.orientationToEulerXYZ(q)),q);
 for(let i=0;i<3;i++){vector(s.scene[i].c,xyz(base.scene[i].c,angles));assert.equal(s.scene[i].r,base.scene[i].r);}
 assert.equal(s.scale,73);for(let i=3;i<s.scene.length;i++)near(s.scene[i].length,base.scene[i].length);
}
for(let i=0;i<1000;i++){const q=api.orientationFromEulerXYZ([Math.sin(i)*4,Math.cos(i*1.7)*4,Math.sin(i*.73)*4]);sameRotation(api.orientationFromEulerXYZ(api.orientationToEulerXYZ(q)),q);}
let q=I;for(let i=0;i<10000;i++)q=api.rotateOrientation(q,['x','y','z'][i%3],.013);near(Math.hypot(...q),1);
for(const axis of ['x','y','z']){let turn=I;for(let i=0;i<24;i++)turn=api.rotateOrientation(turn,axis,pi/12);sameRotation(turn,I);sameRotation(api.rotateOrientation(api.rotateOrientation(q,axis,.71),axis,-.71),q);}
const xy=api.rotateOrientation(api.rotateOrientation(I,'x',pi/2),'y',pi/2),yx=api.rotateOrientation(api.rotateOrientation(I,'y',pi/2),'x',pi/2);
assert(Math.abs(xy.reduce((s,v,i)=>s+v*yx[i],0))<.999,'rotation order matters');sameRotation(xy,api.orientationFromEulerXYZ([pi/2,pi/2,0]));
for(const big of [Number.MAX_VALUE,Number.MIN_VALUE])vector(api.normalizeOrientation([big,big,big,big]),[.5,.5,.5,.5]);
const frozen=Object.freeze([.2,.3,.4,.5]);api.rotateOrientation(frozen,'z',1);assert.deepEqual(frozen,[.2,.3,.4,.5]);
for(const bad of [null,[],[0,0,0,0],[1,2,3],[NaN,0,0,1],[0,Infinity,0,1],Array(4),['1',0,0,1]])assert.throws(()=>api.render(model,{orientation:bad}),/Invalid orientation/);
assert.throws(()=>api.rotateOrientation(I,'w',1),/axis/);assert.throws(()=>api.rotateOrientation(I,'x',NaN),/angle/);
for(const bad of [[],Array(3),[0,Infinity,0]])assert.throws(()=>api.orientationFromEulerXYZ(bad),/Euler/);
const legacy=capture({yaw:.5,pitch:-.3}),equivalent=capture({orientation:api.rotateOrientation(api.rotateOrientation(I,'y',.5),'x',-.3)});
for(let i=0;i<3;i++)vector(legacy.scene[i].c,equivalent.scene[i].c);
assert.deepEqual(capture({orientation:I,yaw:9,pitch:-5}).scene,base.scene,'quaternion overrides legacy angles');
assert.deepEqual(capture({}).scene,capture({orientation:undefined}).scene,'absent quaternion preserves legacy path');
for(const renderMode of ['precise','fast'])for(const shadingMode of ['hatch','stipple','halftone'])for(const quality of ['preview','export']){
 const svg=api.render(api.examples.ethanol,{renderMode,shadingMode,quality,orientation:q,labels:true});assert(svg.startsWith('<svg'));assert(!/NaN|Infinity|undefined/.test(svg));
}
assert.equal(JSON.stringify(model),original);
(async()=>{const esm=await import('./dist/molplotter.mjs');sameRotation(esm.rotateOrientation(I,'z',.2),api.rotateOrientation(I,'z',.2));const browser={};vm.createContext(browser);for(const path of ['boundaries.js','dot-regions.js','wash.js','dots.js','renderer.js'])vm.runInContext(fs.readFileSync(path,'utf8'),browser);sameRotation(browser.MolEngraver.orientationFromEulerXYZ([.1,.2,.3]),api.orientationFromEulerXYZ([.1,.2,.3]));console.log('Orientation passed: XYZ handedness/order, poles, 1000 Euler roundtrips, 10000 increments, geometry/scale, legacy API, CJS/ESM/classic and 12 real renders.');})().catch(e=>{console.error(e);process.exitCode=1;});
