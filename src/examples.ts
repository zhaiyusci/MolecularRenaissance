import type { Atom, Bond, Molecule, Vector } from './types.js';
import { add, sub, mul } from './math.js';
import { additionalExamples } from './additional-examples.js';
import { complexExamples } from './complex-examples.js';
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
// New molecular geometries below are idealized, not optimized; lengths are in angstrom.
// Bonds are explicit zero-based undirected connectivity, not bond-order assignments.
// In particular, CO2 and benzene cylinders show connectivity only.
const radians=(degrees: number): number=>degrees*Math.PI/180;

// Three tetrahedral directions opposite the +x direction (cos(angle) = -1/3).
function methylHydrogens(): Atom[] {
  return [0,120,240].map(degrees=>atom('H',-1.09/3,
    1.09*Math.sqrt(8/9)*Math.cos(radians(degrees)),
    1.09*Math.sqrt(8/9)*Math.sin(radians(degrees))));
}
function methane(): Molecule {
  return {name:'Methane · CH₄',atoms:[atom('C',0,0,0),atom('H',1.09,0,0),...methylHydrogens()],
    bonds:[[0,1],[0,2],[0,3],[0,4]]};
}
function ammonia(): Molecule {
  // Threefold symmetry gives H-N-H = 107 degrees, with N above the H plane.
  const height=Math.sqrt((1+2*Math.cos(radians(107)))/3);
  const radial=Math.sqrt(1-height*height);
  return {name:'Ammonia · NH₃',atoms:[atom('N',0,0,0),
    ...[0,120,240].map(degrees=>atom('H',1.01*radial*Math.cos(radians(degrees)),
      1.01*radial*Math.sin(radians(degrees)),-1.01*height))],
    bonds:[[0,1],[0,2],[0,3]]};
}
function methanol(): Molecule {
  // Tetrahedral carbon; the hydroxyl C-O-H angle is idealized to 108.5 degrees.
  const hydroxyl=radians(180-108.5);
  return {name:'Methanol · CH₄O',atoms:[atom('C',0,0,0),atom('O',1.43,0,0),
    ...methylHydrogens(),atom('H',1.43+.96*Math.cos(hydroxyl),.96*Math.sin(hydroxyl),0)],
    bonds:[[0,1],[0,2],[0,3],[0,4],[1,5]]};
}
function benzene(): Molecule {
  const ring=(element: string,radius: number): Atom[]=>[0,60,120,180,240,300]
    .map(degrees=>atom(element,radius*Math.cos(radians(degrees)),radius*Math.sin(radians(degrees)),0));
  return {name:'Benzene · C₆H₆',atoms:[...ring('C',1.397),...ring('H',1.397+1.09)],
    bonds:[[0,1],[1,2],[2,3],[3,4],[4,5],[0,5],
      [0,6],[1,7],[2,8],[3,9],[4,10],[5,11]]};
}
function hydrogenPeroxide(): Molecule {
  // H-O-O = 94.8 degrees at both oxygens; H-O-O-H torsion magnitude = 111 degrees.
  const angle=radians(94.8),torsion=radians(111);
  const axial=.97*Math.cos(angle),radial=.97*Math.sin(angle);
  return {name:'Hydrogen peroxide · H₂O₂',atoms:[atom('O',-.74,0,0),atom('O',.74,0,0),
    atom('H',-.74+axial,radial,0),
    atom('H',.74-axial,radial*Math.cos(torsion),radial*Math.sin(torsion))],
    bonds:[[0,1],[0,2],[1,3]]};
}
export const examples = {
  sphere:{name:'单球 · 明暗研究',atoms:[atom('C',0,0,0)],bonds:[]},
  pair:{name:'双球 · 遮挡研究',atoms:[atom('C',-.85,-.25,-.3),atom('O',.85,.25,.3)],bonds:[[0,1]]},
  water:{name:'水 · H₂O',atoms:[atom('O',0,.25,0),atom('H',-.78,-.35,.1),atom('H',.78,-.35,.1)],bonds:[[0,1],[0,2]]},
  ethanol:{name:'乙醇 · C₂H₆O',atoms:[atom('C',-1.22,0,0),atom('C',.12,.55,0),atom('O',1.28,-.2,.15),atom('H',2.02,.28,.15),atom('H',-1.3,-.72,.8),atom('H',-1.95,.75,.1),atom('H',-1.38,-.5,-.92),atom('H',.2,1.2,.88),atom('H',.22,1.14,-.92)],bonds:[[0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8]]},
  c60:fullerene(),
  methane:methane(),
  ammonia:ammonia(),
  carbonDioxide:{name:'Carbon dioxide · CO₂',atoms:[atom('C',0,0,0),atom('O',-1.16,0,0),atom('O',1.16,0,0)],bonds:[[0,1],[0,2]]},
  methanol:methanol(),
  benzene:benzene(),
  hydrogenPeroxide:hydrogenPeroxide(),
  ...additionalExamples,
  ...complexExamples
} satisfies Record<string,Molecule>;
