/** DOM-free entry point: model + options -> editable SVG string. */
import type { Molecule, RenderOptions, Vector, ElementColor } from './types.js';
import { add, mul, cross, norm, escapeXml as esc } from './math.js';
import { normalizeOptions } from './options.js';
import { prepareScene, depthAt } from './scene.js';
import { elementColor } from './palette.js';
import { createCurveRenderer } from './strokes.js';
import { hatchCoverage } from './coverage.js';
import { directionalShadowContext } from './shadows.js';
import { getBoundaries, getDots, getWash } from './runtime.js';
export type { Atom, Bond, Molecule, Vec3, RenderOptions, RenderQuality, ShadingMode, ColorScheme, LightType } from './types.js';
export { examples } from './examples.js';
export { covalentRadii, covalentRadiusSource } from './radii.js';
export { depthAt } from './scene.js';
export { engravingWidth } from './strokes.js';
export { elementColor, elementPalette } from './palette.js';

export function render(molecule: Molecule,options: RenderOptions={}): string {
  const o=normalizeOptions(options);
  const {spheres,cylinders,scene,scale,project,illumination:physicalIllumination,lightDirection,shadowBias}=prepareScene(molecule,o);
  // Shift tonal input after lighting/shadows, leaving color fills and outlines alone.
  const illumination=o.shadingBrightness===0?physicalIllumination:
    (n:Vector,p:Vector)=>Math.max(-1,Math.min(1,physicalIllumination(n,p)+2*o.shadingBrightness));
  const paths: string[]=[];
  // Preserve the tolerant legacy oracle for outlines/fallbacks and labels.
  const visible=(p: Vector)=>!scene.some(s=>depthAt(s,p[0],p[1])>p[2]+.00015);
  const curve=createCurveRenderer({options:o,project,illumination,visible,paths});
  const fillFor: ElementColor=element=>o.colorWash?elementColor(element,o.washStrength,o.colorSaturation,o.colorScheme):'#ffffff';
  const analytic=getBoundaries();
  const built=analytic?analytic.build(scene,depthAt,project,scale):null;
  // Validate independently of the selected palette; styles must not change outlines.
  const boundaries=built&&built.validate(elementColor)?built:null;
  let wash: string|null='';
  if(o.colorWash&&o.washStrength>0){
    if(boundaries)wash=boundaries.wash(fillFor,o.quality==='preview');
    if(!boundaries||wash===null){
      const helper=getWash();
      if(!helper)throw new Error('Missing wash.js: load it before renderer.js');
      wash=helper.buildWash(scene,depthAt,project,scale,fillFor,{fitCurves:o.quality!=='preview'});
    }
  }
  // Density is a screen-space style: enlarge geometry by adding hatches,
  // never by stretching their spacing. Calibrate to the existing scale=60 look.
  const hatchDensity=o.density*scale/60;
  for(const s of spheres){
    if(boundaries)paths.push(boundaries.outline(s,o.quality==='preview'||!o.optimizePaths,o.outlineWidth*1.4));
    else curve(t=>{const a=t*Math.PI*2,n=[Math.cos(a),Math.sin(a),0];return {p:add(s.c,mul(n,s.r)),n};},Math.ceil(2*Math.PI*s.r*scale/0.65),o.outlineWidth*1.4);
    function hatch(axis: Vector,count: number,secondary: boolean): void {
      axis=norm(axis);
      const e=norm(cross(axis,[1,0,0])),f=cross(axis,e);
      for(let j=1;j<count;j++){
        const h=-1+2*j/count,r=Math.sqrt(1-h*h);
        curve(t=>{
          const a=t*Math.PI*2,cos=Math.cos(a),sin=Math.sin(a);
          const n=[axis[0]*h+(e[0]*cos+f[0]*sin)*r,axis[1]*h+(e[1]*cos+f[1]*sin)*r,axis[2]*h+(e[2]*cos+f[2]*sin)*r];
          return {p:[s.c[0]+n[0]*s.r,s.c[1]+n[1]*s.r,s.c[2]+n[2]*s.r],n};
        },Math.max(120,Math.ceil(2*Math.PI*s.r*scale*r/.7)),o.hatchWidth*(secondary?.63:.8),(n,p,lit)=>n[2]>=-1e-12&&lit<(secondary?.12:(j%2===0?.88:.58)),true,true,
          boundaries?.clipCircle?()=>boundaries.clipCircle(s,add(s.c,mul(axis,h*s.r)),mul(e,r*s.r),mul(f,r*s.r)):null);
      }
    }
    if(o.shadingMode==='hatch'&&o.hatchWidth>0){
      hatch([.12,1,.40],Math.max(2,Math.round(hatchDensity*s.r/.48)),false);
      if(o.crossHatch)hatch([1,.22,-.32],Math.max(2,Math.round(hatchDensity*.8*s.r/.48)),true);
    }
  }
  for(const s of cylinders){
    const e=norm(cross(s.u,Math.abs(s.u[2])<.95?[0,0,1]:[0,1,0])),f=cross(s.u,e);
    const line=(n: Vector,w: number,engrave=false)=>{
      const offset=mul(n,s.r),a=add(s.a,offset),b=add(a,mul(s.u,s.length));
      curve(t=>{const d=t*s.length;return {p:[s.a[0]+s.u[0]*d+offset[0],s.a[1]+s.u[1]*d+offset[1],s.a[2]+s.u[2]*d+offset[2]],n};},Math.max(60,Math.ceil(s.length*scale/.7)),w,(normal,p,lit)=>!engrave||lit<.65,engrave,false,
        engrave&&boundaries?.clipLine?()=>boundaries.clipLine(s,a,b):null);
    };
    if(Math.hypot(s.u[0],s.u[1])>1e-8){const edge=norm([-s.u[1],s.u[0],0]);line(edge,o.outlineWidth*1.1);line(mul(edge,-1),o.outlineWidth*1.1);}
    const count=Math.max(3,Math.round(hatchDensity*.8*s.r/.115));
    for(let j=0;o.shadingMode==='hatch'&&o.hatchWidth>0&&j<count;j++){
      const a=j/count*2*Math.PI,n=add(mul(e,Math.cos(a)),mul(f,Math.sin(a)));
      if(n[2]>0)line(n,o.hatchWidth*.68,true);
    }
  }
  let dots='';
  if(o.shadingMode!=='hatch'&&o.dotSize>0){
    const dotter=getDots();
    if(!dotter)throw new Error('Load dots.js before renderer.js');
    const regions=o.shadingMode==='stipple'&&boundaries?.dotRegions?boundaries.dotRegions():null;
    const surfaces=o.shadingMode==='halftone'?{
      paths:boundaries?.surfacePaths?boundaries.surfacePaths(false):null,
      light:o.lightType==='directional'?lightDirection:undefined,
      ...(o.lightType==='directional'&&o.castShadows&&o.shadowStrength>0?directionalShadowContext(scene,lightDirection,shadowBias):{})
    }:undefined;
    dots=dotter.buildDots(scene,depthAt,project,scale,illumination,o,regions,hatchCoverage(scale,o),surfaces);
  }
  let labels='';
  if(o.labels)for(const s of spheres){
    const p=add(s.c,[0,0,s.r]);
    if(!visible(p))continue;
    const [x,y]=project(p);
    labels+=`<text data-role="element-label" x="${x.toFixed(2)}" y="${(y+o.labelSize*.3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${esc(o.labelFont)}" font-style="${o.labelItalic?'italic':'normal'}" font-weight="${o.labelBold?'700':'400'}" stroke="${o.labelStrokeWidth===0?'none':(o.labelMatchFill?fillFor(s.element):o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${esc(s.element)}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title"><title id="title">${esc(molecule.name||'Molecular engraving')}</title><rect width="100%" height="100%" fill="white"/>${wash}${dots}<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g><g font-family="Georgia, 'Times New Roman', serif">${labels}</g></svg>`;
}
