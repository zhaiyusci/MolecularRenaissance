/* Generated from src/renderer.ts by npm run build. Edit TypeScript, not this file. */
var MolEngraver = (function (exports) {
    'use strict';

    // Preserve arithmetic order: geometry tolerances are covered by numerical tests.
    const add = (a, b) => a.map((v, i) => v + b[i]);
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const mul = (a, s) => a.map(v => v * s);
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => mul(a, 1 / Math.hypot(...a));
    function rotate(p, yaw, pitch) {
        const x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
        return [x, p[1] * Math.cos(pitch) - z * Math.sin(pitch), p[1] * Math.sin(pitch) + z * Math.cos(pitch)];
    }
    function escapeXml(s) {
        const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
        return String(s).replace(/[&<>"']/g, c => escapes[c]);
    }

    const defaults = {
        width: 900, height: 700, scale: 60, atomRadiusScale: 1, yaw: .25, pitch: -0.16, lightAzimuth: -29 * Math.PI / 180, lightElevation: 32 * Math.PI / 180,
        lightType: 'directional', lightDistance: 3, lightAttenuation: 0, castShadows: false, shadowStrength: .8, density: 24, lineWidth: .8, outlineWidth: .8, hatchWidth: .8,
        variableWidth: true, optimizePaths: true, quality: 'export', shadingMode: 'hatch', shadingContrast: 1.2,
        dotSpacing: 5, dotSize: 1, dotContrast: 1.2, crossHatch: true, colorWash: false, colorMode: 'wash', washStrength: .65,
        colorSaturation: 1, labelMatchFill: false, labels: false, labelSize: 17, labelStrokeWidth: 4, labelStrokeColor: '#ffffff',
        labelColor: '#161616', labelFont: "Georgia, 'Times New Roman', serif", labelBold: false, labelItalic: true
    };
    function normalizeOptions(options) {
        const o = { ...defaults, ...options };
        if (!['preview', 'export'].includes(o.quality))
            throw new Error('Invalid quality');
        if (o.quality === 'preview')
            o.optimizePaths = false;
        o.outlineWidth = options.outlineWidth === undefined ? o.lineWidth : options.outlineWidth;
        o.hatchWidth = options.hatchWidth === undefined ? o.lineWidth : options.hatchWidth;
        for (const [key, min, max] of [['shadingDensity', .4, 2.5], ['shadingSize', 0, 1.5], ['shadingContrast', .5, 2.5]]) {
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
        if (!['wash', 'ink'].includes(o.colorMode))
            throw new Error('Invalid colorMode');
        if (!['hatch', 'stipple', 'halftone'].includes(o.shadingMode))
            throw new Error('Invalid shadingMode');
        if (o.dotSpacing < 2 || o.dotSpacing > 14 || o.dotSize < 0 || o.dotSize > 1.5 || o.dotContrast < .5 || o.dotContrast > 2.5)
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
        o.density = Math.round(Math.max(8, Math.min(60, o.density)));
        return o;
    }

    /** Empirical covalent radii in angstrom (1 Å = 100 pm), not van der Waals radii.
     * Cordero et al., Dalton Trans. (2008), 2832–2838, DOI:10.1039/B801115J.
     * Values cross-checked against ASE and python-periodictable's cited tables.
     * Carbon uses the tabulated sp3 reference; no hybridization is inferred.
     */
    const covalentRadii = Object.freeze({ H: .31, C: .76, N: .71, O: .66, P: 1.07, S: 1.05 });
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
        const center = mul(molecule.atoms.reduce((s, a) => add(s, a.position), [0, 0, 0]), 1 / molecule.atoms.length);
        const spheres = molecule.atoms.map(a => ({ kind: 'sphere', c: rotate(sub(a.position, center), o.yaw, o.pitch), r: atomRadius(a) * o.atomRadiusScale, element: a.element }));
        const cylinders = molecule.bonds.map(b => {
            if (!Array.isArray(b) || b.length !== 2 || !b.every(i => Number.isInteger(i) && spheres[i]))
                throw new Error('Invalid bond');
            const a = spheres[b[0]].c, end = spheres[b[1]].c, v = sub(end, a), length = Math.hypot(...v);
            if (length < 1e-8)
                throw new Error('Zero length bond');
            return { kind: 'cylinder', a, u: mul(v, 1 / length), length, r: .115 };
        });
        const scene = [...spheres, ...cylinders];
        const lo = [0, 1].map(i => Math.min(...spheres.map(s => s.c[i] - s.r))), hi = [0, 1].map(i => Math.max(...spheres.map(s => s.c[i] + s.r)));
        // Translation may center the view, but scale never depends on its bounds.
        const scale = o.scale;
        const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
        const project = p => [(p[0] - cx) * scale + o.width / 2, o.height / 2 - 12 - (p[1] - cy) * scale];
        const light = [Math.sin(o.lightAzimuth) * Math.cos(o.lightElevation), Math.sin(o.lightElevation), Math.cos(o.lightAzimuth) * Math.cos(o.lightElevation)];
        const sceneRadius = Math.max(...spheres.map(s => Math.hypot(...s.c) + s.r));
        const lightPosition = mul(light, o.lightDistance * sceneRadius);
        const shadowBias = Math.max(1e-9, Math.min(sceneRadius * 1e-6, ...scene.map(s => s.r * 1e-4)));
        const traceShadows = o.castShadows && o.shadowStrength > 0 && o.shadingSize !== 0;
        const illumination = (n, p) => {
            const point = o.lightType === 'point', delta = point ? sub(lightPosition, p) : light;
            const direction = point ? norm(delta) : light;
            const distance = point ? Math.hypot(...delta) : Infinity;
            const facing = dot(n, direction);
            let lit = facing;
            if (point && o.lightAttenuation > 0) {
                // Soft inverse-square falloff in model units, independent of screen zoom.
                const relativeDistance = distance / sceneRadius;
                const attenuation = 1 / (1 + o.lightAttenuation * relativeDistance * relativeDistance);
                lit = (Math.max(-1, Math.min(1, lit)) + 1) * attenuation - 1;
            }
            if (traceShadows && facing > 0 && shadowBlocked(scene, p, n, direction, distance, shadowBias)) {
                // Signed engraving brightness maps to [0,1] before shadow attenuation.
                // At strength .8, keep 20% of the local brightness instead of solid black.
                lit = (Math.max(-1, Math.min(1, lit)) + 1) * (1 - o.shadowStrength) - 1;
            }
            return lit;
        };
        return { spheres, cylinders, scene, scale, project, illumination };
    }

    const elementPalette = Object.freeze({ C: '#ded8cf', H: '#ffffff', O: '#eab5ac', N: '#b8ccdf', S: '#ead99e', P: '#ebc39f' });
    const elementInkPalette = Object.freeze({ C: '#79451d', H: '#555555', O: '#972b25', N: '#245889', S: '#886219', P: '#a24b21' });
    function elementColor(element, strength = .65, saturation = 1) {
        return mixColor(element != null && Object.hasOwn(elementPalette, element) ? elementPalette[element] : '#ded8cf', strength, saturation);
    }
    function elementInkColor(element, strength = .65, saturation = 1) {
        return mixColor(element != null && Object.hasOwn(elementInkPalette, element) ? elementInkPalette[element] : '#555555', strength, saturation);
    }
    function mixColor(hex, strength, saturation) {
        const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(...rgb), min = Math.min(...rgb), lightness = (max + min) / 2, chroma = max - min;
        const capacity = 1 - Math.abs(2 * lightness - 1);
        const factor = chroma > 0 ? Math.min(capacity, chroma * saturation) / chroma : 1;
        return '#' + rgb.map(v => Math.round(255 * (1 + ((lightness + (v - lightness) * factor) - 1) * strength)).toString(16).padStart(2, '0')).join('');
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

    function engravingWidth(base, illumination) {
        const darkness = (1 - Math.max(-1, Math.min(1, illumination))) / 2;
        return base * (.4 + 1.15 * darkness);
    }
    /** Sample lighting/width only within known visible spans; emit strokes or ribbons. */
    function createCurveRenderer(context) {
        const { options: o, project, illumination, visible, inkFor, paths, inkPaths, coloredTexture } = context;
        const fitter = o.optimizePaths ? getWash() : null;
        if (o.optimizePaths && (!fitter || typeof fitter.fitContour !== 'function'))
            throw new Error('Load updated wash.js before renderer.js');
        const coord = (p) => p.map(v => String(Number(v.toFixed(3)))).join(' ');
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
        return function curve(fn, steps, width, accept = () => true, engrave = false, closed = false, element = null, clip = null) {
            const target = coloredTexture && engrave ? inkPaths : paths;
            const ink = coloredTexture && engrave ? inkFor(element) : '#161616';
            if (width === 0 || (engrave && o.shadingMode !== 'hatch'))
                return;
            let run = [];
            const runs = [];
            const flush = () => { if (run.length > 1)
                runs.push(run); run = []; };
            function sample(t, index, knownVisible) {
                const { p, n } = fn(t);
                let lit = illumination(n, p);
                if (engrave && o.shadingContrast !== 1.2) {
                    const darkness = (1 - Math.max(-1, Math.min(1, lit))) / 2;
                    lit = 1 - 2 * Math.pow(darkness, o.shadingContrast / 1.2);
                }
                if (accept(n, p, lit) && (knownVisible || visible(p)))
                    run.push({ xy: project(p), lit, index });
                else
                    flush();
            }
            const spans = clip ? clip() : null;
            if (spans !== null) {
                for (const [a, b] of spans) {
                    sample(a, a * steps, true);
                    const first = Math.floor(a * steps) + 1, last = Math.ceil(b * steps) - 1;
                    if (first > last)
                        sample((a + b) / 2, (a + b) * steps / 2, true);
                    else
                        for (let i = first; i <= last; i++)
                            sample(i / steps, i, true);
                    sample(b, b * steps, true);
                    flush();
                }
            }
            else {
                for (let i = 0; i <= steps; i++)
                    sample(i / steps, i, false);
                flush();
            }
            // Join periodic seams without adding a tapered tip.
            if (closed && runs.length > 1 && runs[0][0].index === 0 && runs.at(-1).at(-1).index === steps) {
                const last = runs.pop();
                runs[0] = last.concat(runs[0].slice(1));
            }
            for (const points of runs) {
                if (!engrave || !o.variableWidth) {
                    const d = o.optimizePaths ? compactPath(points.map(q => q.xy)) : points.map(({ xy: p }, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('');
                    target.push(`<path${coloredTexture && engrave ? ' stroke="' + ink + '"' : ''} stroke-width="${width.toFixed(3)}" d="${d}"/>`);
                    continue;
                }
                const clean = points.filter((q, i) => i === 0 || Math.hypot(q.xy[0] - points[i - 1].xy[0], q.xy[1] - points[i - 1].xy[1]) > 1e-6);
                if (clean.length < 2)
                    continue;
                const loop = closed && clean[0].index === 0 && clean.at(-1).index === steps;
                const distances = [0];
                for (let i = 1; i < clean.length; i++)
                    distances.push(distances[i - 1] + Math.hypot(clean[i].xy[0] - clean[i - 1].xy[0], clean[i].xy[1] - clean[i - 1].xy[1]));
                const total = distances.at(-1), tipLength = Math.min(5, total * .25), left = [], right = [];
                for (let i = 0; i < clean.length; i++) {
                    const p = clean[i].xy;
                    const prev = clean[i === 0 ? (loop ? clean.length - 2 : 0) : i - 1].xy;
                    const next = clean[i === clean.length - 1 ? (loop ? 1 : i) : i + 1].xy;
                    const dx = next[0] - prev[0], dy = next[1] - prev[1], length = Math.hypot(dx, dy) || 1;
                    const t = loop ? 1 : Math.min(1, distances[i] / tipLength, (total - distances[i]) / tipLength);
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
                    d = outline.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join('') + 'Z';
                }
                target.push(`<path fill="${ink}" stroke="none" d="${d}"/>`);
            }
        };
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
                    positions.push(mul(add(mul(vertices[i], 2), vertices[j]), factor / 3));
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

    function render(molecule, options = {}) {
        const o = normalizeOptions(options);
        const { spheres, cylinders, scene, scale, project, illumination } = prepareScene(molecule, o);
        const paths = [], inkPaths = [];
        const coloredTexture = o.colorWash && o.colorMode === 'ink';
        const inkFor = element => elementInkColor(element, o.washStrength, o.colorSaturation);
        // Preserve the tolerant legacy oracle for outlines/fallbacks and labels.
        const visible = (p) => !scene.some(s => depthAt(s, p[0], p[1]) > p[2] + .00015);
        const curve = createCurveRenderer({ options: o, project, illumination, visible, inkFor, paths, inkPaths, coloredTexture });
        const fillFor = element => o.colorWash && !coloredTexture ? elementColor(element, o.washStrength, o.colorSaturation) : '#ffffff';
        const analytic = getBoundaries();
        const built = analytic ? analytic.build(scene, depthAt, project, scale) : null;
        // Validate independently of the selected palette; styles must not change outlines.
        const boundaries = built && built.validate(elementColor) ? built : null;
        let wash = '';
        if (o.colorWash && !coloredTexture && o.washStrength > 0) {
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
            if (boundaries)
                paths.push(boundaries.outline(s, o.quality === 'preview' || !o.optimizePaths, o.outlineWidth * 1.4));
            else
                curve(t => { const a = t * Math.PI * 2, n = [Math.cos(a), Math.sin(a), 0]; return { p: add(s.c, mul(n, s.r)), n }; }, Math.ceil(2 * Math.PI * s.r * scale / 0.65), o.outlineWidth * 1.4);
            function hatch(axis, count, secondary) {
                axis = norm(axis);
                const e = norm(cross(axis, [1, 0, 0])), f = cross(axis, e);
                for (let j = 1; j < count; j++) {
                    const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h);
                    curve(t => {
                        const a = t * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
                        const n = [axis[0] * h + (e[0] * cos + f[0] * sin) * r, axis[1] * h + (e[1] * cos + f[1] * sin) * r, axis[2] * h + (e[2] * cos + f[2] * sin) * r];
                        return { p: [s.c[0] + n[0] * s.r, s.c[1] + n[1] * s.r, s.c[2] + n[2] * s.r], n };
                    }, Math.max(120, Math.ceil(2 * Math.PI * s.r * scale * r / .7)), o.hatchWidth * (secondary ? .63 : .8), (n, p, lit) => n[2] >= -1e-12 && lit < (secondary ? .12 : (j % 2 === 0 ? .88 : .58)), true, true, s.element, boundaries?.clipCircle ? () => boundaries.clipCircle(s, add(s.c, mul(axis, h * s.r)), mul(e, r * s.r), mul(f, r * s.r)) : null);
                }
            }
            hatch([.12, 1, .40], Math.max(2, Math.round(hatchDensity * s.r / .48)), false);
            if (o.crossHatch)
                hatch([1, .22, -0.32], Math.max(2, Math.round(hatchDensity * .8 * s.r / .48)), true);
        }
        for (const s of cylinders) {
            const e = norm(cross(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross(s.u, e);
            const line = (n, w, engrave = false) => {
                const offset = mul(n, s.r), a = add(s.a, offset), b = add(a, mul(s.u, s.length));
                curve(t => { const d = t * s.length; return { p: [s.a[0] + s.u[0] * d + offset[0], s.a[1] + s.u[1] * d + offset[1], s.a[2] + s.u[2] * d + offset[2]], n }; }, Math.max(60, Math.ceil(s.length * scale / .7)), w, (normal, p, lit) => !engrave || lit < .65, engrave, false, null, engrave && boundaries?.clipLine ? () => boundaries.clipLine(s, a, b) : null);
            };
            if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
                const edge = norm([-s.u[1], s.u[0], 0]);
                line(edge, o.outlineWidth * 1.1);
                line(mul(edge, -1), o.outlineWidth * 1.1);
            }
            const count = Math.max(3, Math.round(hatchDensity * .8 * s.r / .115));
            for (let j = 0; j < count; j++) {
                const a = j / count * 2 * Math.PI, n = add(mul(e, Math.cos(a)), mul(f, Math.sin(a)));
                if (n[2] > 0)
                    line(n, o.hatchWidth * .68, true);
            }
        }
        let dots = '';
        if (o.shadingMode !== 'hatch' && o.dotSize > 0) {
            const dotter = getDots();
            if (!dotter)
                throw new Error('Load dots.js before renderer.js');
            const regions = boundaries?.dotRegions ? boundaries.dotRegions() : null;
            dots = dotter.buildDots(scene, depthAt, project, scale, illumination, o, coloredTexture ? inkFor : null, regions);
        }
        let texture = '';
        if (coloredTexture) {
            texture = `<g data-role="color-texture" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${dots}${inkPaths.join('')}</g>`;
            dots = '';
        }
        let labels = '';
        if (o.labels)
            for (const s of spheres) {
                const p = add(s.c, [0, 0, s.r]);
                if (!visible(p))
                    continue;
                const [x, y] = project(p);
                labels += `<text data-role="element-label" x="${x.toFixed(2)}" y="${(y + o.labelSize * .3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${escapeXml(o.labelFont)}" font-style="${o.labelItalic ? 'italic' : 'normal'}" font-weight="${o.labelBold ? '700' : '400'}" stroke="${o.labelStrokeWidth === 0 ? 'none' : (o.labelMatchFill ? fillFor(s.element) : o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${escapeXml(s.element)}</text>`;
            }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title"><title id="title">${escapeXml(molecule.name || 'Molecular engraving')}</title><rect width="100%" height="100%" fill="white"/>${wash}${dots}${texture}<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g><g font-family="Georgia, 'Times New Roman', serif">${labels}</g></svg>`;
    }

    exports.covalentRadii = covalentRadii;
    exports.covalentRadiusSource = covalentRadiusSource;
    exports.depthAt = depthAt;
    exports.elementColor = elementColor;
    exports.elementInkColor = elementInkColor;
    exports.elementInkPalette = elementInkPalette;
    exports.elementPalette = elementPalette;
    exports.engravingWidth = engravingWidth;
    exports.examples = examples;
    exports.render = render;

    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    return exports;

})({});
if (typeof module !== 'undefined' && module.exports) module.exports = MolEngraver;
