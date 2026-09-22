import type { Vector, Project, Intervals, SurfaceRegion } from './types.js';
/** Intervals in normalized circle parameter where k+a*cos+b*sin < limit. */
export declare function trigSpans(k: number, a: number, b: number, limit: number): Intervals;
export declare function intersectSpans(a: Intervals, b: Intervals): Intervals;
export declare function unionSpans(...sets: Intervals[]): Intervals;
export declare function complementSpans(spans: Intervals): Intervals;
export interface ProjectedCurve {
    clip(region: SurfaceRegion): Intervals | null;
    point(t: number): Vector;
    tangent(t: number): Vector;
    path(a: number, b: number): string;
}
/** A projected circle stays an ellipse; do not sample and refit its centerline. */
export declare function projectedCircle(project: Project, center: Vector, u: Vector, v: Vector): ProjectedCurve & {
    pointFromTrig(cos: number, sin: number): Vector;
};
export declare function projectedLine(project: Project, a: Vector, b: Vector): ProjectedCurve;
