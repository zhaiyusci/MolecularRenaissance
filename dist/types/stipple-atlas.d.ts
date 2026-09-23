import type { buildSurfacePatterns } from './halftone.js';
import type { StippleTileSet } from './stipple-tiles.generated.js';
export interface SharedStippleOptions {
    emitSurface?: (id: number, svg: string) => void;
    /** Bitmap paint tiles. Without them the tile content stays vector subpaths. */
    tiles?: StippleTileSet | null;
}
/** Render the opt-in shared 16-level atlas, using world-space contour clips.
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
export declare function buildSharedStipple(data: Parameters<typeof buildSurfacePatterns>[0], radius: number, options?: SharedStippleOptions): string;
