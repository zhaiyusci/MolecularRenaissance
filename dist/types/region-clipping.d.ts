import type { SurfaceRegion, Vector } from './types';
/** The edges must describe complete closed contours. Orientation is irrelevant.
 * Bounds are [minX,minY,maxX,maxY]; a supplied box is conservatively enlarged.
 * Boundaries belong to the region, including a line coincident with an edge.
 */
export declare function createRegion(input: readonly {
    p: Vector;
    q: Vector;
}[], bounds?: readonly number[]): SurfaceRegion;
/** Parse only local absolute M/L/Z contours. Reject open/unsupported paths
 * instead of silently closing them or losing a hole. Empty paths are empty.
 */
export declare function regionFromPath(path: string): SurfaceRegion;
