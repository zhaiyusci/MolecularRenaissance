/* Generated DOM-free ES module. Source: src/renderer.ts. */
// Preserve arithmetic order: geometry tolerances are covered by numerical tests.
const add$2 = (a, b) => a.map((v, i) => v + b[i]);
const sub$1 = (a, b) => a.map((v, i) => v - b[i]);
const mul$1 = (a, s) => a.map(v => v * s);
const dot$2 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross$1 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm$1 = (a) => mul$1(a, 1 / Math.hypot(...a));
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
    lightType: 'directional', lightDistance: 3, density: 24, lineWidth: .8, outlineWidth: .8, hatchWidth: .8,
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
    const center = mul$1(molecule.atoms.reduce((s, a) => add$2(s, a.position), [0, 0, 0]), 1 / molecule.atoms.length);
    const spheres = molecule.atoms.map(a => ({ kind: 'sphere', c: rotate(sub$1(a.position, center), o.yaw, o.pitch), r: atomRadius(a) * o.atomRadiusScale, element: a.element }));
    const cylinders = molecule.bonds.map(b => {
        if (!Array.isArray(b) || b.length !== 2 || !b.every(i => Number.isInteger(i) && spheres[i]))
            throw new Error('Invalid bond');
        const a = spheres[b[0]].c, end = spheres[b[1]].c, v = sub$1(end, a), length = Math.hypot(...v);
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
    const illumination = (n, p) => dot$2(n, o.lightType === 'point' ? norm$1(sub$1(lightPosition, p)) : light);
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
        // Only row index + bbox survives construction; graph traversal is not
        // repeated by query, and loops/holes use the same evenodd rule.
        // The build-only fields are discarded after the index has been populated.
        delete o.starts;
        delete o.ins;
        delete o.directed;
        delete o.edges;
        active.push(o);
    }
    if (!active.length)
        return { query: function () { return null; } };
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
    return { query: function (x, y, maxRadius) {
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

const TAU = 2 * Math.PI, dot$1 = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const add$1 = (a, b) => a.map((x, i) => x + b[i]), mul = (a, k) => a.map(x => x * k), sub = (a, b) => add$1(a, mul(b, -1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a)), dist = (a, b) => Math.hypot(...sub(a, b));
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0], fmt = (p) => p.map(x => Number(x.toFixed(4))).join(' ');
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
const parameter = (c, p) => c.line ? dot$1(sub(p, c.A), c.D) / dot$1(c.D, c.D) : ((Math.atan2(...local(c, p).reverse()) % TAU) + TAU) % TAU;
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
    return Math.max(Math.abs(dot$1(U, U) - 1), Math.abs(dot$1(V, V) - 1), Math.abs(dot$1(U, V))) < 1e-11;
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
        const P = local(b, a.A), Q = sub(local(b, add$1(a.A, a.D)), P);
        for (const t of roots([dot$1(P, P) - 1, 2 * dot$1(P, Q), dot$1(Q, Q)], 0, 1) || [])
            hit(t);
    }
    else {
        const C = local(b, a.C), U = sub(local(b, add$1(a.C, a.U)), C), V = sub(local(b, add$1(a.C, a.V)), C);
        // tan(theta/2) on four bounded charts avoids roots at infinity.
        for (let quadrant = 0; quadrant < 4; quadrant++) {
            const angle = quadrant * Math.PI / 2, cos = Math.cos(angle), sin = Math.sin(angle);
            const u = add$1(mul(U, cos), mul(V, sin)), v = add$1(mul(U, -sin), mul(V, cos));
            const p = add$1(C, u), q = mul(v, 2), r = sub(C, u);
            const poly = [dot$1(p, p) - 1, 2 * dot$1(p, q), dot$1(q, q) + 2 * dot$1(p, r) - 2, 2 * dot$1(q, r), dot$1(r, r) - 1];
            const rr = roots(poly, -Math.tan(Math.PI / 8), Math.tan(Math.PI / 8));
            if (rr === null || Math.max(...poly.map(Math.abs)) < 1e-10)
                throw new Error('coincident ellipses');
            for (const t of rr)
                hit((angle + 2 * Math.atan(t) + TAU) % TAU);
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
            const axis = mul(sub(b.c, a.c), 1 / d), h = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
            const radius = Math.sqrt(a.r * a.r - h * h);
            if (!(radius > 1e-8))
                return null;
            const e = norm(cross(axis, Math.abs(axis[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross(axis, e);
            sphereSeams.push({ center: add$1(a.c, mul(axis, h)), u: mul(e, radius), v: mul(f, radius) });
        }
    const ends = [], covered = new Set();
    for (const c of cylinders) {
        if (Math.abs(dot$1(c.u, c.u) - 1) > 1e-10 || !(c.length > 0))
            return null;
        const b = add$1(c.a, mul(c.u, c.length));
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
            const t = Math.max(0, Math.min(c.length, dot$1(sub(s.c, c.a), c.u)));
            if (dist(s.c, add$1(c.a, mul(c.u, t))) <= s.r + c.r + 1e-8)
                return null;
        }
    }
    const origin = project([0, 0, 0]), curves = [];
    const vector = (v) => [v[0] * scale, -v[1] * scale];
    function circle(c, u, v, source = null) {
        const C = project(c), U = vector(u), V = vector(v), radius = Math.max(Math.hypot(...u), Math.hypot(...v)) * scale;
        const det = cross2(U, V);
        if (Math.abs(det) < 1e-10) {
            const axis = norm(Math.hypot(...U) > Math.hypot(...V) ? U : V), half = Math.hypot(dot$1(U, axis), dot$1(V, axis));
            line2(sub(C, mul(axis, half)), add$1(C, mul(axis, half)));
            return;
        }
        if (Math.abs(det) / radius < .0001)
            throw new Error('ill-conditioned ellipse');
        curves.push({ C, U, V, det, source, world: t => add$1(c, add$1(mul(u, Math.cos(t)), mul(v, Math.sin(t)))),
            at: t => add$1(C, add$1(mul(U, Math.cos(t)), mul(V, Math.sin(t)))),
            tangent: t => add$1(mul(U, -Math.sin(t)), mul(V, Math.cos(t))),
            cuts: [0, Math.PI / 2, Math.PI, Math.PI * 1.5, TAU], end: TAU, radius,
            box: [C[0] - Math.hypot(U[0], V[0]), C[1] - Math.hypot(U[1], V[1]), C[0] + Math.hypot(U[0], V[0]), C[1] + Math.hypot(U[1], V[1])] });
    }
    function line2(A, B) {
        const D = sub(B, A);
        if (Math.hypot(...D) < 1e-8)
            return;
        curves.push({ line: true, A, D, at: t => add$1(A, mul(D, t)), tangent: () => D, cuts: [0, 1], end: 1,
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
            const u = c.u, e = norm(cross(u, Math.abs(u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross(u, e);
            for (let end = 0; end < 2; end++) {
                const s = ends[i][end], h = Math.sqrt(s.r * s.r - c.r * c.r);
                const before = curves.length, offset = end ? -h : h;
                circle(add$1(s.c, mul(u, offset)), mul(e, c.r), mul(f, c.r));
                if (curves.length > before)
                    curves.at(-1).contact = { sphere: s, cylinder: c, axis: u, offset };
            }
            if (Math.hypot(u[0], u[1]) > 1e-10) {
                const edge = mul(norm([-u[1], u[0], 0]), c.r);
                for (const sign of [-1, 1]) {
                    const a = add$1(c.a, mul(edge, sign));
                    line2(project(a), project(add$1(a, mul(u, c.length))));
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
                    const q = sub(p, other.A), u = Math.max(0, Math.min(1, dot$1(q, other.D) / dot$1(other.D, other.D)));
                    clearance = dist(p, other.at(u));
                }
                else {
                    const q = sub(p, other.C), x = cross2(q, other.V) / other.det, y = cross2(other.U, q) / other.det;
                    clearance = Math.abs(Math.hypot(x, y) - 1) * Math.abs(other.det) / other.radius;
                }
                epsilon = Math.min(epsilon, clearance * .2);
            }
            const n = mul([-t[1], t[0]], epsilon / length), plus = add$1(p, n), minus = sub(p, n);
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
            return 'L' + fmt(nodes[reverse ? s.start : s.end]);
        const maxAngle = preview ? Math.min(.2, Math.sqrt(.024 / c.radius)) :
            Math.min(Math.PI / 4, Math.PI / 4 * Math.pow(.001 / (c.radius * 4.3e-6), 1 / 6));
        const count = Math.max(1, Math.ceil(Math.abs(b - a) / maxAngle));
        let text = '';
        for (let i = 1; i <= count; i++) {
            const t0 = a + (b - a) * (i - 1) / count, t1 = a + (b - a) * i / count;
            const end = i === count ? nodes[reverse ? s.start : s.end] : c.at(t1);
            if (preview)
                text += 'L' + fmt(end);
            else {
                const k = 4 / 3 * Math.tan((t1 - t0) / 4);
                text += 'C' + fmt(add$1(c.at(t0), mul(c.tangent(t0), k))) + ' ' + fmt(sub(c.at(t1), mul(c.tangent(t1), k))) + ' ' + fmt(end);
            }
        }
        return text;
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
                continue;
            const used = new Set();
            let path = '';
            for (const first of edges) {
                if (used.has(first))
                    continue;
                path += 'M' + fmt(nodes[first.start]);
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
            svg += '<path fill="' + color + '" fill-rule="evenodd" d="' + path + '"/>';
        }
        return svg + '</g>';
    }
    function outline(s, preview, width) {
        if (!width)
            return '';
        return (outlines.get(s) || []).map(segment => '<path stroke-width="' + width.toFixed(3) + '" d="M' + fmt(nodes[segment.start]) + commands(segment, preview) + '"/>').join('');
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
            const cuts = [0, TAU];
            // The source limb is cheaper and more stable in 3-D than the double
            // root of the two projected ellipses at a tangent.
            if (amplitude > 0 && Math.abs(z) <= amplitude) {
                const angle = Math.atan2(v[2], u[2]), half = Math.acos(Math.max(-1, Math.min(1, -z / amplitude)));
                for (const t of [angle - half, angle + half])
                    cuts.push((t % TAU + TAU) % TAU);
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
                            const k = dot$1(sub(center, source.c), contact.axis) - contact.offset;
                            const A = dot$1(u, contact.axis), B = dot$1(v, contact.axis), r = Math.hypot(A, B);
                            if (r < 1e-14) {
                                if (Math.abs(k) < 1e-12)
                                    return null;
                                continue;
                            }
                            if (Math.abs(k) <= r) {
                                const phase = Math.atan2(B, A), half = Math.acos(Math.max(-1, Math.min(1, -k / r)));
                                for (const t of [phase - half, phase + half])
                                    cuts.push((t % TAU + TAU) % TAU);
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
            path.world = t => add$1(a, mul(direction, t));
            const cuts = [0, 1];
            for (const boundary of curves) {
                if (boundary.contacts.length && boundary.contacts.length === boundary.members.length && boundary.contacts.every(c => c.cylinder === source)) {
                    for (const contact of boundary.contacts) {
                        const denominator = dot$1(direction, contact.axis);
                        if (Math.abs(denominator) > 1e-14) {
                            const t = (contact.offset - dot$1(sub(a, contact.sphere.c), contact.axis)) / denominator;
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
                    const w = sub(a, other.a), wu = dot$1(w, other.u), du = dot$1(direction, other.u);
                    const A = dot$1(direction, direction) - du * du, B = 2 * (dot$1(w, direction) - wu * du), C = dot$1(w, w) - wu * wu - other.r * other.r;
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
                                const q = add$1(w, mul(direction, t));
                                if (dot$1(q, q) - end * end <= other.r * other.r + 1e-10)
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
    let cachedDotRegions;
    function dotRegions() {
        if (cachedDotRegions !== undefined)
            return cachedDotRegions;
        cachedDotRegions = null;
        // Fill may merge white rods, but dots need each actual visible surface.
        // Our arrangement omits rod/rod intersection seams. Certify that exposed
        // rod bodies cannot intersect before using it for dot ownership. Trim off
        // the portions proven wholly inside their endpoint balls; bound each
        // remaining body by a capsule and test segment distances conservatively.
        const exposed = cylinders.flatMap((c, i) => {
            if (covered.has(c))
                return [];
            const lo = Math.sqrt(ends[i][0].r ** 2 - c.r ** 2), hi = c.length - Math.sqrt(ends[i][1].r ** 2 - c.r ** 2);
            return [{ a: add$1(c.a, mul(c.u, lo)), b: add$1(c.a, mul(c.u, hi)), r: c.r }];
        });
        const pointSegment = (p, a, b) => { const d = sub(b, a), length2 = dot$1(d, d), t = length2 ? Math.max(0, Math.min(1, dot$1(sub(p, a), d) / length2)) : 0; return dist(p, add$1(a, mul(d, t))); };
        for (let i = 0; i < exposed.length; i++)
            for (let j = 0; j < i; j++) {
                const x = exposed[i], y = exposed[j], r = x.r + y.r + 1e-8;
                if ([0, 1, 2].some(k => Math.min(x.a[k], x.b[k]) - Math.max(y.a[k], y.b[k]) > r || Math.min(y.a[k], y.b[k]) - Math.max(x.a[k], x.b[k]) > r))
                    continue;
                const u = sub(x.b, x.a), v = sub(y.b, y.a), w = sub(x.a, y.a), a = dot$1(u, u), b = dot$1(u, v), c = dot$1(v, v), d = dot$1(u, w), e = dot$1(v, w), det = a * c - b * b;
                // Nearly parallel axes: do not turn cancellation into a false proof.
                if (det <= 1e-12 * a * c)
                    return null;
                let distance = Math.min(pointSegment(x.a, y.a, y.b), pointSegment(x.b, y.a, y.b), pointSegment(y.a, x.a, x.b), pointSegment(y.b, x.a, x.b));
                const s = (b * e - c * d) / det, t = (a * e - b * d) / det;
                if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
                    distance = Math.min(distance, dist(add$1(x.a, mul(u, s)), add$1(y.a, mul(v, t))));
                if (distance <= r)
                    return null;
            }
        const helper = getDotRegions();
        if (helper)
            cachedDotRegions = helper.create(scene, segments, nodes, project, scale);
        return cachedDotRegions;
    }
    return { wash, outline, clipCircle, clipLine, dotRegions, validate: colorFor => wash(colorFor, true, true) !== null, curveCount: curves.length, segmentCount: segments.length };
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
            lo = add(m, n, -span);
            hi = add(m, n, span);
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
            var previous = add(m, n, -len), previousLabel = owner(previous), best = Infinity, bracket = null;
            for (var scan = 1; scan <= 128; scan++) {
                var candidate = add(m, n, -len + 2 * len * scan / 128), candidateLabel = owner(candidate);
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
function add(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s]; }
function unit(a, b) { var d = distance(a, b); return d ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : [1, 0]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
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
                c00 += dot(a, a);
                c01 += dot(a, b);
                c11 += dot(b, b);
                x0 += dot(a, r);
                x1 += dot(b, r);
            }
            var det = c00 * c11 - c01 * c01;
            var alpha = det ? (x0 * c11 - x1 * c01) / det : 0;
            var beta = det ? (c00 * x1 - c01 * x0) / det : 0;
            if (alpha < length * 1e-6 || beta < length * 1e-6 || alpha > length || beta > length)
                alpha = beta = distance(p[lo], p[hi]) / 3;
            curve = [p[lo], add(p[lo], left, alpha), add(p[hi], right, beta), p[hi]];
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
                var r = [q[0] - p[lo + j][0], q[1] - p[lo + j][1]], denominator = dot(d, d) + dot(r, secondDerivative);
                var next = denominator ? t - dot(r, d) / denominator : t;
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
        if (dot(unit(p[a], p[i]), unit(p[i], p[b])) < 0.8 && i - cuts[cuts.length - 1] > 1)
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

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function hash(x, y, salt) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function candidate(i, j, g) { return [(i + .5 + .8 * (hash(i, j, 1) - .5)) * g, (j + .5 + .8 * (hash(i, j, 2) - .5)) * g]; }
function separated(i, j, p, g) {
    // Independent local thinning of a jittered lattice: stable across frames,
    // no random clumps or order-dependent placement. Not a strict blue-noise solver.
    const rank = hash(i, j, 3), limit = (.5 * g) ** 2;
    for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
            if (!di && !dj)
                continue;
            const q = candidate(i + di, j + dj, g), other = hash(i + di, j + dj, 3);
            if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < limit && (other < rank || (other === rank && (dj < 0 || (dj === 0 && di < 0)))))
                return false;
        }
    return true;
}
function buildDots(scene, depthAt, project, scale, illumination, options, colorForElement = null, regions = null) {
    if (colorForElement !== null && typeof colorForElement !== 'function')
        throw new Error('Invalid dot color callback');
    const o = { shadingMode: 'stipple', dotSpacing: 5, dotSize: 1, dotContrast: 1.2, ...options };
    if (!['stipple', 'halftone'].includes(o.shadingMode))
        throw new Error('Invalid dot mode');
    if (!Number.isFinite(o.dotSpacing) || o.dotSpacing < 2 || o.dotSpacing > 14 || !Number.isFinite(o.dotSize) || o.dotSize < 0 || o.dotSize > 1.5 || !Number.isFinite(o.dotContrast) || o.dotContrast < .5 || o.dotContrast > 2.5)
        throw new Error('Invalid dot settings');
    if (!(scale > 0) || !Number.isFinite(scale))
        throw new Error('Invalid scale');
    if (o.dotSize === 0 || scene.length === 0)
        return '';
    const origin = project([0, 0, 0]), g = o.dotSpacing;
    const shapes = scene.map((s, id) => {
        const a = project(s.kind === 'sphere' ? s.c : s.a);
        const b = s.kind === 'sphere' ? a : project(s.a.map((v, i) => v + s.u[i] * s.length));
        const r = s.r * scale;
        return { s, id, b: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r] };
    });
    const minX = Math.min(...shapes.map(s => s.b[0])), minY = Math.min(...shapes.map(s => s.b[1]));
    const maxX = Math.max(...shapes.map(s => s.b[2])), maxY = Math.max(...shapes.map(s => s.b[3]));
    function hit(x, y) {
        const wx = (x - origin[0]) / scale, wy = (origin[1] - y) / scale;
        if (regions) {
            // Visibility/occlusion is already solved. The one surface intersection
            // below only reconstructs this known owner's position for its normal.
            const region = regions.query(x, y, g * .48);
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
    const circles = [];
    function emit(x, y, i, j) {
        if (x < minX || y < minY || x > maxX || y > maxY)
            return;
        const h = hit(x, y);
        if (!h)
            return;
        const n = normal(h), lit = clamp(illumination(n, h.p), -1, 1);
        let radius;
        if (o.shadingMode === 'stipple') {
            // Form tone, not dust density: signed diffuse shading plus a modest
            // grazing-angle term. Strong light still leaves a clean highlight.
            const rim = (1 - clamp(n[2], 0, 1)) ** 2;
            const tone = Math.pow(clamp((.94 - lit) / 1.5 + .08 * rim, 0, 1), o.dotContrast);
            if (tone < .006)
                return;
            const probability = Math.min(1, 1.7 * Math.sqrt(tone));
            if (hash(i, j, 4) >= probability)
                return;
            // Approximate target ink AREA. Jitter/min-distance thinning retains
            // ~83% of sites. Both number and diameter contribute to the tone;
            // dark marks may touch, as in dense engraved stippling.
            const coverage = .58 * tone;
            radius = Math.min(g * Math.sqrt(coverage / (Math.PI * .83 * probability)) * o.dotSize, g * .48);
        }
        else {
            const shade = Math.pow(clamp((.92 - lit) / 1.92, 0, 1), o.dotContrast);
            if (shade < .008)
                return;
            radius = Math.min(g * .48 * o.dotSize * Math.sqrt(shade), g * .48);
        }
        if (radius < .12)
            return;
        // The regions branch of hit always supplies clearance.
        radius = regions ? Math.min(radius, h.clearance) : safeRadius(x, y, radius, h.id);
        // Keep the existing size/tonal calibration for interior dots. The legacy
        // branch needs this footprint margin; region clearance is already a
        // conservative geometric bound and receives the same extra contraction.
        radius = Math.floor(Math.max(0, radius * Math.cos(Math.PI / 16) - .003) * 1000) / 1000;
        if (radius < .12)
            return;
        let color = '';
        if (colorForElement) {
            const value = colorForElement(h.s.kind === 'sphere' ? h.s.element : null);
            if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
                throw new Error('Invalid dot ink color');
            color = ` fill="${value}"`;
        }
        circles.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${radius.toFixed(3)}"${color}/>`);
    }
    if (o.shadingMode === 'stipple') {
        const i0 = Math.floor(minX / g) - 1, i1 = Math.ceil(maxX / g) + 1, j0 = Math.floor(minY / g) - 1, j1 = Math.ceil(maxY / g) + 1;
        if ((i1 - i0 + 1) * (j1 - j0 + 1) > 1000000)
            throw new Error('Dot screen too large; increase spacing or reduce output size');
        for (let j = j0; j <= j1; j++)
            for (let i = i0; i <= i1; i++) {
                const p = candidate(i, j, g);
                if (separated(i, j, p, g))
                    emit(p[0], p[1], i, j);
            }
    }
    else {
        const c = Math.SQRT1_2;
        const corners = [[minX, minY], [minX, maxY], [maxX, minY], [maxX, maxY]];
        const us = corners.map(p => (p[0] + p[1]) * c / g), vs = corners.map(p => (-p[0] + p[1]) * c / g);
        const i0 = Math.floor(Math.min(...us)) - 1, i1 = Math.ceil(Math.max(...us)) + 1, j0 = Math.floor(Math.min(...vs)) - 1, j1 = Math.ceil(Math.max(...vs)) + 1;
        if ((i1 - i0 + 1) * (j1 - j0 + 1) > 1000000)
            throw new Error('Dot screen too large; increase spacing or reduce output size');
        for (let j = j0; j <= j1; j++)
            for (let i = i0; i <= i1; i++)
                emit(((i + .5) - (j + .5)) * g * c, ((i + .5) + (j + .5)) * g * c, i, j);
    }
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
            if (Math.abs(Math.hypot(...sub$1(vertices[i], vertices[j])) - 2) < 1e-9)
                positions.push(mul$1(add$2(mul$1(vertices[i], 2), vertices[j]), factor / 3));
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
            curve(t => { const a = t * Math.PI * 2, n = [Math.cos(a), Math.sin(a), 0]; return { p: add$2(s.c, mul$1(n, s.r)), n }; }, Math.ceil(2 * Math.PI * s.r * scale / 0.65), o.outlineWidth * 1.4);
        function hatch(axis, count, secondary) {
            axis = norm$1(axis);
            const e = norm$1(cross$1(axis, [1, 0, 0])), f = cross$1(axis, e);
            for (let j = 1; j < count; j++) {
                const h = -1 + 2 * j / count, r = Math.sqrt(1 - h * h);
                curve(t => {
                    const a = t * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
                    const n = [axis[0] * h + (e[0] * cos + f[0] * sin) * r, axis[1] * h + (e[1] * cos + f[1] * sin) * r, axis[2] * h + (e[2] * cos + f[2] * sin) * r];
                    return { p: [s.c[0] + n[0] * s.r, s.c[1] + n[1] * s.r, s.c[2] + n[2] * s.r], n };
                }, Math.max(120, Math.ceil(2 * Math.PI * s.r * scale * r / .7)), o.hatchWidth * (secondary ? .63 : .8), (n, p, lit) => n[2] >= -1e-12 && lit < (secondary ? .12 : (j % 2 === 0 ? .88 : .58)), true, true, s.element, boundaries?.clipCircle ? () => boundaries.clipCircle(s, add$2(s.c, mul$1(axis, h * s.r)), mul$1(e, r * s.r), mul$1(f, r * s.r)) : null);
            }
        }
        hatch([.12, 1, .40], Math.max(2, Math.round(hatchDensity * s.r / .48)), false);
        if (o.crossHatch)
            hatch([1, .22, -0.32], Math.max(2, Math.round(hatchDensity * .8 * s.r / .48)), true);
    }
    for (const s of cylinders) {
        const e = norm$1(cross$1(s.u, Math.abs(s.u[2]) < .95 ? [0, 0, 1] : [0, 1, 0])), f = cross$1(s.u, e);
        const line = (n, w, engrave = false) => {
            const offset = mul$1(n, s.r), a = add$2(s.a, offset), b = add$2(a, mul$1(s.u, s.length));
            curve(t => { const d = t * s.length; return { p: [s.a[0] + s.u[0] * d + offset[0], s.a[1] + s.u[1] * d + offset[1], s.a[2] + s.u[2] * d + offset[2]], n }; }, Math.max(60, Math.ceil(s.length * scale / .7)), w, (normal, p, lit) => !engrave || lit < .65, engrave, false, null, engrave && boundaries?.clipLine ? () => boundaries.clipLine(s, a, b) : null);
        };
        if (Math.hypot(s.u[0], s.u[1]) > 1e-8) {
            const edge = norm$1([-s.u[1], s.u[0], 0]);
            line(edge, o.outlineWidth * 1.1);
            line(mul$1(edge, -1), o.outlineWidth * 1.1);
        }
        const count = Math.max(3, Math.round(hatchDensity * .8 * s.r / .115));
        for (let j = 0; j < count; j++) {
            const a = j / count * 2 * Math.PI, n = add$2(mul$1(e, Math.cos(a)), mul$1(f, Math.sin(a)));
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
            const p = add$2(s.c, [0, 0, s.r]);
            if (!visible(p))
                continue;
            const [x, y] = project(p);
            labels += `<text data-role="element-label" x="${x.toFixed(2)}" y="${(y + o.labelSize * .3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${escapeXml(o.labelFont)}" font-style="${o.labelItalic ? 'italic' : 'normal'}" font-weight="${o.labelBold ? '700' : '400'}" stroke="${o.labelStrokeWidth === 0 ? 'none' : (o.labelMatchFill ? fillFor(s.element) : o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${escapeXml(s.element)}</text>`;
        }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title"><title id="title">${escapeXml(molecule.name || 'Molecular engraving')}</title><rect width="100%" height="100%" fill="white"/>${wash}${dots}${texture}<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g><g font-family="Georgia, 'Times New Roman', serif">${labels}</g></svg>`;
}

export { covalentRadii, covalentRadiusSource, depthAt, elementColor, elementInkColor, elementInkPalette, elementPalette, engravingWidth, examples, render };
