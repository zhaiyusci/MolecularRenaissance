/** Fast orthographic painter: intentional center-z sphere ordering, not CSG.
 * Caller guards directional light / no cast shadows. No renderer dependency,
 * scene-wide visibility, sphere-pair certification, or boundary construction.
 * Bond/atom ownership is LOCAL sampled vector geometry; sub-grid islands can
 * disappear and contours approximate curved crossings between discovered edges.
 */
import type { Molecule, Primitive, Vector, Illumination, Project } from './types.js';
import type { NormalizedOptions } from './options.js';
import { prepareScene, depthAt } from './scene.js';
import { add, mul, cross, norm, dot, escapeXml as esc } from './math.js';
import { elementColor } from './palette.js';
import { createCurveRenderer } from './strokes.js';
import { projectedCircle, projectedLine, trigSpans, intersectSpans } from './hatch-curves.js';
import { sampledTonePaths } from './halftone.js';
import { buildDots } from './dots.js';
import { hatchCoverage } from './coverage.js';

type Bounds = [number, number, number, number];

/** Already-normalized options; the public renderer owns eligibility/dispatch. */
export function renderFastPainter(molecule: Molecule, o: NormalizedOptions): string {
  const { spheres, cylinders, project, scale, lightDirection, unshadowedIllumination } = prepareScene(molecule, o);
  const illumination: Illumination = o.shadingBrightness === 0 ? unshadowedIllumination :
    (n, p) => Math.max(-1, Math.min(1, unshadowedIllumination(n, p) + 2 * o.shadingBrightness));
  const threshold = (limit: number) => 1 - 2 * Math.pow((1 - limit) / 2, 1 / (o.shadingContrast / 1.2)) - 2 * o.shadingBrightness;
  const fillFor = (element?: string) => o.colorWash ? elementColor(element, o.washStrength, o.colorSaturation, o.colorScheme) : '#ffffff';
  // Geometry, styles AND title enter the namespace, including texture-only edits.
  let hash1 = 2166136261, hash2 = 5381;
  for (const ch of JSON.stringify([molecule, o])) {
    const n = ch.charCodeAt(0); hash1 = Math.imul(hash1 ^ n, 16777619); hash2 = Math.imul(hash2, 33) ^ n;
  }
  const prefix = 'fast-painter-' + (hash1 >>> 0).toString(16) + '-' + (hash2 >>> 0).toString(16);
  const definitions: string[] = [], layers: string[] = [], paths: string[] = [];
  const counts = { templates: 0, hatchCurves: 0, hatchPaths: 0, labels: 0, masks: 0, maskTiles: 0,
    visibleBonds: 0, emptyBonds: 0, containedBonds: 0, maskSamples: 0, atomDepthTests: 0, candidatePairs: 0 };
  const localProject: Project = p => [p[0] * scale, -p[1] * scale];
  const neverVisible = () => { throw new Error('Fast painter must not query global visibility'); };
  const curve = createCurveRenderer({ options: o, project: localProject, illumination, paths, visible: neverVisible });
  const density = o.density * scale / 60, templates = new Map<number, string>();
  const coverage = hatchCoverage(scale, o);
  const engraving = (body: string) => `<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;

  // Reuse the standard texture engine with exactly ONE primitive. It cannot
  // perform sphere/sphere or bond/atom visibility here. Visibility is the outer
  // local clip. Global cell coordinates preserve nonrepeating stipple seeds.
  function dots(s: Primitive, projection: Project, namespace: string): string {
    if (o.shadingMode === 'hatch' || o.dotSize === 0) return '';
    const center = s.kind === 'sphere' ? projection(s.c) : null;
    const regions = center ? { query: (x: number, y: number) => {
      const clearance = s.r * scale - Math.hypot(x - center[0], y - center[1]);
      return clearance >= 0 ? { id: 0, clearance } : null;
    } } : null;
    const a = projection(s.kind === 'sphere' ? s.c : s.a);
    const b = s.kind === 'sphere' ? a : projection(add(s.a, mul(s.u, s.length)));
    const r = s.r * scale, left = Math.min(a[0], b[0]) - r, top = Math.min(a[1], b[1]) - r;
    const right = Math.max(a[0], b[0]) + r, bottom = Math.max(a[1], b[1]) + r;
    // A full support rectangle selects analytic directional tones. buildDots
    // additionally clips against its EXACT projected single-primitive silhouette;
    // coordinate-pair bounds extraction there must not receive SVG arc operands.
    const support = `M${left} ${top}L${right} ${top}L${right} ${bottom}L${left} ${bottom}Z`;
    const result = buildDots([s], depthAt, projection, scale, illumination,
      o, regions, coverage,
      { compactStipple: true, paths: [support], light: lightDirection,
        illumination: (_source, n, p) => illumination(n, p) });
    // buildDots owns content-derived pattern IDs, but namespacing also separates
    // otherwise equal local geometry under different fast-painter options.
    return result.replace(/mp-screen-[\w-]+/g, id => namespace + '-' + id);
  }

  function sphereTemplate(radius: number): string {
    const cached = templates.get(radius); if (cached !== undefined) return cached;
    paths.length = 0;
    function hatch(axis: Vector, count: number, secondary: boolean): void {
      axis = norm(axis);
      const e = norm(cross(axis, [1, 0, 0])), f = cross(axis, e);
      for (let j = 1; j < count; j++) {
        counts.hatchCurves++;
        const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h), limit = secondary ? .12 : (j % 2 === 0 ? .88 : .58);
        const center = mul(axis, h * radius), u = mul(e, r * radius), v = mul(f, r * radius);
        const geometry = projectedCircle(localProject, center, u, v);
        const front = trigSpans(-axis[2] * h, -r * e[2], -r * f[2], 1e-12);
        const tonal = trigSpans(h * dot(axis, lightDirection), r * dot(e, lightDirection), r * dot(f, lightDirection), threshold(limit));
        const spans = intersectSpans(front, tonal);
        curve(t => {
          const a = t * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
          const n = axis.map((v, k) => v * h + (e[k] * cos + f[k] * sin) * r);
          return { p: mul(n, radius), n };
        }, Math.max(120, Math.ceil(2 * Math.PI * radius * scale * r / .7)), o.hatchWidth * (secondary ? .63 : .8),
        (n, _p, lit) => n[2] >= -1e-12 && lit < limit, true, true, () => front, { geometry, spans, illumination });
      }
    }
    if (o.shadingMode === 'hatch' && o.hatchWidth > 0) {
      hatch([.12, 1, .40], Math.max(2, Math.round(density * radius / .48)), false);
      if (o.crossHatch) hatch([1, .22, -.32], Math.max(2, Math.round(density * .8 * radius / .48)), true);
    }
    counts.hatchPaths += paths.length;
    const id = `${prefix}-texture-${counts.templates++}`;
    definitions.push(`<g id="${id}">${engraving(paths.join(''))}</g>`);
    templates.set(radius, id); return id;
  }

  for (const { s, id } of spheres.map((s, id) => ({ s, id })).sort((a, b) => a.s.c[2] - b.s.c[2] || a.id - b.id)) {
    const [x, y] = project(s.c), radius = s.r * scale, fill = fillFor(s.element);
    const circle = `cx="${x}" cy="${y}" r="${radius}"`, template = o.shadingMode==='hatch'?sphereTemplate(s.r):null, clipId = `${prefix}-atom-${id}`;
    definitions.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><circle ${circle}/></clipPath>`);
    const texture = `<g clip-path="url(#${clipId})">${template?`<use href="#${template}" transform="translate(${x} ${y})"/>`:''}${dots(s, project, clipId)}</g>`;
    const outline = o.outlineWidth > 0 ? `<circle data-role="outline" ${circle} fill="none" stroke="#161616" stroke-width="${o.outlineWidth * 1.4}"/>` : '';
    const showLabel = o.labels && (o.labelHydrogens || s.element !== 'H');
    const label = showLabel ? `<text data-role="element-label" data-surface-id="${id}" x="${x.toFixed(2)}" y="${(y + o.labelSize * .3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${esc(o.labelFont)}" font-style="${o.labelItalic ? 'italic' : 'normal'}" font-weight="${o.labelBold ? '700' : '400'}" stroke="${o.labelStrokeWidth === 0 ? 'none' : (o.labelMatchFill ? fill : o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${esc(s.element)}</text>` : '';
    if (showLabel) counts.labels++;
    layers.push(`<g data-role="surface-layer" data-surface-id="${id}" data-atom-id="${id}"><circle data-role="surface-fill" ${circle} fill="${fill}" stroke="none"/>${texture}${outline}${label}</g>`);
  }

  const origin = project([0, 0, 0]), step = o.quality === 'preview' ? .5 : .25;
  const margin = Math.max(2, o.outlineWidth * 2, o.hatchWidth * 2, o.dotSize * 2);
  // Fail explicitly rather than coarsening or dropping bonds in huge scenes.
  const maskSampleBudget = 16000000;
  let discoveryBudget = 0;
  const atomBoxes = spheres.map(s => { const p = project(s.c), r = s.r * scale; return { s, b: [p[0] - r, p[1] - r, p[0] + r, p[1] + r] }; });
  const bondCurve = createCurveRenderer({ options: o, project, illumination, paths, visible: neverVisible });
  const bondOrder = cylinders.map((s, id) => ({ s, id, z: s.a[2] + s.u[2] * s.length / 2 })).sort((a, b) => a.z - b.z || a.id - b.id);
  for (const { s, id } of bondOrder) {
    counts.masks++;
    // Along a parent-centered cylinder, the entire radius-r cross section lies
    // inside its endpoint sphere for axial distance <= sqrt(R²-r²). If both
    // covered intervals meet, the WHOLE bond is inside their union, at any view.
    // This is bond/atom containment, not a sphere-pair intersection calculation.
    const endpoints=molecule.bonds[id].map(index=>spheres[index]);
    const covered=endpoints.reduce((sum,atom)=>sum+Math.sqrt(Math.max(0,atom.r*atom.r-s.r*s.r)),0);
    if(endpoints.every(atom=>atom.r>s.r)&&covered>s.length+1e-9){
      counts.containedBonds++;counts.emptyBonds++;
      layers.push(`<g data-role="bond-layer" data-surface-id="${spheres.length+id}" data-bond-id="${id}" data-mask-empty="true" data-contained="true" data-mask-samples="0"/>`);
      continue;
    }
    const a = project(s.a), b = project(add(s.a, mul(s.u, s.length)));
    // Exact AABB of the closed projected cylinder (cap radii along x/y).
    const rx = s.r * scale * Math.sqrt(Math.max(0, 1 - s.u[0] ** 2));
    const ry = s.r * scale * Math.sqrt(Math.max(0, 1 - s.u[1] ** 2));
    const box: Bounds = [Math.max(-margin, Math.min(a[0], b[0]) - rx), Math.max(-margin, Math.min(a[1], b[1]) - ry), Math.min(o.width + margin, Math.max(a[0], b[0]) + rx), Math.min(o.height + margin, Math.max(a[1], b[1]) + ry)];
    if (!box.every(Number.isFinite)) throw new Error('Fast painter bond projection exceeds finite SVG coordinates');
    const candidates = atomBoxes.filter(({ b }) => b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1]);
    counts.candidatePairs += candidates.length;
    const before = counts.maskSamples;
    function sample(x: number, y: number): number {
      if (++counts.maskSamples > maskSampleBudget) throw new Error('Fast painter bond mask sample budget exceeded; reduce scale/output size or use precise mode');
      const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale, z = depthAt(s, wx, wy);
      if (!Number.isFinite(z)) return 0;
      for (const { s: atom, b } of candidates) {
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
        counts.atomDepthTests++;
        if (depthAt(atom, wx, wy) > z + 1e-9) return 0;
      }
      return 1;
    }
    const maskPaths: string[] = [];
    // Each tile stays below sampledTonePaths' memory cap at either quality;
    // hence its discovery step NEVER silently grows with model/canvas size.
    // A one-step overlap closes tile borders safely. Separate SVG paths union
    // in clipPath (do not concatenate overlapping contours under evenodd).
    const tile = 64;
    for (let y = box[1]; y < box[3]; y += tile) for (let x = box[0]; x < box[2]; x += tile) {
      const bounds: Bounds = [Math.max(box[0], x - step), Math.max(box[1], y - step), Math.min(box[2], x + tile + step), Math.min(box[3], y + tile + step)];
      discoveryBudget += (Math.ceil((bounds[2] - bounds[0]) / step) + 3) * (Math.ceil((bounds[3] - bounds[1]) / step) + 3);
      if (discoveryBudget > maskSampleBudget) throw new Error('Fast painter bond mask grid budget exceeded; reduce scale/output size or use precise mode');
      counts.maskTiles++;
      const path = sampledTonePaths(bounds, sample, step, [.5], true)[0];
      if (path) maskPaths.push(`<path fill-rule="evenodd" clip-rule="evenodd" d="${path}"/>`);
    }
    const surfaceId = spheres.length + id, clipId = `${prefix}-bond-${id}`;
    // Direct paths in clipPath avoid SVG 1.1 use-of-group clip restrictions.
    definitions.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${maskPaths.join('')}</clipPath>`);
    if (!maskPaths.length) {
      counts.emptyBonds++;
      layers.push(`<g data-role="bond-layer" data-surface-id="${surfaceId}" data-bond-id="${id}" data-mask-empty="true" data-mask-samples="${counts.maskSamples - before}"/>`);
      continue;
    }
    counts.visibleBonds++; paths.length = 0;
    const e = norm(cross(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross(s.u, e);
    function line(n: Vector, width: number, engrave = false): void {
      const offset = mul(n, s.r), start = add(s.a, offset), end = add(start, mul(s.u, s.length));
      const geometry = projectedLine(project, start, end);
      const spans: [number, number][] = !engrave || dot(n, lightDirection) < threshold(.65) ? [[0, 1]] : [];
      bondCurve(t => ({ p: add(start, mul(s.u, t * s.length)), n }), Math.max(60, Math.ceil(s.length * scale / .7)), width,
        (_n, _p, lit) => !engrave || lit < .65, engrave, false, () => [[0, 1]], { geometry, spans, illumination, ignoreLighting: !engrave });
    }
    if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
      const edge = norm([-s.u[1], s.u[0], 0]); line(edge, o.outlineWidth * 1.1); line(mul(edge, -1), o.outlineWidth * 1.1);
    }
    const count = Math.max(3, Math.round(density * .8 * s.r / .115));
    for (let j = 0; o.shadingMode === 'hatch' && o.hatchWidth > 0 && j < count; j++) {
      const a = j / count * 2 * Math.PI, n = add(mul(e, Math.cos(a)), mul(f, Math.sin(a)));
      if (n[2] > 0) line(n, o.hatchWidth * .68, true);
    }
    const fill = `<g data-role="surface-fill" fill="#ffffff" stroke="none">${maskPaths.map(path => path.replace('<path ', '<path data-role="bond-fill" ')).join('')}</g>`;
    const texture = dots(s, project, clipId);
    layers.push(`<g data-role="bond-layer" data-surface-id="${surfaceId}" data-bond-id="${id}" data-mask-empty="false" data-mask-samples="${counts.maskSamples - before}">${fill}<g clip-path="url(#${clipId})">${texture}${engraving(paths.join(''))}</g></g>`);
  }
  const stats = `data-render-mode="fast" data-sphere-count="${spheres.length}" data-bond-count="${cylinders.length}" data-bond-mask-count="${counts.masks}" data-bond-visible-count="${counts.visibleBonds}" data-bond-empty-count="${counts.emptyBonds}" data-bond-contained-count="${counts.containedBonds}" data-bond-mask-tiles="${counts.maskTiles}" data-bond-mask-samples="${counts.maskSamples}" data-bond-atom-depth-tests="${counts.atomDepthTests}" data-bond-atom-candidates="${counts.candidatePairs}" data-bond-mask-step="${step}" data-bond-mask-bisections="9" data-texture-templates="${counts.templates}" data-hatch-curves="${counts.hatchCurves}" data-hatch-paths="${counts.hatchPaths}" data-whole-labels="${counts.labels}" data-boundary-builds="0" data-sphere-pair-tests="0"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="${prefix}-title" ${stats}><title id="${prefix}-title">${esc(molecule.name || 'Molecular engraving')}</title><defs>${definitions.join('')}</defs><rect width="100%" height="100%" fill="white"/>${layers.join('')}</svg>`;
}
