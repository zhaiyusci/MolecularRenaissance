import type { Primitive, Project, Vector } from './types.js';
/**
 * Closed analytic directional-light tone boundaries, for SVG fill-rule="evenodd".
 * Coordinates/normals are in view space (+z faces the viewer); project must be
 * affine/orthographic. Occlusion is deliberately left to the caller's clip path.
 * Circular arcs use standard cubic approximations spanning at most pi/4.
 * A zero/nonfinite light or NaN threshold produces an empty path.
 */
export declare function directionalTonePath(s: Primitive, project: Project, light: Vector, threshold: number): string;
