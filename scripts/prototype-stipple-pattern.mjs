// OPTIONAL offline experiment; never used by the library or application.
import { render, examples } from '../dist/molplotter.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const model = process.argv[2] || 'ethanol';
if (!['ethanol', 'sphere', 'c60'].includes(model) || process.argv.length > 3) {
  console.error('Usage: node scripts/prototype-stipple-pattern.mjs [ethanol|sphere|c60]');
  process.exit(1);
}
const output = new URL('../experiments/stipple-pattern/', import.meta.url);
const radius = .3, seed = 0x73544950, sizes = [12, 24];
// Leave geometry, camera, scale, background, and ink at existing defaults.
const options = { quality: 'export', textureScale: 1, colorWash: false, castShadows: false };
const halftone = render(examples[model], { ...options, shadingMode: 'halftone' });
const stipple = render(examples[model], { ...options, shadingMode: 'stipple' });
const patternRE = /<pattern\b[^>]*>[\s\S]*?<\/pattern>/g;
const attribute = (text, name) => text.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const patterns = [...halftone.matchAll(patternRE)].map(([text]) => ({
  text, id: attribute(text, 'id'), coverage: Number(attribute(text, 'data-coverage')),
  transform: attribute(text, 'patternTransform') || ''
}));
if (!patterns.length || patterns.some(p => !p.id || !Number.isFinite(p.coverage) || p.coverage <= 0 || p.coverage > 1)) {
  throw new Error('Expected halftone pattern definitions with data-coverage in (0,1]; rebuild dist if needed.');
}
const fmt = n => String(Number(n.toFixed(6)));
function randomGenerator(initial) {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return (((t ^ (t >>> 14)) >>> 0) + .5) / 4294967296;
  };
}
function namespace(svg, prefix) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const known = new Set(ids);
  if (known.size !== ids.length) throw new Error('Duplicate input SVG IDs');
  return svg.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^\)]+)\)/g, (_, id) => `url(#${known.has(id) ? prefix : ''}${id})`)
    .replace(/\b((?:xlink:)?href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${known.has(id) ? prefix : ''}${id}"`)
    .replace(/\b(aria-labelledby|aria-describedby)="([^"]+)"/g, (_, attr, ids) =>
      `${attr}="${ids.split(/\s+/).map(id => (known.has(id) ? prefix : '') + id).join(' ')}"`);
}
function prototype(size) {
  const random = randomGenerator(seed);
  const levels = [...new Set(patterns.map(p => p.coverage).filter(c => c < 1))].sort((a, b) => a - b);
  const groups = [], cumulative = [], counts = [];
  let arrival = 0, nextArrival = -Math.log(random()) / (size * size), count = 0;
  // Arrival coordinate is intensity lambda. A rate-A Poisson process with iid
  // uniform tile positions yields a nested spatial Poisson process at every lambda.
  for (const [i, coverage] of levels.entries()) {
    const intensity = -Math.log1p(-coverage) / (Math.PI * radius * radius);
    const circles = [];
    while (nextArrival <= intensity) {
      arrival = nextArrival;
      const x = random() * size, y = random() * size;
      const xs = [x], ys = [y];
      if (x < radius) xs.push(x + size);
      if (x > size - radius) xs.push(x - size);
      if (y < radius) ys.push(y + size);
      if (y > size - radius) ys.push(y - size);
      for (const cy of ys) for (const cx of xs) circles.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${radius}"/>`);
      count++;
      nextArrival = arrival - Math.log(random()) / (size * size);
    }
    const band = `prototype-band-${i}`, nested = `prototype-through-${i}`;
    groups.push(`<g id="${band}" fill="#161616" stroke="none">${circles.join('')}</g>`);
    groups.push(`<g id="${nested}">${i ? `<use href="#prototype-through-${i - 1}"/>` : ''}<use href="#${band}"/></g>`);
    cumulative.push(nested);
    counts.push({ coverage, intensity, points: count, expectedPoints: intensity * size * size });
  }
  let first = true;
  let svg = halftone.replace(patternRE, text => {
    const p = patterns.find(p => p.text === text);
    const body = p.coverage === 1
      ? `<rect width="${size}" height="${size}" fill="#161616"/>`
      : `<use href="#${cumulative[levels.indexOf(p.coverage)]}"/>`;
    const shared = first ? groups.join('') : '';
    first = false;
    return `${shared}<pattern id="${p.id}" data-coverage="${p.coverage}" data-prototype="periodic-poisson" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"${p.transform ? ` patternTransform="${p.transform}"` : ''} overflow="hidden">${body}</pattern>`;
  });
  // Assert byte-for-byte preservation of everything outside pattern definitions.
  const originalOutside = halftone.replace(patternRE, '');
  const replacedOutside = svg.replace(groups.join(''), '').replace(patternRE, '');
  if (originalOutside !== replacedOutside) throw new Error('Prototype changed non-pattern geometry');
  svg = namespace(svg, `prototype-${model}-tile${size}-`);
  return { svg, counts, size };
}
const tiles = sizes.map(prototype);
const variants = [
  { name: 'stipple', label: 'Existing non-repeating stipple', svg: namespace(stipple, `prototype-${model}-stipple-`) },
  { name: 'halftone', label: 'Existing halftone (geometric clip reference)', svg: namespace(halftone, `prototype-${model}-halftone-`) },
  ...tiles.map(t => ({ name: `tile-${t.size}`, label: `Periodic Poisson tile: ${t.size} × ${t.size} SVG units`, svg: t.svg }))
];
// Structural checks only: no browser, rasterizer, screenshots, or image dependencies.
const allIds = new Set();
for (const v of variants) {
  if (/<(?:image|filter)\b|(?:fill-|stroke-)?opacity\s*=/i.test(v.svg)) throw new Error('Unexpected alpha/raster/filter');
  const ids = new Set([...v.svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const id of ids) {
    if (allIds.has(id)) throw new Error(`Cross-SVG ID collision: ${id}`);
    allIds.add(id);
  }
  for (const match of v.svg.matchAll(/url\(#([^\)]+)\)|\bhref="#([^"]+)"/g)) {
    if (!ids.has(match[1] || match[2])) throw new Error(`Missing SVG reference: ${match[0]}`);
  }
}
mkdirSync(output, { recursive: true });
for (const v of variants) writeFileSync(new URL(`${model}-${v.name}.svg`, output), v.svg + '\n');
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${model}: optional periodic stipple prototype</title>
<style>body{margin:24px;font:16px/1.5 system-ui;color:#161616;background:white}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;border:1px solid #ccc}figcaption{padding:12px}svg{display:block;width:100%;height:auto}code{font-size:.9em}@media(max-width:800px){main{grid-template-columns:1fr}}</style>
<h1>${model}: optional offline periodic stipple prototype</h1>
<p>Unchanged scene scale and white background; black ink; textureScale 1; dot radius 0.3 SVG units. All panels have the same viewBox and display scale. SVG downloads retain their native 900 × 700 dimensions.</p>
<p>Periodic tiles are nested Poisson subsets, not Poisson-disc samples. They reuse halftone tone clips; they are not the production stipple renderer. Repetition, cut dots at geometric boundaries, tone bins, and finite-tile coverage deviations are intentional limitations. No claim of identical appearance or faster rendering.</p>
<main>${variants.map(v => `<figure><figcaption>${v.label} — <a href="${model}-${v.name}.svg">SVG</a> (${Buffer.byteLength(v.svg).toLocaleString('en-US')} bytes)</figcaption>${v.svg}</figure>`).join('\n')}</main>
<p>See <code>STIPPLE-PATTERN-PROTOTYPE.md</code> in the repository for the construction and caveats. This page is standalone/offline; no scripts, fonts, or network assets are loaded.</p></html>\n`;
writeFileSync(new URL(`${model}-comparison.html`, output), html);
writeFileSync(new URL(`${model}-manifest.json`, output), JSON.stringify({
  model, options, radius, seed, tileSizes: sizes,
  distributionSHA256: createHash('sha256').update(readFileSync(new URL('../dist/molplotter.mjs', import.meta.url))).digest('hex'),
  note: 'Expected union coverage, not measured coverage. Exact 100% uses a solid endpoint. No timings or browser validation.',
  tiles: tiles.map(({ size, counts }) => ({ size, counts })),
  files: variants.map(v => ({ name: `${model}-${v.name}.svg`, bytes: Buffer.byteLength(v.svg + '\n') }))
}, null, 2) + '\n');
console.log(`Wrote ${variants.length} SVGs, ${model}-comparison.html, and ${model}-manifest.json to ${fileURLToPath(output)}`);
