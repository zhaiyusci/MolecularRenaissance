import type { Molecule, Sphere, Cylinder, Primitive, Project, Illumination, Vector } from './types.js';
import type { NormalizedOptions } from './options.js';
/** Frontmost orthographic intersection with a closed sphere/finite cylinder. */
export declare function depthAt(s: Primitive, x: number, y: number): number;
export interface PreparedScene {
    spheres: Sphere[];
    cylinders: Cylinder[];
    scene: Primitive[];
    scale: number;
    project: Project;
    illumination: Illumination;
    lightDirection: Vector;
    shadowBias: number;
}
export declare function prepareScene(molecule: Molecule, o: NormalizedOptions): PreparedScene;
