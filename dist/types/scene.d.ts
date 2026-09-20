import type { Molecule, Sphere, Cylinder, Primitive, Project, Illumination, Vector } from './types.js';
import type { NormalizedOptions } from './options.js';
import { directionalShadowContext } from './shadows.js';
/** Frontmost orthographic intersection with a closed sphere/finite cylinder. */
export declare function depthAt(s: Primitive, x: number, y: number): number;
export interface PreparedScene {
    spheres: Sphere[];
    cylinders: Cylinder[];
    scene: Primitive[];
    scale: number;
    project: Project;
    illumination: Illumination;
    /** Physical light without occluders, for reuse with shared shadow regions. */
    unshadowedIllumination: Illumination;
    /** Cached physical (unshifted) illumination for outward-facing points on source.
     * Source geometry must remain unchanged for the lifetime of this scene. */
    lightingFor(source: Primitive): Illumination;
    /** Conservative caster availability; false guarantees no traced shadow on source. */
    mayShadow(source: Primitive): boolean;
    /** Same lazily prepared directional candidates for geometric shadow masks. */
    directionalShadows(): ReturnType<typeof directionalShadowContext>;
    lightDirection: Vector;
    shadowBias: number;
}
export declare function prepareScene(molecule: Molecule, o: NormalizedOptions): PreparedScene;
