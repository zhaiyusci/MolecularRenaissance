// Source-only regression: no generated bundle or ignored baseline snapshot needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, 'src/boundaries.ts'), 'utf8');
let assertions = 0;
function equal(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions++;
}
function replaceOnce(text, needle, replacement) {
  const first = text.indexOf(needle);
  assert(first >= 0, `Missing instrumentation anchor: ${needle}`);
  assert.equal(text.indexOf(needle, first + needle.length), -1, `Ambiguous instrumentation anchor: ${needle}`);
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}
function between(text, first, last) {
  const start = text.indexOf(first), end = text.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, `Missing source section: ${first} ... ${last}`);
  assert.equal(text.indexOf(first, start + first.length), -1, `Ambiguous section: ${first}`);
  return text.slice(start, end);
}
function compile(text) {
  return ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
  }).outputText;
}
const rootDeclaration = 'const clearanceRoot=curves.length>CLEARANCE_INDEX_MIN_CURVES&&curves.every(c=>c.box.every(Number.isFinite))?clearanceIndex(curveIds.slice()):null;';
// The reference module differs ONLY by disabling the private hierarchy.
const linearSource = replaceOnce(source, rootDeclaration, 'const clearanceRoot:ClearanceNode|null=null;');
const helpers = between(source, '  const TAU=', '  // Isolate real polynomial');
const buildPolicy = between(source, '    // Work budgets / spatial-index performance gates, not geometry tolerances.', '    const spheres=');
const indexSource = between(source, '    type ClearanceNode=', '    function owner(p: Vector)');
let loopSource = between(source, '        let candidates=clearanceCandidates(p,epsilon);', '        const n=mul([-t[1]');
loopSource = replaceOnce(loopSource, '          let clearance;', '          visited.push(otherId);\n          let clearance;');
const makeIndex = new Function(compile(`${helpers}
return function(curves) {
  ${buildPolicy}
  ${indexSource}
  return {
    built:clearanceRoot!==null,
    query:clearanceCandidates,
    evaluate:function(p,epsilon,c) {
      const visited=[];
      ${loopSource}
      return {epsilon,visited};
    }
  };
};`))();

// Independent linear predicates/evaluator: neither calls the private query nor
// shares its source. Preserve the original arithmetic trees and +0 reduction.
function outside(p, box, epsilon) {
  return p[0] < box[0] - epsilon || p[0] > box[2] + epsilon ||
    p[1] < box[1] - epsilon || p[1] > box[3] + epsilon;
}
const sub = (a, b) => a.map((x, i) => x + b[i] * -1);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
function linearEvaluate(curves, p, epsilon, self) {
  const visited = [];
  for (let id = 0; id < curves.length; id++) {
    const other = curves[id];
    if (other === self || outside(p, other.box, epsilon)) continue;
    visited.push(id);
    let clearance;
    if (other.line) {
      const q = sub(p, other.A);
      const u = Math.max(0, Math.min(1, dot(q, other.D) / dot(other.D, other.D)));
      clearance = Math.hypot(...sub(p, other.at(u)));
    } else {
      const q = sub(p, other.C), x = cross(q, other.V) / other.det, y = cross(other.U, q) / other.det;
      clearance = Math.abs(Math.hypot(x, y) - 1) * Math.abs(other.det) / other.radius;
    }
    epsilon = Math.min(epsilon, clearance * .2);
  }
  return { epsilon, visited };
}
let seed = 859;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function makeCurves(n) {
  return Array.from({ length: n }, (_, i) => {
    const x = i % 12 - 6, y = Math.floor(i / 12) - 6;
    if (i % 2) return { C:[x,y], U:[.5,0], V:[0,.25], det:.125, radius:.5, box:[x-.5,y-.25,x+.5,y+.25] };
    const A = [x,y], D = [.5,.2];
    return { line:true, A, D, box:[x,y,x+.5,y+.2], at:t => [A[0]+D[0]*t,A[1]+D[1]*t] };
  });
}
const probes = [];
for (let i = 0; i < 300; i++) probes.push([[random()*16-8,random()*16-8],random()*.3]);
for (const x of [-0,0,1,-1,Number.MAX_VALUE,NaN,Infinity,-Infinity]) {
  for (const e of [-1,-0,0,Number.MIN_VALUE,.0005,Infinity,NaN]) probes.push([[x,x],e]);
}
// Exact bbox edges plus immediate near-edge values exercise closed predicates.
for (const x of [-6,-5.5,-5.5-Number.EPSILON*4,-5.5+Number.EPSILON*4]) probes.push([[x,-6],0]);
function compare(curves, expectedBuilt) {
  const actual = makeIndex(curves), ids = curves.map((_, i) => i);
  equal(actual.built, expectedBuilt, 'Fixture must exercise the intended index/fallback path');
  for (const [p, epsilon] of probes) {
    const eligible = expectedBuilt && epsilon >= 0 && Number.isFinite(epsilon) && p.every(Number.isFinite);
    const expectedIds = eligible ? ids.filter(id => !outside(p, curves[id].box, epsilon)) : ids;
    equal(actual.query(p, epsilon), expectedIds, 'Query must retain exact IDs and ascending original order');
    equal(actual.evaluate(p, epsilon, curves[0]), linearEvaluate(curves,p,epsilon,curves[0]), 'Clearance visits and final epsilon');
  }
  return actual;
}
for (const n of [0,1,64,65,128]) compare(makeCurves(n), n > 64);
const poisoned = makeCurves(128);
poisoned[1] = { line:true, A:[0,0], D:[0,0], box:[-100,-100,100,100], at:() => [NaN,NaN] };
const poisonIndex = compare(poisoned, true);
const poisonedResult = poisonIndex.evaluate([0,0],.0005,poisoned[0]);
assert(Number.isNaN(poisonedResult.epsilon), 'Fixture must actually poison epsilon');
assert(poisonedResult.visited.includes(127), 'NaN epsilon must resume the entire original linear suffix');
const nonfinite = makeCurves(128); nonfinite[10].box[0] = NaN; compare(nonfinite, false);
const infinite = makeCurves(128); infinite[10].box[2] = Infinity; compare(infinite, false);
const extreme = makeCurves(128); extreme[10].box = [-1e308,-1e308,1e308,1e308]; compare(extreme, true);

// Exercise complete real arrangements on both sides of the threshold. Expose
// raw internals in these in-memory copies only; leave production files untouched.
function load(text) {
  text = replaceOnce(text, 'return {wash,outline,clipCircle,clipLine,dotRegions,surfacePaths,validate:',
    'return {indexBuilt:clearanceRoot!==null,rawSegments:segments,rawNodes:nodes,wash,outline,clipCircle,clipLine,dotRegions,surfacePaths,validate:');
  const module = { exports:{} };
  new Function('module','exports','require',compile(text))(module,module.exports,id => {
    if (id === './region-runtime.js') return { getDotRegions:() => null };
    throw new Error(`Unexpected test dependency: ${id}`);
  });
  return module.exports.build;
}
const indexedBuild = load(source), linearBuild = load(linearSource);
const depth = (s,x,y) => {
  const d = s.r*s.r-(x-s.c[0])**2-(y-s.c[1])**2;
  return d < -1e-10 ? -Infinity : s.c[2]+Math.sqrt(Math.max(0,d));
};
for (const n of [64,65,81]) {
  const scene = Array.from({ length:n }, (_,i) => ({ kind:'sphere', c:[(i%10)*3,Math.floor(i/10)*3,(i%3)*.1], r:.8, element:'C' }));
  const project = p => [p[0]*10+20,400-p[1]*10];
  const a = linearBuild(scene,depth,project,10), b = indexedBuild(scene,depth,project,10);
  assert(a && b, 'Arrangement fixture must succeed, not merely agree on null');
  equal(a.indexBuilt,false); equal(b.indexBuilt,n>64);
  equal(a.curveCount,n); equal(b.curveCount,n);
  equal(b.rawNodes,a.rawNodes);
  const raw = r => r.rawSegments.map(s => ({ a:s.a,b:s.b,start:s.start,end:s.end,left:s.left,right:s.right,mid:s.c.at((s.a+s.b)/2) }));
  equal(raw(b),raw(a));
  for (const preview of [false,true]) {
    equal(b.surfacePaths(preview),a.surfacePaths(preview));
    equal(b.wash(() => '#aaaaaa',preview),a.wash(() => '#aaaaaa',preview));
  }
  for (const s of scene) equal(b.outline(s,false,1),a.outline(s,false,1));
}
console.log(`PASS boundary clearance index: ${assertions} exact comparisons; order, invalid-number fallbacks, raw/final arrangements`);
