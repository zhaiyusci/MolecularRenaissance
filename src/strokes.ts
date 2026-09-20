import type { Vector, Project, Illumination, Intervals } from './types.js';
import type { NormalizedOptions } from './options.js';
import { getWash } from './runtime.js';

export function engravingWidth(base: number,illumination: number): number {
  const darkness=(1-Math.max(-1,Math.min(1,illumination)))/2;
  return base*(.4+1.15*darkness);
}
interface StrokeContext {
  options: NormalizedOptions; project: Project; illumination: Illumination;
  visible: (p: Vector)=>boolean;
  paths: string[];
}
interface CurvePoint { p: Vector; n: Vector; }
interface Sample { xy: Vector; lit: number; index: number; }

/** Sample lighting/width only within known visible spans; emit strokes or ribbons. */
export function createCurveRenderer(context: StrokeContext) {
  const {options:o,project,illumination,visible,paths}=context;
  const fitter=o.optimizePaths?getWash():null;
  if(o.optimizePaths&&(!fitter||typeof fitter.fitContour!=='function'))throw new Error('Load updated wash.js before renderer.js');
  const coord=(p: Vector)=>p.map(v=>String(Number(v.toFixed(3)))).join(' ');
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
    engrave=false,closed=false,clip: (()=>Intervals|null)|null=null
  ): void {
    if(width===0||(engrave&&o.shadingMode!=='hatch'))return;
    let run: Sample[]=[];
    const runs: Sample[][]=[];
    const flush=()=>{if(run.length>1)runs.push(run);run=[];};
    function sample(t: number,index: number,knownVisible: boolean): void {
      const {p,n}=fn(t);
      let lit=illumination(n,p);
      if(engrave&&o.shadingContrast!==1.2){
        const darkness=(1-Math.max(-1,Math.min(1,lit)))/2;
        lit=1-2*Math.pow(darkness,o.shadingContrast/1.2);
      }
      if(accept(n,p,lit)&&(knownVisible||visible(p)))run.push({xy:project(p),lit,index});else flush();
    }
    const spans=clip?clip():null;
    if(spans!==null){
      for(const [a,b] of spans){
        sample(a,a*steps,true);
        const first=Math.floor(a*steps)+1,last=Math.ceil(b*steps)-1;
        if(first>last)sample((a+b)/2,(a+b)*steps/2,true);
        else for(let i=first;i<=last;i++)sample(i/steps,i,true);
        sample(b,b*steps,true);flush();
      }
    }else{
      for(let i=0;i<=steps;i++)sample(i/steps,i,false);
      flush();
    }
    // Join periodic seams without adding a tapered tip.
    if(closed&&runs.length>1&&runs[0][0].index===0&&runs.at(-1)!.at(-1)!.index===steps){
      const last=runs.pop()!;runs[0]=last.concat(runs[0].slice(1));
    }
    for(const points of runs){
      if(!engrave||!o.variableWidth){
        const d=o.optimizePaths?compactPath(points.map(q=>q.xy)):points.map(({xy:p},i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join('');
        paths.push(`<path stroke-width="${width.toFixed(3)}" d="${d}"/>`);
        continue;
      }
      const clean=points.filter((q,i)=>i===0||Math.hypot(q.xy[0]-points[i-1].xy[0],q.xy[1]-points[i-1].xy[1])>1e-6);
      if(clean.length<2)continue;
      const loop=closed&&clean[0].index===0&&clean.at(-1)!.index===steps;
      const distances=[0];
      for(let i=1;i<clean.length;i++)distances.push(distances[i-1]+Math.hypot(clean[i].xy[0]-clean[i-1].xy[0],clean[i].xy[1]-clean[i-1].xy[1]));
      const total=distances.at(-1)!,tipLength=Math.min(5,total*.25),left: Vector[]=[],right: Vector[]=[];
      for(let i=0;i<clean.length;i++){
        const p=clean[i].xy;
        const prev=clean[i===0?(loop?clean.length-2:0):i-1].xy;
        const next=clean[i===clean.length-1?(loop?1:i):i+1].xy;
        const dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1;
        const t=loop?1:Math.min(1,distances[i]/tipLength,(total-distances[i])/tipLength);
        const taper=t*t*(3-2*t),half=engravingWidth(width,clean[i].lit)*taper/2;
        left.push([p[0]-dy/length*half,p[1]+dx/length*half]);
        right.push([p[0]+dy/length*half,p[1]-dx/length*half]);
      }
      right.reverse();
      let d: string;
      if(o.optimizePaths){
        const tolerance=Math.min(.015,width*.025);
        d=compactPath(left,tolerance)+compactPath(right,tolerance).replace(/^M/,'L')+'Z';
      }else{
        const outline=left.concat(right);
        d=outline.map((p,i)=>(i?'L':'M')+p[0].toFixed(3)+' '+p[1].toFixed(3)).join('')+'Z';
      }
      paths.push(`<path fill="#161616" stroke="none" d="${d}"/>`);
    }
  };
}
