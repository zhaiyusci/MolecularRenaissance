import { render, examples, elementColor, type Molecule, type RenderOptions, type Vec3 } from 'molplotter';
import { render as legacyEntry } from 'molplotter/renderer.js';
const position: Vec3 = [0,0,0];
const molecule: Molecule = {name:'typed molecule',atoms:[{element:'C',position,radius:.73}],bonds:[]};
const options: RenderOptions = {quality:'export',shadingMode:'stipple',lightType:'point',colorMode:'ink',shadingSize:.8,scale:60,atomRadiusScale:.5};
const svg: string = render(molecule,options);
const another: string = legacyEntry(examples.c60,{quality:'preview'});
const color: string = elementColor('O',.65,1);
// These are negative public-API tests, not production type suppressions.
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
