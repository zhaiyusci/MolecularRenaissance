/* Generated from src/renderer.ts by npm run build. Edit TypeScript, not this file. */
var MolEngraver = (function (exports) {
    'use strict';

    // Preserve arithmetic order: geometry tolerances are covered by numerical tests.
    const add$1 = (a, b) => a.map((v, i) => v + b[i]);
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const mul$1 = (a, s) => a.map(v => v * s);
    const dot$1 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const cross$1 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => mul$1(a, 1 / Math.hypot(...a));
    function rotate(p, yaw, pitch) {
        const x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
        return [x, p[1] * Math.cos(pitch) - z * Math.sin(pitch), p[1] * Math.sin(pitch) + z * Math.cos(pitch)];
    }
    function escapeXml(s) {
        const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
        return String(s).replace(/[&<>"']/g, c => escapes[c]);
    }

    // Source tables and conversion rules: PALETTES.md. No artist-picked replacements.
    const elementPalette = Object.freeze({ H: '#ffffff', C: '#909090', N: '#3050f8', O: '#ff0d0d', P: '#ff8000', S: '#ffff30' });
    const rasmol = Object.freeze({ H: '#ffffff', C: '#c8c8c8', N: '#8f8fff', O: '#f00000', P: '#ffa500', S: '#ffc832' });
    // PyMOL Color.cpp named element RGB values, rounded to 8-bit RGB.
    const rgb = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const pymol = Object.freeze({ H: rgb(.9, .9, .9), C: rgb(.2, 1, .2), N: rgb(.2, .2, 1), O: rgb(1, .3, .3), P: rgb(1, .501960784, 0), S: rgb(.9, .775, .25) });
    const colorSchemes = Object.freeze({
        jmol: elementPalette,
        rasmol,
        pymol,
        greenCarbon: Object.freeze({ ...rasmol, C: '#00ff00' }),
        cyanCarbon: Object.freeze({ ...rasmol, C: '#00ffff' }),
        magentaCarbon: Object.freeze({ ...rasmol, C: '#ff00ff' })
    });
    function selectPalette(scheme) {
        if (!Object.hasOwn(colorSchemes, scheme))
            throw new Error('Invalid colorScheme');
        return colorSchemes[scheme];
    }
    function elementColor(element, strength = 1, saturation = 1, scheme = 'jmol') {
        const palette = selectPalette(scheme);
        return mixColor(element != null && Object.hasOwn(palette, element) ? palette[element] : palette.C, strength, saturation);
    }
    function mixColor(hex, strength, saturation) {
        const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(...rgb), min = Math.min(...rgb), lightness = (max + min) / 2, chroma = max - min;
        const capacity = 1 - Math.abs(2 * lightness - 1);
        const factor = chroma > 0 ? Math.min(capacity, chroma * saturation) / chroma : 1;
        return '#' + rgb.map(v => Math.round(255 * (1 + ((lightness + (v - lightness) * factor) - 1) * strength)).toString(16).padStart(2, '0')).join('');
    }

    const defaults = {
        renderMode: 'precise',
        width: 900, height: 700, scale: 60, atomRadiusScale: 1, yaw: .25, pitch: -0.16, lightAzimuth: -29 * Math.PI / 180, lightElevation: 32 * Math.PI / 180,
        lightType: 'directional', lightDistance: 3, lightAttenuation: 0, castShadows: false, shadowStrength: .8, density: 24, lineWidth: .8, outlineWidth: .8, hatchWidth: .8,
        variableWidth: true, optimizePaths: true, quality: 'export', shadingMode: 'hatch', textureScale: 1, shadingBrightness: 0, shadingContrast: 1.2,
        dotSpacing: 2.5, dotSize: .5, dotContrast: 1.2, crossHatch: true, colorWash: false, colorScheme: 'jmol', washStrength: 1,
        colorSaturation: 1, labelMatchFill: false, labels: false, labelHydrogens: true, labelSize: 17, labelStrokeWidth: 4, labelStrokeColor: '#ffffff',
        labelColor: '#161616', labelFont: "Georgia, 'Times New Roman', serif", labelBold: false, labelItalic: true
    };
    function normalizeOptions(options) {
        const o = { ...defaults, ...options };
        if (typeof o.labelHydrogens !== 'boolean')
            throw new Error('Invalid labelHydrogens');
        if (!['preview', 'export'].includes(o.quality))
            throw new Error('Invalid quality');
        if (o.quality === 'preview')
            o.optimizePaths = false;
        o.outlineWidth = options.outlineWidth === undefined ? o.lineWidth : options.outlineWidth;
        o.hatchWidth = options.hatchWidth === undefined ? o.lineWidth : options.hatchWidth;
        for (const [key, min, max] of [['shadingBrightness', -1, 1], ['textureScale', .2, 2.5], ['shadingDensity', .4, 2.5], ['shadingSize', 0, 1.5], ['shadingContrast', .5, 2.5]]) {
            const value = options[key];
            if (value !== undefined && (!Number.isFinite(value) || value < min || value > max))
                throw new Error('Invalid option: ' + key);
        }
        if (options.shadingDensity !== undefined) {
            o.density = Math.round(24 * options.shadingDensity);
            o.dotSpacing = 5 / options.shadingDensity;
        }
        if (options.shadingSize !== undefined) {
            o.hatchWidth = .8 * options.shadingSize;
            o.dotSize = options.shadingSize;
        }
        // The UI always starts at 1x; each style has its own mark-size calibration.
        const dotStyleScale = o.shadingMode === 'stipple' ? .6 : o.shadingMode === 'halftone' ? 3 : 1;
        if (options.dotSpacing === undefined && options.shadingDensity === undefined)
            o.dotSpacing = 2.5 * dotStyleScale;
        if (options.dotSize === undefined && options.shadingSize === undefined)
            o.dotSize = .5 * dotStyleScale;
        if (options.textureScale !== undefined) {
            const k = options.textureScale, dotK = k * dotStyleScale, hidden = options.shadingSize === 0;
            // Dot area scales as k² while count scales as 1/k²; line width and
            // spacing both scale as k. Preserve tone approximately, not mark count.
            o.density = 24 / k;
            o.dotSpacing = 2.5 * dotK;
            o.hatchWidth = hidden ? 0 : .8 * k;
            o.dotSize = hidden ? 0 : .5 * dotK;
        }
        o.shadingContrast = options.shadingContrast === undefined ? 1.2 : options.shadingContrast;
        if (options.shadingContrast !== undefined)
            o.dotContrast = o.shadingContrast;
        for (const k of ['dotSpacing', 'dotSize', 'dotContrast', 'outlineWidth', 'hatchWidth', 'colorSaturation', 'width', 'height', 'yaw', 'pitch', 'lightAzimuth', 'lightElevation', 'lightDistance', 'density', 'lineWidth', 'labelSize', 'labelStrokeWidth', 'washStrength'])
            if (!Number.isFinite(o[k]))
                throw new Error('Invalid option: ' + k);
        if (!Number.isFinite(o.scale) || o.scale <= 0)
            throw new Error('Invalid scale: expected positive finite SVG units per angstrom');
        if (!Number.isFinite(o.atomRadiusScale) || o.atomRadiusScale <= 0)
            throw new Error('Invalid atomRadiusScale: expected a positive finite multiplier');
        if (!Number.isFinite(o.lightAttenuation) || o.lightAttenuation < 0)
            throw new Error('Invalid lightAttenuation: expected a nonnegative finite strength');
        if (typeof o.castShadows !== 'boolean')
            throw new Error('Invalid castShadows');
        if (!Number.isFinite(o.shadowStrength) || o.shadowStrength < 0 || o.shadowStrength > 1)
            throw new Error('Invalid shadowStrength: expected 0–1');
        if (typeof o.colorScheme !== 'string' || !Object.hasOwn(colorSchemes, o.colorScheme))
            throw new Error('Invalid colorScheme');
        if (!['hatch', 'stipple', 'halftone'].includes(o.shadingMode))
            throw new Error('Invalid shadingMode');
        if (o.dotSpacing < .3 || o.dotSpacing > 19 || o.dotSize < 0 || o.dotSize > 4 || o.dotContrast < .5 || o.dotContrast > 2.5)
            throw new Error('Invalid dot settings');
        if (o.width < 200 || o.height < 200 || o.lineWidth < 0 || o.outlineWidth < 0 || o.hatchWidth < 0)
            throw new Error('Invalid output dimensions or line width');
        if (o.colorSaturation < 0 || o.colorSaturation > 4)
            throw new Error('colorSaturation must be between 0 and 4');
        if (o.washStrength < 0 || o.washStrength > 1)
            throw new Error('washStrength must be between 0 and 1');
        if (o.labelSize < 6 || o.labelSize > 96 || o.labelStrokeWidth < 0 || o.labelStrokeWidth > 16)
            throw new Error('Invalid label size or stroke width');
        for (const key of ['labelColor', 'labelStrokeColor'])
            if (typeof o[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(o[key]))
                throw new Error('Invalid label color: ' + key);
        if (typeof o.labelFont !== 'string' || !o.labelFont.trim() || o.labelFont.length > 200)
            throw new Error('Invalid label font');
        if (!['directional', 'point'].includes(o.lightType))
            throw new Error('Invalid lightType');
        if (o.lightDistance < 1.2)
            throw new Error('lightDistance must be at least 1.2 scene radii');
        if (options.textureScale === undefined)
            o.density = Math.round(Math.max(8, Math.min(60, o.density)));
        if (!['precise', 'fast'].includes(o.renderMode))
            throw new Error('Invalid renderMode');
        if (o.renderMode === 'fast' && (o.lightType !== 'directional' || o.castShadows))
            throw new Error('Fast rendering requires directional light and castShadows=false');
        return o;
    }

    /** Empirical covalent radii in angstrom (1 Å = 100 pm), not van der Waals radii.
     * Cordero et al., Dalton Trans. (2008), 2832–2838, DOI:10.1039/B801115J.
     * Values transcribed from ASE's cited table (see covalentRadiusSource.data).
     * Covers H–Cm (Z=1–96). ASE's dummy X and `missing=2.0` placeholders
     * for Bk–Og are intentionally excluded: they are not sourced radii.
     * Carbon uses the tabulated sp3 reference; no hybridization is inferred.
     */
    const covalentRadii = Object.freeze({
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
    const covalentRadiusSource = Object.freeze({
        kind: 'covalent', unit: 'angstrom', doi: '10.1039/B801115J',
        citation: 'Cordero et al., Covalent radii revisited, Dalton Trans. (2008), 2832–2838',
        data: 'https://gitlab.com/ase/ase/-/raw/master/ase/data/__init__.py',
        carbonReference: 'sp3'
    });
    /** Explicit per-atom radii override the table; unknown elements are never guessed. */
    function atomRadius(atom) {
        if (atom.radius !== undefined) {
            if (!Number.isFinite(atom.radius) || atom.radius <= 0)
                throw new Error('Invalid atom radius: expected a positive finite value in angstrom');
            return atom.radius;
        }
        if (!Object.hasOwn(covalentRadii, atom.element))
            throw new Error('No covalent radius for element ' + atom.element + '; provide atom.radius in angstrom');
        return covalentRadii[atom.element];
    }

    /** Conservative directional-light broad phase, once per visible surface.
     * A convex primitive cannot shadow its own outward-facing surface. */
    function directionalShadowContext(scene, light, bias) {
        const bounds = scene.map(s => s.kind === 'sphere' ? { c: s.c, r: s.r } : { c: s.a.map((v, i) => v + s.u[i] * s.length / 2), r: Math.hypot(s.length / 2, s.r) });
        const lists = scene.map((receiver, i) => scene.filter((caster, j) => {
            if (i === j)
                return false;
            const a = bounds[i], b = bounds[j], d = b.c.map((v, k) => v - a.c[k]), ahead = d.reduce((sum, v, k) => sum + v * light[k], 0);
            // The ray starts at p+n*bias, not p. Pad the receiver bound for that
            // displacement and roundoff (including the almost-unit light vector).
            const padding = bias + 128 * Number.EPSILON * Math.max(1, ...a.c.map(Math.abs), ...b.c.map(Math.abs), a.r, b.r);
            const r = a.r + b.r + padding;
            if (ahead + r < 0 || d.reduce((sum, v) => sum + v * v, 0) - ahead * ahead > r * r)
                return false;
            if (receiver.kind === 'sphere' && Math.hypot(...d) + b.r < receiver.r - padding)
                return false;
            return true;
        }));
        return {
            /** Same conservative lists for physical surface illumination; scene order is retained. */
            candidates: lists,
            mayShadow: lists.map(list => list.length > 0),
            shadowed: (id, n, p) => n.reduce((sum, v, k) => sum + v * light[k], 0) > 0 && shadowBlocked(lists[id], p, n, light, Infinity, bias)
        };
    }
    /** Any solid intersecting the ray toward the light (finite for a point source).
     * Normal bias avoids self-shadow acne; closed cylinders include both end caps.
     */
    function shadowBlocked(scene, p, n, d, maxDistance, bias) {
        const x = p[0] + n[0] * bias, y = p[1] + n[1] * bias, z = p[2] + n[2] * bias;
        const limit = maxDistance - bias;
        for (const s of scene) {
            if (s.kind === 'sphere') {
                const ox = x - s.c[0], oy = y - s.c[1], oz = z - s.c[2];
                const b = ox * d[0] + oy * d[1] + oz * d[2];
                const c = ox * ox + oy * oy + oz * oz - s.r * s.r, disc = b * b - c;
                if (disc <= 0)
                    continue;
                const root = Math.sqrt(disc), near = -b - root, far = -b + root;
                if (Math.min(far, limit) > Math.max(near, bias))
                    return true;
            }
            else {
                const ox = x - s.a[0], oy = y - s.a[1], oz = z - s.a[2];
                const along = ox * s.u[0] + oy * s.u[1] + oz * s.u[2];
                const slope = d[0] * s.u[0] + d[1] * s.u[1] + d[2] * s.u[2];
                let near = bias, far = limit;
                if (Math.abs(slope) < 1e-12) {
                    if (along <= 0 || along >= s.length)
                        continue;
                }
                else {
                    const t0 = -along / slope, t1 = (s.length - along) / slope;
                    near = Math.max(near, Math.min(t0, t1));
                    far = Math.min(far, Math.max(t0, t1));
                    if (far <= near)
                        continue;
                }
                const a = Math.max(0, 1 - slope * slope);
                const b = ox * d[0] + oy * d[1] + oz * d[2] - along * slope;
                const c = ox * ox + oy * oy + oz * oz - along * along - s.r * s.r;
                if (a < 1e-12) {
                    if (c >= 0)
                        continue;
                }
                else {
                    const disc = b * b - a * c;
                    if (disc <= 0)
                        continue;
                    const root = Math.sqrt(disc);
                    near = Math.max(near, (-b - root) / a);
                    far = Math.min(far, (-b + root) / a);
                }
                if (far > near)
                    return true;
            }
        }
        return false;
    }

    /** Frontmost orthographic intersection with a closed sphere/finite cylinder. */
    function depthAt(s, x, y) {
        if (s.kind === 'sphere') {
            const d = s.r * s.r - (x - s.c[0]) ** 2 - (y - s.c[1]) ** 2;
            return d < -1e-10 ? -Infinity : s.c[2] + Math.sqrt(Math.max(0, d));
        }
        const wx = x - s.a[0], wy = y - s.a[1], wz = -s.a[2], ux = s.u[0], uy = s.u[1], uz = s.u[2];
        const wu = wx * ux + wy * uy + wz * uz, A = 1 - uz * uz, B = 2 * (wz - wu * uz), C = wx * wx + wy * wy + wz * wz - wu * wu - s.r * s.r;
        let best = -Infinity;
        if (A > 1e-12) {
            const disc = B * B - 4 * A * C;
            if (disc >= -1e-10) {
                const q = Math.sqrt(Math.max(0, disc)), z0 = (-B - q) / (2 * A), z1 = (-B + q) / (2 * A);
                const t0 = wu + z0 * uz, t1 = wu + z1 * uz;
                if (t0 >= -1e-8 && t0 <= s.length + 1e-8)
                    best = Math.max(best, z0);
                if (t1 >= -1e-8 && t1 <= s.length + 1e-8)
                    best = Math.max(best, z1);
            }
        }
        if (Math.abs(uz) > 1e-12) {
            for (let end = 0; end < 2; end++) {
                const t = end ? s.length : 0, z = (t - wu) / uz;
                const vx = wx - ux * t, vy = wy - uy * t, vz = wz + z - uz * t;
                if (vx * vx + vy * vy + vz * vz <= s.r * s.r + 1e-10)
                    best = Math.max(best, z);
            }
        }
        return best;
    }
    function prepareScene(molecule, o) {
        if (!molecule || !Array.isArray(molecule.atoms) || !molecule.atoms.length || !Array.isArray(molecule.bonds))
            throw new Error('Expected atoms and bonds');
        for (const a of molecule.atoms)
            if (!Array.isArray(a.position) || a.position.length !== 3 || !a.position.every(Number.isFinite))
                throw new Error('Invalid atom position');
        const center = mul$1(molecule.atoms.reduce((s, a) => add$1(s, a.position), [0, 0, 0]), 1 / molecule.atoms.length);
        const spheres = molecule.atoms.map(a => ({ kind: 'sphere', c: rotate(sub(a.position, center), o.yaw, o.pitch), r: atomRadius(a) * o.atomRadiusScale, element: a.element }));
        const cylinders = molecule.bonds.map(b => {
            if (!Array.isArray(b) || b.length !== 2 || !b.every(i => Number.isInteger(i) && spheres[i]))
                throw new Error('Invalid bond');
            const a = spheres[b[0]].c, end = spheres[b[1]].c, v = sub(end, a), length = Math.hypot(...v);
            if (length < 1e-8)
                throw new Error('Zero length bond');
            return { kind: 'cylinder', a, u: mul$1(v, 1 / length), length, r: .115 };
        });
        const scene = [...spheres, ...cylinders];
        const lo = [0, 1].map(i => Math.min(...spheres.map(s => s.c[i] - s.r))), hi = [0, 1].map(i => Math.max(...spheres.map(s => s.c[i] + s.r)));
        // Translation may center the view, but scale never depends on its bounds.
        const scale = o.scale;
        const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
        const project = p => [(p[0] - cx) * scale + o.width / 2, o.height / 2 - 12 - (p[1] - cy) * scale];
        const light = [Math.sin(o.lightAzimuth) * Math.cos(o.lightElevation), Math.sin(o.lightElevation), Math.cos(o.lightAzimuth) * Math.cos(o.lightElevation)];
        const sceneRadius = Math.max(...spheres.map(s => Math.hypot(...s.c) + s.r));
        const lightPosition = mul$1(light, o.lightDistance * sceneRadius);
        const shadowBias = Math.max(1e-9, Math.min(sceneRadius * 1e-6, ...scene.map(s => s.r * 1e-4)));
        const traceShadows = o.castShadows && o.shadowStrength > 0 && o.shadingSize !== 0;
        // Share the evaluator so broad-phase specialization cannot drift from the
        // generic callback's physical formulas or arithmetic order.
        const lighting = (casters) => (n, p) => {
            const point = o.lightType === 'point', delta = point ? sub(lightPosition, p) : light;
            const direction = point ? norm(delta) : light;
            const distance = point ? Math.hypot(...delta) : Infinity;
            const facing = dot$1(n, direction);
            let lit = facing;
            if (point && o.lightAttenuation > 0) {
                // Soft inverse-square falloff in model units, independent of screen zoom.
                const relativeDistance = distance / sceneRadius;
                const attenuation = 1 / (1 + o.lightAttenuation * relativeDistance * relativeDistance);
                lit = (Math.max(-1, Math.min(1, lit)) + 1) * attenuation - 1;
            }
            if (casters.length && traceShadows && facing > 0 && shadowBlocked(casters, p, n, direction, distance, shadowBias)) {
                // Signed engraving brightness maps to [0,1] before shadow attenuation.
                // At strength .8, keep 20% of the local brightness instead of solid black.
                lit = (Math.max(-1, Math.min(1, lit)) + 1) * (1 - o.shadowStrength) - 1;
            }
            return lit;
        };
        const illumination = lighting(scene), unshadowedIllumination = lighting([]), cache = new WeakMap();
        const ids = new Map(scene.map((s, id) => [s, id]));
        let directional;
        const directionalShadows = () => directional ??= directionalShadowContext(scene, light, shadowBias);
        const lightingFor = (source) => {
            const cached = cache.get(source);
            if (cached)
                return cached;
            const id = ids.get(source);
            let result = illumination;
            if (traceShadows && o.lightType === 'directional' && id !== undefined) {
                result = lighting(directionalShadows().candidates[id]);
            }
            // Point rays vary across a receiver: retain the complete caster list,
            // including self, rather than apply an unsafe directional broad phase.
            // Unknown primitives also keep the fully generic behavior.
            cache.set(source, result);
            return result;
        };
        const mayShadow = (source) => {
            if (!traceShadows)
                return false;
            const id = ids.get(source);
            if (o.lightType !== 'directional' || id === undefined)
                return scene.length > 0;
            return directionalShadows().mayShadow[id];
        };
        return { spheres, cylinders, scene, scale, project, illumination, unshadowedIllumination, lightingFor, mayShadow, directionalShadows, lightDirection: light, shadowBias };
    }

    const root = globalThis;
    function getBoundaries() {
        return typeof module !== 'undefined' && module.exports ? require('./boundaries.js') : root.MolBoundaries;
    }
    function getWash() {
        return typeof module !== 'undefined' && module.exports ? require('./wash.js') : root.MolWash;
    }
    function getDots() {
        return typeof module !== 'undefined' && module.exports ? require('./dots.js') : root.MolDots;
    }

    const TAU$2 = 2 * Math.PI;
    const fmt$2 = (p) => p.slice(0, 2).map(v => String(Number(v.toFixed(4)))).join(' ');
    /** Intervals in normalized circle parameter where k+a*cos+b*sin < limit. */
    function trigSpans(k, a, b, limit) {
        const radius = Math.hypot(a, b), cuts = [0, 1];
        if (radius === 0)
            return k < limit ? [[0, 1]] : [];
        if (limit <= k - radius)
            return [];
        if (limit >= k + radius)
            return [[0, 1]];
        if (Math.abs(limit - k) < radius) {
            const phase = Math.atan2(b, a), delta = Math.acos((limit - k) / radius);
            for (const t of [phase - delta, phase + delta])
                cuts.push(((t / TAU$2) % 1 + 1) % 1);
        }
        cuts.sort((x, y) => x - y);
        const result = [];
        for (let i = 1; i < cuts.length; i++) {
            const x = cuts[i - 1], y = cuts[i], t = (x + y) / 2 * TAU$2;
            if (y > x && k + a * Math.cos(t) + b * Math.sin(t) < limit)
                result.push([x, y]);
        }
        return result;
    }
    function intersectSpans(a, b) {
        const result = [];
        let i = 0, j = 0;
        while (i < a.length && j < b.length) {
            const lo = Math.max(a[i][0], b[j][0]), hi = Math.min(a[i][1], b[j][1]);
            if (hi > lo + 1e-12)
                result.push([lo, hi]);
            if (a[i][1] < b[j][1])
                i++;
            else
                j++;
        }
        return result;
    }
    function unionSpans(...sets) {
        const result = [];
        for (const [a, b] of sets.flat().sort((x, y) => x[0] - y[0])) {
            const last = result.at(-1);
            if (last && a <= last[1] + 1e-12)
                last[1] = Math.max(last[1], b);
            else
                result.push([a, b]);
        }
        return result;
    }
    function complementSpans(spans) {
        const result = [];
        let end = 0;
        for (const [a, b] of spans) {
            if (a > end)
                result.push([end, a]);
            end = Math.max(end, b);
        }
        if (end < 1)
            result.push([end, 1]);
        return result;
    }
    /** A projected circle stays an ellipse; do not sample and refit its centerline. */
    function projectedCircle(project, center, u, v) {
        const c = project(center), pu = project(center.map((x, i) => x + u[i])), pv = project(center.map((x, i) => x + v[i]));
        const U = pu.map((x, i) => x - c[i]), V = pv.map((x, i) => x - c[i]);
        const point = (t) => { const a = t * TAU$2; return c.map((x, i) => x + U[i] * Math.cos(a) + V[i] * Math.sin(a)); };
        const tangent = (t) => { const a = t * TAU$2; return U.map((x, i) => TAU$2 * (-x * Math.sin(a) + V[i] * Math.cos(a))); };
        return { point, tangent, clip: region => region.clipEllipse(c, U, V), path: (a, b) => {
                const count = Math.max(1, Math.ceil(Math.abs(b - a) * 8)), step = (b - a) / count, k = 4 / 3 * Math.tan(step * TAU$2 / 4) / TAU$2;
                let path = 'M' + fmt$2(point(a));
                for (let i = 0; i < count; i++) {
                    const t0 = a + i * step, t1 = i === count - 1 ? b : a + (i + 1) * step, p = point(t0), q = point(t1), d0 = tangent(t0), d1 = tangent(t1);
                    path += 'C' + fmt$2(p.map((x, j) => x + k * d0[j])) + ' ' + fmt$2(q.map((x, j) => x - k * d1[j])) + ' ' + fmt$2(q);
                }
                return path;
            } };
    }
    function projectedLine(project, a, b) {
        const p = project(a), q = project(b), d = q.map((x, i) => x - p[i]);
        const point = (t) => p.map((x, i) => x + t * d[i]);
        return { point, tangent: () => d, clip: region => region.clipLine(p, q), path: (a, b) => 'M' + fmt$2(point(a)) + 'L' + fmt$2(point(b)) };
    }

    function engravingWidth(base, illumination) {
        const darkness = (1 - Math.max(-1, Math.min(1, illumination))) / 2;
        return base * (.4 + 1.15 * darkness);
    }
    /** Sample lighting/width only within known visible spans; emit strokes or ribbons. */
    function createCurveRenderer(context) {
        const { options: o, project, illumination, visible, paths } = context;
        const fitter = o.optimizePaths ? getWash() : null;
        if (o.optimizePaths && (!fitter || typeof fitter.fitContour !== 'function'))
            throw new Error('Load updated wash.js before renderer.js');
        const rounded = (v) => String(Math.round(v * 1000) / 1000);
        const coord = (p) => p.map(rounded).join(' ');
        function compactPath(points, tolerance = .015) {
            const a = points[0], b = points.at(-1), dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
            if (length2 > 1e-12 && points.every(p => {
                const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2;
                return t >= -1e-9 && t <= 1 + 1e-9 && Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) <= 1e-6 * Math.sqrt(length2);
            }))
                return 'M' + coord(a) + 'L' + coord(b);
            let curves;
            if (length2 < 1e-10 && points.length > 3) {
                let far = 1, distance = -1;
                for (let i = 1; i < points.length - 1; i++) {
                    const d = (points[i][0] - a[0]) ** 2 + (points[i][1] - a[1]) ** 2;
                    if (d > distance) {
                        distance = d;
                        far = i;
                    }
                }
                curves = fitter.fitContour(points.slice(0, far + 1), tolerance).concat(fitter.fitContour(points.slice(far), tolerance));
            }
            else
                curves = fitter.fitContour(points, tolerance);
            return 'M' + coord(a) + curves.map(c => c.length === 2 ? 'L' + coord(c[1]) : 'C' + c.slice(1).map(coord).join(' ')).join('');
        }
        return function curve(fn, steps, width, accept = () => true, engrave = false, closed = false, clip = null, hints = {}) {
            if (width === 0 || (engrave && o.shadingMode !== 'hatch') || hints.spans?.length === 0)
                return;
            let run = [];
            const runs = [];
            const flush = () => { if (run.length > 1)
                runs.push(run); run = []; };
            function evaluate(t) {
                const { p, n } = fn(t);
                let lit = hints.ignoreLighting ? 0 : (hints.illumination || illumination)(n, p);
                if (engrave && o.shadingContrast !== 1.2) {
                    const darkness = (1 - Math.max(-1, Math.min(1, lit))) / 2;
                    lit = 1 - 2 * Math.pow(darkness, o.shadingContrast / 1.2);
                }
                return { p, n, lit, xy: hints.geometry ? hints.geometry.point(t) : project(p), index: t * steps };
            }
            function sample(t, knownVisible) {
                const value = evaluate(t);
                if (accept(value.n, value.p, value.lit) && (knownVisible || visible(value.p)))
                    run.push(value);
                else
                    flush();
            }
            const visibleSpans = clip ? clip() : null;
            const spans = hints.spans ? intersectSpans(hints.spans, visibleSpans || [[0, 1]]) : visibleSpans;
            if (spans !== null) {
                for (const [a, b] of spans) {
                    if (hints.spans && visibleSpans !== null && hints.geometry) {
                        if (!o.variableWidth) {
                            run.push(evaluate(a), evaluate(b));
                            flush();
                            continue;
                        }
                        // Known topology and smooth directional lighting: refine geometry
                        // and width error, rather than stepping every ~0.7 screen units.
                        const tolerance = Math.min(.02, width * .025);
                        function refine(lo, hi, depth) {
                            const t = (lo.index + hi.index) / (2 * steps), mid = evaluate(t);
                            const error = Math.hypot(mid.xy[0] - (lo.xy[0] + hi.xy[0]) / 2, mid.xy[1] - (lo.xy[1] + hi.xy[1]) / 2);
                            const widthError = width * .575 * Math.abs(mid.lit - (lo.lit + hi.lit) / 2);
                            if (depth < 16 && ((hi.index - lo.index) / steps > 1 / 8 || error > tolerance || widthError > tolerance)) {
                                refine(lo, mid, depth + 1);
                                refine(mid, hi, depth + 1);
                            }
                            else
                                run.push(hi);
                        }
                        const cuts = [a, ...(hints.breaks || []).filter(t => t > a + 1e-10 && t < b - 1e-10), b].sort((x, y) => x - y);
                        for (let i = 1; i < cuts.length; i++) {
                            const lo = cuts[i - 1], hi = cuts[i];
                            if (hi <= lo)
                                continue;
                            const epsilon = Math.min(1e-8, (hi - lo) * .0001);
                            const first = evaluate(lo), last = evaluate(hi);
                            // Keep both one-sided widths at a shadow edge. It is a width
                            // jump, not a new stroke end; only real accepted-span ends taper.
                            first.lit = evaluate(lo + epsilon).lit;
                            last.lit = evaluate(hi - epsilon).lit;
                            run.push(first);
                            refine(first, last, 0);
                        }
                        flush();
                    }
                    else {
                        sample(a, visibleSpans !== null);
                        const first = Math.floor(a * steps) + 1, last = Math.ceil(b * steps) - 1;
                        if (first > last)
                            sample((a + b) / 2, visibleSpans !== null);
                        else
                            for (let i = first; i <= last; i++)
                                sample(i / steps, visibleSpans !== null);
                        sample(b, visibleSpans !== null);
                        flush();
                    }
                }
            }
            else {
                // Unknown topology / shadow changes retain the original discovery grid.
                for (let i = 0; i <= steps; i++)
                    sample(i / steps, false);
                flush();
            }
            // Join periodic seams without adding a tapered tip.
            if (closed && runs.length > 1 && runs[0][0].index === 0 && runs.at(-1).at(-1).index === steps) {
                const last = runs.pop();
                runs[0] = last.concat(runs[0].slice(1).map(p => ({ ...p, index: p.index + steps })));
            }
            for (const points of runs) {
                if (!engrave || !o.variableWidth) {
                    const d = hints.geometry ? hints.geometry.path(points[0].index / steps, points.at(-1).index / steps) : o.optimizePaths ? compactPath(points.map(q => q.xy)) : points.map(({ xy: p }, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('');
                    paths.push(`<path stroke-width="${width.toFixed(3)}" d="${d}"/>`);
                    continue;
                }
                let clean = points.filter((q, i) => i === 0 || Math.hypot(q.xy[0] - points[i - 1].xy[0], q.xy[1] - points[i - 1].xy[1]) > 1e-6 || Math.abs(q.lit - points[i - 1].lit) > 1e-8);
                if (clean.length < 2)
                    continue;
                const loop = closed && Math.abs(clean.at(-1).index - clean[0].index - steps) < 1e-8;
                const distances = [0];
                for (let i = 1; i < clean.length; i++)
                    distances.push(distances[i - 1] + Math.hypot(clean[i].xy[0] - clean[i - 1].xy[0], clean[i].xy[1] - clean[i - 1].xy[1]));
                const total = distances.at(-1), tipLength = Math.min(5, total * .25), left = [], right = [];
                clean.forEach((p, i) => p.distance = distances[i]);
                if (hints.geometry) {
                    if (hints.spans && visibleSpans !== null && !loop) {
                        // Smoothstep tips need their own samples even along a straight line.
                        const extra = [];
                        for (const end of [false, true])
                            for (let k = 1; k <= 8; k++) {
                                const d = end ? total - tipLength * k / 8 : tipLength * k / 8;
                                let i = 1;
                                while (i < distances.length - 1 && distances[i] < d)
                                    i++;
                                const span = distances[i] - distances[i - 1], f = span ? (d - distances[i - 1]) / span : 0;
                                const point = evaluate((clean[i - 1].index + (clean[i].index - clean[i - 1].index) * f) / steps);
                                extra.push({ ...point, distance: d });
                            }
                        clean = clean.concat(extra).sort((a, b) => a.index - b.index).filter((p, i, a) => !i || p.index - a[i - 1].index > 1e-10 || Math.abs(p.lit - a[i - 1].lit) > 1e-8);
                    }
                    else {
                        // Shadow/point-light discovery stays dense for correctness; simplify
                        // only after topology and the original sampled width changes are known.
                        const keep = new Uint8Array(clean.length), tolerance = Math.min(.02, width * .025), stack = [];
                        keep[0] = keep[clean.length - 1] = 1;
                        let start = 0;
                        for (let i = 1; i < clean.length; i++)
                            if (i === clean.length - 1 || (!loop && (clean[i].distance <= tipLength || total - clean[i].distance <= tipLength))) {
                                keep[i] = 1;
                                stack.push([start, i]);
                                start = i;
                            }
                        while (stack.length) {
                            const [a, b] = stack.pop();
                            if (b - a < 2)
                                continue;
                            const p = clean[a], q = clean[b], dx = q.xy[0] - p.xy[0], dy = q.xy[1] - p.xy[1], length2 = dx * dx + dy * dy;
                            let worst = 1, at = -1;
                            for (let i = a + 1; i < b; i++) {
                                const v = clean[i], t = length2 ? Math.max(0, Math.min(1, ((v.xy[0] - p.xy[0]) * dx + (v.xy[1] - p.xy[1]) * dy) / length2)) : (v.index - p.index) / (q.index - p.index);
                                const geometry = Math.hypot(v.xy[0] - p.xy[0] - t * dx, v.xy[1] - p.xy[1] - t * dy);
                                const lighting = width * .575 * Math.abs(v.lit - p.lit - (q.lit - p.lit) * t), error = Math.max(geometry, lighting) / tolerance;
                                if (error > worst) {
                                    worst = error;
                                    at = i;
                                }
                            }
                            if (at >= 0) {
                                keep[at] = 1;
                                stack.push([a, at], [at, b]);
                            }
                        }
                        clean = clean.filter((_, i) => keep[i]);
                    }
                }
                for (let i = 0; i < clean.length; i++) {
                    const p = clean[i].xy;
                    const prev = clean[i === 0 ? (loop ? clean.length - 2 : 0) : i - 1].xy;
                    const next = clean[i === clean.length - 1 ? (loop ? 1 : i) : i + 1].xy;
                    const tangent = hints.geometry?.tangent(clean[i].index / steps);
                    const direction = tangent && Math.hypot(tangent[0], tangent[1]) > 1e-9 ? tangent : [next[0] - prev[0], next[1] - prev[1]];
                    const dx = direction[0], dy = direction[1], length = Math.hypot(dx, dy) || 1;
                    const distance = clean[i].distance;
                    const t = loop ? 1 : Math.min(1, distance / tipLength, (total - distance) / tipLength);
                    const taper = t * t * (3 - 2 * t), half = engravingWidth(width, clean[i].lit) * taper / 2;
                    left.push([p[0] - dy / length * half, p[1] + dx / length * half]);
                    right.push([p[0] + dy / length * half, p[1] - dx / length * half]);
                }
                right.reverse();
                let d;
                if (o.optimizePaths) {
                    const tolerance = Math.min(.015, width * .025);
                    d = compactPath(left, tolerance) + compactPath(right, tolerance).replace(/^M/, 'L') + 'Z';
                }
                else {
                    const outline = left.concat(right);
                    d = outline.map((p, i) => (i ? 'L' : 'M') + rounded(p[0]) + ' ' + rounded(p[1])).join('') + 'Z';
                }
                paths.push(`<path fill="#161616" stroke="none" d="${d}"/>`);
            }
        };
    }

    const LEVELS = 16;
    const fmt$1 = (n) => String(Number(n.toFixed(4)));
    /** Disk radius / lattice pitch for a desired UNION area (not summed disk area). */
    function halftoneRadiusRatio(coverage) {
        if (coverage <= Math.PI / 4)
            return Math.sqrt(Math.max(0, coverage) / Math.PI);
        if (coverage >= 1)
            return Math.SQRT1_2;
        let lo = .5, hi = Math.SQRT1_2;
        for (let k = 0; k < 24; k++) {
            const r = (lo + hi) / 2, r2 = r * r;
            const area = Math.PI * r2 - 4 * (r2 * Math.acos(.5 / r) - .5 * Math.sqrt(r2 - .25));
            if (area < coverage)
                lo = r;
            else
                hi = r;
        }
        return (lo + hi) / 2;
    }
    /** Exact projected union silhouette, including closed-cylinder caps. All parts
     * in this clipPath are unioned; tone sampling handles front-surface ownership. */
    function projectedSilhouette(scene, project, scale) {
        const parts = [];
        for (const s of scene) {
            const r = s.r * scale;
            if (s.kind === 'sphere') {
                const [x, y] = project(s.c);
                parts.push(`<circle cx="${fmt$1(x)}" cy="${fmt$1(y)}" r="${fmt$1(r)}"/>`);
                continue;
            }
            const a = project(s.a), b = project(s.a.map((v, i) => v + s.u[i] * s.length));
            const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
            const vx = length > 1e-12 ? -dy / length : 1, vy = length > 1e-12 ? dx / length : 0;
            const angle = Math.atan2(vy, vx) * 180 / Math.PI;
            for (const p of [a, b])
                parts.push(`<ellipse cx="${fmt$1(p[0])}" cy="${fmt$1(p[1])}" rx="${fmt$1(r)}" ry="${fmt$1(r * Math.abs(s.u[2]))}" transform="rotate(${fmt$1(angle)} ${fmt$1(p[0])} ${fmt$1(p[1])})"/>`);
            if (length > 1e-12) {
                const p = [[a[0] + r * vx, a[1] + r * vy], [b[0] + r * vx, b[1] + r * vy], [b[0] - r * vx, b[1] - r * vy], [a[0] - r * vx, a[1] - r * vy]];
                parts.push(`<path d="M${p.map(v => v.map(fmt$1).join(' ')).join('L')}Z"/>`);
            }
        }
        return parts.join('');
    }
    /** Marching-squares contours of a cumulative tone region. Shared grid edges
     * have shared vertices. Evenodd filling preserves holes/disconnected islands. */
    function contour(values, nx, ny, x0, y0, step, threshold, refine) {
        const nodes = new Map();
        const pairs = [
            [], [[0, 3]], [[0, 1]], [[1, 3]], [[1, 2]], [], [[0, 2]], [[2, 3]],
            [[2, 3]], [[0, 2]], [], [[1, 2]], [[1, 3]], [[0, 1]], [[0, 3]], []
        ];
        for (let y = 0; y < ny - 1; y++)
            for (let x = 0; x < nx - 1; x++) {
                const at = y * nx + x, a = values[at], b = values[at + 1], c = values[at + nx + 1], d = values[at + nx];
                const code = (a >= threshold ? 1 : 0) | (b >= threshold ? 2 : 0) | (c >= threshold ? 4 : 0) | (d >= threshold ? 8 : 0);
                if (code === 0 || code === 15)
                    continue;
                function node(edge) {
                    const vertical = edge === 1 || edge === 3;
                    const start = at + (edge === 1 ? 1 : edge === 2 ? nx : 0), end = start + (vertical ? nx : 1);
                    const id = 2 * start + (vertical ? 1 : 0);
                    if (!nodes.has(id)) {
                        const t = (threshold - values[start]) / (values[end] - values[start]);
                        const a = [x0 + (start % nx) * step, y0 + Math.floor(start / nx) * step];
                        const b = [a[0] + (vertical ? 0 : step), a[1] + (vertical ? step : 0)];
                        const p = refine ? refine(a, b, threshold) : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
                        nodes.set(id, { p, links: [] });
                    }
                    return id;
                }
                let connections = pairs[code];
                if (code === 5 || code === 10) {
                    const center = (a + b + c + d) / 4 >= threshold;
                    connections = (code === 5 ? center : !center) ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
                }
                for (const [first, last] of connections) {
                    const u = node(first), v = node(last);
                    nodes.get(u).links.push(v);
                    nodes.get(v).links.push(u);
                }
            }
        const used = new Set(), paths = [];
        for (const [start] of nodes) {
            if (used.has(start))
                continue;
            const points = [];
            let current = start, previous = -1;
            do {
                if (used.has(current))
                    throw new Error('Open halftone tone contour');
                used.add(current);
                const item = nodes.get(current);
                if (item.links.length !== 2)
                    throw new Error('Invalid halftone tone topology');
                points.push(item.p);
                const next = item.links[0] === previous ? item.links[1] : item.links[0];
                previous = current;
                current = next;
            } while (current !== start);
            if (points.length < 3)
                continue;
            // Remove exactly collinear grid runs, without fitting across sharp shadows.
            const simple = points.filter((p, i) => {
                const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
                return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
            });
            if (simple.length >= 3)
                paths.push('M' + simple.map(p => p.map(fmt$1).join(' ')).join('L') + 'Z');
        }
        return paths.join('');
    }
    /** Local numerical fallback for point lights or a BINARY shadow boundary.
     * It never allocates a full-frame ownership/lighting raster. Optional bisection
     * refines hard shadow edges independently of the coarse discovery grid. */
    function sampledTonePaths(bounds, sample, step, thresholds = Array.from({ length: LEVELS }, (_, i) => (i + .5) / LEVELS), refine = false) {
        const [left, top, right, bottom] = bounds;
        if (!(right > left && bottom > top))
            return thresholds.map(() => '');
        step = Math.max(step, Math.sqrt((right - left) * (bottom - top) / 120000), (right - left) / 120000, (bottom - top) / 120000);
        let nx = Math.ceil((right - left) / step) + 3, ny = Math.ceil((bottom - top) / step) + 3;
        while (nx * ny > 130000) {
            step *= 1.1;
            nx = Math.ceil((right - left) / step) + 3;
            ny = Math.ceil((bottom - top) / step) + 3;
        }
        const x0 = left - step, y0 = top - step, values = new Float32Array(nx * ny);
        values.fill(-1);
        const valueAt = (x, y) => { const v = sample(x, y); return v !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : -1; };
        let maximum = -1;
        for (let y = 1; y < ny - 1; y++)
            for (let x = 1; x < nx - 1; x++) {
                const px = x0 + x * step, py = y0 + y * step;
                if (px > right || py > bottom)
                    continue;
                const value = valueAt(px, py);
                values[y * nx + x] = value;
                maximum = Math.max(maximum, value);
            }
        const refineEdge = refine ? (a, b, threshold) => {
            const inside = valueAt(a[0], a[1]) >= threshold;
            let lo = 0, hi = 1;
            for (let k = 0; k < 9; k++) {
                const t = (lo + hi) / 2;
                if ((valueAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) >= threshold) === inside)
                    lo = t;
                else
                    hi = t;
            }
            const t = (lo + hi) / 2;
            return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        } : undefined;
        return thresholds.map(t => maximum < t ? '' : contour(values, nx, ny, x0, y0, step, t, refineEdge));
    }
    /** Paint precomputed geometric contours with a shared aligned pattern palette. */
    function buildSurfacePatterns(o, emitSurface) {
        const [left, top, right, bottom] = o.bounds;
        if (!(right > left && bottom > top))
            return '';
        const used = new Set();
        let hash1 = 2166136261, hash2 = 5381;
        const hash = (text) => { for (let i = 0; i < text.length; i++) {
            const n = text.charCodeAt(i);
            hash1 = Math.imul(hash1 ^ n, 16777619);
            hash2 = Math.imul(hash2, 33) ^ n;
        } };
        hash(o.bounds.join(',') + ',' + o.pitch + o.silhouette);
        function collect(layer) {
            hash(layer.clip);
            layer.tones.forEach((path, i) => { hash(path); if (path && path !== layer.tones[i + 1])
                used.add(i + 1); });
            if (layer.shadow)
                collect(layer.shadow);
        }
        o.layers.forEach(collect);
        if (!used.size)
            return '';
        const prefix = 'mp-screen-' + (hash1 >>> 0).toString(16) + (hash2 >>> 0).toString(16);
        const defs = [`<clipPath id="${prefix}-surface" clipPathUnits="userSpaceOnUse">${o.silhouette}</clipPath>`];
        for (const level of [...used].sort((a, b) => a - b)) {
            const ink = level / LEVELS, r = o.pitch * halftoneRadiusRatio(ink), dots = [], wrap = r > o.pitch / 2 ? 1 : 0;
            for (let y = -wrap; y <= wrap; y++)
                for (let x = -wrap; x <= wrap; x++)
                    dots.push(`<circle cx="${fmt$1((x + .5) * o.pitch)}" cy="${fmt$1((y + .5) * o.pitch)}" r="${fmt$1(r)}"/>`);
            defs.push(`<pattern id="${prefix}-${level}" data-coverage="${ink}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0" width="${fmt$1(o.pitch)}" height="${fmt$1(o.pitch)}" patternTransform="rotate(45)" overflow="hidden"><g fill="#161616" stroke="none">${dots.join('')}</g></pattern>`);
        }
        function clip(id, path) { defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" fill-rule="evenodd" d="${path}"/></clipPath>`); }
        function paint(layer, index) {
            const [left, top, right, bottom] = layer.bounds || o.bounds;
            let body = '';
            layer.tones.forEach((path, i) => {
                if (!path || path === layer.tones[i + 1])
                    return;
                const id = prefix + '-tone-' + index + '-' + i;
                clip(id, path);
                body += `<rect data-tone-level="${i + 1}" x="${fmt$1(left)}" y="${fmt$1(top)}" width="${fmt$1(right - left)}" height="${fmt$1(bottom - top)}" fill="url(#${prefix}-${i + 1})" clip-path="url(#${id})"/>`;
            });
            if (layer.shadow)
                body += paint(layer.shadow, index + 's');
            if (body && layer.clip) {
                const id = prefix + '-face-' + index;
                clip(id, layer.clip);
                body = `<g clip-path="url(#${id})">${body}</g>`;
            }
            return body;
        }
        if (emitSurface) {
            for (const [i, layer] of o.layers.entries()) {
                if (layer.sourceId === undefined || !Number.isSafeInteger(layer.sourceId) || layer.sourceId < 0)
                    throw new Error('Per-surface patterns require a primitive sourceId');
                const body = paint(layer, String(i));
                emitSurface(layer.sourceId, `<g data-role="dots" data-mode="halftone" data-renderer="pattern" data-tone-method="${o.method}" data-tone-levels="${LEVELS}" stroke="none"><g clip-path="url(#${prefix}-surface)">${body}</g></g>`);
            }
            return `<defs>${defs.join('')}</defs>`;
        }
        const body = o.layers.map((layer, i) => paint(layer, String(i))).join('');
        return `<g data-role="dots" data-mode="halftone" data-renderer="pattern" data-tone-method="${o.method}" data-tone-levels="${LEVELS}" stroke="none"><defs>${defs.join('')}</defs><g clip-path="url(#${prefix}-surface)">${body}</g></g>`;
    }

    const TAU$1 = 2 * Math.PI, EPS = Number.EPSILON;
    function overlaps(a, b) {
        return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
    }
    function box(edges) {
        const b = [Infinity, Infinity, -Infinity, -Infinity];
        for (const e of edges)
            for (let k = 0; k < 4; k++)
                b[k] = k < 2 ? Math.min(b[k], e.bounds[k]) : Math.max(b[k], e.bounds[k]);
        return b;
    }
    function index(edges) {
        const bounds = box(edges);
        if (edges.length <= 12)
            return { bounds, edges };
        const axis = bounds[2] - bounds[0] >= bounds[3] - bounds[1] ? 0 : 1;
        edges.sort((a, b) => (a.bounds[axis] + a.bounds[axis + 2]) - (b.bounds[axis] + b.bounds[axis + 2]));
        const half = edges.length >>> 1;
        return { bounds, left: index(edges.slice(0, half)), right: index(edges.slice(half)) };
    }
    function visit(node, bounds, fn) {
        if (!overlaps(node.bounds, bounds))
            return;
        if (node.edges) {
            for (const e of node.edges)
                if (overlaps(e.bounds, bounds))
                    fn(e);
        }
        else {
            visit(node.left, bounds, fn);
            visit(node.right, bounds, fn);
        }
    }
    function intervals(cuts, at, contains, accept) {
        cuts.sort((a, b) => a - b);
        const result = [];
        for (let i = 1; i < cuts.length; i++) {
            const a = cuts[i - 1], b = cuts[i];
            if (!(b > a))
                continue;
            const midpoint = a + (b - a) / 2;
            if (accept && !accept(midpoint))
                continue;
            const p = at(midpoint);
            if (!contains(p[0], p[1]))
                continue;
            const last = result[result.length - 1];
            // Merge only exactly adjacent accepted bins, never across a small hole.
            if (last && last[1] === a)
                last[1] = b;
            else
                result.push([a, b]);
        }
        return result;
    }
    function valid(p) { return Number.isFinite(p[0]) && Number.isFinite(p[1]); }
    /** The edges must describe complete closed contours. Orientation is irrelevant.
     * Bounds are [minX,minY,maxX,maxY]; a supplied box is conservatively enlarged.
     * Boundaries belong to the region, including a line coincident with an edge.
     */
    function createRegion(input, bounds) {
        const edges = [];
        for (const e of input) {
            if (!valid(e.p) || !valid(e.q))
                throw new Error('Non-finite region edge');
            const p = e.p.slice(0, 2), q = e.q.slice(0, 2);
            if (p[0] === q[0] && p[1] === q[1])
                continue;
            edges.push({ p, q, bounds: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])] });
        }
        const root = index(edges), regionBounds = root.bounds.slice();
        function contains(x, y) {
            if (!Number.isFinite(x) || !Number.isFinite(y) || !overlaps(root.bounds, [x, y, x, y]))
                return false;
            let inside = false, boundary = false;
            visit(root, [x, y, Infinity, y], e => {
                const [px, py] = e.p, [qx, qy] = e.q, dx = qx - px, dy = qy - py;
                const cross = (x - px) * dy - (y - py) * dx;
                const tolerance = 8 * EPS * (Math.abs((x - px) * dy) + Math.abs((y - py) * dx));
                if (x >= e.bounds[0] && x <= e.bounds[2] && Math.abs(cross) <= tolerance)
                    boundary = true;
                if ((py > y) !== (qy > y) && x < px + (y - py) * dx / dy)
                    inside = !inside;
            });
            return boundary || inside;
        }
        function clipEllipse(c, u, v, candidates, cuts = [0, 1], accept) {
            if (!valid(c) || !valid(u) || !valid(v))
                return null;
            const scale = Math.max(Math.abs(u[0]), Math.abs(u[1]), Math.abs(v[0]), Math.abs(v[1]));
            if (!(scale > 0) || scale > 1e150 || scale < 1e-150)
                return null;
            const ux = u[0] / scale, uy = u[1] / scale, vx = v[0] / scale, vy = v[1] / scale;
            const det = ux * vy - uy * vx;
            if (Math.abs(det) < 1e-12)
                return null;
            const rx = Math.hypot(u[0], v[0]), ry = Math.hypot(u[1], v[1]);
            const extent = Math.max(root.bounds[2] - root.bounds[0], root.bounds[3] - root.bounds[1]);
            if (edges.length && (scale > Math.max(extent, 1e-150) * 1e10 || Math.max(Math.abs(c[0]), Math.abs(c[1])) * EPS > scale * 1e-6))
                return null;
            const eb = [c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry];
            if (!edges.length || !overlaps(root.bounds, eb))
                return [];
            let unsafe = false;
            function inverse(p) {
                const x = (p[0] - c[0]) / scale, y = (p[1] - c[1]) / scale;
                return [(vy * x - vx * y) / det, (ux * y - uy * x) / det];
            }
            function intersect(e) {
                const p = inverse(e.p), q = inverse(e.q), dx = q[0] - p[0], dy = q[1] - p[1], length = Math.hypot(dx, dy);
                if (!valid(p) || !valid(q) || !(length > 0) || Math.max(Math.hypot(...p), Math.hypot(...q)) > 1e8) {
                    unsafe = true;
                    return;
                }
                const ex = dx / length, ey = dy / length;
                // Unit-speed segment in the inverse ellipse frame meets the unit circle.
                // D = 1 - cross(p,e)^2 avoids cancellation of b*b - a*c.
                const b = p[0] * ex + p[1] * ey, h = p[0] * ey - p[1] * ex;
                let d = (1 - Math.abs(h)) * (1 + Math.abs(h));
                if (d < -32 * EPS * Math.max(1, h * h))
                    return;
                d = Math.max(0, d);
                const r = Math.sqrt(d), stable = -b - (b < 0 ? -r : r), norm = Math.hypot(p[0], p[1]);
                const roots = stable === 0 ? [-b] : [stable, (norm - 1) * (norm + 1) / stable];
                for (const s of roots) {
                    const t = s / length;
                    if (t < -32 * EPS || t > 1 + 32 * EPS)
                        continue;
                    const f = Math.max(0, Math.min(1, t));
                    let angle = Math.atan2(p[1] + f * dy, p[0] + f * dx) / TAU$1;
                    if (angle < 0)
                        angle += 1;
                    cuts.push(angle);
                }
            }
            if (candidates) {
                for (const edge of candidates)
                    if (overlaps(edge.bounds, eb))
                        intersect(edge);
            }
            else
                visit(root, eb, intersect);
            if (unsafe)
                return null;
            return intervals(cuts, t => {
                const a = TAU$1 * t, co = Math.cos(a), si = Math.sin(a);
                return [c[0] + u[0] * co + v[0] * si, c[1] + u[1] * co + v[1] * si];
            }, contains, accept);
        }
        return {
            bounds: Object.freeze(regionBounds), contains,
            clipEllipse,
            sphereFamily(c, r, axis, e, f) {
                const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                const basis = [axis, e, f];
                if (!valid(c) || !(r > 0) || !Number.isFinite(r) || r < 1e-150 || r > 1e150 ||
                    basis.some(a => a.length < 3 || !a.slice(0, 3).every(Number.isFinite) || Math.abs(dot(a, a) - 1) > 1e-9) ||
                    Math.abs(dot(axis, e)) > 1e-9 || Math.abs(dot(axis, f)) > 1e-9 || Math.abs(dot(e, f)) > 1e-9 ||
                    Math.abs(e[0] * f[1] - e[1] * f[0]) < 1e-12)
                    return () => null;
                // Retain an immutable family chart even if the caller reuses its vectors.
                const center = c.slice(0, 2), a = axis.slice(0, 3), u = e.slice(0, 3), v = f.slice(0, 3);
                const count = Math.max(32, Math.min(1024, Math.ceil(Math.sqrt(edges.length) * 8)));
                const bins = Array.from({ length: count }, () => []);
                const bin = (h) => Math.max(0, Math.min(count - 1, Math.floor((h + 1) * .5 * count)));
                let refs = 0;
                for (const edge of edges) {
                    const px = (edge.p[0] - center[0]) / r, py = (edge.p[1] - center[1]) / r;
                    const qx = (edge.q[0] - center[0]) / r, qy = (edge.q[1] - center[1]) / r;
                    const dx = qx - px, dy = qy - py, length2 = dx * dx + dy * dy;
                    if (![px, py, qx, qy, length2].every(Number.isFinite))
                        return () => null;
                    const t = length2 > 0 ? Math.max(0, Math.min(1, -(px * dx + py * dy) / length2)) : 0;
                    const near2 = (px + t * dx) ** 2 + (py + t * dy) ** 2;
                    const far2 = Math.max(px * px + py * py, qx * qx + qy * qy);
                    // Outward error covers rounded silhouette vertices, including segments
                    // with endpoints just outside the sphere but interior points inside it.
                    const error = 64 * EPS * Math.max(1, far2);
                    if (near2 > 1 + error)
                        continue;
                    const zlo = Math.sqrt(Math.max(0, 1 - far2 - error));
                    const zhi = Math.sqrt(Math.max(0, 1 - near2 + error));
                    const hp = a[0] * px + a[1] * py, hq = a[0] * qx + a[1] * qy;
                    const padding = 1e-8 + 128 * EPS * Math.max(1, Math.abs(hp), Math.abs(hq));
                    const low = Math.min(hp, hq) + Math.min(a[2] * zlo, a[2] * zhi) - padding;
                    const high = Math.max(hp, hq) + Math.max(a[2] * zlo, a[2] * zhi) + padding;
                    if (high < -1 || low > 1)
                        continue;
                    const first = bin(low), last = bin(high);
                    refs += last - first + 1;
                    // Bound chart memory; parent can use its generic fallback for pathological
                    // long crossing edges instead of retaining millions of duplicate refs.
                    if (refs > 2000000)
                        return () => null;
                    for (let i = first; i <= last; i++)
                        bins[i].push(edge);
                }
                return h => {
                    if (!Number.isFinite(h) || Math.abs(h) > 1)
                        return null;
                    const radial = Math.sqrt(Math.max(0, (1 - h) * (1 + h))), radius = r * radial;
                    if (!(radius > 0))
                        return null;
                    const c = [center[0] + r * h * a[0], center[1] + r * h * a[1]];
                    const eu = [radius * u[0], radius * u[1]], ev = [radius * v[0], radius * v[1]];
                    const z0 = h * a[2], zc = radial * u[2], zs = radial * v[2], amplitude = Math.hypot(zc, zs);
                    const cuts = [0, 1];
                    if (amplitude > 0 && Math.abs(z0) <= amplitude) {
                        const phase = Math.atan2(zs, zc), alpha = Math.acos(Math.max(-1, Math.min(1, -z0 / amplitude)));
                        for (const angle of [phase - alpha, phase + alpha]) {
                            const t = angle / TAU$1;
                            cuts.push(t - Math.floor(t));
                        }
                    }
                    // The height index contains only front-lift intersections. Explicit
                    // silhouette cuts prevent an uncut back arc from becoming visible.
                    return clipEllipse(c, eu, ev, bins[bin(h)], cuts, t => z0 + zc * Math.cos(TAU$1 * t) + zs * Math.sin(TAU$1 * t) >= 0);
                };
            },
            clipLine(a, b) {
                if (!valid(a) || !valid(b))
                    return [];
                const dx = b[0] - a[0], dy = b[1] - a[1];
                if (dx === 0 && dy === 0)
                    return contains(a[0], a[1]) ? [[0, 1]] : [];
                const cuts = [0, 1], lb = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
                if (!overlaps(root.bounds, lb))
                    return [];
                visit(root, lb, e => {
                    const ex = e.q[0] - e.p[0], ey = e.q[1] - e.p[1], px = e.p[0] - a[0], py = e.p[1] - a[1];
                    const det = dx * ey - dy * ex;
                    if (det !== 0) {
                        const t = (px * ey - py * ex) / det, s = (px * dy - py * dx) / det;
                        if (t >= 0 && t <= 1 && s >= 0 && s <= 1)
                            cuts.push(t);
                    }
                    else if (px * dy - py * dx === 0) {
                        // Both overlap endpoints are cuts; midpoint classification handles
                        // coincident segments without parity toggles or invented bridges.
                        const axis = Math.abs(dx) >= Math.abs(dy) ? 0 : 1, delta = axis === 0 ? dx : dy;
                        cuts.push(Math.max(0, Math.min(1, (e.p[axis] - a[axis]) / delta)), Math.max(0, Math.min(1, (e.q[axis] - a[axis]) / delta)));
                    }
                });
                return intervals(cuts, t => [a[0] + dx * t, a[1] + dy * t], contains);
            }
        };
    }
    /** Parse only local absolute M/L/Z contours. Reject open/unsupported paths
     * instead of silently closing them or losing a hole. Empty paths are empty.
     */
    function regionFromPath(path) {
        const token = /[MLZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
        const tokens = [];
        let end = 0;
        for (const match of path.matchAll(token)) {
            if (!/^[\s,]*$/.test(path.slice(end, match.index)))
                throw new Error('Unsupported region path');
            tokens.push(match[0]);
            end = match.index + match[0].length;
        }
        if (!/^[\s,]*$/.test(path.slice(end)))
            throw new Error('Unsupported region path');
        const edges = [];
        let first = null, prev = null, command = '', i = 0;
        while (i < tokens.length) {
            if (/^[MLZ]$/.test(tokens[i]))
                command = tokens[i++];
            if (command === 'Z') {
                if (!first || !prev)
                    throw new Error('Unmatched region close');
                edges.push({ p: prev, q: first });
                first = prev = null;
                command = '';
                continue;
            }
            if ((command !== 'M' && command !== 'L') || i + 1 >= tokens.length || /^[MLZ]$/.test(tokens[i]) || /^[MLZ]$/.test(tokens[i + 1]))
                throw new Error('Malformed region path');
            const p = [Number(tokens[i++]), Number(tokens[i++])];
            if (!valid(p))
                throw new Error('Non-finite region path');
            if (command === 'M') {
                if (prev)
                    throw new Error('Open region contour');
                first = prev = p;
                command = 'L';
            }
            else {
                if (!prev)
                    throw new Error('Missing region move');
                edges.push({ p: prev, q: p });
                prev = p;
            }
        }
        if (prev)
            throw new Error('Open region contour');
        return createRegion(edges);
    }

    /** One visible-region index and one lazily extracted binary shadow per surface.
     * Discovery is local and resolution-limited; no ray tracing in subsequent
     * texture queries. Shadows retain the halftone backend's 2/1 SVG-unit grid. */
    function createSurfaceAtlas(prepared, regions, o) {
        const { scene, project, scale, unshadowedIllumination } = prepared, origin = project([0, 0, 0]);
        const ids = new Map(scene.map((s, i) => [s, i])), empty = regionFromPath('');
        const shadowCache = new Map(), lightCache = new Map();
        const stats = { shadowBuilds: 0, shadowSamples: 0 };
        const visible = (s) => { const id = ids.get(s); return id === undefined ? null : regions.surface?.(id) || null; };
        function shadow(s) {
            const cached = shadowCache.get(s);
            if (cached)
                return cached;
            const face = visible(s);
            if (!face || !prepared.mayShadow(s)) {
                shadowCache.set(s, empty);
                return empty;
            }
            const b = face.bounds, bounds = [Math.max(-8, b[0]), Math.max(-8, b[1]), Math.min(o.width + 8, b[2]), Math.min(o.height + 8, b[3])];
            const physical = prepared.lightingFor(s);
            const directional = o.lightType === 'directional' ? prepared.directionalShadows() : null, id = ids.get(s);
            const sample = (x, y) => {
                stats.shadowSamples++;
                const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale, z = depthAt(s, wx, wy);
                if (!Number.isFinite(z))
                    return 0;
                const p = [wx, wy, z];
                let n;
                if (s.kind === 'sphere')
                    n = p.map((v, i) => (v - s.c[i]) / s.r);
                else {
                    const q = p.map((v, i) => v - s.a[i]), t = q.reduce((a, v, i) => a + v * s.u[i], 0);
                    if (t < 1e-7)
                        n = s.u.map(v => -v);
                    else if (t > s.length - 1e-7)
                        n = s.u.slice();
                    else {
                        const r = q.map((v, i) => v - t * s.u[i]), length = Math.hypot(...r);
                        n = length ? r.map(v => v / length) : [0, 0, 1];
                    }
                }
                return directional ? (directional.shadowed(id, n, p) ? 1 : 0) : (physical(n, p) < unshadowedIllumination(n, p) ? 1 : 0);
            };
            const path = sampledTonePaths(bounds, sample, o.quality === 'preview' ? 2 : 1, [.5], true)[0];
            const result = regionFromPath(path);
            shadowCache.set(s, result);
            stats.shadowBuilds++;
            return result;
        }
        function lightingFor(s) {
            const cached = lightCache.get(s);
            if (cached)
                return cached;
            if (!prepared.mayShadow(s)) {
                lightCache.set(s, unshadowedIllumination);
                return unshadowedIllumination;
            }
            const region = shadow(s);
            const light = (n, p) => {
                let lit = unshadowedIllumination(n, p);
                const xy = project(p);
                if (region.contains(xy[0], xy[1]))
                    lit = (Math.max(-1, Math.min(1, lit)) + 1) * (1 - o.shadowStrength) - 1;
                return lit;
            };
            lightCache.set(s, light);
            return light;
        }
        return { visible, shadow, lightingFor, stats };
    }

    const TAU = 2 * Math.PI;
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const mul = (a, k) => a.map(x => x * k);
    const add = (a, b) => a.map((x, i) => x + b[i]);
    const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
    ];
    const positiveAngle = (t) => ((t % TAU) + TAU) % TAU;
    const clamp$1 = (x) => Math.max(-1, Math.min(1, x));
    const fmt = (p) => `${p[0].toFixed(4)} ${p[1].toFixed(4)}`;
    /** Affine (orthographic) projection preserves these circle/ellipse controls. */
    function ellipse(project, center, u, v) {
        const c = project(center), pu = project(add(center, u)), pv = project(add(center, v));
        const U = [pu[0] - c[0], pu[1] - c[1]], V = [pv[0] - c[0], pv[1] - c[1]];
        return {
            at: t => [c[0] + U[0] * Math.cos(t) + V[0] * Math.sin(t),
                c[1] + U[1] * Math.cos(t) + V[1] * Math.sin(t)],
            tangent: t => [-U[0] * Math.sin(t) + V[0] * Math.cos(t),
                -U[1] * Math.sin(t) + V[1] * Math.cos(t)],
        };
    }
    /** Optional anchors make adjoining carriers use identical intersection points. */
    function arc(e, start, end, first, last) {
        const count = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 4)));
        const step = (end - start) / count, k = 4 / 3 * Math.tan(step / 4);
        let out = '', p = first ?? e.at(start);
        for (let i = 0; i < count; i++) {
            const a = start + i * step, b = i === count - 1 ? end : start + (i + 1) * step;
            const q = i === count - 1 && last ? last : e.at(b);
            const da = e.tangent(a), db = e.tangent(b);
            out += `C${fmt([p[0] + k * da[0], p[1] + k * da[1]])} ${fmt([q[0] - k * db[0], q[1] - k * db[1]])} ${fmt(q)}`;
            p = q;
        }
        return out;
    }
    function full(e) {
        const p = e.at(0);
        return `M${fmt(p)}${arc(e, 0, TAU, p, p)}Z`;
    }
    /**
     * Closed analytic directional-light tone boundaries, for SVG fill-rule="evenodd".
     * Coordinates/normals are in view space (+z faces the viewer); project must be
     * affine/orthographic. Occlusion is deliberately left to the caller's clip path.
     * Circular arcs use standard cubic approximations spanning at most pi/4.
     * A zero/nonfinite light or NaN threshold produces an empty path.
     */
    function directionalTonePath(s, project, light, threshold) {
        const lightLength = Math.hypot(light[0], light[1], light[2]);
        if (!(lightLength > 0) || !Number.isFinite(lightLength) || Number.isNaN(threshold) || !(s.r > 0))
            return '';
        const L = mul(light, 1 / lightLength), T = threshold;
        if (s.kind === 'sphere') {
            if (T <= -1)
                return '';
            const rim = ellipse(project, s.c, [s.r, 0, 0], [0, s.r, 0]);
            if (T >= 1)
                return full(rim);
            const h = Math.hypot(L[0], L[1]), q = Math.sqrt((1 - T) * (1 + T));
            const e = h > 0 ? [-L[1] / h, L[0] / h, 0] : [1, 0, 0];
            const f = cross(L, e);
            const iso = ellipse(project, add(s.c, mul(L, s.r * T)), mul(e, s.r * q), mul(f, s.r * q));
            // Axial T=0 has coincident rim/isocircle: do not XOR the rim with itself.
            if (h === 0) {
                if (L[2] > 0)
                    return T <= 0 ? '' : full(rim) + full(iso);
                return T >= 0 ? full(rim) : full(iso);
            }
            if (Math.abs(T) < h) {
                const phi = Math.atan2(L[1], L[0]), alpha = Math.acos(clamp$1(T / h));
                // This increasing equator arc contains phi+pi, the darkest rim point.
                const a = phi + alpha, b = phi + TAU - alpha;
                const n0 = [Math.cos(a), Math.sin(a), 0], n1 = [Math.cos(b), Math.sin(b), 0];
                const p0 = project(add(s.c, mul(n0, s.r))), p1 = project(add(s.c, mul(n1, s.r)));
                // n dot e/f = q cos/sin(t); the center T*L is perpendicular to e/f.
                const t0 = Math.atan2(dot(n1, f), dot(n1, e));
                const t1 = Math.atan2(dot(n0, f), dot(n0, e));
                let sweep = positiveAngle(t1 - t0);
                const mid = t0 + sweep / 2;
                if (T * L[2] + q * (e[2] * Math.cos(mid) + f[2] * Math.sin(mid)) < 0)
                    sweep -= TAU;
                return `M${fmt(p0)}${arc(rim, a, b, p0, p1)}${arc(iso, t0, t0 + sweep, p1, p0)}Z`;
            }
            // No transverse crossings (including tangency): each entire boundary is
            // either eligible or hidden. Center z decides frontness here; using it
            // avoids cancellation in min-z at a tangent. Evenodd gives holes or caps.
            let out = T >= h ? full(rim) : '';
            if (T * L[2] > 0)
                out += full(iso);
            return out;
        }
        // Primitive cylinder axes are unit vectors, as required by the scene model.
        const u = s.u, h = Math.hypot(u[0], u[1]);
        const e = h > 0 ? [-u[1] / h, u[0] / h, 0] : [1, 0, 0];
        const f = cross(u, e), b = add(s.a, mul(u, s.length));
        const ca = ellipse(project, s.a, mul(e, s.r), mul(f, s.r));
        const cb = ellipse(project, b, mul(e, s.r), mul(f, s.r));
        let out = '';
        if (h > 0 && s.length > 0) {
            // f.z=h, so precisely theta in [0,pi] faces the viewer.
            const A = dot(e, L), B = dot(f, L), R = Math.hypot(A, B);
            const cuts = [0, Math.PI];
            if (R > 0 && Math.abs(T) < R) {
                const phase = Math.atan2(B, A), delta = Math.acos(clamp$1(T / R));
                for (const base of [phase - delta, phase + delta]) {
                    const t = positiveAngle(base);
                    if (t > 0 && t < Math.PI)
                        cuts.push(t);
                }
            }
            // A tangent root does not change interval eligibility and needs no split.
            cuts.sort((x, y) => x - y);
            for (let i = 1; i < cuts.length; i++) {
                const t0 = cuts[i - 1], t1 = cuts[i], mid = (t0 + t1) / 2;
                if (!(t1 > t0) || A * Math.cos(mid) + B * Math.sin(mid) > T)
                    continue;
                // At an exact minimum, only a generator is eligible (zero filled area).
                if (R > 0 && T <= -R)
                    continue;
                const a0 = ca.at(t0), b0 = cb.at(t0), b1 = cb.at(t1), a1 = ca.at(t1);
                out += `M${fmt(a0)}L${fmt(b0)}${arc(cb, t0, t1, b0, b1)}L${fmt(a1)}${arc(ca, t1, t0, a1, a0)}Z`;
            }
        }
        // End-on cylinders intentionally contribute only the visible planar cap.
        const axialLight = dot(u, L);
        if (u[2] > 0 && axialLight <= T)
            out += full(cb);
        if (u[2] < 0 && -axialLight <= T)
            out += full(ca);
        return out;
    }

    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    function hash(x, y, salt) {
        let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 1274126177);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function buildDots(scene, depthAt, project, scale, illumination, options, regions = null, referenceCoverage, surfaces) {
        const o = { shadingMode: 'stipple', dotSpacing: 2.5, dotSize: .5, dotContrast: 1.2, ...options };
        if (!['stipple', 'halftone'].includes(o.shadingMode))
            throw new Error('Invalid dot mode');
        if (!Number.isFinite(o.dotSpacing) || o.dotSpacing < .3 || o.dotSpacing > 19 || !Number.isFinite(o.dotSize) || o.dotSize < 0 || o.dotSize > 4 || !Number.isFinite(o.dotContrast) || o.dotContrast < .5 || o.dotContrast > 2.5)
            throw new Error('Invalid dot settings');
        if (!(scale > 0) || !Number.isFinite(scale))
            throw new Error('Invalid scale');
        if (o.dotSize === 0 || scene.length === 0)
            return '';
        const origin = project([0, 0, 0]), g = o.dotSpacing;
        const maxRadius = o.dotSize;
        const fineScale = Math.min(1, o.dotSize), minRadius = .03 * fineScale;
        const shapes = scene.map((s, id) => {
            const a = project(s.kind === 'sphere' ? s.c : s.a);
            const b = s.kind === 'sphere' ? a : project(s.a.map((v, i) => v + s.u[i] * s.length));
            const r = s.r * scale;
            return { s, id, b: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r] };
        });
        const minX = Math.min(...shapes.map(s => s.b[0])), minY = Math.min(...shapes.map(s => s.b[1]));
        const maxX = Math.max(...shapes.map(s => s.b[2])), maxY = Math.max(...shapes.map(s => s.b[3]));
        function hit(x, y, queryRadius = maxRadius * 1.03) {
            const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale;
            if (regions && o.shadingMode !== 'halftone') {
                // Visibility/occlusion is already solved. The one surface intersection
                // below only reconstructs this known owner's position for its normal.
                const region = regions.query(x, y, queryRadius);
                if (!region)
                    return null;
                const s = scene[region.id], z = depthAt(s, wx, wy);
                return Number.isFinite(z) ? { id: region.id, s, p: [wx, wy, z], clearance: region.clearance } : null;
            }
            let best = -Infinity, item = null;
            for (const shape of shapes) {
                const b = shape.b;
                if (x < b[0] || y < b[1] || x > b[2] || y > b[3])
                    continue;
                const z = depthAt(shape.s, wx, wy);
                if (Number.isFinite(z) && z > best) {
                    best = z;
                    item = shape;
                }
            }
            return item ? { id: item.id, s: item.s, p: [wx, wy, best] } : null;
        }
        function normal(h) {
            const s = h.s, p = h.p;
            if (s.kind === 'sphere')
                return p.map((v, i) => (v - s.c[i]) / s.r);
            const q = p.map((v, i) => v - s.a[i]), t = q.reduce((sum, v, i) => sum + v * s.u[i], 0);
            if (t < 1e-7)
                return s.u.map(v => -v);
            if (t > s.length - 1e-7)
                return s.u.slice();
            const radial = q.map((v, i) => v - t * s.u[i]), length = Math.hypot(...radial);
            return length ? radial.map(v => v / length) : [0, 0, 1];
        }
        const dirs = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
        function safeRadius(x, y, r, owner) {
            // The whole sampled disk must stay on the same visible primitive, not
            // merely its center. Shrink at silhouettes and occlusion boundaries.
            // Two rings are a numerical footprint test, not an exact curve boolean.
            function fits(radius) {
                for (const k of [.5, 1])
                    for (const d of dirs) {
                        const h = hit(x + d[0] * radius * k, y + d[1] * radius * k);
                        if (!h || h.id !== owner)
                            return false;
                    }
                return true;
            }
            if (fits(r))
                return r;
            let lo = 0, hi = r;
            for (let i = 0; i < 9; i++) {
                const mid = (lo + hi) / 2;
                if (fits(mid))
                    lo = mid;
                else
                    hi = mid;
            }
            return lo;
        }
        // Normalize the MEAN, never the spatial pattern of the reference hatches.
        // Local tone depends only on smooth illumination, not line direction,
        // projected crowding, or the thresholds that turn hatch families on/off.
        const exponent = referenceCoverage ? o.dotContrast / 1.2 : o.dotContrast;
        const smoothTone = (lit) => Math.pow(clamp((1 - lit) / 2, 0, 1), exponent);
        const surfaceIllumination = surfaces?.illumination;
        const lightAt = (h, n) => surfaceIllumination ? surfaceIllumination(h.s, n, h.p) : illumination(n, h.p);
        let toneGain = 1;
        if (referenceCoverage) {
            const left = o.width === undefined ? minX : Math.max(0, minX), right = o.width === undefined ? maxX : Math.min(o.width, maxX);
            const top = o.height === undefined ? minY : Math.max(0, minY), bottom = o.height === undefined ? maxY : Math.min(o.height, maxY);
            const step = Math.max(2, (right - left) / 128, (bottom - top) / 128), tones = [];
            let target = 0;
            for (let y = top + .61 * step; y < bottom; y += step)
                for (let x = left + .37 * step; x < right; x += step) {
                    const h = hit(x, y);
                    if (!h)
                        continue;
                    const n = normal(h), lit = clamp(lightAt(h, n), -1, 1);
                    tones.push(smoothTone(lit));
                    target += clamp(referenceCoverage(h.s, n, lit), 0, 1);
                }
            const total = (gain) => tones.reduce((sum, t) => sum + Math.min(1, gain * t), 0);
            if (target === 0)
                toneGain = 0;
            else if (tones.length) {
                let lo = 0, hi = 1;
                while (hi < 1048576 && total(hi) < target)
                    hi *= 2;
                for (let i = 0; i < 24; i++) {
                    const mid = (lo + hi) / 2;
                    if (total(mid) < target)
                        lo = mid;
                    else
                        hi = mid;
                }
                toneGain = (lo + hi) / 2;
            }
        }
        function coverage(h) {
            const lit = clamp(lightAt(h, normal(h)), -1, 1);
            return clamp(toneGain * smoothTone(lit), 0, 1);
        }
        if (o.shadingMode === 'halftone') {
            if (toneGain === 0)
                return '';
            const bounds = [
                o.width === undefined ? minX : Math.max(0, minX), o.height === undefined ? minY : Math.max(0, minY),
                o.width === undefined ? maxX : Math.min(o.width, maxX), o.height === undefined ? maxY : Math.min(o.height, maxY)
            ];
            const layers = [];
            const thresholds = Array.from({ length: 16 }, (_, i) => (i + .5) / 16), brightness = o.shadingBrightness ?? 0;
            const step = o.quality === 'preview' ? 2 : 1;
            for (const { s, id, b } of shapes) {
                if (surfaces?.paths && !surfaces.paths[id])
                    continue;
                const visiblePath = surfaces?.paths?.[id] || '';
                const box = [Math.max(bounds[0], b[0]), Math.max(bounds[1], b[1]), Math.min(bounds[2], b[2]), Math.min(bounds[3], b[3])];
                // Exact visible paths' Bezier control hulls conservatively bound the
                // local work. Hidden surfaces and hidden parts need no tone sampling.
                if (visiblePath) {
                    const coords = (visiblePath.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || []).map(Number);
                    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
                    for (let i = 0; i < coords.length; i += 2) {
                        x0 = Math.min(x0, coords[i]);
                        x1 = Math.max(x1, coords[i]);
                        y0 = Math.min(y0, coords[i + 1]);
                        y1 = Math.max(y1, coords[i + 1]);
                    }
                    box[0] = Math.max(box[0], x0);
                    box[1] = Math.max(box[1], y0);
                    box[2] = Math.min(box[2], x1);
                    box[3] = Math.min(box[3], y1);
                }
                if (!(box[2] > box[0] && box[3] > box[1]))
                    continue;
                const onSurface = (x, y) => {
                    if (!visiblePath) {
                        const h = hit(x, y);
                        return h?.id === id ? h : null;
                    }
                    const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale, z = depthAt(s, wx, wy);
                    return Number.isFinite(z) ? { id, s, p: [wx, wy, z] } : null;
                };
                if (surfaces?.light && visiblePath) {
                    const light = surfaces.light;
                    const threshold = (ink) => 1 - 2 * Math.pow(ink / toneGain, 1 / exponent) - 2 * brightness;
                    const layer = { sourceId: id, clip: visiblePath, bounds: box, tones: thresholds.map(t => t > toneGain ? '' : directionalTonePath(s, project, light, threshold(t))) };
                    // Only one binary shadow contour is sampled locally. Its shaded tone
                    // boundaries remain analytic, with the shadow attenuation inverted.
                    if (surfaces.shadowed && surfaces.mayShadow?.[id]) {
                        const shadowed = surfaces.shadowed;
                        const mask = sampledTonePaths(box, (x, y) => { const h = onSurface(x, y); return h && shadowed(id, normal(h), h.p) ? 1 : 0; }, step, [.5], true)[0];
                        if (mask) {
                            const strength = o.shadowStrength ?? .8;
                            const constant = clamp(toneGain * smoothTone(clamp(-1 + 2 * brightness, -1, 1)), 0, 1);
                            layer.shadow = { sourceId: id, clip: mask, bounds: box, tones: thresholds.map(t => {
                                    if (strength >= 1)
                                        return constant >= t ? visiblePath : '';
                                    return t > toneGain ? '' : directionalTonePath(s, project, light, (threshold(t) + 1) / (1 - strength) - 1);
                                }) };
                        }
                    }
                    layers.push(layer);
                }
                else {
                    // Point-light attenuation, unsupported visibility arrangements, and
                    // custom low-level light callbacks stay local to each primitive.
                    layers.push({ sourceId: id, clip: visiblePath, bounds: box, tones: sampledTonePaths(box, (x, y) => { const h = onSurface(x, y); return h ? coverage(h) : null; }, step) });
                }
            }
            return buildSurfacePatterns({ bounds, pitch: g * Math.SQRT2 / 5, silhouette: projectedSilhouette(scene, project, scale), layers,
                method: surfaces?.paths ? (surfaces.light ? (surfaces.shadowed ? 'analytic-local-shadows' : 'analytic') : 'surface-sampled') : 'local-fallback' }, surfaces?.emitSurface);
        }
        const circles = [], batches = new Map() ;
        const emitSurface = surfaces?.emitSurface;
        const owners = new Map();
        let markCount = 0;
        function emit(x, y, certifiedCell = false, cellOwner = -1) {
            if (x < minX || y < minY || x > maxX || y > maxY)
                return;
            const h = certifiedCell ? null : hit(x, y);
            if (!certifiedCell && !h)
                return;
            let radius = o.dotSize;
            if (radius < minRadius)
                return;
            // Contract only near actual boundaries, not every interior mark: a global
            // radius contraction would silently reduce the calibrated coverage.
            const clearance = certifiedCell ? maxRadius * 1.03 : regions ? h.clearance : safeRadius(x, y, radius * 1.03, h.id);
            radius = Math.floor(Math.min(radius, Math.max(0, clearance * Math.cos(Math.PI / 16) - .003 * fineScale)) * 1000) / 1000;
            if (radius < minRadius)
                return;
            markCount++;
            let targetCircles = circles, targetBatches = batches;
            if (emitSurface) {
                const owner = certifiedCell ? cellOwner : h.id;
                let target = owners.get(owner);
                if (!target) {
                    target = { circles: [], batches: batches ? new Map() : null };
                    owners.set(owner, target);
                }
                targetCircles = target.circles;
                targetBatches = target.batches;
            }
            if (targetBatches) {
                let batch = targetBatches.get(radius);
                if (!batch) {
                    batch = [];
                    targetBatches.set(radius, batch);
                }
                batch.push(`M${x.toFixed(3)} ${y.toFixed(3)}h0`);
            }
            else
                targetCircles.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${radius.toFixed(3)}"/>`);
        }
        if (o.shadingMode === 'stipple' && toneGain > 0) {
            // Certify a whole candidate cell plus its largest disk once. Interior
            // Poisson marks then need neither owner/depth nor boundary-distance queries.
            const cellRadius = Math.SQRT1_2 * g + maxRadius * 1.03;
            const i0 = Math.floor(minX / g) - 1, i1 = Math.ceil(maxX / g) + 1, j0 = Math.floor(minY / g) - 1, j1 = Math.ceil(maxY / g) + 1;
            if ((i1 - i0 + 1) * (j1 - j0 + 1) > 1000000)
                throw new Error('Dot screen too large; increase spacing or reduce output size');
            for (let j = j0; j <= j1; j++)
                for (let i = i0; i <= i1; i++) {
                    const h = hit((i + .5) * g, (j + .5) * g, regions ? cellRadius : maxRadius * 1.03);
                    if (!h)
                        continue;
                    const certifiedCell = !!regions && h.clearance >= cellRadius - 1e-12;
                    // Equal-radius Poisson marks. Account for overlap using
                    // coverage = 1-exp(-numberDensity * diskArea), rather than adding areas.
                    const ink = Math.min(.995, coverage(h));
                    if (ink <= 0)
                        continue;
                    const mean = -Math.log1p(-ink) * g * g / (Math.PI * o.dotSize * o.dotSize);
                    if (mean > 1000)
                        throw new Error('Stipple density too high; increase dot size');
                    const stop = Math.exp(-mean);
                    let product = 1, count = 0;
                    while ((product *= 1 - hash(i, j, 100 + count)) > stop)
                        count++;
                    for (let k = 0; k < count; k++) {
                        emit((i + hash(i, j, 10000 + 2 * k)) * g, (j + hash(i, j, 10001 + 2 * k)) * g, certifiedCell, h.id);
                        if (markCount > 1000000)
                            throw new Error('Too many stipple marks; use a coarser texture');
                    }
                }
        }
        // SVG round caps on zero-length subpaths are exact disks. This batches
        // serialization/DOM nodes, not positions: there is no tile or repeated motif.
        if (emitSurface) {
            for (const [id, target] of owners) {
                if (target.batches)
                    for (const [r, points] of target.batches)
                        target.circles.push(`<path data-stipple-radius="${r.toFixed(3)}" fill="none" stroke="#161616" stroke-width="${(2 * r).toFixed(3)}" stroke-linecap="round" d="${points.join('')}"/>`);
                emitSurface(id, `<g data-role="dots" data-mode="stipple" fill="#161616" stroke="none">${target.circles.join('')}</g>`);
            }
            return '';
        }
        if (batches)
            for (const [r, points] of batches)
                circles.push(`<path data-stipple-radius="${r.toFixed(3)}" fill="none" stroke="#161616" stroke-width="${(2 * r).toFixed(3)}" stroke-linecap="round" d="${points.join('')}"/>`);
        return `<g data-role="dots" data-mode="${o.shadingMode}" fill="#161616" stroke="none">${circles.join('')}</g>`;
    }

    /** Expected projected hatch coverage, not a second illumination model.
     * Ignores individual stroke phase/taper and estimates crossings as independent.
     * Use its spatial average to calibrate smooth dot lighting, never its local
     * pattern as a lighting field. Small surfaces and silhouettes can still differ.
     */
    function hatchCoverage(scale, o) {
        const unit = (v) => { const d = Math.hypot(...v); return v.map(x => x / d); };
        const primary = unit([.12, 1, .40]), secondary = unit([1, .22, -0.32]);
        const density = o.density * scale / 60;
        const cap = (x) => Math.max(0, Math.min(1, x));
        return (s, n, light) => {
            const darkness = Math.pow(cap((1 - light) / 2), o.shadingContrast / 1.2);
            const lit = 1 - 2 * darkness;
            const widthFactor = o.variableWidth ? .4 + 1.15 * darkness : 1;
            const nz = Math.max(1e-4, Math.abs(n[2]));
            if (s.kind === 'sphere') {
                const family = (axis, count, width, active) => {
                    const gradient = Math.hypot(axis[0] - axis[2] * n[0] / nz, axis[1] - axis[2] * n[1] / nz) / (s.r * scale);
                    return cap(width * widthFactor * count * .5 * gradient * active);
                };
                const count = Math.max(2, Math.round(density * s.r / .48));
                const even = Math.floor((count - 1) / 2) / (count - 1);
                const active = (lit < .88 ? even : 0) + (lit < .58 ? 1 - even : 0);
                const a = family(primary, count, o.hatchWidth * .8, active);
                const b = o.crossHatch ? family(secondary, Math.max(2, Math.round(density * .8 * s.r / .48)), o.hatchWidth * .63, lit < .12 ? 1 : 0) : 0;
                return 1 - (1 - a) * (1 - b);
            }
            // Axial hatches do not cover the cylinder end caps.
            if (Math.abs(n.reduce((sum, v, i) => sum + v * s.u[i], 0)) > .99 || lit >= .65)
                return 0;
            const count = Math.max(3, Math.round(density * .8 * s.r / .115));
            const projectedAxis = Math.sqrt(Math.max(0, 1 - s.u[2] * s.u[2]));
            return cap(o.hatchWidth * .68 * widthFactor * count * projectedAxis / (2 * Math.PI * s.r * scale * nz));
        };
    }

    /** Already-normalized options; the public renderer owns eligibility/dispatch. */
    function renderFastPainter(molecule, o) {
        const { spheres, cylinders, project, scale, lightDirection, unshadowedIllumination } = prepareScene(molecule, o);
        const illumination = o.shadingBrightness === 0 ? unshadowedIllumination :
            (n, p) => Math.max(-1, Math.min(1, unshadowedIllumination(n, p) + 2 * o.shadingBrightness));
        const threshold = (limit) => 1 - 2 * Math.pow((1 - limit) / 2, 1 / (o.shadingContrast / 1.2)) - 2 * o.shadingBrightness;
        const fillFor = (element) => o.colorWash ? elementColor(element, o.washStrength, o.colorSaturation, o.colorScheme) : '#ffffff';
        // Geometry, styles AND title enter the namespace, including texture-only edits.
        let hash1 = 2166136261, hash2 = 5381;
        for (const ch of JSON.stringify([molecule, o])) {
            const n = ch.charCodeAt(0);
            hash1 = Math.imul(hash1 ^ n, 16777619);
            hash2 = Math.imul(hash2, 33) ^ n;
        }
        const prefix = 'fast-painter-' + (hash1 >>> 0).toString(16) + '-' + (hash2 >>> 0).toString(16);
        const definitions = [], layers = [], paths = [];
        const counts = { templates: 0, hatchCurves: 0, hatchPaths: 0, labels: 0, masks: 0, maskTiles: 0,
            visibleBonds: 0, emptyBonds: 0, containedBonds: 0, maskSamples: 0, atomDepthTests: 0, candidatePairs: 0 };
        const localProject = p => [p[0] * scale, -p[1] * scale];
        const neverVisible = () => { throw new Error('Fast painter must not query global visibility'); };
        const curve = createCurveRenderer({ options: o, project: localProject, illumination, paths, visible: neverVisible });
        const density = o.density * scale / 60, templates = new Map();
        const coverage = hatchCoverage(scale, o);
        const engraving = (body) => `<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
        // Reuse the standard texture engine with exactly ONE primitive. It cannot
        // perform sphere/sphere or bond/atom visibility here. Visibility is the outer
        // local clip. Global cell coordinates preserve nonrepeating stipple seeds.
        function dots(s, projection, namespace) {
            if (o.shadingMode === 'hatch' || o.dotSize === 0)
                return '';
            const center = s.kind === 'sphere' ? projection(s.c) : null;
            const regions = center ? { query: (x, y) => {
                    const clearance = s.r * scale - Math.hypot(x - center[0], y - center[1]);
                    return clearance >= 0 ? { id: 0, clearance } : null;
                } } : null;
            const a = projection(s.kind === 'sphere' ? s.c : s.a);
            const b = s.kind === 'sphere' ? a : projection(add$1(s.a, mul$1(s.u, s.length)));
            const r = s.r * scale, left = Math.min(a[0], b[0]) - r, top = Math.min(a[1], b[1]) - r;
            const right = Math.max(a[0], b[0]) + r, bottom = Math.max(a[1], b[1]) + r;
            // A full support rectangle selects analytic directional tones. buildDots
            // additionally clips against its EXACT projected single-primitive silhouette;
            // coordinate-pair bounds extraction there must not receive SVG arc operands.
            const support = `M${left} ${top}L${right} ${top}L${right} ${bottom}L${left} ${bottom}Z`;
            const result = buildDots([s], depthAt, projection, scale, illumination, o, regions, coverage, { paths: [support], light: lightDirection,
                illumination: (_source, n, p) => illumination(n, p) });
            // buildDots owns content-derived pattern IDs, but namespacing also separates
            // otherwise equal local geometry under different fast-painter options.
            return result.replace(/mp-screen-[\w-]+/g, id => namespace + '-' + id);
        }
        function sphereTemplate(radius) {
            const cached = templates.get(radius);
            if (cached !== undefined)
                return cached;
            paths.length = 0;
            function hatch(axis, count, secondary) {
                axis = norm(axis);
                const e = norm(cross$1(axis, [1, 0, 0])), f = cross$1(axis, e);
                for (let j = 1; j < count; j++) {
                    counts.hatchCurves++;
                    const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h), limit = secondary ? .12 : (j % 2 === 0 ? .88 : .58);
                    const center = mul$1(axis, h * radius), u = mul$1(e, r * radius), v = mul$1(f, r * radius);
                    const geometry = projectedCircle(localProject, center, u, v);
                    const front = trigSpans(-axis[2] * h, -r * e[2], -r * f[2], 1e-12);
                    const tonal = trigSpans(h * dot$1(axis, lightDirection), r * dot$1(e, lightDirection), r * dot$1(f, lightDirection), threshold(limit));
                    const spans = intersectSpans(front, tonal);
                    curve(t => {
                        const a = t * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
                        const n = axis.map((v, k) => v * h + (e[k] * cos + f[k] * sin) * r);
                        return { p: mul$1(n, radius), n };
                    }, Math.max(120, Math.ceil(2 * Math.PI * radius * scale * r / .7)), o.hatchWidth * (secondary ? .63 : .8), (n, _p, lit) => n[2] >= -1e-12 && lit < limit, true, true, () => front, { geometry, spans, illumination });
                }
            }
            if (o.shadingMode === 'hatch' && o.hatchWidth > 0) {
                hatch([.12, 1, .40], Math.max(2, Math.round(density * radius / .48)), false);
                if (o.crossHatch)
                    hatch([1, .22, -0.32], Math.max(2, Math.round(density * .8 * radius / .48)), true);
            }
            counts.hatchPaths += paths.length;
            const id = `${prefix}-texture-${counts.templates++}`;
            definitions.push(`<g id="${id}">${engraving(paths.join(''))}</g>`);
            templates.set(radius, id);
            return id;
        }
        for (const { s, id } of spheres.map((s, id) => ({ s, id })).sort((a, b) => a.s.c[2] - b.s.c[2] || a.id - b.id)) {
            const [x, y] = project(s.c), radius = s.r * scale, fill = fillFor(s.element);
            const circle = `cx="${x}" cy="${y}" r="${radius}"`, template = o.shadingMode === 'hatch' ? sphereTemplate(s.r) : null, clipId = `${prefix}-atom-${id}`;
            definitions.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><circle ${circle}/></clipPath>`);
            const texture = `<g clip-path="url(#${clipId})">${template ? `<use href="#${template}" transform="translate(${x} ${y})"/>` : ''}${dots(s, project, clipId)}</g>`;
            const outline = o.outlineWidth > 0 ? `<circle data-role="outline" ${circle} fill="none" stroke="#161616" stroke-width="${o.outlineWidth * 1.4}"/>` : '';
            const showLabel = o.labels && (o.labelHydrogens || s.element !== 'H');
            const label = showLabel ? `<text data-role="element-label" data-surface-id="${id}" x="${x.toFixed(2)}" y="${(y + o.labelSize * .3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${escapeXml(o.labelFont)}" font-style="${o.labelItalic ? 'italic' : 'normal'}" font-weight="${o.labelBold ? '700' : '400'}" stroke="${o.labelStrokeWidth === 0 ? 'none' : (o.labelMatchFill ? fill : o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${escapeXml(s.element)}</text>` : '';
            if (showLabel)
                counts.labels++;
            layers.push(`<g data-role="surface-layer" data-surface-id="${id}" data-atom-id="${id}"><circle data-role="surface-fill" ${circle} fill="${fill}" stroke="none"/>${texture}${outline}${label}</g>`);
        }
        const origin = project([0, 0, 0]), step = o.quality === 'preview' ? .5 : .25;
        const margin = Math.max(2, o.outlineWidth * 2, o.hatchWidth * 2, o.dotSize * 2);
        // Fail explicitly rather than coarsening or dropping bonds in huge scenes.
        const maskSampleBudget = 16000000;
        let discoveryBudget = 0;
        const atomBoxes = spheres.map(s => { const p = project(s.c), r = s.r * scale; return { s, b: [p[0] - r, p[1] - r, p[0] + r, p[1] + r] }; });
        const bondCurve = createCurveRenderer({ options: o, project, illumination, paths, visible: neverVisible });
        const bondOrder = cylinders.map((s, id) => ({ s, id, z: s.a[2] + s.u[2] * s.length / 2 })).sort((a, b) => a.z - b.z || a.id - b.id);
        for (const { s, id } of bondOrder) {
            counts.masks++;
            // Along a parent-centered cylinder, the entire radius-r cross section lies
            // inside its endpoint sphere for axial distance <= sqrt(R²-r²). If both
            // covered intervals meet, the WHOLE bond is inside their union, at any view.
            // This is bond/atom containment, not a sphere-pair intersection calculation.
            const endpoints = molecule.bonds[id].map(index => spheres[index]);
            const covered = endpoints.reduce((sum, atom) => sum + Math.sqrt(Math.max(0, atom.r * atom.r - s.r * s.r)), 0);
            if (endpoints.every(atom => atom.r > s.r) && covered > s.length + 1e-9) {
                counts.containedBonds++;
                counts.emptyBonds++;
                layers.push(`<g data-role="bond-layer" data-surface-id="${spheres.length + id}" data-bond-id="${id}" data-mask-empty="true" data-contained="true" data-mask-samples="0"/>`);
                continue;
            }
            const a = project(s.a), b = project(add$1(s.a, mul$1(s.u, s.length)));
            // Exact AABB of the closed projected cylinder (cap radii along x/y).
            const rx = s.r * scale * Math.sqrt(Math.max(0, 1 - s.u[0] ** 2));
            const ry = s.r * scale * Math.sqrt(Math.max(0, 1 - s.u[1] ** 2));
            const box = [Math.max(-margin, Math.min(a[0], b[0]) - rx), Math.max(-margin, Math.min(a[1], b[1]) - ry), Math.min(o.width + margin, Math.max(a[0], b[0]) + rx), Math.min(o.height + margin, Math.max(a[1], b[1]) + ry)];
            if (!box.every(Number.isFinite))
                throw new Error('Fast painter bond projection exceeds finite SVG coordinates');
            const candidates = atomBoxes.filter(({ b }) => b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1]);
            counts.candidatePairs += candidates.length;
            const before = counts.maskSamples;
            function sample(x, y) {
                if (++counts.maskSamples > maskSampleBudget)
                    throw new Error('Fast painter bond mask sample budget exceeded; reduce scale/output size or use precise mode');
                const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale, z = depthAt(s, wx, wy);
                if (!Number.isFinite(z))
                    return 0;
                for (const { s: atom, b } of candidates) {
                    if (x < b[0] || x > b[2] || y < b[1] || y > b[3])
                        continue;
                    counts.atomDepthTests++;
                    if (depthAt(atom, wx, wy) > z + 1e-9)
                        return 0;
                }
                return 1;
            }
            const maskPaths = [];
            // Each tile stays below sampledTonePaths' memory cap at either quality;
            // hence its discovery step NEVER silently grows with model/canvas size.
            // A one-step overlap closes tile borders safely. Separate SVG paths union
            // in clipPath (do not concatenate overlapping contours under evenodd).
            const tile = 64;
            for (let y = box[1]; y < box[3]; y += tile)
                for (let x = box[0]; x < box[2]; x += tile) {
                    const bounds = [Math.max(box[0], x - step), Math.max(box[1], y - step), Math.min(box[2], x + tile + step), Math.min(box[3], y + tile + step)];
                    discoveryBudget += (Math.ceil((bounds[2] - bounds[0]) / step) + 3) * (Math.ceil((bounds[3] - bounds[1]) / step) + 3);
                    if (discoveryBudget > maskSampleBudget)
                        throw new Error('Fast painter bond mask grid budget exceeded; reduce scale/output size or use precise mode');
                    counts.maskTiles++;
                    const path = sampledTonePaths(bounds, sample, step, [.5], true)[0];
                    if (path)
                        maskPaths.push(`<path fill-rule="evenodd" clip-rule="evenodd" d="${path}"/>`);
                }
            const surfaceId = spheres.length + id, clipId = `${prefix}-bond-${id}`;
            // Direct paths in clipPath avoid SVG 1.1 use-of-group clip restrictions.
            definitions.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${maskPaths.join('')}</clipPath>`);
            if (!maskPaths.length) {
                counts.emptyBonds++;
                layers.push(`<g data-role="bond-layer" data-surface-id="${surfaceId}" data-bond-id="${id}" data-mask-empty="true" data-mask-samples="${counts.maskSamples - before}"/>`);
                continue;
            }
            counts.visibleBonds++;
            paths.length = 0;
            const e = norm(cross$1(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$1(s.u, e);
            function line(n, width, engrave = false) {
                const offset = mul$1(n, s.r), start = add$1(s.a, offset), end = add$1(start, mul$1(s.u, s.length));
                const geometry = projectedLine(project, start, end);
                const spans = !engrave || dot$1(n, lightDirection) < threshold(.65) ? [[0, 1]] : [];
                bondCurve(t => ({ p: add$1(start, mul$1(s.u, t * s.length)), n }), Math.max(60, Math.ceil(s.length * scale / .7)), width, (_n, _p, lit) => !engrave || lit < .65, engrave, false, () => [[0, 1]], { geometry, spans, illumination, ignoreLighting: !engrave });
            }
            if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
                const edge = norm([-s.u[1], s.u[0], 0]);
                line(edge, o.outlineWidth * 1.1);
                line(mul$1(edge, -1), o.outlineWidth * 1.1);
            }
            const count = Math.max(3, Math.round(density * .8 * s.r / .115));
            for (let j = 0; o.shadingMode === 'hatch' && o.hatchWidth > 0 && j < count; j++) {
                const a = j / count * 2 * Math.PI, n = add$1(mul$1(e, Math.cos(a)), mul$1(f, Math.sin(a)));
                if (n[2] > 0)
                    line(n, o.hatchWidth * .68, true);
            }
            const fill = `<g data-role="surface-fill" fill="#ffffff" stroke="none">${maskPaths.map(path => path.replace('<path ', '<path data-role="bond-fill" ')).join('')}</g>`;
            const texture = dots(s, project, clipId);
            layers.push(`<g data-role="bond-layer" data-surface-id="${surfaceId}" data-bond-id="${id}" data-mask-empty="false" data-mask-samples="${counts.maskSamples - before}">${fill}<g clip-path="url(#${clipId})">${texture}${engraving(paths.join(''))}</g></g>`);
        }
        const stats = `data-render-mode="fast" data-sphere-count="${spheres.length}" data-bond-count="${cylinders.length}" data-bond-mask-count="${counts.masks}" data-bond-visible-count="${counts.visibleBonds}" data-bond-empty-count="${counts.emptyBonds}" data-bond-contained-count="${counts.containedBonds}" data-bond-mask-tiles="${counts.maskTiles}" data-bond-mask-samples="${counts.maskSamples}" data-bond-atom-depth-tests="${counts.atomDepthTests}" data-bond-atom-candidates="${counts.candidatePairs}" data-bond-mask-step="${step}" data-bond-mask-bisections="9" data-texture-templates="${counts.templates}" data-hatch-curves="${counts.hatchCurves}" data-hatch-paths="${counts.hatchPaths}" data-whole-labels="${counts.labels}" data-boundary-builds="0" data-sphere-pair-tests="0"`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="${prefix}-title" ${stats}><title id="${prefix}-title">${escapeXml(molecule.name || 'Molecular engraving')}</title><defs>${definitions.join('')}</defs><rect width="100%" height="100%" fill="white"/>${layers.join('')}</svg>`;
    }

    const atom = (element, x, y, z) => ({ element, position: [x, y, z] });
    // Idealized regular truncated icosahedron, not an optimized two-bond-length geometry.
    function fullerene() {
        const phi = (1 + Math.sqrt(5)) / 2, vertices = [];
        for (const s of [-1, 1])
            for (const t of [-1, 1])
                vertices.push([0, s, t * phi], [s, t * phi, 0], [t * phi, 0, s]);
        const positions = [], factor = 1.42 / (2 / 3);
        for (let i = 0; i < vertices.length; i++)
            for (let j = 0; j < vertices.length; j++) {
                if (Math.abs(Math.hypot(...sub(vertices[i], vertices[j])) - 2) < 1e-9)
                    positions.push(mul$1(add$1(mul$1(vertices[i], 2), vertices[j]), factor / 3));
            }
        const bonds = [];
        for (let i = 0; i < positions.length; i++)
            for (let j = i + 1; j < positions.length; j++)
                if (Math.abs(Math.hypot(...sub(positions[i], positions[j])) - 1.42) < 1e-9)
                    bonds.push([i, j]);
        return { name: '富勒烯 · C₆₀', atoms: positions.map(p => atom('C', p[0], p[1], p[2])), bonds };
    }
    const examples = {
        sphere: { name: '单球 · 明暗研究', atoms: [atom('C', 0, 0, 0)], bonds: [] },
        pair: { name: '双球 · 遮挡研究', atoms: [atom('C', -0.85, -0.25, -0.3), atom('O', .85, .25, .3)], bonds: [[0, 1]] },
        water: { name: '水 · H₂O', atoms: [atom('O', 0, .25, 0), atom('H', -0.78, -0.35, .1), atom('H', .78, -0.35, .1)], bonds: [[0, 1], [0, 2]] },
        ethanol: { name: '乙醇 · C₂H₆O', atoms: [atom('C', -1.22, 0, 0), atom('C', .12, .55, 0), atom('O', 1.28, -0.2, .15), atom('H', 2.02, .28, .15), atom('H', -1.3, -0.72, .8), atom('H', -1.95, .75, .1), atom('H', -1.38, -0.5, -0.92), atom('H', .2, 1.2, .88), atom('H', .22, 1.14, -0.92)], bonds: [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]] },
        c60: fullerene()
    };

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
    function fail(line, message) {
        throw new Error(`XYZ line ${line}: ${message}`);
    }
    function parseElement(token, line) {
        let symbol;
        if (/^\d+$/.test(token)) {
            const number = Number(token);
            if (!Number.isSafeInteger(number) || number < 1 || number > SYMBOLS.length) {
                return fail(line, 'unknown element: atomic number must be in 1–118');
            }
            symbol = SYMBOLS[number - 1];
        }
        else {
            if (!/^[A-Za-z]{1,2}$/.test(token))
                return fail(line, 'unknown element: expected a chemical symbol or atomic number');
            symbol = token[0].toUpperCase() + token.slice(1).toLowerCase();
            if (!SYMBOL_SET.has(symbol))
                return fail(line, `unknown chemical element ${symbol}`);
        }
        if (!Object.hasOwn(covalentRadii, symbol)) {
            return fail(line, `unsupported element ${symbol}: no sourced covalent radius available for rendering (supported: H–Cm, Z=1–96)`);
        }
        return symbol;
    }
    function parseCoordinate(token, line) {
        if (!DECIMAL.test(token))
            return fail(line, 'coordinates must be finite decimal/scientific numbers (not NaN, Inf or hexadecimal)');
        const value = Number(token.replace(/[dD]/, 'e'));
        if (!Number.isFinite(value))
            return fail(line, 'coordinates must be finite');
        if (Math.abs(value) > MAX_COORDINATE)
            return fail(line, 'coordinate exceeds the absolute limit of 1000000 angstrom');
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
    function parseXYZ(text, options = {}) {
        if (typeof text !== 'string')
            return fail(1, 'input must be text');
        if (text.length > MAX_TEXT_LENGTH)
            return fail(1, 'text exceeds the 2097152-character safety budget');
        if (options === null || typeof options !== 'object')
            return fail(1, 'options must be an object');
        const maxAtoms = options.maxAtoms ?? MAX_ATOMS;
        if (!Number.isSafeInteger(maxAtoms) || maxAtoms < 1 || maxAtoms > MAX_ATOMS) {
            return fail(1, 'maxAtoms must be a positive integer no greater than 2000');
        }
        if (options.name !== undefined && typeof options.name !== 'string')
            return fail(1, 'name must be a string');
        if (options.inferBonds !== undefined && typeof options.inferBonds !== 'boolean')
            return fail(1, 'inferBonds must be a boolean');
        let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
        let line = 0;
        const nextLine = () => {
            if (cursor >= text.length)
                return undefined;
            const start = cursor;
            while (cursor < text.length && text[cursor] !== '\n' && text[cursor] !== '\r')
                cursor++;
            const end = cursor;
            if (cursor < text.length) {
                if (text[cursor++] === '\r' && text[cursor] === '\n')
                    cursor++;
            }
            line++;
            return text.slice(start, end);
        };
        const header = nextLine()?.trim();
        if (header === undefined || !/^\d+$/.test(header))
            return fail(1, 'expected a positive integer atom count');
        const count = Number(header);
        if (!Number.isSafeInteger(count) || count < 1)
            return fail(1, 'expected a positive safe-integer atom count');
        if (count > maxAtoms)
            return fail(1, `declared atom count ${count} exceeds maxAtoms ${maxAtoms}`);
        const comment = nextLine();
        if (comment === undefined)
            return fail(2, 'missing mandatory comment line (use an empty line if unnamed)');
        if (/\bProperties\s*=/i.test(comment)) {
            return fail(2, 'extended XYZ Properties layouts are unsupported; convert to standard four-column element x y z XYZ (no reordered fields)');
        }
        const atoms = [];
        for (let i = 0; i < count; i++) {
            const record = nextLine();
            if (record === undefined)
                return fail(i + 3, `missing coordinate record ${i + 1} of ${count}`);
            // Limit the split too: a malformed long record never allocates many columns.
            const fields = record.trim().split(/\s+/, 5);
            if (fields.length !== 4)
                return fail(line, 'expected exactly four columns: element x y z; blank records and extra atom properties are unsupported');
            const element = parseElement(fields[0], line);
            atoms.push({ element, position: [
                    parseCoordinate(fields[1], line),
                    parseCoordinate(fields[2], line),
                    parseCoordinate(fields[3], line)
                ] });
        }
        for (let trailing = nextLine(); trailing !== undefined; trailing = nextLine()) {
            if (trailing.trim() !== '')
                return fail(line, 'unexpected trailing data: only one XYZ frame is supported (extra records/frames are not allowed)');
        }
        const bonds = [];
        if (options.inferBonds === true) {
            for (let i = 0; i < atoms.length; i++) {
                const a = atoms[i];
                for (let j = i + 1; j < atoms.length; j++) {
                    const b = atoms[j];
                    const distance = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
                    const cutoff = 1.2 * (covalentRadii[a.element]
                        + covalentRadii[b.element]);
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

    function render(molecule, options = {}) {
        const o = normalizeOptions(options);
        if (o.renderMode === 'fast')
            return renderFastPainter(molecule, o);
        const prepared = prepareScene(molecule, o);
        const { spheres, cylinders, scene, scale, project, illumination: physicalIllumination, lightDirection, lightingFor, mayShadow, directionalShadows } = prepared;
        let atlas = null;
        const physicalFor = (source) => atlas ? atlas.lightingFor(source) : lightingFor(source);
        // Shift tonal input after lighting/shadows, leaving color fills and outlines alone.
        const illumination = o.shadingBrightness === 0 ? physicalIllumination :
            (n, p) => Math.max(-1, Math.min(1, physicalIllumination(n, p) + 2 * o.shadingBrightness));
        const shiftedLights = new Map();
        const lightFor = (source) => {
            if (o.shadingBrightness === 0)
                return physicalFor(source);
            let light = shiftedLights.get(source);
            if (!light) {
                const physical = physicalFor(source);
                light = (n, p) => Math.max(-1, Math.min(1, physical(n, p) + 2 * o.shadingBrightness));
                shiftedLights.set(source, light);
            }
            return light;
        };
        const physicalThreshold = (limit) => 1 - 2 * Math.pow((1 - limit) / 2, 1 / (o.shadingContrast / 1.2)) - 2 * o.shadingBrightness;
        const paths = [];
        // Preserve the tolerant legacy oracle for outlines/fallbacks and labels.
        const visible = (p) => !scene.some(s => depthAt(s, p[0], p[1]) > p[2] + .00015);
        const curve = createCurveRenderer({ options: o, project, illumination, visible, paths });
        const fillFor = element => o.colorWash ? elementColor(element, o.washStrength, o.colorSaturation, o.colorScheme) : '#ffffff';
        const analytic = getBoundaries();
        const built = analytic ? analytic.build(scene, depthAt, project, scale) : null;
        // Validate independently of the selected palette; styles must not change outlines.
        const boundaries = built && built.validate(elementColor) ? built : null;
        // Labels are part of their owner's paint layer, never a final overlay and
        // never clipped text. Certified visible fills preserve intersecting geometry.
        const layerPaths = o.labels && boundaries?.surfacePaths ? boundaries.surfacePaths(false) : null;
        const ownerEngraving = new Map(), ownerDots = new Map();
        const regions = o.shadingMode !== 'halftone' && o.shadingSize !== 0 && boundaries?.dotRegions ? boundaries.dotRegions() : null;
        if (regions?.surface)
            atlas = createSurfaceAtlas(prepared, regions, o);
        // Shadow boundaries are solved per surface, not rediscovered along each line.
        function tonalSpans(s, g, tone, limit, sharedShadow) {
            if (o.lightType !== 'directional')
                return { spans: undefined, breaks: undefined };
            const shadow = sharedShadow !== undefined ? sharedShadow : mayShadow(s) ? (atlas ? g.clip(atlas.shadow(s)) : null) : [];
            if (shadow === null)
                return { spans: undefined, breaks: undefined };
            const threshold = physicalThreshold(limit);
            const darkThreshold = o.shadowStrength >= 1 ? (-1 < threshold ? Infinity : -Infinity) : (threshold + 1) / (1 - o.shadowStrength) - 1;
            const spans = unionSpans(intersectSpans(tone(threshold), complementSpans(shadow)), intersectSpans(tone(darkThreshold), shadow));
            return { spans, breaks: shadow.flat() };
        }
        let wash = '';
        if (!layerPaths && o.colorWash && o.washStrength > 0) {
            if (boundaries)
                wash = boundaries.wash(fillFor, o.quality === 'preview');
            if (!boundaries || wash === null) {
                const helper = getWash();
                if (!helper)
                    throw new Error('Missing wash.js: load it before renderer.js');
                wash = helper.buildWash(scene, depthAt, project, scale, fillFor, { fitCurves: o.quality !== 'preview' });
            }
        }
        // Density is a screen-space style: enlarge geometry by adding hatches,
        // never by stretching their spacing. Calibrate to the existing scale=60 look.
        const hatchDensity = o.density * scale / 60;
        for (const s of spheres) {
            const start = paths.length;
            if (boundaries)
                paths.push(boundaries.outline(s, o.quality === 'preview' || !o.optimizePaths, o.outlineWidth * 1.4));
            else
                curve(t => { const a = t * Math.PI * 2, n = [Math.cos(a), Math.sin(a), 0]; return { p: add$1(s.c, mul$1(n, s.r)), n }; }, Math.ceil(2 * Math.PI * s.r * scale / 0.65), o.outlineWidth * 1.4);
            function hatch(axis, count, secondary) {
                axis = norm(axis);
                const e = norm(cross$1(axis, [1, 0, 0])), f = cross$1(axis, e), light = lightFor(s);
                const face = atlas?.visible(s);
                if (atlas && !face)
                    return;
                const screen = (a) => [a[0], -a[1], a[2]], c = project(s.c), radius = s.r * scale;
                const visibleFamily = face?.sphereFamily?.(c, radius, screen(axis), screen(e), screen(f));
                const shadowFamily = o.lightType === 'directional' && atlas && mayShadow(s) ? atlas.shadow(s).sphereFamily?.(c, radius, screen(axis), screen(e), screen(f)) : undefined;
                for (let j = 1; j < count; j++) {
                    const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h), limit = secondary ? .12 : (j % 2 === 0 ? .88 : .58);
                    const center = add$1(s.c, mul$1(axis, h * s.r)), u = mul$1(e, r * s.r), v = mul$1(f, r * s.r);
                    const geometry = projectedCircle(project, center, u, v);
                    const front = trigSpans(-axis[2] * h, -r * e[2], -r * f[2], 1e-12);
                    const tonal = tonalSpans(s, geometry, t => trigSpans(h * dot$1(axis, lightDirection), r * dot$1(e, lightDirection), r * dot$1(f, lightDirection), t), limit, shadowFamily?.(h));
                    const spans = tonal.spans ? intersectSpans(tonal.spans, front) : undefined;
                    const clip = () => {
                        let result = visibleFamily?.(h) ?? (face ? geometry.clip(face) : null);
                        if (result === null)
                            result = boundaries?.clipCircle ? boundaries.clipCircle(s, center, u, v) : null;
                        return result === null ? null : intersectSpans(result, front);
                    };
                    curve(t => {
                        const a = t * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
                        const n = [axis[0] * h + (e[0] * cos + f[0] * sin) * r, axis[1] * h + (e[1] * cos + f[1] * sin) * r, axis[2] * h + (e[2] * cos + f[2] * sin) * r];
                        return { p: [s.c[0] + n[0] * s.r, s.c[1] + n[1] * s.r, s.c[2] + n[2] * s.r], n };
                    }, Math.max(120, Math.ceil(2 * Math.PI * s.r * scale * r / .7)), o.hatchWidth * (secondary ? .63 : .8), (n, p, lit) => n[2] >= -1e-12 && lit < limit, true, true, clip, { geometry, spans, breaks: tonal.breaks, illumination: light });
                }
            }
            if (o.shadingMode === 'hatch' && o.hatchWidth > 0) {
                hatch([.12, 1, .40], Math.max(2, Math.round(hatchDensity * s.r / .48)), false);
                if (o.crossHatch)
                    hatch([1, .22, -0.32], Math.max(2, Math.round(hatchDensity * .8 * s.r / .48)), true);
            }
            if (layerPaths)
                ownerEngraving.set(s, paths.slice(start).join(''));
        }
        for (const s of cylinders) {
            const start = paths.length;
            const e = norm(cross$1(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$1(s.u, e);
            const line = (n, w, engrave = false) => {
                const offset = mul$1(n, s.r), a = add$1(s.a, offset), b = add$1(a, mul$1(s.u, s.length));
                const geometry = projectedLine(project, a, b), face = engrave ? atlas?.visible(s) : null;
                if (engrave && atlas && !face)
                    return;
                const tonal = engrave ? tonalSpans(s, geometry, t => dot$1(n, lightDirection) < t ? [[0, 1]] : [], .65) : { spans: undefined, breaks: undefined };
                curve(t => { const d = t * s.length; return { p: [s.a[0] + s.u[0] * d + offset[0], s.a[1] + s.u[1] * d + offset[1], s.a[2] + s.u[2] * d + offset[2]], n }; }, Math.max(60, Math.ceil(s.length * scale / .7)), w, (normal, p, lit) => !engrave || lit < .65, engrave, false, engrave ? () => face ? geometry.clip(face) : boundaries?.clipLine ? boundaries.clipLine(s, a, b) : null : null, { geometry, spans: tonal.spans, breaks: tonal.breaks, illumination: lightFor(s), ignoreLighting: !engrave });
            };
            if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
                const edge = norm([-s.u[1], s.u[0], 0]);
                line(edge, o.outlineWidth * 1.1);
                line(mul$1(edge, -1), o.outlineWidth * 1.1);
            }
            const count = Math.max(3, Math.round(hatchDensity * .8 * s.r / .115));
            for (let j = 0; o.shadingMode === 'hatch' && o.hatchWidth > 0 && j < count; j++) {
                const a = j / count * 2 * Math.PI, n = add$1(mul$1(e, Math.cos(a)), mul$1(f, Math.sin(a)));
                if (n[2] > 0)
                    line(n, o.hatchWidth * .68, true);
            }
            if (layerPaths)
                ownerEngraving.set(s, paths.slice(start).join(''));
        }
        let dots = '';
        if (o.shadingMode !== 'hatch' && o.dotSize > 0) {
            const dotter = getDots();
            if (!dotter)
                throw new Error('Load dots.js before renderer.js');
            const surfaces = {
                compactStipple: true,
                emitSurface: layerPaths ? (id, svg) => { ownerDots.set(id, (ownerDots.get(id) || '') + svg); } : undefined,
                paths: o.shadingMode === 'halftone' && boundaries?.surfacePaths ? boundaries.surfacePaths(false) : null,
                light: o.lightType === 'directional' ? lightDirection : undefined,
                illumination: (source, n, p) => lightFor(source)(n, p),
                ...(o.shadingMode === 'halftone' && o.lightType === 'directional' && o.castShadows && o.shadowStrength > 0 ? directionalShadows() : {})
            };
            dots = dotter.buildDots(scene, depthAt, project, scale, illumination, o, regions, hatchCoverage(scale, o), surfaces);
        }
        const ownerLabels = new Map();
        // If ownership cannot be certified, omit labels rather than float them over
        // unrelated foreground geometry. The underlying scene keeps its fallback.
        if (o.labels && layerPaths)
            for (const [id, s] of spheres.entries()) {
                if (s.element === 'H' && !o.labelHydrogens)
                    continue;
                const p = add$1(s.c, [0, 0, s.r]);
                if (!layerPaths[id] || !visible(p))
                    continue;
                const [x, y] = project(p);
                ownerLabels.set(s, `<text data-role="element-label" data-surface-id="${id}" x="${x.toFixed(2)}" y="${(y + o.labelSize * .3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${escapeXml(o.labelFont)}" font-style="${o.labelItalic ? 'italic' : 'normal'}" font-weight="${o.labelBold ? '700' : '400'}" stroke="${o.labelStrokeWidth === 0 ? 'none' : (o.labelMatchFill ? fillFor(s.element) : o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${escapeXml(s.element)}</text>`);
            }
        const engraving = (body) => `<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
        let artwork = `${wash}${dots}${engraving(paths.join(''))}<g font-family="Georgia, 'Times New Roman', serif"></g>`;
        if (layerPaths) {
            const depth = (s) => s.kind === 'sphere' ? s.c[2] : s.a[2] + s.u[2] * s.length / 2;
            const order = scene.map((s, id) => ({ s, id, z: depth(s) })).sort((a, b) => a.z - b.z || a.id - b.id);
            artwork = dots + order.map(({ s, id }) => {
                const outline = layerPaths[id];
                if (!outline)
                    return '';
                // Opaque paint is essential even with color wash disabled: white atoms
                // and white bonds must naturally cover labels in the rear layers.
                const fill = `<path data-role="surface-fill" fill="${s.kind === 'sphere' ? fillFor(s.element) : '#ffffff'}" stroke="none" fill-rule="evenodd" d="${outline}"/>`;
                return `<g data-role="surface-layer" data-surface-id="${id}">${fill}${ownerDots.get(id) || ''}${engraving(ownerEngraving.get(s) || '')}${ownerLabels.get(s) || ''}</g>`;
            }).join('');
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title"><title id="title">${escapeXml(molecule.name || 'Molecular engraving')}</title><rect width="100%" height="100%" fill="white"/>${artwork}</svg>`;
    }

    exports.covalentRadii = covalentRadii;
    exports.covalentRadiusSource = covalentRadiusSource;
    exports.depthAt = depthAt;
    exports.elementColor = elementColor;
    exports.elementPalette = elementPalette;
    exports.engravingWidth = engravingWidth;
    exports.examples = examples;
    exports.parseXYZ = parseXYZ;
    exports.render = render;

    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    return exports;

})({});
if (typeof module !== 'undefined' && module.exports) module.exports = MolEngraver;
