'use strict';
// Source-only regression: transpiles in memory, writes no build artifacts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function source(name) {
  const file = path.resolve(__dirname, 'src', name.replace(/\.js$/, '') + '.ts');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(id => id.startsWith('.') ? source(id) : require(id), module, module.exports);
  return module.exports;
}
const { createRegion, regionFromPath } = source('region-clipping');
const { create } = source('dot-regions');
const rect = (a,b,c,d) => [[a,b],[c,b],[c,d],[a,d]];
const edges = loops => loops.flatMap(loop => loop.map((p,i) => ({p,q:loop[(i+1)%loop.length]})));
// Independent vertical-ray parity oracle, deliberately no production index.
function membership(loops,x,y) {
  let n=0;
  for(const loop of loops) for(let i=0;i<loop.length;i++) {
    const p=loop[i],q=loop[(i+1)%loop.length];
    if((p[0]>x)!==(q[0]>x) && y < p[1]+(x-p[0])*(q[1]-p[1])/(q[0]-p[0])) n++;
  }
  return n%2===1;
}
const covered = (parts,t) => parts.some(([a,b])=>t>=a&&t<=b);
function check(region,loops,c,u,v) {
  const parts=region.clipEllipse(c,u,v); assert.notEqual(parts,null);
  for(let i=0;i<4096;i++) {
    const t=(i+.371)/4096,a=2*Math.PI*t,x=c[0]+u[0]*Math.cos(a)+v[0]*Math.sin(a),y=c[1]+u[1]*Math.cos(a)+v[1]*Math.sin(a);
    assert.equal(covered(parts,t),membership(loops,x,y),`ellipse membership at ${t}: ${JSON.stringify({c,u,v,parts})}`);
    assert.equal(region.contains(x,y),membership(loops,x,y));
  }
  for(let i=0;i<parts.length;i++) {
    assert(parts[i][0]>=0&&parts[i][1]<=1&&parts[i][1]>parts[i][0]);
    if(i) assert(parts[i-1][1]<parts[i][0]);
  }
}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('holes, nested islands, disconnected loops and affine ellipses match independent membership',()=>{
  const loops=[rect(-5,-4,5,4),rect(-2,-2,2,2),rect(-.6,-.6,.6,.6),rect(7,-1,10,3)];
  const r=createRegion(edges(loops));
  let seed=83451; const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<90;i++) {
    const c=[rand()*16-6,rand()*10-5], angle=rand()*6.28, a=.2+rand()*8,b=.2+rand()*4,shear=rand()-.5;
    check(r,loops,c,[a*Math.cos(angle),a*Math.sin(angle)],[b*(-Math.sin(angle)+shear*Math.cos(angle)),b*(Math.cos(angle)+shear*Math.sin(angle))]);
  }
});
test('wrap seam stays split; empty and full ellipses',()=>{
  const r=createRegion(edges([rect(0,-2,2,2)]));
  assert.deepEqual(r.clipEllipse([0,0],[1,0],[0,1]),[[0,.25],[.75,1]]);
  assert.deepEqual(r.clipEllipse([1,0],[.2,0],[0,.2]),[[0,1]]);
  assert.deepEqual(r.clipEllipse([-3,0],[.2,0],[0,.2]),[]);
});
test('tangencies and vertex roots do not invent spans',()=>{
  const r=createRegion(edges([rect(-1,-1,1,1)]));
  assert.deepEqual(r.clipEllipse([0,0],[1,0],[0,1]),[[0,1]]);
  assert.deepEqual(r.clipEllipse([2,0],[1,0],[0,1]),[]);
  check(r,[rect(-1,-1,1,1)],[.17,.31],[Math.SQRT2,0],[0,Math.SQRT2]);
  const diamond=[[[1,0],[0,1],[-1,0],[0,-1]]];
  assert.deepEqual(createRegion(edges(diamond)).clipEllipse([0,0],[1,0],[0,1]),[]);
});
test('lines preserve holes, disconnected islands, endpoints and coincident edges',()=>{
  const loops=[rect(-4,-3,4,3),rect(-1,-1,1,1),rect(6,-2,8,2)],r=createRegion(edges(loops));
  assert.deepEqual(r.clipLine([-5,0],[9,0]),[[1/14,4/14],[6/14,9/14],[11/14,13/14]]);
  assert.deepEqual(r.clipLine([-5,3],[5,3]),[[.1,.9]]);
  assert.deepEqual(r.clipLine([0,0],[0,0]),[]);
  assert.deepEqual(r.clipLine([3,0],[3,0]),[[0,1]]);
  assert.deepEqual(r.clipLine([4,3],[5,4]),[]);
  for(let j=0;j<25;j++) {
    const a=[-6,j*.3-4],b=[10,3-j*.19],parts=r.clipLine(a,b);
    for(let i=0;i<1000;i++){const t=(i+.317)/1000;assert.equal(covered(parts,t),membership(loops,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));}
  }
});
test('tiny missing holes are not merged away',()=>{
  const r=createRegion(edges([rect(-2,-2,2,2),rect(-1e-8,-1,1e-8,1)]));
  const parts=r.clipLine([-1,0],[1,0]);assert.equal(parts.length,2);assert(!covered(parts,.5));
  const arcs=r.clipEllipse([0,0],[1,0],[0,.5]);assert.equal(arcs.length,3);assert(!covered(arcs,.25));assert(!covered(arcs,.75));
});
test('degenerate, ill-conditioned and huge inversions request fallback',()=>{
  const r=createRegion(edges([rect(-1,-1,1,1)]));
  for(const [c,u,v] of [[[0,0],[0,0],[0,0]],[[0,0],[1,1],[2,2]],[[0,0],[1,0],[0,1e-14]],[[0,0],[1e100,0],[0,1e100]],[[Infinity,0],[1,0],[0,1]]]) assert.equal(r.clipEllipse(c,u,v),null);
  assert.deepEqual(createRegion([]).clipEllipse([0,0],[1,0],[0,1]),[]);
});
test('local M/L/Z paths preserve holes and reject incomplete contours',()=>{
  const r=regionFromPath('M-4,-4 L4,-4 4,4 -4,4 Z M-1 -1L1 -1L1 1L-1 1Z M6e0 0L8 0L8 2L6 2Z');
  const loops=[rect(-4,-4,4,4),rect(-1,-1,1,1),rect(6,0,8,2)];
  check(r,loops,[0,0],[3,0],[0,.5]);check(r,loops,[5,0],[3,0],[0,2]);
  assert.equal(r.contains(0,0),false);assert.equal(r.contains(7,1),true);
  assert.deepEqual(regionFromPath('').clipLine([0,0],[1,1]),[]);
  for(const bad of ['M0 0L1 0L1 1','M0 0Q1 1 2 2Z','M0 0L1 0M2 2L3 3Z','M0 0 L1 Z']) assert.throws(()=>regionFromPath(bad));
});
test('owner surfaces cache the exact validated polygons without changing dot queries',()=>{
  const loops=[rect(-4,-4,4,4),rect(-1,-1,1,1)],nodes=[],segments=[];
  for(const loop of loops){const base=nodes.length;nodes.push(...loop);loop.forEach((p,i)=>{const q=loop[(i+1)%loop.length];segments.push({c:{line:true,at:t=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]},a:0,b:1,start:base+i,end:base+(i+1)%loop.length,left:0,right:-1});});}
  const scene=[{kind:'sphere',c:[0,0,0],r:4},{kind:'sphere',c:[0,0,0],r:1}],r=create(scene,segments,nodes,p=>p,1);
  assert(r);const before=[];for(let x=-5;x<=5;x+=.25)before.push(r.query(x,.3,.2));
  assert.strictEqual(r.surface(0),r.surface(0));assert.equal(r.surface(1),null);assert.equal(r.surface(-1),null);
  assert.equal(r.surface(0).contains(0,0),false);assert.equal(r.surface(0).contains(2,0),true);
  const after=[];for(let x=-5;x<=5;x+=.25)after.push(r.query(x,.3,.2));assert.deepEqual(after,before);
  assert.equal(r.query(0,0,.2),null);assert.equal(r.query(2,0,.2).id,0);
  check(r.surface(0),loops,[0,0],[3,0],[0,.5]);
  const empty=create(scene,[],[],p=>p,1);assert.equal(empty.surface(0),null);assert.equal(empty.query(0,0,1),null);
});
test('sphere height families match independent front hemisphere and polygon membership',()=>{
  const center=[17,-23],radius=5;
  const circle=Array.from({length:257},(_,i)=>{const a=i*2*Math.PI/257;return [Math.cos(a)*(1+1e-12),Math.sin(a)*(1+1e-12)];});
  const local=[circle,rect(-.35,-.5,.2,.4),rect(.45,-.22,.85,.18)];
  const loops=local.map(loop=>loop.map(([x,y])=>[center[0]+radius*x,center[1]+radius*y]));
  const region=createRegion(edges(loops));
  for(const tilt of [0,.14,.8,1.48,1.66,2.3,Math.PI]) for(const spin of [0,.73]) {
    const axis=[Math.sin(tilt)*Math.cos(spin),Math.sin(tilt)*Math.sin(spin),Math.cos(tilt)];
    const e=[Math.cos(tilt)*Math.cos(spin),Math.cos(tilt)*Math.sin(spin),-Math.sin(tilt)],f=[-Math.sin(spin),Math.cos(spin),0];
    const family=region.sphereFamily(center,radius,axis,e,f);
    for(const h of [-.999,-.91,-.6,-.125,0,.125,.3,.6,.91,.999]) {
      const arcs=family(h);assert.notEqual(arcs,null);const radial=Math.sqrt(1-h*h);
      for(let i=0;i<2048;i++) {
        const t=(i+.391)/2048,co=Math.cos(2*Math.PI*t),si=Math.sin(2*Math.PI*t);
        const n=axis.map((a,k)=>h*a+radial*(e[k]*co+f[k]*si));
        const x=center[0]+radius*n[0],y=center[1]+radius*n[1];
        assert.equal(covered(arcs,t),n[2]>=0&&membership(loops,x,y),`family front/membership: tilt=${tilt}, spin=${spin}, h=${h}, t=${t}`);
      }
    }
  }
});
test('family silhouette cuts exclude back arcs even without boundary intersections',()=>{
  const r=createRegion(edges([rect(-2,-2,2,2)])),s=Math.SQRT1_2;
  const family=r.sphereFamily([0,0],1,[s,0,s],[s,0,-s],[0,1,0]);
  assert.deepEqual(family(0),[[.25,.75]]);
  assert.deepEqual(family(.9),[[0,1]]);assert.deepEqual(family(-.9),[]);
  const front=r.sphereFamily([0,0],1,[0,0,1],[1,0,0],[0,1,0]);
  assert.deepEqual(front(.5),[[0,1]]);assert.deepEqual(front(-.5),[]);
  assert.equal(front(1),null);assert.equal(front(-1),null);assert.equal(front(NaN),null);
});
test('family disjoint islands, long crossing edges and chart fallback',()=>{
  const loops=[rect(-.9,-.8,-.2,.8),rect(.15,-.7,.9,.7)],r=createRegion(edges(loops));
  const family=r.sphereFamily([0,0],1,[0,0,-1],[1,0,0],[0,-1,0]);
  for(const h of [-.3,-.7,-.95]) {
    const arcs=family(h),radial=Math.sqrt(1-h*h);
    for(let i=0;i<2048;i++){const t=(i+.123)/2048,a=t*2*Math.PI;assert.equal(covered(arcs,t),membership(loops,radial*Math.cos(a),-radial*Math.sin(a)));}
  }
  const crossing=createRegion(edges([rect(-2,-.2,2,.2)]));
  const clip=crossing.sphereFamily([0,0],1,[0,0,1],[1,0,0],[0,1,0])(.6);
  assert.equal(clip.length,3);assert(!covered(clip,.25));assert(covered(clip,0));
  assert.equal(r.sphereFamily([0,0],1,[1,0,0],[0,1,0],[0,0,1])(.2),null);
  assert.equal(r.sphereFamily([0,0],1,[0,0,1],[1,0,0],[1,0,0])(.2),null);
  assert.equal(r.sphereFamily([0,0],0,[0,0,1],[1,0,0],[0,1,0])(.2),null);
});
console.log(`${passed} region clipping tests passed (source-only; no artifacts written).`);
