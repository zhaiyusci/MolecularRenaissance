import type { Cylinder, Primitive, Project, Sphere, Vector } from './types.js';
import type { NormalizedOptions } from './options.js';
import { depthAt, type PreparedScene } from './scene.js';
import { add, mul, cross, norm, dot } from './math.js';
import { projectedCircle, projectedLine, trigSpans } from './hatch-curves.js';
import { directionalTonePath } from './surface-tones.js';
import { sampledTonePaths } from './halftone.js';
import { engravingWidth } from './strokes.js';
import { TONE_LEVELS } from './tone-levels.js';

// Fixed disjoint darkness bands; this is not exact legacy engraving.
type Bounds = [number, number, number, number];
interface Family { path: string; limit: number; width: number; }
export interface LayeredHatchingResult {
  /** Complete SVG defs element; append once outside the owner paint layers. */
  defs: string;
  bySurface: Map<Primitive, string>;
  skeletonPaths: number;
  /** Nonempty disjoint tone bands, including shadow bands. */
  toneLayers: number;
  stats: { shadowBuilds: number; shadowSamples: number };
}

function sphereFamilies(s: Sphere, project: Project, density: number, o: NormalizedOptions): Family[] {
  const paths = ['', '', ''];
  function family(inputAxis: Vector, count: number, secondary: boolean): void {
    const axis = norm(inputAxis), e = norm(cross(axis, [1, 0, 0])), f = cross(axis, e);
    for (let j = 1; j < count; j++) {
      const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h);
      const geometry = projectedCircle(project, add(s.c, mul(axis, h * s.r)), mul(e, r * s.r), mul(f, r * s.r));
      const front = trigSpans(-axis[2] * h, -r * e[2], -r * f[2], 1e-12);
      const index = secondary ? 2 : j % 2 === 0 ? 1 : 0;
      // projectedCircle.path uses normalized tangents and <= pi/4 cubic arcs.
      // Neither lighting nor occlusion is scanned or cut into this skeleton.
      for (const [a, b] of front) paths[index] += geometry.path(a, b);
    }
  }
  family([.12, 1, .40], Math.max(2, Math.round(density * s.r / .48)), false);
  if (o.crossHatch) family([1, .22, -.32], Math.max(2, Math.round(density * .8 * s.r / .48)), true);
  return paths.map((path, i) => ({ path, limit: [.58, .88, .12][i], width: o.hatchWidth * (i === 2 ? .63 : .8) })).filter(f => f.path);
}

function cylinderFamilies(s: Cylinder, prepared: PreparedScene, o: NormalizedOptions): Family[] {
  const density = o.density * prepared.scale / 60;
  const e = norm(cross(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross(s.u, e);
  const count = Math.max(3, Math.round(density * .8 * s.r / .115));
  let path = '';
  for (let j = 0; j < count; j++) {
    const angle = j / count * 2 * Math.PI, n = add(mul(e, Math.cos(angle)), mul(f, Math.sin(angle)));
    if (n[2] <= 0) continue;
    const a = add(s.a, mul(n, s.r)), b = add(a, mul(s.u, s.length));
    path += projectedLine(prepared.project, a, b).path(0, 1);
  }
  return path ? [{ path, limit: .65, width: o.hatchWidth * .68 }] : [];
}

/** Certified surface paths contain paired xy operands (M/L/C/Q, not SVG A).
 * Their control hull is conservative, unlike a sampled boundary bounding box. */
function visibleBounds(path: string, o: NormalizedOptions): Bounds | null {
  const values = (path.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || []).map(Number);
  const box: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < values.length; i += 2) {
    box[0] = Math.min(box[0], values[i]); box[2] = Math.max(box[2], values[i]);
    box[1] = Math.min(box[1], values[i + 1]); box[3] = Math.max(box[3], values[i + 1]);
  }
  box[0] = Math.max(0, box[0]); box[1] = Math.max(0, box[1]);
  box[2] = Math.min(o.width, box[2]); box[3] = Math.min(o.height, box[3]);
  return box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1] ? box : null;
}

function surfaceNormal(s: Primitive, p: Vector): Vector {
  if (s.kind === 'sphere') return p.map((v, i) => (v - s.c[i]) / s.r);
  const q = p.map((v, i) => v - s.a[i]), t = dot(q, s.u);
  if (t < 1e-7) return mul(s.u, -1);
  if (t > s.length - 1e-7) return s.u.slice();
  const radial = q.map((v, i) => v - t * s.u[i]), length = Math.hypot(...radial);
  return length ? mul(radial, 1 / length) : [0, 0, 1];
}

/** Two independent 32-bit hashes keep deterministic, document-local SVG ids.
 * Include the whole style payload (including any future title field), geometry,
 * projection, and ownership paths so differently styled exports cannot alias. */
function namespace(prepared: PreparedScene, o: NormalizedOptions, paths: readonly (string | null)[]): string {
  let a = 2166136261, b = 5381;
  function hash(text: string): void {
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619);
      b = Math.imul(b, 33) ^ text.charCodeAt(i);
    }
  }
  // The shared switch has already selected this route; hatchMode encodes it.
  // Excluding the alias preserves existing definition IDs and default exports.
  const { quantizeShading: _sharedSwitch, ...style } = o;
  hash(JSON.stringify([prepared.scene, prepared.scale, prepared.lightDirection, prepared.shadowBias, style,
    prepared.project([0, 0, 0]), prepared.project([1, 1, 1])]));
  for (const path of paths) hash(path ?? 'null');
  return `lh-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}

/**
 * Reuse fixed curved skeletons beneath analytic disjoint tone bands. Only
 * artistic darkness/width is quantized to 16 levels; the caller's certified
 * owner clip contains the FULL strokes and preserves scientific occlusion.
 * Shadow discovery matches halftone: one local binary sampled contour per
 * potentially shadowed source, never an atlas dependency or per-line ray grid.
 */
export function buildLayeredHatching(
  prepared: PreparedScene, o: NormalizedOptions, visiblePaths: readonly (string | null)[],
): LayeredHatchingResult {
  const result: LayeredHatchingResult = { defs: '', bySurface: new Map(), skeletonPaths: 0, toneLayers: 0,
    stats: { shadowBuilds: 0, shadowSamples: 0 } };
  if (o.shadingMode !== 'hatch' || o.hatchWidth <= 0 || o.shadingSize === 0) return result;
  const prefix = namespace(prepared, o, visiblePaths), definitions: string[] = [];
  const origin = prepared.project([0, 0, 0]);
  // Projection, axes, density and stroke style are fixed within this render.
  // Equal-radius spheres therefore share one origin-centered skeleton template.
  const localProject: Project = p => prepared.project(p).map((v, i) => v - origin[i]);
  const sphereTemplates = new Map<number, { families: Family[]; skeletons: string[] }>();
  function defineSkeletons(families: Family[], id: string): string[] {
    return families.map((family, index) => {
      const skeleton = `${id}-f${index}`;
      definitions.push(`<path id="${skeleton}" fill="none" d="${family.path}"/>`);
      result.skeletonPaths++;
      return skeleton;
    });
  }
  const physicalThreshold = (darkness: number): number =>
    1 - 2 * Math.pow(darkness, 1 / (o.shadingContrast / 1.2)) - 2 * o.shadingBrightness;
  const shadowThreshold = (threshold: number): number => o.shadowStrength >= 1
    ? (threshold > -1 ? Infinity : -Infinity) : (threshold + 1) / (1 - o.shadowStrength) - 1;
  function clip(id: string, path: string): string {
    definitions.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${path}"/></clipPath>`);
    return id;
  }
  for (let sourceId = 0; sourceId < prepared.scene.length; sourceId++) {
    const s = prepared.scene[sourceId], visiblePath = visiblePaths[sourceId];
    if (!visiblePath) continue;
    const id = `${prefix}-s${sourceId}`;
    let families: Family[], skeletons: string[], placement = '';
    if (s.kind === 'sphere') {
      let template = sphereTemplates.get(s.r);
      if (!template) {
        const localFamilies = sphereFamilies({ ...s, c: [0, 0, 0] }, localProject, o.density * prepared.scale / 60, o);
        template = { families: localFamilies, skeletons: defineSkeletons(localFamilies, `${prefix}-radius${sphereTemplates.size}`) };
        sphereTemplates.set(s.r, template);
      }
      families = template.families; skeletons = template.skeletons;
      const center = prepared.project(s.c);
      // Translate only the use, never its global owner/tone/gate clip groups.
      placement = ` transform="translate(${center[0]} ${center[1]})"`;
    } else {
      families = cylinderFamilies(s, prepared, o);
      skeletons = defineSkeletons(families, id);
    }
    if (!families.length) continue;
    const owner = clip(`${id}-owner`, visiblePath);
    // Reuse equal analytic paths, including empty/all-surface extremes. Gate
    // clips are computed once per family, not once per family per tone level.
    const thresholdPaths = new Map<number, string>(), pathClips = new Map<string, string>();
    function tonePath(threshold: number): string {
      // Strictly sub-range thresholds must not admit a cylinder cap at -1.
      if (threshold < -1) return '';
      const key = Math.min(1, threshold);
      if (thresholdPaths.has(key)) return thresholdPaths.get(key)!;
      const path = directionalTonePath(s, prepared.project, prepared.lightDirection, key);
      thresholdPaths.set(key, path);
      return path;
    }
    function pathClip(path: string): string | null {
      if (!path) return null;
      let name = pathClips.get(path);
      if (!name) { name = clip(`${id}-tone${pathClips.size}`, path); pathClips.set(path, name); }
      return name;
    }
    function layers(shadow: boolean): string {
      const transform = shadow ? shadowThreshold : (t: number) => t;
      const gates = families.map(f => pathClip(tonePath(transform(physicalThreshold((1 - f.limit) / 2)))));
      const groups: string[] = [];
      for (let level = 1; level <= TONE_LEVELS; level++) {
        // Nested cumulative regions XOR to a disjoint band under evenodd.
        // Paint every location once: repeated AA strokes otherwise darken ink.
        const lower = tonePath(transform(physicalThreshold((level - .5) / TONE_LEVELS)));
        const upper = level === TONE_LEVELS ? '' : tonePath(transform(physicalThreshold((level + .5) / TONE_LEVELS)));
        if (!lower || lower === upper) continue;
        const tone = pathClip(lower + upper);
        if (!tone) continue;
        const uses = families.map((family, index) => {
          const gate = gates[index];
          if (!gate) return '';
          const width = o.variableWidth ? engravingWidth(family.width, 1 - 2 * level / TONE_LEVELS) : family.width;
          const use = `<use href="#${skeletons[index]}"${placement} stroke-width="${width.toFixed(4)}"/>`;
          return gate === tone ? use : `<g clip-path="url(#${gate})">${use}</g>`;
        }).join('');
        if (!uses) continue;
        groups.push(`<g data-tone-level="${level}" clip-path="url(#${tone})">${uses}</g>`);
        result.toneLayers++;
      }
      return groups.join('');
    }
    let body = layers(false);
    if (o.castShadows && o.shadowStrength > 0 && prepared.mayShadow(s)) {
      const box = visibleBounds(visiblePath, o);
      if (box) {
        const directional = prepared.directionalShadows();
        const mask = sampledTonePaths(box, (x, y) => {
          result.stats.shadowSamples++;
          const wx = (x - origin[0]) / prepared.scale, wy = (origin[1] - y) / prepared.scale;
          const z = depthAt(s, wx, wy);
          if (!Number.isFinite(z)) return 0;
          const p = [wx, wy, z];
          return directional.shadowed(sourceId, surfaceNormal(s, p), p) ? 1 : 0;
        }, o.quality === 'preview' ? 2 : 1, [.5], true)[0];
        result.stats.shadowBuilds++;
        if (mask) {
          // Shadow and unshadowed tone bands must not paint atop one another.
          // The mask is viewport-bounded; its evenodd complement stays global.
          const viewport = `M0 0L${o.width} 0L${o.width} ${o.height}L0 ${o.height}Z`;
          const unshadowed = clip(`${id}-unshadowed`, viewport + mask);
          const shadow = clip(`${id}-shadow`, mask), overlay = layers(true);
          body = (body ? `<g clip-path="url(#${unshadowed})">${body}</g>` : '') +
            (overlay ? `<g data-hatch-shadow="true" clip-path="url(#${shadow})">${overlay}</g>` : '');
        }
      }
    }
    if (body) result.bySurface.set(s, `<g data-hatch-renderer="layered" data-tone-levels="${TONE_LEVELS}" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#${owner})">${body}</g>`);
  }
  if (definitions.length) result.defs = `<defs data-hatch-renderer="layered" data-tone-levels="${TONE_LEVELS}" data-skeleton-paths="${result.skeletonPaths}" data-tone-layers="${result.toneLayers}" data-shadow-builds="${result.stats.shadowBuilds}" data-shadow-samples="${result.stats.shadowSamples}">${definitions.join('')}</defs>`;
  return result;
}
