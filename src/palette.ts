export const elementPalette: Readonly<Record<string,string>>=Object.freeze({C:'#ded8cf',H:'#ffffff',O:'#eab5ac',N:'#b8ccdf',S:'#ead99e',P:'#ebc39f'});
export const elementInkPalette: Readonly<Record<string,string>>=Object.freeze({C:'#79451d',H:'#555555',O:'#972b25',N:'#245889',S:'#886219',P:'#a24b21'});
export function elementColor(element: string | null | undefined,strength=.65,saturation=1): string {
  return mixColor(element!=null&&Object.hasOwn(elementPalette,element)?elementPalette[element]:'#ded8cf',strength,saturation);
}
export function elementInkColor(element: string | null | undefined,strength=.65,saturation=1): string {
  return mixColor(element!=null&&Object.hasOwn(elementInkPalette,element)?elementInkPalette[element]:'#555555',strength,saturation);
}
function mixColor(hex: string,strength: number,saturation: number): string {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(...rgb),min=Math.min(...rgb),lightness=(max+min)/2,chroma=max-min;
  const capacity=1-Math.abs(2*lightness-1);
  const factor=chroma>0?Math.min(capacity,chroma*saturation)/chroma:1;
  return '#'+rgb.map(v=>Math.round(255*(1+((lightness+(v-lightness)*factor)-1)*strength)).toString(16).padStart(2,'0')).join('');
}
