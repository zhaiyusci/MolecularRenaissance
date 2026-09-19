'use strict';
// Standalone regression oracle: deliberately preserve the original array-based
// arithmetic, tolerances and operation order. No build snapshot or dependencies.
const assert = require('node:assert/strict');
const { depthAt } = require('./renderer.js');
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = a => mul(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function oracle(s, x, y) {
  if (s.kind === 'sphere') {
    const d = s.r*s.r - (x-s.c[0])**2 - (y-s.c[1])**2;
    return d < -1e-10 ? -Infinity : s.c[2] + Math.sqrt(Math.max(0, d));
  }
  const w = [x-s.a[0], y-s.a[1], -s.a[2]], u = s.u;
  const wu = dot(w,u), A = 1-u[2]*u[2];
  const B = 2*(w[2]-wu*u[2]), C = dot(w,w)-wu*wu-s.r*s.r;
  let best = -Infinity;
  if (A > 1e-12) {
    const disc = B*B-4*A*C;
    if (disc >= -1e-10) {
      const q = Math.sqrt(Math.max(0,disc));
      for (const z of [(-B-q)/(2*A), (-B+q)/(2*A)]) {
        const t = wu+z*u[2];
        if (t >= -1e-8 && t <= s.length+1e-8) best = Math.max(best,z);
      }
    }
  }
  if (Math.abs(u[2]) > 1e-12) {
    for (const t of [0,s.length]) {
      const z = (t-wu)/u[2], v = sub(add(w,[0,0,z]),mul(u,t));
      if (dot(v,v) <= s.r*s.r+1e-10) best = Math.max(best,z);
    }
  }
  return best;
}
let seed = 0x58d3a91f;
function random() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
const signed = () => random()*2-1;
const vector = scale => [signed()*scale,signed()*scale,signed()*scale];
let queries = 0, hits = 0, misses = 0, failures = 0;
const groups = Object.create(null), details = [];
function check(s,x,y,label) {
  const expected = oracle(s,x,y), actual = depthAt(s,x,y);
  queries++; groups[label] = (groups[label] || 0)+1;
  if (expected === -Infinity) misses++; else hits++;
  const ok = expected === -Infinity ? actual === -Infinity
    : Number.isFinite(actual) && Math.abs(actual-expected) <= 1e-9*(1+Math.abs(expected));
  if (!ok) {
    failures++;
    if (details.length < 12) details.push({label,shape:structuredClone(s),x,y,expected:String(expected),actual:String(actual)});
  }
}
const sphere = (c,r) => ({kind:'sphere',c,r});
const cylinder = (a,u,length,r) => ({kind:'cylinder',a,u:norm(u),length,r});
// Independent sanity checks anchor the copied oracle as well as the implementation.
for (const [s,x,y,z] of [
  [sphere([0,0,2],3),0,0,5], [sphere([0,0,2],3),3,0,2],
  [sphere([0,0,2],3),4,0,-Infinity],
  [cylinder([0,0,2],[0,0,1],4,1),0,0,6],
  [cylinder([0,0,2],[0,0,-1],4,1),0,0,2],
  [cylinder([0,0,0],[1,0,0],4,1),2,0,1],
  [cylinder([0,0,0],[0,1,0],4,1),0,2,1]
]) { assert.equal(oracle(s,x,y),z); check(s,x,y,'analytic'); }

// Exact and epsilon-offset silhouettes include the original tolerance fringes.
const epsilons = [-1e-6,-1e-8,-1e-10,-1e-12,0,1e-12,1e-10,1e-8,1e-6];
for (const center of [[0,0,0],[1.25,-2.5,7],[1e6,-1e6,1e6],[1e9,1e9,-1e9]]) {
  for (const r of [1e-5,.115,.48,1,1000]) {
    const s = sphere(center,r);
    for (let i=0;i<16;i++) for (const epsilon of epsilons) {
      const angle = i*Math.PI/8, radius = r+epsilon;
      check(s,center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle),'sphere tangent +/-epsilon');
    }
    // Explicit squared-radius tolerance boundary, not only geometric tangency.
    for (const e of [.999,1,1.001]) check(s,center[0]+Math.sqrt(r*r+1e-10*e),center[1],'sphere tolerance edge');
  }
}
const axes = [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],
  [1,2,3],[-3,1,-2],[1e-8,0,1],[1e-6,0,1],[1.01e-6,0,1],
  [1e-5,-1e-5,-1],[1,0,1e-13],[1,0,1e-12],[1,0,1.01e-12]];
for (const a of [[0,0,0],[1.25,-2.5,7],[1e6,-1e6,1e6],[1e9,1e9,-1e9]]) {
  for (const axis of axes) for (const r of [.115,1,100]) {
    const s = cylinder(a,axis,3.5,r);
    const e = norm(cross(s.u,Math.abs(s.u[2])<.95?[0,0,1]:[0,1,0]));
    const f = cross(s.u,e);
    // t=0/length, both sides of axial tolerance, tangent and near-tangent rays.
    for (const t of [-2e-8,-1e-8,-1e-12,0,1e-12,1.75,3.5-1e-12,3.5,3.5+1e-12,3.5+1e-8,3.5+2e-8]) {
      for (const epsilon of epsilons) for (let j=0;j<8;j++) {
        const angle=j*Math.PI/4, p=add(add(a,mul(s.u,t)),mul(add(mul(e,Math.cos(angle)),mul(f,Math.sin(angle))),r+epsilon));
        check(s,p[0],p[1],'cylinder cap/side/tangent boundary');
      }
    }
  }
}
// Broad deterministic random coverage: ordinary, microscopic and large scenes;
// generate rays around the projected solid so both hit and miss are exercised.
for (let i=0;i<50000;i++) {
  const scale = [1e-4,1,10,1e4,1e8][i%5];
  const r = (.05+random()) * (i%5===4 ? 10 : scale);
  if (i%2===0) {
    const s = sphere(vector(scale),r);
    check(s,s.c[0]+signed()*r*1.5,s.c[1]+signed()*r*1.5,'random sphere');
  } else {
    const axis = i%3===0 ? axes[i%axes.length] : vector(1);
    const s = cylinder(vector(scale),axis,(.1+random()*4)*r,r);
    const t = (random()*1.4-.2)*s.length;
    check(s,s.a[0]+s.u[0]*t+signed()*r*1.5,s.a[1]+s.u[1]*t+signed()*r*1.5,'random cylinder');
  }
}
// Reuse object identity and mutate both nested array elements and whole arrays.
// This rejects stale per-shape coefficient caches in the public depthAt API.
const mutableSphere = sphere([0,0,0],1);
const mutableCylinder = cylinder([0,0,0],[0,0,1],2,1);
for (let i=0;i<200;i++) {
  for (const s of [mutableSphere,mutableCylinder]) {
    for (let j=0;j<10;j++) check(s,signed()*6,signed()*6,'mutation before');
    s.r = .1+random()*3;
    if (s.kind==='sphere') {
      if (i%2) s.c = vector(3); else for(let k=0;k<3;k++) s.c[k]=signed()*3;
    } else {
      const a=vector(3),u=norm(i%3 ? vector(1) : axes[i%axes.length]);
      s.length=.01+random()*5;
      if(i%2) { s.a=a; s.u=u; }
      else for(let k=0;k<3;k++) { s.a[k]=a[k]; s.u[k]=u[k]; }
    }
    for (let j=0;j<10;j++) check(s,signed()*6,signed()*6,'mutation after');
    const c=s.c||s.a;
    check(s,c[0],c[1],'mutation center');
  }
}
if (failures) console.error(JSON.stringify({failures,firstFailures:details},null,2));
assert.equal(failures,0,`${failures}/${queries} depth regressions (hit/miss must agree, finite tolerance=1e-9*(1+abs(oracle)))`);
console.log(`depthAt: ${queries} deterministic queries passed (${hits} hits, ${misses} misses; seed 0x58d3a91f).`);
console.log(groups);
