import { render, examples, elementColor, type Molecule, type RenderOptions, type Vec3, type HatchMode } from 'molplotter';
import { render as legacyEntry } from 'molplotter/renderer.js';
const position: Vec3 = [0,0,0];
const molecule: Molecule = {name:'typed molecule',atoms:[{element:'C',position,radius:.73}],bonds:[]};
const options: RenderOptions = {quality:'export',shadingMode:'stipple',lightAzimuth:.7,lightElevation:.4,shadingSize:.8,scale:60,atomRadiusScale:.5};
const svg: string = render(molecule,options);
const another: string = legacyEntry(examples.c60,{quality:'preview'});
const color: string = elementColor('O',.65,1);
// Shared precise hatch/halftone boolean; stipple accepts but ignores it.
for (const quantizeShading of [true, false]) {
  const sharedOptions: RenderOptions = {renderMode:'precise',shadingMode:'halftone',quantizeShading};
  render(molecule,sharedOptions);
  render(molecule,{shadingMode:'hatch',quantizeShading});
  render(molecule,{shadingMode:'stipple',quantizeShading});
}
render(molecule,{quantizeShading:undefined});
// @ts-expect-error Quantization is boolean, not a level count.
render(molecule,{quantizeShading:16});
// @ts-expect-error String booleans are not accepted.
render(molecule,{quantizeShading:'false'});
// Legacy hatch-only alias remains available.
const hatchMode: HatchMode = 'layered';
const layeredOptions: RenderOptions = {renderMode:'precise',shadingMode:'hatch',hatchMode};
const layeredSvg: string = render(molecule,layeredOptions);
render(molecule,{hatchMode:'continuous'});
// Omitted/undefined selects layered in precise mode and continuous in fast mode.
render(molecule,{shadingMode:'hatch'});
render(molecule,{hatchMode:undefined});
render(molecule,{renderMode:'fast',hatchMode:undefined});
// @ts-expect-error Hatch mode is an explicit finite choice.
const invalidHatchMode: HatchMode = 'noise';
// @ts-expect-error Unknown hatching strategies are not silently accepted.
render(molecule,{hatchMode:'adaptive'});
// @ts-expect-error Hatch mode is not a boolean switch.
render(molecule,{hatchMode:true});
void layeredSvg; void invalidHatchMode;
// These are negative public-API tests, not production type suppressions.
// @ts-expect-error The removed lighting type is not exported.
import { type LightType } from 'molplotter';
// @ts-expect-error Even the former directional selector is removed.
render(molecule,{lightType:'directional'});
// @ts-expect-error Point lighting is removed.
render(molecule,{lightType:'point'});
// @ts-expect-error Light distance is removed.
render(molecule,{lightDistance:3});
// @ts-expect-error Light attenuation is removed.
render(molecule,{lightAttenuation:0});
// @ts-expect-error Removed colorMode must not be silently accepted.
render(molecule,{colorMode:'ink'});
// @ts-expect-error Removed element ink helper is not part of the public API.
import { elementInkColor } from 'molplotter';
// @ts-expect-error Unknown shading mode must not be accepted.
render(molecule,{shadingMode:'noise'});
// @ts-expect-error Scale is numeric, not an automatic fitting mode.
render(molecule,{scale:'auto'});
// @ts-expect-error Atom radius scale is numeric and never auto-selected.
render(molecule,{atomRadiusScale:'auto'});
// @ts-expect-error Width is numeric.
render(molecule,{width:'900'});
// @ts-expect-error Atom coordinates require exactly three components.
const invalidPosition: Vec3 = [0,0];
// @ts-expect-error Bonds are pairs of atom indices, not objects.
const invalid: Molecule = {atoms:[],bonds:[{from:0,to:1}]};
// @ts-expect-error No DOM library is supplied to this consumer.
document.createElement('svg');
void svg; void another; void color; void invalidPosition; void invalid;
