import type { Atom } from './types.js';
/** Empirical covalent radii in angstrom (1 Å = 100 pm), not van der Waals radii.
 * Cordero et al., Dalton Trans. (2008), 2832–2838, DOI:10.1039/B801115J.
 * Values cross-checked against ASE and python-periodictable's cited tables.
 * Carbon uses the tabulated sp3 reference; no hybridization is inferred.
 */
export const covalentRadii = Object.freeze({ H: .31, C: .76, N: .71, O: .66, P: 1.07, S: 1.05 });
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
