import type { Primitive } from './types.js';
import type { NormalizedOptions } from './options.js';
import { type PreparedScene } from './scene.js';
export interface LayeredHatchingResult {
    /** Complete SVG defs element; append once outside the owner paint layers. */
    defs: string;
    bySurface: Map<Primitive, string>;
    skeletonPaths: number;
    /** Nonempty disjoint tone bands, including shadow bands. */
    toneLayers: number;
    stats: {
        shadowBuilds: number;
        shadowSamples: number;
    };
}
/**
 * Reuse fixed curved skeletons beneath analytic disjoint tone bands. Only
 * artistic darkness/width is quantized to the selected palette; the caller's certified
 * owner clip contains the FULL strokes and preserves scientific occlusion.
 * Shadow discovery matches halftone: one local binary sampled contour per
 * potentially shadowed source, never an atlas dependency or per-line ray grid.
 */
export declare function buildLayeredHatching(prepared: PreparedScene, o: NormalizedOptions, visiblePaths: readonly (string | null)[]): LayeredHatchingResult;
