/* Closed visible-surface regions from MolBoundaries' already labelled arrangement.
 * No visibility/depth tests, colour merging, or invented closing edges.
 */
import type { Scene, Vector, Project, DotRegions } from './types';

/** Minimal projected geometry accepted from the labelled arrangement builder. */
export interface ProjectedCurve {
  at(t: number): Vector;
  line?: boolean;
  C?: Vector;
  U?: Vector;
  V?: Vector;
  radius?: number;
}
export interface RegionSegment {
  c: ProjectedCurve;
  a: number;
  b: number;
  start: number;
  end: number;
  left: number;
  right: number;
}
interface Edge { p: Vector; q: Vector; bounds: Vector; }
interface DirectedEdge { start: number; end: number; poly: Edge[]; reverse: boolean; used: boolean; }
interface OwnerIndex { id: number; bounds: Vector; rows: (Edge[] | undefined)[]; rowScale: number; }
interface OwnerBuild {
  id: number; bounds: Vector;
  starts: Map<number, DirectedEdge>; ins: Map<number, DirectedEdge>;
  directed: DirectedEdge[]; edges: Edge[];
  rows?: (Edge[] | undefined)[]; rowScale?: number;
}
var TOL = .0015, SNAP = .00003, ROUND = .002;
var MAX_EDGES = 250000, MAX_REFS = 2000000;
function finite(x: unknown): x is number { return typeof x === 'number' && Number.isFinite(x); }
function point(p: Vector | undefined): p is Vector;
function point(p: Vector | undefined) { return p && finite(p[0]) && finite(p[1]); }
function box() { return [Infinity, Infinity, -Infinity, -Infinity]; }
function include(b: Vector, p: Vector) {
  b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]);
  b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]);
}
function insideBox(b: Vector, x: number, y: number) { return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]; }
function distance2(e: Edge, x: number, y: number) {
  var dx = e.q[0] - e.p[0], dy = e.q[1] - e.p[1];
  var t = Math.max(0, Math.min(1, ((x - e.p[0]) * dx + (y - e.p[1]) * dy) / (dx * dx + dy * dy)));
  var a = x - e.p[0] - t * dx, b = y - e.p[1] - t * dy;
  return a * a + b * b;
}
// Bounded rectangular grid. A long edge is registered in every cell touched
// by its box (not just its endpoints), making radius searches conservative.
function grid(bounds: Vector, count: number) {
  var n = Math.max(1, Math.min(128, Math.ceil(Math.sqrt(count / 4))));
  var w = bounds[2] - bounds[0], h = bounds[3] - bounds[1];
  var nx = Math.max(1, Math.min(128, Math.ceil(n * Math.sqrt(w / h))));
  var ny = Math.max(1, Math.min(128, Math.ceil(n * Math.sqrt(h / w))));
  var cells = new Array<number[] | undefined>(nx * ny), refs = 0;
  function ix(x: number) { return Math.max(0, Math.min(nx - 1, Math.floor((x - bounds[0]) / w * nx))); }
  function iy(y: number) { return Math.max(0, Math.min(ny - 1, Math.floor((y - bounds[1]) / h * ny))); }
  return {
    ix: ix, iy: iy, nx: nx, cells: cells,
    add: function (b: Vector, id: number) {
      var x0 = ix(b[0]), x1 = ix(b[2]), y0 = iy(b[1]), y1 = iy(b[3]);
      refs += (x1 - x0 + 1) * (y1 - y0 + 1);
      if (refs > MAX_REFS) return false;
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        var k = y * nx + x;
        if (!cells[k]) cells[k] = [];
        cells[k]!.push(id);
      }
      return true;
    }
  };
}
export function create(scene: Scene, segments: readonly RegionSegment[], nodes: readonly Vector[], project: Project, scale: number): DotRegions | null {
  // project/scale belong to the shared builder's API; geometry is already SVG.
  if (!Array.isArray(scene) || !Array.isArray(segments) || !nodes || !(scale > 0) || !finite(scale)) return null;
  try { return build(scene, segments, nodes); } catch (_) { return null; }
}
function build(scene: Scene, segments: readonly RegionSegment[], nodes: readonly Vector[]): DotRegions | null {
  if (scene.length > 10000 || segments.length > MAX_EDGES) return null;
  var owners: OwnerBuild[] = scene.map(function (_, id) { return { id: id, starts: new Map(), ins: new Map(), directed: [], edges: [], bounds: box() }; });
  var edges: Edge[] = [], bounds = box(), error = TOL + SNAP + ROUND;
  function label(id: number) { return Number.isInteger(id) && id >= -1 && id < scene.length; }
  function attach(id: number, start: number, end: number, poly: Edge[], reverse: boolean) {
    if (id === -1) return true;
    var o = owners[id];
    if (o.starts.has(start) || o.ins.has(end)) return false;
    var e = { start: start, end: end, poly: poly, reverse: reverse, used: false };
    o.starts.set(start, e); o.ins.set(end, e); o.directed.push(e);
    return true;
  }
  for (var si = 0; si < segments.length; si++) {
    var s = segments[si];
    if (!s || !label(s.left) || !label(s.right)) return null;
    if (s.left === s.right) continue; // includes invisible cuts, not colour equality
    var c = s.c, p = nodes[s.start], q = nodes[s.end];
    if (!c || typeof c.at !== 'function' || !point(p) || !point(q) || !finite(s.a) || !finite(s.b) || s.a === s.b) return null;
    var pa = c.at(s.a), pb = c.at(s.b);
    if (!point(pa) || !point(pb) || Math.hypot(p[0] - pa[0], p[1] - pa[1]) > SNAP || Math.hypot(q[0] - pb[0], q[1] - pb[1]) > SNAP) return null;
    var steps = 1;
    if (!c.line) {
      if (!point(c.U) || !point(c.V) || !point(c.C) || !(c.radius! > 0) || !finite(c.radius)) return null;
      // Largest singular value of [U V] also covers nonorthogonal ellipse
      // bases; never blindly trust a radius smaller than this analytic bound.
      var uu = c.U[0] * c.U[0] + c.U[1] * c.U[1], vv = c.V[0] * c.V[0] + c.V[1] * c.V[1];
      var uv = c.U[0] * c.V[0] + c.U[1] * c.V[1];
      var radius = Math.max(c.radius, Math.sqrt((uu + vv + Math.hypot(uu - vv, 2 * uv)) / 2));
      if (!finite(radius)) return null;
      steps = Math.max(1, Math.ceil(Math.abs(s.b - s.a) / Math.min(Math.PI / 4, Math.sqrt(8 * TOL / radius))));
    }
    if (!finite(steps) || edges.length + steps > MAX_EDGES) return null;
    var poly: Edge[] = [], prev = [p[0], p[1]];
    for (var j = 1; j <= steps; j++) {
      var next = j === steps ? [q[0], q[1]] : c.at(s.a + (s.b - s.a) * j / steps);
      if (!point(next)) return null;
      next = [next[0], next[1]];
      if (next[0] === prev[0] && next[1] === prev[1]) return null;
      var eb = [Math.min(prev[0], next[0]), Math.min(prev[1], next[1]), Math.max(prev[0], next[0]), Math.max(prev[1], next[1])];
      var edge = { p: prev, q: next, bounds: eb };
      poly.push(edge); edges.push(edge); include(bounds, prev); include(bounds, next); prev = next;
    }
    if (!attach(s.left, s.start, s.end, poly, false) || !attach(s.right, s.end, s.start, poly, true)) return null;
  }
  var active: OwnerIndex[] = [], totalRowRefs = 0;
  for (var oi = 0; oi < owners.length; oi++) {
    var o = owners[oi];
    if (!o.directed.length) continue; // valid fully occluded source, even white
    if (o.starts.size !== o.ins.size) return null;
    for (var v of o.starts.keys()) if (!o.ins.has(v)) return null;
    // Explicitly walk each oriented component. Never repair a missing link.
    for (var first of o.directed) {
      if (first.used) continue;
      var current: DirectedEdge | undefined = first, count = 0;
      do {
        if (!current || current.used || ++count > o.directed.length) return null;
        current.used = true;
        for (var pe of current.poly) { o.edges.push(pe); include(o.bounds, pe.p); include(o.bounds, pe.q); }
        current = o.starts.get(current.end);
      } while (current !== first);
    }
    if (!(o.bounds[2] > o.bounds[0]) || !(o.bounds[3] > o.bounds[1])) return null;
    var rows = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(o.edges.length))));
    o.rows = new Array(rows); o.rowScale = rows / (o.bounds[3] - o.bounds[1]);
    for (var e of o.edges) {
      var lo = Math.max(0, Math.min(rows - 1, Math.floor((e.bounds[1] - o.bounds[1]) * o.rowScale)));
      var hi = Math.max(0, Math.min(rows - 1, Math.floor((e.bounds[3] - o.bounds[1]) * o.rowScale)));
      totalRowRefs += hi - lo + 1;
      if (totalRowRefs > MAX_REFS) return null;
      for (var ri = lo; ri <= hi; ri++) { if (!o.rows[ri]) o.rows[ri] = []; o.rows[ri]!.push(e); }
    }
    // Only row index + bbox survives construction; graph traversal is not
    // repeated by query, and loops/holes use the same evenodd rule.
    // The build-only fields are discarded after the index has been populated.
    delete (o as Partial<OwnerBuild>).starts; delete (o as Partial<OwnerBuild>).ins;
    delete (o as Partial<OwnerBuild>).directed; delete (o as Partial<OwnerBuild>).edges;
    active.push(o as OwnerIndex);
  }
  if (!active.length) return { query: function () { return null; } };
  if (!(bounds[2] > bounds[0]) || !(bounds[3] > bounds[1])) return null;
  error += 128 * Number.EPSILON * Math.max(1, Math.abs(bounds[0]), Math.abs(bounds[1]), Math.abs(bounds[2]), Math.abs(bounds[3]));
  var ownerGrid = grid(bounds, active.length * 16), edgeGrid = grid(bounds, edges.length);
  for (var ai = 0; ai < active.length; ai++) if (!ownerGrid.add(active[ai].bounds, ai)) return null;
  for (var ei = 0; ei < edges.length; ei++) if (!edgeGrid.add(edges[ei].bounds, ei)) return null;
  var seen = new Uint32Array(edges.length), stamp = 0;
  function contains(o: OwnerIndex, x: number, y: number) {
    if (!insideBox(o.bounds, x, y)) return false;
    var row = Math.max(0, Math.min(o.rows.length - 1, Math.floor((y - o.bounds[1]) * o.rowScale)));
    var list = o.rows[row] || [], yes = false;
    for (var i = 0; i < list.length; i++) {
      var p = list[i].p, q = list[i].q;
      if ((p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])) yes = !yes;
    }
    return yes;
  }
  return { query: function (x, y, maxRadius) {
    if (!finite(x) || !finite(y) || !finite(maxRadius) || !(maxRadius > 0) || !insideBox(bounds, x, y)) return null;
    var candidates = ownerGrid.cells[ownerGrid.iy(y) * ownerGrid.nx + ownerGrid.ix(x)] || [], owner = -1;
    for (var i = 0; i < candidates.length; i++) {
      var o = active[candidates[i]];
      if (contains(o, x, y)) { if (owner !== -1) return null; owner = o.id; }
    }
    if (owner === -1) return null;
    // Other owners' edges count too: slightly conservative near disconnected
    // islands but avoids any local ownership assumption in the distance test.
    var radius = maxRadius + error, best = radius * radius;
    if (!finite(best)) return null;
    var x0 = edgeGrid.ix(x - radius), x1 = edgeGrid.ix(x + radius);
    var y0 = edgeGrid.iy(y - radius), y1 = edgeGrid.iy(y + radius);
    stamp = (stamp + 1) >>> 0;
    if (stamp === 0) { seen.fill(0); stamp = 1; }
    for (var iy = y0; iy <= y1; iy++) for (var ix = x0; ix <= x1; ix++) {
      var list = edgeGrid.cells[iy * edgeGrid.nx + ix];
      if (!list) continue;
      for (var k = 0; k < list.length; k++) {
        var id = list[k];
        if (seen[id] === stamp) continue;
        seen[id] = stamp;
        var e = edges[id], b = e.bounds;
        var dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3]);
        if (dx * dx + dy * dy >= best) continue;
        best = Math.min(best, distance2(e, x, y));
        if (best <= error * error) return null;
      }
    }
    var clearance = Math.min(maxRadius, Math.sqrt(best) - error);
    return clearance > 0 ? { id: owner, clearance: clearance } : null;
  } };
}
