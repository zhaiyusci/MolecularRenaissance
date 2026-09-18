'use strict';
// Continuous-boundary regression, independent of ownership-mask sample centers.
const assert = require('node:assert/strict');
const { buildWash } = require('./wash.js');
const { depthAt } = require('./renderer.js');
const palette = { R: '#ff0000', B: '#0000ff', G: '#00ff00', W: '#ffffff' };
const sphere = (x, y, z, r, element) => ({ kind: 'sphere', c: [x, y, z], r, element });
const cases = {
  crossing: [sphere(-5, 0, 0, 17, 'R'), sphere(6, 0, 5, 11, 'B')],
  white: [sphere(0, 0, 0, 24, 'R'), sphere(0, 0, 25, 7, 'W')],
  cylinder: [sphere(0, 0, 0, 24, 'R'), { kind: 'cylinder', a: [0, -8, 30], u: [0, 1, 0], length: 16, r: 3 }],
  triple: [sphere(-7, 0, 0, 15, 'R'), sphere(7, 0, 0, 15, 'B'), sphere(0, 10, 0, 15, 'G')]
};
for (const [name, scene] of Object.entries(cases)) {
  function owner(q) {
    let best = -Infinity, color = null;
    for (const shape of scene) {
      const z = depthAt(shape, q[0], -q[1]);
      const c = shape.kind === 'cylinder' || shape.element === 'W' ? null : palette[shape.element];
      if (Number.isFinite(z) && (z > best || (z === best && c === null))) { best = z; color = c; }
    }
    return color;
  }
  const svg = buildWash(scene, depthAt, p => [p[0], -p[1]], 1, e => palette[e]);
  let maxError = 0, anchors = 0, samples = 0, worst;
  for (const path of svg.matchAll(/<path fill="([^"]+)"[^>]* d="([^"]+)"/g)) {
    let p;
    const member = q => owner(q) === path[1];
    for (const command of path[2].matchAll(/([MLCZ])([^MLCZ]*)/g)) {
      const n = command[2].trim().split(/\s+/).map(Number), op = command[1];
      if (op === 'M') { p = n; anchors++; continue; }
      if (op === 'Z') continue;
      const a = p, b = op === 'L' ? n : n.slice(4), c = op === 'C' ? n.slice(0, 2) : a, d = op === 'C' ? n.slice(2, 4) : b;
      anchors++;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100, s = 1 - t;
        const q = op === 'L' ? [a[0] * s + b[0] * t, a[1] * s + b[1] * t] :
          [0, 1].map(k => a[k] * s ** 3 + 3 * c[k] * s * s * t + 3 * d[k] * s * t * t + b[k] * t ** 3);
        // Upper bound on nearest-boundary distance: locate a real ownership
        // transition along 32 directions. Multiple directions handle corners.
        let error = Infinity;
        for (let j = 0; j < 32; j++) {
          const vx = Math.cos(j * Math.PI / 32), vy = Math.sin(j * Math.PI / 32);
          let lo = -0.15, hi = 0.15;
          const initial = member([q[0] + vx * lo, q[1] + vy * lo]);
          if (initial === member([q[0] + vx * hi, q[1] + vy * hi])) continue;
          for (let k = 0; k < 18; k++) {
            const mid = (lo + hi) / 2;
            if (member([q[0] + vx * mid, q[1] + vy * mid]) === initial) lo = mid; else hi = mid;
          }
          error = Math.min(error, Math.abs((lo + hi) / 2));
        }
        if (error > maxError) { maxError = error; worst = q; }
        samples++;
      }
      p = b;
    }
  }
  console.log(`${name}: ${anchors} anchors, ${samples} probes, max boundary error ${maxError.toFixed(6)} SVG, worst ${worst}`);
  assert.ok(maxError < 0.03, `${name}: continuous boundary must be within .03 SVG, got ${maxError}`);
}
