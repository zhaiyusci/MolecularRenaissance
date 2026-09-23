/** Shared visual quantization policy, not a geometric accuracy tolerance. */
export const TONE_LEVELS = 16;
export function validateShadingLevels(value: unknown): asserts value is import('./types.js').ShadingLevels {
  if (![4, 8, 16, 32, 64].includes(value as number))
    throw new Error('Invalid shadingLevels: expected 4, 8, 16, 32, or 64');
}
