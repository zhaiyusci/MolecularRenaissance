import type { Atom, Bond, Molecule } from './types.js';
import { covalentRadii } from './radii.js';

export interface XYZOptions {
  /** Overrides the comment-derived name verbatim (for example, a filename). */
  name?: string;
  /** Distance-only bond inference; default false. No valence or bond orders. */
  inferBonds?: boolean;
  /** Positive integer, default 2000; cannot exceed the hard safety ceiling 2000. */
  maxAtoms?: number;
}

const MAX_ATOMS = 2000;
const MAX_TEXT_LENGTH = 2 * 1024 * 1024;
const MAX_COORDINATE = 1e6;
const MAX_INFERRED_BONDS = 10000;
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$/;
// IUPAC symbols in atomic-number order, as listed by ASE:
// https://gitlab.com/ase/ase/-/raw/master/ase/data/__init__.py
const SYMBOLS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn '
  + 'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm '
  + 'Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U '
  + 'Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');
const SYMBOL_SET = new Set(SYMBOLS);

function fail(line: number, message: string): never {
  throw new Error(`XYZ line ${line}: ${message}`);
}

function parseElement(token: string, line: number): keyof typeof covalentRadii {
  let symbol: string;
  if (/^\d+$/.test(token)) {
    const number = Number(token);
    if (!Number.isSafeInteger(number) || number < 1 || number > SYMBOLS.length) {
      return fail(line, 'unknown element: atomic number must be in 1–118');
    }
    symbol = SYMBOLS[number - 1]!;
  } else {
    if (!/^[A-Za-z]{1,2}$/.test(token)) return fail(line, 'unknown element: expected a chemical symbol or atomic number');
    symbol = token[0]!.toUpperCase() + token.slice(1).toLowerCase();
    if (!SYMBOL_SET.has(symbol)) return fail(line, `unknown chemical element ${symbol}`);
  }
  if (!Object.hasOwn(covalentRadii, symbol)) {
    return fail(line, `unsupported element ${symbol}: no sourced covalent radius available for rendering (supported: H–Cm, Z=1–96)`);
  }
  return symbol as keyof typeof covalentRadii;
}

function parseCoordinate(token: string, line: number): number {
  if (!DECIMAL.test(token)) return fail(line, 'coordinates must be finite decimal/scientific numbers (not NaN, Inf or hexadecimal)');
  const value = Number(token.replace(/[dD]/, 'e'));
  if (!Number.isFinite(value)) return fail(line, 'coordinates must be finite');
  if (Math.abs(value) > MAX_COORDINATE) return fail(line, 'coordinate exceeds the absolute limit of 1000000 angstrom');
  return value;
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
export function parseXYZ(text: string, options: XYZOptions = {}): Molecule {
  if (typeof text !== 'string') return fail(1, 'input must be text');
  if (text.length > MAX_TEXT_LENGTH) return fail(1, 'text exceeds the 2097152-character safety budget');
  if (options === null || typeof options !== 'object') return fail(1, 'options must be an object');
  const maxAtoms = options.maxAtoms ?? MAX_ATOMS;
  if (!Number.isSafeInteger(maxAtoms) || maxAtoms < 1 || maxAtoms > MAX_ATOMS) {
    return fail(1, 'maxAtoms must be a positive integer no greater than 2000');
  }
  if (options.name !== undefined && typeof options.name !== 'string') return fail(1, 'name must be a string');
  if (options.inferBonds !== undefined && typeof options.inferBonds !== 'boolean') return fail(1, 'inferBonds must be a boolean');

  let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 0;
  const nextLine = (): string | undefined => {
    if (cursor >= text.length) return undefined;
    const start = cursor;
    while (cursor < text.length && text[cursor] !== '\n' && text[cursor] !== '\r') cursor++;
    const end = cursor;
    if (cursor < text.length) {
      if (text[cursor++] === '\r' && text[cursor] === '\n') cursor++;
    }
    line++;
    return text.slice(start, end);
  };

  const header = nextLine()?.trim();
  if (header === undefined || !/^\d+$/.test(header)) return fail(1, 'expected a positive integer atom count');
  const count = Number(header);
  if (!Number.isSafeInteger(count) || count < 1) return fail(1, 'expected a positive safe-integer atom count');
  if (count > maxAtoms) return fail(1, `declared atom count ${count} exceeds maxAtoms ${maxAtoms}`);
  const comment = nextLine();
  if (comment === undefined) return fail(2, 'missing mandatory comment line (use an empty line if unnamed)');
  if (/\bProperties\s*=/i.test(comment)) {
    return fail(2, 'extended XYZ Properties layouts are unsupported; convert to standard four-column element x y z XYZ (no reordered fields)');
  }

  const atoms: Atom[] = [];
  for (let i = 0; i < count; i++) {
    const record = nextLine();
    if (record === undefined) return fail(i + 3, `missing coordinate record ${i + 1} of ${count}`);
    // Limit the split too: a malformed long record never allocates many columns.
    const fields = record.trim().split(/\s+/, 5);
    if (fields.length !== 4) return fail(line, 'expected exactly four columns: element x y z; blank records and extra atom properties are unsupported');
    const element = parseElement(fields[0]!, line);
    atoms.push({ element, position: [
      parseCoordinate(fields[1]!, line),
      parseCoordinate(fields[2]!, line),
      parseCoordinate(fields[3]!, line)
    ] });
  }
  for (let trailing = nextLine(); trailing !== undefined; trailing = nextLine()) {
    if (trailing.trim() !== '') return fail(line, 'unexpected trailing data: only one XYZ frame is supported (extra records/frames are not allowed)');
  }

  const bonds: Bond[] = [];
  if (options.inferBonds === true) {
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i]!;
      for (let j = i + 1; j < atoms.length; j++) {
        const b = atoms[j]!;
        const distance = Math.hypot(
          a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]
        );
        const cutoff = 1.2 * (covalentRadii[a.element as keyof typeof covalentRadii]
          + covalentRadii[b.element as keyof typeof covalentRadii]);
        if (distance >= 0.4 && distance <= cutoff) {
          if (bonds.length >= MAX_INFERRED_BONDS) {
            return fail(j + 3, 'bond inference exceeds the 10000-bond safety limit; disable inferBonds for this dense structure');
          }
          bonds.push([i, j]);
        }
      }
    }
  }
  return { name: options.name ?? (comment.trim() || 'XYZ molecule'), atoms, bonds };
}
