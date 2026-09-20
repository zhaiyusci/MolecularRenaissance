/* Generated DOM-free ES module. Source: src/renderer.ts. */
// Preserve arithmetic order: geometry tolerances are covered by numerical tests.
const add$3 = (a, b) => a.map((v, i) => v + b[i]);
const sub$1 = (a, b) => a.map((v, i) => v - b[i]);
const mul$2 = (a, s) => a.map(v => v * s);
const dot$3 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross$2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm$1 = (a) => mul$2(a, 1 / Math.hypot(...a));
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
    const center = mul$2(molecule.atoms.reduce((s, a) => add$3(s, a.position), [0, 0, 0]), 1 / molecule.atoms.length);
    const spheres = molecule.atoms.map(a => ({ kind: 'sphere', c: rotate(sub$1(a.position, center), o.yaw, o.pitch), r: atomRadius(a) * o.atomRadiusScale, element: a.element }));
    const cylinders = molecule.bonds.map(b => {
        if (!Array.isArray(b) || b.length !== 2 || !b.every(i => Number.isInteger(i) && spheres[i]))
            throw new Error('Invalid bond');
        const a = spheres[b[0]].c, end = spheres[b[1]].c, v = sub$1(end, a), length = Math.hypot(...v);
        if (length < 1e-8)
            throw new Error('Zero length bond');
        return { kind: 'cylinder', a, u: mul$2(v, 1 / length), length, r: .115 };
    });
    const scene = [...spheres, ...cylinders];
    const lo = [0, 1].map(i => Math.min(...spheres.map(s => s.c[i] - s.r))), hi = [0, 1].map(i => Math.max(...spheres.map(s => s.c[i] + s.r)));
    // Translation may center the view, but scale never depends on its bounds.
    const scale = o.scale;
    const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
    const project = p => [(p[0] - cx) * scale + o.width / 2, o.height / 2 - 12 - (p[1] - cy) * scale];
    const light = [Math.sin(o.lightAzimuth) * Math.cos(o.lightElevation), Math.sin(o.lightElevation), Math.cos(o.lightAzimuth) * Math.cos(o.lightElevation)];
    const sceneRadius = Math.max(...spheres.map(s => Math.hypot(...s.c) + s.r));
    const lightPosition = mul$2(light, o.lightDistance * sceneRadius);
    const shadowBias = Math.max(1e-9, Math.min(sceneRadius * 1e-6, ...scene.map(s => s.r * 1e-4)));
    const traceShadows = o.castShadows && o.shadowStrength > 0 && o.shadingSize !== 0;
    // Share the evaluator so broad-phase specialization cannot drift from the
    // generic callback's physical formulas or arithmetic order.
    const lighting = (casters) => (n, p) => {
        const point = o.lightType === 'point', delta = point ? sub$1(lightPosition, p) : light;
        const direction = point ? norm$1(delta) : light;
        const distance = point ? Math.hypot(...delta) : Infinity;
        const facing = dot$3(n, direction);
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

const TAU$3 = 2 * Math.PI, EPS = Number.EPSILON;
function overlaps(a, b) {
    return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}
function box$1(edges) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const e of edges)
        for (let k = 0; k < 4; k++)
            b[k] = k < 2 ? Math.min(b[k], e.bounds[k]) : Math.max(b[k], e.bounds[k]);
    return b;
}
function index(edges) {
    const bounds = box$1(edges);
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
    if (bounds && bounds.length >= 4 && bounds.slice(0, 4).every(Number.isFinite)) {
        for (let k = 0; k < 4; k++)
            regionBounds[k] = k < 2 ? Math.min(regionBounds[k], bounds[k]) : Math.max(regionBounds[k], bounds[k]);
    }
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
                let angle = Math.atan2(p[1] + f * dy, p[0] + f * dx) / TAU$3;
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
            const a = TAU$3 * t, co = Math.cos(a), si = Math.sin(a);
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
                        const t = angle / TAU$3;
                        cuts.push(t - Math.floor(t));
                    }
                }
                // The height index contains only front-lift intersections. Explicit
                // silhouette cuts prevent an uncut back arc from becoming visible.
                return clipEllipse(c, eu, ev, bins[bin(h)], cuts, t => z0 + zc * Math.cos(TAU$3 * t) + zs * Math.sin(TAU$3 * t) >= 0);
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

var TOL = .0015, SNAP = .00003, ROUND = .002;
var MAX_EDGES = 250000, MAX_REFS = 2000000;
function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
function point(p) { return p && finite(p[0]) && finite(p[1]); }
function box() { return [Infinity, Infinity, -Infinity, -Infinity]; }
function include(b, p) {
    b[0] = Math.min(b[0], p[0]);
    b[1] = Math.min(b[1], p[1]);
    b[2] = Math.max(b[2], p[0]);
    b[3] = Math.max(b[3], p[1]);
}
function insideBox(b, x, y) { return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]; }
function distance2(e, x, y) {
    var dx = e.q[0] - e.p[0], dy = e.q[1] - e.p[1];
    var t = Math.max(0, Math.min(1, ((x - e.p[0]) * dx + (y - e.p[1]) * dy) / (dx * dx + dy * dy)));
    var a = x - e.p[0] - t * dx, b = y - e.p[1] - t * dy;
    return a * a + b * b;
}
// Bounded rectangular grid. A long edge is registered in every cell touched
// by its box (not just its endpoints), making radius searches conservative.
function grid(bounds, count) {
    var n = Math.max(1, Math.min(128, Math.ceil(Math.sqrt(count / 4))));
    var w = bounds[2] - bounds[0], h = bounds[3] - bounds[1];
    var nx = Math.max(1, Math.min(128, Math.ceil(n * Math.sqrt(w / h))));
    var ny = Math.max(1, Math.min(128, Math.ceil(n * Math.sqrt(h / w))));
    var cells = new Array(nx * ny), refs = 0;
    function ix(x) { return Math.max(0, Math.min(nx - 1, Math.floor((x - bounds[0]) / w * nx))); }
    function iy(y) { return Math.max(0, Math.min(ny - 1, Math.floor((y - bounds[1]) / h * ny))); }
    return {
        ix: ix, iy: iy, nx: nx, cells: cells,
        add: function (b, id) {
            var x0 = ix(b[0]), x1 = ix(b[2]), y0 = iy(b[1]), y1 = iy(b[3]);
            refs += (x1 - x0 + 1) * (y1 - y0 + 1);
            if (refs > MAX_REFS)
                return false;
            for (var y = y0; y <= y1; y++)
                for (var x = x0; x <= x1; x++) {
                    var k = y * nx + x;
                    if (!cells[k])
                        cells[k] = [];
                    cells[k].push(id);
                }
            return true;
        }
    };
}
function create(scene, segments, nodes, project, scale) {
    // project/scale belong to the shared builder's API; geometry is already SVG.
    if (!Array.isArray(scene) || !Array.isArray(segments) || !nodes || !(scale > 0) || !finite(scale))
        return null;
    try {
        return build$1(scene, segments, nodes);
    }
    catch (_) {
        return null;
    }
}
function build$1(scene, segments, nodes) {
    if (scene.length > 10000 || segments.length > MAX_EDGES)
        return null;
    var owners = scene.map(function (_, id) { return { id: id, starts: new Map(), ins: new Map(), directed: [], edges: [], bounds: box() }; });
    var edges = [], bounds = box(), error = TOL + SNAP + ROUND;
    function label(id) { return Number.isInteger(id) && id >= -1 && id < scene.length; }
    function attach(id, start, end, poly, reverse) {
        if (id === -1)
            return true;
        var o = owners[id];
        if (o.starts.has(start) || o.ins.has(end))
            return false;
        var e = { start: start, end: end, poly: poly, reverse: reverse, used: false };
        o.starts.set(start, e);
        o.ins.set(end, e);
        o.directed.push(e);
        return true;
    }
    for (var si = 0; si < segments.length; si++) {
        var s = segments[si];
        if (!s || !label(s.left) || !label(s.right))
            return null;
        if (s.left === s.right)
            continue; // includes invisible cuts, not colour equality
        var c = s.c, p = nodes[s.start], q = nodes[s.end];
        if (!c || typeof c.at !== 'function' || !point(p) || !point(q) || !finite(s.a) || !finite(s.b) || s.a === s.b)
            return null;
        var pa = c.at(s.a), pb = c.at(s.b);
        if (!point(pa) || !point(pb) || Math.hypot(p[0] - pa[0], p[1] - pa[1]) > SNAP || Math.hypot(q[0] - pb[0], q[1] - pb[1]) > SNAP)
            return null;
        var steps = 1;
        if (!c.line) {
            if (!point(c.U) || !point(c.V) || !point(c.C) || !(c.radius > 0) || !finite(c.radius))
                return null;
            // Largest singular value of [U V] also covers nonorthogonal ellipse
            // bases; never blindly trust a radius smaller than this analytic bound.
            var uu = c.U[0] * c.U[0] + c.U[1] * c.U[1], vv = c.V[0] * c.V[0] + c.V[1] * c.V[1];
            var uv = c.U[0] * c.V[0] + c.U[1] * c.V[1];
            var radius = Math.max(c.radius, Math.sqrt((uu + vv + Math.hypot(uu - vv, 2 * uv)) / 2));
            if (!finite(radius))
                return null;
            steps = Math.max(1, Math.ceil(Math.abs(s.b - s.a) / Math.min(Math.PI / 4, Math.sqrt(8 * TOL / radius))));
        }
        if (!finite(steps) || edges.length + steps > MAX_EDGES)
            return null;
        var poly = [], prev = [p[0], p[1]];
        for (var j = 1; j <= steps; j++) {
            var next = j === steps ? [q[0], q[1]] : c.at(s.a + (s.b - s.a) * j / steps);
            if (!point(next))
                return null;
            next = [next[0], next[1]];
            if (next[0] === prev[0] && next[1] === prev[1])
                return null;
            var eb = [Math.min(prev[0], next[0]), Math.min(prev[1], next[1]), Math.max(prev[0], next[0]), Math.max(prev[1], next[1])];
            var edge = { p: prev, q: next, bounds: eb };
            poly.push(edge);
            edges.push(edge);
            include(bounds, prev);
            include(bounds, next);
            prev = next;
        }
        if (!attach(s.left, s.start, s.end, poly, false) || !attach(s.right, s.end, s.start, poly, true))
            return null;
    }
    var active = [], totalRowRefs = 0;
    // Retain exactly the validated owner polygons; build each clipping BVH lazily.
    var surfaceEdges = new Map(), surfaces = new Map();
    function surface(id) {
        var polygon = surfaceEdges.get(id);
        if (!polygon)
            return null;
        var region = surfaces.get(id);
        if (!region) {
            region = createRegion(polygon, owners[id].bounds);
            surfaces.set(id, region);
        }
        return region;
    }
    for (var oi = 0; oi < owners.length; oi++) {
        var o = owners[oi];
        if (!o.directed.length)
            continue; // valid fully occluded source, even white
        if (o.starts.size !== o.ins.size)
            return null;
        for (var v of o.starts.keys())
            if (!o.ins.has(v))
                return null;
        // Explicitly walk each oriented component. Never repair a missing link.
        for (var first of o.directed) {
            if (first.used)
                continue;
            var current = first, count = 0;
            do {
                if (!current || current.used || ++count > o.directed.length)
                    return null;
                current.used = true;
                for (var pe of current.poly) {
                    o.edges.push(pe);
                    include(o.bounds, pe.p);
                    include(o.bounds, pe.q);
                }
                current = o.starts.get(current.end);
            } while (current !== first);
        }
        if (!(o.bounds[2] > o.bounds[0]) || !(o.bounds[3] > o.bounds[1]))
            return null;
        var rows = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(o.edges.length))));
        o.rows = new Array(rows);
        o.rowScale = rows / (o.bounds[3] - o.bounds[1]);
        for (var e of o.edges) {
            var lo = Math.max(0, Math.min(rows - 1, Math.floor((e.bounds[1] - o.bounds[1]) * o.rowScale)));
            var hi = Math.max(0, Math.min(rows - 1, Math.floor((e.bounds[3] - o.bounds[1]) * o.rowScale)));
            totalRowRefs += hi - lo + 1;
            if (totalRowRefs > MAX_REFS)
                return null;
            for (var ri = lo; ri <= hi; ri++) {
                if (!o.rows[ri])
                    o.rows[ri] = [];
                o.rows[ri].push(e);
            }
        }
        // Dot queries keep their unchanged row index. Clipping retains the same
        // polygon edges, including every disconnected component and hole.
        surfaceEdges.set(o.id, o.edges);
        // The build-only graph fields are discarded after indexing.
        delete o.starts;
        delete o.ins;
        delete o.directed;
        delete o.edges;
        active.push(o);
    }
    if (!active.length)
        return { query: function () { return null; }, surface: surface };
    if (!(bounds[2] > bounds[0]) || !(bounds[3] > bounds[1]))
        return null;
    error += 128 * Number.EPSILON * Math.max(1, Math.abs(bounds[0]), Math.abs(bounds[1]), Math.abs(bounds[2]), Math.abs(bounds[3]));
    var ownerGrid = grid(bounds, active.length * 16), edgeGrid = grid(bounds, edges.length);
    for (var ai = 0; ai < active.length; ai++)
        if (!ownerGrid.add(active[ai].bounds, ai))
            return null;
    for (var ei = 0; ei < edges.length; ei++)
        if (!edgeGrid.add(edges[ei].bounds, ei))
            return null;
    var seen = new Uint32Array(edges.length), stamp = 0;
    function contains(o, x, y) {
        if (!insideBox(o.bounds, x, y))
            return false;
        var row = Math.max(0, Math.min(o.rows.length - 1, Math.floor((y - o.bounds[1]) * o.rowScale)));
        var list = o.rows[row] || [], yes = false;
        for (var i = 0; i < list.length; i++) {
            var p = list[i].p, q = list[i].q;
            if ((p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1]))
                yes = !yes;
        }
        return yes;
    }
    return { surface: surface, query: function (x, y, maxRadius) {
            if (!finite(x) || !finite(y) || !finite(maxRadius) || !(maxRadius > 0) || !insideBox(bounds, x, y))
                return null;
            var candidates = ownerGrid.cells[ownerGrid.iy(y) * ownerGrid.nx + ownerGrid.ix(x)] || [], owner = -1;
            for (var i = 0; i < candidates.length; i++) {
                var o = active[candidates[i]];
                if (contains(o, x, y)) {
                    if (owner !== -1)
                        return null;
                    owner = o.id;
                }
            }
            if (owner === -1)
                return null;
            // Other owners' edges count too: slightly conservative near disconnected
            // islands but avoids any local ownership assumption in the distance test.
            var radius = maxRadius + error, best = radius * radius;
            if (!finite(best))
                return null;
            var x0 = edgeGrid.ix(x - radius), x1 = edgeGrid.ix(x + radius);
            var y0 = edgeGrid.iy(y - radius), y1 = edgeGrid.iy(y + radius);
            stamp = (stamp + 1) >>> 0;
            if (stamp === 0) {
                seen.fill(0);
                stamp = 1;
            }
            for (var iy = y0; iy <= y1; iy++)
                for (var ix = x0; ix <= x1; ix++) {
                    var list = edgeGrid.cells[iy * edgeGrid.nx + ix];
                    if (!list)
                        continue;
                    for (var k = 0; k < list.length; k++) {
                        var id = list[k];
                        if (seen[id] === stamp)
                            continue;
                        seen[id] = stamp;
                        var e = edges[id], b = e.bounds;
                        var dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3]);
                        if (dx * dx + dy * dy >= best)
                            continue;
                        best = Math.min(best, distance2(e, x, y));
                        if (best <= error * error)
                            return null;
                    }
                }
            var clearance = Math.min(maxRadius, Math.sqrt(best) - error);
            return clearance > 0 ? { id: owner, clearance: clearance } : null;
        } };
}

const Regions = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    create
}, Symbol.toStringTag, { value: 'Module' }));

// Separate from runtime.ts to keep the source dependency graph acyclic:
// renderer -> boundaries -> dot-regions (never boundaries -> renderer helpers).
function getDotRegions() { return Regions; }

const TAU$2 = 2 * Math.PI, dot$2 = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const add$2 = (a, b) => a.map((x, i) => x + b[i]), mul$1 = (a, k) => a.map(x => x * k), sub = (a, b) => add$2(a, mul$1(b, -1));
const cross$1 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul$1(a, 1 / Math.hypot(...a)), dist = (a, b) => Math.hypot(...sub(a, b));
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0], fmt$3 = (p) => p.map(x => Number(x.toFixed(4))).join(' ');
// Isolate real polynomial roots on a bounded interval using derivative roots.
// Unlike sign-change sampling this also finds double roots (tangent arcs).
function roots(p, lo, hi) {
    const size = Math.max(...p.map(Math.abs));
    if (!size)
        return null; // coincident curves: caller falls back rather than guessing
    p = p.map(x => x / size);
    while (p.length > 1 && Math.abs(p.at(-1)) < 1e-13)
        p.pop();
    const value = (x) => p.reduceRight((v, c) => v * x + c, 0);
    if (p.length === 1)
        return [];
    if (p.length === 2) {
        const t = -p[0] / p[1];
        return t >= lo - 1e-10 && t <= hi + 1e-10 ? [Math.max(lo, Math.min(hi, t))] : [];
    }
    const critical = roots(p.slice(1).map((x, i) => x * (i + 1)), lo, hi) || [];
    const cuts = [lo, ...critical, hi], out = [];
    for (const x of cuts)
        if (Math.abs(value(x)) < 1e-10)
            out.push(x);
    for (let i = 1; i < cuts.length; i++) {
        let a = cuts[i - 1], b = cuts[i], fa = value(a), fb = value(b);
        if (fa * fb >= 0 || Math.abs(fa) < 1e-10 || Math.abs(fb) < 1e-10)
            continue;
        for (let j = 0; j < 48; j++) {
            const m = (a + b) / 2, f = value(m);
            if (f * fa > 0) {
                a = m;
                fa = f;
            }
            else
                b = m;
        }
        out.push((a + b) / 2);
    }
    return out;
}
const local = (c, p) => { const d = sub(p, c.C); return [cross2(d, c.V) / c.det, cross2(c.U, d) / c.det]; };
const parameter = (c, p) => c.line ? dot$2(sub(p, c.A), c.D) / dot$2(c.D, c.D) : ((Math.atan2(...local(c, p).reverse()) % TAU$2) + TAU$2) % TAU$2;
// Equality of supports, independent of parameter orientation/phase. Keep this
// near roundoff: proximity alone is not a license to erase a narrow region.
function sameCarrier(a, b) {
    if (!!a.line !== !!b.line)
        return false;
    if (a.line) {
        const la = Math.hypot(...a.D), lb = Math.hypot(...b.D);
        return Math.abs(cross2(a.D, b.D)) <= 1e-12 * la * lb &&
            Math.abs(cross2(sub(b.A, a.A), a.D)) <= 1e-8 * la;
    }
    // Most ellipse pairs have different centers: reject without temporary
    // vectors before the exact near-coincidence check below.
    if (Math.abs(a.C[0] - b.C[0]) > 1e-8 || Math.abs(a.C[1] - b.C[1]) > 1e-8 || dist(a.C, b.C) > 1e-8)
        return false;
    const U = [cross2(a.U, b.V) / b.det, cross2(b.U, a.U) / b.det];
    const V = [cross2(a.V, b.V) / b.det, cross2(b.U, a.V) / b.det];
    return Math.max(Math.abs(dot$2(U, U) - 1), Math.abs(dot$2(V, V) - 1), Math.abs(dot$2(U, V))) < 1e-11;
}
// Shared projected-curve solver: both the face arrangement and hatch clipping
// use these intersections. emit receives parameters on a and b respectively.
function intersections(a, b, emit) {
    if (a.box[0] > b.box[2] + 1e-6 || b.box[0] > a.box[2] + 1e-6 || a.box[1] > b.box[3] + 1e-6 || b.box[1] > a.box[3] + 1e-6)
        return;
    function hit(t) {
        const p = a.at(t), q = parameter(b, p);
        if (q < -1e-8 || q > b.end + 1e-8 || dist(p, b.at(q)) > .00002)
            return;
        emit(t, Math.max(0, Math.min(b.end, q)));
    }
    if (a.line && b.line) {
        const d = cross2(a.D, b.D);
        if (Math.abs(d) < 1e-10) {
            if (sameCarrier(a, b)) {
                // A collinear finite overlap has endpoint events, not isolated roots.
                for (const t of [0, 1])
                    hit(t);
                for (const q of [0, 1]) {
                    const t = parameter(a, b.at(q));
                    if (t >= 0 && t <= 1)
                        hit(t);
                }
            }
        }
        else {
            const t = cross2(sub(b.A, a.A), b.D) / d;
            if (t >= 0 && t <= 1)
                hit(t);
        }
    }
    else if (a.line || b.line) {
        if (!a.line) {
            intersections(b, a, (q, t) => emit(t, q));
            return;
        }
        const P = local(b, a.A), Q = sub(local(b, add$2(a.A, a.D)), P);
        for (const t of roots([dot$2(P, P) - 1, 2 * dot$2(P, Q), dot$2(Q, Q)], 0, 1) || [])
            hit(t);
    }
    else {
        const C = local(b, a.C), U = sub(local(b, add$2(a.C, a.U)), C), V = sub(local(b, add$2(a.C, a.V)), C);
        // tan(theta/2) on four bounded charts avoids roots at infinity.
        for (let quadrant = 0; quadrant < 4; quadrant++) {
            const angle = quadrant * Math.PI / 2, cos = Math.cos(angle), sin = Math.sin(angle);
            const u = add$2(mul$1(U, cos), mul$1(V, sin)), v = add$2(mul$1(U, -sin), mul$1(V, cos));
            const p = add$2(C, u), q = mul$1(v, 2), r = sub(C, u);
            const poly = [dot$2(p, p) - 1, 2 * dot$2(p, q), dot$2(q, q) + 2 * dot$2(p, r) - 2, 2 * dot$2(q, r), dot$2(r, r) - 1];
            const rr = roots(poly, -Math.tan(Math.PI / 8), Math.tan(Math.PI / 8));
            if (rr === null || Math.max(...poly.map(Math.abs)) < 1e-10)
                throw new Error('coincident ellipses');
            for (const t of rr)
                hit((angle + 2 * Math.atan(t) + TAU$2) % TAU$2);
        }
    }
}
function build(scene, depthAt, project, scale) {
    const spheres = scene.filter((s) => s.kind === 'sphere'), cylinders = scene.filter((s) => s.kind === 'cylinder');
    if (!spheres.length || scene.length > 200 || !(scale > 0))
        return null;
    // This fast path proves its geometry assumptions before omitting any curves.
    // Partial sphere intersections contribute their true 3-D seam circles.
    // Degenerate/nested balls, free caps and incidental exposed sphere/rod
    // contacts still use the general path, never a center-sorted drawing.
    if (scene.some(s => !(s.r > 0) || s.r * scale > 10000 || s.r * scale < .01 ||
        (s.kind === 'sphere' ? s.c : s.a).some(x => !Number.isFinite(x) || Math.abs(x) > 1e4)))
        return null;
    const sphereSeams = [];
    for (let i = 0; i < spheres.length; i++)
        for (let j = 0; j < i; j++) {
            const a = spheres[i], b = spheres[j], d = dist(a.c, b.c), sum = a.r + b.r;
            if (d > sum + 1e-8)
                continue;
            // Keep uncertain tangencies and nested/coincident surfaces conservative.
            if (d >= sum - 1e-8 || d <= Math.abs(a.r - b.r) + 1e-8)
                return null;
            const axis = mul$1(sub(b.c, a.c), 1 / d), h = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
            const radius = Math.sqrt(a.r * a.r - h * h);
            if (!(radius > 1e-8))
                return null;
            const e = norm(cross$1(axis, Math.abs(axis[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$1(axis, e);
            sphereSeams.push({ center: add$2(a.c, mul$1(axis, h)), u: mul$1(e, radius), v: mul$1(f, radius) });
        }
    const ends = [], covered = new Set();
    for (const c of cylinders) {
        if (Math.abs(dot$2(c.u, c.u) - 1) > 1e-10 || !(c.length > 0))
            return null;
        const b = add$2(c.a, mul$1(c.u, c.length));
        const aSphere = spheres.find(s => dist(s.c, c.a) < 1e-10), bSphere = spheres.find(s => dist(s.c, b) < 1e-10);
        if (!aSphere || !bSphere || aSphere === bSphere || c.r >= Math.min(aSphere.r, bSphere.r))
            return null;
        // Legacy ray tolerances become ill-conditioned close to camera-parallel.
        // This guard also precedes covered-carrier omission: mathematical solid
        // containment does not bound the legacy solver's expanded near-axis hits.
        const axial = 1 - c.u[2] * c.u[2];
        if (axial > 1e-12 && axial < 1e-7)
            return null;
        ends.push([aSphere, bSphere]);
        // Every cross-sectional disk is contained in at least one endpoint ball.
        // A strict margin covers endpoint matching/roundoff; retain physical rods
        // in scene (and all raw owner IDs), omit only their invisible carriers.
        if (Math.sqrt(aSphere.r * aSphere.r - c.r * c.r) + Math.sqrt(bSphere.r * bSphere.r - c.r * c.r) > c.length + 1e-8) {
            covered.add(c);
            continue;
        }
        for (const s of spheres) {
            if (s === aSphere || s === bSphere)
                continue;
            const t = Math.max(0, Math.min(c.length, dot$2(sub(s.c, c.a), c.u)));
            if (dist(s.c, add$2(c.a, mul$1(c.u, t))) <= s.r + c.r + 1e-8)
                return null;
        }
    }
    const origin = project([0, 0, 0]), curves = [];
    const vector = (v) => [v[0] * scale, -v[1] * scale];
    function circle(c, u, v, source = null) {
        const C = project(c), U = vector(u), V = vector(v), radius = Math.max(Math.hypot(...u), Math.hypot(...v)) * scale;
        const det = cross2(U, V);
        if (Math.abs(det) < 1e-10) {
            const axis = norm(Math.hypot(...U) > Math.hypot(...V) ? U : V), half = Math.hypot(dot$2(U, axis), dot$2(V, axis));
            line2(sub(C, mul$1(axis, half)), add$2(C, mul$1(axis, half)));
            return;
        }
        if (Math.abs(det) / radius < .0001)
            throw new Error('ill-conditioned ellipse');
        curves.push({ C, U, V, det, source, world: t => add$2(c, add$2(mul$1(u, Math.cos(t)), mul$1(v, Math.sin(t)))),
            at: t => add$2(C, add$2(mul$1(U, Math.cos(t)), mul$1(V, Math.sin(t)))),
            tangent: t => add$2(mul$1(U, -Math.sin(t)), mul$1(V, Math.cos(t))),
            cuts: [0, Math.PI / 2, Math.PI, Math.PI * 1.5, TAU$2], end: TAU$2, radius,
            box: [C[0] - Math.hypot(U[0], V[0]), C[1] - Math.hypot(U[1], V[1]), C[0] + Math.hypot(U[0], V[0]), C[1] + Math.hypot(U[1], V[1])] });
    }
    function line2(A, B) {
        const D = sub(B, A);
        if (Math.hypot(...D) < 1e-8)
            return;
        curves.push({ line: true, A, D, at: t => add$2(A, mul$1(D, t)), tangent: () => D, cuts: [0, 1], end: 1,
            box: [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[0], B[0]), Math.max(A[1], B[1])] });
    }
    try {
        for (const s of spheres)
            circle(s.c, [s.r, 0, 0], [0, s.r, 0], s);
        // No sphere/cylinder Contact metadata: these seams use the general
        // projected intersection solver when clipping surface hatch circles.
        for (const seam of sphereSeams)
            circle(seam.center, seam.u, seam.v);
        cylinders.forEach((c, i) => {
            if (covered.has(c))
                return;
            const u = c.u, e = norm(cross$1(u, Math.abs(u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$1(u, e);
            for (let end = 0; end < 2; end++) {
                const s = ends[i][end], h = Math.sqrt(s.r * s.r - c.r * c.r);
                const before = curves.length, offset = end ? -h : h;
                circle(add$2(s.c, mul$1(u, offset)), mul$1(e, c.r), mul$1(f, c.r));
                if (curves.length > before)
                    curves.at(-1).contact = { sphere: s, cylinder: c, axis: u, offset };
            }
            if (Math.hypot(u[0], u[1]) > 1e-10) {
                const edge = mul$1(norm([-u[1], u[0], 0]), c.r);
                for (const sign of [-1, 1]) {
                    const a = add$2(c.a, mul$1(edge, sign));
                    line2(project(a), project(add$2(a, mul$1(u, c.length))));
                }
            }
        });
        // Arrange unique geometric supports. Raw curves retain their physical
        // ownership: coincident projection does NOT imply coincident 3-D contact.
        const raw = curves.splice(0), groups = [];
        for (const c of raw) {
            let group = groups.find(g => sameCarrier(c, g[0]));
            if (group)
                group.push(c);
            else
                groups.push([c]);
        }
        for (const members of groups) {
            const first = members[0];
            if (!first.line) {
                first.members = members;
                for (const c of members.slice(1))
                    for (const t of c.cuts)
                        first.cuts.push(parameter(first, c.at(t)));
                curves.push(first);
            }
            else {
                // Union finite collinear generators, but never bridge a gap. Every
                // original endpoint remains an event, including endpoints in overlaps.
                const ranges = members.map(c => {
                    const ts = [parameter(first, c.A), parameter(first, c.at(1))].sort((a, b) => a - b);
                    return { lo: ts[0], hi: ts[1], c };
                }).sort((a, b) => a.lo - b.lo);
                for (let i = 0; i < ranges.length;) {
                    const lo = ranges[i].lo, part = [ranges[i++]];
                    let hi = part[0].hi;
                    while (i < ranges.length && ranges[i].lo <= hi) {
                        hi = Math.max(hi, ranges[i].hi);
                        part.push(ranges[i++]);
                    }
                    line2(first.at(lo), first.at(hi));
                    const carrier = curves.at(-1);
                    carrier.members = part.map(r => r.c);
                    for (const r of part)
                        for (const t of [r.lo, r.hi])
                            carrier.cuts.push((t - lo) / (hi - lo));
                }
            }
        }
        for (const c of curves)
            c.contacts = c.members.filter(m => m.contact).map(m => m.contact);
        // Intersections are solved on the analytic projected curves, not pixels.
        for (let i = 0; i < curves.length; i++)
            for (let j = 0; j < i; j++) {
                const a = curves[i], b = curves[j];
                intersections(a, b, (t, q) => { a.cuts.push(t); b.cuts.push(q); });
            }
    }
    catch (_) {
        return null;
    }
    function owner(p) {
        const x = (p[0] - origin[0]) / scale, y = (origin[1] - p[1]) / scale;
        let z = -Infinity, best = -1;
        for (let i = 0; i < scene.length; i++) {
            const shape = scene[i];
            // Topological side tests need the mathematical silhouette, not the
            // depth oracle's slightly expanded tangent-hit tolerance. Otherwise
            // an infinitesimal outside probe can be classified inside BOTH sides.
            if (shape.kind === 'sphere') {
                if ((x - shape.c[0]) ** 2 + (y - shape.c[1]) ** 2 > shape.r * shape.r)
                    continue;
            }
            else {
                const axis2 = shape.u[0] ** 2 + shape.u[1] ** 2;
                const perpendicular = (x - shape.a[0]) * shape.u[1] - (y - shape.a[1]) * shape.u[0];
                if (axis2 > 1e-12 && perpendicular * perpendicular > shape.r * shape.r * axis2)
                    continue;
            }
            const d = depthAt(shape, x, y);
            if (Number.isFinite(d) && (d > z || (d === z && shape.kind === 'cylinder'))) {
                z = d;
                best = i;
            }
        }
        return best;
    }
    // Canonical shared vertices; intersections can arrive via several curves.
    const nodes = [], buckets = new Map(), snap = .00002;
    function node(p) {
        const x = Math.round(p[0] / snap), y = Math.round(p[1] / snap);
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++) {
                const candidates = buckets.get((x + dx) + ',' + (y + dy)) || [];
                for (const id of candidates)
                    if (dist(nodes[id], p) < snap)
                        return id;
            }
        const id = nodes.length;
        nodes.push(p);
        const key = x + ',' + y;
        if (!buckets.has(key))
            buckets.set(key, []);
        buckets.get(key).push(id);
        return id;
    }
    const segments = [], outlines = new Map();
    for (const c of curves) {
        c.cuts.sort((a, b) => a - b);
        c.cuts = c.cuts.filter((t, i, a) => !i || t - a[i - 1] > 1e-9);
        const silhouettes = c.members.filter(m => m.source);
        for (const raw of silhouettes)
            outlines.set(raw.source, []);
        for (let i = 1; i < c.cuts.length; i++) {
            const a = c.cuts[i - 1], b = c.cuts[i], m = (a + b) / 2, p = c.at(m), t = c.tangent(m), length = Math.hypot(...t);
            if (length < 1e-10)
                continue;
            const start = node(c.at(a)), end = node(c.at(b));
            // Events already identified as the same shared vertex have no edge.
            // Do this before probing a vanishing parameter interval.
            if (start === end)
                continue;
            // A fixed normal offset can cross a nearby, almost tangent boundary:
            // thin ellipses then acquire a second false edge, or a hidden limb is
            // incorrectly exposed. Bound the probe by clearance to EVERY other
            // analytic curve. sigma_min * |norm(B^-1(p-C))-1| is a conservative
            // distance bound to an ellipse; lines use distance to the finite segment.
            let epsilon = Math.min(.0005, dist(c.at(a), c.at(b)) * .01);
            // Include the opposite half of THIS ellipse. Near a major-axis tip,
            // the normal chord can be far smaller than even its minor axis.
            if (!c.line) {
                const normal = [-t[1] / length, t[0] / length];
                const nx = cross2(normal, c.V) / c.det, ny = cross2(c.U, normal) / c.det;
                const chord = 2 * Math.abs(Math.cos(m) * nx + Math.sin(m) * ny) / (nx * nx + ny * ny);
                epsilon = Math.min(epsilon, Math.abs(c.det) / c.radius * .05, chord * .2);
            }
            for (const other of curves) {
                if (other === c)
                    continue;
                const box = other.box;
                if (p[0] < box[0] - epsilon || p[0] > box[2] + epsilon || p[1] < box[1] - epsilon || p[1] > box[3] + epsilon)
                    continue;
                let clearance;
                if (other.line) {
                    const q = sub(p, other.A), u = Math.max(0, Math.min(1, dot$2(q, other.D) / dot$2(other.D, other.D)));
                    clearance = dist(p, other.at(u));
                }
                else {
                    const q = sub(p, other.C), x = cross2(q, other.V) / other.det, y = cross2(other.U, q) / other.det;
                    clearance = Math.abs(Math.hypot(x, y) - 1) * Math.abs(other.det) / other.radius;
                }
                epsilon = Math.min(epsilon, clearance * .2);
            }
            const n = mul$1([-t[1], t[0]], epsilon / length), plus = add$2(p, n), minus = sub(p, n);
            // Never accept a zero/rounded-away side probe as evidence that an edge
            // is absent: an entirely lost region could still form a closed graph.
            if (!(epsilon > 0) || !Number.isFinite(epsilon) || dist(plus, p) === 0 || dist(minus, p) === 0)
                return null;
            const left = owner(plus), right = owner(minus);
            const segment = { c, a, b, start, end, left, right };
            segments.push(segment);
            for (const raw of silhouettes) {
                const visible = outlines.get(raw.source), w = raw.world(parameter(raw, p));
                // Test each physical silhouette independently, including rear spheres
                // on a shared projected circle. Do not use owner(p)'s strict outside
                // test ON the limb: roundoff can put p just outside both circles and
                // thereby incorrectly expose the entire rear silhouette.
                if (!scene.some(s => s !== raw.source && depthAt(s, w[0], w[1]) > w[2] + .00015)) {
                    if (visible.length && Math.abs(visible.at(-1).b - a) < 1e-9)
                        visible.at(-1).b = b;
                    else
                        visible.push({ c, a, b, start: segment.start, end: segment.end });
                    visible.at(-1).end = segment.end;
                }
            }
        }
    }
    function commands(s, preview, reverse = false) {
        const c = s.c, a = reverse ? s.b : s.a, b = reverse ? s.a : s.b;
        if (c.line)
            return 'L' + fmt$3(nodes[reverse ? s.start : s.end]);
        const maxAngle = preview ? Math.min(.2, Math.sqrt(.024 / c.radius)) :
            Math.min(Math.PI / 4, Math.PI / 4 * Math.pow(.001 / (c.radius * 4.3e-6), 1 / 6));
        const count = Math.max(1, Math.ceil(Math.abs(b - a) / maxAngle));
        let text = '';
        for (let i = 1; i <= count; i++) {
            const t0 = a + (b - a) * (i - 1) / count, t1 = a + (b - a) * i / count;
            const end = i === count ? nodes[reverse ? s.start : s.end] : c.at(t1);
            if (preview)
                text += 'L' + fmt$3(end);
            else {
                const k = 4 / 3 * Math.tan((t1 - t0) / 4);
                text += 'C' + fmt$3(add$2(c.at(t0), mul$1(c.tangent(t0), k))) + ' ' + fmt$3(sub(c.at(t1), mul$1(c.tangent(t1), k))) + ' ' + fmt$3(end);
            }
        }
        return text;
    }
    function directedPath(edges, preview, validateOnly = false) {
        const starts = new Map(), ins = new Map();
        for (const edge of edges) {
            if (!starts.has(edge.start))
                starts.set(edge.start, []);
            starts.get(edge.start).push(edge);
            ins.set(edge.end, (ins.get(edge.end) || 0) + 1);
        }
        // A numerically ambiguous/tangent junction must never close by a chord.
        // Reject the arrangement and let the proven general path handle it.
        for (const [v, list] of starts)
            if (list.length !== 1 || ins.get(v) !== 1)
                return null;
        if (ins.size !== starts.size)
            return null;
        if (validateOnly)
            return '';
        const used = new Set();
        let path = '';
        for (const first of edges) {
            if (used.has(first))
                continue;
            path += 'M' + fmt$3(nodes[first.start]);
            let edge = first;
            do {
                if (!edge || used.has(edge))
                    return null;
                used.add(edge);
                path += commands(edge.s, preview, edge.reverse);
                edge = starts.get(edge.end)?.[0];
            } while (edge !== first);
            path += 'Z';
        }
        return path;
    }
    // Keep every primitive's boundary, including white rods and same-color
    // neighbors. Multiple loops remain in one compound path, preserving holes
    // and disconnected components without sampling a full-frame owner map.
    const cachedSurfacePaths = new Map();
    function surfacePaths(preview) {
        if (cachedSurfacePaths.has(preview))
            return cachedSurfacePaths.get(preview);
        cachedSurfacePaths.set(preview, null);
        if (!certifySurfaceOwnership())
            return null;
        const groups = scene.map(() => []);
        for (const s of segments) {
            if (s.left === s.right)
                continue;
            if (s.left >= 0)
                groups[s.left].push({ s, reverse: false, start: s.start, end: s.end });
            if (s.right >= 0)
                groups[s.right].push({ s, reverse: true, start: s.end, end: s.start });
        }
        const paths = scene.map(() => null);
        for (let i = 0; i < groups.length; i++)
            if (groups[i].length) {
                const path = directedPath(groups[i], preview);
                if (path === null)
                    return null;
                paths[i] = path;
            }
        cachedSurfacePaths.set(preview, paths);
        return paths;
    }
    function wash(colorFor, preview, validateOnly = false) {
        const colors = scene.map(s => {
            if (s.kind !== 'sphere')
                return '';
            let c = colorFor(s.element);
            if (c == null || c === '')
                return '';
            c = String(c).trim().toLowerCase();
            if (c === 'white' || c === '#fff')
                c = '#ffffff';
            if (!/^#[0-9a-f]{6}$/.test(c))
                throw new TypeError('Element colors must be #rrggbb');
            return c === '#ffffff' ? '' : c;
        });
        const groups = new Map();
        for (const s of segments) {
            const left = colors[s.left] || '', right = colors[s.right] || '';
            if (left === right)
                continue;
            for (const [color, reverse] of [[left, false], [right, true]])
                if (color) {
                    if (!groups.has(color))
                        groups.set(color, []);
                    groups.get(color).push({ s, reverse, start: reverse ? s.end : s.start, end: reverse ? s.start : s.end });
                }
        }
        let svg = '<g class="mol-wash" data-boundaries="analytic" stroke="none">';
        for (const [color, edges] of groups) {
            const path = directedPath(edges, preview, validateOnly);
            if (path === null)
                return null;
            if (validateOnly)
                continue;
            svg += '<path fill="' + color + '" fill-rule="evenodd" d="' + path + '"/>';
        }
        return svg + '</g>';
    }
    function outline(s, preview, width) {
        if (!width)
            return '';
        return (outlines.get(s) || []).map(segment => '<path stroke-width="' + width.toFixed(3) + '" d="M' + fmt$3(nodes[segment.start]) + commands(segment, preview) + '"/>').join('');
    }
    // Index geometry by SURFACE identity, not color: white atoms and equal-hue
    // neighbors still have their own visible hatch regions. Build only on use.
    let incident = null;
    function incidentCurves(source) {
        if (!incident) {
            incident = new Map(scene.map(s => [s, new Set()]));
            for (const segment of segments)
                if (segment.left !== segment.right) {
                    for (const id of [segment.left, segment.right])
                        if (id >= 0)
                            incident.get(scene[id]).add(segment.c);
                }
        }
        return incident.get(source);
    }
    function intervals(path, cuts, source, front = () => true) {
        cuts.sort((a, b) => a - b);
        cuts = cuts.filter((t, i, a) => !i || t - a[i - 1] > 1e-10);
        const result = [];
        for (let i = 1; i < cuts.length; i++) {
            const a = cuts[i - 1], b = cuts[i], m = (a + b) / 2, p = path.world(m);
            // Physical occlusion, not the legacy .00015 expanded visibility band.
            // Only classify open intervals; boundary endpoints belong to that run.
            if (!front(m) || scene.some(s => s !== source && depthAt(s, p[0], p[1]) > p[2] + 1e-9))
                continue;
            const lo = a / path.end, hi = b / path.end;
            if (result.length && Math.abs(result.at(-1)[1] - lo) < 1e-10)
                result.at(-1)[1] = hi;
            else
                result.push([lo, hi]);
        }
        return result;
    }
    function clipCircle(source, center, u, v) {
        const candidates = incidentCurves(source);
        if (!candidates || source.kind !== 'sphere')
            return null;
        const z = center[2] - source.c[2], amplitude = Math.hypot(u[2], v[2]);
        if (z + amplitude < 0)
            return [];
        const count = curves.length;
        try {
            circle(center, u, v);
            if (curves.length === count)
                return null;
            const path = curves.pop();
            if (!path || path.line)
                return null;
            const cuts = [0, TAU$2];
            // The source limb is cheaper and more stable in 3-D than the double
            // root of the two projected ellipses at a tangent.
            if (amplitude > 0 && Math.abs(z) <= amplitude) {
                const angle = Math.atan2(v[2], u[2]), half = Math.acos(Math.max(-1, Math.min(1, -z / amplitude)));
                for (const t of [angle - half, angle + half])
                    cuts.push((t % TAU$2 + TAU$2) % TAU$2);
            }
            for (const boundary of candidates)
                if (!boundary.members.some(m => m.source === source)) {
                    // Plane shortcut is valid only if every shared owner supplies a seam
                    // on this physical sphere; include ALL such planes, not just the first.
                    // Otherwise use the projected shared solver.
                    const contacts = boundary.contacts;
                    if (contacts.length && contacts.length === boundary.members.length && contacts.every(c => c.sphere === source)) {
                        for (const contact of contacts) {
                            // Own sphere/rod seam: reuse its 3-D plane, not a quartic between
                            // projected ellipses. Intersecting a hatch circle with this plane
                            // is just constant + A*cos(t) + B*sin(t) = 0.
                            const k = dot$2(sub(center, source.c), contact.axis) - contact.offset;
                            const A = dot$2(u, contact.axis), B = dot$2(v, contact.axis), r = Math.hypot(A, B);
                            if (r < 1e-14) {
                                if (Math.abs(k) < 1e-12)
                                    return null;
                                continue;
                            }
                            if (Math.abs(k) <= r) {
                                const phase = Math.atan2(B, A), half = Math.acos(Math.max(-1, Math.min(1, -k / r)));
                                for (const t of [phase - half, phase + half])
                                    cuts.push((t % TAU$2 + TAU$2) % TAU$2);
                            }
                        }
                    }
                    else
                        intersections(path, boundary, t => cuts.push(t));
                }
            return intervals(path, cuts, source, t => z + u[2] * Math.cos(t) + v[2] * Math.sin(t) >= 0);
        }
        catch (_) {
            return null;
        }
        finally {
            curves.length = count;
        }
    }
    function clipLine(source, a, b) {
        if (source.kind !== 'cylinder' || !scene.includes(source))
            return null;
        if (covered.has(source))
            return [];
        const count = curves.length;
        try {
            line2(project(a), project(b));
            if (curves.length === count)
                return null;
            const path = curves.pop();
            if (!path)
                return null;
            const direction = sub(b, a);
            path.world = t => add$2(a, mul$1(direction, t));
            const cuts = [0, 1];
            for (const boundary of curves) {
                if (boundary.contacts.length && boundary.contacts.length === boundary.members.length && boundary.contacts.every(c => c.cylinder === source)) {
                    for (const contact of boundary.contacts) {
                        const denominator = dot$2(direction, contact.axis);
                        if (Math.abs(denominator) > 1e-14) {
                            const t = (contact.offset - dot$2(sub(a, contact.sphere.c), contact.axis)) / denominator;
                            if (t >= 0 && t <= 1)
                                cuts.push(t);
                        }
                    }
                }
                else
                    intersections(path, boundary, t => cuts.push(t));
            }
            // Same-color cylinder/cylinder contacts are absent from fill boundaries.
            // A generator crossing another closed rod needs its 3-D side/cap events.
            for (const other of cylinders)
                if (other !== source) {
                    const w = sub(a, other.a), wu = dot$2(w, other.u), du = dot$2(direction, other.u);
                    const A = dot$2(direction, direction) - du * du, B = 2 * (dot$2(w, direction) - wu * du), C = dot$2(w, w) - wu * wu - other.r * other.r;
                    const rr = roots([C, B, A], 0, 1);
                    if (rr === null)
                        return null;
                    for (const t of rr) {
                        const axial = wu + t * du;
                        if (axial >= -1e-9 && axial <= other.length + 1e-9)
                            cuts.push(t);
                    }
                    if (Math.abs(du) > 1e-14)
                        for (const end of [0, other.length]) {
                            const t = (end - wu) / du;
                            if (t >= 0 && t <= 1) {
                                const q = add$2(w, mul$1(direction, t));
                                if (dot$2(q, q) - end * end <= other.r * other.r + 1e-10)
                                    cuts.push(t);
                            }
                        }
                }
            return intervals(path, cuts, source);
        }
        catch (_) {
            return null;
        }
        finally {
            curves.length = count;
        }
    }
    let certifiedSurfaceOwnership;
    function certifySurfaceOwnership() {
        if (certifiedSurfaceOwnership !== undefined)
            return certifiedSurfaceOwnership;
        certifiedSurfaceOwnership = false;
        // Fill may merge white rods, but dots need each actual visible surface.
        // Our arrangement omits rod/rod intersection seams. Certify that exposed
        // rod bodies cannot intersect before using it for dot ownership. Trim off
        // the portions proven wholly inside their endpoint balls; bound each
        // remaining body by a capsule and test segment distances conservatively.
        const exposed = cylinders.flatMap((c, i) => {
            if (covered.has(c))
                return [];
            const lo = Math.sqrt(ends[i][0].r ** 2 - c.r ** 2), hi = c.length - Math.sqrt(ends[i][1].r ** 2 - c.r ** 2);
            return [{ a: add$2(c.a, mul$1(c.u, lo)), b: add$2(c.a, mul$1(c.u, hi)), r: c.r }];
        });
        const pointSegment = (p, a, b) => { const d = sub(b, a), length2 = dot$2(d, d), t = length2 ? Math.max(0, Math.min(1, dot$2(sub(p, a), d) / length2)) : 0; return dist(p, add$2(a, mul$1(d, t))); };
        for (let i = 0; i < exposed.length; i++)
            for (let j = 0; j < i; j++) {
                const x = exposed[i], y = exposed[j], r = x.r + y.r + 1e-8;
                if ([0, 1, 2].some(k => Math.min(x.a[k], x.b[k]) - Math.max(y.a[k], y.b[k]) > r || Math.min(y.a[k], y.b[k]) - Math.max(x.a[k], x.b[k]) > r))
                    continue;
                const u = sub(x.b, x.a), v = sub(y.b, y.a), w = sub(x.a, y.a), a = dot$2(u, u), b = dot$2(u, v), c = dot$2(v, v), d = dot$2(u, w), e = dot$2(v, w), det = a * c - b * b;
                // Nearly parallel axes: do not turn cancellation into a false proof.
                if (det <= 1e-12 * a * c)
                    return false;
                let distance = Math.min(pointSegment(x.a, y.a, y.b), pointSegment(x.b, y.a, y.b), pointSegment(y.a, x.a, x.b), pointSegment(y.b, x.a, x.b));
                const s = (b * e - c * d) / det, t = (a * e - b * d) / det;
                if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
                    distance = Math.min(distance, dist(add$2(x.a, mul$1(u, s)), add$2(y.a, mul$1(v, t))));
                if (distance <= r)
                    return false;
            }
        certifiedSurfaceOwnership = true;
        return true;
    }
    let cachedDotRegions;
    function dotRegions() {
        if (cachedDotRegions !== undefined)
            return cachedDotRegions;
        cachedDotRegions = null;
        if (!certifySurfaceOwnership())
            return null;
        const helper = getDotRegions();
        if (helper)
            cachedDotRegions = helper.create(scene, segments, nodes, project, scale);
        return cachedDotRegions;
    }
    return { wash, outline, clipCircle, clipLine, dotRegions, surfacePaths, validate: colorFor => wash(colorFor, true, true) !== null, curveCount: curves.length, segmentCount: segments.length };
}

const Boundaries = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    build
}, Symbol.toStringTag, { value: 'Module' }));

/**
 * buildWash(scene, depthAt, project, scale, colorForElement, options?) -> SVG <g>.
 * options.fitCurves=false skips Bezier fitting for interactive preview.
 * scene is an array of spheres / cylinders in view coordinates; larger z is
 * nearer. project must be [ox + scale*x, oy - scale*y], with positive scale.
 * depthAt(shape, worldX, worldY) returns front z, or -Infinity outside.
 * Cylinders and white/null colors occlude but produce no fill. Exact depth
 * ties favor an uncolored surface; otherwise the earlier scene item wins.
 *
 * A 1 SVG-unit ownership grid supplies topology, NOT staircase geometry.
 * Dual-edge surface queries bisect crossings to 0.0001 SVG units; boundary
 * samples are adaptively refined and least-squares fitted to cubic Beziers
 * (0.012 fit tolerance, 0.003 sampling tolerance). Shared color interfaces
 * reuse identical curves in reverse, with shared refined three-way junctions.
 * Output is one evenodd path per normalized color using M/L/C/Z commands;
 * coordinates are rounded to 0.001 SVG units. No image, filter or dependency.
 *
 * Topology remains sampled: sub-cell islands, holes or multiple junctions
 * can be missed; this is not an analytic error guarantee for arbitrary depth
 * callbacks. Huge extents coarsen the grid to stay below 4M cells. Mask work
 * is bounded by clipped shape boxes; refinement checks candidate shapes at
 * boundary points. Memory is O(grid cells + boundary samples).
 */
function buildWash(scene, depthAt, project, scale, colorForElement, options = {}) {
    var empty = '<g class="mol-wash"></g>';
    if (!Array.isArray(scene))
        throw new TypeError('scene must be an array');
    if (typeof depthAt !== 'function' || typeof project !== 'function' ||
        typeof colorForElement !== 'function')
        throw new TypeError('Expected callback functions');
    if (!(scale > 0) || !Number.isFinite(scale))
        throw new RangeError('scale must be finite and positive');
    var origin = project([0, 0, 0]);
    if (!valid2(origin))
        throw new RangeError('project must return finite coordinates');
    var shapes = [], colors = [''], colorIds = new Map();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    scene.forEach(function (s) {
        if (!s || (s.kind !== 'sphere' && s.kind !== 'cylinder'))
            return;
        if (!(s.r > 0) || !Number.isFinite(s.r))
            return;
        var p, q, id = 0;
        if (s.kind === 'sphere') {
            if (!valid3(s.c))
                return;
            p = q = project(s.c);
            var color = colorForElement(s.element);
            if (color != null && color !== '') {
                color = String(color).trim().toLowerCase();
                if (color === 'white' || color === '#fff')
                    color = '#ffffff';
                if (!/^#[0-9a-f]{6}$/.test(color))
                    throw new TypeError('Element colors must be #rrggbb');
                if (color !== '#ffffff') {
                    if (!colorIds.has(color)) {
                        colorIds.set(color, colors.length);
                        colors.push(color);
                    }
                    id = colorIds.get(color);
                }
            }
        }
        else {
            if (!valid3(s.a) || !valid3(s.u) || !(s.length >= 0) || !Number.isFinite(s.length))
                return;
            p = project(s.a);
            q = project([s.a[0] + s.u[0] * s.length, s.a[1] + s.u[1] * s.length,
                s.a[2] + s.u[2] * s.length]);
        }
        if (!valid2(p) || !valid2(q))
            return;
        var r = s.r * scale;
        var b = [Math.min(p[0], q[0]) - r, Math.min(p[1], q[1]) - r,
            Math.max(p[0], q[0]) + r, Math.max(p[1], q[1]) + r];
        if (!b.every(Number.isFinite))
            throw new RangeError('Projected bounds overflow');
        shapes.push({ shape: s, bounds: b, label: id });
        if (s.kind === 'sphere') {
            minX = Math.min(minX, b[0]);
            minY = Math.min(minY, b[1]);
            maxX = Math.max(maxX, b[2]);
            maxY = Math.max(maxY, b[3]);
        }
    });
    if (maxX === -Infinity || colors.length === 1)
        return empty;
    var width = maxX - minX, height = maxY - minY;
    if (!Number.isFinite(width) || !Number.isFinite(height))
        throw new RangeError('Projected extent overflow');
    // Also bound skinny, extremely long viewports; padding covers outer edges.
    var step = Math.max(1, Math.sqrt(width) * Math.sqrt(height) / 1998, width / 3990000, height / 3990000);
    var nx = Math.ceil(width / step) + 2, ny = Math.ceil(height / step) + 2;
    while (nx * ny > 4000000) {
        step *= 1.1;
        nx = Math.ceil(width / step) + 2;
        ny = Math.ceil(height / step) + 2;
    }
    var x0 = minX - step, y0 = minY - step;
    var labels = new Uint32Array(nx * ny), depths = new Float64Array(nx * ny);
    depths.fill(-Infinity);
    shapes.forEach(function (item) {
        var b = item.bounds;
        var left = Math.max(0, Math.ceil((b[0] - x0) / step - 0.5));
        var right = Math.min(nx - 1, Math.floor((b[2] - x0) / step - 0.5));
        var top = Math.max(0, Math.ceil((b[1] - y0) / step - 0.5));
        var bottom = Math.min(ny - 1, Math.floor((b[3] - y0) / step - 0.5));
        for (var y = top; y <= bottom; y++) {
            var wy = (origin[1] - (y0 + (y + 0.5) * step)) / scale;
            for (var x = left; x <= right; x++) {
                var wx = (x0 + (x + 0.5) * step - origin[0]) / scale;
                var z = depthAt(item.shape, wx, wy), i = y * nx + x;
                if (Number.isFinite(z) && (z > depths[i] || (z === depths[i] && item.label === 0))) {
                    depths[i] = z;
                    labels[i] = item.label;
                }
            }
        }
    });
    // Directed lattice edges, with the owning pixel on their right side.
    // Direction codes: east=0, south=1, west=2, north=3.
    var stride = nx + 1, graphs = new Map();
    function edge(label, x, y, direction) {
        var graph = graphs.get(label);
        if (!graph) {
            graph = new Map();
            graphs.set(label, graph);
        }
        var v = y * stride + x;
        graph.set(v, (graph.get(v) || 0) | (1 << direction));
    }
    for (var y = 0; y < ny; y++) {
        for (var x = 0; x < nx; x++) {
            var i = y * nx + x, label = labels[i];
            if (!label)
                continue;
            if (!y || labels[i - nx] !== label)
                edge(label, x, y, 0);
            if (x === nx - 1 || labels[i + 1] !== label)
                edge(label, x + 1, y, 1);
            if (y === ny - 1 || labels[i + nx] !== label)
                edge(label, x + 1, y + 1, 2);
            if (!x || labels[i - 1] !== label)
                edge(label, x, y + 1, 3);
        }
    }
    // The grid determines connectivity only. Coordinates come from the same
    // surface-depth oracle as the renderer, never from grid corners.
    function owner(p) {
        var best = -Infinity, label = 0;
        var wx = (p[0] - origin[0]) / scale, wy = (origin[1] - p[1]) / scale;
        for (var j = 0; j < shapes.length; j++) {
            var item = shapes[j], b = item.bounds;
            if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3])
                continue;
            var z = depthAt(item.shape, wx, wy);
            if (Number.isFinite(z) && (z > best || (z === best && item.label === 0))) {
                best = z;
                label = item.label;
            }
        }
        return label;
    }
    function bisect(a, b, label) {
        for (var k = 0; k < 32 && distance(a, b) > 0.0001; k++) {
            var m = mix(a, b, 0.5);
            if (owner(m) === label)
                a = m;
            else
                b = m;
        }
        return mix(a, b, 0.5);
    }
    var output = ['<g class="mol-wash" stroke="none">'];
    var delta = [1, stride, -1, -stride], crossings = new Map(), junctions = new Map(), fitted = new Map();
    function center(x, y) { return [x0 + (x + 0.5) * step, y0 + (y + 0.5) * step]; }
    function crossing(v, direction) {
        var end = v + delta[direction], key = Math.min(v, end) + ':' + Math.max(v, end);
        if (crossings.has(key))
            return crossings.get(key);
        var x = v % stride, y = Math.floor(v / stride), a, b;
        if (direction === 0) {
            a = center(x, y - 1);
            b = center(x, y);
        }
        if (direction === 1) {
            a = center(x - 1, y);
            b = center(x, y);
        }
        if (direction === 2) {
            a = center(x - 1, y - 1);
            b = center(x - 1, y);
        }
        if (direction === 3) {
            a = center(x - 1, y - 1);
            b = center(x, y - 1);
        }
        var la = owner(a), lb = owner(b), boundary = bisect(a, b, la);
        // A coarse dual edge can cross a third region between its two labels
        // (e.g. background at the tip of two tangent silhouettes). Its binary
        // crossing is then NOT on the requested interface; terminate at the
        // shared nearby junction instead of fitting a spurious hook into it.
        for (var probe = 1; probe < 8; probe++) {
            var middleLabel = owner(mix(a, b, probe / 8));
            if (middleLabel !== la && middleLabel !== lb) {
                var ja = junction(v), jb = junction(end), nearest = ja || jb;
                if (ja && jb && distance(jb.p, boundary) < distance(ja.p, boundary))
                    nearest = jb;
                if (nearest)
                    boundary = nearest.p;
                break;
            }
        }
        var point = { p: boundary, key: key, pair: [Math.min(la, lb), Math.max(la, lb)] };
        crossings.set(key, point);
        return point;
    }
    function junction(v) {
        if (junctions.has(v))
            return junctions.get(v);
        var x = v % stride, y = Math.floor(v / stride);
        var corners = [center(x - 1, y - 1), center(x, y - 1), center(x, y), center(x - 1, y)];
        var ls = corners.map(owner), tri = null;
        for (var a = 0; a < 4 && !tri; a++)
            for (var b = a + 1; b < 4 && !tri; b++)
                for (var c = b + 1; c < 4; c++)
                    if (ls[a] !== ls[b] && ls[b] !== ls[c] && ls[a] !== ls[c]) {
                        tri = [corners[a], corners[b], corners[c]];
                        break;
                    }
        if (!tri) {
            junctions.set(v, null);
            return null;
        }
        // Refine the dual cell, retaining a subcell incident to three regions.
        // A triangle chosen from three corners need not enclose the junction:
        // its missing fourth corner can hide an intervening silhouette arc.
        var cells = [[corners[0][0], corners[0][1], step]];
        for (var it = 0; it < 16 && cells[0][2] > 0.0001; it++) {
            var found = [];
            cells.forEach(function (cell) {
                var bx = cell[0] - cell[2] * 1.5, by = cell[1] - cell[2] * 1.5, h = cell[2] / 4, samples = [];
                for (var yy = 0; yy <= 16; yy++)
                    for (var xx = 0; xx <= 16; xx++)
                        samples.push(owner([bx + xx * h, by + yy * h]));
                for (var yy = 0; yy < 16; yy++)
                    for (var xx = 0; xx < 16; xx++) {
                        var at = yy * 17 + xx;
                        var ids = new Set([samples[at], samples[at + 1], samples[at + 17], samples[at + 18]]);
                        if (ids.size >= 3)
                            found.push([bx + xx * h, by + yy * h, h]);
                    }
            });
            if (!found.length)
                break;
            // Recenter the expanded search on the closest candidate. A thin wedge
            // can put three labels in a cell whose actual junction is just outside.
            found.sort(function (a, b) {
                var target = [x0 + x * step, y0 + y * step];
                return distance([a[0] + a[2] / 2, a[1] + a[2] / 2], target) - distance([b[0] + b[2] / 2, b[1] + b[2] / 2], target);
            });
            cells = found.slice(0, 1);
        }
        var cell = cells[0], p = [cell[0] + cell[2] / 2, cell[1] + cell[2] / 2];
        var result = { p: p, key: 'j' + v, junction: true };
        junctions.set(v, result);
        return result;
    }
    function refine(a, b, pair, depth, result) {
        var len = distance(a, b);
        if (len < 0.025 || depth > 12) {
            result.push(b);
            return;
        }
        var m = mix(a, b, 0.5), n = [(b[1] - a[1]) / len, (a[0] - b[0]) / len];
        var span = Math.max(0.02, len * 0.6), lo, hi, l, h;
        for (var k = 0; k < 5; k++) {
            lo = add$1(m, n, -span);
            hi = add$1(m, n, span);
            l = owner(lo);
            h = owner(hi);
            if (l !== h && pair.indexOf(l) >= 0 && pair.indexOf(h) >= 0)
                break;
            span *= 0.5;
        }
        var thirdRegion = false;
        if (l !== h && pair.indexOf(l) >= 0 && pair.indexOf(h) >= 0) {
            for (var probe = 1; probe < 8; probe++)
                if (pair.indexOf(owner(mix(lo, hi, probe / 8))) < 0)
                    thirdRegion = true;
        }
        if (thirdRegion || l === h || pair.indexOf(l) < 0 || pair.indexOf(h) < 0) {
            // Near a three-way corner the third region may occupy one side of a
            // wide normal bracket. Search for the requested pair, not its silhouette.
            var previous = add$1(m, n, -len), previousLabel = owner(previous), best = Infinity, bracket = null;
            for (var scan = 1; scan <= 128; scan++) {
                var candidate = add$1(m, n, -len + 2 * len * scan / 128), candidateLabel = owner(candidate);
                if (candidateLabel !== previousLabel && pair.indexOf(candidateLabel) >= 0 && pair.indexOf(previousLabel) >= 0) {
                    var score = distance(m, mix(previous, candidate, 0.5));
                    if (score < best) {
                        best = score;
                        bracket = [previous, candidate, previousLabel];
                    }
                }
                previous = candidate;
                previousLabel = candidateLabel;
            }
            if (!bracket) {
                result.push(b);
                return;
            }
            lo = bracket[0];
            hi = bracket[1];
            l = bracket[2];
        }
        var q = bisect(lo, hi, l);
        if (distance(m, q) > 0.003 || len > 0.5) {
            refine(a, q, pair, depth + 1, result);
            refine(q, b, pair, depth + 1, result);
        }
        else
            result.push(b);
    }
    function chain(nodes, pair) {
        var reverse = nodes[0].key > nodes[nodes.length - 1].key;
        if (reverse)
            nodes = nodes.slice().reverse();
        var key = nodes.map(function (p) { return p.key; }).join('/');
        var curves = fitted.get(key);
        if (!curves) {
            var samples = [nodes[0].p];
            for (var j = 1; j < nodes.length; j++)
                refine(nodes[j - 1].p, nodes[j].p, pair, 0, samples);
            // Preview preserves the same refined boundary and shared interfaces,
            // but skips fitting entirely; export retains the compact cubic geometry.
            curves = options.fitCurves === false
                ? samples.slice(1).map(function (p, i) { return [samples[i], p]; })
                : fitContour(samples, 0.012);
            fitted.set(key, curves);
        }
        if (reverse)
            curves = curves.slice().reverse().map(function (c) { return c.slice().reverse(); });
        return curves;
    }
    function contour(nodes) {
        var cuts = [];
        for (var k = 0; k < nodes.length; k++)
            if (nodes[k].junction)
                cuts.push(k);
        // Closed two-label curves use a deterministic seam and antipodal split;
        // the reverse walk then reuses precisely the same fitted cubic segments.
        if (!cuts.length) {
            var first = 0;
            for (var k = 1; k < nodes.length; k++)
                if (nodes[k].key < nodes[first].key)
                    first = k;
            var far = first;
            for (var k = 0; k < nodes.length; k++)
                if (distance(nodes[k].p, nodes[first].p) > distance(nodes[far].p, nodes[first].p))
                    far = k;
            cuts = [first, far].sort(function (a, b) { return a - b; });
        }
        var d = 'M' + coord(nodes[cuts[0]].p);
        for (var k = 0; k < cuts.length; k++) {
            var run = [nodes[cuts[k]]], at = (cuts[k] + 1) % nodes.length, end = cuts[(k + 1) % cuts.length];
            while (at !== end) {
                run.push(nodes[at]);
                at = (at + 1) % nodes.length;
            }
            run.push(nodes[end]);
            var pair = run.find(function (p) { return p.pair; }).pair;
            chain(run, pair).forEach(function (c) {
                d += c.length === 2 ? 'L' + coord(c[1]) : 'C' + coord(c[1]) + ' ' + coord(c[2]) + ' ' + coord(c[3]);
            });
        }
        return d + 'Z';
    }
    graphs.forEach(function (graph, label) {
        var loops = [];
        graph.forEach(function (_, start) {
            while (graph.get(start)) {
                var mask = graph.get(start), direction = 0;
                while (!(mask & (1 << direction)))
                    direction++;
                var v = start, points = [];
                do {
                    var jp = junction(v);
                    if (jp)
                        points.push(jp);
                    points.push(crossing(v, direction));
                    var bits = graph.get(v);
                    graph.set(v, bits & ~(1 << direction));
                    var next = v + delta[direction];
                    if (next === start)
                        break;
                    var available = graph.get(next) || 0;
                    // At diagonal contact choose a right turn, keeping components
                    // separate instead of creating a self-crossing figure-eight.
                    var choices = [(direction + 1) % 4, direction, (direction + 3) % 4, (direction + 2) % 4];
                    var nextDirection = -1;
                    for (var k = 0; k < 4; k++) {
                        if (available & (1 << choices[k])) {
                            nextDirection = choices[k];
                            break;
                        }
                    }
                    if (nextDirection < 0)
                        throw new Error('Open wash contour');
                    v = next;
                    direction = nextDirection;
                } while (true);
                if (points.length >= 3)
                    loops.push(contour(points));
            }
        });
        if (loops.length)
            output.push('<path fill="' + colors[label] + '" fill-rule="evenodd" d="' + loops.join('') + '"/>');
    });
    output.push('</g>');
    return output.join('');
}
function coord(p) { return format(p[0]) + ' ' + format(p[1]); }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function mix(a, b, t) { return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t]; }
function add$1(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s]; }
function unit(a, b) { var d = distance(a, b); return d ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : [1, 0]; }
function dot$1(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function bezier(c, t) { var a = mix(c[0], c[1], t), b = mix(c[1], c[2], t), d = mix(c[2], c[3], t); return mix(mix(a, b, t), mix(b, d, t), t); }
// Schneider-style least-squares cubic fitting, with chord-length parameters,
// Newton reparameterization and recursive maximum-error subdivision. The
// samples have already been refined against the depth oracle to 0.003 SVG.
function fitContour(input, tolerance) {
    var p = input.filter(function (q, i) { return !i || i === input.length - 1 || distance(q, input[i - 1]) > 0.0002; });
    while (p.length > 2 && distance(p[p.length - 2], p[p.length - 1]) <= 0.0002)
        p.splice(p.length - 2, 1);
    var result = [];
    if (p.length < 2)
        return result;
    function fit(lo, hi, left, right, depth) {
        var count = hi - lo, length = 0, u = [0];
        for (var i = lo + 1; i <= hi; i++) {
            length += distance(p[i - 1], p[i]);
            u.push(length);
        }
        if (count === 1) {
            result.push([p[lo], p[hi]]);
            return;
        }
        u = u.map(function (v) { return v / length; });
        var split = lo + Math.floor(count / 2), curve;
        for (var iteration = 0; iteration < 5; iteration++) {
            var c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
            for (var j = 0; j <= count; j++) {
                var t = u[j], s = 1 - t, b0 = s * s * s, b1 = 3 * t * s * s, b2 = 3 * t * t * s, b3 = t * t * t;
                var a = [left[0] * b1, left[1] * b1], b = [right[0] * b2, right[1] * b2];
                var r = [p[lo + j][0] - p[lo][0] * (b0 + b1) - p[hi][0] * (b2 + b3),
                    p[lo + j][1] - p[lo][1] * (b0 + b1) - p[hi][1] * (b2 + b3)];
                c00 += dot$1(a, a);
                c01 += dot$1(a, b);
                c11 += dot$1(b, b);
                x0 += dot$1(a, r);
                x1 += dot$1(b, r);
            }
            var det = c00 * c11 - c01 * c01;
            var alpha = det ? (x0 * c11 - x1 * c01) / det : 0;
            var beta = det ? (c00 * x1 - c01 * x0) / det : 0;
            if (alpha < length * 1e-6 || beta < length * 1e-6 || alpha > length || beta > length)
                alpha = beta = distance(p[lo], p[hi]) / 3;
            curve = [p[lo], add$1(p[lo], left, alpha), add$1(p[hi], right, beta), p[hi]];
            var error = 0;
            for (var j = 1; j < count; j++) {
                var err = distance(bezier(curve, u[j]), p[lo + j]);
                if (err > error) {
                    error = err;
                    split = lo + j;
                }
            }
            // Also test between sample parameters: this prevents an interpolating
            // cubic from overshooting a short, sharply turning boundary segment.
            for (var j = 0; j < count; j++) {
                var q = bezier(curve, (u[j] + u[j + 1]) / 2), a = p[lo + j], b = p[lo + j + 1];
                var dx = b[0] - a[0], dy = b[1] - a[1], dd = dx * dx + dy * dy;
                var f = dd ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / dd)) : 0;
                var err = distance(q, mix(a, b, f));
                if (err > error) {
                    error = err;
                    split = Math.max(lo + 1, Math.min(hi - 1, lo + j));
                }
            }
            if (error <= tolerance) {
                result.push(curve);
                return;
            }
            if (iteration === 4 || error > tolerance * 8)
                break;
            var updated = [0], valid = true;
            for (var j = 1; j < count; j++) {
                var t = u[j], q = bezier(curve, t), s = 1 - t;
                var d = [0, 0], secondDerivative = [0, 0];
                for (var axis = 0; axis < 2; axis++) {
                    d[axis] = 3 * (s * s * (curve[1][axis] - curve[0][axis]) + 2 * s * t * (curve[2][axis] - curve[1][axis]) + t * t * (curve[3][axis] - curve[2][axis]));
                    secondDerivative[axis] = 6 * (s * (curve[2][axis] - 2 * curve[1][axis] + curve[0][axis]) + t * (curve[3][axis] - 2 * curve[2][axis] + curve[1][axis]));
                }
                var r = [q[0] - p[lo + j][0], q[1] - p[lo + j][1]], denominator = dot$1(d, d) + dot$1(r, secondDerivative);
                var next = denominator ? t - dot$1(r, d) / denominator : t;
                if (!(next > updated[j - 1] && next < 1))
                    valid = false;
                updated.push(next);
            }
            if (!valid)
                break;
            updated.push(1);
            u = updated;
        }
        if (depth > 32) {
            for (var i = lo + 1; i <= hi; i++)
                result.push([p[i - 1], p[i]]);
            return;
        }
        var tangent = unit(p[split + 1], p[split - 1]);
        fit(lo, split, left, tangent, depth + 1);
        fit(split, hi, [-tangent[0], -tangent[1]], right, depth + 1);
    }
    // Preserve actual corners (e.g. flat cylinder caps) instead of forcing a
    // common tangent there. Tiny bisection noise is below this angle threshold.
    var cuts = [0];
    for (var i = 1; i < p.length - 1; i++) {
        var a = i - 1, b = i + 1;
        while (a > 0 && distance(p[a], p[i]) < 0.04)
            a--;
        while (b < p.length - 1 && distance(p[b], p[i]) < 0.04)
            b++;
        if (dot$1(unit(p[a], p[i]), unit(p[i], p[b])) < 0.8 && i - cuts[cuts.length - 1] > 1)
            cuts.push(i);
    }
    cuts.push(p.length - 1);
    for (var i = 1; i < cuts.length; i++) {
        var lo = cuts[i - 1], hi = cuts[i];
        fit(lo, hi, unit(p[lo], p[lo + 1]), unit(p[hi], p[hi - 1]), 0);
    }
    return result;
}
function valid2(p) { return p && Number.isFinite(p[0]) && Number.isFinite(p[1]); }
function valid3(p) { return valid2(p) && Number.isFinite(p[2]); }
function format(n) { return String(Math.round(n * 1000) / 1000); }

const Wash = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    buildWash,
    fitContour
}, Symbol.toStringTag, { value: 'Module' }));

const LEVELS = 16;
const fmt$2 = (n) => String(Number(n.toFixed(4)));
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
            parts.push(`<circle cx="${fmt$2(x)}" cy="${fmt$2(y)}" r="${fmt$2(r)}"/>`);
            continue;
        }
        const a = project(s.a), b = project(s.a.map((v, i) => v + s.u[i] * s.length));
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        const vx = length > 1e-12 ? -dy / length : 1, vy = length > 1e-12 ? dx / length : 0;
        const angle = Math.atan2(vy, vx) * 180 / Math.PI;
        for (const p of [a, b])
            parts.push(`<ellipse cx="${fmt$2(p[0])}" cy="${fmt$2(p[1])}" rx="${fmt$2(r)}" ry="${fmt$2(r * Math.abs(s.u[2]))}" transform="rotate(${fmt$2(angle)} ${fmt$2(p[0])} ${fmt$2(p[1])})"/>`);
        if (length > 1e-12) {
            const p = [[a[0] + r * vx, a[1] + r * vy], [b[0] + r * vx, b[1] + r * vy], [b[0] - r * vx, b[1] - r * vy], [a[0] - r * vx, a[1] - r * vy]];
            parts.push(`<path d="M${p.map(v => v.map(fmt$2).join(' ')).join('L')}Z"/>`);
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
            paths.push('M' + simple.map(p => p.map(fmt$2).join(' ')).join('L') + 'Z');
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
                dots.push(`<circle cx="${fmt$2((x + .5) * o.pitch)}" cy="${fmt$2((y + .5) * o.pitch)}" r="${fmt$2(r)}"/>`);
        defs.push(`<pattern id="${prefix}-${level}" data-coverage="${ink}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0" width="${fmt$2(o.pitch)}" height="${fmt$2(o.pitch)}" patternTransform="rotate(45)" overflow="hidden"><g fill="#161616" stroke="none">${dots.join('')}</g></pattern>`);
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
            body += `<rect data-tone-level="${i + 1}" x="${fmt$2(left)}" y="${fmt$2(top)}" width="${fmt$2(right - left)}" height="${fmt$2(bottom - top)}" fill="url(#${prefix}-${i + 1})" clip-path="url(#${id})"/>`;
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

const TAU$1 = 2 * Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul = (a, k) => a.map(x => x * k);
const add = (a, b) => a.map((x, i) => x + b[i]);
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const positiveAngle = (t) => ((t % TAU$1) + TAU$1) % TAU$1;
const clamp$1 = (x) => Math.max(-1, Math.min(1, x));
const fmt$1 = (p) => `${p[0].toFixed(4)} ${p[1].toFixed(4)}`;
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
        out += `C${fmt$1([p[0] + k * da[0], p[1] + k * da[1]])} ${fmt$1([q[0] - k * db[0], q[1] - k * db[1]])} ${fmt$1(q)}`;
        p = q;
    }
    return out;
}
function full(e) {
    const p = e.at(0);
    return `M${fmt$1(p)}${arc(e, 0, TAU$1, p, p)}Z`;
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
            const a = phi + alpha, b = phi + TAU$1 - alpha;
            const n0 = [Math.cos(a), Math.sin(a), 0], n1 = [Math.cos(b), Math.sin(b), 0];
            const p0 = project(add(s.c, mul(n0, s.r))), p1 = project(add(s.c, mul(n1, s.r)));
            // n dot e/f = q cos/sin(t); the center T*L is perpendicular to e/f.
            const t0 = Math.atan2(dot(n1, f), dot(n1, e));
            const t1 = Math.atan2(dot(n0, f), dot(n0, e));
            let sweep = positiveAngle(t1 - t0);
            const mid = t0 + sweep / 2;
            if (T * L[2] + q * (e[2] * Math.cos(mid) + f[2] * Math.sin(mid)) < 0)
                sweep -= TAU$1;
            return `M${fmt$1(p0)}${arc(rim, a, b, p0, p1)}${arc(iso, t0, t0 + sweep, p1, p0)}Z`;
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
            out += `M${fmt$1(a0)}L${fmt$1(b0)}${arc(cb, t0, t1, b0, b1)}L${fmt$1(a1)}${arc(ca, t1, t0, a1, a0)}Z`;
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
    const circles = [], batches = surfaces?.compactStipple ? new Map() : null;
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

const Dots = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    buildDots
}, Symbol.toStringTag, { value: 'Module' }));

// Canonical source/ESM dependencies: no globals, loader, or DOM required.
// Getters defer access until render time and keep the compatibility adapter small.
function getBoundaries() { return Boundaries; }
function getWash() { return Wash; }
function getDots() { return Dots; }

const TAU = 2 * Math.PI;
const fmt = (p) => p.slice(0, 2).map(v => String(Number(v.toFixed(4)))).join(' ');
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
            cuts.push(((t / TAU) % 1 + 1) % 1);
    }
    cuts.sort((x, y) => x - y);
    const result = [];
    for (let i = 1; i < cuts.length; i++) {
        const x = cuts[i - 1], y = cuts[i], t = (x + y) / 2 * TAU;
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
    const point = (t) => { const a = t * TAU; return c.map((x, i) => x + U[i] * Math.cos(a) + V[i] * Math.sin(a)); };
    const tangent = (t) => { const a = t * TAU; return U.map((x, i) => TAU * (-x * Math.sin(a) + V[i] * Math.cos(a))); };
    return { point, tangent, clip: region => region.clipEllipse(c, U, V), path: (a, b) => {
            const count = Math.max(1, Math.ceil(Math.abs(b - a) * 8)), step = (b - a) / count, k = 4 / 3 * Math.tan(step * TAU / 4) / TAU;
            let path = 'M' + fmt(point(a));
            for (let i = 0; i < count; i++) {
                const t0 = a + i * step, t1 = i === count - 1 ? b : a + (i + 1) * step, p = point(t0), q = point(t1), d0 = tangent(t0), d1 = tangent(t1);
                path += 'C' + fmt(p.map((x, j) => x + k * d0[j])) + ' ' + fmt(q.map((x, j) => x - k * d1[j])) + ' ' + fmt(q);
            }
            return path;
        } };
}
function projectedLine(project, a, b) {
    const p = project(a), q = project(b), d = q.map((x, i) => x - p[i]);
    const point = (t) => p.map((x, i) => x + t * d[i]);
    return { point, tangent: () => d, clip: region => region.clipLine(p, q), path: (a, b) => 'M' + fmt(point(a)) + 'L' + fmt(point(b)) };
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
        const b = s.kind === 'sphere' ? a : projection(add$3(s.a, mul$2(s.u, s.length)));
        const r = s.r * scale, left = Math.min(a[0], b[0]) - r, top = Math.min(a[1], b[1]) - r;
        const right = Math.max(a[0], b[0]) + r, bottom = Math.max(a[1], b[1]) + r;
        // A full support rectangle selects analytic directional tones. buildDots
        // additionally clips against its EXACT projected single-primitive silhouette;
        // coordinate-pair bounds extraction there must not receive SVG arc operands.
        const support = `M${left} ${top}L${right} ${top}L${right} ${bottom}L${left} ${bottom}Z`;
        const result = buildDots([s], depthAt, projection, scale, illumination, o, regions, coverage, { compactStipple: true, paths: [support], light: lightDirection,
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
            axis = norm$1(axis);
            const e = norm$1(cross$2(axis, [1, 0, 0])), f = cross$2(axis, e);
            for (let j = 1; j < count; j++) {
                counts.hatchCurves++;
                const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h), limit = secondary ? .12 : (j % 2 === 0 ? .88 : .58);
                const center = mul$2(axis, h * radius), u = mul$2(e, r * radius), v = mul$2(f, r * radius);
                const geometry = projectedCircle(localProject, center, u, v);
                const front = trigSpans(-axis[2] * h, -r * e[2], -r * f[2], 1e-12);
                const tonal = trigSpans(h * dot$3(axis, lightDirection), r * dot$3(e, lightDirection), r * dot$3(f, lightDirection), threshold(limit));
                const spans = intersectSpans(front, tonal);
                curve(t => {
                    const a = t * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
                    const n = axis.map((v, k) => v * h + (e[k] * cos + f[k] * sin) * r);
                    return { p: mul$2(n, radius), n };
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
        const a = project(s.a), b = project(add$3(s.a, mul$2(s.u, s.length)));
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
        const e = norm$1(cross$2(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$2(s.u, e);
        function line(n, width, engrave = false) {
            const offset = mul$2(n, s.r), start = add$3(s.a, offset), end = add$3(start, mul$2(s.u, s.length));
            const geometry = projectedLine(project, start, end);
            const spans = !engrave || dot$3(n, lightDirection) < threshold(.65) ? [[0, 1]] : [];
            bondCurve(t => ({ p: add$3(start, mul$2(s.u, t * s.length)), n }), Math.max(60, Math.ceil(s.length * scale / .7)), width, (_n, _p, lit) => !engrave || lit < .65, engrave, false, () => [[0, 1]], { geometry, spans, illumination, ignoreLighting: !engrave });
        }
        if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
            const edge = norm$1([-s.u[1], s.u[0], 0]);
            line(edge, o.outlineWidth * 1.1);
            line(mul$2(edge, -1), o.outlineWidth * 1.1);
        }
        const count = Math.max(3, Math.round(density * .8 * s.r / .115));
        for (let j = 0; o.shadingMode === 'hatch' && o.hatchWidth > 0 && j < count; j++) {
            const a = j / count * 2 * Math.PI, n = add$3(mul$2(e, Math.cos(a)), mul$2(f, Math.sin(a)));
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
            if (Math.abs(Math.hypot(...sub$1(vertices[i], vertices[j])) - 2) < 1e-9)
                positions.push(mul$2(add$3(mul$2(vertices[i], 2), vertices[j]), factor / 3));
        }
    const bonds = [];
    for (let i = 0; i < positions.length; i++)
        for (let j = i + 1; j < positions.length; j++)
            if (Math.abs(Math.hypot(...sub$1(positions[i], positions[j])) - 1.42) < 1e-9)
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
            curve(t => { const a = t * Math.PI * 2, n = [Math.cos(a), Math.sin(a), 0]; return { p: add$3(s.c, mul$2(n, s.r)), n }; }, Math.ceil(2 * Math.PI * s.r * scale / 0.65), o.outlineWidth * 1.4);
        function hatch(axis, count, secondary) {
            axis = norm$1(axis);
            const e = norm$1(cross$2(axis, [1, 0, 0])), f = cross$2(axis, e), light = lightFor(s);
            const face = atlas?.visible(s);
            if (atlas && !face)
                return;
            const screen = (a) => [a[0], -a[1], a[2]], c = project(s.c), radius = s.r * scale;
            const visibleFamily = face?.sphereFamily?.(c, radius, screen(axis), screen(e), screen(f));
            const shadowFamily = o.lightType === 'directional' && atlas && mayShadow(s) ? atlas.shadow(s).sphereFamily?.(c, radius, screen(axis), screen(e), screen(f)) : undefined;
            for (let j = 1; j < count; j++) {
                const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h), limit = secondary ? .12 : (j % 2 === 0 ? .88 : .58);
                const center = add$3(s.c, mul$2(axis, h * s.r)), u = mul$2(e, r * s.r), v = mul$2(f, r * s.r);
                const geometry = projectedCircle(project, center, u, v);
                const front = trigSpans(-axis[2] * h, -r * e[2], -r * f[2], 1e-12);
                const tonal = tonalSpans(s, geometry, t => trigSpans(h * dot$3(axis, lightDirection), r * dot$3(e, lightDirection), r * dot$3(f, lightDirection), t), limit, shadowFamily?.(h));
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
        const e = norm$1(cross$2(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$2(s.u, e);
        const line = (n, w, engrave = false) => {
            const offset = mul$2(n, s.r), a = add$3(s.a, offset), b = add$3(a, mul$2(s.u, s.length));
            const geometry = projectedLine(project, a, b), face = engrave ? atlas?.visible(s) : null;
            if (engrave && atlas && !face)
                return;
            const tonal = engrave ? tonalSpans(s, geometry, t => dot$3(n, lightDirection) < t ? [[0, 1]] : [], .65) : { spans: undefined, breaks: undefined };
            curve(t => { const d = t * s.length; return { p: [s.a[0] + s.u[0] * d + offset[0], s.a[1] + s.u[1] * d + offset[1], s.a[2] + s.u[2] * d + offset[2]], n }; }, Math.max(60, Math.ceil(s.length * scale / .7)), w, (normal, p, lit) => !engrave || lit < .65, engrave, false, engrave ? () => face ? geometry.clip(face) : boundaries?.clipLine ? boundaries.clipLine(s, a, b) : null : null, { geometry, spans: tonal.spans, breaks: tonal.breaks, illumination: lightFor(s), ignoreLighting: !engrave });
        };
        if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
            const edge = norm$1([-s.u[1], s.u[0], 0]);
            line(edge, o.outlineWidth * 1.1);
            line(mul$2(edge, -1), o.outlineWidth * 1.1);
        }
        const count = Math.max(3, Math.round(hatchDensity * .8 * s.r / .115));
        for (let j = 0; o.shadingMode === 'hatch' && o.hatchWidth > 0 && j < count; j++) {
            const a = j / count * 2 * Math.PI, n = add$3(mul$2(e, Math.cos(a)), mul$2(f, Math.sin(a)));
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
            const p = add$3(s.c, [0, 0, s.r]);
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

export { covalentRadii, covalentRadiusSource, depthAt, elementColor, elementPalette, engravingWidth, examples, parseXYZ, render };
