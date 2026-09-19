/** DOM-free entry point: model + options -> editable SVG string. */
import type { Molecule, RenderOptions } from './types.js';
export type { Atom, Bond, Molecule, Vec3, RenderOptions, RenderQuality, ShadingMode, ColorMode, LightType } from './types.js';
export { examples } from './examples.js';
export { covalentRadii, covalentRadiusSource } from './radii.js';
export { depthAt } from './scene.js';
export { engravingWidth } from './strokes.js';
export { elementColor, elementInkColor, elementPalette, elementInkPalette } from './palette.js';
export declare function render(molecule: Molecule, options?: RenderOptions): string;
