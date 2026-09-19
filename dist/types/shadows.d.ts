import type { Primitive, Vector } from './types.js';
/** Any solid intersecting the ray toward the light (finite for a point source).
 * Normal bias avoids self-shadow acne; closed cylinders include both end caps.
 */
export declare function shadowBlocked(scene: readonly Primitive[], p: Vector, n: Vector, d: Vector, maxDistance: number, bias: number): boolean;
