import type { RenderOptions } from './types.js';
export type NormalizedOptions = Required<Omit<RenderOptions, 'shadingDensity' | 'shadingSize' | 'orientation'>> & Pick<RenderOptions, 'shadingDensity' | 'shadingSize' | 'orientation'>;
export declare function normalizeOptions(options: RenderOptions): NormalizedOptions;
