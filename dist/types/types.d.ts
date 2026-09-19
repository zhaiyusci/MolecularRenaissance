/** Public input data: coordinates and undirected, zero-based atom-index pairs. */
export type Vec3 = readonly [number, number, number];
export type Bond = readonly [number, number];
export interface Atom {
    element: string;
    /** Cartesian coordinates in angstrom. */
    position: Vec3;
    /** Optional explicit radius in angstrom; otherwise use the cited covalent table. */
    radius?: number;
}
export interface Molecule {
    name?: string;
    atoms: readonly Atom[];
    bonds: readonly Bond[];
}
export type ShadingMode = 'hatch' | 'stipple' | 'halftone';
export type RenderQuality = 'preview' | 'export';
export type ColorMode = 'wash' | 'ink';
export type LightType = 'directional' | 'point';
/** Angles are radians; stroke/label sizes are SVG units, not angstrom or print mm. */
export interface RenderOptions {
    width?: number;
    height?: number;
    yaw?: number;
    pitch?: number;
    /** Fixed SVG units per angstrom, default 60. Never auto-fit to model or canvas. */
    scale?: number;
    /** User-controlled sphere-radius multiplier, default 1; never changes atom centers or bonds. */
    atomRadiusScale?: number;
    lightAzimuth?: number;
    lightElevation?: number;
    lightType?: LightType;
    lightDistance?: number;
    quality?: RenderQuality;
    shadingMode?: ShadingMode;
    shadingDensity?: number;
    shadingSize?: number;
    shadingContrast?: number;
    outlineWidth?: number;
    hatchWidth?: number;
    variableWidth?: boolean;
    crossHatch?: boolean;
    colorWash?: boolean;
    colorMode?: ColorMode;
    washStrength?: number;
    colorSaturation?: number;
    labels?: boolean;
    labelMatchFill?: boolean;
    labelSize?: number;
    labelStrokeWidth?: number;
    labelStrokeColor?: string;
    labelColor?: string;
    labelFont?: string;
    labelBold?: boolean;
    labelItalic?: boolean;
    /** Legacy controls; the corresponding shared shading control takes precedence. */
    density?: number;
    lineWidth?: number;
    dotSpacing?: number;
    dotSize?: number;
    dotContrast?: number;
    /** Export path fitting only; preview always skips fitting. */
    optimizePaths?: boolean;
}
/** Internal variable-dimension vector operations; public coordinates use Vec3. */
export type Vector = number[];
export interface Sphere {
    kind: 'sphere';
    c: Vector;
    r: number;
    element?: string;
}
export interface Cylinder {
    kind: 'cylinder';
    a: Vector;
    u: Vector;
    length: number;
    r: number;
}
export type Primitive = Sphere | Cylinder;
export type Scene = readonly Primitive[];
export type DepthAt = (shape: Primitive, x: number, y: number) => number;
export type Project = (position: readonly number[]) => Vector;
export type Illumination = (normal: Vector, position: Vector) => number;
export type ElementColor = (element: string | null | undefined) => string;
export type Intervals = [number, number][];
export interface DotRegionHit {
    id: number;
    clearance: number;
}
export interface DotRegions {
    query(x: number, y: number, maxRadius: number): DotRegionHit | null;
}
export type DotOptions = Pick<RenderOptions, 'shadingMode' | 'dotSpacing' | 'dotSize' | 'dotContrast'>;
