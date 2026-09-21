/** Reviewed categorical patterns. Custom design, not a universal element standard.
 * Grid FACES have area 81 screen units² at scale 1; ink coverage is not equalized.
 * No lighting, geometry, palette or random state is consulted here.
 */
export interface ElementTextureRecipe {
    readonly key: string;
    readonly width: number;
    readonly height: number;
    readonly angle: number;
    readonly body: string;
}
/** Other supported elements retain the older deterministic fallback recipes. */
export declare function approvedElementRecipe(element: string): ElementTextureRecipe | undefined;
