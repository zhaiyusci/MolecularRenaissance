import type { Vector, Project, Illumination, Intervals } from './types.js';
import type { NormalizedOptions } from './options.js';
import { getWash } from './runtime.js';
import { rounded3 } from './svg-number.js';
import { intersectSpans, type ProjectedCurve } from './hatch-curves.js';

export function engravingWidth(base: number,illumination: number): number {
  const darkness=(1-Math.max(-1,Math.min(1,illumination)))/2;
  return base*(.4+1.15*darkness);
}
interface StrokeContext {
  options: NormalizedOptions; project: Project; illumination: Illumination;
  visible: (p: Vector)=>boolean;
  paths: string[];
}
interface CurvePoint { p: Vector; n: Vector; xy?: Vector; }
interface Sample { xy: Vector; lit: number; index: number; distance?:number; }
export interface CurveHints {
  geometry?:ProjectedCurve;
  /** Exact front/tonal spans for unshadowed directional light. */
  spans?:Intervals;
  /** Interior shadow boundaries force refinement without inventing tapered tips. */
  breaks?:readonly number[];
  illumination?:Illumination;
  /** Outline acceptance does not depend on illumination. */
  ignoreLighting?:boolean;
}

/** Sample lighting/width only within known visible spans; emit strokes or ribbons. */
export function createCurveRenderer(context: StrokeContext) {
  const {options:o,project,illumination,visible,paths}=context;
  const fitter=o.optimizePaths?getWash():null;
  if(o.optimizePaths&&(!fitter||typeof fitter.fitContour!=='function'))throw new Error('Load updated wash.js before renderer.js');
  const rounded=rounded3;
  const coord=(p: Vector)=>p.map(rounded).join(' ');
  function compactPath(points: Vector[],tolerance=.015): string {
    const a=points[0],b=points.at(-1)!,dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
    if(length2>1e-12&&points.every(p=>{
      const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2;
      return t>=-1e-9&&t<=1+1e-9&&Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))<=1e-6*Math.sqrt(length2);
    }))return 'M'+coord(a)+'L'+coord(b);
    let curves: Vector[][];
    if(length2<1e-10&&points.length>3){
      let far=1,distance=-1;
      for(let i=1;i<points.length-1;i++){
        const d=(points[i][0]-a[0])**2+(points[i][1]-a[1])**2;
        if(d>distance){distance=d;far=i;}
      }
      curves=fitter!.fitContour(points.slice(0,far+1),tolerance).concat(fitter!.fitContour(points.slice(far),tolerance));
    }else curves=fitter!.fitContour(points,tolerance);
    return 'M'+coord(a)+curves.map(c=>c.length===2?'L'+coord(c[1]):'C'+c.slice(1).map(coord).join(' ')).join('');
  }
  return function curve(
    fn: (t: number)=>CurvePoint,steps: number,width: number,
    accept: (n: Vector,p: Vector,lit: number)=>boolean=()=>true,
    engrave=false,closed=false,clip: (()=>Intervals|null)|null=null,hints:CurveHints={}
  ): void {
    if(width===0||(engrave&&o.shadingMode!=='hatch')||hints.spans?.length===0)return;
    let run: Sample[]=[];
    const runs: Sample[][]=[];
    const flush=()=>{if(run.length>1)runs.push(run);run=[];};
    function evaluate(t:number){
      const {p,n,xy}=fn(t);
      let lit=hints.ignoreLighting?0:(hints.illumination||illumination)(n,p);
      if(engrave&&o.shadingContrast!==1.2){
        const darkness=(1-Math.max(-1,Math.min(1,lit)))/2;
        lit=1-2*Math.pow(darkness,o.shadingContrast/1.2);
      }
      return {p,n,lit,xy:xy??(hints.geometry?hints.geometry.point(t):project(p)),index:t*steps};
    }
    function sample(t:number,knownVisible:boolean):void{
      const value=evaluate(t);
      if(accept(value.n,value.p,value.lit)&&(knownVisible||visible(value.p)))run.push(value);else flush();
    }
    const visibleSpans=clip?clip():null;
    const spans=hints.spans?intersectSpans(hints.spans,visibleSpans||[[0,1]]):visibleSpans;
    if(spans!==null){
      for(const [a,b] of spans){
        if(hints.spans&&visibleSpans!==null&&hints.geometry){
          if(!o.variableWidth){
            run.push(evaluate(a),evaluate(b));flush();continue;
          }
          // Known topology and smooth directional lighting: refine geometry
          // and width error, rather than stepping every ~0.7 screen units.
          const tolerance=Math.min(.02,width*.025);
          function refine(lo:Sample,hi:Sample,depth:number):void{
            const t=(lo.index+hi.index)/(2*steps),mid=evaluate(t);
            const error=Math.hypot(mid.xy[0]-(lo.xy[0]+hi.xy[0])/2,mid.xy[1]-(lo.xy[1]+hi.xy[1])/2);
            const widthError=width*.575*Math.abs(mid.lit-(lo.lit+hi.lit)/2);
            if(depth<16&&((hi.index-lo.index)/steps>1/8||error>tolerance||widthError>tolerance)){
              refine(lo,mid,depth+1);refine(mid,hi,depth+1);
            }else run.push(hi);
          }
          const cuts=[a,...(hints.breaks||[]).filter(t=>t>a+1e-10&&t<b-1e-10),b].sort((x,y)=>x-y);
          for(let i=1;i<cuts.length;i++){
            const lo=cuts[i-1],hi=cuts[i];if(hi<=lo)continue;
            const epsilon=Math.min(1e-8,(hi-lo)*.0001);
            const first=evaluate(lo),last=evaluate(hi);
            // Keep both one-sided widths at a shadow edge. It is a width
            // jump, not a new stroke end; only real accepted-span ends taper.
            first.lit=evaluate(lo+epsilon).lit;last.lit=evaluate(hi-epsilon).lit;
            run.push(first);refine(first,last,0);
          }
          flush();
        }else{
          sample(a,visibleSpans!==null);
          const first=Math.floor(a*steps)+1,last=Math.ceil(b*steps)-1;
          if(first>last)sample((a+b)/2,visibleSpans!==null);
          else for(let i=first;i<=last;i++)sample(i/steps,visibleSpans!==null);
          sample(b,visibleSpans!==null);flush();
        }
      }
    }else{
      // Unknown topology / shadow changes retain the original discovery grid.
      for(let i=0;i<=steps;i++)sample(i/steps,false);
      flush();
    }
    // Join periodic seams without adding a tapered tip.
    if(closed&&runs.length>1&&runs[0][0].index===0&&runs.at(-1)!.at(-1)!.index===steps){
      const last=runs.pop()!;runs[0]=last.concat(runs[0].slice(1).map(p=>({...p,index:p.index+steps})));
    }
    for(const points of runs){
      if(!engrave||!o.variableWidth){
        const d=hints.geometry?hints.geometry.path(points[0].index/steps,points.at(-1)!.index/steps):o.optimizePaths?compactPath(points.map(q=>q.xy)):points.map(({xy:p},i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join('');
        paths.push(`<path stroke-width="${width.toFixed(3)}" d="${d}"/>`);
        continue;
      }
      let clean=points.filter((q,i)=>i===0||Math.hypot(q.xy[0]-points[i-1].xy[0],q.xy[1]-points[i-1].xy[1])>1e-6||Math.abs(q.lit-points[i-1].lit)>1e-8);
      if(clean.length<2)continue;
      const loop=closed&&Math.abs(clean.at(-1)!.index-clean[0].index-steps)<1e-8;
      const distances=[0];
      for(let i=1;i<clean.length;i++)distances.push(distances[i-1]+Math.hypot(clean[i].xy[0]-clean[i-1].xy[0],clean[i].xy[1]-clean[i-1].xy[1]));
      const total=distances.at(-1)!,tipLength=Math.min(5,total*.25),left: Vector[]=[],right: Vector[]=[];
      for(let i=0;i<clean.length;i++)clean[i].distance=distances[i];
      if(hints.geometry){
        if(hints.spans&&visibleSpans!==null&&!loop){
          // Smoothstep tips need their own samples even along a straight line.
          const extra:Sample[]=[];
          for(const end of [false,true])for(let k=1;k<=8;k++){
            const d=end?total-tipLength*k/8:tipLength*k/8;
            let i=1;while(i<distances.length-1&&distances[i]<d)i++;
            const span=distances[i]-distances[i-1],f=span?(d-distances[i-1])/span:0;
            const point:Sample=evaluate((clean[i-1].index+(clean[i].index-clean[i-1].index)*f)/steps);
            point.distance=d;extra.push(point);
          }
          clean=clean.concat(extra).sort((a,b)=>a.index-b.index).filter((p,i,a)=>!i||p.index-a[i-1].index>1e-10||Math.abs(p.lit-a[i-1].lit)>1e-8);
        }else{
          // Unknown visibility/lighting discovery stays dense for correctness; simplify
          // only after topology and the original sampled width changes are known.
          const keep=new Uint8Array(clean.length),tolerance=Math.min(.02,width*.025),stack:[number,number][]=[];
          keep[0]=keep[clean.length-1]=1;let start=0;
          for(let i=1;i<clean.length;i++)if(i===clean.length-1||(!loop&&(clean[i].distance!<=tipLength||total-clean[i].distance!<=tipLength))){keep[i]=1;stack.push([start,i]);start=i;}
          while(stack.length){
            const [a,b]=stack.pop()!;if(b-a<2)continue;
            const p=clean[a],q=clean[b],dx=q.xy[0]-p.xy[0],dy=q.xy[1]-p.xy[1],length2=dx*dx+dy*dy;
            let worst=1,at=-1;
            for(let i=a+1;i<b;i++){
              const v=clean[i],t=length2?Math.max(0,Math.min(1,((v.xy[0]-p.xy[0])*dx+(v.xy[1]-p.xy[1])*dy)/length2)):(v.index-p.index)/(q.index-p.index);
              const geometry=Math.hypot(v.xy[0]-p.xy[0]-t*dx,v.xy[1]-p.xy[1]-t*dy);
              const lighting=width*.575*Math.abs(v.lit-p.lit-(q.lit-p.lit)*t),error=Math.max(geometry,lighting)/tolerance;
              if(error>worst){worst=error;at=i;}
            }
            if(at>=0){keep[at]=1;stack.push([a,at],[at,b]);}
          }
          clean=clean.filter((_,i)=>keep[i]);
        }
      }
      // Fill both ribbon sides in final serialization order, then join once.
      // This avoids both temporary coordinate arrays and a deep string rope.
      const ribbonText=o.optimizePaths?null:new Array<string>(clean.length*2);
      for(let i=0;i<clean.length;i++){
        const p=clean[i].xy;
        const tangent=hints.geometry?.tangent(clean[i].index/steps);
        const tangentLength=tangent?Math.hypot(tangent[0],tangent[1]):0;
        let dx:number,dy:number,length:number;
        if(tangent&&tangentLength>1e-9){dx=tangent[0];dy=tangent[1];length=tangentLength;}
        else{
          const prev=clean[i===0?(loop?clean.length-2:0):i-1].xy;
          const next=clean[i===clean.length-1?(loop?1:i):i+1].xy;
          dx=next[0]-prev[0];dy=next[1]-prev[1];length=Math.hypot(dx,dy)||1;
        }
        const distance=clean[i].distance!;
        const t=loop?1:Math.min(1,distance/tipLength,(total-distance)/tipLength);
        const taper=t*t*(3-2*t),half=engravingWidth(width,clean[i].lit)*taper/2;
        const offsetX=dy/length*half,offsetY=dx/length*half;
        if(o.optimizePaths){left.push([p[0]-offsetX,p[1]+offsetY]);right.push([p[0]+offsetX,p[1]-offsetY]);}
        else{
          ribbonText![i]=(i?'L':'M')+rounded(p[0]-offsetX)+' '+rounded(p[1]+offsetY);
          ribbonText![clean.length*2-1-i]='L'+rounded(p[0]+offsetX)+' '+rounded(p[1]-offsetY);
        }
      }
      let d: string;
      if(o.optimizePaths){
        right.reverse();
        const tolerance=Math.min(.015,width*.025);
        d=compactPath(left,tolerance)+compactPath(right,tolerance).replace(/^M/,'L')+'Z';
      }else d=ribbonText!.join('')+'Z';
      paths.push(`<path fill="#161616" stroke="none" d="${d}"/>`);
    }
  };
}
