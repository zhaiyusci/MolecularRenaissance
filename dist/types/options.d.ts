import type { RenderOptions } from './types.js';
export type NormalizedOptions = Required<Omit<RenderOptions, 'shadingDensity' | 'shadingSize'>> & Pick<RenderOptions, 'shadingDensity' | 'shadingSize'>;
export declare function normalizeOptions(options: RenderOptions): NormalizedOptions;
