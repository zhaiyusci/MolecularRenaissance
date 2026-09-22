/* Projected polygon clipping only: no scene/depth or quartic intersections. */
import type { Intervals, SurfaceRegion, Vector } from './types';

type Edge = { p: Vector; q: Vector; dx: number; dy: number; bounds: number[] };
type Node = { bounds: number[]; edges?: Edge[]; left?: Node; right?: Node };
const TAU = 2 * Math.PI, EPS = Number.EPSILON;
function overlaps(a: readonly number[], b: readonly number[]): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}
function box(edges: readonly Edge[]): number[] {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const e of edges) for (let k = 0; k < 4; k++) b[k] = k < 2 ? Math.min(b[k], e.bounds[k]) : Math.max(b[k], e.bounds[k]);
  return b;
}
function index(edges: Edge[]): Node {
  const bounds = box(edges);
  if (edges.length <= 12) return { bounds, edges };
  const axis = bounds[2] - bounds[0] >= bounds[3] - bounds[1] ? 0 : 1;
  edges.sort((a, b) => (a.bounds[axis] + a.bounds[axis + 2]) - (b.bounds[axis] + b.bounds[axis + 2]));
  const half = edges.length >>> 1;
  return { bounds, left: index(edges.slice(0, half)), right: index(edges.slice(half)) };
}
function visit(node: Node, bounds: readonly number[], fn: (edge: Edge) => void): void {
  if (!overlaps(node.bounds, bounds)) return;
  if (node.edges) { for (const e of node.edges) if (overlaps(e.bounds, bounds)) fn(e); }
  else { visit(node.left!, bounds, fn); visit(node.right!, bounds, fn); }
}
function intervals(cuts: number[], at: (t: number) => Vector, contains: (x: number, y: number) => boolean, accept?: (t: number) => boolean): Intervals {
  cuts.sort((a, b) => a - b);
  const result: Intervals = [];
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1], b = cuts[i];
    if (!(b > a)) continue;
    const midpoint = a + (b - a) / 2;
    if (accept && !accept(midpoint)) continue;
    const p = at(midpoint);
    if (!contains(p[0], p[1])) continue;
    const last = result[result.length - 1];
    // Merge only exactly adjacent accepted bins, never across a small hole.
    if (last && last[1] === a) last[1] = b;
    else result.push([a, b]);
  }
  return result;
}
function valid(p: Vector): boolean { return Number.isFinite(p[0]) && Number.isFinite(p[1]); }

/** The edges must describe complete closed contours. Orientation is irrelevant.
 * Bounds are [minX,minY,maxX,maxY]; a supplied box is conservatively enlarged.
 * Boundaries belong to the region, including a line coincident with an edge.
 */
export function createRegion(input: readonly { p: Vector; q: Vector }[], bounds?: readonly number[]): SurfaceRegion {
  const edges: Edge[] = [];
  for (const e of input) {
    if (!valid(e.p) || !valid(e.q)) throw new Error('Non-finite region edge');
    const p = e.p.slice(0, 2), q = e.q.slice(0, 2);
    if (p[0] === q[0] && p[1] === q[1]) continue;
    edges.push({ p, q, dx: q[0] - p[0], dy: q[1] - p[1], bounds: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])] });
  }
  const root = index(edges), regionBounds = root.bounds.slice();
  if (bounds && bounds.length >= 4 && bounds.slice(0, 4).every(Number.isFinite)) {
    for (let k = 0; k < 4; k++) regionBounds[k] = k < 2 ? Math.min(regionBounds[k], bounds[k]) : Math.max(regionBounds[k], bounds[k]);
  }
  function contains(x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !overlaps(root.bounds, [x, y, x, y])) return false;
    let inside = false, boundary = false;
    visit(root, [x, y, Infinity, y], e => {
      const [px, py] = e.p, qy = e.q[1], dx = e.dx, dy = e.dy;
      const cross = (x - px) * dy - (y - py) * dx;
      const tolerance = 8 * EPS * (Math.abs((x - px) * dy) + Math.abs((y - py) * dx));
      if (x >= e.bounds[0] && x <= e.bounds[2] && Math.abs(cross) <= tolerance) boundary = true;
      if ((py > y) !== (qy > y) && x < px + (y - py) * dx / dy) inside = !inside;
    });
    return boundary || inside;
  }
  function clipEllipse(c: Vector, u: Vector, v: Vector, candidates?: readonly Edge[], cuts = [0, 1], accept?: (t: number) => boolean): Intervals | null {
      if (!valid(c) || !valid(u) || !valid(v)) return null;
      const scale = Math.max(Math.abs(u[0]), Math.abs(u[1]), Math.abs(v[0]), Math.abs(v[1]));
      if (!(scale > 0) || scale > 1e150 || scale < 1e-150) return null;
      const ux = u[0] / scale, uy = u[1] / scale, vx = v[0] / scale, vy = v[1] / scale;
      const det = ux * vy - uy * vx;
      if (Math.abs(det) < 1e-12) return null;
      const rx = Math.hypot(u[0], v[0]), ry = Math.hypot(u[1], v[1]);
      const extent = Math.max(root.bounds[2] - root.bounds[0], root.bounds[3] - root.bounds[1]);
      if (edges.length && (scale > Math.max(extent, 1e-150) * 1e10 || Math.max(Math.abs(c[0]), Math.abs(c[1])) * EPS > scale * 1e-6)) return null;
      const eb = [c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry];
      if (!edges.length || !overlaps(root.bounds, eb)) return [];
      let unsafe = false;
      function intersect(e: Edge): void {
        const x = (e.p[0] - c[0]) / scale, y = (e.p[1] - c[1]) / scale;
        const px = (vy * x - vx * y) / det, py = (ux * y - uy * x) / det;
        const qx = (e.q[0] - c[0]) / scale, qy = (e.q[1] - c[1]) / scale;
        const qpx = (vy * qx - vx * qy) / det, qpy = (ux * qy - uy * qx) / det;
        const dx = qpx - px, dy = qpy - py, length = Math.hypot(dx, dy);
        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(qpx) || !Number.isFinite(qpy) || !(length > 0)) { unsafe = true; return; }
        const norm = Math.hypot(px, py);
        if (Math.max(norm, Math.hypot(qpx, qpy)) > 1e8) { unsafe = true; return; }
        const ex = dx / length, ey = dy / length;
        // Unit-speed segment in the inverse ellipse frame meets the unit circle.
        // D = 1 - cross(p,e)^2 avoids cancellation of b*b - a*c.
        const b = px * ex + py * ey, h = px * ey - py * ex;
        let d = (1 - Math.abs(h)) * (1 + Math.abs(h));
        if (d < -32 * EPS * Math.max(1, h * h)) return;
        d = Math.max(0, d);
        const r = Math.sqrt(d), stable = -b - (b < 0 ? -r : r);
        const roots = stable === 0 ? [-b] : [stable, (norm - 1) * (norm + 1) / stable];
        for (const s of roots) {
          const t = s / length;
          if (t < -32 * EPS || t > 1 + 32 * EPS) continue;
          const f = Math.max(0, Math.min(1, t));
          let angle = Math.atan2(py + f * dy, px + f * dx) / TAU;
          if (angle < 0) angle += 1;
          cuts.push(angle);
        }
      }
      if (candidates) { for (const edge of candidates) if (overlaps(edge.bounds, eb)) intersect(edge); }
      else visit(root, eb, intersect);
      if (unsafe) return null;
      return intervals(cuts, t => {
        const a = TAU * t, co = Math.cos(a), si = Math.sin(a);
        return [c[0] + u[0] * co + v[0] * si, c[1] + u[1] * co + v[1] * si];
      }, contains, accept);
  }
  return {
    bounds: Object.freeze(regionBounds), contains,
    clipEllipse,
    sphereFamily(c, r, axis, e, f) {
      const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const basis = [axis, e, f];
      if (!valid(c) || !(r > 0) || !Number.isFinite(r) || r < 1e-150 || r > 1e150 ||
          basis.some(a => a.length < 3 || !a.slice(0, 3).every(Number.isFinite) || Math.abs(dot(a, a) - 1) > 1e-9) ||
          Math.abs(dot(axis, e)) > 1e-9 || Math.abs(dot(axis, f)) > 1e-9 || Math.abs(dot(e, f)) > 1e-9 ||
          Math.abs(e[0] * f[1] - e[1] * f[0]) < 1e-12) return () => null;
      // Retain an immutable family chart even if the caller reuses its vectors.
      const center = c.slice(0, 2), a = axis.slice(0, 3), u = e.slice(0, 3), v = f.slice(0, 3);
      const count = Math.max(32, Math.min(1024, Math.ceil(Math.sqrt(edges.length) * 8)));
      const bins: Edge[][] = Array.from({ length: count }, () => []);
      const bin = (h: number) => Math.max(0, Math.min(count - 1, Math.floor((h + 1) * .5 * count)));
      let refs = 0;
      for (const edge of edges) {
        const px = (edge.p[0] - center[0]) / r, py = (edge.p[1] - center[1]) / r;
        const qx = (edge.q[0] - center[0]) / r, qy = (edge.q[1] - center[1]) / r;
        const dx = qx - px, dy = qy - py, length2 = dx * dx + dy * dy;
        if (![px, py, qx, qy, length2].every(Number.isFinite)) return () => null;
        const t = length2 > 0 ? Math.max(0, Math.min(1, -(px * dx + py * dy) / length2)) : 0;
        const near2 = (px + t * dx) ** 2 + (py + t * dy) ** 2;
        const far2 = Math.max(px * px + py * py, qx * qx + qy * qy);
        // Outward error covers rounded silhouette vertices, including segments
        // with endpoints just outside the sphere but interior points inside it.
        const error = 64 * EPS * Math.max(1, far2);
        if (near2 > 1 + error) continue;
        const zlo = Math.sqrt(Math.max(0, 1 - far2 - error));
        const zhi = Math.sqrt(Math.max(0, 1 - near2 + error));
        const hp = a[0] * px + a[1] * py, hq = a[0] * qx + a[1] * qy;
        const padding = 1e-8 + 128 * EPS * Math.max(1, Math.abs(hp), Math.abs(hq));
        const low = Math.min(hp, hq) + Math.min(a[2] * zlo, a[2] * zhi) - padding;
        const high = Math.max(hp, hq) + Math.max(a[2] * zlo, a[2] * zhi) + padding;
        if (high < -1 || low > 1) continue;
        const first = bin(low), last = bin(high);
        refs += last - first + 1;
        // Bound chart memory; parent can use its generic fallback for pathological
        // long crossing edges instead of retaining millions of duplicate refs.
        if (refs > 2000000) return () => null;
        for (let i = first; i <= last; i++) bins[i].push(edge);
      }
      return h => {
        if (!Number.isFinite(h) || Math.abs(h) > 1) return null;
        const radial = Math.sqrt(Math.max(0, (1 - h) * (1 + h))), radius = r * radial;
        if (!(radius > 0)) return null;
        const c = [center[0] + r * h * a[0], center[1] + r * h * a[1]];
        const eu = [radius * u[0], radius * u[1]], ev = [radius * v[0], radius * v[1]];
        const z0 = h * a[2], zc = radial * u[2], zs = radial * v[2], amplitude = Math.hypot(zc, zs);
        const cuts = [0, 1];
        if (amplitude > 0 && Math.abs(z0) <= amplitude) {
          const phase = Math.atan2(zs, zc), alpha = Math.acos(Math.max(-1, Math.min(1, -z0 / amplitude)));
          for (const angle of [phase - alpha, phase + alpha]) {
            const t = angle / TAU;
            cuts.push(t - Math.floor(t));
          }
        }
        // The height index contains only front-lift intersections. Explicit
        // silhouette cuts prevent an uncut back arc from becoming visible.
        return clipEllipse(c, eu, ev, bins[bin(h)], cuts,
          t => z0 + zc * Math.cos(TAU * t) + zs * Math.sin(TAU * t) >= 0);
      };
    },
    clipLine(a, b) {
      if (!valid(a) || !valid(b)) return [];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (dx === 0 && dy === 0) return contains(a[0], a[1]) ? [[0, 1]] : [];
      const cuts = [0, 1], lb = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      if (!overlaps(root.bounds, lb)) return [];
      visit(root, lb, e => {
        const ex = e.dx, ey = e.dy, px = e.p[0] - a[0], py = e.p[1] - a[1];
        const det = dx * ey - dy * ex;
        if (det !== 0) {
          const t = (px * ey - py * ex) / det, s = (px * dy - py * dx) / det;
          if (t >= 0 && t <= 1 && s >= 0 && s <= 1) cuts.push(t);
        } else if (px * dy - py * dx === 0) {
          // Both overlap endpoints are cuts; midpoint classification handles
          // coincident segments without parity toggles or invented bridges.
          const axis = Math.abs(dx) >= Math.abs(dy) ? 0 : 1, delta = axis === 0 ? dx : dy;
          cuts.push(Math.max(0, Math.min(1, (e.p[axis] - a[axis]) / delta)), Math.max(0, Math.min(1, (e.q[axis] - a[axis]) / delta)));
        }
      });
      return intervals(cuts, t => [a[0] + dx * t, a[1] + dy * t], contains);
    }
  };
}

/** Parse only local absolute M/L/Z contours. Reject open/unsupported paths
 * instead of silently closing them or losing a hole. Empty paths are empty.
 */
export function regionFromPath(path: string): SurfaceRegion {
  const token = /[MLZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  const tokens: string[] = []; let end = 0;
  for (const match of path.matchAll(token)) {
    if (!/^[\s,]*$/.test(path.slice(end, match.index))) throw new Error('Unsupported region path');
    tokens.push(match[0]); end = match.index! + match[0].length;
  }
  if (!/^[\s,]*$/.test(path.slice(end))) throw new Error('Unsupported region path');
  const edges: { p: Vector; q: Vector }[] = [];
  let first: Vector | null = null, prev: Vector | null = null, command = '', i = 0;
  while (i < tokens.length) {
    if (/^[MLZ]$/.test(tokens[i])) command = tokens[i++];
    if (command === 'Z') {
      if (!first || !prev) throw new Error('Unmatched region close');
      edges.push({ p: prev, q: first }); first = prev = null; command = ''; continue;
    }
    if ((command !== 'M' && command !== 'L') || i + 1 >= tokens.length || /^[MLZ]$/.test(tokens[i]) || /^[MLZ]$/.test(tokens[i + 1])) throw new Error('Malformed region path');
    const p = [Number(tokens[i++]), Number(tokens[i++])];
    if (!valid(p)) throw new Error('Non-finite region path');
    if (command === 'M') {
      if (prev) throw new Error('Open region contour');
      first = prev = p; command = 'L';
    } else {
      if (!prev) throw new Error('Missing region move');
      edges.push({ p: prev, q: p }); prev = p;
    }
  }
  if (prev) throw new Error('Open region contour');
  return createRegion(edges);
}
