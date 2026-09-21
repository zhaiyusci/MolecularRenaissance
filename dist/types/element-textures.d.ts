import type { Scene, Project, DepthAt, RenderQuality } from './types.js';
/** Stable recipe key: 19 reviewed common-element patterns, distinct recipes for H–Cm.
 * Unknown ASCII symbols use a bounded hashed fallback, not a carbon default. */
export declare function elementTexturePattern(element: string): string;
/** A pure-vector SVG pattern definition. IDs must be safe XML/CSS identifiers.
 * patternUnits and all mark dimensions are SVG screen units; scale is NOT molecular scale. */
export declare function elementTextureDefinition(element: string, id: string, scale?: number): string;
/** Standalone fixed-scale legend swatch using exactly the renderer's recipe. */
export declare function elementTextureSwatch(element: string): string;
/** Shared once per unique element, never once per atom. Same IDs imply identical definitions. */
export declare function createElementTextures(elements: readonly string[], scale: number): {
    definitions: string;
    fill: (element: string) => string;
};
/** Bounded numerical fallback ONLY when certified visible surface paths are absent.
 * Binary depth ownership is contoured in 64-unit tiles (.25 export/.5 preview,
 * nine edge bisections). Sub-grid islands can disappear; curved intersections
 * are approximate. This is never an unoccluded circle or a lighting threshold.
 * Separate paths in clipPath UNION overlapping tiles rather than XORing them. */
export declare function sampledElementTextures(scene: Scene, depthAt: DepthAt, project: Project, scale: number, width: number, height: number, quality: RenderQuality, fills: {
    fill: (element: string) => string;
}): string;
