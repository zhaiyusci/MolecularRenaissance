/** DOM-free entry point: model + options -> editable SVG string. */
import type { Molecule, RenderOptions, Vector, ElementColor, Primitive, Illumination, Intervals } from './types.js';
import { add, mul, cross, norm, dot, escapeXml as esc } from './math.js';
import { normalizeOptions } from './options.js';
import { prepareScene, depthAt } from './scene.js';
import { elementColor } from './palette.js';
import { createCurveRenderer } from './strokes.js';
import { trigSpans, intersectSpans, unionSpans, complementSpans, projectedCircle, projectedLine, type ProjectedCurve } from './hatch-curves.js';
import { createSurfaceAtlas } from './surface-atlas.js';
import { renderFastPainter } from './fast-painter.js';
import { createElementTextures, sampledElementTextures } from './element-textures.js';
import { hatchCoverage } from './coverage.js';
import { getBoundaries, getDots, getWash } from './runtime.js';
export type { Atom, Bond, Molecule, Vec3, Quaternion, RenderOptions, RenderQuality, ShadingMode, ColorScheme, LightType, RenderMode } from './types.js';
export { normalizeOrientation, rotateOrientation, orientationFromEulerXYZ, orientationToEulerXYZ } from './orientation.js';
export { examples } from './examples.js';
export { parseXYZ } from './xyz.js';
export type { XYZOptions } from './xyz.js';
export { covalentRadii, covalentRadiusSource } from './radii.js';
export { depthAt } from './scene.js';
export { engravingWidth } from './strokes.js';
export { elementColor, elementPalette } from './palette.js';
export { elementTexturePattern, elementTextureDefinition, elementTextureSwatch } from './element-textures.js';

export function render(molecule: Molecule,options: RenderOptions={}): string {
  const o=normalizeOptions(options);
  if(o.renderMode==='fast')return renderFastPainter(molecule,o);
  const prepared=prepareScene(molecule,o);
  const {spheres,cylinders,scene,scale,project,illumination:physicalIllumination,lightDirection,lightingFor,mayShadow,directionalShadows}=prepared;
  let atlas:ReturnType<typeof createSurfaceAtlas>|null=null;
  const physicalFor=(source:Primitive)=>atlas?atlas.lightingFor(source):lightingFor(source);
  // Shift tonal input after lighting/shadows, leaving color fills and outlines alone.
  const illumination=o.shadingBrightness===0?physicalIllumination:
    (n:Vector,p:Vector)=>Math.max(-1,Math.min(1,physicalIllumination(n,p)+2*o.shadingBrightness));
  const shiftedLights=new Map<Primitive,Illumination>();
  const lightFor=(source:Primitive):Illumination=>{
    if(o.shadingBrightness===0)return physicalFor(source);
    let light=shiftedLights.get(source);
    if(!light){const physical=physicalFor(source);light=(n,p)=>Math.max(-1,Math.min(1,physical(n,p)+2*o.shadingBrightness));shiftedLights.set(source,light);}
    return light;
  };
  const physicalThreshold=(limit:number)=>1-2*Math.pow((1-limit)/2,1/(o.shadingContrast/1.2))-2*o.shadingBrightness;
  const paths: string[]=[];
  // Preserve the tolerant legacy oracle for outlines/fallbacks and labels.
  const visible=(p: Vector)=>!scene.some(s=>depthAt(s,p[0],p[1])>p[2]+.00015);
  const curve=createCurveRenderer({options:o,project,illumination,visible,paths});
  const fillFor: ElementColor=element=>o.colorWash?elementColor(element,o.washStrength,o.colorSaturation,o.colorScheme):'#ffffff';
  const analytic=getBoundaries();
  const built=analytic?analytic.build(scene,depthAt,project,scale):null;
  // Validate independently of the selected palette; styles must not change outlines.
  const boundaries=built&&built.validate(elementColor)?built:null;
  // Labels are part of their owner's paint layer, never a final overlay and
  // never clipped text. Certified visible fills preserve intersecting geometry.
  const layerPaths=(o.labels||o.elementTextures)&&boundaries?.surfacePaths?boundaries.surfacePaths(false):null;
  const elements=o.elementTextures?createElementTextures(spheres.map(s=>s.element!),o.elementTextureScale):null;
  // Without certified paths, texture ownership has its own bounded numerical
  // fallback. Do not promote sampled paths to certified whole-label layers.
  const fallbackElements=elements&&!layerPaths?sampledElementTextures(scene,depthAt,project,scale,o.width,o.height,o.quality,elements):'';
  const ownerEngraving=new Map<Primitive,string>(),ownerDots=new Map<number,string>();
  const regions=o.shadingMode!=='halftone'&&o.shadingSize!==0&&boundaries?.dotRegions?boundaries.dotRegions():null;
  if(regions?.surface)atlas=createSurfaceAtlas(prepared,regions,o);
  // Shadow boundaries are solved per surface, not rediscovered along each line.
  function tonalSpans(s:Primitive,g:ProjectedCurve,tone:(limit:number)=>Intervals,limit:number,sharedShadow?:Intervals|null){
    if(o.lightType!=='directional')return {spans:undefined,breaks:undefined};
    const shadow=sharedShadow!==undefined?sharedShadow:mayShadow(s)?(atlas?g.clip(atlas.shadow(s)):null):[];
    if(shadow===null)return {spans:undefined,breaks:undefined};
    const threshold=physicalThreshold(limit);
    const darkThreshold=o.shadowStrength>=1?(-1<threshold?Infinity:-Infinity):(threshold+1)/(1-o.shadowStrength)-1;
    const spans=unionSpans(intersectSpans(tone(threshold),complementSpans(shadow)),intersectSpans(tone(darkThreshold),shadow));
    return {spans,breaks:shadow.flat()};
  }
  let wash: string|null='';
  if(!layerPaths&&o.colorWash&&o.washStrength>0){
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
    const start=paths.length;
    if(boundaries)paths.push(boundaries.outline(s,o.quality==='preview'||!o.optimizePaths,o.outlineWidth*1.4));
    else curve(t=>{const a=t*Math.PI*2,n=[Math.cos(a),Math.sin(a),0];return {p:add(s.c,mul(n,s.r)),n};},Math.ceil(2*Math.PI*s.r*scale/0.65),o.outlineWidth*1.4);
    function hatch(axis: Vector,count: number,secondary: boolean): void {
      axis=norm(axis);
      const e=norm(cross(axis,[1,0,0])),f=cross(axis,e),light=lightFor(s);
      const face=atlas?.visible(s);if(atlas&&!face)return;
      const screen=(a:Vector)=>[a[0],-a[1],a[2]],c=project(s.c),radius=s.r*scale;
      const visibleFamily=face?.sphereFamily?.(c,radius,screen(axis),screen(e),screen(f));
      const shadowFamily=o.lightType==='directional'&&atlas&&mayShadow(s)?atlas.shadow(s).sphereFamily?.(c,radius,screen(axis),screen(e),screen(f)):undefined;
      for(let j=1;j<count;j++){
        const h=-1+2*j/count,r=Math.sqrt(1-h*h),limit=secondary?.12:(j%2===0?.88:.58);
        const center=add(s.c,mul(axis,h*s.r)),u=mul(e,r*s.r),v=mul(f,r*s.r);
        const geometry=projectedCircle(project,center,u,v);
        const front=trigSpans(-axis[2]*h,-r*e[2],-r*f[2],1e-12);
        const tonal=tonalSpans(s,geometry,t=>trigSpans(h*dot(axis,lightDirection),r*dot(e,lightDirection),r*dot(f,lightDirection),t),limit,shadowFamily?.(h));
        const spans=tonal.spans?intersectSpans(tonal.spans,front):undefined;
        const clip=()=>{
          let result=visibleFamily?.(h)??(face?geometry.clip(face):null);
          if(result===null)result=boundaries?.clipCircle?boundaries.clipCircle(s,center,u,v):null;
          return result===null?null:intersectSpans(result,front);
        };
        curve(t=>{
          const a=t*Math.PI*2,cos=Math.cos(a),sin=Math.sin(a);
          const n=[axis[0]*h+(e[0]*cos+f[0]*sin)*r,axis[1]*h+(e[1]*cos+f[1]*sin)*r,axis[2]*h+(e[2]*cos+f[2]*sin)*r];
          return {p:[s.c[0]+n[0]*s.r,s.c[1]+n[1]*s.r,s.c[2]+n[2]*s.r],n};
        },Math.max(120,Math.ceil(2*Math.PI*s.r*scale*r/.7)),o.hatchWidth*(secondary?.63:.8),(n,p,lit)=>n[2]>=-1e-12&&lit<limit,true,true,
          clip,{geometry,spans,breaks:tonal.breaks,illumination:light});
      }
    }
    if(o.shadingMode==='hatch'&&o.hatchWidth>0){
      hatch([.12,1,.40],Math.max(2,Math.round(hatchDensity*s.r/.48)),false);
      if(o.crossHatch)hatch([1,.22,-.32],Math.max(2,Math.round(hatchDensity*.8*s.r/.48)),true);
    }
    if(layerPaths)ownerEngraving.set(s,paths.slice(start).join(''));
  }
  for(const s of cylinders){
    const start=paths.length;
    const e=norm(cross(s.u,Math.abs(s.u[2])<.95?[0,0,1]:[0,1,0])),f=cross(s.u,e);
    const line=(n: Vector,w: number,engrave=false)=>{
      const offset=mul(n,s.r),a=add(s.a,offset),b=add(a,mul(s.u,s.length));
      const geometry=projectedLine(project,a,b),face=engrave?atlas?.visible(s):null;
      if(engrave&&atlas&&!face)return;
      const tonal=engrave?tonalSpans(s,geometry,t=>dot(n,lightDirection)<t?[[0,1]]:[],.65):{spans:undefined,breaks:undefined};
      curve(t=>{const d=t*s.length;return {p:[s.a[0]+s.u[0]*d+offset[0],s.a[1]+s.u[1]*d+offset[1],s.a[2]+s.u[2]*d+offset[2]],n};},Math.max(60,Math.ceil(s.length*scale/.7)),w,(normal,p,lit)=>!engrave||lit<.65,engrave,false,
        engrave?()=>face?geometry.clip(face):boundaries?.clipLine?boundaries.clipLine(s,a,b):null:null,
        {geometry,spans:tonal.spans,breaks:tonal.breaks,illumination:lightFor(s),ignoreLighting:!engrave});
    };
    if(Math.hypot(s.u[0],s.u[1])>1e-8){const edge=norm([-s.u[1],s.u[0],0]);line(edge,o.outlineWidth*1.1);line(mul(edge,-1),o.outlineWidth*1.1);}
    const count=Math.max(3,Math.round(hatchDensity*.8*s.r/.115));
    for(let j=0;o.shadingMode==='hatch'&&o.hatchWidth>0&&j<count;j++){
      const a=j/count*2*Math.PI,n=add(mul(e,Math.cos(a)),mul(f,Math.sin(a)));
      if(n[2]>0)line(n,o.hatchWidth*.68,true);
    }
    if(layerPaths)ownerEngraving.set(s,paths.slice(start).join(''));
  }
  let dots='';
  if(o.shadingMode!=='hatch'&&o.dotSize>0){
    const dotter=getDots();
    if(!dotter)throw new Error('Load dots.js before renderer.js');
    const surfaces={
      compactStipple:true,
      emitSurface:layerPaths?(id:number,svg:string)=>{ownerDots.set(id,(ownerDots.get(id)||'')+svg);}:undefined,
      paths:o.shadingMode==='halftone'&&boundaries?.surfacePaths?boundaries.surfacePaths(false):null,
      light:o.lightType==='directional'?lightDirection:undefined,
      illumination:(source:Primitive,n:Vector,p:Vector)=>lightFor(source)(n,p),
      ...(o.shadingMode==='halftone'&&o.lightType==='directional'&&o.castShadows&&o.shadowStrength>0?directionalShadows():{})
    };
    dots=dotter.buildDots(scene,depthAt,project,scale,illumination,o,regions,hatchCoverage(scale,o),surfaces);
  }
  const ownerLabels=new Map<Primitive,string>();
  // If ownership cannot be certified, omit labels rather than float them over
  // unrelated foreground geometry. The underlying scene keeps its fallback.
  if(o.labels&&layerPaths)for(const [id,s] of spheres.entries()){
    if(s.element==='H'&&!o.labelHydrogens)continue;
    const p=add(s.c,[0,0,s.r]);
    if(!layerPaths[id]||!visible(p))continue;
    const [x,y]=project(p);
    ownerLabels.set(s,`<text data-role="element-label" data-surface-id="${id}" x="${x.toFixed(2)}" y="${(y+o.labelSize*.3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${esc(o.labelFont)}" font-style="${o.labelItalic?'italic':'normal'}" font-weight="${o.labelBold?'700':'400'}" stroke="${o.labelStrokeWidth===0?'none':(o.labelMatchFill?fillFor(s.element):o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${esc(s.element)}</text>`);
  }
  const engraving=(body:string)=>`<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  let artwork=`${wash}${fallbackElements}${dots}${engraving(paths.join(''))}<g font-family="Georgia, 'Times New Roman', serif"></g>`;
  if(layerPaths){
    const depth=(s:Primitive)=>s.kind==='sphere'?s.c[2]:s.a[2]+s.u[2]*s.length/2;
    const order=scene.map((s,id)=>({s,id,z:depth(s)})).sort((a,b)=>a.z-b.z||a.id-b.id);
    artwork=dots+order.map(({s,id})=>{
      const outline=layerPaths[id];if(!outline)return '';
      // Opaque paint is essential even with color wash disabled: white atoms
      // and white bonds must naturally cover labels in the rear layers.
      const fill=`<path data-role="surface-fill" fill="${s.kind==='sphere'?fillFor(s.element):'#ffffff'}" stroke="none" fill-rule="evenodd" d="${outline}"/>`;
      const categorical=elements&&s.kind==='sphere'?`<path ${elements.fill(s.element!)} data-surface-id="${id}" fill-rule="evenodd" d="${outline}"/>`:'';
      return `<g data-role="surface-layer" data-surface-id="${id}">${fill}${categorical}${ownerDots.get(id)||''}${engraving(ownerEngraving.get(s)||'')}${ownerLabels.get(s)||''}</g>`;
    }).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title"><title id="title">${esc(molecule.name||'Molecular engraving')}</title>${elements?`<defs>${elements.definitions}</defs>`:''}<rect width="100%" height="100%" fill="white"/>${artwork}</svg>`;
}
