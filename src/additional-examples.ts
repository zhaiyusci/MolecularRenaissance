import type { Atom, Bond, Molecule, Vec3 } from './types.js';

// Idealized Cartesian geometries in angstrom (Å), not optimized or experimental.
// Every hydrogen is explicit. Bonds are undirected connectivity only: one cylinder
// per connected pair, with no aromatic/double-bond order or charge glyphs.
const radians = (degrees: number): number => degrees * Math.PI / 180;
const atom = (element: string, position: Vec3): Atom => ({ element, position });
const along = (origin: Vec3, direction: Vec3, length: number): Vec3 => [
  origin[0] + length * direction[0],
  origin[1] + length * direction[1],
  origin[2] + length * direction[2],
];
const polar = (degrees: number): Vec3 => [Math.cos(radians(degrees)), Math.sin(radians(degrees)), 0];
const tetrahedral: readonly Vec3[] = [
  [1, 0, 0],
  [-1 / 3, Math.sqrt(8 / 9), 0],
  [-1 / 3, -Math.sqrt(2 / 9), Math.sqrt(2 / 3)],
  [-1 / 3, -Math.sqrt(2 / 9), -Math.sqrt(2 / 3)],
];

// A unit direction on a cone around a unit axis; deterministic orthonormal frame.
function cone(axis: Vec3, cosine: number, azimuth: number): Vec3 {
  const reference: Vec3 = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const cross: Vec3 = [
    axis[1] * reference[2] - axis[2] * reference[1],
    axis[2] * reference[0] - axis[0] * reference[2],
    axis[0] * reference[1] - axis[1] * reference[0],
  ];
  const norm = Math.hypot(...cross);
  const u: Vec3 = [cross[0] / norm, cross[1] / norm, cross[2] / norm];
  const v: Vec3 = [axis[1] * u[2] - axis[2] * u[1],
    axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  const radial = Math.sqrt(1 - cosine * cosine);
  const c = radial * Math.cos(radians(azimuth)), s = radial * Math.sin(radians(azimuth));
  return [cosine * axis[0] + c * u[0] + s * v[0],
    cosine * axis[1] + c * u[1] + s * v[1],
    cosine * axis[2] + c * u[2] + s * v[2]];
}

function attachHydrogen(atoms: Atom[], bonds: Bond[], parent: number, direction: Vec3, length: number): void {
  bonds.push([parent, atoms.length]);
  atoms.push(atom('H', along(atoms[parent].position, direction, length)));
}

function phenol(): Molecule {
  const atoms: Atom[] = [0, 60, 120, 180, 240, 300]
    .map(angle => atom('C', along([0, 0, 0], polar(angle), 1.397)));
  const bonds: Bond[] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
  // Carbon 0 has OH instead of H; all ring atoms and substituents are planar.
  for (let i = 1; i < 6; i++) attachHydrogen(atoms, bonds, i, polar(i * 60), 1.09);
  const oxygen = atoms.length;
  atoms.push(atom('O', along(atoms[0].position, [1, 0, 0], 1.36)));
  bonds.push([0, oxygen]);
  attachHydrogen(atoms, bonds, oxygen, polar(180 - 108.5), 0.96);
  return { name: 'Phenol · C₆H₆O', atoms, bonds };
}

function isopropanol(): Molecule {
  const atoms: Atom[] = [atom('C', [0, 0, 0]), atom('O', [1.43, 0, 0])];
  const bonds: Bond[] = [[0, 1]];
  // Secondary carbon and methyl carbons have ideal tetrahedral bond angles.
  for (const direction of [tetrahedral[1], tetrahedral[2]]) {
    const carbon = atoms.length;
    atoms.push(atom('C', along(atoms[0].position, direction, 1.52)));
    bonds.push([0, carbon]);
    for (const azimuth of [60, 180, 300]) {
      attachHydrogen(atoms, bonds, carbon, cone(direction, 1 / 3, azimuth), 1.09);
    }
  }
  attachHydrogen(atoms, bonds, 0, tetrahedral[3], 1.09);
  attachHydrogen(atoms, bonds, 1, cone(tetrahedral[0], -Math.cos(radians(108.5)), 0), 0.96);
  return { name: 'Isopropanol · C₃H₈O', atoms, bonds };
}

function sulfuricAcid(): Molecule {
  const atoms: Atom[] = [atom('S', [0, 0, 0])];
  const bonds: Bond[] = [];
  // Neutral HO-S(=O)2-OH: ideal tetrahedral SO4, not a sulfate ion.
  // Short terminal S=O bonds and longer S-OH bonds still use single cylinders.
  for (let i = 0; i < 4; i++) {
    const oxygen = atoms.length;
    atoms.push(atom('O', along(atoms[0].position, tetrahedral[i], i < 2 ? 1.43 : 1.57)));
    bonds.push([0, oxygen]);
    if (i >= 2) {
      attachHydrogen(atoms, bonds, oxygen,
        cone(tetrahedral[i], -Math.cos(radians(108.5)), 180), 0.96);
    }
  }
  return { name: 'Sulfuric acid · H₂SO₄', atoms, bonds };
}

function glycine(): Molecule {
  // Neutral NH2-CH2-COOH, not the solid-state NH3+/COO- zwitterion.
  // Tetrahedral alpha carbon, pyramidal N (ideal 109.47°), planar 120° carboxyl C.
  const atoms: Atom[] = [atom('C', [0, 0, 0]), atom('C', [1.52, 0, 0]),
    atom('N', along([0, 0, 0], tetrahedral[1], 1.47))];
  const bonds: Bond[] = [[0, 1], [0, 2]];
  atoms.push(atom('O', along(atoms[1].position, polar(60), 1.21)));
  atoms.push(atom('O', along(atoms[1].position, polar(-60), 1.36)));
  bonds.push([1, 3], [1, 4]);
  attachHydrogen(atoms, bonds, 0, tetrahedral[2], 1.09);
  attachHydrogen(atoms, bonds, 0, tetrahedral[3], 1.09);
  for (const azimuth of [60, 180]) {
    attachHydrogen(atoms, bonds, 2, cone(tetrahedral[1], 1 / 3, azimuth), 1.01);
  }
  // C-O-H = 108.5°, with an outward-facing hydroxyl hydrogen.
  attachHydrogen(atoms, bonds, 4, polar(-60 + 180 - 108.5), 0.96);
  return { name: 'Glycine · C₂H₅NO₂', atoms, bonds };
}

export const additionalExamples = {
  phenol: phenol(),
  isopropanol: isopropanol(),
  sulfuricAcid: sulfuricAcid(),
  glycine: glycine(),
} satisfies Record<string, Molecule>;
