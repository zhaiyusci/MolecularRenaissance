// Separate from runtime.ts to keep the source dependency graph acyclic:
// renderer -> boundaries -> dot-regions (never boundaries -> renderer helpers).
import * as Regions from './dot-regions.js';
export function getDotRegions(): typeof Regions { return Regions; }
