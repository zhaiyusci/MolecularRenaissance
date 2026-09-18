'use strict';
// Run: node test-stipple-tone.cjs. Direct single-sphere marks only: no wash or outline.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { buildDots } = require('./dots.js');
const { depthAt } = require('./renderer.js');
const started = performance.now(), failures = [], reports = [];
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failures.push({name, error:e.stack}); console.error(`FAIL ${name}: ${e.message}`); }
}
const unit = a => a.map(v => v / Math.hypot(...a));
const dot = (a,b) => a.reduce((s,v,i) => s + v*b[i], 0);
const scene = [{kind:'sphere', c:[0,0,0], r:1}];
const project = p => [150+100*p[0],150-100*p[1]];
const defaultLight = unit([-.55,.72,1]);
// Index each serialized circle into EVERY cell touched by its bounding box.
// A sample is ink if any circle contains it; overlapping ink is counted once.
function unionIndex(circles) {
  const bins = new Map(), cell = 5;
  for (const c of circles) {
    for (let iy=Math.floor((c.y-c.r)/cell);iy<=Math.floor((c.y+c.r)/cell);iy++)
      for (let ix=Math.floor((c.x-c.r)/cell);ix<=Math.floor((c.x+c.r)/cell);ix++) {
        const key=iy*1000+ix;
        if (!bins.has(key)) bins.set(key,[]);
        bins.get(key).push(c);
      }
  }
  return (x,y) => (bins.get(Math.floor(y/cell)*1000+Math.floor(x/cell))||[])
    .some(c => (x-c.x)**2+(y-c.y)**2<=c.r*c.r);
}
function measure(name, light) {
  const svg = buildDots(scene,depthAt,project,100,n=>dot(n,light),{shadingMode:'stipple'});
  assert(!/<path|NaN|Infinity|undefined/.test(svg));
  const circles = [...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"\/>/g)]
    .map(m=>({x:+m[1],y:+m[2],r:+m[3]}));
  assert(circles.length>100,'expected nonempty stipple sphere');
  const covered = unionIndex(circles), bins = {};
  const add=(key,ink)=>{ const b=bins[key]||(bins[key]={samples:0,ink:0}); b.samples++; b.ink+=ink; };
  // 0.25 SVG px grid: 20 samples per default pitch, ~500k sphere samples.
  // Classify by analytic n dot L at each sample, never by screen y or dot center.
  const step=.25;
  for(let y=50+step/2;y<250;y+=step)for(let x=50+step/2;x<250;x+=step) {
    const nx=(x-150)/100,ny=(150-y)/100,q=1-nx*nx-ny*ny;
    if(q<=0)continue;
    const nz=Math.sqrt(q),lit=dot([nx,ny,nz],light),ink=covered(x,y)?1:0;
    if(lit>.8)add('highlight',ink);
    if(lit>=.35&&lit<=.55)add('midtone',ink);
    if(lit<-.15)add('shadow',ink);
    if(nx<0)add('left',ink);else add('right',ink);
    // Mirrored patches have the same nz distribution, but different n dot L.
    if(nz>=.55&&nz<=.75&&Math.abs(nx)>.35)add(nx<0?'sameNzLeft':'sameNzRight',ink);
    if(nz>.9)add('center',ink);
    if(nz>=.15&&nz<=.45) {
      add('rim',ink);
      add(Math.abs(nx)>Math.abs(ny)?(nx<0?'rimLeft':'rimRight'):(ny<0?'rimBottom':'rimTop'),ink);
    }
  }
  const coverage=Object.fromEntries(Object.entries(bins).map(([k,b])=>[k,b.ink/b.samples]));
  reports.push({name,circles:circles.length,...coverage});
  return {coverage,bins};
}
function checkTone(result) {
  const c=result.coverage,values=JSON.stringify(c);
  for(const key of ['highlight','midtone','shadow'])assert(result.bins[key]?.samples>1000,`insufficient ${key} samples`);
  assert(c.highlight<c.midtone&&c.midtone<c.shadow,`coverage must rise highlight -> midtone -> shadow: ${values}`);
  assert(c.shadow>=.20,`shadow coverage must be >= .20: ${values}`);
  assert(c.shadow>=1.5*c.midtone,`shadow must be >= 1.5x midtone: ${values}`);
  assert(c.highlight<.04,`highlight coverage must be < .04: ${values}`);
}
test('union sampler counts duplicate/overlapping circles only once',()=>{
  const c={x:150,y:150,r:2},once=unionIndex([c]),twice=unionIndex([c,c,{x:151,y:150,r:2}]);
  assert(once(150,150)&&twice(150,150)); assert(!twice(154,150));
  let a=0,b=0;
  for(let y=147.125;y<153;y+=.25)for(let x=147.125;x<154;x+=.25){a+=once(x,y);b+=twice(x,y);}
  assert(b>a&&b<2*a,`overlap union ${b} must lie between one disk ${a} and twice its area`);
});
// Only three shader builds; each is measured once and shared among assertions.
const normal=measure('default',defaultLight);
const reverse=measure('left-right reversed',unit([.55,.72,1]));
const front=measure('front',[0,0,1]);
test('default lighting: actual union coverage has spherical tone',()=>checkTone(normal));
test('reversed lighting retains highlight/midtone/shadow thresholds',()=>checkTone(reverse));
test('reversing horizontal light reverses the dark side',()=>{
  const a=normal.coverage,b=reverse.coverage;
  assert(a.right>a.left,`default right ${a.right} must be darker than left ${a.left}`);
  assert(b.left>b.right,`reversed left ${b.left} must be darker than right ${b.right}`);
});
test('equal-nz mirrored patches respond to n dot L, not just facing angle',()=>{
  const a=normal.coverage,b=reverse.coverage;
  assert.equal(normal.bins.sameNzLeft.samples,normal.bins.sameNzRight.samples);
  assert(a.sameNzRight>a.sameNzLeft,`default equal-nz coverage left/right ${a.sameNzLeft}/${a.sameNzRight}`);
  assert(b.sameNzLeft>b.sameNzRight,`reversed equal-nz coverage left/right ${b.sameNzLeft}/${b.sameNzRight}`);
});
test('front light: bright center and darker rim in all four directions',()=>{
  const c=front.coverage;
  assert(c.center<.04,`front-lit center ${c.center} must be < .04`);
  for(const key of ['rimLeft','rimRight','rimTop','rimBottom'])
    assert(c[key]>c.center&&c[key]>=.20,`${key} ${c[key]} must exceed center ${c.center} and be >= .20`);
});
console.log('\nACTUAL DISK-UNION COVERAGE (0.25 px grid, not summed circle areas)');
console.table(reports);
console.log(`${passed} passed, ${failures.length} failed; ${(performance.now()-started).toFixed(1)} ms`);
if(failures.length){for(const f of failures)console.error(`\n${f.name}\n${f.error}`);process.exitCode=1;}
