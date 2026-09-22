import type { Vector, Project, Illumination, Intervals } from './types.js';
import type { NormalizedOptions } from './options.js';
import { type ProjectedCurve } from './hatch-curves.js';
export declare function engravingWidth(base: number, illumination: number): number;
interface StrokeContext {
    options: NormalizedOptions;
    project: Project;
    illumination: Illumination;
    visible: (p: Vector) => boolean;
    paths: string[];
}
interface CurvePoint {
    p: Vector;
    n: Vector;
    xy?: Vector;
}
export interface CurveHints {
    geometry?: ProjectedCurve;
    /** Exact front/tonal spans for unshadowed directional light. */
    spans?: Intervals;
    /** Interior shadow boundaries force refinement without inventing tapered tips. */
    breaks?: readonly number[];
    illumination?: Illumination;
    /** Outline acceptance does not depend on illumination. */
    ignoreLighting?: boolean;
}
/** Sample lighting/width only within known visible spans; emit strokes or ribbons. */
export declare function createCurveRenderer(context: StrokeContext): (fn: (t: number) => CurvePoint, steps: number, width: number, accept?: (n: Vector, p: Vector, lit: number) => boolean, engrave?: boolean, closed?: boolean, clip?: (() => Intervals | null) | null, hints?: CurveHints) => void;
export {};
