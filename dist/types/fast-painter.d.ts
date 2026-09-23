/** Fast orthographic painter: intentional center-z sphere ordering, not CSG.
 * Caller guards directional light / no cast shadows. No renderer dependency,
 * scene-wide visibility, sphere-pair certification, or boundary construction.
 * Bond/atom ownership is LOCAL sampled vector geometry; sub-grid islands can
 * disappear and contours approximate curved crossings between discovered edges.
 */
import type { Molecule } from './types.js';
import type { NormalizedOptions } from './options.js';
/** Already-normalized options; the public renderer owns eligibility/dispatch. */
export declare function renderFastPainter(molecule: Molecule, o: NormalizedOptions, explicitQuantization?: boolean): string;
