'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const wash=require('./wash.js');
const {render,examples,depthAt}=require('./renderer.js');
const commands=svg=>[...svg.matchAll(/\sd="([^"]*)"/g)].map(m=>m[1]);
const circles=svg=>svg.match(/<circle\b[^>]*\/>/g)||[];
const texts=svg=>svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/g)||[];
const originalFit=wash.fitContour;
for(const shadingMode of ['hatch','stipple','halftone'])for(const colorMode of ['wash','ink']){
 const options={shadingMode,colorMode,colorWash:true,labels:true,labelMatchFill:true};
 const exported=render(examples.ethanol,options);
 assert.equal(render(examples.ethanol,{...options,quality:'export'}),exported,'default remains export quality');
 let preview;
 wash.fitContour=()=>{throw new Error('preview invoked line fitting');};
 try{preview=render(examples.ethanol,{...options,quality:'preview',optimizePaths:true});}finally{wash.fitContour=originalFit;}
 assert.ok(commands(preview).every(d=>!/[CAQ]/.test(d)),'preview contains only sampled polygons/polylines');
 assert.ok(commands(exported).some(d=>d.includes('C')),'export retains fitted cubics');
 assert.equal(commands(preview).length,commands(exported).length,'visibility runs/paths unchanged');
 assert.deepEqual(circles(preview),circles(exported),'dot geometry and colors unchanged');
 assert.deepEqual(texts(preview),texts(exported),'labels and typography unchanged');
 assert.ok(!/NaN|Infinity|undefined/.test(preview));
 assert.equal(preview.includes('mol-wash'),colorMode==='wash');
 console.log(`PASS ${shadingMode}/${colorMode}: no preview fitting, compact export, same dots/labels/runs`);
}
// Trap the private fill fitter, not just the publicly exported line fitter.
const source=fs.readFileSync(require.resolve('./wash.js'),'utf8');
const signature='function fitContour(input, tolerance) {';
assert.ok(source.includes(signature));
const context={};
vm.runInNewContext(source.replace(signature,signature+' throw new Error("private fill fitter called");'),context);
const scene=[{kind:'sphere',c:[0,0,0],r:1,element:'C'},{kind:'sphere',c:[.2,0,2],r:.25,element:'H'}];
const args=[scene,depthAt,p=>[50+p[0]*30,50-p[1]*30],30,e=>e==='H'?'#ffffff':'#998877'];
const polygon=context.MolWash.buildWash(...args,{fitCurves:false});
assert.ok(polygon.includes('evenodd'));
assert.ok(commands(polygon).every(d=>!d.includes('C')));
assert.equal((commands(polygon)[0].match(/M/g)||[]).length,2,'preview retains a white occluder hole');
assert.throws(()=>context.MolWash.buildWash(...args),/private fill fitter called/,'export invokes the private fitter');
assert.throws(()=>render(examples.sphere,{quality:'draft'}),/Invalid quality/);
console.log('PASS fill preview skips private fitting, preserves holes; invalid quality rejected');
