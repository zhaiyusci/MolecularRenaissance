/** Experimental, opt-in sphere-only foreground overpaint. Not a default replacement.
 * Certification concerns geometric surfaces, not the footprint of ink or text:
 * whole labels belong to their owner's layer and can be overpainted by later owners.
 * No scene visibility queries, boundary construction, or cross-owner clipping occur
 * on the painter route. Fallback deliberately delegates unchanged input to render.
 */
import type { Molecule, RenderOptions, Sphere } from './types.js';
/** Hard bound on this quadratic first experiment; larger scenes use normal render. */
export declare const PAINTER_MAX_SPHERES = 2048;
export interface PainterPlan {
    route: 'painter' | 'fallback';
    reason: string;
    /** Back-to-front original sphere/atom indices; empty on failure. */
    order: number[];
    /** [rear, front] input indices. On failure these are a partial graph only. */
    edges: [number, number][];
    failedPair?: [number, number];
    sphereCount: number;
    totalPairs: number;
    testedPairs: number;
    projectedDisjointPairs: number;
    projectedOverlapPairs: number;
    disjoint3DPairs: number;
    nestedPairs: number;
    intersectingPairs: number;
    depthSamples: number;
    edgeCount: number;
}
/** Pure geometry API: view coordinates, +z toward viewer, positive sphere radii.
 * No projection, molecule preprocessing, rendering, or visibility oracle is used.
 * Disconnected disks impose no precedence. All other accepted relations are
 * certified over the entire connected overlap lens, not inferred from center z.
 * Numerical/tangent ambiguity is a fallback, never an invented ordering.
 */
export declare function planPainterSpheres(spheres: readonly Sphere[]): PainterPlan;
/** Molecule-level planning uses exactly the normal renderer's scientific transform. */
export declare function planPainter(molecule: Molecule, options?: RenderOptions): PainterPlan;
export interface PainterResult extends PainterPlan {
    svg: string;
    /** Experiment counters only; null on fallback because normal render is opaque. */
    boundaryBuilds: number | null;
    sceneVisibilityTests: number | null;
    /** Actual generated curves/paths, excluding translated template reuse. */
    hatchCurves: number;
    hatchPaths: number;
    /** One local-origin hatch definition per distinct radius, within this call. */
    hatchTemplates: number;
    paintedSpheres: number;
    wholeLabels: number;
    ownSilhouetteClips: number;
}
export interface PainterExperimentOptions {
    reuseHatches?: boolean;
}
export declare function renderPainter(molecule: Molecule, options?: RenderOptions, experiment?: PainterExperimentOptions): PainterResult;
