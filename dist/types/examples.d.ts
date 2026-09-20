import type { Atom, Molecule } from './types.js';
export declare const examples: {
    glucose: Molecule;
    phospholipid: Molecule;
    phenol: Molecule;
    isopropanol: Molecule;
    sulfuricAcid: Molecule;
    glycine: Molecule;
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
    methane: Molecule;
    ammonia: Molecule;
    carbonDioxide: {
        name: string;
        atoms: Atom[];
        bonds: [number, number][];
    };
    methanol: Molecule;
    benzene: Molecule;
    hydrogenPeroxide: Molecule;
};
