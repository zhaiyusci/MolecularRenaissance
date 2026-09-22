'use strict';
// Dependency-free, read-only regression. Run: node test-optimize.cjs
const assert = require('node:assert/strict');
const { render: renderRaw, examples } = require('./renderer.js');
// This suite measures continuous ribbon fitting, not clipped template geometry.
const render=(m,o)=>renderRaw(m,{hatchMode:'continuous',...o});
const FLATNESS = .002, ENDPOINT_ERROR = .002, BOUNDARY_ERROR = .05;
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segmentDistance2(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0;
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
}
function flattenPath(d, tolerance = FLATNESS) {
  // Reject unsupported syntax rather than silently losing a command or NaN.
  const tokens = d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g) || [];
  assert.equal(d.replace(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?|[\s,]/g, ''), '', 'only absolute MLCZ allowed');
  let i = 0, current = null;
  const subpaths = [], anchors = [], commands = [];
  function point() {
    const p = [Number(tokens[i++]), Number(tokens[i++])];
    assert.ok(p.every(Number.isFinite), 'finite coordinate pair');
    return p;
  }
  function cubic(a, b, c, end, depth = 0) {
    // Distance to the finite segment catches collinear reversals/overshoot too.
    const flat = Math.max(segmentDistance2(b, a, end), segmentDistance2(c, a, end)) <= tolerance ** 2;
    assert.ok(depth < 24 || flat, 'adaptive cubic subdivision converges');
    if (flat) { current.points.push(end); return; }
    const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, end);
    const abc = midpoint(ab, bc), bcd = midpoint(bc, cd), m = midpoint(abc, bcd);
    cubic(a, ab, abc, m, depth + 1); cubic(m, bcd, cd, end, depth + 1);
  }
  while (i < tokens.length) {
    const command = tokens[i++]; commands.push(command);
    if (command === 'M') {
      const p = point(); current = { points: [p], closed: false, start: p, end: p };
      subpaths.push(current); anchors.push(p);
    } else if (command === 'L' || command === 'C') {
      assert.ok(current && !current.closed, 'drawing command follows an open subpath');
      let end;
      if (command === 'L') { end = point(); current.points.push(end); }
      else { const b = point(), c = point(); end = point(); cubic(current.end, b, c, end); }
      current.end = end; anchors.push(end);
    } else if (command === 'Z') {
      assert.ok(current && !current.closed, 'Z closes exactly one subpath');
      current.closed = true;
      if (distance(current.points.at(-1), current.start) > 0) current.points.push(current.start);
    } else assert.fail('Unsupported path command: ' + command);
  }
  assert.ok(subpaths.length, 'nonempty path');
  return { subpaths, anchors, commands };
}
function inkGroups(svg) {
  const result = [], stack = [];
  for (const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)) {
    if (m[0] === '</g>') {
      const start = stack.pop(); assert.ok(start, 'balanced group');
      if (start.ink) result.push(svg.slice(start.index, m.index + m[0].length));
    } else if (!m[0].endsWith('/>')) stack.push({ index: m.index, ink: /\bdata-role="engraving"/.test(m[0]) });
  }
  assert.equal(stack.length, 0); assert.ok(result.length, 'engraving layers exist'); return result;
}
const ink = svg => inkGroups(svg).join('');
const withoutInk = svg => inkGroups(svg).reduce((rest, group) => rest.replace(group, '<INK/>'), svg);
function paths(svg) {
  assert.ok(!/NaN|Infinity|undefined/.test(svg));
  return [...ink(svg).matchAll(/<path\b[^>]*>/g)].map(([tag]) => {
    const match = tag.match(/\bd="([^"]+)"/); assert.ok(match, 'path has d');
    return { d: match[1], attributes: tag.replace(/\bd="[^"]+"/, ''), ...flattenPath(match[1]) };
  });
}
function segments(path) {
  const result = [];
  for (const { points } of path.subpaths) for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    result.push({ a, b, lo: [Math.min(a[0], b[0]), Math.min(a[1], b[1])], hi: [Math.max(a[0], b[0]), Math.max(a[1], b[1])] });
  }
  assert.ok(result.length, 'path contains segments'); return result;
}
// A small BVH gives exact nearest-segment distances without an O(n*m) scan.
function tree(segments) {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const s of segments) for (let k = 0; k < 2; k++) { lo[k] = Math.min(lo[k], s.lo[k]); hi[k] = Math.max(hi[k], s.hi[k]); }
  if (segments.length <= 8) return { lo, hi, segments };
  const axis = hi[0] - lo[0] >= hi[1] - lo[1] ? 0 : 1;
  segments.sort((a, b) => a.lo[axis] + a.hi[axis] - b.lo[axis] - b.hi[axis]);
  const half = segments.length >> 1;
  return { lo, hi, left: tree(segments.slice(0, half)), right: tree(segments.slice(half)) };
}
function boxDistance2(p, node) {
  let d = 0;
  for (let k = 0; k < 2; k++) d += Math.max(node.lo[k] - p[k], 0, p[k] - node.hi[k]) ** 2;
  return d;
}
function nearest2(p, node, best = Infinity) {
  if (boxDistance2(p, node) >= best) return best;
  if (node.segments) {
    for (const s of node.segments) best = Math.min(best, segmentDistance2(p, s.a, s.b));
    return best;
  }
  const first = boxDistance2(p, node.left) <= boxDistance2(p, node.right) ? node.left : node.right;
  const second = first === node.left ? node.right : node.left;
  return nearest2(p, second, nearest2(p, first, best));
}
function directedError(source, target) {
  const index = tree(segments(target)); let worst2 = 0;
  for (const { points } of source.subpaths) {
    for (let i = 0; i < points.length; i++) {
      worst2 = Math.max(worst2, nearest2(points[i], index));
      if (i) worst2 = Math.max(worst2, nearest2(midpoint(points[i - 1], points[i]), index));
    }
  }
  return Math.sqrt(worst2);
}
function samePoint(a, b, context, tolerance = ENDPOINT_ERROR) { assert.ok(distance(a, b) <= tolerance + 1e-9, `${context}: endpoint moved ${distance(a, b)}`); }
function compare(oldPaths, newPaths, context) {
  assert.equal(newPaths.length, oldPaths.length, context + ': same visible fragments, no gap merged');
  let worst = 0, tips = 0;
  for (let i = 0; i < oldPaths.length; i++) {
    const old = oldPaths[i], now = newPaths[i], label = `${context} path ${i}`;
    assert.equal(now.attributes, old.attributes, label + ': unchanged paint and widths');
    assert.equal(now.subpaths.length, old.subpaths.length, label + ': no added gap-spanning subpath');
    for (let j = 0; j < old.subpaths.length; j++) {
      const a = old.subpaths[j], b = now.subpaths[j];
      assert.equal(b.closed, a.closed, label + ': closure');
      // Legacy stroked paths round to 2 decimals, optimized paths to 3.
      // Their combined 2D rounding budget is < .008; ribbons retain .002.
      const endpointTolerance = old.attributes.includes('stroke="none"') ? ENDPOINT_ERROR : .008;
      samePoint(a.start, b.start, label + ' start', endpointTolerance); samePoint(a.end, b.end, label + ' end', endpointTolerance);
    }
    if (old.attributes.includes('stroke="none"')) {
      const half = old.anchors.length / 2;
      assert.equal(half, Math.floor(half), label + ': legacy ribbon has two sampled sides');
      // Open ribbons meet at both tapered tips. Periodic ribbons need not taper.
      if (distance(old.anchors[half - 1], old.anchors[half]) <= .00001 && distance(old.anchors[0], old.anchors.at(-1)) <= .00001) {
        for (const tip of [old.anchors[0], old.anchors[half - 1]]) {
          assert.ok(now.anchors.some(p => distance(p, tip) <= ENDPOINT_ERROR + 1e-9), label + ': tapered tip remains an explicit anchor');
          tips++;
        }
      }
    }
    const error = Math.max(directedError(old, now), directedError(now, old));
    worst = Math.max(worst, error);
    assert.ok(error <= BOUNDARY_ERROR, `${label}: bidirectional boundary error ${error} > ${BOUNDARY_ERROR}`);
  }
  return { worst, tips };
}
function stats(svg, parsed) {
  const counts = { M: 0, L: 0, C: 0 };
  for (const p of parsed) for (const c of p.commands) if (c in counts) counts[c]++;
  return { ...counts, anchors: counts.M + counts.L + counts.C, bytes: Buffer.byteLength(svg, 'utf8') };
}
// Oracle self-tests: clamping and a cubic that overshoots its collinear chord.
assert.equal(segmentDistance2([2, 0], [0, 0], [1, 0]), 1);
const overshoot = flattenPath('M0 0C4 0 4 0 1 0');
assert.ok(overshoot.subpaths[0].points.some(p => p[0] > 2), 'flatten must not replace a collinear reversal with its chord');
assert.equal(nearest2([2, 1], tree(segments(flattenPath('M0 0L1 0')))), 2);

for (const name of ['sphere', 'pair', 'ethanol']) for (const variableWidth of [true, false]) {
  const options = { variableWidth };
  const oldSvg = render(examples[name], { ...options, optimizePaths: false });
  const newSvg = render(examples[name], options);
  assert.equal(newSvg, render(examples[name], { ...options, optimizePaths: true }), 'optimization defaults to true');
  const oldPaths = paths(oldSvg), newPaths = paths(newSvg), context = `${name} variableWidth=${variableWidth}`;
  if (variableWidth) assert.ok(oldPaths.every(p => !p.commands.includes('C')), 'unfitted adaptive ribbons stay pointwise ML[Z]');
  else for (let i = 0; i < oldPaths.length; i++) if (oldPaths[i].commands.includes('C')) {
    assert.equal(newPaths[i].d, oldPaths[i].d, 'already-analytic equal-width curves need no refitting');
  }
  assert.ok(newPaths.some(p => p.commands.includes('C')), context + ': curved paths use cubic fitting');
  const geometry = compare(oldPaths, newPaths, context), old = stats(oldSvg, oldPaths), now = stats(newSvg, newPaths);
  const anchorSaving = 1 - now.anchors / old.anchors, byteSaving = 1 - now.bytes / old.bytes;
  console.log(`${context}: paths=${newPaths.length}, M/L/C ${old.M}/${old.L}/${old.C} -> ${now.M}/${now.L}/${now.C}, anchors ${old.anchors} -> ${now.anchors} (-${(100 * anchorSaving).toFixed(1)}%), bytes ${old.bytes} -> ${now.bytes} (-${(100 * byteSaving).toFixed(1)}%), boundary=${geometry.worst.toFixed(6)}, tips=${geometry.tips}`);
  // optimizePaths:false is now already adaptively sampled when analytic hints
  // are available. A second 70%/50% reduction is not its contract. Require
  // non-expansion here; the original dense-to-fitted budgets are tested below.
  assert.ok(now.anchors <= old.anchors, context + ': fitting does not expand adaptive anchor count');
  assert.ok(now.bytes <= old.bytes, context + ': fitting does not expand adaptive SVG bytes');
  if (variableWidth) assert.ok(geometry.tips > 0, context + ': tapered tips actually tested');
}

// Keep the original dense-to-fitted performance gate on the actual production
// stroke renderer, using its supported no-hints discovery grid. No historical
// radii/projection, synthetic fitter, or production algorithm is substituted.
// These samples use the legacy ~0.65 screen-unit spacing, not an arbitrarily
// inflated point count. Both paths go through the SAME geometric error oracle.
const fs = require('node:fs'), vm = require('node:vm');
const context = { getWash: () => require('./wash.js') };
const curveSource = fs.readFileSync(require.resolve('./build/ts/hatch-curves.js'), 'utf8');
vm.runInNewContext(curveSource.replace(/\bexport (?=function )/g, ''), context);
const numberSource = fs.readFileSync(require.resolve('./build/ts/svg-number.js'), 'utf8');
vm.runInNewContext(numberSource.replace(/\bexport (?=function )/g, ''), context);
let strokeSource = fs.readFileSync(require.resolve('./build/ts/strokes.js'), 'utf8');
for (const statement of ["import { getWash } from './runtime.js';", "import { intersectSpans } from './hatch-curves.js';", "import { rounded3 } from './svg-number.js';"]) {
  assert.equal(strokeSource.split(statement).length, 2, 'bind known production module dependencies');
  strokeSource = strokeSource.replace(statement, '');
}
vm.runInNewContext(strokeSource.replace(/\bexport (?=function )/g, ''), context);
assert.equal(typeof context.createCurveRenderer, 'function');
const denseFixtures = [
  { name: 'periodic projected circle', steps: Math.ceil(2 * Math.PI * 60 / .65), closed: true,
    fn: t => { const a = t * 2 * Math.PI; return { p: [Math.cos(a), .6 * Math.sin(a), 0], n: [Math.cos(a), Math.sin(a), 0] }; } },
  { name: 'two clipped circle arcs', steps: Math.ceil(2 * Math.PI * 60 / .65), closed: false, clip: () => [[.05, .36], [.57, .92]],
    fn: t => { const a = t * 2 * Math.PI; return { p: [Math.cos(a), .6 * Math.sin(a), 0], n: [Math.cos(a), Math.sin(a), 0] }; } },
  { name: 'cylinder generator with spatial lighting', steps: Math.ceil(180 / .65), closed: false,
    fn: t => ({ p: [-1.5 + 3 * t, .2, .1], n: [0, .6, .8] }) },
];
for (const fixture of denseFixtures) for (const variableWidth of [false, true]) {
  function denseRender(optimizePaths) {
    const output = [];
    const curve = context.createCurveRenderer({
      options: { optimizePaths, variableWidth, shadingMode: 'hatch', shadingContrast: 1.2 },
      project: p => [150 + 60 * p[0], 100 - 60 * p[1]],
      illumination: (n, p) => .35 * n[0] + .25 * n[1] + .2 * Math.sin(p[0] * 1.7),
      visible: () => true, paths: output,
    });
    curve(fixture.fn, fixture.steps, .8, () => true, true, fixture.closed, fixture.clip || null);
    return '<svg><g data-role="engraving">' + output.join('') + '</g></svg>';
  }
  const before = denseRender(false), after = denseRender(true), oldPaths = paths(before), newPaths = paths(after);
  assert.ok(oldPaths.every(p => !p.commands.includes('C')), 'unhinted dense baseline is ML[Z]');
  if (fixture.clip) assert.equal(oldPaths.length, 2, 'both disjoint visible arcs are exercised');
  const geometry = compare(oldPaths, newPaths, `dense ${fixture.name} width=${variableWidth}`);
  const old = stats(before, oldPaths), now = stats(after, newPaths);
  assert.ok(1 - now.anchors / old.anchors >= .70, 'dense curves retain at least 70% fewer endpoint anchors');
  assert.ok(1 - now.bytes / old.bytes >= .50, 'dense curves retain at least 50% fewer serialized SVG bytes');
  if (variableWidth && !fixture.closed) assert.ok(geometry.tips > 0, 'dense tapered tips actually checked');
  console.log(`PASS dense ${fixture.name} variableWidth=${variableWidth}: anchors ${old.anchors}->${now.anchors}, bytes ${old.bytes}->${now.bytes}, boundary=${geometry.worst.toFixed(6)}, tips=${geometry.tips}`);
}

// Axis-aligned, well-exposed cylinder ensures its generators are unambiguously straight.
const cylinder = { name: 'straight cylinder regression', atoms: [{ element: 'C', position: [-1.5, 0, 0] }, { element: 'C', position: [1.5, 0, 0] }], bonds: [[0, 1]] };
for (const variableWidth of [false, true]) {
  const options = { yaw: 0, pitch: 0, variableWidth };
  const old = paths(render(cylinder, { ...options, optimizePaths: false })), now = paths(render(cylinder, options));
  compare(old, now, `straight cylinder variableWidth=${variableWidth}`);
  let outlines = 0, hatches = 0;
  for (let i = 0; i < old.length; i++) {
    const p = old[i];
    const outline = p.attributes.includes('stroke-width="0.880"');
    const hatch = p.attributes.includes('stroke-width="0.544"');
    if (!outline && !hatch) continue;
    assert.deepEqual(now[i].commands, ['M', 'L'], 'straight cylinder contour/equal-width hatch is exactly two endpoints');
    if (outline) outlines++; else hatches++;
  }
  assert.ok(outlines >= 2, 'both straight cylinder outlines tested');
  if (!variableWidth) assert.ok(hatches > 0, 'equal-width cylinder hatches tested');
  console.log(`PASS straight cylinder variableWidth=${variableWidth}: ${outlines} outlines, ${hatches} equal-width hatches`);
}
for (const optimizePaths of [false, true]) for (const variableWidth of [false, true]) {
  const options = { optimizePaths, variableWidth, colorWash: true };
  const none = render(examples.pair, { ...options, outlineWidth: 0, hatchWidth: 0 });
  assert.equal(paths(none).length, 0, 'zero widths emit no ink or degenerate ribbons');
  assert.ok(none.includes('class="mol-wash"'), 'zero ink still preserves color');
  const outlines = paths(render(examples.sphere, { ...options, hatchWidth: 0 }));
  assert.equal(outlines.length, 1, 'zero hatch width leaves only outline');
  const hatches = paths(render(examples.sphere, { ...options, outlineWidth: 0 }));
  assert.ok(hatches.length > 10, 'zero outline width retains hatches');
  assert.ok(hatches.every(p => !p.attributes.includes('stroke-width="1.120"')), 'zero outline width removes outline');
}
for (const name of ['sphere', 'pair', 'ethanol']) {
  const options = { colorWash: true, labels: true, labelMatchFill: true };
  const old = render(examples[name], { ...options, optimizePaths: false }), now = render(examples[name], { ...options, optimizePaths: true });
  assert.ok(inkGroups(now).length > 0);
  assert.equal(inkGroups(now).length, inkGroups(old).length, name + ': owner engraving layer count unchanged');
  if (name !== 'sphere') assert.ok(inkGroups(now).length > 1, 'exercise all-owner parsing, not just the first engraving group');
  compare(paths(old), paths(now), name + ': all labeled owner geometry');
  assert.equal(withoutInk(now), withoutInk(old), name + ': every color plate, label, owner layer and SVG shell unchanged');
}
console.log('PASS all optimize-path regressions (no output files written).');
