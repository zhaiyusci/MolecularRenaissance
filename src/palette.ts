import type { ColorScheme } from './types.js';
import { ortepPalette, ortepUnknownColor } from './ortep-palette.js';
type Palette = Readonly<Record<string,string>>;
// Source tables and conversion rules: PALETTES.md. No artist-picked replacements.
export const elementPalette: Palette=Object.freeze({H:'#ffffff',C:'#909090',N:'#3050f8',O:'#ff0d0d',P:'#ff8000',S:'#ffff30'});
const rasmol: Palette=Object.freeze({H:'#ffffff',C:'#c8c8c8',N:'#8f8fff',O:'#f00000',P:'#ffa500',S:'#ffc832'});
// PyMOL Color.cpp named element RGB values, rounded to 8-bit RGB.
const rgb=(r:number,g:number,b:number)=>'#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
const pymol: Palette=Object.freeze({H:rgb(.9,.9,.9),C:rgb(.2,1,.2),N:rgb(.2,.2,1),O:rgb(1,.3,.3),P:rgb(1,.501960784,0),S:rgb(.9,.775,.25)});
export const colorSchemes=Object.freeze({
  jmol:elementPalette,
  rasmol,
  pymol,
  ortep:ortepPalette,
  greenCarbon:Object.freeze({...rasmol,C:'#00ff00'}),
  cyanCarbon:Object.freeze({...rasmol,C:'#00ffff'}),
  magentaCarbon:Object.freeze({...rasmol,C:'#ff00ff'})
});
function selectPalette(scheme: ColorScheme): Palette {
  if(!Object.hasOwn(colorSchemes,scheme))throw new Error('Invalid colorScheme');
  return colorSchemes[scheme];
}
export function elementColor(element: string | null | undefined,strength=1,saturation=1,scheme: ColorScheme='jmol'): string {
  const palette=selectPalette(scheme);
  const fallback=scheme==='ortep'?ortepUnknownColor:palette.C;
  return mixColor(element!=null&&Object.hasOwn(palette,element)?palette[element]:fallback,strength,saturation);
}
function mixColor(hex: string,strength: number,saturation: number): string {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(...rgb),min=Math.min(...rgb),lightness=(max+min)/2,chroma=max-min;
  const capacity=1-Math.abs(2*lightness-1);
  const factor=chroma>0?Math.min(capacity,chroma*saturation)/chroma:1;
  return '#'+rgb.map(v=>Math.round(255*(1+((lightness+(v-lightness)*factor)-1)*strength)).toString(16).padStart(2,'0')).join('');
}
