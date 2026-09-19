'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const renderer=require('./renderer.js'),boundaries=require('./boundaries.js');
const source=fs.readFileSync(require.resolve('./renderer.js'),'utf8');
// Whitespace/parentheses are compiler output details, not test contracts.
const signature=/const visible\s*=\s*\(?p\)?\s*=>\s*!scene\.some\([\s\S]*?\);/;
assert.equal([...source.matchAll(new RegExp(signature.source,'g'))].length,1);
const context={module:{exports:{}},require:createRequire(require.resolve('./renderer.js'))};
vm.runInNewContext(source.replace(signature,'const visible=()=>{throw new Error("sampled visibility invoked");};'),context);
for(const quality of ['preview','export'])for(const lightType of ['directional','point'])for(const variableWidth of [false,true])for(const shadingContrast of [.5,1.2,2.5]){
 const svg=context.module.exports.render(renderer.examples.ethanol,{quality,lightType,variableWidth,shadingContrast,colorWash:true,outlineWidth:0,labels:false});
 assert.ok(svg.includes('<path'));assert.ok(!/NaN|Infinity/.test(svg));
}
console.log('PASS sphere and rod hatches avoid per-sample visibility in both lighting and quality modes');
// Clip output controls are geometry-only; dot renderers must not invoke them.
const original=boundaries.build;
try{
 boundaries.build=(...args)=>{const b=original(...args);if(b){b.clipCircle=b.clipLine=()=>{throw new Error('dot mode invoked hatch clipping');};}return b;};
 for(const shadingMode of ['stipple','halftone'])renderer.render(renderer.examples.ethanol,{shadingMode,colorWash:true});
 console.log('PASS dot modes never call hatch interval clipping');
}finally{boundaries.build=original;}
// Very short physical intervals must produce a nonzero ribbon, not two
// zero-width tapered endpoints. A circle callback override isolates the writer.
try{
 boundaries.build=(...args)=>{const b=original(...args);if(b)b.clipCircle=()=>[[.201,.2011]];return b;};
 const svg=renderer.render(renderer.examples.sphere,{quality:'preview',outlineWidth:0,shadingContrast:.5});
 const ribbons=[...svg.matchAll(/<path fill="#161616" stroke="none" d="([^"]+)"/g)];
 assert.ok(ribbons.length>0,'short accepted light-mask spans remain drawable');
 assert.ok(ribbons.some(m=>{
  const values=m[1].match(/[-+]?\d+(?:\.\d+)?/g).map(Number),p=[];
  for(let i=0;i<values.length;i+=2)p.push([values[i],values[i+1]]);
  return Math.abs(p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v[0]*q[1]-v[1]*q[0];},0))>1e-6;
 }),'inserted midpoint gives a short tapered ribbon nonzero area');
 console.log('PASS sub-sample visible spans retain nonzero tapered ribbons');
}finally{boundaries.build=original;}
// The legacy branch remains usable if just one interval solver is unavailable.
try{
 let circles=0,lines=0;
 boundaries.build=(...args)=>{const b=original(...args);if(b){const c=b.clipCircle,l=b.clipLine;
  b.clipCircle=(...xs)=>{circles++;return circles===1?null:c(...xs);};b.clipLine=(...xs)=>{lines++;return l(...xs);};}return b;};
 assert.ok(!/NaN|Infinity/.test(renderer.render(renderer.examples.ethanol,{quality:'preview',colorWash:true})));
 assert.ok(circles>1&&lines>0,'one curve fallback does not disable the rest');
 console.log('PASS per-curve fallback leaves other analytic hatches enabled');
}finally{boundaries.build=original;}
