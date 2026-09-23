/** Physical directional light and the independent artistic transfer.
 * No environment term or secondary reflection is implied by the artistic lift.
 */
export declare function directLight(facing: number, transmission?: number): number;
/** The established post-lighting artistic brightness is B=(D+1)/2.
 * Texture engines consume its signed encoding 2*B-1, i.e. D; the user's
 * brightness adds to B afterwards. Contrast and quantization remain downstream.
 */
export declare function artisticLightSignal(direct: number, brightness?: number): number;
/** Invert the artistic contrast/brightness stage into a physical direct limit.
 * `darkness` precedes any stipple/halftone coverage-gain calibration.
 */
export declare function directLimitForDarkness(darkness: number, exponent: number, brightness: number): number;
/** Convert D <= limit (or D < limit) into a raw n.L threshold.
 * The entire back hemisphere is a D=0 plateau. In particular, inclusive zero
 * must include it, while strict zero must be empty. A fully blocked direct
 * component is identically zero, independently of surface orientation.
 */
export declare function facingLimitForDirect(limit: number, transmission?: number, inclusive?: boolean): number;
