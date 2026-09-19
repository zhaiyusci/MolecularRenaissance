import type { Vector, Project, Illumination, ElementColor, Intervals } from './types.js';
import type { NormalizedOptions } from './options.js';
export declare function engravingWidth(base: number, illumination: number): number;
interface StrokeContext {
    options: NormalizedOptions;
    project: Project;
    illumination: Illumination;
    visible: (p: Vector) => boolean;
    inkFor: ElementColor;
    paths: string[];
    inkPaths: string[];
    coloredTexture: boolean;
}
interface CurvePoint {
    p: Vector;
    n: Vector;
}
/** Sample lighting/width only within known visible spans; emit strokes or ribbons. */
export declare function createCurveRenderer(context: StrokeContext): (fn: (t: number) => CurvePoint, steps: number, width: number, accept?: (n: Vector, p: Vector, lit: number) => boolean, engrave?: boolean, closed?: boolean, element?: string | null, clip?: (() => Intervals | null) | null) => void;
export {};
