'use strict';
// Focused numerical oracle for the analytic paths; no browser or raster output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const unit = v => { const inverse = 1 / Math.hypot(...v); return v.map(x => x * inverse); };
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const project = p => [31 + 25 * p[0], 47 - 25 * p[1]];

// ---------------------------------------------------------------------------
// Sampling budget.
//
// This oracle used to sweep a 23x23 = 529 point uniform lattice for every
// (shape, light, threshold) triple: 490 cases x 529 = 253,558 point
// comparisons, 60,352 of them cap points, ~0.7s of the commit gate. The
// predicate under test (path membership vs illumination <= T) is a smooth
// analytic classification, so a dense uniform sweep only re-proves the same
// classification between the band edges; resolution came from luck (points that
// happened to land just outside the 0.08px boundary tolerance). The same
// coverage is obtained deliberately, with ~13x fewer comparisons:
//
//   LATTICE_INDEX   a sparse stride of the ORIGINAL 23-step lattice, keeping
//                   its deliberately off-centre offsets so no sample lands on a
//                   systematic symmetry hit. Covers interior, exterior and the
//                   padded margin of the projected bounding box.
//   edgeProbes()    bisects the analytic band edge along four off-axis rays and
//                   samples EDGE_OFFSETS_PX either side. This targets tone-band
//                   boundaries and band edges exactly at a threshold far more
//                   tightly than the old lattice pitch (~0.7px vs ~2px).
//   capProbes()     explicit planar cap samples (centre + interior ring) for the
//                   cylinders, where an entire cap - not a measure-zero curve -
//                   can lie exactly at the requested threshold.
//
// MAX_POINT_COMPARISONS is the deliberate ceiling; it sits just above the
// measured count, so the gate fails if the sampling budget creeps back up.
// ---------------------------------------------------------------------------
const PX = 1 / 25;                        // one projected pixel in view-space units
const LATTICE_DENOMINATOR = 23;           // original 23x23 sweep pitch
const LATTICE_INDEX = [0, 5, 11, 17, 22]; // stride of that sweep: 5x5 = 25 points
const RAY_ANGLES = [0.41, 1.83, 3.07, 4.62]; // off-axis, avoid symmetry hits
const RAY_SAMPLES = 10;                   // coarse scan per ray before bisection
const RAY_BISECTIONS = 14;                // locates a band edge to ~1e-4 view units
const MAX_EDGE_FLIPS_PER_RAY = 2;         // contour crossing plus silhouette crossing
const EDGE_OFFSETS_PX = [0.7, 2.2];       // sampled either side of every located edge
const CAP_RING_FRACTION = 0.7;            // interior cap samples, clear of the rim
const CAP_RING_ANGLES = [0.7, 2.5, 4.4];
const MIN_CASE_COMPARISONS = 15;          // every case must still assert something (measured min 23)
const MIN_CAP_COMPARISONS = 3500;         // visible planar caps exercised (measured 4624)
// Measured: 19757 point comparisons over 490 cases, down from 253558 under the
// old 23x23 sweep (a 12.8x reduction). The ceiling sits just above that, so the
// gate fails if the sampling budget creeps back up towards the dense sweep.
const MAX_POINT_COMPARISONS = 21000;
let depthAt;                              // bound below, once the bundle is imported

function flatten(d) {
  assert.ok(!/NaN|Infinity|undefined/.test(d));
  const tokens = d.match(/[MLCZ]|-?\d+\.\d{4}/g) || [];
  assert.equal(tokens.join(''), d.replace(/\s/g, ''), 'only M/L/C/Z and four-decimal coordinates');
  const edges = [];
  let i = 0, current, start, open = false;
  const point = () => [Number(tokens[i++]), Number(tokens[i++])];
  const line = q => { edges.push([current, q]); current = q; };
  while (i < tokens.length) {
    const op = tokens[i++];
    if (op === 'M') {
      assert.ok(!open, 'previous subpath closed');
      current = start = point(); open = true;
    } else if (op === 'L') {
      assert.ok(open); line(point());
    } else if (op === 'C') {
      assert.ok(open);
      const a = current, b = point(), c = point(), end = point();
      // This is test-only curve flattening, not production surface sampling.
      for (let j = 1; j <= 20; j++) {
        const t = j / 20, v = 1 - t;
        line([0, 1].map(k => v ** 3 * a[k] + 3 * v * v * t * b[k] + 3 * v * t * t * c[k] + t ** 3 * end[k]));
      }
    } else if (op === 'Z') {
      assert.ok(open); line(start); open = false;
    } else assert.fail(`unexpected operation ${op}`);
  }
  assert.ok(!open, 'final subpath closed');
  return edges;
}

function membership(edges, p) {
  let inside = false, distance2 = Infinity;
  for (const [a, b] of edges) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    distance2 = Math.min(distance2, (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2);
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + (p[1] - a[1]) * dx / dy) inside = !inside;
  }
  return { inside, near: distance2 < 0.08 ** 2 };
}

function normalAt(s, x, y, z) {
  if (s.kind === 'sphere') {
    const n = [x - s.c[0], y - s.c[1], z - s.c[2]].map(v => v / s.r);
    return { n, near: n[2] < 0.06, cap: false };
  }
  const d = [x - s.a[0], y - s.a[1], z - s.a[2]], axial = dot(d, s.u);
  const radial = d.map((v, i) => v - axial * s.u[i]);
  const atA = Math.abs(axial) < 1e-8, atB = Math.abs(axial - s.length) < 1e-8;
  if (atA || atB) return {
    n: s.u.map(v => v * (atB ? 1 : -1)), cap: true,
    near: Math.abs(Math.hypot(...radial) - s.r) < 0.004,
  };
  const n = unit(radial);
  return { n, cap: false, near: axial < 0.004 || s.length - axial < 0.004 || n[2] < 0.03 };
}

// Front-surface classification at a projection-plane sample. `blank` marks a
// sample the analytic oracle cannot answer (ray miss, or too near a silhouette)
// and classifies as outside - which is exactly what the membership assertion
// expects for a ray that misses the primitive. Treating it as a class is what
// lets edgeProbes find the silhouette crossing, not just the tone contour.
function classify(s, L, T, x, y) {
  const z = depthAt(s, x, y);
  if (!Number.isFinite(z)) return { inside: false, blank: true };
  const hit = normalAt(s, x, y, z);
  if (hit.near) return { inside: false, blank: true };
  return { inside: dot(hit.n, L) <= T, blank: false };
}

/** Band-edge probes: bisect each classification flip along a ray, then sample
 *  EDGE_OFFSETS_PX either side. Covers tone-band boundaries and silhouette
 *  crossings, i.e. exactly where a path boundary has to lie. */
function edgeProbes(s, L, T, centre, reach) {
  const out = [];
  for (const angle of RAY_ANGLES) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let previous = classify(s, L, T, centre[0], centre[1]), previousT = 0, found = 0;
    for (let i = 1; i <= RAY_SAMPLES && found < MAX_EDGE_FLIPS_PER_RAY; i++) {
      const t = i / RAY_SAMPLES * reach;
      const current = classify(s, L, T, centre[0] + dx * t, centre[1] + dy * t);
      if (previous.inside !== current.inside) {
        let lo = previousT, hi = t;
        for (let k = 0; k < RAY_BISECTIONS; k++) {
          const mid = (lo + hi) / 2;
          const at = classify(s, L, T, centre[0] + dx * mid, centre[1] + dy * mid);
          if (at.inside === previous.inside) lo = mid; else hi = mid;
        }
        const edge = (lo + hi) / 2;
        for (const px of EDGE_OFFSETS_PX) for (const sign of [-1, 1]) {
          const at = edge + sign * px * PX;
          out.push([centre[0] + dx * at, centre[1] + dy * at]);
        }
        found++;
      }
      previousT = t; previous = current;
    }
  }
  return out;
}

/** Explicit planar cap samples: projected cap centre plus an interior ring.
 *  Entire caps can sit exactly at the requested threshold, so they are sampled
 *  on purpose rather than left to lattice luck. */
function capProbes(s) {
  if (s.kind !== 'cylinder') return [];
  const u = s.u, h = Math.hypot(u[0], u[1]);
  const e = h > 0 ? [-u[1] / h, u[0] / h, 0] : [1, 0, 0];
  const f = cross(u, e);
  const b = s.a.map((v, i) => v + u[i] * s.length);
  const out = [];
  for (const centre of [s.a, b]) {
    out.push([centre[0], centre[1]]);
    for (const angle of CAP_RING_ANGLES) {
      const rim = centre.map((v, i) => v + s.r * (Math.cos(angle) * e[i] + Math.sin(angle) * f[i]));
      out.push([centre[0] + CAP_RING_FRACTION * (rim[0] - centre[0]),
        centre[1] + CAP_RING_FRACTION * (rim[1] - centre[1])]);
    }
  }
  return out;
}

(async () => {
  const source = fs.readFileSync(path.join(__dirname, 'build/ts/surface-tones.js'), 'utf8');
  const { directionalTonePath } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  ({ depthAt } = await import(pathToFileURL(path.join(__dirname, 'dist/molplotter.mjs')).href));
  const sphere = { kind: 'sphere', c: [0.17, -0.11, 0.3], r: 0.9 };
  const cylinder = u => ({ kind: 'cylinder', a: [-0.43, -0.28, -0.6], u: unit(u), length: 1.45, r: 0.38 });
  const shapes = [
    ['sphere', sphere], ['end-on +z', cylinder([0, 0, 1])],
    ['end-on -z', cylinder([0, 0, -1])], ['side-on', cylinder([1, 0, 0])],
    ['oblique +z', cylinder([0.6, 0.4, 0.7])], ['oblique -z', cylinder([-0.5, 0.6, -0.8])],
  ];
  const lights = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [0, -1, 0], [0.3, 0.4, 0.8660254037844386], [-0.3, 0.4, -0.8660254037844386]];
  let cases = 0, comparisons = 0, capComparisons = 0;
  for (const [name, s] of shapes) {
    const b = s.kind === 'sphere' ? s.c : s.a.map((v, i) => v + s.u[i] * s.length);
    const a = s.kind === 'sphere' ? s.c : s.a;
    const bounds = [0, 1].map(i => [Math.min(a[i], b[i]) - s.r - 0.06, Math.max(a[i], b[i]) + s.r + 0.06]);
    // Sparse stride of the original 23x23 lattice; the offsets stay deliberately
    // off-centre so no sample lands on a systematic symmetry hit.
    const lattice = [];
    for (const ix of LATTICE_INDEX) for (const iy of LATTICE_INDEX) {
      lattice.push([
        bounds[0][0] + (ix + 0.317) / LATTICE_DENOMINATOR * (bounds[0][1] - bounds[0][0]),
        bounds[1][0] + (iy + 0.619) / LATTICE_DENOMINATOR * (bounds[1][1] - bounds[1][0]),
      ]);
    }
    const caps = capProbes(s);
    // Rays start at the projected primitive centre and run past its silhouette.
    const centre = s.kind === 'sphere' ? [s.c[0], s.c[1]]
      : [s.a[0] + s.u[0] * s.length / 2, s.a[1] + s.u[1] * s.length / 2];
    const reach = Math.hypot(bounds[0][1] - bounds[0][0], bounds[1][1] - bounds[1][0]) / 2;
    const shapeLights = s.kind === 'sphere' ? lights : [...lights, s.u, s.u.map(v => -v)];
    for (const rawLight of shapeLights) {
      const L = unit(rawLight), h = Math.hypot(L[0], L[1]);
      // +/-h are sphere equator/isocircle tangencies; nearby values exercise
      // both crossing and noncrossing topology. Cap equality is included too.
      // The extremes -1/+1 are the empty-band and fully-dark degenerate cases.
      const thresholds = [-1, -0.6, -0.15, 0, 0.15, 0.6, 1, -h, h, -h + 1e-5, h - 1e-5];
      if (s.kind === 'cylinder') thresholds.push(dot(s.u, L), -dot(s.u, L));
      for (const T of new Set(thresholds)) {
        const d = directionalTonePath(s, project, rawLight, T), edges = flatten(d);
        const edge = edgeProbes(s, L, T, centre, reach);
        const samples = [...lattice, ...edge, ...caps];
        let checked = 0;
        for (const [x, y] of samples) {
          const result = membership(edges, project([x, y, 0]));
          if (result.near) continue;
          const z = depthAt(s, x, y);
          let expected = false;
          if (Number.isFinite(z)) {
            const hit = normalAt(s, x, y, z), illumination = dot(hit.n, L);
            if (hit.near || (!hit.cap && Math.abs(illumination - T) < 0.004)) continue;
            // Compare planar equality exactly: entire caps, not just a
            // measure-zero curve, can lie at the requested threshold.
            expected = illumination <= T;
            if (hit.cap) capComparisons++;
          }
          assert.equal(result.inside, expected, `${name}; L=${L}; T=${T}; p=${[x, y, z]}`);
          comparisons++; checked++;
        }
        assert.ok(checked >= MIN_CASE_COMPARISONS, `sufficient oracle comparisons: ${name}; got ${checked}`);
        cases++;
      }
    }
    console.log(`PASS directional tone membership: ${name}`);
  }
  assert.ok(capComparisons >= MIN_CAP_COMPARISONS, `visible planar caps exercised: ${capComparisons}`);
  assert.ok(comparisons <= MAX_POINT_COMPARISONS,
    `point comparison budget: ${comparisons} > ${MAX_POINT_COMPARISONS}`);
  assert.equal(directionalTonePath(sphere, project, [0, 0, 7], 0.4), directionalTonePath(sphere, project, [0, 0, 1], 0.4), 'nonunit light is normalized');
  assert.equal(directionalTonePath(sphere, project, [0, 0, 0], 0), '');
  assert.equal(directionalTonePath(sphere, project, [1, 0, 0], NaN), '');
  assert.equal(directionalTonePath(sphere, project, [1, 0, 0], -1), '');
  console.log(`PASS ${cases} tone cases; ${comparisons} point comparisons (${capComparisons} cap points)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
