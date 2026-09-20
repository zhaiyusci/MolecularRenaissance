'use strict';
// Focused numerical oracle for the analytic paths; no browser or raster output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const unit = v => { const inverse = 1 / Math.hypot(...v); return v.map(x => x * inverse); };
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const project = p => [31 + 25 * p[0], 47 - 25 * p[1]];

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

(async () => {
  const source = fs.readFileSync(path.join(__dirname, 'build/ts/surface-tones.js'), 'utf8');
  const { directionalTonePath } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const { depthAt } = await import(pathToFileURL(path.join(__dirname, 'dist/molplotter.mjs')).href);
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
    const shapeLights = s.kind === 'sphere' ? lights : [...lights, s.u, s.u.map(v => -v)];
    for (const rawLight of shapeLights) {
      const L = unit(rawLight), h = Math.hypot(L[0], L[1]);
      // +/-h are sphere equator/isocircle tangencies; nearby values exercise
      // both crossing and noncrossing topology. Cap equality is included too.
      const thresholds = [-1, -0.6, -0.15, 0, 0.15, 0.6, 1, -h, h, -h + 1e-5, h - 1e-5];
      if (s.kind === 'cylinder') thresholds.push(dot(s.u, L), -dot(s.u, L));
      for (const T of new Set(thresholds)) {
        const d = directionalTonePath(s, project, rawLight, T), edges = flatten(d);
        let checked = 0;
        for (let ix = 0; ix < 23; ix++) for (let iy = 0; iy < 23; iy++) {
          // Deliberately off-center coordinates avoid systematic symmetry hits.
          const x = bounds[0][0] + (ix + 0.317) / 23 * (bounds[0][1] - bounds[0][0]);
          const y = bounds[1][0] + (iy + 0.619) / 23 * (bounds[1][1] - bounds[1][0]);
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
        assert.ok(checked > 100, `sufficient oracle comparisons: ${name}`);
        cases++;
      }
    }
    console.log(`PASS directional tone membership: ${name}`);
  }
  assert.ok(capComparisons > 1000, 'visible planar caps exercised');
  assert.equal(directionalTonePath(sphere, project, [0, 0, 7], 0.4), directionalTonePath(sphere, project, [0, 0, 1], 0.4), 'nonunit light is normalized');
  assert.equal(directionalTonePath(sphere, project, [0, 0, 0], 0), '');
  assert.equal(directionalTonePath(sphere, project, [1, 0, 0], NaN), '');
  assert.equal(directionalTonePath(sphere, project, [1, 0, 0], -1), '');
  console.log(`PASS ${cases} tone cases; ${comparisons} point comparisons (${capComparisons} cap points)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
