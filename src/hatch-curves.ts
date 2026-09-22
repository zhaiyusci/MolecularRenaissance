import type { Vector, Project, Intervals, SurfaceRegion } from './types.js';
const TAU=2*Math.PI;
const fmt=(p:Vector)=>p.slice(0,2).map(v=>String(Number(v.toFixed(4)))).join(' ');

/** Intervals in normalized circle parameter where k+a*cos+b*sin < limit. */
export function trigSpans(k:number,a:number,b:number,limit:number):Intervals{
  const radius=Math.hypot(a,b),cuts=[0,1];
  if(radius===0)return k<limit?[[0,1]]:[];
  if(limit<=k-radius)return [];
  if(limit>=k+radius)return [[0,1]];
  if(Math.abs(limit-k)<radius){
    const phase=Math.atan2(b,a),delta=Math.acos((limit-k)/radius);
    for(const t of [phase-delta,phase+delta])cuts.push(((t/TAU)%1+1)%1);
  }
  cuts.sort((x,y)=>x-y);
  const result:Intervals=[];
  for(let i=1;i<cuts.length;i++){
    const x=cuts[i-1],y=cuts[i],t=(x+y)/2*TAU;
    if(y>x&&k+a*Math.cos(t)+b*Math.sin(t)<limit)result.push([x,y]);
  }
  return result;
}
export function intersectSpans(a:Intervals,b:Intervals):Intervals{
  const result:Intervals=[];let i=0,j=0;
  while(i<a.length&&j<b.length){
    const lo=Math.max(a[i][0],b[j][0]),hi=Math.min(a[i][1],b[j][1]);
    if(hi>lo+1e-12)result.push([lo,hi]);
    if(a[i][1]<b[j][1])i++;else j++;
  }
  return result;
}
export function unionSpans(...sets:Intervals[]):Intervals{
  const result:Intervals=[];
  for(const [a,b] of sets.flat().sort((x,y)=>x[0]-y[0])){
    const last=result.at(-1);
    if(last&&a<=last[1]+1e-12)last[1]=Math.max(last[1],b);else result.push([a,b]);
  }
  return result;
}
export function complementSpans(spans:Intervals):Intervals{
  const result:Intervals=[];let end=0;
  for(const [a,b] of spans){if(a>end)result.push([end,a]);end=Math.max(end,b);}
  if(end<1)result.push([end,1]);return result;
}
export interface ProjectedCurve {
  clip(region:SurfaceRegion):Intervals|null;
  point(t:number):Vector;
  tangent(t:number):Vector;
  path(a:number,b:number):string;
}
/** A projected circle stays an ellipse; do not sample and refit its centerline. */
export function projectedCircle(project:Project,center:Vector,u:Vector,v:Vector):ProjectedCurve & {pointFromTrig(cos:number,sin:number):Vector}{
  const c=project(center),pu=project(center.map((x,i)=>x+u[i])),pv=project(center.map((x,i)=>x+v[i]));
  const U=pu.map((x,i)=>x-c[i]),V=pv.map((x,i)=>x-c[i]);
  // Share trig with the world-space sample without replacing this projected
  // expression by project(p): the latter changes floating-point grouping.
  const pointFromTrig=(cos:number,sin:number):Vector=>c.length===2?
    [c[0]+U[0]*cos+V[0]*sin,c[1]+U[1]*cos+V[1]*sin]:c.map((x,i)=>x+U[i]*cos+V[i]*sin);
  const point=(t:number)=>{const a=t*TAU;return pointFromTrig(Math.cos(a),Math.sin(a));};
  const tangent=(t:number)=>{const a=t*TAU,cos=Math.cos(a),sin=Math.sin(a);return U.length===2?
    [TAU*(-U[0]*sin+V[0]*cos),TAU*(-U[1]*sin+V[1]*cos)]:U.map((x,i)=>TAU*(-x*sin+V[i]*cos));};
  return {point,pointFromTrig,tangent,clip:region=>region.clipEllipse(c,U,V),path:(a,b)=>{
    const count=Math.max(1,Math.ceil(Math.abs(b-a)*8)),step=(b-a)/count,k=4/3*Math.tan(step*TAU/4)/TAU;
    let path='M'+fmt(point(a));
    for(let i=0;i<count;i++){
      const t0=a+i*step,t1=i===count-1?b:a+(i+1)*step,p=point(t0),q=point(t1),d0=tangent(t0),d1=tangent(t1);
      path+='C'+fmt(p.map((x,j)=>x+k*d0[j]))+' '+fmt(q.map((x,j)=>x-k*d1[j]))+' '+fmt(q);
    }
    return path;
  }};
}
export function projectedLine(project:Project,a:Vector,b:Vector):ProjectedCurve{
  const p=project(a),q=project(b),d=q.map((x,i)=>x-p[i]);
  const point=(t:number)=>p.map((x,i)=>x+t*d[i]);
  return {point,tangent:()=>d,clip:region=>region.clipLine(p,q),path:(a,b)=>'M'+fmt(point(a))+'L'+fmt(point(b))};
}
