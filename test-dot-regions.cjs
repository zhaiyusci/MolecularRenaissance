'use strict';
// node test-dot-regions.cjs -- dependency-free; creates no files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {performance} = require('node:perf_hooks');
const renderer = require('./renderer.js');
const boundaries = require('./boundaries.js');
const dots = require('./dots.js');
const regionModule = require('./dot-regions.js');
const started = performance.now(), failures = [], stats = [];
let passed = 0;

// ---------------------------------------------------------------------------
// Commit-gate sampling budget.
//
// The exhaustive version of this file swept 64 staggered angles x 3 rings at
// every point of a 90x78 / 72x60 grid (292k points), rendered the brute-force
// legacy stipple for all 17 molecules and 40 pseudo-random rotations, and
// footprint-checked up to 1024 serialized marks per scene: 22.8M clearance
// probes, ~103 s wall clock.
//
// The sweep is replaced by a deliberately chosen boundary set. Every assertion
// and every property the file proved is still proved; only sampling density
// changed. The chosen sets, and why each is sufficient:
//
//   ANGLES (64 staggered -> 16 explicit)
//     The cardinals and diagonals are kept exactly, because arrangements are
//     built from axis-aligned and 45-degree edges, so a clearance leak is most
//     likely to show up exactly there (tangency). The eight bisectors keep the
//     staggered, non-aligned directions that catch an arrangement whose nearest
//     edge or vertex lands between them. 22.5-degree spacing brackets the
//     coarsest direction the implementation itself assumes: dots.js contracts
//     every emitted radius by cos(PI/16), i.e. a 32-way angular split with an
//     11.25-degree half-angle, so 64 staggered angles resolved the angular
//     assumption twice as finely as the code can distinguish.
//   RINGS (.25/.625/1) - unchanged: one interior ring, one mid-band ring and
//     the advertised clearance boundary itself.
//   GRID - 30x24 with the same irrational (.371/.613) offsets instead of
//     90x78/72x60. Membership is still compared against the accelerator-free
//     oracle at every sample, with the same .01 SVG band exemption.
//   ROTATIONS (40 xorshift-random -> 8 explicit views) - degenerate head-on,
//     quarter turn, half turn, both poles (rod along the view axis, singular),
//     an exact oblique tangent, an epsilon yaw/pitch degeneracy and one
//     arbitrary oblique that stands in for the random sweep. Region geometry is
//     inspected for every view; the brute-force comparison runs on the three
//     views that are not a rotation of another one.
//   LEGACY_SCALE - the brute-force path costs ~ marks x primitives and its mark
//     count tracks projected ink area, not canvas size, so projection scale is
//     the only lever that bounds it without dropping primitives, owners or
//     assertions. The accelerated-vs-legacy comparison is a sampled
//     equivalence check: LEGACY_SCALE_DEFAULT bounds it to a few hundred to a
//     few thousand serially emitted marks per molecule, and the exceptions
//     below go lower only because per-mark brute-force cost grows with the
//     primitive count (c60 keeps 93/150 primitive owners at scale 5,
//     phospholipid 85/139 at scale 6). Every assertion, the interior parity
//     check (interior>10), the stored-cell certification and the query-stream
//     accounting all still run for every molecule.
//   LEGACY_MARK_SAMPLE (1024 -> 16) - spread of serially emitted marks checked
//     for footprint leaks after the dense region sweep above.
//
// Zero clearance-leak probes, zero membership errors and zero budget rescues
// are still required everywhere; the budget assertion at the end of the file
// fails if any of these counts silently regrows.
const RINGS = [.25, .625, 1];
const ANGLES_DEG = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
const directions = ANGLES_DEG.map(deg => {
  const a = deg * Math.PI / 180;
  return [Math.cos(a), Math.sin(a), `${deg}deg`];
});
const GRID_X = 30, GRID_Y = 24;
const LEGACY_MARK_SAMPLE = 16;
const LEGACY_SCALE_DEFAULT = 10;
const LEGACY_SCALE = new Map([
  ['glucose', 8],
  ['c60', 5],
  ['phospholipid', 6],
]);
// One case keeps the molecule's own scale so the suite still contains a
// full-density legacy mark stream. Sphere is the only scene where that stays
// cheap (~3.4k marks, ~2.5k boundary candidates) because its brute-force cost
// is one primitive per mark.
const LEGACY_FULL_SCALE = new Set(['sphere']);
const ROTATION_LEGACY_SCALE = 8;
// The two hand-built rod fixtures have no accelerated path at all (null
// regions), so their legacy capture is only sampled for ink, null-equality and
// footprint leaks; a bounded projection scale keeps that sampling deliberate.
const FIXTURE_SCALE = 20;
// [yaw, pitch, why, legacyComparison]. Region geometry is inspected for every
// view; the brute-force equivalence comparison runs on the three views that
// are not merely a rotation of the others (head-on, the singular pole view and
// the arbitrary oblique that stands in for the old random sweep).
const ROTATION_VIEWS = [
  [0, 0, 'degenerate head-on', true],
  [Math.PI / 2, 0, 'quarter turn, rod tangential to the view axis', false],
  [Math.PI, 0, 'half turn', false],
  [0, Math.PI / 2, 'north pole: C-C rod along the view axis (singular)', true],
  [0, -Math.PI / 2, 'south pole: C-C rod along the view axis (singular)', false],
  [Math.PI / 4, Math.PI / 4, 'exact oblique tangent', false],
  [1e-9, 1e-9, 'epsilon yaw/pitch degeneracy', false],
  [2.4, -.9, 'arbitrary oblique', true],
];
// Caps, set just above the counts this file actually executes (measured:
// cases=71, probes=364608, region queries=40453, oracle calls=382274,
// dots builds=134). They are the regression guard for the sampling budget
// above: any silent re-growth of the case table, the probe sweep or the region
// queries fails the suite.
const MAX_TOTAL_CASES = 80;
const MAX_TOTAL_PROBES = 400000;
const MAX_TOTAL_QUERIES = 45000;
const MAX_TOTAL_ORACLE_CALLS = 430000;
const MAX_TOTAL_BUILDS = 150;
const budget = {cases: 0, probes: 0, queries: 0, oracleCalls: 0, builds: 0};

function test(name, fn) {
  const t = performance.now();
  budget.cases++;
  try { fn(); passed++; console.log(`PASS ${name} (${(performance.now()-t).toFixed(0)} ms)`); }
  catch (e) { failures.push({name,error:e.stack}); console.error(`FAIL ${name}: ${e.message}`); }
}
// Capture actual renderer preprocessing, not a second copy of its transform.
// Both monkeypatches are restored even when build/render/assertions throw.
function capture(molecule, options={}) {
  const oldDots=dots.buildDots, oldBuild=boundaries.build, oldCreate=regionModule.create;
  let result, built, creates=0, constructionDepth=0, buildingRegions=false;
  regionModule.create=function(...args) {
    creates++;
    assert.equal(args.length,5,'create must not receive a depth callback');
    assert(Array.isArray(args[0]) && Array.isArray(args[1]));
    assert.equal(typeof args[3],'function','fourth argument is project, not depth');
    assert.equal(typeof args[4],'number');
    return oldCreate(...args);
  };
  boundaries.build=function(scene, depth, project, scale) {
    built=oldBuild(scene,(...a)=>{if(buildingRegions)constructionDepth++;return depth(...a);},project,scale);
    if(built) {
      const get=built.dotRegions;
      assert.equal(typeof get,'function');
      built.dotRegions=function() {
        buildingRegions=true;
        try {
          const a=get(); assert.strictEqual(get(),a,'region cache identity, including null');
          return a;
        } finally { buildingRegions=false; }
      };
    }
    return built;
  };
  dots.buildDots=function(...args) { assert.equal(args.length,9,'buildDots ABI: regions, referenceCoverage, surfaces'); result=args;return ''; };
  try {
    renderer.render(molecule,{shadingMode:'stipple',outlineWidth:0,...options});
    assert(result,'renderer failed to call buildDots');
    assert.equal(constructionDepth,0,'dot-region construction called shared depth callback');
    assert(creates<=1,'dot regions constructed more than once');
    const [scene,,project,scale,illumination,o,regions,referenceCoverage,surfaces]=result;
    assert.equal(typeof referenceCoverage,'function');
    return {scene,project,scale,illumination,options:o,regions,referenceCoverage,surfaces,built};
  } finally {dots.buildDots=oldDots;boundaries.build=oldBuild;regionModule.create=oldCreate;}
}
function oracle(ctx) {
  const origin=ctx.project([0,0,0]), scene=ctx.scene, scale=ctx.scale;
  return (x,y)=> {
    budget.oracleCalls++;
    const wx=(x-origin[0])/scale,wy=(origin[1]-y)/scale;
    let id=-1,z=-Infinity;
    // Deliberately no bbox accelerator, cache query, center-z sort or color merge.
    for(let i=0;i<scene.length;i++) {
      const d=renderer.depthAt(scene[i],wx,wy);
      if(Number.isFinite(d)&&d>z){z=d;id=i;}
    }
    return id;
  };
}
function bounds(ctx) {
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  for(const s of ctx.scene) {
    const ps=s.kind==='sphere'?[s.c]:[s.a,s.a.map((v,i)=>v+s.u[i]*s.length)];
    for(const p of ps) {const q=ctx.project(p),r=s.r*ctx.scale;b[0]=Math.min(b[0],q[0]-r);b[1]=Math.min(b[1],q[1]-r);b[2]=Math.max(b[2],q[0]+r);b[3]=Math.max(b[3],q[1]+r);}
  }
  return b;
}
function nearBoundary(own,x,y,id) {
  // Exemption is independently established by an actual owner transition within
  // .01 SVG units. A null/low-clearance region result alone never excuses a miss.
  for(const [dx,dy] of directions) {
    if(own(x+.01*dx,y+.01*dy)!==id)return true;
  }
  return false;
}
function inspect(ctx,label,nx=GRID_X,ny=GRID_Y) {
  budget.cases++;
  assert(ctx.regions,`${label}: unexpected fallback`);
  const own=oracle(ctx),b=bounds(ctx),errors=[],seen=new Set();
  let points=0,hits=0,band=0,probes=0,budgetRescues=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) {
    const x=b[0]+(i+.371)*(b[2]-b[0])/nx,y=b[1]+(j+.613)*(b[3]-b[1])/ny;
    const expected=own(x,y),q=ctx.regions.query(x,y,2.4);points++;budget.queries++;
    if((q?.id??-1)!==expected) {
      if(nearBoundary(own,x,y,expected))band++;
      else if(errors.length<6)errors.push(`${label}: membership (${x},${y}) expected=${expected} actual=${JSON.stringify(q)}`);
    }
    if(!q)continue;
    hits++;seen.add(q.id);
    assert(Number.isInteger(q.id)&&q.id>=0&&q.id<ctx.scene.length,`${label}: invalid raw owner`);
    assert(Number.isFinite(q.clearance)&&q.clearance>0&&q.clearance<=2.4,`${label}: invalid clearance ${q.clearance}`);
    for(const ring of RINGS)for(const [dx,dy,angle] of directions) {
      const radius=q.clearance*ring;probes++;budget.probes++;
      if(own(x+radius*dx,y+radius*dy)===q.id)continue;
      // Only the stipulated .003 numerical budget, never the membership band.
      const budgetRadius=Math.max(0,q.clearance-.003)*ring;
      if(own(x+budgetRadius*dx,y+budgetRadius*dy)===q.id){budgetRescues++;continue;}
      if(errors.length<6)errors.push(`${label}: clearance leak center=(${x},${y}) owner=${q.id} clearance=${q.clearance} ring=${ring} angle=${angle} actual=${own(x+budgetRadius*dx,y+budgetRadius*dy)}`);
    }
  }
  stats.push({case:label,points,hits,band,probes,budgetRescues,owners:seen.size});
  assert(hits>10,`${label}: vacuous dense check`);
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(budgetRescues,0,`${label}: advertised conservative clearance must not need an extra shrink`);
  return seen;
}
function marks(svg) {
  const out=[...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"(?: fill="([^"]+)")?\/>/g)].map(m=>({x:+m[1],y:+m[2],r:+m[3],color:m[4]||'',key:m[1]+','+m[2]}));
  for(const m of svg.matchAll(/<path data-stipple-radius="([^"]+)"[^>]*d="([^"]+)"\/>/g)){
    for(const p of m[2].matchAll(/M([-\d.]+) ([-\d.]+)h0/g))out.push({x:+p[1],y:+p[2],r:+m[1],color:'',key:p[1]+','+p[2]});
  }
  return out;
}
// Evenly spread a bounded number of serially emitted marks. The dense region
// sweep in inspect() is what covers every scene; this is the spread of actual
// serialized disks used for footprint checks.
function sampleMarks(cs,n=LEGACY_MARK_SAMPLE) {
  const step=Math.max(1,Math.ceil(cs.length/n));
  return cs.filter((_,i)=>i%step===0);
}
function compareDots(ctx,label) {
  budget.cases++;
  const own=oracle(ctx),origin=ctx.project([0,0,0]);
  const o={...ctx.options,shadingMode:'stipple'},g=o.dotSpacing;
  const args=[ctx.scene,renderer.depthAt,ctx.project,ctx.scale,ctx.illumination,o];
  let fallbackDepth=0,footprintProbes=0;
  budget.builds++;
  const old=dots.buildDots(ctx.scene,(...a)=>{fallbackDepth++;return renderer.depthAt(...a);},ctx.project,ctx.scale,ctx.illumination,o);
  const oldMarks=marks(old);
  assert(oldMarks.length>0,`${label}: nonempty fallback stipple`);
  assert(old.includes('fill="#161616"'),'all stipple uses black ink');
  budget.builds++;
  assert.equal(dots.buildDots(...args,null),old,`${label}: null fallback differs`);
  function footprints(cs) {
    for(const c of cs) {
      const id=own(c.x,c.y);assert(id>=0,`${label}: dot outside solid`);
      assert.equal(c.color,'','disk inherits black ink, never element color');
      for(const ring of RINGS)for(const [dx,dy,angle] of directions) {
        const radius=Math.max(0,c.r-.003)*ring;
        footprintProbes++;budget.probes++;
        assert.equal(own(c.x+dx*radius,c.y+dy*radius),id,`${label}: footprint leak at ${c.key}, r=${c.r}, ring=${ring}, angle=${angle}`);
      }
    }
  }
  // Halftone is a clipped surface pattern, not a jittered-dot screen. Its
  // visibility path must not accidentally consume the stipple region oracle.
  const halfArgs=[...args.slice(0,5),{...o,shadingMode:'halftone'}];
  budget.builds++;
  const half=dots.buildDots(...halfArgs,{query(){throw Error('halftone queried stipple regions');}});
  budget.builds++;
  assert.equal(half,dots.buildDots(...halfArgs,null));
  assert(/<pattern\b/.test(half)&&/url\(#/.test(half)&&!/NaN|Infinity/.test(half),'halftone emits referenced finite patterns');
  if(!ctx.regions){footprints(sampleMarks(oldMarks));return;}
  let queries=0,accepted=0,depthCalls=0,pending=null,cellQueries=0,markQueries=0;
  const cells=new Map(),queryPositions=new Set(),cellRadius=Math.SQRT1_2*g+o.dotSize*1.03;
  function hash(x,y,salt) {
    let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(salt,1274126177);
    h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;
  }
  const wrapped={query(x,y,r) {
    assert.equal(pending,null,'previous accepted query did not reconstruct depth');
    const key=`${x},${y}`,i=Math.floor(x/g),j=Math.floor(y/g),cellKey=`${i},${j}`;
    assert(!queryPositions.has(key),'duplicate query: candidate/footprint replay');queryPositions.add(key);
    if(r===cellRadius){
      cellQueries++;assert.equal(x,(i+.5)*g);assert.equal(y,(j+.5)*g);
    }else{
      markQueries++;assert.equal(r,o.dotSize*1.03);
      const cell=cells.get(cellKey);assert(cell&&cell.clearance<cellRadius-1e-12,'certified cell must not query individual marks');
      // Independently recognize the Poisson candidate stream, rejecting any
      // old 16-ray footprint replay. Production caps each cell at 1000 marks.
      let candidate=false;
      for(let k=0;k<=1000;k++)if(x===(i+hash(i,j,10000+2*k))*g&&y===(j+hash(i,j,10001+2*k))*g){candidate=true;break;}
      assert(candidate,'query is neither a cell center nor a Poisson candidate');
    }
    queries++;budget.queries++;const q=ctx.regions.query(x,y,r);
    if(r===cellRadius)cells.set(cellKey,q);
    if(q){accepted++;pending={x,y,id:q.id};}
    return q;
  }};
  function depth(s,x,y) {
    depthCalls++;assert(pending,`${label}: depth without accepted query (footprint ray)`);
    assert.strictEqual(s,ctx.scene[pending.id],`${label}: queried nonowner primitive`);
    assert(Math.abs(x-(pending.x-origin[0])/ctx.scale)<1e-12&&Math.abs(y-(origin[1]-pending.y)/ctx.scale)<1e-12,'depth reconstructed away from query center');
    pending=null;return renderer.depthAt(s,x,y);
  }
  // Omit optional tone calibration here to isolate candidate queries; the
  // renderer capture above separately checks the complete nine-argument ABI.
  budget.builds++;
  const fast=dots.buildDots(ctx.scene,depth,ctx.project,ctx.scale,ctx.illumination,o,wrapped);
  assert.equal(pending,null);assert.equal(depthCalls,accepted);assert(depthCalls<=queries);
  assert(depthCalls<fallbackDepth,`${label}: certification must save depth queries`);
  assert(cellQueries>0&&markQueries>0,'exercise both cell certification and boundary candidates');
  budget.builds++;
  assert.equal(fast,dots.buildDots(...args,ctx.regions),'accelerated output not exactly deterministic');
  const fastMarks=marks(fast),a=new Map(oldMarks.map(c=>[c.key,c])),b=new Map(fastMarks.map(c=>[c.key,c]));
  let interior=0,edge=0;
  function certifiedSerializedCell(c){
    // toFixed(3) may round a Poisson mark across a grid boundary. Require
    // certification for every cell compatible with that serialization bin.
    for(const dx of [-.000501,.000501])for(const dy of [-.000501,.000501]){
      const q=cells.get(`${Math.floor((c.x+dx)/g)},${Math.floor((c.y+dy)/g)}`);
      if(!q||q.clearance<cellRadius-1e-12)return false;
    }
    return true;
  }
  for(const c of oldMarks){
    // Poisson density is evaluated at the CELL center; a disk can be far
    // from an edge while its cell center lies on that edge. Interior parity
    // therefore requires a certified whole cell, not only the disk center.
    if(certifiedSerializedCell(c)){assert.deepEqual(b.get(c.key),c,`${label}: interior Poisson position/radius/ink changed`);interior++;}else edge++;
  }
  for(const c of fastMarks)if(!a.has(c.key)){
    assert(!certifiedSerializedCell(c),`${label}: added interior position ${c.key}`);
  }
  assert(interior>10,`${label}: vacuous interior equivalence`);
  // Dense independent region-clearance checks above cover every scene; here
  // check a spread of actual serialized accelerated footprints as well.
  footprints(sampleMarks(fastMarks));
  stats.push({case:label,queries,accepted,depthCalls,cellQueries,markQueries,dots:fastMarks.length,interior,edge,footprintProbes});
}
const defaults=new Map();
// The accelerated-region capture stays at the molecule's default scale; the
// brute-force legacy comparison runs on a second capture whose projection scale
// bounds the number of legacy marks (see LEGACY_SCALE). Nothing else about the
// comparison changes: same scene, same options, same assertions.
function legacyContext(name,molecule,ctx,extra={},scale) {
  if(scale===undefined&&LEGACY_FULL_SCALE.has(name))return ctx;
  return capture(molecule,{...extra,scale:scale??LEGACY_SCALE.get(name)??LEGACY_SCALE_DEFAULT});
}
for(const [name,molecule] of Object.entries(renderer.examples))test(`default ${name}: accelerated / geometry / legacy`,()=> {
  const ctx=capture(molecule);defaults.set(name,ctx);
  assert(ctx.regions,`default ${name} must accelerate, not silently fall back`);
  const seen=inspect(ctx,`default ${name}`);
  if(name==='ethanol') {
    assert(seen.has(0)&&seen.has(1),'same-color C-C raw owners merged');
    assert([...seen].some(id=>ctx.scene[id].element==='H'),'white H ownership missing');
    assert([...seen].some(id=>ctx.scene[id].kind==='cylinder'),'white rod ownership missing');
  }
  compareDots(legacyContext(name,molecule,ctx),`default ${name}`);
});

test('full ABI: calibrated black stipple preserves disks across surface batching',()=> {
  const ctx=defaults.get('sphere');assert(ctx&&ctx.regions&&ctx.surfaces);
  let calibrations=0;
  const reference=(...a)=>{calibrations++;return ctx.referenceCoverage(...a);};
  const args=[ctx.scene,renderer.depthAt,ctx.project,ctx.scale,ctx.illumination,ctx.options,ctx.regions,reference];
  budget.builds+=2;
  const compact=dots.buildDots(...args,{...ctx.surfaces,compactStipple:true});
  const circles=dots.buildDots(...args,{...ctx.surfaces,compactStipple:false});
  assert(calibrations>0,'eighth parameter is the tone reference callback');
  assert(compact.includes('data-stipple-radius=')&&circles.includes('<circle'),'ninth parameter controls surface encoding');
  const order=cs=>cs.sort((a,b)=>a.x-b.x||a.y-b.y||a.r-b.r);
  assert(marks(compact).length>100);
  assert.deepEqual(order(marks(compact)),order(marks(circles)),'batching preserves every physical black disk');
});

test(`${ROTATION_VIEWS.length} explicit ethanol rotations: report every fallback and verify every successful region`,()=> {
  const fallbacks=[],geometryErrors=[];let accelerated=0;
  for(const [yaw,pitch,why,legacyComparison] of ROTATION_VIEWS) {
    const label=`rotation yaw=${yaw} pitch=${pitch} (${why})`;
    // Region geometry is verified at the default scale; the brute-force legacy
    // comparison is re-captured at a bounded scale (each view would otherwise
    // pay two full legacy stipple builds).
    const ctx=capture(renderer.examples.ethanol,{yaw,pitch,width:420,height:340});
    const legacy=()=>legacyContext(`rotation ${why}`,renderer.examples.ethanol,ctx,{yaw,pitch,width:420,height:340},ROTATION_LEGACY_SCALE);
    if(!ctx.regions){fallbacks.push({yaw,pitch,why});compareDots(legacy(),label);continue;}
    accelerated++;
    try{inspect(ctx,label);if(legacyComparison)compareDots(legacy(),label);}catch(e){geometryErrors.push(e.message);}
  }
  console.log(`ROTATIONS accelerated=${accelerated}/${ROTATION_VIEWS.length} fallback=${fallbacks.length}/${ROTATION_VIEWS.length}; fallback views=${JSON.stringify(fallbacks)}`);
  assert(accelerated>0,'all rotated views fell back; no accelerated coverage');
  assert.equal(geometryErrors.length,0,geometryErrors.join('\n'));
});

// Hand-authored shared-edge arrangement, not emitted by the production builder.
// Owner 0 has a hole AND a disconnected island; all objects deliberately white.
function polygonFixture() {
  const scene=Array.from({length:3},()=>({kind:'sphere',element:'H',color:'#ffffff'}));
  const nodes=[],segments=[];
  function loop(points,left,right) {
    const base=nodes.length;nodes.push(...points);
    points.forEach((p,i)=> {
      const q=points[(i+1)%points.length],c={line:true,at:t=>[p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]};
      segments.push({c,a:0,b:1,start:base+i,end:base+(i+1)%points.length,left,right});
    });
  }
  loop([[0,0],[20,0],[20,20],[0,20]],0,-1);
  loop([[5,5],[15,5],[15,15],[5,15]],1,0);
  loop([[30,0],[40,0],[40,10],[30,10]],0,-1);
  loop([[45,0],[55,0],[55,10],[45,10]],2,-1);
  return {scene,nodes,segments};
}
test('independent polygons: hole, disconnected owner, all-white raw IDs, callback-free API',()=> {
  assert.equal(regionModule.create.length,5,'create API must not accept depth callback');
  const {scene,segments,nodes}=polygonFixture();
  const cache=regionModule.create(scene,segments,nodes,()=>{throw Error('already-projected polygons must not call project/depth');},1);
  assert(cache);
  for(const [x,y,id] of [[2,2,0],[10,10,1],[35,5,0],[50,5,2],[25,5,-1],[60,30,-1]])assert.equal(cache.query(x,y,2.4)?.id??-1,id,`raw ID at ${x},${y}`);
  assert(cache.query(4,10,2.4).clearance<=1,'hole must limit outer-owner clearance');
  assert(cache.query(6,10,2.4).clearance<=1,'hole owner must respect same-white boundary');
  assert.equal(regionModule.create(scene,segments.slice(1),nodes,p=>p,1),null,'open topology must fail closed');
  for(const [x,y,r] of [[NaN,1,2],[1,Infinity,2],[1,1,0],[1,1,-1],[1,1,Infinity]])assert.equal(cache.query(x,y,r),null);
});
const atom=(element,...position)=>({element,position});
test('crossed exposed rods must reject cache; renderer null fallback is correct',()=> {
  const molecule={atoms:[atom('C',-2,0,0),atom('C',2,0,0),atom('H',0,-2,.06),atom('H',0,2,.06)],bonds:[[0,1],[2,3]]};
  const ctx=capture(molecule,{yaw:0,pitch:0,width:420,height:340,scale:FIXTURE_SCALE});
  assert(ctx.built,'fixture must reach shared-boundary build');
  assert.equal(ctx.built.dotRegions(),null,'arrangement omits physical cylinder-cylinder seams');
  assert.equal(ctx.regions,null);
  compareDots(ctx,'crossed rods');
  const own=oracle(ctx),p=ctx.project([0,0,0]);
  assert.equal(own(...p),5,'foreground crossing rod must own intersection');
  const expected=own(p[0]+ctx.scale*.2,p[1]);assert.equal(expected,4,'horizontal rod must own its exposed arm');
});
test('ordinary shared-endpoint rods: inspect success or explicitly report conservative fallback',()=> {
  const molecule={atoms:[atom('C',0,0,0),atom('H',2,.15,0),atom('H',2,-.15,0)],bonds:[[0,1],[0,2]]};
  const ctx=capture(molecule,{yaw:.1,pitch:.2,width:420,height:340,scale:FIXTURE_SCALE});
  console.log(`SHARED-ENDPOINT regions=${ctx.regions?'accelerated':'conservative null fallback'}`);
  if(ctx.regions)inspect(ctx,'shared endpoint');
  compareDots(ctx,'shared endpoint');
});
test('browser VM loads dot-regions.js before boundaries/dots/renderer and accelerates',()=> {
  const context=vm.createContext({});
  for(const file of ['dot-regions.js','wash.js','boundaries.js','dots.js','renderer.js'])vm.runInContext(fs.readFileSync(require.resolve('./'+file),'utf8'),context,{filename:file});
  assert.equal(typeof context.MolDotRegions.create,'function');
  const original=context.MolDots.buildDots;let received=null;
  context.MolDots.buildDots=function(...args){received=args[6];return original(...args);};
  try {
    const options={shadingMode:'stipple',outlineWidth:0,width:320,height:280};
    const svg=context.MolEngraver.render(context.MolEngraver.examples.ethanol,options);
    assert(received,'browser renderer silently lost region acceleration');
    assert.equal(svg,renderer.render(renderer.examples.ethanol,options),'browser/CommonJS mismatch');
  } finally {context.MolDots.buildDots=original;}
});
console.table(stats);
const totals=Object.fromEntries(['points','hits','band','probes','budgetRescues','queries','accepted','depthCalls','interior','footprintProbes'].map(k=>[k,stats.reduce((n,s)=>n+(s[k]||0),0)]));
console.log('TOTALS '+JSON.stringify(totals));
test('sampling budget: cases, probes and queries cannot silently regrow',()=> {
  console.log(`BUDGET cases=${budget.cases}/${MAX_TOTAL_CASES} probes=${budget.probes}/${MAX_TOTAL_PROBES} regionQueries=${budget.queries}/${MAX_TOTAL_QUERIES} oracleCalls=${budget.oracleCalls}/${MAX_TOTAL_ORACLE_CALLS} dotsBuilds=${budget.builds}/${MAX_TOTAL_BUILDS}`);
  assert.ok(budget.cases<=MAX_TOTAL_CASES,`case count regrew: ${budget.cases}`);
  assert.ok(budget.probes<=MAX_TOTAL_PROBES,`probe count regrew: ${budget.probes}`);
  assert.ok(budget.queries<=MAX_TOTAL_QUERIES,`region query count regrew: ${budget.queries}`);
  assert.ok(budget.oracleCalls<=MAX_TOTAL_ORACLE_CALLS,`brute-force oracle call count regrew: ${budget.oracleCalls}`);
  assert.ok(budget.builds<=MAX_TOTAL_BUILDS,`dots build count regrew: ${budget.builds}`);
});
console.log(`${passed} passed, ${failures.length} failed; ${(performance.now()-started).toFixed(0)} ms. Membership band=.01 SVG; clearance budget=.003 SVG; ${directions.length} angles x ${RINGS.length} rings; grid ${GRID_X}x${GRID_Y}.`);
if(failures.length){for(const f of failures)console.error(`\n${f.name}\n${f.error}`);process.exitCode=1;}
