import type { Primitive, Vector, Scene } from './types.js';

/** Conservative directional-light broad phase, once per visible surface.
 * A convex primitive cannot shadow its own outward-facing surface. */
export function directionalShadowContext(scene:Scene,light:Vector,bias:number){
  const bounds=scene.map(s=>s.kind==='sphere'?{c:s.c,r:s.r}:{c:s.a.map((v,i)=>v+s.u[i]*s.length/2),r:Math.hypot(s.length/2,s.r)});
  const lists=scene.map((receiver,i)=>scene.filter((caster,j)=>{
    if(i===j)return false;
    const a=bounds[i],b=bounds[j],d=b.c.map((v,k)=>v-a.c[k]),ahead=d.reduce((sum,v,k)=>sum+v*light[k],0);
    // The ray starts at p+n*bias, not p. Pad the receiver bound for that
    // displacement and roundoff (including the almost-unit light vector).
    const padding=bias+128*Number.EPSILON*Math.max(1,...a.c.map(Math.abs),...b.c.map(Math.abs),a.r,b.r);
    const r=a.r+b.r+padding;
    if(ahead+r<0||d.reduce((sum,v)=>sum+v*v,0)-ahead*ahead>r*r)return false;
    if(receiver.kind==='sphere'&&Math.hypot(...d)+b.r<receiver.r-padding)return false;
    return true;
  }));
  return {
    /** Same conservative lists for physical surface illumination; scene order is retained. */
    candidates:lists as readonly (readonly Primitive[])[],
    mayShadow:lists.map(list=>list.length>0),
    shadowed:(id:number,n:Vector,p:Vector)=>n.reduce((sum,v,k)=>sum+v*light[k],0)>0&&shadowBlocked(lists[id],p,n,light,bias)
  };
}

/** Any solid intersecting the infinite ray toward the directional light.
 * Normal bias avoids self-shadow acne; closed cylinders include both end caps.
 */
export function shadowBlocked(scene: readonly Primitive[], p: Vector, n: Vector, d: Vector, bias: number): boolean {
  const x=p[0]+n[0]*bias,y=p[1]+n[1]*bias,z=p[2]+n[2]*bias;
  for(const s of scene){
    if(s.kind==='sphere'){
      const ox=x-s.c[0],oy=y-s.c[1],oz=z-s.c[2];
      const b=ox*d[0]+oy*d[1]+oz*d[2];
      const c=ox*ox+oy*oy+oz*oz-s.r*s.r,disc=b*b-c;
      if(disc<=0)continue;
      const root=Math.sqrt(disc),near=-b-root,far=-b+root;
      if(far>Math.max(near,bias))return true;
    }else{
      const ox=x-s.a[0],oy=y-s.a[1],oz=z-s.a[2];
      const along=ox*s.u[0]+oy*s.u[1]+oz*s.u[2];
      const slope=d[0]*s.u[0]+d[1]*s.u[1]+d[2]*s.u[2];
      let near=bias,far=Infinity;
      if(Math.abs(slope)<1e-12){
        if(along<=0||along>=s.length)continue;
      }else{
        const t0=-along/slope,t1=(s.length-along)/slope;
        near=Math.max(near,Math.min(t0,t1));far=Math.min(far,Math.max(t0,t1));
        if(far<=near)continue;
      }
      const a=Math.max(0,1-slope*slope);
      const b=ox*d[0]+oy*d[1]+oz*d[2]-along*slope;
      const c=ox*ox+oy*oy+oz*oz-along*along-s.r*s.r;
      if(a<1e-12){
        if(c>=0)continue;
      }else{
        const disc=b*b-a*c;if(disc<=0)continue;
        const root=Math.sqrt(disc);
        near=Math.max(near,(-b-root)/a);far=Math.min(far,(-b+root)/a);
      }
      if(far>near)return true;
    }
  }
  return false;
}
