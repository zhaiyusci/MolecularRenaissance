export interface StippleTileSet {
    /** Tile side in pixels. */
    readonly px: number;
    /** SVG units one tile spans at the reference texture scale. */
    readonly period: number;
    readonly cells: number;
    /** Square mark side in tile pixels; one pixel is 25.4/dpi mm at print. */
    readonly markPx: number;
    readonly dpi: number;
    /** Provisional print width this set was sized for, in millimetres. */
    readonly printWidthMm: number;
    /** Independent Poisson birth-group PNGs for this palette. */
    readonly levels: readonly string[];
}
export declare const STIPPLE_TILE_SETS: Readonly<Record<4 | 8 | 16 | 32 | 64, StippleTileSet>>;
export declare const STIPPLE_TILES: StippleTileSet;
