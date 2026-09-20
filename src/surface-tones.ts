import type { Primitive, Project, Vector } from './types.js';

const TAU = 2 * Math.PI;
const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul = (a: Vector, k: number): Vector => a.map(x => x * k);
const add = (a: Vector, b: Vector): Vector => a.map((x, i) => x + b[i]);
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const positiveAngle = (t: number): number => ((t % TAU) + TAU) % TAU;
const clamp = (x: number): number => Math.max(-1, Math.min(1, x));
const fmt = (p: Vector): string => `${p[0].toFixed(4)} ${p[1].toFixed(4)}`;

interface Ellipse { at(t: number): Vector; tangent(t: number): Vector; }

/** Affine (orthographic) projection preserves these circle/ellipse controls. */
function ellipse(project: Project, center: Vector, u: Vector, v: Vector): Ellipse {
  const c = project(center), pu = project(add(center, u)), pv = project(add(center, v));
  const U = [pu[0] - c[0], pu[1] - c[1]], V = [pv[0] - c[0], pv[1] - c[1]];
  return {
    at: t => [c[0] + U[0] * Math.cos(t) + V[0] * Math.sin(t),
      c[1] + U[1] * Math.cos(t) + V[1] * Math.sin(t)],
    tangent: t => [-U[0] * Math.sin(t) + V[0] * Math.cos(t),
      -U[1] * Math.sin(t) + V[1] * Math.cos(t)],
  };
}

/** Optional anchors make adjoining carriers use identical intersection points. */
function arc(e: Ellipse, start: number, end: number, first?: Vector, last?: Vector): string {
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 4)));
  const step = (end - start) / count, k = 4 / 3 * Math.tan(step / 4);
  let out = '', p = first ?? e.at(start);
  for (let i = 0; i < count; i++) {
    const a = start + i * step, b = i === count - 1 ? end : start + (i + 1) * step;
    const q = i === count - 1 && last ? last : e.at(b);
    const da = e.tangent(a), db = e.tangent(b);
    out += `C${fmt([p[0] + k * da[0], p[1] + k * da[1]])} ${fmt([q[0] - k * db[0], q[1] - k * db[1]])} ${fmt(q)}`;
    p = q;
  }
  return out;
}

function full(e: Ellipse): string {
  const p = e.at(0);
  return `M${fmt(p)}${arc(e, 0, TAU, p, p)}Z`;
}

/**
 * Closed analytic directional-light tone boundaries, for SVG fill-rule="evenodd".
 * Coordinates/normals are in view space (+z faces the viewer); project must be
 * affine/orthographic. Occlusion is deliberately left to the caller's clip path.
 * Circular arcs use standard cubic approximations spanning at most pi/4.
 * A zero/nonfinite light or NaN threshold produces an empty path.
 */
export function directionalTonePath(s: Primitive, project: Project, light: Vector, threshold: number): string {
  const lightLength = Math.hypot(light[0], light[1], light[2]);
  if (!(lightLength > 0) || !Number.isFinite(lightLength) || Number.isNaN(threshold) || !(s.r > 0)) return '';
  const L = mul(light, 1 / lightLength), T = threshold;

  if (s.kind === 'sphere') {
    if (T <= -1) return '';
    const rim = ellipse(project, s.c, [s.r, 0, 0], [0, s.r, 0]);
    if (T >= 1) return full(rim);
    const h = Math.hypot(L[0], L[1]), q = Math.sqrt((1 - T) * (1 + T));
    const e = h > 0 ? [-L[1] / h, L[0] / h, 0] : [1, 0, 0];
    const f = cross(L, e);
    const iso = ellipse(project, add(s.c, mul(L, s.r * T)), mul(e, s.r * q), mul(f, s.r * q));

    // Axial T=0 has coincident rim/isocircle: do not XOR the rim with itself.
    if (h === 0) {
      if (L[2] > 0) return T <= 0 ? '' : full(rim) + full(iso);
      return T >= 0 ? full(rim) : full(iso);
    }

    if (Math.abs(T) < h) {
      const phi = Math.atan2(L[1], L[0]), alpha = Math.acos(clamp(T / h));
      // This increasing equator arc contains phi+pi, the darkest rim point.
      const a = phi + alpha, b = phi + TAU - alpha;
      const n0 = [Math.cos(a), Math.sin(a), 0], n1 = [Math.cos(b), Math.sin(b), 0];
      const p0 = project(add(s.c, mul(n0, s.r))), p1 = project(add(s.c, mul(n1, s.r)));
      // n dot e/f = q cos/sin(t); the center T*L is perpendicular to e/f.
      const t0 = Math.atan2(dot(n1, f), dot(n1, e));
      const t1 = Math.atan2(dot(n0, f), dot(n0, e));
      let sweep = positiveAngle(t1 - t0);
      const mid = t0 + sweep / 2;
      if (T * L[2] + q * (e[2] * Math.cos(mid) + f[2] * Math.sin(mid)) < 0) sweep -= TAU;
      return `M${fmt(p0)}${arc(rim, a, b, p0, p1)}${arc(iso, t0, t0 + sweep, p1, p0)}Z`;
    }

    // No transverse crossings (including tangency): each entire boundary is
    // either eligible or hidden. Center z decides frontness here; using it
    // avoids cancellation in min-z at a tangent. Evenodd gives holes or caps.
    let out = T >= h ? full(rim) : '';
    if (T * L[2] > 0) out += full(iso);
    return out;
  }

  // Primitive cylinder axes are unit vectors, as required by the scene model.
  const u = s.u, h = Math.hypot(u[0], u[1]);
  const e = h > 0 ? [-u[1] / h, u[0] / h, 0] : [1, 0, 0];
  const f = cross(u, e), b = add(s.a, mul(u, s.length));
  const ca = ellipse(project, s.a, mul(e, s.r), mul(f, s.r));
  const cb = ellipse(project, b, mul(e, s.r), mul(f, s.r));
  let out = '';
  if (h > 0 && s.length > 0) {
    // f.z=h, so precisely theta in [0,pi] faces the viewer.
    const A = dot(e, L), B = dot(f, L), R = Math.hypot(A, B);
    const cuts = [0, Math.PI];
    if (R > 0 && Math.abs(T) < R) {
      const phase = Math.atan2(B, A), delta = Math.acos(clamp(T / R));
      for (const base of [phase - delta, phase + delta]) {
        const t = positiveAngle(base);
        if (t > 0 && t < Math.PI) cuts.push(t);
      }
    }
    // A tangent root does not change interval eligibility and needs no split.
    cuts.sort((x, y) => x - y);
    for (let i = 1; i < cuts.length; i++) {
      const t0 = cuts[i - 1], t1 = cuts[i], mid = (t0 + t1) / 2;
      if (!(t1 > t0) || A * Math.cos(mid) + B * Math.sin(mid) > T) continue;
      // At an exact minimum, only a generator is eligible (zero filled area).
      if (R > 0 && T <= -R) continue;
      const a0 = ca.at(t0), b0 = cb.at(t0), b1 = cb.at(t1), a1 = ca.at(t1);
      out += `M${fmt(a0)}L${fmt(b0)}${arc(cb, t0, t1, b0, b1)}L${fmt(a1)}${arc(ca, t1, t0, a1, a0)}Z`;
    }
  }
  // End-on cylinders intentionally contribute only the visible planar cap.
  const axialLight = dot(u, L);
  if (u[2] > 0 && axialLight <= T) out += full(cb);
  if (u[2] < 0 && -axialLight <= T) out += full(ca);
  return out;
}
