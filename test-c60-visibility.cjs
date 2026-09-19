'use strict';
// Independent C60 visibility regression. Run: node test-c60-visibility.cjs
// No generated files, production ray calls, or fallback acceptance in the oracle.
const assert = require('node:assert/strict');
const R = require('./renderer.js'), B = require('./boundaries.js');
const TAU = 2*Math.PI, start = performance.now();
const stats = { frames:0, limbs:0, ownerProbes:0, clearanceProbes:0, hatchProbes:0, hiddenClips:0 };
const failures=[];

// Ray expressed relative to the cylinder base; |w cross u|^2 avoids
// subtracting nearly equal squared vector lengths in the production solver.
function ray(s,x,y) {
  if(s.kind==='sphere') {
    const q=s.r*s.r-(x-s.c[0])**2-(y-s.c[1])**2;
    return q < -1e-12 ? -Infinity : s.c[2]+Math.sqrt(Math.max(0,q));
  }
  const wx=x-s.a[0],wy=y-s.a[1],[ux,uy,uz]=s.u;
  const A=ux*ux+uy*uy,B=-2*uz*(wx*ux+wy*uy);
  const C=uz*uz*(wx*wx+wy*wy)+(wx*uy-wy*ux)**2-s.r*s.r;
  let best=-Infinity;
  if(A>1e-24) {
    const disc=B*B-4*A*C;
    if(disc>=-1e-12) for(const z of [(-B-Math.sqrt(Math.max(0,disc)))/(2*A),(-B+Math.sqrt(Math.max(0,disc)))/(2*A)]) {
      const axial=wx*ux+wy*uy+z*uz;
      if(axial>=-1e-9&&axial<=s.length+1e-9)best=Math.max(best,s.a[2]+z);
    }
  }
  if(Math.abs(uz)>1e-14)for(const end of [0,s.length]) {
    const z=(end-wx*ux-wy*uy)/uz;
    if((wx-end*ux)**2+(wy-end*uy)**2+(z-end*uz)**2<=s.r*s.r+1e-12)best=Math.max(best,s.a[2]+z);
  }
  return best;
}
function nearest(scene,x,y,exclude=-1) {
  let z=-Infinity,id=-1;
  for(let i=0;i<scene.length;i++)if(i!==exclude) {
    const d=ray(scene[i],x,y);
    if(Number.isFinite(d)&&(d>z||(d===z&&scene[i].kind==='cylinder'))){z=d;id=i;}
  }
  return {z,id};
}
function capture(yaw,pitch,model=R.examples.c60) {
  const original=B.build;let args;
  B.build=(...a)=>{args=a;return null;};
  try {R.render(model,{width:900,height:700,yaw,pitch,outlineWidth:0,shadingSize:0});}
  finally {B.build=original;}
  assert.ok(args);return args;
}
function runs(svg,s,project) {
  assert.ok(!/NaN|Infinity/.test(svg));
  const c=project(s.c),out=[];
  for(const match of svg.matchAll(/ d="([^"]+)"/g)) {
    assert.ok(!/[CZ]/.test(match[1]),'preview contains only polylines');
    const pts=[...match[1].matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(m=>[+m[1],+m[2]]);
    assert.ok(pts.length>=2);let lo,last;
    for(const p of pts) {
      let t=(Math.atan2(c[1]-p[1],p[0]-c[0])+TAU)%TAU;
      if(last!==undefined)while(t<last-1e-4)t+=TAU;else lo=t;
      last=t;
    }
    assert.ok(last-lo<=TAU+1e-4);out.push([lo,last]);
  }
  return out;
}
const member=(spans,t)=>spans.some(([lo,hi])=>[t,t+TAU,t+2*TAU].some(v=>v>=lo&&v<=hi));
const endpoint=(spans,t,eps)=>spans.some(([lo,hi])=>[t,t+TAU,t+2*TAU].some(v=>Math.min(Math.abs(v-lo),Math.abs(v-hi))<eps));
const cases=[0,15,45,75,90,105,135,165,180].map(y=>[y*Math.PI/180,0]);
cases.push([0,Math.PI/180],[Math.PI/4,-Math.PI/180],[Math.PI/2,Math.PI/180],[.25,-.16]);
let seed=0x60c0ffee;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<2;i++)cases.push([(random()*2-1)*Math.PI,(random()*2-1)*Math.PI/2]);
for(const [yaw,pitch] of cases) {
  const label=`yaw=${yaw}, pitch=${pitch}`;
  try {
    const args=capture(yaw,pitch),[scene,,project,scale]=args,a=B.build(...args);
    assert.equal(scene.length,150);assert.ok(a,`${label}: build must not fall back`);
    assert.ok(a.validate(R.elementColor),`${label}: canonical palette topology`);
    const regions=a.dotRegions();assert.ok(regions,`${label}: dot regions must not fall back`);
    const origin=project([0,0,0]);
    const pixelOwner=(x,y)=>nearest(scene,(x-origin[0])/scale,(origin[1]-y)/scale).id;
    let visibleAtoms=0,emittedAtoms=0;
    for(let i=0;i<60;i++) {
      const s=scene[i],spans=runs(a.outline(s,true,.8),s,project);let count=0;
      if(spans.length)emittedAtoms++;
      for(let k=0;k<720;k++) {
        const t=TAU*(k+.371)/720,p=[s.c[0]+s.r*Math.cos(t),s.c[1]+s.r*Math.sin(t)],gap=nearest(scene,...p,i).z-s.c[2];
        const expected=gap<=.00015;if(expected)count++;
        if(Math.abs(gap-.00015)<.0003||endpoint(spans,t,.002))continue;
        assert.equal(member(spans,t),expected,`${label} atom${i} limb t=${t} gap=${gap}`);stats.limbs++;
      }
      if(count)visibleAtoms++;
      // Independent sphere front-disc probes, including completely hidden rear
      // sources. Query must return actual raw scene IDs, never equal-color IDs.
      for(let gx=-4;gx<=4;gx++)for(let gy=-4;gy<=4;gy++) {
        const dx=(gx+.173)/5*s.r,dy=(gy+.319)/5*s.r;if(dx*dx+dy*dy>=s.r*s.r)continue;
        const p=project([s.c[0]+dx,s.c[1]+dy,0]),expected=pixelOwner(...p),q=regions.query(...p,1.5);
        if(!q) {
          // Polygon approximation uncertainty is <.004px. Require a region at
          // probes whose .03px neighbourhood has the same physical owner.
          const safe=expected>=0&&Array.from({length:16},(_,k)=>pixelOwner(p[0]+.03*Math.cos(k*TAU/16),p[1]+.03*Math.sin(k*TAU/16))).every(id=>id===expected);
          assert.ok(!safe,`${label} atom${i} missing interior region at ${p}`);continue;
        }
        assert.equal(q.id,expected,`${label} atom${i} raw owner at ${p}`);stats.ownerProbes++;
        assert.ok(q.clearance>0&&q.clearance<=1.5);
        for(let k=0;k<8;k++) {
          const t=k*TAU/8,r=q.clearance*.95;
          assert.equal(pixelOwner(p[0]+r*Math.cos(t),p[1]+r*Math.sin(t)),expected,`${label} unsafe clearance at ${p}`);stats.clearanceProbes++;
        }
      }
      // Sparse front-surface latitude rings. Hidden rear sources must not
      // inherit front-source visible intervals when their carriers coincide.
      for(const h of [.25,.7]) {
        const rr=s.r*Math.sqrt(1-h*h),center=[s.c[0],s.c[1],s.c[2]+h*s.r],u=[rr,0,0],v=[0,rr,0];
        const clipped=a.clipCircle(s,center,u,v);assert.ok(clipped!==null,`${label} atom${i} hatch fallback`);
        let visible=0;
        for(let k=0;k<180;k++) {
          const t=(k+.371)/180,angle=t*TAU,p=[center[0]+rr*Math.cos(angle),center[1]+rr*Math.sin(angle),center[2]],gap=nearest(scene,p[0],p[1],i).z-p[2];
          const expected=gap<=1e-9;if(expected)visible++;
          if(Math.abs(gap)<1e-7||clipped.some(([lo,hi])=>Math.min(Math.abs(t-lo),Math.abs(t-hi))<1e-5))continue;
          assert.equal(clipped.some(([lo,hi])=>t>=lo&&t<=hi),expected,`${label} atom${i} front hatch h=${h} t=${t} gap=${gap}`);stats.hatchProbes++;
        }
        if(!visible&&pitch===0&&(yaw===0||yaw===Math.PI/2)) {assert.deepEqual(clipped,[],`${label} rear atom${i} should have no ring`);stats.hiddenClips++;}
      }
    }
    if(pitch===0&&(yaw===0||yaw===Math.PI/2)) {assert.equal(visibleAtoms,32);assert.equal(emittedAtoms,32);}
    // Changing radii changes occlusion: the old 60-limb count is not a new
    // default invariant. Keep every pointwise oracle assertion above; a finite
    // angular sample count is only a lower bound on physically visible atoms.
    assert.ok(emittedAtoms>=visibleAtoms,`${label}: missing a physically sampled atom`);
    stats.frames++;console.log('PASS '+label+` (${visibleAtoms} sampled / ${emittedAtoms} outlined atoms)`);
  } catch(e) {failures.push(`${label}: ${e.message}`);console.error('FAIL '+failures.at(-1));}
}
// Preserve the old 60-limb regression as an explicit small-ball fixture, not as
// an assumption about newly adopted physical radii.
{
 const legacy=require('./test-fixtures/legacy-atoms.cjs')(R.examples.c60);
 const args=capture(Math.PI/4,0,legacy),a=B.build(...args);assert.ok(a);
 assert.equal(args[0].filter(s=>s.kind==='sphere'&&runs(a.outline(s,true,.8),s,args[2]).length).length,60);
}
console.log(JSON.stringify({...stats,ms:Math.round(performance.now()-start),failures},null,2));
assert.equal(failures.length,0,'C60 visibility regressions');
