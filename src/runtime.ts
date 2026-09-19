// Canonical source/ESM dependencies: no globals, loader, or DOM required.
// Getters defer access until render time and keep the compatibility adapter small.
import * as Boundaries from './boundaries.js';
import * as Wash from './wash.js';
import * as Dots from './dots.js';
export function getBoundaries(): typeof Boundaries { return Boundaries; }
export function getWash(): typeof Wash { return Wash; }
export function getDots(): typeof Dots { return Dots; }
