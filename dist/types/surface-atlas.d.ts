import type { Primitive, DotRegions, SurfaceRegion, Illumination } from './types.js';
import { type PreparedScene } from './scene.js';
import type { NormalizedOptions } from './options.js';
/** One visible-region index and one lazily extracted binary shadow per surface.
 * Discovery is local and resolution-limited; no ray tracing in subsequent
 * texture queries. Shadows retain the halftone backend's 2/1 SVG-unit grid. */
export declare function createSurfaceAtlas(prepared: PreparedScene, regions: DotRegions, o: NormalizedOptions): {
    visible: (s: Primitive) => SurfaceRegion | null;
    shadow: (s: Primitive) => SurfaceRegion;
    lightingFor: (s: Primitive) => Illumination;
    stats: {
        shadowBuilds: number;
        shadowSamples: number;
    };
};
