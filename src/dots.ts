/* Deterministic, depth-aware SVG stipple and 45-degree halftone screens. */
import type { Scene, Primitive, Vector, DepthAt, Project, Illumination, DotRegions, DotOptions, SurfaceToneContext } from './types';
import { buildSurfacePatterns, sampledTonePaths, projectedSilhouette, halftoneRadiusRatio, type SurfacePatternLayer } from './halftone.js';
import { directionalTonePath } from './surface-tones.js';
import { TONE_LEVELS } from './tone-levels.js';
interface Hit { id: number; s: Primitive; p: Vector; clearance?: number; }
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
function hash(x:number,y:number,salt:number){
  let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(salt,1274126177);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
export function buildDots(scene:Scene,depthAt:DepthAt,project:Project,scale:number,illumination:Illumination,options?:DotOptions,regions:DotRegions|null=null,referenceCoverage?: (s:Primitive,n:Vector,lit:number)=>number,surfaces?:SurfaceToneContext):string{
  const o={shadingMode:'stipple',dotSpacing:2.5,dotSize:.5,dotContrast:1.2,...options};
  if(o.quantizeShading!==undefined&&typeof o.quantizeShading!=='boolean')throw new Error('Invalid quantizeShading');
  const continuousHalftone=o.shadingMode==='halftone'&&o.quantizeShading===false;
  if(!['stipple','halftone'].includes(o.shadingMode))throw new Error('Invalid dot mode');
  if(!Number.isFinite(o.dotSpacing)||o.dotSpacing<.3||o.dotSpacing>19||!Number.isFinite(o.dotSize)||o.dotSize<0||o.dotSize>4||!Number.isFinite(o.dotContrast)||o.dotContrast<.5||o.dotContrast>2.5)throw new Error('Invalid dot settings');
  if(!(scale>0)||!Number.isFinite(scale))throw new Error('Invalid scale');
  if(o.dotSize===0||scene.length===0)return '';
  const origin=project([0,0,0]),g=o.dotSpacing;
  const maxRadius=o.dotSize;
  const fineScale=Math.min(1,o.dotSize),minRadius=.03*fineScale;
  const shapes=scene.map((s,id)=>{
    const a=project(s.kind==='sphere'?s.c:s.a);
    const b=s.kind==='sphere'?a:project(s.a.map((v,i)=>v+s.u[i]*s.length));
    const r=s.r*scale;
    return {s,id,b:[Math.min(a[0],b[0])-r,Math.min(a[1],b[1])-r,Math.max(a[0],b[0])+r,Math.max(a[1],b[1])+r]};
  });
  const minX=Math.min(...shapes.map(s=>s.b[0])),minY=Math.min(...shapes.map(s=>s.b[1]));
  const maxX=Math.max(...shapes.map(s=>s.b[2])),maxY=Math.max(...shapes.map(s=>s.b[3]));
  function hit(x:number,y:number,queryRadius=maxRadius*1.03):Hit|null{
    const wx=(x-origin[0])/scale,wy=(origin[1]-y)/scale;
    if(regions&&(o.shadingMode!=='halftone'||continuousHalftone)){
      // Visibility/occlusion is already solved. The one surface intersection
      // below only reconstructs this known owner's position for its normal.
      const region=regions.query(x,y,queryRadius);if(!region)return null;
      const s=scene[region.id],z=depthAt(s,wx,wy);
      return Number.isFinite(z)?{id:region.id,s,p:[wx,wy,z],clearance:region.clearance}:null;
    }
    let best=-Infinity,item:typeof shapes[number]|null=null;
    for(const shape of shapes){
      const b=shape.b;if(x<b[0]||y<b[1]||x>b[2]||y>b[3])continue;
      const z=depthAt(shape.s,wx,wy);
      if(Number.isFinite(z)&&z>best){best=z;item=shape;}
    }
    return item?{id:item.id,s:item.s,p:[wx,wy,best]}:null;
  }
  function normal(h:Hit){
    const s=h.s,p=h.p;
    if(s.kind==='sphere')return p.map((v,i)=>(v-s.c[i])/s.r);
    const q=p.map((v,i)=>v-s.a[i]),t=q.reduce((sum,v,i)=>sum+v*s.u[i],0);
    if(t<1e-7)return s.u.map(v=>-v);
    if(t>s.length-1e-7)return s.u.slice();
    const radial=q.map((v,i)=>v-t*s.u[i]),length=Math.hypot(...radial);
    return length?radial.map(v=>v/length):[0,0,1];
  }
  // The numerical fallback needs angular resolution at exposed rod-cap corners:
  // a corner can enter a disk between the old 16 rays even after radius padding.
  // Certified regions bypass this sampling entirely; retain the existing safety
  // contraction and tone calibration rather than shrinking every interior dot.
  const dirs=!regions&&(o.shadingMode==='stipple'||continuousHalftone)?Array.from({length:64},(_,i)=>[Math.cos(i*Math.PI/32),Math.sin(i*Math.PI/32)]):[];
  function safeRadius(x:number,y:number,r:number,owner:number){
    // The whole sampled disk must stay on the same visible primitive, not
    // merely its center. Shrink at silhouettes and occlusion boundaries.
    // Two rings are a numerical footprint test, not an exact curve boolean.
    function fits(radius:number){
      for(const k of [.5,1])for(const d of dirs){
        const h=hit(x+d[0]*radius*k,y+d[1]*radius*k);
        if(!h||h.id!==owner)return false;
      }
      return true;
    }
    if(fits(r))return r;
    let lo=0,hi=r;
    for(let i=0;i<9;i++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid;}
    return lo;
  }
  // Normalize the MEAN, never the spatial pattern of the reference hatches.
  // Local tone depends only on smooth illumination, not line direction,
  // projected crowding, or the thresholds that turn hatch families on/off.
  const exponent=referenceCoverage?o.dotContrast/1.2:o.dotContrast;
  const smoothTone=(lit:number)=>Math.pow(clamp((1-lit)/2,0,1),exponent);
  const surfaceIllumination=surfaces?.illumination;
  const lightAt=(h:Hit,n:Vector)=>surfaceIllumination?surfaceIllumination(h.s,n,h.p):illumination(n,h.p);
  let toneGain=1;
  if(referenceCoverage){
    const left=o.width===undefined?minX:Math.max(0,minX),right=o.width===undefined?maxX:Math.min(o.width,maxX);
    const top=o.height===undefined?minY:Math.max(0,minY),bottom=o.height===undefined?maxY:Math.min(o.height,maxY);
    const step=Math.max(2,(right-left)/128,(bottom-top)/128),tones:number[]=[];
    let target=0;
    for(let y=top+.61*step;y<bottom;y+=step)for(let x=left+.37*step;x<right;x+=step){
      const h=hit(x,y);if(!h)continue;
      const n=normal(h),lit=clamp(lightAt(h,n),-1,1);
      tones.push(smoothTone(lit));target+=clamp(referenceCoverage(h.s,n,lit),0,1);
    }
    const total=(gain:number)=>tones.reduce((sum,t)=>sum+Math.min(1,gain*t),0);
    if(target===0)toneGain=0;
    else if(tones.length){
      let lo=0,hi=1;
      while(hi<1048576&&total(hi)<target)hi*=2;
      for(let i=0;i<24;i++){
        const mid=(lo+hi)/2;if(total(mid)<target)lo=mid;else hi=mid;
      }
      toneGain=(lo+hi)/2;
    }
  }
  function coverage(h:Hit):number{
    const lit=clamp(lightAt(h,normal(h)),-1,1);
    return clamp(toneGain*smoothTone(lit),0,1);
  }
  if(continuousHalftone){
    if(toneGain===0)return '';
    const left=o.width===undefined?minX:Math.max(0,minX),right=o.width===undefined?maxX:Math.min(o.width,maxX);
    const top=o.height===undefined?minY:Math.max(0,minY),bottom=o.height===undefined?maxY:Math.min(o.height,maxY);
    if(!(right>left&&bottom>top))return '';
    const pitch=g*Math.SQRT2/5,halfDiagonal=g/5;
    // rotate(45) applied to ((i+.5)*pitch,(j+.5)*pitch) gives
    // (a*g/5,b*g/5), with integer a+b odd. Enumerating screen rows
    // avoids an enormous rotated scene box when a viewport is supplied.
    const a0=Math.ceil(left/halfDiagonal),a1=Math.floor(right/halfDiagonal);
    const b0=Math.ceil(top/halfDiagonal),b1=Math.floor(bottom/halfDiagonal);
    const candidates=Math.ceil((a1-a0+1)/2)*(b1-b0+1);
    if(!Number.isSafeInteger(candidates)||candidates>2000000)throw new Error('Too many halftone marks; increase spacing or reduce output size');
    const circles:string[]=[],owners=new Map<number,string[]>();
    const emitSurface=surfaces?.emitSurface;
    for(let b=b0;b<=b1;b++)for(let a=a0+((a0+b)%2===0?1:0);a<=a1;a+=2){
      const x=a*halfDiagonal,y=b*halfDiagonal,h=hit(x,y,halfDiagonal*1.03);if(!h)continue;
      let radius=pitch*halftoneRadiusRatio(coverage(h));if(!(radius>0))continue;
      const clearance=regions?h.clearance!:safeRadius(x,y,radius*1.03,h.id);
      radius=Math.min(radius,Math.max(0,clearance*Math.cos(Math.PI/16)-.003*fineScale));
      // Keep complete serialized disks within the viewport as well as their
      // owner. Six decimals preserve continuous tone, not a 16-radius palette.
      if(o.width!==undefined)radius=Math.min(radius,x,o.width-x);
      if(o.height!==undefined)radius=Math.min(radius,y,o.height-y);
      radius=Math.floor(Math.max(0,radius-.000001)*1000000)/1000000;
      if(!(radius>0))continue;
      const circle=`<circle cx="${x.toFixed(6)}" cy="${y.toFixed(6)}" r="${radius.toFixed(6)}"/>`;
      if(emitSurface){let target=owners.get(h.id);if(!target){target=[];owners.set(h.id,target);}target.push(circle);}
      else circles.push(circle);
    }
    const wrap=(marks:string[])=>`<g data-role="dots" data-mode="halftone" data-renderer="continuous" fill="#161616" stroke="none">${marks.join('')}</g>`;
    if(emitSurface){for(const [id,marks] of owners)emitSurface(id,wrap(marks));return '';}
    return circles.length?wrap(circles):'';
  }
  if(o.shadingMode==='halftone'){
    if(toneGain===0)return '';
    const bounds:[number,number,number,number]=[
      o.width===undefined?minX:Math.max(0,minX),o.height===undefined?minY:Math.max(0,minY),
      o.width===undefined?maxX:Math.min(o.width,maxX),o.height===undefined?maxY:Math.min(o.height,maxY)
    ];
    const layers:SurfacePatternLayer[]=[];
    const thresholds=Array.from({length:TONE_LEVELS},(_,i)=>(i+.5)/TONE_LEVELS),brightness=o.shadingBrightness??0;
    const step=o.quality==='preview'?2:1;
    for(const {s,id,b} of shapes){
      if(surfaces?.paths&&!surfaces.paths[id])continue;
      const visiblePath=surfaces?.paths?.[id]||'';
      const box:[number,number,number,number]=[Math.max(bounds[0],b[0]),Math.max(bounds[1],b[1]),Math.min(bounds[2],b[2]),Math.min(bounds[3],b[3])];
      // Exact visible paths' Bezier control hulls conservatively bound the
      // local work. Hidden surfaces and hidden parts need no tone sampling.
      if(visiblePath){
        const coords=(visiblePath.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number);
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        for(let i=0;i<coords.length;i+=2){x0=Math.min(x0,coords[i]);x1=Math.max(x1,coords[i]);y0=Math.min(y0,coords[i+1]);y1=Math.max(y1,coords[i+1]);}
        box[0]=Math.max(box[0],x0);box[1]=Math.max(box[1],y0);box[2]=Math.min(box[2],x1);box[3]=Math.min(box[3],y1);
      }
      if(!(box[2]>box[0]&&box[3]>box[1]))continue;
      const onSurface=(x:number,y:number):Hit|null=>{
        if(!visiblePath){const h=hit(x,y);return h?.id===id?h:null;}
        const wx=(x-origin[0])/scale,wy=(origin[1]-y)/scale,z=depthAt(s,wx,wy);
        return Number.isFinite(z)?{id,s,p:[wx,wy,z]}:null;
      };
      if(surfaces?.light&&visiblePath){
        const light=surfaces.light;
        const threshold=(ink:number)=>1-2*Math.pow(ink/toneGain,1/exponent)-2*brightness;
        const layer:SurfacePatternLayer={sourceId:id,clip:visiblePath,bounds:box,tones:thresholds.map(t=>t>toneGain?'':directionalTonePath(s,project,light,threshold(t)))};
        // Only one binary shadow contour is sampled locally. Its shaded tone
        // boundaries remain analytic, with the shadow attenuation inverted.
        if(surfaces.shadowed&&surfaces.mayShadow?.[id]){
          const shadowed=surfaces.shadowed;
          const mask=sampledTonePaths(box,(x,y)=>{const h=onSurface(x,y);return h&&shadowed(id,normal(h),h.p)?1:0;},step,[.5],true)[0];
          if(mask){
            const strength=o.shadowStrength??.8;
            const constant=clamp(toneGain*smoothTone(clamp(-1+2*brightness,-1,1)),0,1);
            layer.shadow={sourceId:id,clip:mask,bounds:box,tones:thresholds.map(t=>{
              if(strength>=1)return constant>=t?visiblePath:'';
              return t>toneGain?'':directionalTonePath(s,project,light,(threshold(t)+1)/(1-strength)-1);
            })};
          }
        }
        layers.push(layer);
      }else{
        // Unsupported visibility arrangements and custom low-level light
        // callbacks stay local to each primitive.
        layers.push({sourceId:id,clip:visiblePath,bounds:box,tones:sampledTonePaths(box,(x,y)=>{const h=onSurface(x,y);return h?coverage(h):null;},step)});
      }
    }
    return buildSurfacePatterns({bounds,pitch:g*Math.SQRT2/5,silhouette:projectedSilhouette(scene,project,scale),layers,
      method:surfaces?.paths?(surfaces.light?(surfaces.shadowed?'analytic-local-shadows':'analytic'):'surface-sampled'):'local-fallback'},surfaces?.emitSurface);
  }
  const circles:string[]=[],batches=surfaces?.compactStipple?new Map<number,string[]>():null;
  const emitSurface=surfaces?.emitSurface;
  const owners=new Map<number,{circles:string[];batches:Map<number,string[]>|null}>();
  let markCount=0;
  function emit(x:number,y:number,certifiedCell=false,cellOwner=-1){
    if(x<minX||y<minY||x>maxX||y>maxY)return;
    const h=certifiedCell?null:hit(x,y);if(!certifiedCell&&!h)return;
    let radius=o.dotSize;
    if(radius<minRadius)return;
    // Contract only near actual boundaries, not every interior mark: a global
    // radius contraction would silently reduce the calibrated coverage.
    const clearance=certifiedCell?maxRadius*1.03:regions?h!.clearance!:safeRadius(x,y,radius*1.03,h!.id);
    radius=Math.floor(Math.min(radius,Math.max(0,clearance*Math.cos(Math.PI/16)-.003*fineScale))*1000)/1000;
    if(radius<minRadius)return;
    markCount++;
    let targetCircles=circles,targetBatches=batches;
    if(emitSurface){
      const owner=certifiedCell?cellOwner:h!.id;
      let target=owners.get(owner);
      if(!target){target={circles:[],batches:batches?new Map<number,string[]>():null};owners.set(owner,target);}
      targetCircles=target.circles;targetBatches=target.batches;
    }
    if(targetBatches){
      let batch=targetBatches.get(radius);if(!batch){batch=[];targetBatches.set(radius,batch);}
      batch.push(`M${x.toFixed(3)} ${y.toFixed(3)}h0`);
    }else targetCircles.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${radius.toFixed(3)}"/>`);
  }
  if(o.shadingMode==='stipple'&&toneGain>0){
    // Certify a whole candidate cell plus its largest disk once. Interior
    // Poisson marks then need neither owner/depth nor boundary-distance queries.
    const cellRadius=Math.SQRT1_2*g+maxRadius*1.03;
    const i0=Math.floor(minX/g)-1,i1=Math.ceil(maxX/g)+1,j0=Math.floor(minY/g)-1,j1=Math.ceil(maxY/g)+1;
    if((i1-i0+1)*(j1-j0+1)>1000000)throw new Error('Dot screen too large; increase spacing or reduce output size');
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const h=hit((i+.5)*g,(j+.5)*g,regions?cellRadius:maxRadius*1.03);if(!h)continue;
      const certifiedCell=!!regions&&h.clearance!>=cellRadius-1e-12;
      // Equal-radius Poisson marks. Account for overlap using
      // coverage = 1-exp(-numberDensity * diskArea), rather than adding areas.
      const ink=Math.min(.995,coverage(h));if(ink<=0)continue;
      const mean=-Math.log1p(-ink)*g*g/(Math.PI*o.dotSize*o.dotSize);
      if(mean>1000)throw new Error('Stipple density too high; increase dot size');
      const stop=Math.exp(-mean);let product=1,count=0;
      while((product*=1-hash(i,j,100+count))>stop)count++;
      for(let k=0;k<count;k++){
        emit((i+hash(i,j,10000+2*k))*g,(j+hash(i,j,10001+2*k))*g,certifiedCell,h.id);
        if(markCount>1000000)throw new Error('Too many stipple marks; use a coarser texture');
      }
    }
  }
  // SVG round caps on zero-length subpaths are exact disks. This batches
  // serialization/DOM nodes, not positions: there is no tile or repeated motif.
  if(emitSurface){
    for(const [id,target] of owners){
      if(target.batches)for(const [r,points] of target.batches)target.circles.push(`<path data-stipple-radius="${r.toFixed(3)}" fill="none" stroke="#161616" stroke-width="${(2*r).toFixed(3)}" stroke-linecap="round" d="${points.join('')}"/>`);
      emitSurface(id,`<g data-role="dots" data-mode="stipple" fill="#161616" stroke="none">${target.circles.join('')}</g>`);
    }
    return '';
  }
  if(batches)for(const [r,points] of batches)circles.push(`<path data-stipple-radius="${r.toFixed(3)}" fill="none" stroke="#161616" stroke-width="${(2*r).toFixed(3)}" stroke-linecap="round" d="${points.join('')}"/>`);
  return `<g data-role="dots" data-mode="${o.shadingMode}" fill="#161616" stroke="none">${circles.join('')}</g>`;
}
