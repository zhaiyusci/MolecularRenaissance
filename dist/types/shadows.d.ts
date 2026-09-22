import type { Primitive, Vector, Scene } from './types.js';
/** Conservative directional-light broad phase, once per visible surface.
 * A convex primitive cannot shadow its own outward-facing surface. */
export declare function directionalShadowContext(scene: Scene, light: Vector, bias: number): {
    /** Same conservative lists for physical surface illumination; scene order is retained. */
    candidates: readonly (readonly Primitive[])[];
    mayShadow: boolean[];
    shadowed: (id: number, n: Vector, p: Vector) => boolean;
};
/** Any solid intersecting the infinite ray toward the directional light.
 * Normal bias avoids self-shadow acne; closed cylinders include both end caps.
 */
export declare function shadowBlocked(scene: readonly Primitive[], p: Vector, n: Vector, d: Vector, bias: number): boolean;
