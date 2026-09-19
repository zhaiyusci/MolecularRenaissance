import type { Scene, Vector, DepthAt, Project, ElementColor } from './types';
export interface WashOptions {
    fitCurves?: boolean;
}
type Curves = Vector[][];
/**
 * buildWash(scene, depthAt, project, scale, colorForElement, options?) -> SVG <g>.
 * options.fitCurves=false skips Bezier fitting for interactive preview.
 * scene is an array of spheres / cylinders in view coordinates; larger z is
 * nearer. project must be [ox + scale*x, oy - scale*y], with positive scale.
 * depthAt(shape, worldX, worldY) returns front z, or -Infinity outside.
 * Cylinders and white/null colors occlude but produce no fill. Exact depth
 * ties favor an uncolored surface; otherwise the earlier scene item wins.
 *
 * A 1 SVG-unit ownership grid supplies topology, NOT staircase geometry.
 * Dual-edge surface queries bisect crossings to 0.0001 SVG units; boundary
 * samples are adaptively refined and least-squares fitted to cubic Beziers
 * (0.012 fit tolerance, 0.003 sampling tolerance). Shared color interfaces
 * reuse identical curves in reverse, with shared refined three-way junctions.
 * Output is one evenodd path per normalized color using M/L/C/Z commands;
 * coordinates are rounded to 0.001 SVG units. No image, filter or dependency.
 *
 * Topology remains sampled: sub-cell islands, holes or multiple junctions
 * can be missed; this is not an analytic error guarantee for arbitrary depth
 * callbacks. Huge extents coarsen the grid to stay below 4M cells. Mask work
 * is bounded by clipped shape boxes; refinement checks candidate shapes at
 * boundary points. Memory is O(grid cells + boundary samples).
 */
export declare function buildWash(scene: Scene, depthAt: DepthAt, project: Project, scale: number, colorForElement: ElementColor, options?: WashOptions): string;
export declare function fitContour(input: Vector[], tolerance: number): Curves;
export {};
