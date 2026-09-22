'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,Math});return exports;}
const m=load('src/math.ts'),h=load('src/hatch-curves.ts');
const eq=(a,b)=>assert(Object.is(a,b),`${a} != ${b} (including signed zero)`);
const vector=(a,b)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>eq(x,b[i]));};
const special=[0,-0,1,-1,1e-300,1e300,Number.MIN_VALUE,Number.MAX_VALUE,Infinity,-Infinity,NaN];
for(let size=0;size<=5;size++)for(let k=0;k<special.length;k++) {
 const a=Array.from({length:size},(_,i)=>special[(k+i)%special.length]),b=Array.from({length:size},(_,i)=>special[(k+i+3)%special.length]),s=special[k];
 vector(m.add(a,b),a.map((v,i)=>v+b[i]));vector(m.sub(a,b),a.map((v,i)=>v-b[i]));vector(m.mul(a,s),a.map(v=>v*s));eq(m.dot(a,b),a.reduce((sum,v,i)=>sum+v*b[i],0));
}
let state=12345;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296-.5)*10;
for(let i=0;i<1000;i++){
 const center=[rand(),rand(),rand()],u=[rand(),rand(),rand()],v=[rand(),rand(),rand()];
 const project=p=>[p[0]*53+410,370-p[1]*53];
 const c=project(center),pu=project(center.map((x,j)=>x+u[j])),pv=project(center.map((x,j)=>x+v[j])),U=pu.map((x,j)=>x-c[j]),V=pv.map((x,j)=>x-c[j]);
 const curve=h.projectedCircle(project,center,u,v),t=i%10===0?Number.MIN_VALUE:i/1000,a=t*(2*Math.PI),cos=Math.cos(a),sin=Math.sin(a);
 vector(curve.point(t),c.map((x,j)=>x+U[j]*Math.cos(a)+V[j]*Math.sin(a)));
 vector(curve.pointFromTrig(cos,sin),curve.point(t));
 vector(curve.tangent(t),U.map((x,j)=>2*Math.PI*(-x*Math.sin(a)+V[j]*Math.cos(a))));
}
console.log('PASS scalar vector arithmetic (signed zero/NaN/extremes/generic dimensions) and 1000 exact projected-circle/trig-sharing cases');
