import type { Atom } from './types.js';
/** Empirical covalent radii in angstrom (1 Å = 100 pm), not van der Waals radii.
 * Cordero et al., Dalton Trans. (2008), 2832–2838, DOI:10.1039/B801115J.
 * Values cross-checked against ASE and python-periodictable's cited tables.
 * Carbon uses the tabulated sp3 reference; no hybridization is inferred.
 */
export declare const covalentRadii: Readonly<{
    H: 0.31;
    C: 0.76;
    N: 0.71;
    O: 0.66;
    P: 1.07;
    S: 1.05;
}>;
export declare const covalentRadiusSource: Readonly<{
    kind: "covalent";
    unit: "angstrom";
    doi: "10.1039/B801115J";
    citation: "Cordero et al., Covalent radii revisited, Dalton Trans. (2008), 2832–2838";
    data: "https://gitlab.com/ase/ase/-/raw/master/ase/data/__init__.py";
    carbonReference: "sp3";
}>;
/** Explicit per-atom radii override the table; unknown elements are never guessed. */
export declare function atomRadius(atom: Atom): number;
