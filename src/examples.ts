import type { Atom, Bond, Molecule, Vec3, Vector } from './types.js';
import { add, sub, mul } from './math.js';

// All built-in presets live here. Coordinates are in angstrom (Å).
// Idealized/illustrative geometries, not optimized or experimental structures.
// Bonds are explicit zero-based undirected connectivity, not bond-order glyphs.
const atom=(element: string,x: number,y: number,z: number): Atom=>({element,position:[x,y,z]});
const atomAt=(element: string,position: Vec3): Atom=>({element,position});
const radians=(degrees: number): number=>degrees*Math.PI/180;
const along=(origin: Vec3,direction: Vec3,length: number): Vec3=>[
  origin[0]+length*direction[0],
  origin[1]+length*direction[1],
  origin[2]+length*direction[2],
];
const polar=(degrees: number): Vec3=>[Math.cos(radians(degrees)),Math.sin(radians(degrees)),0];
const tetrahedral: readonly Vec3[]=[
  [1,0,0],
  [-1/3,Math.sqrt(8/9),0],
  [-1/3,-Math.sqrt(2/9),Math.sqrt(2/3)],
  [-1/3,-Math.sqrt(2/9),-Math.sqrt(2/3)],
];

// A unit direction on a cone around a unit axis; deterministic orthonormal frame.
function cone(axis: Vec3,cosine: number,azimuth: number): Vec3 {
  const reference: Vec3=Math.abs(axis[2])<0.9?[0,0,1]:[0,1,0];
  const cross: Vec3=[axis[1]*reference[2]-axis[2]*reference[1],
    axis[2]*reference[0]-axis[0]*reference[2],axis[0]*reference[1]-axis[1]*reference[0]];
  const norm=Math.hypot(...cross);
  const u: Vec3=[cross[0]/norm,cross[1]/norm,cross[2]/norm];
  const v: Vec3=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];
  const radial=Math.sqrt(1-cosine*cosine);
  const c=radial*Math.cos(radians(azimuth)),s=radial*Math.sin(radians(azimuth));
  return [cosine*axis[0]+c*u[0]+s*v[0],cosine*axis[1]+c*u[1]+s*v[1],cosine*axis[2]+c*u[2]+s*v[2]];
}
function attachHydrogen(atoms: Atom[],bonds: Bond[],parent: number,direction: Vec3,length: number): void {
  bonds.push([parent,atoms.length]);
  atoms.push(atomAt('H',along(atoms[parent].position,direction,length)));
}

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

// Every hydrogen is explicit; no aromatic/double-bond order or charge glyphs.
function phenol(): Molecule {
  const atoms: Atom[]=[0,60,120,180,240,300]
    .map(angle=>atomAt('C',along([0,0,0],polar(angle),1.397)));
  const bonds: Bond[]=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]];
  // Carbon 0 has OH instead of H; all ring atoms and substituents are planar.
  for(let i=1;i<6;i++)attachHydrogen(atoms,bonds,i,polar(i*60),1.09);
  const oxygen=atoms.length;
  atoms.push(atomAt('O',along(atoms[0].position,[1,0,0],1.36)));
  bonds.push([0,oxygen]);
  attachHydrogen(atoms,bonds,oxygen,polar(180-108.5),0.96);
  return {name:'Phenol · C₆H₆O',atoms,bonds};
}
function isopropanol(): Molecule {
  const atoms: Atom[]=[atomAt('C',[0,0,0]),atomAt('O',[1.43,0,0])];
  const bonds: Bond[]=[[0,1]];
  // Secondary carbon and methyl carbons have ideal tetrahedral bond angles.
  for(const direction of [tetrahedral[1],tetrahedral[2]]){
    const carbon=atoms.length;
    atoms.push(atomAt('C',along(atoms[0].position,direction,1.52)));
    bonds.push([0,carbon]);
    for(const azimuth of [60,180,300])attachHydrogen(atoms,bonds,carbon,cone(direction,1/3,azimuth),1.09);
  }
  attachHydrogen(atoms,bonds,0,tetrahedral[3],1.09);
  attachHydrogen(atoms,bonds,1,cone(tetrahedral[0],-Math.cos(radians(108.5)),0),0.96);
  return {name:'Isopropanol · C₃H₈O',atoms,bonds};
}
function sulfuricAcid(): Molecule {
  const atoms: Atom[]=[atomAt('S',[0,0,0])];
  const bonds: Bond[]=[];
  // Neutral HO-S(=O)2-OH: ideal tetrahedral SO4, not a sulfate ion.
  // Short terminal S=O bonds and longer S-OH bonds still use single cylinders.
  for(let i=0;i<4;i++){
    const oxygen=atoms.length;
    atoms.push(atomAt('O',along(atoms[0].position,tetrahedral[i],i<2?1.43:1.57)));
    bonds.push([0,oxygen]);
    if(i>=2)attachHydrogen(atoms,bonds,oxygen,cone(tetrahedral[i],-Math.cos(radians(108.5)),180),0.96);
  }
  return {name:'Sulfuric acid · H₂SO₄',atoms,bonds};
}
function glycine(): Molecule {
  // Neutral NH2-CH2-COOH, not the solid-state NH3+/COO- zwitterion.
  // Tetrahedral alpha carbon, pyramidal N (ideal 109.47°), planar 120° carboxyl C.
  const atoms: Atom[]=[atomAt('C',[0,0,0]),atomAt('C',[1.52,0,0]),
    atomAt('N',along([0,0,0],tetrahedral[1],1.47))];
  const bonds: Bond[]=[[0,1],[0,2]];
  atoms.push(atomAt('O',along(atoms[1].position,polar(60),1.21)));
  atoms.push(atomAt('O',along(atoms[1].position,polar(-60),1.36)));
  bonds.push([1,3],[1,4]);
  attachHydrogen(atoms,bonds,0,tetrahedral[2],1.09);
  attachHydrogen(atoms,bonds,0,tetrahedral[3],1.09);
  for(const azimuth of [60,180])attachHydrogen(atoms,bonds,2,cone(tetrahedral[1],1/3,azimuth),1.01);
  // C-O-H = 108.5°, with an outward-facing hydroxyl hydrogen.
  attachHydrogen(atoms,bonds,4,polar(-60+180-108.5),0.96);
  return {name:'Glycine · C₂H₅NO₂',atoms,bonds};
}

// Illustrative idealized coordinates below, NOT experimental coordinates or
// force-field-optimized conformers. All hydrogens are explicit atoms/bonds.
// Coordinates were constructed with internal bond lengths/angles, then discrete
// rigid-subtree torsions were selected to reduce close nonbonded contacts. No
// physical coordinate scaling was used to fit a canvas. Rounded to 0.000001 Å.

/** Alpha-D-glucopyranose in the 4C1 chair, not open-chain glucose.
 * Identity reference (not the source of these custom illustrative coordinates):
 * https://www.rcsb.org/ligand/GLC — (2S,3R,4S,5S,6R)-6-(hydroxymethyl)oxane-
 * 2,3,4,5-tetrol. Oxane positions 2..6 correspond to glucose C1..C5.
 *
 * Atom indices: 0..4 C1..C5; 5 ring O5; 6 C6; 7..10 hydroxyl O1..O4;
 * 11 hydroxyl O6; 12..16 H on C1..C5; 17,18 H on C6;
 * 19..23 H on O1,O2,O3,O4,O6, respectively.
 *
 * Ring C-C = 1.52 Å, C-O = 1.43 Å; chair heights alternate ±1.52/6 Å.
 * Ring O5 is moved radially inward to retain 1.43 Å on BOTH ring C-O bonds.
 * C1-OH is axial down; C2/C3/C4 OH and C5-C6 are equatorial. C6 is up,
 * trans to anomeric OH (alpha); absolute chirality is checked, not inferred
 * from an up/down drawing alone. Explicit descending CIP priority indices:
 * C1 [5,7,1,12] S; C2 [8,0,2,13] R; C3 [9,1,3,14] S;
 * C4 [10,4,2,15] S; C5 [5,3,6,16] R. For each tuple [a,b,c,d],
 * det(a-d,b-d,c-d) is positive for S, negative for R (right-handed xyz).
 * C4 is S in this ring even though open-chain glucose C4 is R: CIP priorities
 * change on cyclization. This is the D series, not its mirror image.
 */
const glucose: Molecule={
  name:'α-D-Glucopyranose · C₆H₁₂O₆',
  atoms:[
    atom('C',1.433070,0.000000,-0.253333), // 0
    atom('C',0.716535,-1.241075,0.253333), // 1
    atom('C',-0.716535,-1.241075,-0.253333), // 2
    atom('C',-1.433070,0.000000,0.253333), // 3
    atom('C',-0.716535,1.241075,-0.253333), // 4
    atom('O',0.607226,1.051747,0.253333), // 5
    atom('C',-1.331088,2.476610,0.383988), // 6
    atom('O',1.403403,0.017296,-1.682921), // 7
    atom('O',1.390643,-2.408665,-0.223333), // 8
    atom('O',-1.390643,-2.408665,0.223333), // 9
    atom('O',-2.781287,0.000000,-0.223333), // 10
    atom('O',-1.167806,2.412186,1.803173), // 11
    atom('H',2.420725,0.061348,0.203693), // 12
    atom('H',0.716535,-1.241075,1.343333), // 13
    atom('H',-0.716535,-1.241075,-1.343333), // 14
    atom('H',-1.433070,0.000000,1.343333), // 15
    atom('H',-0.693811,1.228083,-1.343019), // 16
    atom('H',-2.393002,2.520203,0.142042), // 17
    atom('H',-0.834333,3.368131,0.001203), // 18
    atom('H',0.486889,0.020981,-1.968557), // 19
    atom('H',1.382507,-2.394573,-1.183195), // 20
    atom('H',-1.382507,-2.394573,1.183195), // 21
    atom('H',-2.765014,0.000000,-1.183195), // 22
    atom('H',-0.684872,1.610842,2.018167), // 23
  ],
  bonds:[
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,0], // pyranose ring
    [0,7],[0,12],[1,8],[1,13],[2,9],[2,14],[3,10],[3,15],
    [4,6],[4,16],[6,11],[6,17],[6,18],
    [7,19],[8,20],[9,21],[10,22],[11,23],
  ],
};

/** DHPC specifically: 1,2-dihexanoyl-sn-glycero-3-phosphocholine.
 * A short-chain phosphatidylcholine, not a representation of every phospholipid.
 * Formula C20H40NO8P: 70 atoms and 69 connectivity edges (acyclic).
 *
 * Heavy index graph: glycerol C0-C1-C2; sn2 O3, sn1 O4, sn3 O5;
 * ester carbonyl C6 (sn2), C7 (sn1); phosphate P8 with O5,O9,O10,O11.
 * O5 and O11 bridge to glycerol and choline; O9 and O10 are terminal.
 * O9 is conventionally P=O and O10 is O− (resonance not depicted).
 * Choline O11-C12-C13-N14+(C15)(C16)(C17), strictly NO N-H.
 * C6-C18-C19-C20-C21-C22 and C7-C23-C24-C25-C26-C27 are two
 * SIX-carbon acyl tails, including their carbonyl carbons. Carbonyl O28
 * is on C6; O29 on C7. Both esters have coplanar C(glycerol)-O-C(=O)-O.
 *
 * Hydrogen indices: C1:30; C0:31,32; C2:33,34; C12:35,36;
 * C13:37,38; C15:39..41; C16:42..44; C17:45..47;
 * C18:48,49; C19:50,51; C20:52,53; C21:54,55; C22:56..58;
 * C23:59,60; C24:61,62; C25:63,64; C26:65,66; C27:67..69.
 * sn-glycerol center C1 (index 1) has descending CIP [O3,C2,C0,H30]: R.
 *
 * Target lengths: C-C 1.52, C-H 1.09, alcohol C-O 1.43, ester C-O 1.34,
 * carbonyl C=O 1.21, N-C 1.48, P-O 1.50/1.52/1.60 Å. Carbon centers are
 * tetrahedral except planar trigonal carbonyls; P is idealized tetrahedral.
 * The molecule is a ZWITTERION: N14+ and O10− are NOT representable in the
 * current glyph API, nor are double bonds. Cylinders show connectivity only.
 * This snapshot is an illustrative conformer, not a membrane/bilayer model.
 */
const phospholipid: Molecule={
  name:'DHPC · C₂₀H₄₀NO₈P',
  atoms:[
    atom('C',-1.241075,0.877572,0.000000), // 0
    atom('C',0.000000,0.000000,0.000000), // 1
    atom('C',1.241075,0.877572,0.000000), // 2
    atom('O',0.000000,-0.825611,-1.167590), // 3
    atom('O',-2.076740,0.521375,1.104395), // 4
    atom('O',2.396839,0.068685,0.234115), // 5
    atom('C',-0.836613,-1.871909,-1.198223), // 6
    atom('C',-3.368414,0.874631,1.055521), // 7
    atom('P',3.046235,0.005103,1.695020), // 8
    atom('O',3.830617,1.258296,1.948498), // 9
    atom('O',1.944278,-0.121824,2.734241), // 10
    atom('O',4.018911,-1.261613,1.791632), // 11
    atom('C',3.479731,-2.584168,1.720690), // 12
    atom('C',3.070677,-2.888423,0.288732), // 13
    atom('N',2.624496,-4.296221,0.191645), // 14
    atom('C',1.488394,-4.518378,1.113772), // 15
    atom('C',2.197208,-4.583746,-1.195855), // 16
    atom('C',3.741703,-5.194338,0.559929), // 17
    atom('C',-1.748097,-2.151090,-0.014308), // 18
    atom('C',-2.253739,-3.582488,-0.090639), // 19
    atom('C',-2.995288,-3.926895,1.190723), // 20
    atom('C',-2.049083,-3.799817,2.373493), // 21
    atom('C',-2.279189,-2.466137,3.065410), // 22
    atom('C',-3.904448,1.630860,-0.149130), // 23
    atom('C',-4.432377,0.641109,-1.174842), // 24
    atom('C',-4.578315,1.334458,-2.519598), // 25
    atom('C',-3.336317,1.080211,-3.358167), // 26
    atom('C',-2.307629,2.164549,-3.081738), // 27
    atom('O',-0.866473,-2.594458,-2.168342), // 28
    atom('O',-4.108064,0.591618,1.970354), // 29
    atom('H',0.000000,-0.629312,0.889981), // 30
    atom('H',-0.946672,1.923232,0.089567), // 31
    atom('H',-1.788483,0.732731,-0.931378), // 32
    atom('H',1.334808,1.374326,-0.965686), // 33
    atom('H',1.156356,1.626695,0.787235), // 34
    atom('H',4.234006,-3.301831,2.043381), // 35
    atom('H',2.607808,-2.656424,2.370789), // 36
    atom('H',2.254802,-2.227668,-0.004271), // 37
    atom('H',3.921825,-2.730536,-0.373627), // 38
    atom('H',0.794304,-5.232006,0.669841), // 39
    atom('H',1.859849,-4.913015,2.059490), // 40
    atom('H',0.974305,-3.573730,1.291119), // 41
    atom('H',2.053759,-5.657483,-1.316729), // 42
    atom('H',1.260158,-4.066512,-1.402025), // 43
    atom('H',2.963016,-4.239000,-1.890685), // 44
    atom('H',4.671484,-4.626042,0.585374), // 45
    atom('H',3.552376,-5.625475,1.542974), // 46
    atom('H',3.824059,-5.992947,-0.177323), // 47
    atom('H',-1.192516,-2.010973,0.912945), // 48
    atom('H',-2.594710,-1.464946,-0.037830), // 49
    atom('H',-2.929275,-3.684386,-0.939973), // 50
    atom('H',-1.409033,-4.260077,-0.214915), // 51
    atom('H',-3.833401,-3.242228,1.320717), // 52
    atom('H',-3.367474,-4.949667,1.131429), // 53
    atom('H',-2.235888,-4.611137,3.077031), // 54
    atom('H',-1.018740,-3.853759,2.021950), // 55
    atom('H',-3.000855,-2.595047,3.872057), // 56
    atom('H',-1.337095,-2.102230,3.475448), // 57
    atom('H',-2.664626,-1.744745,2.344902), // 58
    atom('H',-4.711417,2.292086,0.166592), // 59
    atom('H',-3.103291,2.221686,-0.593171), // 60
    atom('H',-3.734972,-0.191272,-1.269017), // 61
    atom('H',-5.403708,0.266530,-0.851878), // 62
    atom('H',-5.453208,0.941827,-3.037771), // 63
    atom('H',-4.698719,2.406615,-2.364414), // 64
    atom('H',-2.917036,0.107539,-3.100849), // 65
    atom('H',-3.602631,1.092976,-4.415056), // 66
    atom('H',-1.448830,1.728946,-2.571039), // 67
    atom('H',-1.984071,2.607081,-4.023851), // 68
    atom('H',-2.752309,2.935206,-2.452097), // 69
  ],
  bonds:[
    [1,0],[1,2],[1,3],[1,30],[0,4],[0,31],[0,32],[2,5],[2,33],[2,34],
    [3,6],[4,7],[5,8],[8,9],[8,10],[8,11],[11,12],
    [12,13],[12,35],[12,36],[13,14],[13,37],[13,38],
    [14,15],[14,16],[14,17],[15,39],[15,40],[15,41],
    [16,42],[16,43],[16,44],[17,45],[17,46],[17,47],
    [6,28],[6,18],[18,19],[18,48],[18,49],[19,20],[19,50],[19,51],
    [20,21],[20,52],[20,53],[21,22],[21,54],[21,55],[22,56],[22,57],[22,58],
    [7,29],[7,23],[23,24],[23,59],[23,60],[24,25],[24,61],[24,62],
    [25,26],[25,63],[25,64],[26,27],[26,65],[26,66],[27,67],[27,68],[27,69],
  ],
};

// Public order is stable; CO2 and benzene cylinders also show connectivity only.
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
  phenol:phenol(),
  isopropanol:isopropanol(),
  sulfuricAcid:sulfuricAcid(),
  glycine:glycine(),
  glucose,
  phospholipid,
} satisfies Record<string,Molecule>;
