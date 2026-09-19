import type { Atom, Molecule } from './types.js';
export declare const examples: {
    sphere: {
        name: string;
        atoms: Atom[];
        bonds: never[];
    };
    pair: {
        name: string;
        atoms: Atom[];
        bonds: [number, number][];
    };
    water: {
        name: string;
        atoms: Atom[];
        bonds: [number, number][];
    };
    ethanol: {
        name: string;
        atoms: Atom[];
        bonds: [number, number][];
    };
    c60: Molecule;
};
