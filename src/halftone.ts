import type { Scene, Project } from './types.js';
import { TONE_LEVELS as LEVELS } from './tone-levels.js';

type Point = [number,number];
type Bounds = [number,number,number,number];
const fmt=(n:number)=>String(Number(n.toFixed(4)));

/** Disk radius / lattice pitch for a desired UNION area (not summed disk area). */
export function halftoneRadiusRatio(coverage:number):number {
  if(coverage<=Math.PI/4)return Math.sqrt(Math.max(0,coverage)/Math.PI);
  if(coverage>=1)return Math.SQRT1_2;
  let lo=.5,hi=Math.SQRT1_2;
  for(let k=0;k<24;k++){
    const r=(lo+hi)/2,r2=r*r;
    const area=Math.PI*r2-4*(r2*Math.acos(.5/r)-.5*Math.sqrt(r2-.25));
    if(area<coverage)lo=r;else hi=r;
  }
  return (lo+hi)/2;
}

/** Exact projected union silhouette, including closed-cylinder caps. All parts
 * in this clipPath are unioned; tone sampling handles front-surface ownership. */
export function projectedSilhouette(scene:Scene,project:Project,scale:number):string {
  const parts:string[]=[];
  for(const s of scene){
    const r=s.r*scale;
    if(s.kind==='sphere'){
      const [x,y]=project(s.c);
      parts.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}"/>`);
      continue;
    }
    const a=project(s.a),b=project(s.a.map((v,i)=>v+s.u[i]*s.length));
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    const vx=length>1e-12?-dy/length:1,vy=length>1e-12?dx/length:0;
    const angle=Math.atan2(vy,vx)*180/Math.PI;
    for(const p of [a,b])parts.push(`<ellipse cx="${fmt(p[0])}" cy="${fmt(p[1])}" rx="${fmt(r)}" ry="${fmt(r*Math.abs(s.u[2]))}" transform="rotate(${fmt(angle)} ${fmt(p[0])} ${fmt(p[1])})"/>`);
    if(length>1e-12){
      const p=[[a[0]+r*vx,a[1]+r*vy],[b[0]+r*vx,b[1]+r*vy],[b[0]-r*vx,b[1]-r*vy],[a[0]-r*vx,a[1]-r*vy]];
      parts.push(`<path d="M${p.map(v=>v.map(fmt).join(' ')).join('L')}Z"/>`);
    }
  }
  return parts.join('');
}

/** Marching-squares contours of a cumulative tone region. Shared grid edges
 * have shared vertices. Evenodd filling preserves holes/disconnected islands. */
function contour(values:Float32Array,nx:number,ny:number,x0:number,y0:number,step:number,threshold:number,refine?: (a:Point,b:Point,threshold:number)=>Point):string {
  const nodes=new Map<number,{p:Point;links:number[]}>();
  const pairs:readonly (readonly (readonly [number,number])[])[]=[
    [],[[0,3]],[[0,1]],[[1,3]],[[1,2]],[],[[0,2]],[[2,3]],
    [[2,3]],[[0,2]],[],[[1,2]],[[1,3]],[[0,1]],[[0,3]],[]
  ];
  for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
    const at=y*nx+x,a=values[at],b=values[at+1],c=values[at+nx+1],d=values[at+nx];
    const code=(a>=threshold?1:0)|(b>=threshold?2:0)|(c>=threshold?4:0)|(d>=threshold?8:0);
    if(code===0||code===15)continue;
    function node(edge:number):number{
      const vertical=edge===1||edge===3;
      const start=at+(edge===1?1:edge===2?nx:0),end=start+(vertical?nx:1);
      const id=2*start+(vertical?1:0);
      if(!nodes.has(id)){
        const t=(threshold-values[start])/(values[end]-values[start]);
        const a:Point=[x0+(start%nx)*step,y0+Math.floor(start/nx)*step];
        const b:Point=[a[0]+(vertical?0:step),a[1]+(vertical?step:0)];
        const p:Point=refine?refine(a,b,threshold):[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        nodes.set(id,{p,links:[]});
      }
      return id;
    }
    let connections=pairs[code];
    if(code===5||code===10){
      const center=(a+b+c+d)/4>=threshold;
      connections=(code===5?center:!center)?[[0,1],[2,3]]:[[0,3],[1,2]];
    }
    for(const [first,last] of connections){
      const u=node(first),v=node(last);
      nodes.get(u)!.links.push(v);nodes.get(v)!.links.push(u);
    }
  }
  const used=new Set<number>(),paths:string[]=[];
  for(const [start] of nodes){
    if(used.has(start))continue;
    const points:Point[]=[];let current=start,previous=-1;
    do{
      if(used.has(current))throw new Error('Open halftone tone contour');
      used.add(current);
      const item=nodes.get(current)!;
      if(item.links.length!==2)throw new Error('Invalid halftone tone topology');
      points.push(item.p);
      const next=item.links[0]===previous?item.links[1]:item.links[0];
      previous=current;current=next;
    }while(current!==start);
    if(points.length<3)continue;
    // Remove exactly collinear grid runs, without fitting across sharp shadows.
    const simple=points.filter((p,i)=>{
      const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
      return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>1e-9;
    });
    if(simple.length>=3)paths.push('M'+simple.map(p=>p.map(fmt).join(' ')).join('L')+'Z');
  }
  return paths.join('');
}

/** Local numerical sampling for custom scalar fields or a BINARY shadow boundary.
 * It never allocates a full-frame ownership/lighting raster. Optional bisection
 * refines hard shadow edges independently of the coarse discovery grid. */
export function sampledTonePaths(bounds:Bounds,sample:(x:number,y:number)=>number|null,step:number,thresholds=Array.from({length:LEVELS},(_,i)=>(i+.5)/LEVELS),refine=false):string[]{
  const [left,top,right,bottom]=bounds;
  if(!(right>left&&bottom>top))return thresholds.map(()=>'');
  step=Math.max(step,Math.sqrt((right-left)*(bottom-top)/120000),(right-left)/120000,(bottom-top)/120000);
  let nx=Math.ceil((right-left)/step)+3,ny=Math.ceil((bottom-top)/step)+3;
  while(nx*ny>130000){step*=1.1;nx=Math.ceil((right-left)/step)+3;ny=Math.ceil((bottom-top)/step)+3;}
  const x0=left-step,y0=top-step,values=new Float32Array(nx*ny);values.fill(-1);
  const valueAt=(x:number,y:number)=>{const v=sample(x,y);return v!==null&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):-1;};
  let maximum=-1;
  for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
    const px=x0+x*step,py=y0+y*step;if(px>right||py>bottom)continue;
    const value=valueAt(px,py);values[y*nx+x]=value;maximum=Math.max(maximum,value);
  }
  const refineEdge=refine?(a:Point,b:Point,threshold:number):Point=>{
    const inside=valueAt(a[0],a[1])>=threshold;let lo=0,hi=1;
    for(let k=0;k<9;k++){
      const t=(lo+hi)/2;
      if((valueAt(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)>=threshold)===inside)lo=t;else hi=t;
    }
    const t=(lo+hi)/2;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }:undefined;
  return thresholds.map(t=>maximum<t?'':contour(values,nx,ny,x0,y0,step,t,refineEdge));
}

export interface SurfacePatternLayer {
  /** Required for per-surface emission; optional for the legacy combined output. */
  sourceId?:number;
  /** Exact visible surface, or empty for a sampled-ownership fallback. */
  clip:string;
  bounds?:Bounds;
  tones:readonly string[];
  shadow?:SurfacePatternLayer;
}

/** Paint precomputed geometric contours with a shared aligned pattern palette. */
export function buildSurfacePatterns(o:{bounds:Bounds;pitch:number;silhouette:string;layers:readonly SurfacePatternLayer[];method:string;shadingLevels?:number},emitSurface?:(id:number,svg:string)=>void):string{
  const LEVELS = o.shadingLevels ?? 16;
  const [left,top,right,bottom]=o.bounds;
  if(!(right>left&&bottom>top))return '';
  const used=new Set<number>();let hash1=2166136261,hash2=5381;
  const hash=(text:string)=>{for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);hash1=Math.imul(hash1^n,16777619);hash2=Math.imul(hash2,33)^n;}};
  hash(o.bounds.join(',')+','+o.pitch+o.silhouette+(LEVELS===16?'':','+LEVELS));
  function collect(layer:SurfacePatternLayer):void{
    hash(layer.clip);
    layer.tones.forEach((path,i)=>{hash(path);if(path&&path!==layer.tones[i+1])used.add(i+1);});
    if(layer.shadow)collect(layer.shadow);
  }
  o.layers.forEach(collect);
  if(!used.size)return '';
  const prefix='mp-screen-'+(hash1>>>0).toString(16)+(hash2>>>0).toString(16);
  const defs=[`<clipPath id="${prefix}-surface" clipPathUnits="userSpaceOnUse">${o.silhouette}</clipPath>`];
  for(const level of [...used].sort((a,b)=>a-b)){
    const ink=level/LEVELS,r=o.pitch*halftoneRadiusRatio(ink),dots:string[]=[],wrap=r>o.pitch/2?1:0;
    for(let y=-wrap;y<=wrap;y++)for(let x=-wrap;x<=wrap;x++)dots.push(`<circle cx="${fmt((x+.5)*o.pitch)}" cy="${fmt((y+.5)*o.pitch)}" r="${fmt(r)}"/>`);
    defs.push(`<pattern id="${prefix}-${level}" data-coverage="${ink}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0" width="${fmt(o.pitch)}" height="${fmt(o.pitch)}" patternTransform="rotate(45)" overflow="hidden"><g fill="#161616" stroke="none">${dots.join('')}</g></pattern>`);
  }
  function clip(id:string,path:string):void{defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" fill-rule="evenodd" d="${path}"/></clipPath>`);}
  function paint(layer:SurfacePatternLayer,index:string):string{
    const [left,top,right,bottom]=layer.bounds||o.bounds;
    let body='';
    layer.tones.forEach((path,i)=>{
      if(!path||path===layer.tones[i+1])return;
      const id=prefix+'-tone-'+index+'-'+i;clip(id,path);
      body+=`<rect data-tone-level="${i+1}" x="${fmt(left)}" y="${fmt(top)}" width="${fmt(right-left)}" height="${fmt(bottom-top)}" fill="url(#${prefix}-${i+1})" clip-path="url(#${id})"/>`;
    });
    if(layer.shadow)body+=paint(layer.shadow,index+'s');
    if(body&&layer.clip){const id=prefix+'-face-'+index;clip(id,layer.clip);body=`<g clip-path="url(#${id})">${body}</g>`;}
    return body;
  }
  if(emitSurface){
    for(const [i,layer] of o.layers.entries()){
      if(layer.sourceId===undefined||!Number.isSafeInteger(layer.sourceId)||layer.sourceId<0)throw new Error('Per-surface patterns require a primitive sourceId');
      const body=paint(layer,String(i));
      emitSurface(layer.sourceId,`<g data-role="dots" data-mode="halftone" data-renderer="pattern" data-tone-method="${o.method}" data-tone-levels="${LEVELS}" stroke="none"><g clip-path="url(#${prefix}-surface)">${body}</g></g>`);
    }
    return `<defs>${defs.join('')}</defs>`;
  }
  const body=o.layers.map((layer,i)=>paint(layer,String(i))).join('');
  return `<g data-role="dots" data-mode="halftone" data-renderer="pattern" data-tone-method="${o.method}" data-tone-levels="${LEVELS}" stroke="none"><defs>${defs.join('')}</defs><g clip-path="url(#${prefix}-surface)">${body}</g></g>`;
}
