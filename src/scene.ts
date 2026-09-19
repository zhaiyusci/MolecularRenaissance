import type { Molecule, Sphere, Cylinder, Primitive, Project, Illumination, Vector } from './types.js';
import type { NormalizedOptions } from './options.js';
import { add, sub, mul, dot, norm, rotate } from './math.js';
import { atomRadius } from './radii.js';
import { shadowBlocked } from './shadows.js';

/** Frontmost orthographic intersection with a closed sphere/finite cylinder. */
export function depthAt(s: Primitive,x: number,y: number): number {
  if(s.kind==='sphere'){
    const d=s.r*s.r-(x-s.c[0])**2-(y-s.c[1])**2;
    return d < -1e-10 ? -Infinity : s.c[2]+Math.sqrt(Math.max(0,d));
  }
  const wx=x-s.a[0],wy=y-s.a[1],wz=-s.a[2],ux=s.u[0],uy=s.u[1],uz=s.u[2];
  const wu=wx*ux+wy*uy+wz*uz,A=1-uz*uz,B=2*(wz-wu*uz),C=wx*wx+wy*wy+wz*wz-wu*wu-s.r*s.r;
  let best=-Infinity;
  if(A>1e-12){
    const disc=B*B-4*A*C;
    if(disc>=-1e-10){
      const q=Math.sqrt(Math.max(0,disc)),z0=(-B-q)/(2*A),z1=(-B+q)/(2*A);
      const t0=wu+z0*uz,t1=wu+z1*uz;
      if(t0>=-1e-8&&t0<=s.length+1e-8)best=Math.max(best,z0);
      if(t1>=-1e-8&&t1<=s.length+1e-8)best=Math.max(best,z1);
    }
  }
  if(Math.abs(uz)>1e-12){
    for(let end=0;end<2;end++){
      const t=end?s.length:0,z=(t-wu)/uz;
      const vx=wx-ux*t,vy=wy-uy*t,vz=wz+z-uz*t;
      if(vx*vx+vy*vy+vz*vz<=s.r*s.r+1e-10)best=Math.max(best,z);
    }
  }
  return best;
}
export interface PreparedScene {
  spheres: Sphere[]; cylinders: Cylinder[]; scene: Primitive[];
  scale: number; project: Project; illumination: Illumination;
}
export function prepareScene(molecule: Molecule,o: NormalizedOptions): PreparedScene {
  if(!molecule||!Array.isArray(molecule.atoms)||!molecule.atoms.length||!Array.isArray(molecule.bonds))throw new Error('Expected atoms and bonds');
  for(const a of molecule.atoms)if(!Array.isArray(a.position)||a.position.length!==3||!a.position.every(Number.isFinite))throw new Error('Invalid atom position');
  const center=mul(molecule.atoms.reduce<Vector>((s,a)=>add(s,a.position),[0,0,0]),1/molecule.atoms.length);
  const spheres: Sphere[]=molecule.atoms.map(a=>({kind:'sphere',c:rotate(sub(a.position,center),o.yaw,o.pitch),r:atomRadius(a)*o.atomRadiusScale,element:a.element}));
  const cylinders: Cylinder[]=molecule.bonds.map(b=>{
    if(!Array.isArray(b)||b.length!==2||!b.every(i=>Number.isInteger(i)&&spheres[i]))throw new Error('Invalid bond');
    const a=spheres[b[0]].c,end=spheres[b[1]].c,v=sub(end,a),length=Math.hypot(...v);
    if(length<1e-8)throw new Error('Zero length bond');
    return {kind:'cylinder',a,u:mul(v,1/length),length,r:.115};
  });
  const scene=[...spheres,...cylinders];
  const lo=[0,1].map(i=>Math.min(...spheres.map(s=>s.c[i]-s.r))),hi=[0,1].map(i=>Math.max(...spheres.map(s=>s.c[i]+s.r)));
  // Translation may center the view, but scale never depends on its bounds.
  const scale=o.scale;
  const cx=(lo[0]+hi[0])/2,cy=(lo[1]+hi[1])/2;
  const project: Project=p=>[(p[0]-cx)*scale+o.width/2,o.height/2-12-(p[1]-cy)*scale];
  const light=[Math.sin(o.lightAzimuth)*Math.cos(o.lightElevation),Math.sin(o.lightElevation),Math.cos(o.lightAzimuth)*Math.cos(o.lightElevation)];
  const sceneRadius=Math.max(...spheres.map(s=>Math.hypot(...s.c)+s.r));
  const lightPosition=mul(light,o.lightDistance*sceneRadius);
  const shadowBias=Math.max(1e-9,Math.min(sceneRadius*1e-6,...scene.map(s=>s.r*1e-4)));
  const traceShadows=o.castShadows&&o.shadowStrength>0&&o.shadingSize!==0;
  const illumination: Illumination=(n,p)=>{
    const point=o.lightType==='point',delta=point?sub(lightPosition,p):light;
    const direction=point?norm(delta):light;
    const distance=point?Math.hypot(...delta):Infinity;
    const facing=dot(n,direction);
    let lit=facing;
    if(point&&o.lightAttenuation>0){
      // Soft inverse-square falloff in model units, independent of screen zoom.
      const relativeDistance=distance/sceneRadius;
      const attenuation=1/(1+o.lightAttenuation*relativeDistance*relativeDistance);
      lit=(Math.max(-1,Math.min(1,lit))+1)*attenuation-1;
    }
    if(traceShadows&&facing>0&&shadowBlocked(scene,p,n,direction,distance,shadowBias)){
      // Signed engraving brightness maps to [0,1] before shadow attenuation.
      // At strength .8, keep 20% of the local brightness instead of solid black.
      lit=(Math.max(-1,Math.min(1,lit))+1)*(1-o.shadowStrength)-1;
    }
    return lit;
  };
  return {spheres,cylinders,scene,scale,project,illumination};
}
