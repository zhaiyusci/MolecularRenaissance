import type { Vector, Sphere, Cylinder, Primitive, Scene, DepthAt, Project, ElementColor, Intervals, DotRegions } from './types.js';
export interface Contact {
    sphere: Sphere;
    cylinder: Cylinder;
    axis: Vector;
    offset: number;
}
interface CurveBase {
    at: (t: number) => Vector;
    tangent: (t: number) => Vector;
    cuts: number[];
    end: number;
    box: Vector;
    contact?: Contact;
    members?: Curve[];
    contacts?: Contact[];
    source?: Sphere | null;
    world?: (t: number) => Vector;
}
export interface LineCurve extends CurveBase {
    line: true;
    A: Vector;
    D: Vector;
}
export interface EllipseCurve extends CurveBase {
    line?: false;
    C: Vector;
    U: Vector;
    V: Vector;
    det: number;
    radius: number;
    world: (t: number) => Vector;
}
export type Curve = LineCurve | EllipseCurve;
export interface Segment {
    c: Curve;
    a: number;
    b: number;
    start: number;
    end: number;
}
export interface OwnedSegment extends Segment {
    left: number;
    right: number;
}
/** Legacy palettes may omit a color with either null or undefined. */
export type BoundaryPalette = (element: Parameters<ElementColor>[0]) => ReturnType<ElementColor> | null | undefined;
export interface BoundaryArrangement {
    wash(colorFor: BoundaryPalette, preview: boolean, validateOnly?: boolean): string | null;
    outline(s: Primitive, preview: boolean, width: number): string;
    clipCircle(source: Primitive, center: Vector, u: Vector, v: Vector): Intervals | null;
    clipLine(source: Primitive, a: Vector, b: Vector): Intervals | null;
    dotRegions(): DotRegions | null;
    /** Scene-indexed compound paths (use evenodd); null entries are hidden surfaces. */
    surfacePaths(preview: boolean): (string | null)[] | null;
    validate(colorFor: BoundaryPalette): boolean;
    curveCount: number;
    segmentCount: number;
}
export declare function build(scene: Scene, depthAt: DepthAt, project: Project, scale: number): BoundaryArrangement | null;
export {};
