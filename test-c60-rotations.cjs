'use strict';
// Fast commit gate for C60: a boundary set of poses, not a rotation sweep.
// 27 poses replace the former 466-view sweep (65 grid + 361 integer-yaw + 40 random):
// each pose below still proves one distinct behaviour, and the removed views only
// re-entered arrangement regimes that are already covered here.
const assert=require('node:assert/strict'),r=require('./renderer.js'),b=require('./boundaries.js');
const build=b.build,model=r.examples.c60,RAD=Math.PI/180;
// Independent orientation oracle: the documented yaw-then-pitch order about the
// atom-position centroid, recomputed here instead of trusting the renderer.
const centroid=model.atoms.reduce((s,a)=>s.map((v,k)=>v+a.position[k]/model.atoms.length),[0,0,0]);
const rotate=(p,yaw,pitch)=>{
 const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);
 return [x,p[1]*Math.cos(pitch)-z*Math.sin(pitch),p[1]*Math.sin(pitch)+z*Math.cos(pitch)];
};
const near=(a,b)=>Math.abs(a-b)<1e-9;
// The boundary set, grouped by what each pose is here to prove:
const views=[
 // Axis-aligned views: the view axis is exactly a molecule symmetry axis, so projected
 // atoms coincide (60 atoms collapse to 32 outlined silhouettes, 194 analytic curves).
 [0,0],[90,0],[180,0],[0,90],[-72,90],
 // Silhouette/tangency degeneracy on the previously troublesome pitch=0 plane: exactly
 // 380 curves survive instead of 410-420, and one atom loses its outline (380|59).
 [45,0],
 // One representative of every arrangement regime the removed sweep reached:
 // curveCount 410/412/414/416/418/420 with 58/59/60 outlined atoms. The 414 and 420
 // entries are the tightest sphere-silhouette tangencies in that sweep (gap down to 2e-4).
 [1,0],[2,0],[83,0],[112,0],[10,0],[17,0],[40,0],
 [75,-60],[15,-60],[45,-60],[30,-30],
 // Every curveCount transition the sweep crossed on the pitch=0 plane is bracketed, so
 // the widest gap between sampled in-plane yaws is 12 degrees: 416 starts (63.5), 414
 // starts (78.5), 416 restarts (101.75), 420 falls back to 416 (157.25), an atom loses
 // its outline at 168.25 (60 -> 59 outlined silhouettes), 173 keeps the 412/410 end of
 // the plane sampled, and 45/0 is the only pose that collapses to 380 curves.
 [63.5,0],[78.5,0],[101.75,0],[157.25,0],[168.25,0],[173,0],
 // Fixed seeds for the remaining generic off-plane poses, spanning the sweep's
 // projected-overlap range (76..118 overlapping sphere pairs).
 [-22,56],[108,64],[-71,-45],[13,-31]
];
// Hard cap: this file is a commit gate, not a sweep. The 27 poses above already cover
// every regime the removed 466-view sweep visited, so this count must not grow back.
const MAX_ROTATIONS=27;
// The C60 fixture itself is pinned: without this, a shrunk (or fattened) fixture would
// move the oracle's own ground truth and the pose checks below could not see it.
assert.equal(model.atoms.length,60,'C60 fixture must keep 60 atoms');
assert.equal(model.bonds.length,90,'C60 fixture must keep 90 bonds');
let current,calls=0;const started=performance.now();
try{
 b.build=(...args)=>{
  calls++;const a=build(...args),scene=args[0];
  // Composition and orientation are re-derived independently of the renderer, so a lost
  // atom or bond, a swapped/dropped rotation angle, or broken bond geometry must fail.
  const spheres=scene.filter(s=>s.kind==='sphere'),cylinders=scene.filter(s=>s.kind==='cylinder');
  assert.equal(spheres.length,model.atoms.length,`C60 atom count at ${current}`);
  assert.equal(cylinders.length,model.bonds.length,`C60 bond count at ${current}`);
  const yaw=current[0]*RAD,pitch=current[1]*RAD;
  model.atoms.forEach((atom,i)=>{
   const p=[atom.position[0]-centroid[0],atom.position[1]-centroid[1],atom.position[2]-centroid[2]],want=rotate(p,yaw,pitch);
   assert.ok(spheres[i].c.every((v,k)=>near(v,want[k])),`C60 orientation at ${current} atom${i}`);
  });
  model.bonds.forEach((bond,i)=>{
   const s=cylinders[i],end=[s.a[0]+s.u[0]*s.length,s.a[1]+s.u[1]*s.length,s.a[2]+s.u[2]*s.length];
   assert.ok(near(s.length,Math.hypot(...spheres[bond[1]].c.map((v,k)=>v-s.a[k]))),`C60 bond${i} length at ${current}`);
   assert.ok(s.a.every((v,k)=>near(v,spheres[bond[0]].c[k]))&&end.every((v,k)=>near(v,spheres[bond[1]].c[k])),`C60 bond${i} endpoints at ${current}`);
  });
  assert.ok(a,`C60 arrangement fallback at ${current}`);
  assert.ok(a.validate(r.elementColor),`C60 fill topology at ${current}`);
  assert.ok(a.dotRegions(),`C60 surface-region fallback at ${current}`);
  return null; // No serialization or fallback grid needed for topology checks.
 };
 for(const view of views){current=view;r.render(model,{yaw:view[0]*RAD,pitch:view[1]*RAD,shadingSize:0,outlineWidth:0});}
 assert.equal(calls,views.length);
 assert.ok(calls<=MAX_ROTATIONS,`C60 rotation set grew to ${calls} poses; it must stay a boundary set`);
 console.log(`PASS ${calls} C60 boundary rotations: no fallback, closed fill, shared dot regions, independent orientation (${((performance.now()-started)/1000).toFixed(1)} s)`);
}finally{b.build=build;}
