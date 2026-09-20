/** Experimental, opt-in sphere-only foreground overpaint. Not a default replacement.
 * Certification concerns geometric surfaces, not the footprint of ink or text:
 * whole labels belong to their owner's layer and can be overpainted by later owners.
 * No scene visibility queries, boundary construction, or cross-owner clipping occur
 * on the painter route. Fallback deliberately delegates unchanged input to render.
 */
import type { Molecule, RenderOptions, Sphere, Vector, Illumination } from './types.js';
import type { NormalizedOptions } from './options.js';
import { normalizeOptions } from './options.js';
import { prepareScene } from './scene.js';
import { render } from './renderer.js';
import { mul, cross, norm, dot, escapeXml as esc } from './math.js';
import { elementColor } from './palette.js';
import { createCurveRenderer } from './strokes.js';
import { projectedCircle, trigSpans, intersectSpans } from './hatch-curves.js';

/** Hard bound on this quadratic first experiment; larger scenes use normal render. */
export const PAINTER_MAX_SPHERES = 2048;
export interface PainterPlan {
  route: 'painter' | 'fallback';
  reason: string;
  /** Back-to-front original sphere/atom indices; empty on failure. */
  order: number[];
  /** [rear, front] input indices. On failure these are a partial graph only. */
  edges: [number, number][];
  failedPair?: [number, number];
  sphereCount: number;
  totalPairs: number;
  testedPairs: number;
  projectedDisjointPairs: number;
  projectedOverlapPairs: number;
  disjoint3DPairs: number;
  nestedPairs: number;
  intersectingPairs: number;
  depthSamples: number;
  edgeCount: number;
}
function emptyPlan(count: number, reason = 'certified'): PainterPlan {
  return {route: reason === 'certified' ? 'painter' : 'fallback', reason,
    order: [], edges: [], sphereCount: count, totalPairs: count*(count-1)/2,
    testedPairs: 0, projectedDisjointPairs: 0, projectedOverlapPairs: 0,
    disjoint3DPairs: 0, nestedPairs: 0, intersectingPairs: 0, depthSamples: 0, edgeCount: 0};
}

/** Pure geometry API: view coordinates, +z toward viewer, positive sphere radii.
 * No projection, molecule preprocessing, rendering, or visibility oracle is used.
 * Disconnected disks impose no precedence. All other accepted relations are
 * certified over the entire connected overlap lens, not inferred from center z.
 * Numerical/tangent ambiguity is a fallback, never an invented ordering.
 */
export function planPainterSpheres(spheres: readonly Sphere[]): PainterPlan {
  const result = emptyPlan(spheres.length);
  const fail = (reason: string, pair?: [number, number]): PainterPlan => {
    result.route = 'fallback'; result.reason = reason; result.failedPair = pair;
    result.order = []; return result;
  };
  if (spheres.length > PAINTER_MAX_SPHERES) return fail('sphere-budget-exceeded');
  if (spheres.some(s => s.kind !== 'sphere' || s.c.length !== 3 || !s.c.every(Number.isFinite) || !Number.isFinite(s.r) || s.r <= 0))
    return fail('invalid-sphere-geometry');
  const outgoing: number[][] = spheres.map(() => []), indegree = spheres.map(() => 0);
  const edge = (rear: number, front: number) => {
    result.edges.push([rear, front]); result.edgeCount++;
    outgoing[rear].push(front); indegree[front]++;
  };
  for (let i = 0; i < spheres.length; i++) for (let j = i+1; j < spheres.length; j++) {
    result.testedPairs++;
    const s = spheres[i], t = spheres[j], pair: [number, number] = [i,j];
    const raw = t.c.map((v,k) => v-s.c[k]);
    // Pair-local normalized arithmetic avoids squared world-coordinate overflow.
    const unit = Math.max(s.r,t.r,...raw.map(Math.abs));
    if (!Number.isFinite(unit)) return fail('numerical-ambiguity', pair);
    const [dx,dy,dz] = raw.map(v => v/unit), r = s.r/unit, q = t.r/unit;
    const dxy = Math.hypot(dx,dy), d = Math.hypot(dx,dy,dz), sum = r+q, diff = Math.abs(r-q);
    const coordinateMagnitude = Math.max(...s.c.map(Math.abs),...t.c.map(Math.abs),unit);
    const tol = 1e-10 + 64*Number.EPSILON*(coordinateMagnitude/unit);
    if (dxy > sum+tol) { result.projectedDisjointPairs++; continue; }
    if (dxy >= sum-tol) return fail('projected-tangency-or-roundoff', pair);
    result.projectedOverlapPairs++;
    if (d <= tol && diff <= tol) return fail('coincident-or-near-duplicate-spheres', pair);
    if (d < diff-tol) {
      // An inner solid's front is nowhere above its containing solid's front.
      result.nestedPairs++; edge(r < q ? i : j, r < q ? j : i); continue;
    }
    if (Math.abs(d-diff) <= tol || Math.abs(d-sum) <= tol)
      return fail('sphere-tangency-or-roundoff', pair);
    if (d > sum+tol) result.disjoint3DPairs++;
    else {
      result.intersectingPairs++;
      // Intersection circle: P = s.c + a*l, rho² = r²-l².
      // Its highest z is on both front hemispheres iff it is above both centers.
      // Work relative to s.c.z in normalized model units.
      const l = (d*d+(r-q)*(r+q))/(2*d), az = dz/d;
      const rho2 = r*r-l*l;
      if (rho2 <= tol || !Number.isFinite(rho2)) return fail('intersection-circle-roundoff', pair);
      const maxZ = az*l+Math.sqrt(rho2)*Math.sqrt(Math.max(0,1-az*az));
      const frontCenters = Math.max(0,dz);
      if (maxZ > frontCenters+tol) return fail('front-surfaces-swap', pair);
      if (maxZ >= frontCenters-tol) return fail('front-intersection-tangency-or-roundoff', pair);
    }
    // Interior point on the disks' centerline. Midpoint of the overlapping open
    // diameter intervals lies strictly inside both disks, including containment.
    const lo = Math.max(-r,dxy-q), hi = Math.min(r,dxy+q), along = lo+(hi-lo)/2;
    const x = dxy === 0 ? 0 : dx/dxy*along, y = dxy === 0 ? 0 : dy/dxy*along;
    const h1 = r*r-x*x-y*y, h2 = q*q-(x-dx)**2-(y-dy)**2;
    if (h1 <= tol || h2 <= tol) return fail('lens-sample-roundoff', pair);
    const delta = Math.sqrt(h1)-(dz+Math.sqrt(h2));
    result.depthSamples++;
    if (!Number.isFinite(delta) || Math.abs(delta) <= tol) return fail('depth-order-roundoff', pair);
    // Noncrossing continuous front-depth functions on a connected lens have
    // the sign of this single sample everywhere; no per-point scene tests.
    edge(delta < 0 ? i : j, delta < 0 ? j : i);
  }
  // Kahn ordering; index ties only for unconstrained nodes, never center sorting.
  const ready = indegree.flatMap((degree,index) => degree === 0 ? [index] : []);
  for (let head = 0; head < ready.length; head++) {
    const index = ready[head]; result.order.push(index);
    for (const next of outgoing[index]) if (--indegree[next] === 0) ready.push(next);
  }
  if (result.order.length !== spheres.length) return fail('precedence-cycle');
  return result;
}
function unsupported(molecule: Molecule, o: NormalizedOptions): string | null {
  if (molecule.bonds.length) return 'unsupported-bonds';
  if (o.lightType !== 'directional') return 'unsupported-light-type';
  if (o.castShadows) return 'unsupported-cast-shadows';
  if (o.shadingMode !== 'hatch') return 'unsupported-shading-mode';
  return null;
}
/** Molecule-level planning uses exactly the normal renderer's scientific transform. */
export function planPainter(molecule: Molecule, options: RenderOptions = {}): PainterPlan {
  const o = normalizeOptions(options), prepared = prepareScene(molecule,o);
  const reason = unsupported(molecule,o);
  return reason ? emptyPlan(prepared.spheres.length,reason) : planPainterSpheres(prepared.spheres);
}
export interface PainterResult extends PainterPlan {
  svg: string;
  /** Experiment counters only; null on fallback because normal render is opaque. */
  boundaryBuilds: number | null;
  sceneVisibilityTests: number | null;
  /** Actual generated curves/paths, excluding translated template reuse. */
  hatchCurves: number;
  hatchPaths: number;
  /** One local-origin hatch definition per distinct radius, within this call. */
  hatchTemplates: number;
  paintedSpheres: number;
  wholeLabels: number;
  ownSilhouetteClips: number;
}

export interface PainterExperimentOptions { reuseHatches?:boolean; }
export function renderPainter(molecule: Molecule, options: RenderOptions = {}, experiment:PainterExperimentOptions={}): PainterResult {
  const reuseHatches=experiment.reuseHatches!==false;
  const o = normalizeOptions(options), prepared = prepareScene(molecule,o);
  const reason = unsupported(molecule,o);
  const plan = reason ? emptyPlan(prepared.spheres.length,reason) : planPainterSpheres(prepared.spheres);
  const counters = {hatchCurves: 0, hatchPaths: 0, hatchTemplates: 0, paintedSpheres: 0, wholeLabels: 0, ownSilhouetteClips: 0};
  if (plan.route === 'fallback') return {...plan, ...counters, svg: render(molecule,options), boundaryBuilds: null, sceneVisibilityTests: null};
  const {spheres,project,scale,lightDirection,unshadowedIllumination} = prepared;
  const illumination: Illumination = o.shadingBrightness === 0 ? unshadowedIllumination :
    (n,p) => Math.max(-1,Math.min(1,unshadowedIllumination(n,p)+2*o.shadingBrightness));
  const threshold = (limit: number) => 1-2*Math.pow((1-limit)/2,1/(o.shadingContrast/1.2))-2*o.shadingBrightness;
  const fillFor = (s: Sphere) => o.colorWash ? elementColor(s.element,o.washStrength,o.colorSaturation,o.colorScheme) : '#ffffff';
  const paths: string[] = [], layers: string[] = [], definitions: string[] = [];
  // Inline experiments with different geometry/options must not share defs IDs.
  let hash1=2166136261,hash2=5381;
  for(const ch of JSON.stringify([o,spheres,reuseHatches])){const n=ch.charCodeAt(0);hash1=Math.imul(hash1^n,16777619);hash2=Math.imul(hash2,33)^n;}
  const prefix='painter-'+(hash1>>>0).toString(16)+'-'+(hash2>>>0).toString(16);
  // Directional unshadowed hatches depend only on radius, never translation or
  // element. Cache local-origin geometry for this render only, not across frames.
  const templates = new Map<number,string>();
  const localProject = (p: readonly number[]): Vector => [p[0]*scale,-p[1]*scale];
  // A regression into sampled scene visibility is a programming error, not a
  // silent slow path. Exact own-front and tonal spans always bypass this callback.
  const curve = createCurveRenderer({options:o,project:localProject,illumination,paths,
    visible: () => { throw new Error('Painter must not query scene visibility'); }});
  const density = o.density*scale/60;
  for (const id of plan.order) {
    const s = spheres[id], [x,y] = project(s.c), radius = s.r*scale;
    const circle = `cx="${x}" cy="${y}" r="${radius}"`;
    paths.length = 0;
    function hatch(axis: Vector, count: number, secondary: boolean): void {
      axis = norm(axis);
      const e = norm(cross(axis,[1,0,0])), f = cross(axis,e);
      for (let j = 1; j < count; j++) {
        counters.hatchCurves++;
        const h = -1+2*j/count, r = Math.sqrt(1-h*h), limit = secondary ? .12 : (j%2 === 0 ? .88 : .58);
        const center = mul(axis,h*s.r), u = mul(e,r*s.r), v = mul(f,r*s.r);
        const geometry = projectedCircle(localProject,center,u,v);
        const front = trigSpans(-axis[2]*h,-r*e[2],-r*f[2],1e-12);
        const tonal = trigSpans(h*dot(axis,lightDirection),r*dot(e,lightDirection),r*dot(f,lightDirection),threshold(limit));
        const spans = intersectSpans(front,tonal);
        curve(t => {
          const a = t*Math.PI*2, cos = Math.cos(a), sin = Math.sin(a);
          const n = axis.map((v,k) => v*h+(e[k]*cos+f[k]*sin)*r);
          return {p:mul(n,s.r),n};
        },Math.max(120,Math.ceil(2*Math.PI*s.r*scale*r/.7)),o.hatchWidth*(secondary ? .63 : .8),
        (n,p,lit) => n[2] >= -1e-12 && lit < limit,true,true,() => front,{geometry,spans,illumination});
      }
    }
    let template = reuseHatches?templates.get(s.r):undefined;
    if (template === undefined) {
      if (o.hatchWidth > 0) {
        hatch([.12,1,.40],Math.max(2,Math.round(density*s.r/.48)),false);
        if (o.crossHatch) hatch([1,.22,-.32],Math.max(2,Math.round(density*.8*s.r/.48)),true);
      }
      counters.hatchPaths += paths.length;
      template = `${prefix}-hatch-template-${counters.hatchTemplates}`;
      templates.set(s.r,template); counters.hatchTemplates++;
      definitions.push(`<g id="${template}">${paths.join('')}</g>`);
    }
    // Only hatch ribbons are clipped, solely against their OWN full silhouette.
    // Neither the outline nor text is ever inside this clip group.
    const clipId = `${prefix}-own-sphere-${id}`;
    definitions.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><circle ${circle}/></clipPath>`);
    counters.ownSilhouetteClips++;
    const fill = `<circle data-role="surface-fill" ${circle} fill="${fillFor(s)}" stroke="none"/>`;
    const hatches = `<g data-role="engraving" clip-path="url(#${clipId})" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round"><use href="#${template}" transform="translate(${x} ${y})"/></g>`;
    const outline = o.outlineWidth > 0 ? `<circle data-role="outline" ${circle} fill="none" stroke="#161616" stroke-width="${o.outlineWidth*1.4}"/>` : '';
    const label = o.labels ? `<text data-role="element-label" data-surface-id="${id}" x="${x.toFixed(2)}" y="${(y+o.labelSize*.3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${esc(o.labelFont)}" font-style="${o.labelItalic?'italic':'normal'}" font-weight="${o.labelBold?'700':'400'}" stroke="${o.labelStrokeWidth===0?'none':(o.labelMatchFill?fillFor(s):o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${esc(s.element)}</text>` : '';
    if (o.labels) counters.wholeLabels++;
    counters.paintedSpheres++;
    layers.push(`<g data-role="surface-layer" data-surface-id="${id}">${fill}${hatches}${outline}${label}</g>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title" data-experimental="sphere-painter"><title id="title">${esc(molecule.name||'Molecular engraving')}</title><defs>${definitions.join('')}</defs><rect width="100%" height="100%" fill="white"/>${layers.join('')}</svg>`;
  return {...plan,...counters,svg,boundaryBuilds:0,sceneVisibilityTests:0};
}
