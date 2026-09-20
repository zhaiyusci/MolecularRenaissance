import assert from 'node:assert/strict';
import {load} from './scripts/load-painter.mjs';
import {painterCases} from './scripts/painter-cases.mjs';
const {planPainterSpheres,renderPainter}=await load('painter-experiment.js');
const {render,examples}=await load('renderer.js');
const sphere=(c,r=1)=>({kind:'sphere',c,r});
let seed=29187;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let accepted=0,rejected=0,probes=0;
function check(spheres){
  const plan=planPainterSpheres(spheres);
  if(plan.route==='fallback'){rejected++;assert.equal(plan.order.length,0);return plan;}
  accepted++;assert.equal(new Set(plan.order).size,spheres.length);
  for(const [a,b] of plan.edges)assert(plan.order.indexOf(a)<plan.order.indexOf(b));
  const x0=Math.min(...spheres.map(s=>s.c[0]-s.r)),x1=Math.max(...spheres.map(s=>s.c[0]+s.r));
  const y0=Math.min(...spheres.map(s=>s.c[1]-s.r)),y1=Math.max(...spheres.map(s=>s.c[1]+s.r));
  for(let j=0;j<37;j++)for(let i=0;i<37;i++){
    const x=x0+(i+.317)/37*(x1-x0),y=y0+(j+.619)/37*(y1-y0);
    let owner=-1,z=-Infinity,paint=-1;
    const depths=spheres.map(s=>{const q=s.r*s.r-(x-s.c[0])**2-(y-s.c[1])**2;return q<0?-Infinity:s.c[2]+Math.sqrt(q);});
    for(let k=0;k<spheres.length;k++)if(depths[k]>z){owner=k;z=depths[k];}
    for(const k of plan.order)if(Number.isFinite(depths[k]))paint=k;
    if(owner!==paint&&Number.isFinite(z)&&Math.abs(z-depths[paint])<1e-8)continue;
    assert.equal(paint,owner,`paint order must equal independent front-depth oracle at ${x},${y}`);probes++;
  }
  return plan;
}
assert.equal(check([sphere([0,0,-2]),sphere([.4,0,2])]).route,'painter');
assert.deepEqual(check([sphere([0,0,0],2),sphere([.2,0,.8],.5)]).order,[1,0],'nested unequal spheres cannot use center-z sorting');
assert.equal(check([sphere([0,0,0]),sphere([.7,0,.25])]).route,'fallback','front-surface crossing must not be flattened into one order');
assert.equal(check([sphere([0,0,0]),sphere([.1,0,1.5])]).route,'painter','a hidden intersection circle need not reject the whole pair');
check([sphere([0,0,0]),sphere([2,0,0])]);
assert.equal(check([sphere([0,0,0]),sphere([0,0,0])]).route,'fallback');
for(let n=0;n<400;n++)check(Array.from({length:n<300?2:6},()=>sphere([(random()-.5)*6,(random()-.5)*6,(random()-.5)*8],.2+random()*1.1)));
const fixture=painterCases(examples).find(c=>c.name==='overlap-separated').model;
const result=renderPainter(fixture,{labels:true,yaw:0,pitch:0,quality:'preview'});
assert.equal(result.route,'painter');assert.equal(result.wholeLabels,2,'hidden anchor is not grounds to omit the label');
assert.equal((result.svg.match(/data-role="element-label"/g)||[]).length,2);
assert.equal(result.boundaryBuilds,0);assert.equal(result.sceneVisibilityTests,0);
assert.equal(result.hatchTemplates,1);
const uncached=renderPainter(fixture,{labels:true,yaw:0,pitch:0,quality:'preview'},{reuseHatches:false});
assert.equal(uncached.hatchTemplates,2);
const templateBodies=svg=>[...svg.matchAll(/<g id="[^"]+-hatch-template-\d+">([\s\S]*?)<\/g>/g)].map(m=>m[1]);
assert(templateBodies(uncached.svg).every(body=>body===templateBodies(result.svg)[0]),'template reuse does not simplify or change the generated hatch geometry');
assert.equal(result.svg,renderPainter(fixture,{labels:true,yaw:0,pitch:0,quality:'preview'}).svg,'deterministic output');
const groups=[];
for(const m of result.svg.matchAll(/<\/?(?:g|text)\b[^>]*>/g)){
  const tag=m[0];if(tag.startsWith('</g'))groups.pop();else if(tag.startsWith('<g'))groups.push(tag);
  else if(tag.includes('data-role="element-label"'))assert(!/clip-path=|mask=/.test(tag)&&groups.every(g=>!/clip-path=|mask=/.test(g)),'whole label is not clipped');
}
for(const [model,options] of [[examples.c60,{labels:true}],[examples.sphere,{castShadows:true}],[examples.sphere,{shadingMode:'stipple'}],[examples.sphere,{lightType:'point'}]]){
  const trial=renderPainter(model,options);assert.equal(trial.route,'fallback');assert.equal(trial.svg,render(model,options),'fallback preserves original scene and options');
}
console.log(JSON.stringify({accepted,rejected,probes,hiddenAnchorLabels:result.wholeLabels,boundaryBuilds:result.boundaryBuilds},null,2));
