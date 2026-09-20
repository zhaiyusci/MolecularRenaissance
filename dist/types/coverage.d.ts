import type { Primitive, Vector } from './types.js';
import type { NormalizedOptions } from './options.js';
/** Expected projected hatch coverage, not a second illumination model.
 * Ignores individual stroke phase/taper and estimates crossings as independent.
 * Use its spatial average to calibrate smooth dot lighting, never its local
 * pattern as a lighting field. Small surfaces and silhouettes can still differ.
 */
export declare function hatchCoverage(scale: number, o: NormalizedOptions): (s: Primitive, n: Vector, light: number) => number;
