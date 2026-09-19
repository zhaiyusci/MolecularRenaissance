// Build-time adapter for independent classic-script/CommonJS modules only.
// Optional analytic helpers may be absent in legacy browser callers.
import type * as Boundaries from './boundaries.js';
import type * as Wash from './wash.js';
import type * as Dots from './dots.js';
import type * as Regions from './dot-regions.js';
declare const module: { exports: unknown } | undefined;
declare const require: (id: string) => unknown;
interface RuntimeGlobals {
  MolBoundaries?: typeof Boundaries;
  MolWash?: typeof Wash;
  MolDots?: typeof Dots;
  MolDotRegions?: typeof Regions;
}
const root = globalThis as RuntimeGlobals;
export function getBoundaries(): typeof Boundaries | undefined {
  return typeof module !== 'undefined' && module.exports ? require('./boundaries.js') as typeof Boundaries : root.MolBoundaries;
}
export function getWash(): typeof Wash | undefined {
  return typeof module !== 'undefined' && module.exports ? require('./wash.js') as typeof Wash : root.MolWash;
}
export function getDots(): typeof Dots | undefined {
  return typeof module !== 'undefined' && module.exports ? require('./dots.js') as typeof Dots : root.MolDots;
}
export function getDotRegions(): typeof Regions | undefined {
  return typeof module !== 'undefined' && module.exports ? require('./dot-regions.js') as typeof Regions : root.MolDotRegions;
}
