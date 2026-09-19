import type { Atom, Bond, Molecule, Vector } from './types.js';
import { add, sub, mul } from './math.js';
const atom=(element: string,x: number,y: number,z: number): Atom=>({element,position:[x,y,z]});
// Idealized regular truncated icosahedron, not an optimized two-bond-length geometry.
function fullerene(): Molecule {
  const phi=(1+Math.sqrt(5))/2,vertices: Vector[]=[];
  for(const s of [-1,1])for(const t of [-1,1])vertices.push([0,s,t*phi],[s,t*phi,0],[t*phi,0,s]);
  const positions: Vector[]=[],factor=1.42/(2/3);
  for(let i=0;i<vertices.length;i++)for(let j=0;j<vertices.length;j++){
    if(Math.abs(Math.hypot(...sub(vertices[i],vertices[j]))-2)<1e-9)
      positions.push(mul(add(mul(vertices[i],2),vertices[j]),factor/3));
  }
  const bonds: Bond[]=[];
  for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)
    if(Math.abs(Math.hypot(...sub(positions[i],positions[j]))-1.42)<1e-9)bonds.push([i,j]);
  return {name:'富勒烯 · C₆₀',atoms:positions.map(p=>atom('C',p[0],p[1],p[2])),bonds};
}
export const examples = {
  sphere:{name:'单球 · 明暗研究',atoms:[atom('C',0,0,0)],bonds:[]},
  pair:{name:'双球 · 遮挡研究',atoms:[atom('C',-.85,-.25,-.3),atom('O',.85,.25,.3)],bonds:[[0,1]]},
  water:{name:'水 · H₂O',atoms:[atom('O',0,.25,0),atom('H',-.78,-.35,.1),atom('H',.78,-.35,.1)],bonds:[[0,1],[0,2]]},
  ethanol:{name:'乙醇 · C₂H₆O',atoms:[atom('C',-1.22,0,0),atom('C',.12,.55,0),atom('O',1.28,-.2,.15),atom('H',2.02,.28,.15),atom('H',-1.3,-.72,.8),atom('H',-1.95,.75,.1),atom('H',-1.38,-.5,-.92),atom('H',.2,1.2,.88),atom('H',.22,1.14,-.92)],bonds:[[0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8]]},
  c60:fullerene()
} satisfies Record<string,Molecule>;
