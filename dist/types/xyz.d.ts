import type { Molecule } from './types.js';
export interface XYZOptions {
    /** Overrides the comment-derived name verbatim (for example, a filename). */
    name?: string;
    /** Distance-only bond inference; default false. No valence or bond orders. */
    inferBonds?: boolean;
    /** Positive integer, default 2000; cannot exceed the hard safety ceiling 2000. */
    maxAtoms?: number;
}
/**
 * Parse exactly one STANDARD XYZ frame: count, mandatory comment, then exactly
 * count four-column `element x y z` records. Blank trailing lines are allowed.
 * Symbols are case-normalized; atomic numbers 1–118 are recognized, but only
 * elements with a sourced rendering radius (currently H–Cm) are accepted.
 * Coordinates remain in angstrom, without recentering, rescaling or unit guessing.
 * Decimal exponents E/e and Fortran D/d are accepted. LF, CRLF and CR work.
 *
 * Extended XYZ `Properties=` declarations are rejected, even standard-order ones:
 * reordered/property-rich layouts must be converted to standard XYZ first.
 * Other comment text is opaque name data, never HTML or executable metadata.
 * There are no periodic boundaries; lattice/comment metadata is not interpreted.
 *
 * Limits: 2 Mi UTF-16 code units, at most 2000 atoms, |coordinate| <= 1e6 Å.
 * Text/count limits are checked before atom allocation; lines are scanned rather
 * than split into an unbounded array. Optional inference visits each i<j once
 * (at most 1,999,000 candidates), returning pairs in lexicographic index order
 * when 0.4 Å <= distance <= 1.2 * (covalentRadius[i] + covalentRadius[j]).
 * Inferred output is capped at 10000 bonds; denser inputs must disable inference.
 * This is only a geometric heuristic, not bond-order/valence/chemistry inference.
 */
export declare function parseXYZ(text: string, options?: XYZOptions): Molecule;
