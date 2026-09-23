'use strict';
/*
 Build-time generator for the 16-level stipple fill tiles.

 The stipple screen is a texture, so it is rasterized once here instead of being
 re-stroked as vector marks in the browser. Marks are single pixels: a bitmap
 needs no round dots, the finest reproducible mark is the pixel, and a mark that
 is entirely inside the tile cannot straddle the repeat seam.

 The level model is the classic overlap-corrected coverage law for fixed-size
 marks: coverage c means lambda = -log(1 - c) marks per pixel, so a tile holding
 the marks born at level L reproduces cumulative coverage min(L/16, .995) when
 levels 1..L are overlaid on the nested tone regions.

 Resolution is a build parameter, because a bitmap bakes it in, and it alone
 fixes the printed mark size (1 px = 25.4/dpi mm). Pass the print target:

   node scripts/build-stipple-tiles.mjs --print-width-mm 200 --dpi 300
   node scripts/build-stipple-tiles.mjs --px 1024

 Output goes to build/stipple-tiles/ as one 1-bit PNG per level plus a manifest,
 and real byte sizes are printed. Nothing is written into src/.
*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const LEVELS = 16;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build', 'stipple-tiles');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const PERIOD = Number(arg('period', 153.6));   // SVG units the tile spans
const CELLS = Number(arg('cells', 128));       // Poisson cells per side
const MARK = Math.max(1, Math.round(Number(arg('mark-px', 2))));  // mark side in pixels
const CANVAS_UNITS = 900;                      // renderer canvas width, for mm/dpi mapping

// Provisional print target until a real specification lands. It is the default so
// that a bare `npm run build:tiles` reproduces the committed tile set, and so that
// `npm run build:tiles -- --dpi 600` overrides rather than fights a script default.
const printWidthMm = Number(arg('print-width-mm', 200));
const dpi = Number(arg('dpi', 300));
let PX = Math.round(Number(arg('px', 0)));
let pxSource = 'explicit --px';
if (!PX) {
  const pxPerUnit = (printWidthMm / 25.4) * dpi / CANVAS_UNITS;
  PX = Math.ceil(PERIOD * pxPerUnit);
  pxSource = `${printWidthMm} mm @ ${dpi} dpi -> ${(PERIOD * pxPerUnit).toFixed(0)} px -> ${PX}`;
}

// Deterministic stream, unchanged from the vector atlas.
function mix(x) {
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
function keyHash(text) {
  let a = 2166136261, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b);
    b = (b << 13) | (b >>> 19);
  }
  return [mix(a), mix(b)];
}
function uniform(key, k, stream) {
  const a = mix(key[0] ^ Math.imul(k + 1, 0x9e3779b9) ^ Math.imul(stream + 1, 0x85ebca6b));
  const b = mix(key[1] ^ Math.imul(k + 1, 0xc2b2ae35) ^ Math.imul(stream + 1, 0x27d4eb2d));
  return (mix(a ^ b) + 0.5) / 4294967296;
}

// --- 1-bit indexed PNG with a transparent paper entry (bit 1 = ink) ---
// Grayscale or gray+alpha would force 8 bits per pixel; indexed color keeps
// 1 bit and still gets full transparency through tRNS. The palette puts paper
// at index 0 and ink at index 1, so a reader that ignores tRNS falls back to
// white paper instead of to solid ink.
const CRC = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c; }
  return t;
})();
function chunk(type, body) {
  const name = Buffer.from(type, 'latin1');
  const all = Buffer.concat([name, body]);
  let crc = 0xffffffff;
  for (const b of all) crc = CRC[(crc ^ b) & 255] ^ (crc >>> 8);
  const head = Buffer.alloc(4), tail = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, all, tail]);
}
const PALETTE = Buffer.from([255, 255, 255, 0, 0, 0]);   // 0 = paper, 1 = ink
const ALPHA = Buffer.from([0, 255]);                     // paper transparent, ink opaque
function encode1Bit(width, height, bits) {
  const stride = Math.ceil(width / 8);
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                                   // filter: none
    bits.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1;    // bit depth
  ihdr[9] = 3;    // indexed color
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', PALETTE),
    chunk('tRNS', ALPHA),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const coverage = level => Math.min(level / LEVELS, 0.995);
// Marks per pixel for a target coverage of fixed-size marks.
const lambda = level => -Math.log(1 - coverage(level)) / (MARK * MARK);

function popcount(b) { let c = 0; while (b) { c += b & 1; b >>= 1; } return c; }

function renderLevel(level) {
  const stride = Math.ceil(PX / 8);
  const bits = Buffer.alloc(stride * PX, 0);                       // paper (transparent)
  const cellPx = PX / CELLS;
  const mu = (lambda(level) - lambda(level - 1)) * cellPx * cellPx; // marks born at this level
  let marks = 0;
  const setInk = (cx, cy) => {
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    for (let dy = 0; dy < MARK; dy++) for (let dx = 0; dx < MARK; dx++) {
      const wx = ((x0 + dx) % PX + PX) % PX, wy = ((y0 + dy) % PX + PX) % PX;
      bits[wy * stride + (wx >> 3)] |= 0x80 >> (wx & 7);
    }
  };
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
    const key = keyHash(JSON.stringify(['1729', i, j, level]));
    const u = uniform(key, 0, 0);
    let p = Math.exp(-mu), cdf = p, count = 0;
    while (u > cdf) { count++; p *= mu / count; const next = cdf + p; if (next === cdf) throw new Error('Poisson count precision exhausted'); cdf = next; }
    for (let k = 0; k < count; k++) {
      setInk((i + uniform(key, k, 1)) * cellPx, (j + uniform(key, k, 2)) * cellPx);
      marks++;
    }
  }
  return { bits, marks };
}

fs.mkdirSync(OUT, { recursive: true });
const pxPerUnit = PX / PERIOD;
const markMm = MARK * 25.4 / dpi;                // one printed mark, square
console.log(`tile: ${PX}x${PX} px, period ${PERIOD} SVG units, ${CELLS} cells, ${MARK}x${MARK} px marks`);
console.log(`resolution source: ${pxSource}`);
console.log(`print mapping: ${pxPerUnit.toFixed(2)} px per SVG unit -> canvas drawn width ${(CANVAS_UNITS * pxPerUnit / dpi * 25.4).toFixed(0)} mm at ${dpi} dpi`);
console.log(`mark size at print: ${markMm.toFixed(3)} mm (${MARK}x${MARK} px)`);
console.log('');
console.log('level'.padStart(5), 'marks'.padStart(8), 'raw KB'.padStart(8), 'png KB'.padStart(8), 'b64 KB'.padStart(8), 'ink %'.padStart(7));
const manifest = { px: PX, period: PERIOD, cells: CELLS, markPx: MARK, dpi, levels: [] };
let totalPng = 0, totalB64 = 0, prevMarks = -1, monotone = true;
for (let level = 1; level <= LEVELS; level++) {
  const { bits, marks } = renderLevel(level);
  const png = encode1Bit(PX, PX, bits);
  const b64 = png.toString('base64');
  fs.writeFileSync(path.join(OUT, `level-${String(level).padStart(2, '0')}.png`), png);
  manifest.levels.push({ level, marks, bytes: png.length, png: b64 });
  const ink = bits.reduce((s, b) => s + popcount(b), 0) / (PX * PX);
  totalPng += png.length; totalB64 += b64.length;
  if (marks <= prevMarks) monotone = false;
  prevMarks = marks;
  console.log(String(level).padStart(5), String(marks).padStart(8), (PX * PX / 8 / 1024).toFixed(1).padStart(8),
    (png.length / 1024).toFixed(1).padStart(8), (b64.length / 1024).toFixed(1).padStart(8), (ink * 100).toFixed(1).padStart(7));
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));

// Emit the committed module the renderer imports. It lives in src/ (not build/)
// so a clean checkout can typecheck and bundle without running this tool first.
const ts = [
  '/* Generated by scripts/build-stipple-tiles.mjs. Do not edit by hand.',
  ` * Print target ${printWidthMm || '(none)'} mm @ ${dpi} dpi -> tile ${PX}x${PX} px, ${MARK}x${MARK} px marks.`,
  ` * Regenerate: node scripts/build-stipple-tiles.mjs --print-width-mm ${printWidthMm || 200} --dpi ${dpi} --mark-px ${MARK}`,
  ' */',
  'export interface StippleTileSet {',
  '  /** Tile side in pixels. */',
  '  readonly px: number;',
  '  /** SVG units one tile spans at the reference texture scale. */',
  '  readonly period: number;',
  '  readonly cells: number;',
  '  /** Square mark side in tile pixels; one pixel is 25.4/dpi mm at print. */',
  '  readonly markPx: number;',
  '  readonly dpi: number;',
  '  /** Provisional print width this set was sized for, in millimetres. */',
  '  readonly printWidthMm: number;',
  '  /** One 1-bit PNG data URI per tone level, levels 1..16. */',
  '  readonly levels: readonly string[];',
  '}',
  'export const STIPPLE_TILES: StippleTileSet = {',
  `  px: ${PX},`,
  `  period: ${PERIOD},`,
  `  cells: ${CELLS},`,
  `  markPx: ${MARK},`,
  `  dpi: ${dpi},`,
  `  printWidthMm: ${printWidthMm},`,
  '  levels: [',
  ...manifest.levels.map(entry => `    'data:image/png;base64,${entry.png}',`),
  '  ],',
  '};',
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'src', 'stipple-tiles.generated.ts'), ts);
console.log(`wrote src/stipple-tiles.generated.ts (${(ts.length / 1024).toFixed(0)} KB)`);

const midMarks = manifest.levels[7].marks;       // level 8 increment
const tileMm = PX / dpi * 25.4;
console.log('');
console.log(`raw (uncompressed 1-bit) would be ${(PX * PX / 8 * LEVELS / 1024).toFixed(0)} KB`);
console.log(`actual PNG total ${(totalPng / 1024).toFixed(0)} KB -> base64 ${(totalB64 / 1024).toFixed(0)} KB  (compression ${(PX * PX / 8 * LEVELS / totalPng).toFixed(1)}x)`);
console.log(`tile covers ${tileMm.toFixed(1)} mm, repeats ${(CANVAS_UNITS / PERIOD).toFixed(1)}x across the canvas`);
console.log(`mid-tone increment ${midMarks} marks in ${tileMm.toFixed(1)} mm square = ${(midMarks / (tileMm * tileMm)).toFixed(1)} marks/mm2`);
console.log(`marks increase with level: ${monotone ? 'yes' : 'NO (unexpected)'}`);
