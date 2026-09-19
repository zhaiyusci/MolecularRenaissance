import type { Scene, Vector, Project, DotRegions } from './types';
/** Minimal projected geometry accepted from the labelled arrangement builder. */
export interface ProjectedCurve {
    at(t: number): Vector;
    line?: boolean;
    C?: Vector;
    U?: Vector;
    V?: Vector;
    radius?: number;
}
export interface RegionSegment {
    c: ProjectedCurve;
    a: number;
    b: number;
    start: number;
    end: number;
    left: number;
    right: number;
}
export declare function create(scene: Scene, segments: readonly RegionSegment[], nodes: readonly Vector[], project: Project, scale: number): DotRegions | null;
