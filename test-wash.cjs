'use strict';
// Standalone regression: node test-wash.cjs. Creates no output files.
const assert = require('node:assert/strict');
const { depthAt } = require('./renderer.js');
const { buildWash } = require('./wash.js');
const palette = { R: '#ff0000', B: '#0000ff', W: '#ffffff' };
const colorFor = element => palette[element];
const project = p => [p[0], -p[1]];
const sphere = (x, y, z, r, element) => ({ kind: 'sphere', c: [x, y, z], r, element });

// Flatten cubic SVG curves for an independent even-odd membership oracle.
function flattenPath(d, tolerance = .002) {
  const tokens=d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
  const loops=[];let points=[],p=null,i=0;
  const point=()=>[Number(tokens[i++]),Number(tokens[i++])];
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  function cubic(a,b,c,d,depth=0){
    const dx=d[0]-a[0],dy=d[1]-a[1],len=Math.hypot(dx,dy);
    const distance=q=>{
      const t=len?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(len*len))):0;
      return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);
    };
    const flat=Math.max(distance(b),distance(c))<=tolerance;
    assert.ok(depth<20||flat,'cubic subdivision converges');
    if(flat){points.push(d);return;}
    const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
    cubic(a,ab,abc,m,depth+1);cubic(m,bcd,cd,d,depth+1);
  }
  while(i<tokens.length){
    const cmd=tokens[i++];
    if(cmd==='M'){assert.equal(points.length,0);p=point();points.push(p);}
    else if(cmd==='L'){p=point();points.push(p);}
    else if(cmd==='C'){const b=point(),c=point(),end=point();cubic(p,b,c,end);p=end;}
    else if(cmd==='Z'){loops.push(points);points=[];}
    else assert.fail('Unsupported wash path command '+cmd);
  }
  assert.equal(points.length,0,'all contours closed');return loops;
}

function parsePaths(svg) {
  assert.ok(!/NaN|Infinity|<rect\b|<image\b/.test(svg), 'finite vector output only');
  assert.match(svg, /^<g\b[^>]*>.*<\/g>$/);
  const paths = [...svg.matchAll(/<path fill="([^"]+)" fill-rule="evenodd" d="([^"]+)"\/>/g)].map(m => ({
    color: m[1],
    loops: flattenPath(m[2])
  }));
  assert.equal(paths.length, (svg.match(/<path\b/g) || []).length, 'every path uses supported closed evenodd format');
  for (const path of paths) {
    assert.ok(path.loops.length > 0);
    for (const loop of path.loops) {
      assert.ok(loop.length >= 3);
      assert.ok(loop.every(p => p.length === 2 && p.every(Number.isFinite)));
    }
  }
  return paths;
}
function inside(poly, x, y) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function colorAt(paths, x, y) {
  const hits = paths.filter(path => path.loops.reduce((hit, loop) => hit !== inside(loop, x, y), false));
  assert.ok(hits.length <= 1, `overlapping fills at ${x},${y}`);
  return hits.length ? hits[0].color : null;
}
function check(name, scene) {
  const svg = buildWash(scene, depthAt, project, 1, colorFor);
  const paths = parsePaths(svg);
  // Integer scene bounds align half-integer probes with the wash sample centers.
  // Compare vector evenodd membership against the real renderer's depth oracle.
  for (let y = -29.5; y < 30; y++) for (let x = -29.5; x < 30; x++) {
    let best = -Infinity, expected = null;
    for (const s of scene) {
      const z = depthAt(s, x, -y);
      const uncolored = s.kind === 'cylinder' || colorFor(s.element) === '#ffffff';
      if (Number.isFinite(z) && (z > best || (z === best && uncolored))) {
        best = z;
        expected = uncolored ? null : colorFor(s.element);
      }
    }
    assert.equal(colorAt(paths, x, y), expected, `${name}: nearest surface at ${x},${y}`);
  }
  console.log(`PASS ${name}: 3600 sample centers, ${paths.length} paths, ${svg.length} bytes`);
  return paths;
}

const crossing = [sphere(-5, 0, 0, 17, 'R'), sphere(6, 0, 5, 11, 'B')];
const crossingPaths = check('intersecting surfaces, not center order', crossing);
// Both spheres cover this ray, but the sphere whose center is farther wins.
assert.ok(depthAt(crossing[1], 0.5, -0.5) > -Infinity);
assert.ok(crossing[0].c[2] < crossing[1].c[2]);
assert.ok(depthAt(crossing[0], 0.5, -0.5) > depthAt(crossing[1], 0.5, -0.5));
assert.equal(colorAt(crossingPaths, 0.5, 0.5), palette.R);
assert.equal(colorAt(crossingPaths, 10.5, 0.5), palette.B);

const whitePaths = check('white sphere occludes and leaves hole', [sphere(0, 0, 0, 24, 'R'), sphere(0, 0, 25, 7, 'W')]);
assert.equal(whitePaths.length, 1);
assert.equal(whitePaths[0].loops.length, 2);
assert.equal(colorAt(whitePaths, 0.5, 0.5), null);
assert.equal(colorAt(whitePaths, 15.5, 0.5), palette.R);

const cylinderPaths = check('uncolored cylinder leaves enclosed hole', [sphere(0, 0, 0, 24, 'R'),
  { kind: 'cylinder', a: [0, -8, 30], u: [0, 1, 0], length: 16, r: 3 }]);
assert.equal(cylinderPaths.length, 1);
assert.equal(cylinderPaths[0].loops.length, 2);
assert.equal(colorAt(cylinderPaths, 0.5, 0.5), null);
assert.equal(colorAt(cylinderPaths, 6.5, 0.5), palette.R);

const merged = check('same color merges to one path', [sphere(-5, 0, 0, 17, 'R'), sphere(6, 0, 5, 11, 'R')]);
assert.equal(merged.length, 1);
assert.equal(merged[0].loops.length, 1);
assert.equal(parsePaths(buildWash([], depthAt, project, 1, colorFor)).length, 0);
assert.equal(parsePaths(buildWash([sphere(0, 0, 0, 5, 'R'), sphere(0, 0, 10, 10, 'W')], depthAt, project, 1, colorFor)).length, 0);
console.log('PASS empty scene and fully hidden color');

// Test shape geometry rather than just finite paths or a prettier screenshot.
for(const [cx,cy,r] of [[0,0,100],[.371,-.219,73.6],[0,0,7]]){
 const svg=buildWash([sphere(cx,-cy,0,r,'R')],depthAt,project,1,colorFor);
 assert.ok(svg.includes('C'),'smooth boundary exports cubic control points');
 const commands=(svg.match(/[MLC][-\d]/g)||[]).length;
 assert.ok(commands<160,'circle should not have staircase-sized anchor count');
 const paths=parsePaths(svg);assert.equal(paths.length,1);
 const path=paths[0];assert.equal(path.loops.length,1);
 let worst=0;
 const loop=path.loops[0];
 for(let j=0;j<loop.length;j++){
  const a=loop[j],b=loop[(j+1)%loop.length];
  for(const p of [a,[(a[0]+b[0])/2,(a[1]+b[1])/2]])worst=Math.max(worst,Math.abs(Math.hypot(p[0]-cx,p[1]-cy)-r));
 }
 assert.ok(worst<.078,`radial error ${worst} plus .002 flatten budget exceeds .08 SVG units`);
 assert.equal(colorAt(paths,cx,cy),palette.R);
 for(let j=0;j<720;j++){
  const angle=j*Math.PI/360,c=Math.cos(angle),s=Math.sin(angle);
  assert.equal(colorAt(paths,cx+(r-.08)*c,cy+(r-.08)*s),palette.R,'entire inner circle covered');
  assert.equal(colorAt(paths,cx+(r+.08)*c,cy+(r+.08)*s),null,'no fill outside outer circle');
 }
 console.log(`PASS smooth circle r=${r}: ${commands} anchors, max radial error ${worst.toFixed(5)}`);
}
// A circular hole needs the same precision as the exterior, not generic rounding.
const holeSvg=buildWash([sphere(0,0,0,100,'R'),sphere(0,0,120,23,'W')],depthAt,project,1,colorFor);
const holeLoops=parsePaths(holeSvg)[0].loops;
assert.equal(holeLoops.length,2);
const holeRadii=[];
for(const loop of holeLoops){
 const average=loop.reduce((s,p)=>s+Math.hypot(...p),0)/loop.length;
 const r=average>60?100:23;holeRadii.push(r);
 for(let i=0;i<loop.length;i++){
  const a=loop[i],b=loop[(i+1)%loop.length];
  for(const p of [a,[(a[0]+b[0])/2,(a[1]+b[1])/2]])assert.ok(Math.abs(Math.hypot(...p)-r)<.078,'hole and outer contour stay circular');
 }
}
assert.deepEqual(holeRadii.sort((a,b)=>a-b),[23,100]);
const holePaths=parsePaths(holeSvg);assert.equal(colorAt(holePaths,0,0),null);
for(let j=0;j<360;j++){
 const angle=j*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 assert.equal(colorAt(holePaths,22.92*c,22.92*s),null);
 assert.equal(colorAt(holePaths,23.08*c,23.08*s),palette.R);
}
console.log('PASS smooth hole boundary; all wash regressions passed.');
