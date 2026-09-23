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
    /** One 1-bit PNG data URI per tone level, levels 1..16. */
    readonly levels: readonly string[];
}
export declare const STIPPLE_TILES: StippleTileSet;
