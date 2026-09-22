'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const wash=require('./wash.js');
const {render,examples,depthAt}=require('./renderer.js');
const {disks}=require('./test-shared-regions.cjs');
const commands=svg=>[...svg.matchAll(/\sd="([^"]*)"/g)].map(m=>m[1]);
const texts=svg=>svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/g)||[];
function engraving(svg){
 const groups=[],stack=[];
 for(const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)){
  if(m[0]==='</g>'){const start=stack.pop();assert(start);if(start.engraving)groups.push(svg.slice(start.index,m.index+m[0].length));}
  else if(!m[0].endsWith('/>'))stack.push({index:m.index,engraving:/\bdata-role="engraving"/.test(m[0])});
 }
 assert.equal(stack.length,0);assert(groups.length>1,'fixture exercises every owner engraving layer');return groups;
}
const originalFit=wash.fitContour;
for(const shadingMode of ['hatch','stipple','halftone'])for(const colorWash of [false,true]){
 const options={shadingMode,colorWash,labels:true,labelMatchFill:true};
 const exported=render(examples.ethanol,options);
 assert.equal(render(examples.ethanol,{...options,quality:'export'}),exported,'default remains export quality');
 let preview;
 wash.fitContour=()=>{throw new Error('preview invoked line fitting');};
 try{preview=render(examples.ethanol,{...options,quality:'preview',optimizePaths:true});}finally{wash.fitContour=originalFit;}
 const before=engraving(preview),after=engraving(exported);
 assert.equal(before.length,after.length,'same owner layers');
 for(let i=0;i<before.length;i++){
  assert.ok(commands(before[i]).every(d=>!/[CAQ]/.test(d)),'preview engraving skips fitting, independently of certified surface contours');
  assert.equal(commands(before[i]).length,commands(after[i]).length,'every owner retains its visibility runs/paths');
 }
 assert.ok(after.some(g=>commands(g).some(d=>d.includes('C'))),'export engraving retains fitted cubics');
 const surfaces=svg=>svg.match(/<path\b[^>]*data-role="surface-fill"[^>]*\/>/g)||[];
 assert(surfaces(preview).length>1);
 assert.deepEqual(surfaces(preview),surfaces(exported),'certified visible owner boundaries remain exact at either quality');
 assert(surfaces(preview).some(p=>commands(p).some(d=>d.includes('C'))),'analytic surface cubics are retained, not mislabeled as preview fitting');
 if(colorWash)assert(surfaces(preview).some(p=>!/\bfill="#ffffff"/.test(p)),'enabled wash paints element colors');
 else assert(surfaces(preview).every(p=>/\bfill="#ffffff"/.test(p)),'disabled wash still paints white owner occluders');
 assert.equal(commands(preview).length,commands(exported).length,'complete artwork visibility paths unchanged');
 assert.deepEqual(disks(preview),disks(exported),'all-owner stipple geometry/radii unchanged');
 if(shadingMode==='stipple')assert(disks(preview).length>1000,'comparison contains actual disks, not an empty circle-tag match');
 if(shadingMode==='halftone'){
  const paints=svg=>svg.match(/<rect\b[^>]*data-tone-level="[^"]+"[^>]*>/g)||[];
  assert(paints(preview).length>0,'actual halftone pattern paint, not definition circles');
  assert.deepEqual(paints(preview),paints(exported),'tone paint and clip references unchanged');
 }
 assert.deepEqual(texts(preview),texts(exported),'labels and typography unchanged');
 assert.ok(!/NaN|Infinity|undefined/.test(preview));
 console.log(`PASS ${shadingMode}/wash=${colorWash}: no engraving fitting, exact analytic owners, same dots/labels/runs`);
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
