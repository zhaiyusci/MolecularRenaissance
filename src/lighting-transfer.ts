/** Physical directional light and the independent artistic transfer.
 * No environment term or secondary reflection is implied by the artistic lift.
 */
export function directLight(facing: number, transmission = 1): number {
  return Math.max(0, Math.min(1, facing)) * Math.max(0, Math.min(1, transmission));
}

/** The established post-lighting artistic brightness is B=(D+1)/2.
 * Texture engines consume its signed encoding 2*B-1, i.e. D; the user's
 * brightness adds to B afterwards. Contrast and quantization remain downstream.
 */
export function artisticLightSignal(direct: number, brightness = 0): number {
  return Math.max(-1, Math.min(1, direct + 2 * brightness));
}

/** Invert the artistic contrast/brightness stage into a physical direct limit.
 * `darkness` precedes any stipple/halftone coverage-gain calibration.
 */
export function directLimitForDarkness(darkness: number, exponent: number, brightness: number): number {
  return 1 - 2 * Math.pow(darkness, 1 / exponent) - 2 * brightness;
}

/** Convert D <= limit (or D < limit) into a raw n.L threshold.
 * The entire back hemisphere is a D=0 plateau. In particular, inclusive zero
 * must include it, while strict zero must be empty. A fully blocked direct
 * component is identically zero, independently of surface orientation.
 */
export function facingLimitForDirect(limit: number, transmission = 1, inclusive = true): number {
  if (inclusive ? limit < 0 : limit <= 0) return -Infinity;
  if (transmission <= 0) return Infinity;
  if (inclusive ? limit >= transmission : limit > transmission) return Infinity;
  return limit / transmission;
}
