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
export interface Molecule { name?: string; atoms: readonly Atom[]; bonds: readonly Bond[]; }
export type ShadingMode = 'hatch' | 'stipple' | 'halftone';
export type RenderQuality = 'preview' | 'export';
export type ColorScheme = 'jmol' | 'rasmol' | 'pymol' | 'greenCarbon' | 'cyanCarbon' | 'magentaCarbon';
export type LightType = 'directional' | 'point';
export type RenderMode = 'precise' | 'fast';

/** Angles are radians; stroke/label sizes are SVG units, not angstrom or print mm. */
export interface RenderOptions {
  /** Fast: painter-ordered spheres, local bond–atom masks; directional/no shadows only. */
  renderMode?: RenderMode;
  width?: number; height?: number; yaw?: number; pitch?: number;
  /** Fixed SVG units per angstrom, default 60. Never auto-fit to model or canvas. */
  scale?: number;
  /** User-controlled sphere-radius multiplier, default 1; never changes atom centers or bonds. */
  atomRadiusScale?: number;
  lightAzimuth?: number; lightElevation?: number; lightType?: LightType; lightDistance?: number;
  /** Point-light falloff k: 1/(1+k*(distance/sceneRadius)^2). Default 0 disables it. */
  lightAttenuation?: number;
  /** Hard shadows from spheres and closed bond cylinders; default false. */
  castShadows?: boolean;
  /** Fraction of light removed by an occluder, 0–1; default 0.8. */
  shadowStrength?: number;
  quality?: RenderQuality; shadingMode?: ShadingMode;
  /** Joint spacing and mark-size scale, 0.2–2.5; larger means coarser at similar mean coverage. */
  textureScale?: number;
  /** Texture brightness offset, -1–1; positive is brighter, default 0. Does not recolor fills. */
  shadingBrightness?: number;
  /** Legacy independent controls; textureScale overrides them except shadingSize=0 for no-texture previews. */
  shadingDensity?: number; shadingSize?: number; shadingContrast?: number;
  outlineWidth?: number; hatchWidth?: number; variableWidth?: boolean; crossHatch?: boolean;
  /** Sourced element fill palettes; default jmol. Textures always use black ink. */
  colorScheme?: ColorScheme;
  colorWash?: boolean; washStrength?: number; colorSaturation?: number;
  /** Show H text when labels are enabled; default true. Does not hide atoms/bonds. */
  labelHydrogens?: boolean;
  labels?: boolean; labelMatchFill?: boolean; labelSize?: number; labelStrokeWidth?: number;
  labelStrokeColor?: string; labelColor?: string; labelFont?: string; labelBold?: boolean; labelItalic?: boolean;
  /** Legacy controls; the corresponding shared shading control takes precedence. */
  density?: number; lineWidth?: number; dotSpacing?: number; dotSize?: number; dotContrast?: number;
  /** Export path fitting only; preview always skips fitting. */
  optimizePaths?: boolean;
}

/** Internal variable-dimension vector operations; public coordinates use Vec3. */
export type Vector = number[];
export interface Sphere { kind: 'sphere'; c: Vector; r: number; element?: string; }
export interface Cylinder { kind: 'cylinder'; a: Vector; u: Vector; length: number; r: number; }
export type Primitive = Sphere | Cylinder;
export type Scene = readonly Primitive[];
export type DepthAt = (shape: Primitive, x: number, y: number) => number;
export type Project = (position: readonly number[]) => Vector;
export type Illumination = (normal: Vector, position: Vector) => number;
export type ElementColor = (element: string | null | undefined) => string;
export type Intervals = [number, number][];
export interface DotRegionHit { id: number; clearance: number; }
/** Projected evenodd surface; bounds are [minX,minY,maxX,maxY]. */
export interface SurfaceRegion {
  bounds: readonly number[];
  contains(x: number, y: number): boolean;
  /** c + u*cos(2*pi*t) + v*sin(2*pi*t), 0 <= t <= 1. Null requests fallback. */
  clipEllipse(c: Vector, u: Vector, v: Vector): Intervals | null;
  /** a + (b-a)*t, 0 <= t <= 1. */
  clipLine(a: Vector, b: Vector): Intervals;
  /** Reusable front-sphere height chart; orthonormal axes use screen x/right,
   * y/down, z/toward-viewer. The returned clipper takes height h in [-1,1]. */
  sphereFamily?(c: Vector, r: number, axis: Vector, e: Vector, f: Vector): (h: number) => Intervals | null;
}
export interface DotRegions {
  query(x: number, y: number, maxRadius: number): DotRegionHit | null;
  /** When available, null means the owner is fully hidden. */
  surface?(id: number): SurfaceRegion | null;
}
export type DotOptions = Pick<RenderOptions, 'shadingMode' | 'dotSpacing' | 'dotSize' | 'dotContrast' | 'width' | 'height' | 'quality' | 'shadingBrightness' | 'shadowStrength'>;
/** Internal geometric context; custom low-level callbacks may omit it. */
export interface SurfaceToneContext {
  paths: readonly (string|null)[] | null;
  /** Batch equal-radius dots into round zero-length subpaths, without repetition. */
  compactStipple?:boolean;
  /** Emit complete texture bodies by scene primitive index; return only shared setup. */
  emitSurface?: (id:number,svg:string)=>void;
  /** Surface-aware tone illumination, including the caller's brightness shift. */
  illumination?: (source:Primitive,n:Vector,p:Vector)=>number;
  /** Present only for a directional light, in view coordinates. */
  light?: Vector;
  mayShadow?: readonly boolean[];
  shadowed?: (id:number,normal:Vector,position:Vector)=>boolean;
}
