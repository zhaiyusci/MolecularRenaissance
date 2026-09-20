/** DOM-free entry point: model + options -> editable SVG string. */
import type { Molecule, RenderOptions } from './types.js';
export type { Atom, Bond, Molecule, Vec3, RenderOptions, RenderQuality, ShadingMode, ColorScheme, LightType, RenderMode } from './types.js';
export { examples } from './examples.js';
export { parseXYZ } from './xyz.js';
export type { XYZOptions } from './xyz.js';
export { covalentRadii, covalentRadiusSource } from './radii.js';
export { depthAt } from './scene.js';
export { engravingWidth } from './strokes.js';
export { elementColor, elementPalette } from './palette.js';
export declare function render(molecule: Molecule, options?: RenderOptions): string;
