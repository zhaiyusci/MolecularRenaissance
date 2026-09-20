import type { Primitive, DotRegions, SurfaceRegion, Illumination, Vector } from './types.js';
import { depthAt, type PreparedScene } from './scene.js';
import type { NormalizedOptions } from './options.js';
import { sampledTonePaths } from './halftone.js';
import { regionFromPath } from './region-clipping.js';

/** One visible-region index and one lazily extracted binary shadow per surface.
 * Discovery is local and resolution-limited; no ray tracing in subsequent
 * texture queries. Shadows retain the halftone backend's 2/1 SVG-unit grid. */
export function createSurfaceAtlas(prepared:PreparedScene,regions:DotRegions,o:NormalizedOptions){
  const {scene,project,scale,unshadowedIllumination}=prepared,origin=project([0,0,0]);
  const ids=new Map(scene.map((s,i)=>[s,i])),empty=regionFromPath('');
  const shadowCache=new Map<Primitive,SurfaceRegion>(),lightCache=new Map<Primitive,Illumination>();
  const stats={shadowBuilds:0,shadowSamples:0};
  const visible=(s:Primitive)=>{const id=ids.get(s);return id===undefined?null:regions.surface?.(id)||null;};
  function shadow(s:Primitive):SurfaceRegion{
    const cached=shadowCache.get(s);if(cached)return cached;
    const face=visible(s);
    if(!face||!prepared.mayShadow(s)){shadowCache.set(s,empty);return empty;}
    const b=face.bounds,bounds:[number,number,number,number]=[Math.max(-8,b[0]),Math.max(-8,b[1]),Math.min(o.width+8,b[2]),Math.min(o.height+8,b[3])];
    const physical=prepared.lightingFor(s);
    const directional=o.lightType==='directional'?prepared.directionalShadows():null,id=ids.get(s)!;
    const sample=(x:number,y:number):number=>{
      stats.shadowSamples++;
      const wx=(x-origin[0])/scale,wy=(origin[1]-y)/scale,z=depthAt(s,wx,wy);
      if(!Number.isFinite(z))return 0;
      const p=[wx,wy,z];let n:Vector;
      if(s.kind==='sphere')n=p.map((v,i)=>(v-s.c[i])/s.r);
      else{
        const q=p.map((v,i)=>v-s.a[i]),t=q.reduce((a,v,i)=>a+v*s.u[i],0);
        if(t<1e-7)n=s.u.map(v=>-v);
        else if(t>s.length-1e-7)n=s.u.slice();
        else{const r=q.map((v,i)=>v-t*s.u[i]),length=Math.hypot(...r);n=length?r.map(v=>v/length):[0,0,1];}
      }
      return directional?(directional.shadowed(id,n,p)?1:0):(physical(n,p)<unshadowedIllumination(n,p)?1:0);
    };
    const path=sampledTonePaths(bounds,sample,o.quality==='preview'?2:1,[.5],true)[0];
    const result=regionFromPath(path);shadowCache.set(s,result);stats.shadowBuilds++;return result;
  }
  function lightingFor(s:Primitive):Illumination{
    const cached=lightCache.get(s);if(cached)return cached;
    if(!prepared.mayShadow(s)){lightCache.set(s,unshadowedIllumination);return unshadowedIllumination;}
    const region=shadow(s);
    const light:Illumination=(n,p)=>{
      let lit=unshadowedIllumination(n,p);
      const xy=project(p);
      if(region.contains(xy[0],xy[1]))lit=(Math.max(-1,Math.min(1,lit))+1)*(1-o.shadowStrength)-1;
      return lit;
    };
    lightCache.set(s,light);return light;
  }
  return {visible,shadow,lightingFor,stats};
}
