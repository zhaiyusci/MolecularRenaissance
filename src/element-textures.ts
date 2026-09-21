/** Camera-fixed categorical ink, independent of all illumination and physical units. */
import { escapeXml as esc } from './math.js';
import type { Scene, Project, DepthAt, RenderQuality } from './types.js';
import { sampledTonePaths } from './halftone.js';
import { approvedElementRecipe } from './element-texture-recipes.js';

// Atomic-number order is explicit: never depend on palette/radius object ordering.
const symbols = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm'.split(' ');
function checkElement(element: string): void {
  if (typeof element !== 'string' || !/^[A-Za-z]+$/.test(element)) throw new Error('Invalid element texture symbol: expected ASCII letters');
}
function hash(text: string): string {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { const n = text.charCodeAt(i); a = Math.imul(a ^ n, 16777619); b = Math.imul(b, 33) ^ n; }
  return (a >>> 0).toString(16) + '-' + (b >>> 0).toString(16);
}
function recipeIndex(element: string): number {
  const known = symbols.indexOf(element);
  if (known >= 0) return known;
  let value = 0;
  for (let i = 0; i < element.length; i++) value = (Math.imul(value, 31) + element.charCodeAt(i)) >>> 0;
  // Unknown ASCII labels have a deterministic, LIMITED 120-recipe fallback.
  // They can collide with one another or with known recipes; no uniqueness claim.
  return value % 120;
}
/** Stable recipe key: 19 reviewed common-element patterns, distinct recipes for H–Cm.
 * Unknown ASCII symbols use a bounded hashed fallback, not a carbon default. */
export function elementTexturePattern(element: string): string {
  checkElement(element);
  const approved = approvedElementRecipe(element);
  if (approved) return approved.key;
  const n = recipeIndex(element);
  return `${symbols.includes(element) ? 'atomic' : 'fallback'}-${Math.floor(n / 30)}-${Math.floor(n / 5) % 6}-${n % 5}`;
}
/** A pure-vector SVG pattern definition. IDs must be safe XML/CSS identifiers.
 * patternUnits and all mark dimensions are SVG screen units; scale is NOT molecular scale. */
export function elementTextureDefinition(element: string, id: string, scale = 1): string {
  const key = elementTexturePattern(element);
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) throw new Error('Invalid element texture pattern id');
  if (!Number.isFinite(scale) || scale < .5 || scale > 3) throw new Error('Invalid elementTextureScale: expected a finite number between 0.5 and 3');
  const approved = approvedElementRecipe(element);
  let pitch = approved?.width ?? 8, height = approved?.height ?? 8, angle = approved?.angle ?? 0, body = approved?.body ?? '';
  const line = (y: number, dash = '') => `<path d="M0 ${y}H${pitch}" fill="none" stroke="#161616" stroke-width="0.55"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  if (!approved) {
    const n = recipeIndex(element), family = Math.floor(n / 30), variant = n % 5;
    angle = (Math.floor(n / 5) % 6) * 15;
    pitch = height = 7 + variant * .7;
    const mid = pitch / 2, dash = `${variant + 1} 2`;
    body = line(1, dash);
    if (family === 0) body += `<circle cx="${mid}" cy="${mid}" r="0.8" fill="#161616"/>`;
    else if (family === 1) body += `<circle cx="${mid}" cy="${mid}" r="1.2" fill="none" stroke="#161616" stroke-width="0.55"/>`;
    else if (family === 2) body += line(mid) + line(mid + 1.4, dash);
    else body += `<path d="M${mid} ${mid - 1.3}l1.3 1.3-1.3 1.3-1.3-1.3Z" fill="none" stroke="#161616" stroke-width="0.55"/>`;
  }
  return `<pattern id="${id}" data-role="element-pattern" data-element="${esc(element)}" data-pattern="${key}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0" width="${pitch}" height="${height}" overflow="hidden" patternTransform="scale(${scale}) rotate(${angle})"><g stroke="none">${body}</g></pattern>`;
}
/** Standalone fixed-scale legend swatch using exactly the renderer's recipe. */
export function elementTextureSwatch(element: string): string {
  checkElement(element);
  const id = 'mp-element-swatch-' + element;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="${esc(element)}"><title>${esc(element)}</title><defs>${elementTextureDefinition(element, id)}</defs><rect width="24" height="24" fill="white"/><rect data-role="element-texture" data-element="${esc(element)}" width="24" height="24" fill="url(#${id})"/></svg>`;
}
/** Shared once per unique element, never once per atom. Same IDs imply identical definitions. */
export function createElementTextures(elements: readonly string[], scale: number): { definitions: string; fill: (element: string) => string } {
  const unique = [...new Set(elements)].sort();
  const prefix = 'mp-element-' + hash(JSON.stringify([unique, scale]));
  const ids = new Map(unique.map(element => { checkElement(element); return [element, `${prefix}-${element}`] as const; }));
  return {
    definitions: unique.map(element => elementTextureDefinition(element, ids.get(element)!, scale)).join(''),
    fill: element => `data-role="element-texture" data-element="${esc(element)}" fill="url(#${ids.get(element)})" stroke="none"`
  };
}

/** Bounded numerical fallback ONLY when certified visible surface paths are absent.
 * Binary depth ownership is contoured in 64-unit tiles (.25 export/.5 preview,
 * nine edge bisections). Sub-grid islands can disappear; curved intersections
 * are approximate. This is never an unoccluded circle or a lighting threshold.
 * Separate paths in clipPath UNION overlapping tiles rather than XORing them. */
export function sampledElementTextures(scene: Scene, depthAt: DepthAt, project: Project, scale: number,
  width: number, height: number, quality: RenderQuality, fills: { fill: (element: string) => string }): string {
  const step = quality === 'preview' ? .5 : .25, tile = 64;
  const sampleBudget = 16000000, depthBudget = 64000000, tileBudget = 4096;
  let grid = 0, samples = 0, tests = 0, tiles = 0;
  const origin = project([0, 0, 0]), definitions: string[] = [], layers: string[] = [];
  const prefix = 'mp-element-mask-' + hash(JSON.stringify([scene, scale, width, height, quality]));
  const boxes = scene.map(s => {
    const a = project(s.kind === 'sphere' ? s.c : s.a), b = s.kind === 'sphere' ? a : project(s.a.map((v, i) => v + s.u[i] * s.length));
    const r = s.r * scale;
    return [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r];
  });
  for (const [id, s] of scene.entries()) {
    if (s.kind !== 'sphere') continue;
    const [cx, cy] = project(s.c), r = s.r * scale;
    if (![cx, cy, r, cx-r, cy-r, cx+r, cy+r].every(Number.isFinite)) throw new Error('Element texture projection exceeds finite SVG coordinates');
    const box = [Math.max(0, cx - r), Math.max(0, cy - r), Math.min(width, cx + r), Math.min(height, cy + r)];
    const candidates = scene.map((source, index) => ({ source, index, b: boxes[index] })).filter(({ source, b }) => source !== s && b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1]);
    const sample = (x: number, y: number): number => {
      if (++samples > sampleBudget) throw new Error('Element texture fallback sample budget exceeded; reduce scale/output size or enable analytic boundaries');
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return 0;
      const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale, z = depthAt(s, wx, wy);
      if (!Number.isFinite(z)) return 0;
      for (const { source, index, b } of candidates) {
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
        if (++tests > depthBudget) throw new Error('Element texture fallback depth budget exceeded; reduce molecule size or enable analytic boundaries');
        const other = depthAt(source, wx, wy);
        if (other > z + 1e-9 || (Math.abs(other - z) <= 1e-9 && index > id)) return 0;
      }
      return 1;
    };
    const paths: string[] = [];
    for (let y = box[1]; y < box[3]; y += tile) for (let x = box[0]; x < box[2]; x += tile) {
      if (++tiles > tileBudget) throw new Error('Element texture fallback tile budget exceeded; reduce scale/output size or enable analytic boundaries');
      const bounds: [number, number, number, number] = [Math.max(box[0], x - step), Math.max(box[1], y - step), Math.min(box[2], x + tile + step), Math.min(box[3], y + tile + step)];
      grid += (Math.ceil((bounds[2] - bounds[0]) / step) + 3) * (Math.ceil((bounds[3] - bounds[1]) / step) + 3);
      if (grid > sampleBudget) throw new Error('Element texture fallback grid budget exceeded; reduce scale/output size or enable analytic boundaries');
      const path = sampledTonePaths(bounds, sample, step, [.5], true)[0];
      if (path) paths.push(`<path fill-rule="evenodd" clip-rule="evenodd" d="${path}"/>`);
    }
    if (!paths.length) continue;
    const clip = `${prefix}-${id}`;
    definitions.push(`<clipPath id="${clip}" clipPathUnits="userSpaceOnUse">${paths.join('')}</clipPath>`);
    layers.push(`<circle ${fills.fill(s.element!)} data-surface-id="${id}" cx="${cx}" cy="${cy}" r="${r}" clip-path="url(#${clip})"/>`);
  }
  return `<defs>${definitions.join('')}</defs><g data-role="element-texture-fallback" data-mask-step="${step}" data-mask-tiles="${tiles}" data-mask-samples="${samples}">${layers.join('')}</g>`;
}
