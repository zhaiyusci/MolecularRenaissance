import type { ColorScheme } from './types.js';
type Palette = Readonly<Record<string, string>>;
export declare const elementPalette: Palette;
export declare const colorSchemes: Readonly<{
    jmol: Readonly<Record<string, string>>;
    rasmol: Readonly<Record<string, string>>;
    pymol: Readonly<Record<string, string>>;
    ortep: Readonly<Record<string, string>>;
    greenCarbon: Readonly<{
        C: "#00ff00";
    }>;
    cyanCarbon: Readonly<{
        C: "#00ffff";
    }>;
    magentaCarbon: Readonly<{
        C: "#ff00ff";
    }>;
}>;
export declare function elementColor(element: string | null | undefined, strength?: number, saturation?: number, scheme?: ColorScheme): string;
export {};
