import type { buildSurfacePatterns } from './halftone.js';
import type { StippleTileSet } from './stipple-tiles.generated.js';

type Bounds = [number, number, number, number];
type Key = readonly [number, number];

const SIZE = 512;
const CELL_SIZE = 4;
const SEED = '1729';
const cachedPaths = new Map<number, readonly string[]>();
const cachedPatternContent = new Map<string, string>();

export interface SharedStippleOptions {
  emitSurface?: (id: number, svg: string) => void;
  /** Bitmap paint tiles. Without them the tile content stays vector subpaths. */
  tiles?: StippleTileSet | null;
}

function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
function keyHash(text: string): Key {
  let a = 2166136261, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b);
    b = (b << 13) | (b >>> 19);
  }
  return [mix(a), mix(b)];
}
function uniform(key: Key, k: number, stream: number): number {
  const a = mix(key[0] ^ Math.imul(k + 1, 0x9e3779b9) ^ Math.imul(stream + 1, 0x85ebca6b));
  const b = mix(key[1] ^ Math.imul(k + 1, 0xc2b2ae35) ^ Math.imul(stream + 1, 0x27d4eb2d));
  return (mix(a ^ b) + .5) / 4294967296;
}
function intensity(level: number, LEVELS: number): number {
  return -Math.log1p(-Math.min(level / LEVELS, .995)) / Math.PI;
}
/** Same independent Poisson birth groups as experiments/layered-stipple/screen.cjs.
 * Only normalized texture coordinates are rounded; scientific clips are untouched.
 * Immutable path strings are initialized once per module, never per owner/frame.
 */
function atlasPaths(LEVELS: number): readonly string[] {
  const cached = cachedPaths.get(LEVELS);
  if (cached) return cached;
  const paths: string[] = [];
  const first = Math.floor(-1 / CELL_SIZE), last = Math.floor((SIZE + 1) / CELL_SIZE);
  for (let level = 1; level <= LEVELS; level++) {
    const marks: string[] = [];
    const mu = (intensity(level, LEVELS) - intensity(level - 1, LEVELS)) * CELL_SIZE * CELL_SIZE;
    for (let j = first; j <= last; j++) for (let i = first; i <= last; i++) {
      const key = keyHash(JSON.stringify([SEED, i, j, level]));
      const u = uniform(key, 0, 0);
      let p = Math.exp(-mu), cdf = p, count = 0;
      while (u > cdf) {
        count++; p *= mu / count;
        const next = cdf + p;
        if (next === cdf) throw new Error('Shared stipple Poisson count precision exhausted');
        cdf = next;
      }
      for (let k = 0; k < count; k++) {
        const x = (i + uniform(key, k, 1)) * CELL_SIZE;
        const y = (j + uniform(key, k, 2)) * CELL_SIZE;
        if (x >= -1 && x <= SIZE + 1 && y >= -1 && y <= SIZE + 1)
          marks.push(`M${x.toFixed(3)} ${y.toFixed(3)}h0`);
      }
    }
    paths.push(marks.join(''));
  }
  cachedPaths.set(LEVELS, Object.freeze(paths));
  return paths;
}
function valid(b: Bounds): boolean {
  return b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];
}
function intersect(a: Bounds, b: Bounds): Bounds | null {
  const c: Bounds = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  return valid(c) ? c : null;
}
const xml = (s: string): string => s.replace(/[&<>"']/g, c => {
  switch (c) {
    case '&': return '&amp;'; case '<': return '&lt;'; case '>': return '&gt;';
    case '"': return '&quot;'; default: return '&apos;';
  }
});
const rect = (b: Bounds): string => `M${b[0]} ${b[1]}H${b[2]}V${b[3]}H${b[0]}Z`;

/** Conservative explicit control hull; arcs and reflected controls use fallback. */
function pathBounds(path: string, fallback: Bounds): Bounds | null {
  if (!path.trim()) return null;
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  let n = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  let loX = Infinity, loY = Infinity, hiX = -Infinity, hiY = -Infinity;
  const add = (a: number, b: number): void => {
    loX = Math.min(loX, a); loY = Math.min(loY, b);
    hiX = Math.max(hiX, a); hiY = Math.max(hiY, b);
  };
  const arities: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2 };
  while (n < tokens.length) {
    if (/^[a-z]$/i.test(tokens[n])) cmd = tokens[n++];
    const up = cmd.toUpperCase(), rel = cmd !== up;
    if (up === 'Z') { x = sx; y = sy; cmd = ''; continue; }
    const arity = arities[up];
    if (!arity || n + arity > tokens.length) return fallback;
    const a = tokens.slice(n, n + arity).map(Number); n += arity;
    if (!a.every(Number.isFinite)) return fallback;
    if (up === 'H') { x = a[0] + (rel ? x : 0); add(x, y); }
    else if (up === 'V') { y = a[0] + (rel ? y : 0); add(x, y); }
    else {
      const ox = rel ? x : 0, oy = rel ? y : 0;
      for (let k = 0; k < a.length; k += 2) add(a[k] + ox, a[k + 1] + oy);
      x = a[a.length - 2] + ox; y = a[a.length - 1] + oy;
      if (up === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    }
    if (up === 'S' || up === 'T') return fallback;
  }
  const b: Bounds = [loX, loY, hiX, hiY];
  return valid(b) ? b : null;
}

/** Render the shared selected-level atlas, using world-space contour clips.
 * `radius` is the final SVG-space dot radius.
 * Returns defs + bodies, or defs only when emitSurface is supplied. Include the
 * returned defs exactly once in the SVG containing the emitted surface bodies.
 * No callbacks run before validation finishes, so callers may safely fall back.
 * Every level's tile is anchored at one fixed user-space origin and repeats, so
 * the paint server is byte-identical for every owner and the browser rasterizes
 * each tile once instead of re-stroking the whole atlas per atom. A repeating
 * tile always covers its owner, so no atlas-size budget is needed.
 * No per-frame regeneration occurs.
 */
export function buildSharedStipple(
  data: Parameters<typeof buildSurfacePatterns>[0],
  radius: number,
  options: SharedStippleOptions = {},
): string {
  const LEVELS = data.shadingLevels ?? 16;
  const emitSurface = options.emitSurface, tiles = options.tiles ?? null;
  if (tiles && tiles.levels.length !== LEVELS) throw new Error('Stipple tile palette does not match shadingLevels');
  if (!valid(data.bounds)) return '';
  if (!(Number.isFinite(radius) && radius > 0))
    throw new Error('Shared stipple requires a positive finite SVG-space dot radius');
  const fill = tiles ? `bitmap-${tiles.px}-${tiles.markPx}` : 'vector';
  const prefix = 'mp-stipple-' + keyHash(JSON.stringify([
    SIZE, SEED, radius, fill, ...(LEVELS === 16 ? [] : [LEVELS]), data.bounds, data.pitch, data.silhouette, data.layers, data.method,
  ])).map(n => n.toString(16).padStart(8, '0')).join('');
  const defs: string[] = [], bodies: { sourceId: number; body: string }[] = [];
  const definitions = new Map<number, string>();
  const clip = (id: string, d: string): string => {
    defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" fill-rule="evenodd" d="${xml(d)}"/></clipPath>`);
    return id;
  };
  // Share a paint-server tile, not a giant stroked path replayed for every atom.
  // Bounded path batches also avoid one huge compound-stroke tessellation.
  const atlasPath = (level: number): string => {
    const existing = definitions.get(level);
    if (existing) return existing;
    const id = `${prefix}-atlas-${level}`;
    // Keyed by fill mode as well as level: one page may render both deliveries.
    const cacheKey = `${fill}:${LEVELS}:${level}`;
    let content = cachedPatternContent.get(cacheKey);
    if (content === undefined) {
      if (tiles) {
        // One 1-bit PNG per level: the browser decodes a tile once and blits it,
        // instead of stroking the whole mark set as vector geometry.
        // preserveAspectRatio="none" keeps the square tile filling the tile box.
        content = `<image x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="none" href="${tiles.levels[level - 1]}"/>`;
      } else {
        const path = atlasPaths(LEVELS)[level - 1], batches: string[] = [];
        let start = 0, count = 0;
        for (let i = 1; i <= path.length; i++) {
          if (i !== path.length && path[i] !== 'M') continue;
          if (++count === 256 || i === path.length) {
            batches.push(`<path d="${path.slice(start, i)}"/>`); start = i; count = 0;
          }
        }
        content = `<g fill="none" stroke="#161616" stroke-width="2" stroke-linecap="round">${batches.join('')}</g>`;
      }
      cachedPatternContent.set(cacheKey, content);
    }
    defs.push(`<pattern id="${id}" data-birth-level="${level}" data-tile="${tiles ? 'bitmap' : 'vector'}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" patternTransform="scale(${radius})" x="0" y="0" width="${SIZE}" height="${SIZE}" overflow="hidden">${content}</pattern>`);
    definitions.set(level, id);
    return id;
  };
  clip(prefix + '-viewport', rect(data.bounds));
  if (data.silhouette)
    defs.push(`<clipPath id="${prefix}-silhouette" clipPathUnits="userSpaceOnUse">${data.silhouette}</clipPath>`);
  for (const [index, layer] of data.layers.entries()) {
    if (!layer.clip.trim()) {
      if (layer.tones.some(p => p.trim()) || layer.shadow?.tones.some(p => p.trim()))
        throw new Error('Shared stipple requires exact owner clips; sampled-ownership geometry is unsupported');
      continue;
    }
    const owner = layer.bounds ?? data.bounds;
    if (!valid(owner)) continue;
    const visible = intersect(owner, data.bounds);
    if (!visible) continue;
    const sourceId = layer.sourceId;
    if (sourceId === undefined || !Number.isSafeInteger(sourceId) || sourceId < 0)
      throw new Error('Shared stipple requires a nonnegative integer primitive sourceId');
    const id = `${prefix}-${index}`, ownerId = clip(id + '-owner', layer.clip);
    const shadow = layer.shadow?.clip.trim() && (!layer.shadow.bounds || valid(layer.shadow.bounds)) ? layer.shadow : null;
    const shadowBounds = shadow ? intersect(visible, shadow.bounds || visible) : null;
    const binary = shadow ? clip(id + '-shadow', shadow.clip) : null;
    const base = shadow ? clip(id + '-base', rect(data.bounds) + shadow.clip) : null;
    let body = '';
    for (let level = 1; level <= LEVELS; level++) {
      const normal = layer.tones[level - 1] || '', dark = shadow?.tones[level - 1] || '';
      const nb = normal ? intersect(pathBounds(normal, visible) || [0, 0, 0, 0], visible) : null;
      const db = dark && shadowBounds ? intersect(pathBounds(dark, shadowBounds) || [0, 0, 0, 0], shadowBounds) : null;
      if (!nb && !db) continue;
      // Bound the fill to the tone's own box: the repeating tile already supplies
      // every mark, so the rect never has to span a whole tile, and a small
      // radius can no longer leave an owner uncovered.
      const paint: Bounds | null = nb && db
        ? [Math.min(nb[0], db[0]), Math.min(nb[1], db[1]), Math.max(nb[2], db[2]), Math.max(nb[3], db[3])]
        : (nb || db);
      if (!paint || !valid(paint)) continue;
      const tone = `${id}-tone-${level}`, parts: string[] = [];
      // Union the normal/shadow clips before painting a birth group exactly once.
      // Empty shadow tones mean no ink, not a constant-dark fallback.
      if (nb) parts.push(`<path clip-rule="evenodd" fill-rule="evenodd" d="${xml(normal)}"${base ? ` clip-path="url(#${base})"` : ''}/>`);
      if (db) parts.push(`<path clip-rule="evenodd" fill-rule="evenodd" d="${xml(dark)}" clip-path="url(#${binary})"/>`);
      defs.push(`<clipPath id="${tone}" clipPathUnits="userSpaceOnUse">${parts.join('')}</clipPath>`);
      body += `<g clip-path="url(#${tone})"><rect data-birth-level="${level}" x="${paint[0]}" y="${paint[1]}" width="${paint[2] - paint[0]}" height="${paint[3] - paint[1]}" fill="url(#${atlasPath(level)})" stroke="none"/></g>`;
    }
    if (!body) continue;
    body = `<g clip-path="url(#${ownerId})">${body}</g>`;
    if (data.silhouette) body = `<g clip-path="url(#${prefix}-silhouette)">${body}</g>`;
    body = `<g data-role="dots" data-mode="stipple" data-renderer="single-atlas" data-tone-method="${xml(data.method)}" data-tone-levels="${LEVELS}" fill="none" stroke="#161616" stroke-width="${2 * radius}" stroke-linecap="round"><g clip-path="url(#${prefix}-viewport)">${body}</g></g>`;
    bodies.push({ sourceId, body });
  }
  if (!bodies.length) return '';
  const definitionsSvg = `<defs>${defs.join('')}</defs>`;
  if (emitSurface) {
    for (const item of bodies) emitSurface(item.sourceId, item.body);
    return definitionsSvg;
  }
  return definitionsSvg + bodies.map(item => item.body).join('');
}
