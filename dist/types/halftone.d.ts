import type { Scene, Project } from './types.js';
type Bounds = [number, number, number, number];
/** Disk radius / lattice pitch for a desired UNION area (not summed disk area). */
export declare function halftoneRadiusRatio(coverage: number): number;
/** Exact projected union silhouette, including closed-cylinder caps. All parts
 * in this clipPath are unioned; tone sampling handles front-surface ownership. */
export declare function projectedSilhouette(scene: Scene, project: Project, scale: number): string;
/** Local numerical sampling for custom scalar fields or a BINARY shadow boundary.
 * It never allocates a full-frame ownership/lighting raster. Optional bisection
 * refines hard shadow edges independently of the coarse discovery grid. */
export declare function sampledTonePaths(bounds: Bounds, sample: (x: number, y: number) => number | null, step: number, thresholds?: number[], refine?: boolean): string[];
export interface SurfacePatternLayer {
    /** Required for per-surface emission; optional for the legacy combined output. */
    sourceId?: number;
    /** Exact visible surface, or empty for a sampled-ownership fallback. */
    clip: string;
    bounds?: Bounds;
    tones: readonly string[];
    shadow?: SurfacePatternLayer;
}
/** Paint precomputed geometric contours with a shared aligned pattern palette. */
export declare function buildSurfacePatterns(o: {
    bounds: Bounds;
    pitch: number;
    silhouette: string;
    layers: readonly SurfacePatternLayer[];
    method: string;
    shadingLevels?: number;
}, emitSurface?: (id: number, svg: string) => void): string;
export {};
