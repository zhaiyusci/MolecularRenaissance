'use strict';
// Standalone, dependency-free: node test-analytic-boundaries.cjs. Writes no samples.
const assert = require('node:assert/strict');
const renderer = require('./renderer.js');
const boundaries = require('./boundaries.js');
const { buildWash } = require('./wash.js');
const started = performance.now();
const failures = [], fallbackCases = [], stats = { cases: 0, analytic: 0, buildFallback: 0, washFallback: 0, rays: 0, screened: 0, boundary: 0 };
// Work accounting. Every probe/render the file performs is counted here and capped
// by 'work stays inside the gate budget' at the bottom, so scale cannot creep back
// silently. Counts measured before this reduction pass are recorded next to the caps.
const work = { renders: 0, outlineProbes: 0, sweepViews: 0 };
const palette = { C: '#db4422', O: '#245acc', H: '#ffffff', N: '#33aa66', W: '#ffffff' };
const colors = e => palette[e] || '#d59922';
let seed = 0x6d2b79f5;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function test(name, fn) { try { fn(); } catch (e) { failures.push(name + ': ' + e.message); console.error('FAIL ' + failures.at(-1)); } }
const mid = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
function distance(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
  const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
// Independent de Casteljau flattening, not the production fitter or arrangement.
function flatten(d,closed=true) {
  assert.equal(d.replace(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?|[\s,]/gi,''),'','only M/L/C/Z supported');
  const tokens=d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
  const loops=[];let points=null,p,i=0;
  const point=()=>{const q=[Number(tokens[i++]),Number(tokens[i++])];assert.ok(q.every(Number.isFinite));return q;};
  function cubic(a,b,c,d,depth=0) {
    const flat=Math.max(distance(b,a,d),distance(c,a,d))<.001;
    assert.ok(depth<24||flat,'flattening converges');
    if(flat){points.push(d);return;}
    const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
    cubic(a,ab,abc,m,depth+1);cubic(m,bcd,cd,d,depth+1);
  }
  while(i<tokens.length) {
    const cmd=tokens[i++];
    if(cmd==='M'){assert.equal(points,null,'previous contour closed');p=point();points=[p];}
    else if(cmd==='L'){assert.ok(points);p=point();points.push(p);}
    else if(cmd==='C'){assert.ok(points);const b=point(),c=point(),q=point();cubic(p,b,c,q);p=q;}
    else if(cmd==='Z'){
      assert.ok(points&&points.length>=(closed?4:2),'nondegenerate contour');
      // The arrangement must actually meet, not use Z to conceal a missing arc.
      if(closed)assert.ok(Math.hypot(p[0]-points[0][0],p[1]-points[0][1])<.0002,'no implicit closing chord');
      loops.push(points);points=null;
    } else assert.fail('unexpected command '+cmd);
  }
  assert.equal(points,null,'all contours explicitly closed');return loops;
}
function parse(svg, analytic=true) {
  assert.equal(typeof svg,'string');assert.ok(!/NaN|Infinity|<image\b|<rect\b/.test(svg));
  if(analytic)assert.match(svg,/data-boundaries="analytic"/);
  const paths=[...svg.matchAll(/<path fill="([^"]+)" fill-rule="evenodd" d="([^"]+)"\/>/g)].map(m=>({color:m[1],loops:flatten(m[2])}));
  assert.equal(paths.length,(svg.match(/<path\b/g)||[]).length,'all fills parsed');
  for(const path of paths){path.edges=path.loops.flatMap(loop=>loop.slice(1).map((b,i)=>[loop[i],b]));}
  return paths;
}
function inside(loop,x,y) {
  let hit=false;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[i],b=loop[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
// Spatial indices. The probe loops below would scan every edge / every loop vertex
// per probe; at ~326k probes that is ~3.5e8 distance evaluations and it, not the
// case count, dominated this file's runtime (measured: 12.3s of 16.1s in the ray
// loop alone). Both indices are *exact* - conservative buckets, no approximation -
// so they change cost only, never which probes run or what they assert.
const NEAR_TAPER=.03, EDGE_CELL=1, BAND_CELL=2, KEY_OFF=1<<20, KEY_SPAN=1<<21;
// Boundary-probe spacing along the flattened arrangement, in SVG units, and the
// turn angle (radians) that marks an arrangement vertex. Measured: one probe per
// flattened sub-segment produced 182,284 probes (206 ms) and re-tested the same two
// states ~2x per sub-segment. Arc-length spacing keeps both sides of the boundary
// and every corner; the counts are pinned by the work cap at the bottom.
const BOUNDARY_PROBE_SPACING=2, BOUNDARY_CORNER_ANGLE=Math.PI/22.5;
const edgeKey=(i,j)=>(i+KEY_OFF)*KEY_SPAN+(j+KEY_OFF);
function buildEdgeIndex(edges) {
  const buckets=new Map();
  for(const e of edges){
    const x0=Math.min(e[0][0],e[1][0])-NEAR_TAPER,x1=Math.max(e[0][0],e[1][0])+NEAR_TAPER;
    const y0=Math.min(e[0][1],e[1][1])-NEAR_TAPER,y1=Math.max(e[0][1],e[1][1])+NEAR_TAPER;
    for(let i=Math.floor(x0/EDGE_CELL),ix=Math.floor(x1/EDGE_CELL);i<=ix;i++)
      for(let j=Math.floor(y0/EDGE_CELL),jy=Math.floor(y1/EDGE_CELL);j<=jy;j++){
        const key=edgeKey(i,j);let b=buckets.get(key);if(b===undefined)buckets.set(key,b=[]);b.push(e);
      }
  }
  return buckets;
}
// Exact equivalent of edges.some(([a,b])=>distance([x,y],a,b)<.03): a segment within
// .03 of p has its bounding box dilated by .03 covering p, and every segment is filed
// under each cell of that dilated box, so p's own cell is a sufficient lookup.
function nearBoundary(buckets,x,y) {
  const b=buckets.get(edgeKey(Math.floor(x/EDGE_CELL),Math.floor(y/EDGE_CELL)));
  if(b===undefined)return false;
  for(const e of b)if(distance([x,y],e[0],e[1])<NEAR_TAPER)return true;
  return false;
}
function buildActualIndex(paths) {
  const bands=new Map(); // y-band -> crossing edges; only these can cross a query row
  paths.forEach((path,pi)=>path.loops.forEach(loop=>{
    for(let i=0,j=loop.length-1;i<loop.length;j=i++){
      const a=loop[i],b=loop[j];if(a[1]===b[1])continue;
      for(let y=Math.floor(Math.min(a[1],b[1])/BAND_CELL),hy=Math.floor(Math.max(a[1],b[1])/BAND_CELL);y<=hy;y++){
        let arr=bands.get(y);if(arr===undefined)bands.set(y,arr=[]);arr.push([pi,a,b]);
      }
    }
  }));
  return {bands,paths};
}
function actualIndexed(index,x,y,crossed) {
  crossed.clear();
  const band=index.bands.get(Math.floor(y/BAND_CELL));
  if(band!==undefined)for(const [pi,a,b] of band)
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])crossed.set(pi,(crossed.get(pi)||0)^1);
  let hits=0,color=null;
  for(let pi=0;pi<index.paths.length;pi++)if(crossed.get(pi)){hits++;color=index.paths[pi].color;}
  assert.ok(hits<=1,`overlapping color contours at ${x},${y}`);
  return hits?color:null;
}
// Standalone form for the few assertions outside check(); identical indexed test.
const actualIndexCache=new WeakMap();
function actual(paths,x,y) {
  let index=actualIndexCache.get(paths);
  if(index===undefined)actualIndexCache.set(paths,index=buildActualIndex(paths));
  return actualIndexed(index,x,y,new Map());
}
function oracle(ctx,colorFor,x,y) {
  const o=ctx.project([0,0,0]);x=(x-o[0])/ctx.scale;y=(o[1]-y)/ctx.scale;
  const boxes=primitiveBoxes(ctx);
  let best=-Infinity,color=null;
  for(let k=0;k<ctx.scene.length;k++){
    const b=boxes[k];if(x<b[0]||x>b[1]||y<b[2]||y>b[3])continue;
    const s=ctx.scene[k],z=renderer.depthAt(s,x,y),c=s.kind==='sphere'?colorFor(s.element):null;
    const empty=c===null||c==='#ffffff';
    if(Number.isFinite(z)&&(z>best||(z===best&&empty))){best=z;color=empty?null:c;}
  }return color;
}
// Exact world-space bounding box of each primitive's projection. renderer.depthAt
// returns -Infinity outside it (sphere disc / cylinder's projected axis swept by r),
// so skipping a missed primitive cannot change the winner, the colour, or the tie
// break: it is the same oracle, no longer O(scene) per probe.
const primitiveBoxCache=new WeakMap();
function primitiveBoxes(ctx) {
  let boxes=primitiveBoxCache.get(ctx);
  if(boxes!==undefined)return boxes;
  const pad=1e-6;
  boxes=ctx.scene.map(s=>{
    let a,b;
    if(s.kind==='sphere'){a=s.c;b=s.c;}
    else {a=s.a;b=[s.a[0]+s.u[0]*s.length,s.a[1]+s.u[1]*s.length,s.a[2]+s.u[2]*s.length];}
    const r=s.r+pad;
    return [Math.min(a[0],b[0])-r,Math.max(a[0],b[0])+r,Math.min(a[1],b[1])-r,Math.max(a[1],b[1])+r];
  });
  primitiveBoxCache.set(ctx,boxes);return boxes;
}
function capture(molecule,options={}) {
  const original=boundaries.build;let context;
  boundaries.build=function(scene,depthAt,project,scale){
    const result=original(scene,depthAt,project,scale);context={scene,project,scale,result};return result;
  };
  try { work.renders++; const svg=renderer.render(molecule,{width:460,height:360,colorWash:true,hatchWidth:0,outlineWidth:0,...options});assert.match(svg,/<svg/); }
  finally { boundaries.build=original; }
  assert.ok(context,'renderer calls boundaries.build');return context;
}
// The 17 presets are rendered through the default options twice in this file (the
// default loop and the shared-outline test). The renderer is deterministic and both
// call sites use identical options, so the second render only re-ran an exercised
// branch: capture once per preset and share the recorded context.
const capturedContexts=new Map();
function captureOnce(name,molecule){
  let context=capturedContexts.get(name);
  if(context===undefined)capturedContexts.set(name,context=capture(molecule));
  return context;
}
function check(name,ctx,{required=false,fallback=false,colorFor=colors,dense=false,preview=false}={}) {
  stats.cases++;
  const result=ctx.result===undefined?boundaries.build(ctx.scene,renderer.depthAt,ctx.project,ctx.scale):ctx.result;
  const svg=result?result.wash(colorFor,preview):null;
  if(svg===null){
    stats[result?'washFallback':'buildFallback']++;
    fallbackCases.push({name,stage:result?'wash':'build'});
    // Exercise the actual general implementation: fallback must return finite SVG.
    const legacy=buildWash(ctx.scene,renderer.depthAt,ctx.project,ctx.scale,colorFor,{fitCurves:false});
    assert.equal(typeof legacy,'string');assert.match(legacy,/<g/);assert.ok(!/NaN|Infinity/.test(legacy));
    assert.ok(!required,name+' unexpectedly fell back');return null;
  }
  stats.analytic++;assert.ok(!fallback,name+' must conservatively fall back');
  assert.ok(Number.isInteger(result.curveCount)&&result.curveCount>0);
  assert.ok(Number.isInteger(result.segmentCount)&&result.segmentCount>0);
  const paths=parse(svg), edges=paths.flatMap(p=>p.edges);
  const edgeBuckets=buildEdgeIndex(edges), actualIndex=buildActualIndex(paths), crossed=new Map();
  const actualAt=(px,py)=>actualIndexed(actualIndex,px,py,crossed);
  const ps=ctx.scene.filter(s=>s.kind==='sphere').map(s=>({p:ctx.project(s.c),r:s.r*ctx.scale}));
  const lo=[0,1].map(k=>Math.min(...ps.map(s=>s.p[k]-s.r))-2),hi=[0,1].map(k=>Math.max(...ps.map(s=>s.p[k]+s.r))+2);
  // Offset oracle screening rejects genuinely ambiguous near-boundary rays, not errors.
  for(let i=0;i<1400;i++){
    const x=lo[0]+random()*(hi[0]-lo[0]),y=lo[1]+random()*(hi[1]-lo[1]);
    const expected=oracle(ctx,colorFor,x,y);
    if([[.03,0],[-.03,0],[0,.03],[0,-.03]].some(([dx,dy])=>oracle(ctx,colorFor,x+dx,y+dy)!==expected)) {stats.screened++;continue;}
    if(nearBoundary(edgeBuckets,x,y)){stats.screened++;continue;}
    stats.rays++;assert.equal(actualAt(x,y),expected,`${name}: membership at ${x.toFixed(5)},${y.toFixed(5)}`);
  }
  if(dense){
    // Both sides of the arrangement boundary. Probes are placed by arc length
    // rather than one per flattened sub-segment (the sub-segments are artifacts of
    // the .001 flattening budget, so per-segment probing re-tested the same two
    // states ~2x per sub-segment), but a probe is always emitted at a corner, where
    // two arrangement curves join - the vertices are exactly where boundary
    // membership changes and where regressions surface. Endpoints are avoided
    // because multi-way intersection normals are undefined.
    for(const path of paths)for(const loop of path.loops){
      let carry=BOUNDARY_PROBE_SPACING,px=0,py=0;
      for(let k=1;k<loop.length;k++){
        const a=loop[k-1],b=loop[k],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if(length<1e-7)continue;
        const ux=dx/length,uy=dy/length;
        const corner=k>1&&(ux*px+uy*py)<Math.cos(BOUNDARY_CORNER_ANGLE);
        px=ux;py=uy;carry+=length;
        if(carry<BOUNDARY_PROBE_SPACING&&!corner)continue;
        carry=0;
        for(const sign of [-1,1]){
          const x=a[0]+dx/2-sign*uy*NEAR_TAPER,y=a[1]+dy/2+sign*ux*NEAR_TAPER;
          stats.boundary++;
          const got=actualAt(x,y),expected=oracle(ctx,colorFor,x,y);
          // Near tangent contours a .03 normal probe can land on a DIFFERENT
          // boundary. Allow only an independently verified true transition within
          // .003 (cubic + flattening budget), not a blanket tangency exemption.
          const onOtherBoundary=got!==expected&&Array.from({length:32},(_,k)=>{
            const angle=k*Math.PI/16;
            return oracle(ctx,colorFor,x+.003*Math.cos(angle),y+.003*Math.sin(angle))!==expected;
          }).some(Boolean);
          assert.ok(got===expected||onOtherBoundary,`${name}: continuous boundary sides at ${x.toFixed(5)},${y.toFixed(5)}: ${got} vs ${expected}`);
        }
      }
    }
  }
  return paths;
}
const sphere=(x,y,z,r=1,element='C')=>({kind:'sphere',c:[x,y,z],r,element});
function rod(a,b,r=.22){const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);return {kind:'cylinder',a,u:d.map(v=>v/length),length,r};}
const context=scene=>({scene,project:p=>[180+p[0]*40,180-p[1]*40],scale:40});
function sceneTest(name,scene,options={}){test(name,()=>check(name,context(scene),options));}
for(const [name,molecule] of Object.entries(renderer.examples))test('default '+name,()=>check(name,captureOnce(name,molecule),{required:true,dense:name==='sphere'||name==='pair'}));
let sweepAccepted=0;
// Camera corpus. The uniform 40-view random sweep of the yaw/pitch domain was
// measured to visit only 3 distinct arrangement regimes, keyed by
// (paths|loops|spheres|cylinders): 2|2|9|8, 2|3|9|8 and 2|4|9|8 - 37 of its 40
// views repeated a branch an earlier view had already exercised, so the continuous
// angle domain is sampled at its regime representatives instead of uniformly.
// These 5 views all come from that measured corpus and cover every regime plus both
// pitch extremes and yaw ~ pi. The angle-dependent fallbacks that were actually
// found by the 1,325-view stress corpus are NOT sampled - they are pinned
// individually in grazingViews below and every one of them is still exercised.
const SWEEP_VIEWS=[
  [-1.124820970976938,0.45643754978176],    // regime 2|2|9|8
  [3.127980256453099,-0.7816149870243956],  // regime 2|4|9|8, yaw ~ pi
  [1.3741550595996754,-1.5350554094708007], // regime 2|3|9|8, pitch ~ -pi/2
  [1.2009299789368997,1.423711582159184],   // pitch ~ +pi/2
  [1.9592509418659774,0.5019948668554504],  // regime 2|4|9|8
];
const SWEEP_DENSE=new Set([1,4]); // both 4-loop regimes keep the boundary sweep
for(const [i,[yaw,pitch]] of SWEEP_VIEWS.entries()){
  work.sweepViews++;
  test('ethanol sweep '+i,()=>{if(check(`ethanol ${i} yaw=${yaw} pitch=${pitch}`,capture(renderer.examples.ethanol,{yaw,pitch}),{dense:SWEEP_DENSE.has(i)}))sweepAccepted++;});
}
console.log(`Ethanol deterministic sweep acceptance: ${sweepAccepted}/${SWEEP_VIEWS.length}`);
test('all ordinary rotation views remain analytic',()=>assert.equal(sweepAccepted,SWEEP_VIEWS.length,'ordinary ethanol rotations must not fall back to the area grid'));
sceneTest('disjoint color overlap',[sphere(-.6,0,0,1,'C'),sphere(.6,0,2.5,1,'O')],{required:true,dense:true});
sceneTest('identical hues',[sphere(-.6,0,0),sphere(.6,0,2.5)],{required:true,colorFor:()=> '#33aa66',dense:true});
test('white hole',()=>{
  const p=check('white hole',context([sphere(0,0,0,2),sphere(0,0,3,.55,'W')]),{required:true,dense:true});
  assert.equal(p.length,1);assert.equal(p[0].loops.length,2);assert.equal(actual(p,180,180),null);
});
sceneTest('all white',[sphere(0,0,0)],{required:true,colorFor:()=> '#ffffff'});
for(const [name,b] of [['horizontal',[3,0,0]],['vertical',[0,3,0]],['camera parallel',[0,0,3]],['oblique',[2,1,2]],['near axial',[.0003,0,3]],['grazing',[3,0,.001]]]){
  const a=[0,0,0];sceneTest(name,[sphere(...a),sphere(...b,1,'O'),rod(a,b)],{required:name==='oblique',dense:true});
}
for(const yaw of [0,.4,1.2,Math.PI/2-1e-5])test('rotated pair '+yaw,()=>check('rotated pair '+yaw,capture(renderer.examples.pair,{yaw,pitch:.3}),{dense:true}));
sceneTest('intersecting spheres',[sphere(0,0,0),sphere(1,0,.4,1,'O')],{required:true,dense:true});
sceneTest('free caps',[sphere(0,0,0),rod([-2,0,2],[2,0,2])],{fallback:true});
sceneTest('nonincident cylinder contact',[sphere(-3,0,0),sphere(3,0,0),sphere(0,.6,0,.5,'O'),rod([-3,0,0],[3,0,0])],{fallback:true});
for(const reversed of [false,true]){
  const a=[-2,0,0],b=[2,.3,.7];sceneTest(reversed?'reversed duplicate bonds':'duplicate bonds',[sphere(...a),sphere(...b,1,'O'),rod(a,b),rod(reversed?b:a,reversed?a:b)]);
}
const a=[0,0,0],b=[4,0,0],c=[3.7,1.7,0];
sceneTest('acute same endpoint cylinders',[sphere(...a),sphere(...b,.65,'O'),sphere(...c,.65,'N'),rod(a,b,.4),rod(a,c,.4)],{dense:true});
const ends=[[-3,0,0],[3,0,0],[0,-3,0],[0,3,0]];
sceneTest('crossing rods',[...ends.map((p,i)=>sphere(...p,.7,i<2?'C':'O')),rod(ends[0],ends[1]),rod(ends[2],ends[3])],{dense:true});
sceneTest('preview sphere/contact',[sphere(0,0,0),sphere(2,1,2,1,'O'),rod([0,0,0],[2,1,2])],{required:true,preview:true,dense:true});
// Measured on the pinned corpus: probing every flattened outline segment produced
// 95,050 probes (c60 21,849, phospholipid 27,207) because flatten() emits one point
// per .001 deviation, re-probing the same silhouette circle ~364x per sphere. A
// silhouette is a smooth closed curve, so a bounded, evenly spaced sample
// characterises it. Each sample stays the midpoint of a real flattened sub-segment:
// those carry a deliberate inward bias of at most the .001 flattening sagitta, which
// is what keeps the radius budget below meaningful (raw vertices sit exactly on the
// silhouette and hit exact depth tangencies - sampling them fails on 'water').
const OUTLINE_PROBES_PER_LOOP=48, OUTLINE_MIN_PROBES=24;
test('shared sphere outlines stay visible silhouettes, never contact arcs',()=>{
  for(const [name,molecule] of Object.entries(renderer.examples)){
    const ctx=captureOnce(name,molecule),o=ctx.project([0,0,0]);assert.ok(ctx.result);
    let probes=0;
    for(const s of ctx.scene.filter(s=>s.kind==='sphere')){
      const svg=ctx.result.outline(s,false,.8),center=ctx.project(s.c);
      assert.ok(!/NaN|Infinity/.test(svg));
      const boxes=primitiveBoxes(ctx),si=ctx.scene.indexOf(s);
      for(const match of svg.matchAll(/\bd="([^"]+)"/g))for(const loop of flatten(match[1]+'Z',false)){
        const n=loop.length,samples=Math.min(OUTLINE_PROBES_PER_LOOP,n-2);
        for(let k=0;k<samples;k++){
          const i=Math.round(k*(n-2)/Math.max(1,samples-1));
          const p=mid(loop[i],loop[i+1]);
          assert.ok(Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-s.r*ctx.scale)<.003,`${name}: outline is a sphere silhouette, not a contact ellipse`);
          const x=(p[0]-o[0])/ctx.scale,y=(o[1]-p[1])/ctx.scale;
          for(let oi=0;oi<ctx.scene.length;oi++){
            if(oi===si)continue;
            const b=boxes[oi];
            if(x<b[0]||x>b[1]||y<b[2]||y>b[3])continue; // depthAt is -Infinity here
            assert.ok(renderer.depthAt(ctx.scene[oi],x,y)<=s.c[2]+.00015+.03/ctx.scale,`${name}: hidden silhouette stroke at ${p}`);
          }
          probes++;work.outlineProbes++;
        }
      }
    }
    assert.ok(probes>=OUTLINE_MIN_PROBES,`${name}: outline coverage (${probes} samples)`);
  }
});
test('analytic fill never invokes grid fallback',()=>{
  const helper=require('./wash.js'), original=helper.buildWash;
  helper.buildWash=()=>{throw new Error('analytic example invoked grid fallback');};
  try {for(const molecule of Object.values(renderer.examples)){
    work.renders++;
    const svg=renderer.render(molecule,{colorWash:true,hatchWidth:0,outlineWidth:0});
    assert.match(svg,/data-hatch-mode="layered"/);assert.match(svg,/data-role="surface-fill"/);
  }} finally {helper.buildWash=original;}
});
for(const stage of ['build','wash'])test('renderer fallback wiring '+stage,()=>{
  const helper=require('./wash.js'),originalBuild=boundaries.build,originalWash=helper.buildWash;let calls=0;
  boundaries.build=stage==='build'?()=>null:()=>({wash:()=>null,validate:()=>true,outline:()=>''});
  helper.buildWash=function(...args){calls++;return originalWash(...args);};
  try {const svg=renderer.render(renderer.examples.sphere,{width:240,height:240,colorWash:true,hatchWidth:0,outlineWidth:0});
    work.renders++;
    assert.equal(calls,1);assert.match(svg,/<g class="mol-wash"/);assert.ok(!/NaN|Infinity/.test(svg));
  }finally {boundaries.build=originalBuild;helper.buildWash=originalWash;}
});
// The classic-script build is the same source as the CommonJS build, whose twin
// test above already renders all 17 presets and asserts the identical three
// properties. Rendering all 17 again here only re-ran an exercised branch, at 2.7x
// the CJS cost per render in a vm context (measured 22 ms vs 8 ms; the cost is
// independent of canvas size, 136 ms vs 139 ms for 460x360 vs 200x200). The unique
// content here is the 4-file classic-script load and its global wiring, so this
// renders one molecule per regime: 1 primitive, spheres+cylinders, many spheres.
const VM_RENDER_MOLECULES=['sphere','ethanol','glucose'];
test('classic browser script loading',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const browser=vm.createContext({console});
  for(const file of ['boundaries.js','wash.js','dots.js','renderer.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),browser,{filename:file});
  assert.equal(typeof browser.MolBoundaries.build,'function');assert.equal(typeof browser.MolDots.buildDots,'function');
  const original=browser.MolWash.buildWash;browser.MolWash.buildWash=()=>{throw new Error('browser example invoked grid fallback');};
  try {for(const name of VM_RENDER_MOLECULES){
    work.renders++;
    const svg=browser.MolEngraver.render(browser.MolEngraver.examples[name],{colorWash:true,hatchWidth:0,outlineWidth:0});
    assert.match(svg,/data-hatch-mode="layered"/);assert.match(svg,/data-role="surface-fill"/);assert.ok(!/NaN|Infinity/.test(svg));
  }}finally {browser.MolWash.buildWash=original;}
});
// Additional failures found by the 1,325-view stress corpus. Require analytic
// geometry at both the small regression canvas and the actual default size.
const grazingViews=[
 [-.18644507928306797,.49061171110132223],[.569000828299843,-.8215483422946456],
 [-.8126780526286194,-.8432483437868096],[-.6371577324970495,-.9645005467020416],
 [-2.986086815598884,.03985344337017005],[.09604898368284481,.14384343165630245],
 [2.1967801227669246,-.9380755231594577],[-2.8262499530434164,-1.1747330660160389],
 [.3844761932624149,.9840663796632341],[-2.683071432283322,.4655343511000486],
 [-Math.PI/4,-Math.PI/3]
];
for(const [i,[yaw,pitch]] of grazingViews.entries())for(const [width,height] of [[460,360],[900,700]])
 test('grazing rotation '+i+' width '+width,()=>check('grazing rotation '+i+' width '+width,
  capture(renderer.examples.ethanol,{yaw,pitch,width,height}),{required:true,dense:true}));
for(const delta of [-.0005,0,.0005]){
  sceneTest('projected external tangency '+delta,[sphere(0,0,0),sphere(2+delta,0,3,1,'O')],{dense:true});
  sceneTest('projected tangent hole '+delta,[sphere(0,0,0,2),sphere(1.5+delta,0,4,.5,'W')],{dense:true});
}
test('unrepresentable side probes cannot silently erase a region',()=>{
 const scene=[sphere(0,0,0)];
 assert.equal(boundaries.build(scene,renderer.depthAt,p=>[1e13+p[0]*40,1e13-p[1]*40],40),null);
});
// Work caps. Every constant is pinned just above what this corpus actually needs
// today, so an accidental return to uniform sweeping fails loudly instead of
// quietly costing minutes. Measured counts are in each comment; the "was" value is
// the pre-reduction count, kept so the reduction is auditable.
//
// MAX_RAYS deliberately still allows the full 1,400-ray screen per case: that sweep
// was measured, not assumed, to be load-bearing. Its distinct oracle-ownership
// states were counted (1,509 across 103 cases) and every candidate replacement
// sampler was measured against that set - a 27x27 stratified grid misses 43 states
// (2.8%), a 31x31 grid misses 44, Halton(2,3) at 961 points misses 38 - so no
// smaller or more structured sample covers every state, and the reduction was
// refused. The ray loop is cheap only because the oracle is now culled exactly.
const MAX_CASES=75;             // measured 72 (was 107)
const MAX_RAYS=100000;          // measured 95,078 (was 144,028)
const MAX_BOUNDARY_PROBES=30000;// measured 24,684 by arc length + corners (was 182,284)
const MAX_OUTLINE_PROBES=26000; // measured 23,439 at 48 samples/loop (was 95,050)
const MAX_RENDERS=75;           // measured 70 (was 136: 40 random views + 17 duplicate)
const MAX_SWEEP_VIEWS=5;        // 40 uniform views visited only 3 regimes; 5 cover them
test('work stays inside the gate budget',()=>{
  assert.ok(stats.cases<=MAX_CASES,`cases ${stats.cases} > ${MAX_CASES}`);
  assert.ok(stats.rays<=MAX_RAYS,`rays ${stats.rays} > ${MAX_RAYS}`);
  assert.ok(stats.boundary<=MAX_BOUNDARY_PROBES,`boundary probes ${stats.boundary} > ${MAX_BOUNDARY_PROBES}`);
  assert.ok(work.outlineProbes<=MAX_OUTLINE_PROBES,`outline probes ${work.outlineProbes} > ${MAX_OUTLINE_PROBES}`);
  assert.ok(work.renders<=MAX_RENDERS,`renders ${work.renders} > ${MAX_RENDERS}`);
  assert.ok(work.sweepViews<=MAX_SWEEP_VIEWS,`sweep views ${work.sweepViews} > ${MAX_SWEEP_VIEWS}`);
});
console.log('Fallback cases: '+JSON.stringify(fallbackCases));
console.log(JSON.stringify({...stats,outlineProbes:work.outlineProbes,renders:work.renders,sweepViews:work.sweepViews,sweepAccepted,failures:failures.length,milliseconds:Math.round(performance.now()-started)}));
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('PASS analytic boundary regressions');
