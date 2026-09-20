import type { Atom } from './types.js';
/** Empirical covalent radii in angstrom (1 Å = 100 pm), not van der Waals radii.
 * Cordero et al., Dalton Trans. (2008), 2832–2838, DOI:10.1039/B801115J.
 * Values transcribed from ASE's cited table (see covalentRadiusSource.data).
 * Covers H–Cm (Z=1–96). ASE's dummy X and `missing=2.0` placeholders
 * for Bk–Og are intentionally excluded: they are not sourced radii.
 * Carbon uses the tabulated sp3 reference; no hybridization is inferred.
 */
export const covalentRadii = Object.freeze({
  H: .31, He: .28,
  Li: 1.28, Be: .96, B: .84, C: .76, N: .71, O: .66, F: .57, Ne: .58,
  Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02, Ar: 1.06,
  K: 2.03, Ca: 1.76, Sc: 1.70, Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39,
  Fe: 1.32, Co: 1.26, Ni: 1.24, Cu: 1.32, Zn: 1.22,
  Ga: 1.22, Ge: 1.20, As: 1.19, Se: 1.20, Br: 1.20, Kr: 1.16,
  Rb: 2.20, Sr: 1.95, Y: 1.90, Zr: 1.75, Nb: 1.64, Mo: 1.54, Tc: 1.47,
  Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45, Cd: 1.44,
  In: 1.42, Sn: 1.39, Sb: 1.39, Te: 1.38, I: 1.39, Xe: 1.40,
  Cs: 2.44, Ba: 2.15, La: 2.07, Ce: 2.04, Pr: 2.03, Nd: 2.01, Pm: 1.99,
  Sm: 1.98, Eu: 1.98, Gd: 1.96, Tb: 1.94, Dy: 1.92, Ho: 1.92,
  Er: 1.89, Tm: 1.90, Yb: 1.87, Lu: 1.87,
  Hf: 1.75, Ta: 1.70, W: 1.62, Re: 1.51, Os: 1.44, Ir: 1.41,
  Pt: 1.36, Au: 1.36, Hg: 1.32, Tl: 1.45, Pb: 1.46, Bi: 1.48,
  Po: 1.40, At: 1.50, Rn: 1.50, Fr: 2.60, Ra: 2.21, Ac: 2.15,
  Th: 2.06, Pa: 2.00, U: 1.96, Np: 1.90, Pu: 1.87, Am: 1.80, Cm: 1.69
});
export const covalentRadiusSource = Object.freeze({
  kind: 'covalent', unit: 'angstrom', doi: '10.1039/B801115J',
  citation: 'Cordero et al., Covalent radii revisited, Dalton Trans. (2008), 2832–2838',
  data: 'https://gitlab.com/ase/ase/-/raw/master/ase/data/__init__.py',
  carbonReference: 'sp3'
});
/** Explicit per-atom radii override the table; unknown elements are never guessed. */
export function atomRadius(atom: Atom): number {
  if(atom.radius!==undefined){
    if(!Number.isFinite(atom.radius)||atom.radius<=0)throw new Error('Invalid atom radius: expected a positive finite value in angstrom');
    return atom.radius;
  }
  if(!Object.hasOwn(covalentRadii,atom.element))throw new Error('No covalent radius for element '+atom.element+'; provide atom.radius in angstrom');
  return covalentRadii[atom.element as keyof typeof covalentRadii];
}
