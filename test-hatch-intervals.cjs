'use strict';
// Run: node test-hatch-intervals.cjs. Physical visibility, NOT the legacy
// renderer .00015 tolerance band. No implementation helpers solve test events.
const assert = require('node:assert/strict');
const renderer = require('./renderer.js');
const boundaries = require('./boundaries.js');
const started = performance.now();
const TAU = 2 * Math.PI, MARGIN = 2e-7, SAMPLES = 512;
const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,k) => a.map(v=>v*k);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => mul(a,1/Math.hypot(...a));
const stats = {scenes:0,circles:0,lines:0,fallbacks:0,probes:0,retained:0,omitted:0,endpointSkipped:0,boundaryDepthQueries:0,oracleDepthQueries:0};
const failures = [], fallbackLabels = [];
function check(condition,message) { if(!condition) failures.push(message); }
// Capture the actual centered/rotated renderer scene; always restore the module.
function capture(molecule,options={}) {
  const original = boundaries.build;
  let result;
  boundaries.build = function(scene,depthAt,project,scale) {
    const counted = (...args) => { stats.boundaryDepthQueries++; return depthAt(...args); };
    const api = original(scene,counted,project,scale);
    result = {scene,api};
    return api;
  };
  try { renderer.render(molecule,{...options,shadingSize:0,outlineWidth:0}); }
  finally { boundaries.build = original; }
  assert.ok(result,'renderer did not invoke boundaries.build');
  return result;
}
function direct(scene) {
  return {scene,api:boundaries.build(scene,(...args)=>{
    stats.boundaryDepthQueries++; return renderer.depthAt(...args);
  },p=>[p[0]*100,-p[1]*100],100)};
}
function visible(scene,source,p,circle) {
  if(circle && p[2]<source.c[2]) return false;
  for(const other of scene) {
    if(other===source) continue;
    stats.oracleDepthQueries++;
    if(renderer.depthAt(other,p[0],p[1])>p[2]+1e-9) return false;
  }
  return true;
}
function membership(ctx,source,at,spans,label,circle,extra=[]) {
  stats[circle?'circles':'lines']++;
  if(spans===null) { stats.fallbacks++; fallbackLabels.push(label); return; }
  if(!Array.isArray(spans)) { check(false,`${label}: invalid spans ${JSON.stringify(spans)}`); return; }
  let last=0;
  for(const span of spans) {
    if(!Array.isArray(span)||span.length!==2||!span.every(Number.isFinite)||span[0]<0||span[1]>1||span[0]>=span[1]||span[0]<last) {
      check(false,`${label}: invalid normalized/order span ${JSON.stringify(span)}`); return;
    }
    last=span[1];
  }
  const ends=[0,1,...spans.flat()];
  const probes=Array.from({length:SAMPLES},(_,i)=>(i+.371)/SAMPLES);
  // Explicitly inspect BOTH reported spans and their omitted complements,
  // including intervals far narrower than the independent uniform probe mesh.
  const cuts=[...new Set(ends)].sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++) probes.push((cuts[i-1]+cuts[i])/2);
  probes.push(...extra);
  let firstMismatch=null,mismatches=0;
  for(const t of probes) {
    if(ends.some(e=>Math.abs(t-e)<MARGIN)) { stats.endpointSkipped++; continue; }
    const p=at(t), actual=spans.some(([lo,hi])=>t>lo&&t<hi);
    const expected=visible(ctx.scene,source,p,circle);
    stats.probes++; stats[actual?'retained':'omitted']++;
    if(actual!==expected) {
      mismatches++;
      firstMismatch ||= {t,p,expected,actual,spans};
    }
  }
  if(mismatches) check(false,`${label}: ${mismatches} membership errors; first ${JSON.stringify(firstMismatch)}`);
}
function circle(ctx,s,c,u,v,label,extra) {
  const spans=ctx.api.clipCircle(s,c,u,v);
  membership(ctx,s,t=>add(c,add(mul(u,Math.cos(TAU*t)),mul(v,Math.sin(TAU*t)))),spans,label,true,extra);
  return spans;
}
function line(ctx,s,a,b,label,extra) {
  const spans=ctx.api.clipLine(s,a,b);
  membership(ctx,s,t=>add(a,mul(sub(b,a),t)),spans,label,false,extra);
  return spans;
}
function allHatches(ctx,label) {
  stats.scenes++;
  if(!ctx.api) { check(false,`${label}: whole-scene build fallback`); return; }
  for(const [i,s] of ctx.scene.entries()) {
    if(s.kind==='sphere') {
      for(const [secondary,axis0] of [[false,[.12,1,.40]],[true,[1,.22,-.32]]]) {
        const axis=norm(axis0), e=norm(cross(axis,[1,0,0])), f=cross(axis,e);
        const count=secondary?Math.max(8,Math.round(24*.8*s.r/.48)):Math.max(10,Math.round(24*s.r/.48));
        for(let j=1;j<count;j++) {
          const h=-1+2*j/count, r=Math.sqrt(1-h*h)*s.r;
          circle(ctx,s,add(s.c,mul(axis,h*s.r)),mul(e,r),mul(f,r),`${label}/sphere${i}/${secondary?'secondary':'primary'}/${j}`);
        }
      }
    } else {
      const e=norm(cross(s.u,Math.abs(s.u[2])<.95?[0,0,1]:[0,1,0])), f=cross(s.u,e),count=Math.round(24*.8);
      for(let j=0;j<count;j++) {
        const angle=TAU*j/count,n=add(mul(e,Math.cos(angle)),mul(f,Math.sin(angle)));
        if(n[2]<=0) continue; // The renderer emits only front generators.
        const a=add(s.a,mul(n,s.r));
        line(ctx,s,a,add(a,mul(s.u,s.length)),`${label}/cylinder${i}/generator${j}`);
      }
    }
  }
}
for(const [name,molecule] of Object.entries(renderer.examples)) allHatches(capture(molecule),`default-${name}`);
for(let i=0;i<20;i++) {
  // Fixed irrational increments spread orientations reproducibly, no randomness.
  allHatches(capture(renderer.examples.ethanol,{yaw:.25+i*2.399963229728653,pitch:-1.1+2.2*((i*7)%20)/19}),`rotated-ethanol-${i}`);
}
const defaultFallbacks=stats.fallbacks;
check(defaultFallbacks===0,`default/rotated curves fell back ${defaultFallbacks} times: ${fallbackLabels.slice(0,20).join(', ')}`);
const molecule=(positions,bonds)=>({name:'interval fixture',atoms:positions.map(position=>({element:'C',position})),bonds});
for(const [name,positions,bonds] of [
  ['crossed-rods',[[-3,0,0],[3,0,0],[0,-3,0],[0,3,0]],[[0,1],[2,3]]],
  ['acute-shared-endpoint',[[0,0,0],[6,0,0],[5.6,1.5,.4]],[[0,1],[0,2]]],
  // No 3-D contact: appearance/disappearance is purely projected silhouette.
  ['disconnected-projected-occluder',[[-3,0,0],[3,0,0],[0,-3,.8],[0,3,.8]],[[0,1],[2,3]]]
]) allHatches(capture(molecule(positions,bonds),{yaw:0,pitch:0}),name);
// Analytic independent almost-tangent physical intersection. The hidden gap is
// ~.012 world units, unrelated to the old .00015 depth visibility allowance.
{
  const ctx=capture(molecule([[-3,0,0],[3,0,0],[0,-3,0],[0,3,0]],[[0,1],[2,3]]),{yaw:0,pitch:0});
  assert.ok(ctx.api,'almost-tangent scene must build');
  const s=ctx.scene.find(s=>s.kind==='cylinder'),z=.11484,xroot=Math.sqrt(.115**2-z**2);
  const y=Math.sqrt(s.r*s.r-z*z),a=[-3,y,z],b=[3,y,z];
  const spans=line(ctx,s,a,b,'almost-tangent-physical',[-2*xroot,-.5*xroot,0,.5*xroot,2*xroot].map(x=>(x+3)/6));
  check(spans!==null,'almost-tangent physical generator fallback');
  if(spans) for(const x of [-xroot,xroot]) check(spans.flat().some(t=>Math.abs((-3+6*t)-x)<2e-7),`almost-tangent missing physical root x=${x}; spans=${JSON.stringify(spans)}`);
}
const sphere=(c,r=1)=>({kind:'sphere',c,r,element:'C'});
for(const name of ['full-ring','fully-hidden-ring','periodic-seam','tiny-visible-interval']) {
  const s=sphere([0,0,0]), scene=[s];
  if(name==='fully-hidden-ring') scene.push(sphere([0,0,3],.9));
  if(name==='periodic-seam') scene.push(sphere([-.4,0,3],.8));
  if(name==='tiny-visible-interval') scene.push(sphere([-.4,0,3],1-1e-5));
  const ctx=direct(scene); assert.ok(ctx.api,`${name}: build`);
  const spans=circle(ctx,s,[0,0,.8],[.6,0,0],[0,.6,0],name,[1e-5,1-1e-5,.0005,.9995]);
  check(spans!==null,`${name}: unexpected fallback`);
  if(name==='full-ring') check(JSON.stringify(spans)==='[[0,1]]',`${name}: ${JSON.stringify(spans)}`);
  if(name==='fully-hidden-ring') check(JSON.stringify(spans)==='[]',`${name}: ${JSON.stringify(spans)}`);
  if(name==='periodic-seam'||name==='tiny-visible-interval') {
    check(spans?.length===2&&spans[0][0]===0&&spans[1][1]===1,`${name}: seam must retain both ends: ${JSON.stringify(spans)}`);
    if(name==='tiny-visible-interval'&&spans) check(spans.reduce((n,[a,b])=>n+b-a,0)<.01,`${name}: expected total visible measure <.01`);
  }
}
// A collapsed projected ellipse must fall back locally without contaminating
// the closure's boundary array, scene identities, wash, or later valid queries.
{
  const s=sphere([0,0,0]),ctx=direct([s]);
  const snapshot=JSON.stringify(ctx.scene),identities=ctx.scene.slice();
  const before=ctx.api.wash(()=> '#abcdef',true), count=ctx.api.curveCount;
  assert.equal(typeof before,'string','mutation fixture needs valid wash');
  const valid=ctx.api.clipCircle(s,[0,0,.8],[.6,0,0],[0,.6,0]);
  for(let i=0;i<3;i++) {
    check(ctx.api.clipCircle(s,[0,0,0],[1,0,0],[0,0,1])===null,'edge-on circle should have per-curve fallback');
    check(ctx.api.wash(()=> '#abcdef',true)===before,'degenerate clip mutated subsequent wash');
    check(JSON.stringify(ctx.api.clipCircle(s,[0,0,.8],[.6,0,0],[0,.6,0]))===JSON.stringify(valid),'degenerate clip mutated valid subsequent clip');
  }
  check(ctx.api.curveCount===count,'degenerate clip mutated curve count');
  check(JSON.stringify(ctx.scene)===snapshot&&ctx.scene.every((s,i)=>s===identities[i]),'degenerate clip mutated input scene array');
}
check(stats.fallbacks===0,`ordinary hatch fixtures must not silently fall back: ${fallbackLabels.join(', ')}`);
check(stats.retained>0&&stats.omitted>0,'must independently test retained AND omitted samples');
console.log(JSON.stringify({seconds:+((performance.now()-started)/1000).toFixed(3),...stats,defaultFallbacks,fixtureFallbacks:stats.fallbacks-defaultFallbacks,failures:failures.length},null,2));
console.log('probes count independent parameter membership queries; boundaryDepthQueries includes build/validation/wash/clipping, oracleDepthQueries counts reference surface tests.');
if(fallbackLabels.length) console.log('Per-curve fallback labels: '+fallbackLabels.join(', '));
if(failures.length) {
  for(const failure of failures.slice(0,30)) console.error('FAIL '+failure);
  if(failures.length>30) console.error(`... ${failures.length-30} additional failing curves`);
  process.exitCode=1;
} else console.log('PASS hatch interval membership, physical rod intersections, seam/ring cases and fallback isolation');
