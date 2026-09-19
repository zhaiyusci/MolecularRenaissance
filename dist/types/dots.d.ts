import type { Scene, DepthAt, Project, Illumination, ElementColor, DotRegions, DotOptions } from './types';
export declare function buildDots(scene: Scene, depthAt: DepthAt, project: Project, scale: number, illumination: Illumination, options?: DotOptions, colorForElement?: ElementColor | null, regions?: DotRegions | null): string;
