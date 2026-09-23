import type { RenderOptions } from './types.js';
import { colorSchemes } from './palette.js';
import { normalizeOrientation } from './orientation.js';
export type NormalizedOptions = Required<Omit<RenderOptions,'shadingDensity'|'shadingSize'|'orientation'>> & Pick<RenderOptions,'shadingDensity'|'shadingSize'|'orientation'>;
const defaults: NormalizedOptions = {
  renderMode:'precise',
  width:900,height:700,scale:60,atomRadiusScale:.75,yaw:.25,pitch:-.16,lightAzimuth:-29*Math.PI/180,lightElevation:32*Math.PI/180,
  castShadows:false,shadowStrength:.8,density:24,lineWidth:.8,outlineWidth:.8,hatchWidth:.8,
  variableWidth:true,optimizePaths:true,quality:'export',shadingMode:'hatch',hatchMode:'layered',quantizeShading:true,stippleFill:'bitmap',textureScale:1,elementTextures:false,elementTextureScale:1,shadingBrightness:0,shadingContrast:1.2,
  dotSpacing:2.5,dotSize:.5,dotContrast:1.2,crossHatch:true,colorWash:false,colorScheme:'jmol',washStrength:1,
  colorSaturation:1,labelMatchFill:false,labels:false,labelHydrogens:true,labelSize:17,labelStrokeWidth:4,labelStrokeColor:'#ffffff',
  labelColor:'#161616',labelFont:"Georgia, 'Times New Roman', serif",labelBold:false,labelItalic:true
};
export function normalizeOptions(options: RenderOptions): NormalizedOptions {
  // Reject obsolete settings rather than silently rendering a different light.
  for(const key of ['lightType','lightDistance','lightAttenuation'])
    if(options&&Object.hasOwn(options,key))throw new Error('Removed lighting option: '+key+'; only directional lighting is supported');
  const o={...defaults,...options};
  // Fast rendering has its own hatch implementation; an omitted selector must
  // remain usable there, while explicit unsupported combinations still reject.
  if(options.hatchMode===undefined)o.hatchMode=o.renderMode==='fast'?'continuous':defaults.hatchMode;
  if(options.elementTextures===undefined)o.elementTextures=defaults.elementTextures;
  if(options.elementTextureScale===undefined)o.elementTextureScale=defaults.elementTextureScale;
  if(options.orientation!==undefined)o.orientation=normalizeOrientation(options.orientation);
  if(typeof o.labelHydrogens!=='boolean')throw new Error('Invalid labelHydrogens');
  if(typeof o.elementTextures!=='boolean')throw new Error('Invalid elementTextures: expected a boolean');
  if(!Number.isFinite(o.elementTextureScale)||o.elementTextureScale<.5||o.elementTextureScale>3)throw new Error('Invalid elementTextureScale: expected a finite number between 0.5 and 3');
  if(!['preview','export'].includes(o.quality))throw new Error('Invalid quality');
  if(o.quality==='preview')o.optimizePaths=false;
  o.outlineWidth=options.outlineWidth===undefined?o.lineWidth:options.outlineWidth;
  o.hatchWidth=options.hatchWidth===undefined?o.lineWidth:options.hatchWidth;
  for(const [key,min,max] of [['shadingBrightness',-1,1],['textureScale',.2,2.5],['shadingDensity',.4,2.5],['shadingSize',0,1.5],['shadingContrast',.5,2.5]] as const){
    const value=options[key];
    if(value!==undefined&&(!Number.isFinite(value)||value<min||value>max))throw new Error('Invalid option: '+key);
  }
  if(options.shadingDensity!==undefined){o.density=Math.round(24*options.shadingDensity);o.dotSpacing=5/options.shadingDensity;}
  if(options.shadingSize!==undefined){o.hatchWidth=.8*options.shadingSize;o.dotSize=options.shadingSize;}
  // The UI always starts at 1x; each style has its own mark-size calibration.
  const dotStyleScale=o.shadingMode==='stipple' ? .6 : o.shadingMode==='halftone' ? 3 : 1;
  if(options.dotSpacing===undefined&&options.shadingDensity===undefined)o.dotSpacing=2.5*dotStyleScale;
  if(options.dotSize===undefined&&options.shadingSize===undefined)o.dotSize=.5*dotStyleScale;
  if(options.textureScale!==undefined){
    const k=options.textureScale,dotK=k*dotStyleScale,hidden=options.shadingSize===0;
    // Dot area scales as k² while count scales as 1/k²; line width and
    // spacing both scale as k. Preserve tone approximately, not mark count.
    o.density=24/k;
    o.dotSpacing=2.5*dotK;
    o.hatchWidth=hidden?0:.8*k;
    o.dotSize=hidden?0:.5*dotK;
  }
  o.shadingContrast=options.shadingContrast===undefined?1.2:options.shadingContrast;
  if(options.shadingContrast!==undefined)o.dotContrast=o.shadingContrast;
  for(const k of ['dotSpacing','dotSize','dotContrast','outlineWidth','hatchWidth','colorSaturation','width','height','yaw','pitch','lightAzimuth','lightElevation','density','lineWidth','labelSize','labelStrokeWidth','washStrength'] as const)
    if(!(o.orientation!==undefined&&(k==='yaw'||k==='pitch'))&&!Number.isFinite(o[k]))throw new Error('Invalid option: '+k);
  if(!Number.isFinite(o.scale)||o.scale<=0)throw new Error('Invalid scale: expected positive finite SVG units per angstrom');
  if(!Number.isFinite(o.atomRadiusScale)||o.atomRadiusScale<=0)throw new Error('Invalid atomRadiusScale: expected a positive finite multiplier');
  if(typeof o.castShadows!=='boolean')throw new Error('Invalid castShadows');
  if(!Number.isFinite(o.shadowStrength)||o.shadowStrength<0||o.shadowStrength>1)throw new Error('Invalid shadowStrength: expected 0–1');
  if(typeof o.colorScheme!=='string'||!Object.hasOwn(colorSchemes,o.colorScheme))throw new Error('Invalid colorScheme');
  if(!['hatch','stipple','halftone'].includes(o.shadingMode))throw new Error('Invalid shadingMode');
  if(!['continuous','layered'].includes(o.hatchMode))throw new Error('Invalid hatchMode');
  if(options.quantizeShading===undefined)o.quantizeShading=defaults.quantizeShading;
  if(typeof o.quantizeShading!=='boolean')throw new Error('Invalid quantizeShading');
  if(!['marks','bitmap'].includes(o.stippleFill))throw new Error('Invalid stippleFill: expected marks or bitmap');
  if(o.renderMode==='fast'&&options.quantizeShading!==undefined)throw new Error('16-level shading switch requires precise rendering');
  if(o.shadingMode==='hatch'&&o.renderMode!=='fast'){
    const selected=o.quantizeShading?'layered':'continuous';
    if(options.quantizeShading!==undefined){
      if(options.hatchMode!==undefined&&o.hatchMode!==selected)throw new Error('Conflicting quantizeShading and hatchMode');
      o.hatchMode=selected;
    }else o.quantizeShading=o.hatchMode==='layered';
  }
  if(o.renderMode==='fast'&&o.hatchMode==='layered')throw new Error('Layered hatching requires precise rendering');
  if(o.dotSpacing<.3||o.dotSpacing>19||o.dotSize<0||o.dotSize>4||o.dotContrast<.5||o.dotContrast>2.5)throw new Error('Invalid dot settings');
  if(o.width<200||o.height<200||o.lineWidth<0||o.outlineWidth<0||o.hatchWidth<0)throw new Error('Invalid output dimensions or line width');
  if(o.colorSaturation<0||o.colorSaturation>4)throw new Error('colorSaturation must be between 0 and 4');
  if(o.washStrength<0||o.washStrength>1)throw new Error('washStrength must be between 0 and 1');
  if(o.labelSize<6||o.labelSize>96||o.labelStrokeWidth<0||o.labelStrokeWidth>16)throw new Error('Invalid label size or stroke width');
  for(const key of ['labelColor','labelStrokeColor'] as const)
    if(typeof o[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(o[key]))throw new Error('Invalid label color: '+key);
  if(typeof o.labelFont!=='string'||!o.labelFont.trim()||o.labelFont.length>200)throw new Error('Invalid label font');
  if(options.textureScale===undefined)o.density=Math.round(Math.max(8,Math.min(60,o.density)));
  if(!['precise','fast'].includes(o.renderMode))throw new Error('Invalid renderMode');
  if(o.renderMode==='fast'&&o.castShadows)throw new Error('Fast rendering requires castShadows=false');
  return o;
}
