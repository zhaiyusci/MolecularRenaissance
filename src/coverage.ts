import type { Primitive, Vector } from './types.js';
import type { NormalizedOptions } from './options.js';

/** Expected projected hatch coverage, not a second illumination model.
 * Ignores individual stroke phase/taper and estimates crossings as independent.
 * Use its spatial average to calibrate smooth dot lighting, never its local
 * pattern as a lighting field. Small surfaces and silhouettes can still differ.
 */
export function hatchCoverage(scale: number,o: NormalizedOptions) {
  const unit=(v:number[])=>{const d=Math.hypot(...v);return v.map(x=>x/d);};
  const primary=unit([.12,1,.40]),secondary=unit([1,.22,-.32]);
  const density=o.density*scale/60;
  const cap=(x:number)=>Math.max(0,Math.min(1,x));
  return (s:Primitive,n:Vector,light:number):number=>{
    const darkness=Math.pow(cap((1-light)/2),o.shadingContrast/1.2);
    const lit=1-2*darkness;
    const widthFactor=o.variableWidth ? .4+1.15*darkness : 1;
    const nz=Math.max(1e-4,Math.abs(n[2]));
    if(s.kind==='sphere'){
      const family=(axis:number[],count:number,width:number,active:number)=>{
        const gradient=Math.hypot(axis[0]-axis[2]*n[0]/nz,axis[1]-axis[2]*n[1]/nz)/(s.r*scale);
        return cap(width*widthFactor*count*.5*gradient*active);
      };
      const count=Math.max(2,Math.round(density*s.r/.48));
      const even=Math.floor((count-1)/2)/(count-1);
      const active=(lit<.88?even:0)+(lit<.58?1-even:0);
      const a=family(primary,count,o.hatchWidth*.8,active);
      const b=o.crossHatch?family(secondary,Math.max(2,Math.round(density*.8*s.r/.48)),o.hatchWidth*.63,lit<.12?1:0):0;
      return 1-(1-a)*(1-b);
    }
    // Axial hatches do not cover the cylinder end caps.
    if(Math.abs(n.reduce((sum,v,i)=>sum+v*s.u[i],0))>.99||lit>=.65)return 0;
    const count=Math.max(3,Math.round(density*.8*s.r/.115));
    const projectedAxis=Math.sqrt(Math.max(0,1-s.u[2]*s.u[2]));
    return cap(o.hatchWidth*.68*widthFactor*count*projectedAxis/(2*Math.PI*s.r*scale*nz));
  };
}
