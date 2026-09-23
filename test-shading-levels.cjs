'use strict';
// Run after npm run build. Checks real tone geometry and decoded bitmap ink.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), zlib = require('node:zlib');
const { render, depthAt } = require('./renderer.js');
const { buildDots } = require('./dots.js');
const levels = [4, 8, 16, 32, 64];
const molecule = { atoms: [{ element: 'C', position: [0, 0, 0], radius: 1 }], bonds: [] };
const base = { width: 220, height: 220, scale: 55, quality: 'preview', textureScale: 1, shadingBrightness: -.15 };
for (const bad of [0, 1, 3, 15, 128, 4.1, '16', null, NaN, Infinity]) {
  assert.throws(() => render(molecule, { ...base, shadingLevels: bad }), /Invalid shadingLevels/);
}
for (const renderMode of ['precise', 'fast']) for (const shadingMode of ['hatch', 'halftone', 'stipple']) {
  const seen = new Set();
  for (const shadingLevels of levels) {
    const svg = render(molecule, { ...base, renderMode, shadingMode, quantizeShading: true, shadingLevels });
    assert(!/NaN|undefined|Infinity/.test(svg));
    assert(svg.includes(`data-tone-levels="${shadingLevels}"`), `${renderMode}/${shadingMode}/${shadingLevels} metadata`);
    const values = [...svg.matchAll(/data-(?:tone|birth)-level="(\d+)"/g)].map(m => +m[1]);
    assert(values.length && values.every(v => v >= 1 && v <= shadingLevels));
    if (shadingMode === 'hatch') {
      const widths = [...svg.matchAll(/<use[^>]*stroke-width="([^"]+)"/g)].map(m => m[1]);
      assert(widths.length > shadingLevels / 2, 'actual layered width bands');
      seen.add(JSON.stringify([...new Set(widths)]));
    } else if (shadingMode === 'halftone') {
      const coverage = [...svg.matchAll(/data-coverage="([^"]+)"/g)].map(m => +m[1]);
      assert(coverage.length > 1);
      assert(coverage.every(v => Math.abs(v * shadingLevels - Math.round(v * shadingLevels)) < 1e-8));
      const radii = [...svg.matchAll(/<circle[^>]* r="([^"]+)"/g)].map(m => m[1]);
      seen.add(JSON.stringify(radii));
    } else {
      assert(svg.includes('data-tile="bitmap"'));
      seen.add([...svg.matchAll(/href="(data:image\/png;base64,[^"]+)"/g)].map(m => m[1]).join(''));
    }
    if (shadingLevels === 16) assert.equal(svg, render(molecule, { ...base, renderMode, shadingMode, quantizeShading: true }));
    const off = render(molecule, { ...base, renderMode, shadingMode, quantizeShading: false, shadingLevels });
    assert(!off.includes('data-tone-levels='));
  }
  assert.equal(seen.size, 5, `${renderMode}/${shadingMode}: real marks, not relabeling`);
}
// Flat mark stipple and sampled low-level halftone must also honor every palette.
const sphere = { kind: 'sphere', c: [0, 0, 0], r: 1 }, project = p => [40 + p[0] * 30, 40 - p[1] * 30];
const regions = { query(x, y) { const clearance = 30 - Math.hypot(x - 40, y - 40); return clearance > 0 ? { id: 0, clearance } : null; } };
for (const shadingMode of ['stipple', 'halftone']) {
  const continuous = new Set(), quantized = new Set();
  for (const shadingLevels of levels) {
    const opts = { shadingMode, shadingLevels, dotSize: 1, dotSpacing: 5, dotContrast: 1, width: 80, height: 80 };
    const call = flag => buildDots([sphere], depthAt, project, 30, n => .7 * n[0], { ...opts, quantizeShading: flag }, regions, undefined, { paths: null, compactStipple: true });
    continuous.add(call(false)); quantized.add(call(true));
    if (shadingMode === 'stipple') {
      const births = [...call(true).matchAll(/data-birth-level="(\d+)"/g)].map(m => +m[1]);
      assert(births.length && births.every(n => n <= shadingLevels));
    }
  }
  assert.equal(continuous.size, 1, 'false ignores palette and preserves continuous bytes');
  assert.equal(quantized.size, 5);
}
// Fast bonds use the same quantized local engines, without global boundaries.
const bonded = { atoms: [{ element: 'C', position: [-1.5, 0, 0], radius: .4 }, { element: 'C', position: [1.5, 0, .2], radius: .4 }], bonds: [[0, 1]] };
for (const shadingMode of ['hatch', 'stipple', 'halftone']) {
  const svg = render(bonded, { ...base, renderMode: 'fast', shadingMode, quantizeShading: true, shadingLevels: 64 });
  assert(svg.includes('data-bond-visible-count="1"'));
  assert(svg.includes('data-boundary-builds="0"'));
  assert(svg.includes('data-tone-levels="64"'));
}
assert(!render(molecule, { ...base, renderMode: 'fast' }).includes('data-hatch-renderer="layered"'));
assert(!render(molecule, { ...base, renderMode: 'fast', shadingMode: 'stipple' }).includes('data-tile="bitmap"'));
// Multiple owners share the complete local template, embedding each bitmap once.
const multiple = { atoms: [-1, 0, 1].map(x => ({ element: 'C', position: [x, 0, 0], radius: .6 })), bonds: [] };
for (const shadingLevels of levels) {
  const svg = render(multiple, { ...base, renderMode: 'fast', shadingMode: 'stipple', quantizeShading: true, shadingLevels });
  const images = [...svg.matchAll(/<image\b[^>]*id="([^"]+)"[^>]*href="(data:image\/png;base64,[^"]+)"[^>]*\/>/g)];
  assert(images.length > 1 && images.length <= shadingLevels);
  assert.equal(new Set(images.map(m => m[2])).size, images.length, 'each identical PNG embedded exactly once');
  assert.equal((svg.match(/data:image\/png;base64,/g) || []).length, images.length);
  const imageIds = new Set(images.map(m => m[1]));
  const refs = [...svg.matchAll(/<use href="#([^"]+-shared-image-\d+)"\/>/g)];
  assert(refs.length >= images.length, 'shared template patterns reference bitmap definitions');
  assert(refs.every(m => imageIds.has(m[1])), 'all shared-image references resolve');
  for (const image of images) assert(refs.some(m => m[1] === image[1]), 'all image definitions are used');
  assert(!/<pattern\b[^>]*>\s*<image/.test(svg), 'patterns no longer duplicate image payloads');
}
// Read generated module without relying on private bundle exports.
const ts = require('typescript'), moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/stipple-tiles.generated.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleObject.exports });
const sets = moduleObject.exports.STIPPLE_TILE_SETS;
function decode(uri) {
  const png = Buffer.from(uri.split(',')[1], 'base64'), chunks = []; let offset = 8, width, height;
  while (offset < png.length) {
    const n = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8), body = png.subarray(offset + 8, offset + 8 + n);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); assert.equal(body[8], 1); }
    if (type === 'IDAT') chunks.push(body);
    offset += 12 + n;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = Math.ceil(width / 8), bits = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) { assert.equal(raw[y * (stride + 1)], 0); raw.copy(bits, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1)); }
  return { bits, width, height, stride };
}
for (const n of levels) {
  assert.equal(sets[n].levels.length, n);
  let union;
  for (const [i, uri] of sets[n].levels.entries()) {
    const { bits, width, height, stride } = decode(uri);
    union ??= Buffer.alloc(bits.length);
    for (let k = 0; k < bits.length; k++) union[k] |= bits[k];
    let ink = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (union[y * stride + (x >> 3)] & (128 >> (x & 7))) ink++;
    assert(Math.abs(ink / (width * height) - Math.min((i + 1) / n, .995)) < .012, `${n}/${i + 1} true cumulative PNG coverage`);
  }
}
console.log('shading levels: six routes x five palettes, continuous compatibility, bonds, sampled/marks fallbacks, and all 124 decoded bitmap birth groups passed');
