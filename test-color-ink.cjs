'use strict';
// Standalone regression: node test-color-ink.cjs. No generated output files.
const assert = require('node:assert/strict');
const { render, depthAt, elementInkColor, elementInkPalette } = require('./renderer.js');
const { buildDots } = require('./dots.js');
const elements = ['C', 'H', 'O', 'N', 'S', 'P', 'Xx'];
const molecule = {
  name: 'Ink <ownership> & geometry',
  // Xx is a fictitious palette test element, so its physical radius is explicit.
  atoms: elements.map((element, i) => ({ element, position: [(i % 4) * 1.8, Math.floor(i / 4) * 1.8, 0], ...(element==='Xx'?{radius:.48}:{}) })),
  bonds: [[0, 1], [1, 2], [4, 5], [5, 6]]
};
const base = { width: 740, height: 540, yaw: 0, pitch: 0, labels: true,
  density: 12, dotSpacing: 5, washStrength: .65, colorSaturation: 1 };
const modes = [
  { shadingMode: 'hatch', variableWidth: false },
  { shadingMode: 'hatch', variableWidth: true },
  { shadingMode: 'stipple' },
  { shadingMode: 'halftone' }
];
function group(svg, role) {
  const start = svg.indexOf(`<g data-role="${role}"`);
  if (start < 0) return '';
  const tags = /<g\b[^>]*>|<\/g>/g;
  tags.lastIndex = start;
  let level = 0, match;
  while ((match = tags.exec(svg))) {
    level += match[0] === '</g>' ? -1 : 1;
    if (!level) return svg.slice(start, tags.lastIndex);
  }
  assert.fail(`Unclosed ${role} group`);
}
const marks = svg => svg.match(/<(?:path|circle)\b[^>]*\/>/g) || [];
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const geometry = svg => marks(svg).map(tag => tag.replace(/\s(?:fill|stroke)="[^"]*"/g, '')).sort();
const labels = svg => svg.match(/<(?:text|title)\b[^>]*>[\s\S]*?<\/(?:text|title)>/g) || [];
const colors = svg => marks(svg).map(tag => attr(tag, tag.startsWith('<circle') || attr(tag, 'stroke') === 'none' ? 'fill' : 'stroke'));
function subtract(a, b) {
  const result = [...a];
  for (const item of b) {
    const index = result.indexOf(item);
    assert.notEqual(index, -1, 'outline occurs in legacy geometry multiset');
    result.splice(index, 1);
  }
  return result.sort();
}
function checkPalette() {
  for (const element of elements) {
    assert.match(elementInkColor(element), /^#[0-9a-f]{6}$/i);
    assert.equal(elementInkColor(element), elementInkColor(element, .65, 1));
    assert.equal(elementInkColor(element, 0), '#ffffff');
    const gray = elementInkColor(element, .65, 0);
    assert.equal(gray.slice(1, 3), gray.slice(3, 5));
    assert.equal(gray.slice(3, 5), gray.slice(5, 7));
    assert.equal(elementInkColor(element, 1), elementInkPalette[element] || '#555555');
  }
  for (const element of ['H', null, undefined, 'Xx']) assert.equal(elementInkColor(element, 1), '#555555');
  const rgb = element => elementInkColor(element, 1).slice(1).match(/../g).map(v => parseInt(v, 16));
  const [c, o, n] = ['C', 'O', 'N'].map(rgb);
  assert.ok(c[0] > c[1] && c[1] > c[2] && Math.max(...c) < 150 && c[0]-c[2] >= 85, 'carbon is visibly chromatic dark sepia, not near-gray');
  const defaultC=elementInkColor('C').slice(1).match(/../g).map(v=>parseInt(v,16));
  assert.ok(defaultC[0]-defaultC[2]>=55,'default 65% concentration preserves carbon hue');
  const screen=defaultC.map(v=>255*.75+v*.25);
  assert.ok(screen[0]-screen[2]>=13,'25% ink coverage on white retains a warm chromatic separation');
  assert.ok(o[0] > o[1] && o[0] > o[2], 'oxygen red');
  assert.ok(n[2] > n[0] && n[2] > n[1], 'nitrogen blue');
  for (const element of ['O', 'N', 'S', 'P']) assert.ok(Math.max(...rgb(element)) < 190, `${element} dark palette`);
  console.log('PASS ink palette, defaults, gray/white endpoints and neutral H/bonds/unknown');
}
checkPalette();

// Removed offset regression: former options are now ordinary ignored unknown keys.
function checkRemovedOffset() {
  const fs = require('node:fs');
  const html = fs.readFileSync(require.resolve('./index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('./app.js'), 'utf8');
  assert.doesNotMatch(html, /\b(?:id|for)="wash-offset-[xy](?:-value)?"/, 'removed UI controls and outputs stay absent');
  assert.doesNotMatch(app, /wash-offset-[xy]|washOffset[XY]/, 'app neither references removed controls nor passes old options');
  const formerOptions = [
    { washOffsetX: 0, washOffsetY: 0 },
    { washOffsetX: 7.25, washOffsetY: -4.5 },
    { washOffsetX: -20, washOffsetY: 20 },
    { washOffsetX: Number.MAX_VALUE, washOffsetY: -Number.MAX_VALUE },
    { washOffsetX: NaN, washOffsetY: Infinity },
    { washOffsetX: -Infinity, washOffsetY: NaN },
    { washOffsetX: 'invalid', washOffsetY: null },
    { washOffsetX: undefined, washOffsetY: {} }
  ];
  for (const colorMode of ['wash', 'ink']) for (const shadingMode of ['hatch', 'stipple', 'halftone']) {
    for (const colorWash of [true, false]) {
      const options = { ...base, colorMode, shadingMode, colorWash, labelMatchFill: true };
      const expected = render(molecule, options);
      assert.ok(!expected.includes('color-registration'), 'no registration wrapper in baseline');
      for (const oldOptions of formerOptions) {
        const actual = render(molecule, { ...options, ...oldOptions });
        assert.equal(actual, expected, `${colorMode}/${shadingMode}/${colorWash}: removed options leave every output byte unchanged`);
        assert.ok(!actual.includes('color-registration'), 'removed options never create a registration wrapper');
      }
    }
  }
  console.log('PASS removed offset regression: two color modes × three shading modes, extremes ignored, no wrapper/UI/app options');
}
checkRemovedOffset();
for (const mode of modes) {
  const name = mode.shadingMode + (mode.shadingMode === 'hatch' ? (mode.variableWidth ? '/ribbon' : '/stroke') : '');
  const make = options => render(molecule, { ...base, ...mode, ...options });
  const inkOptions = { colorWash: true, colorMode: 'ink' };
  const wash = make({ colorWash: true, colorMode: 'wash' });
  const ink = make(inkOptions);
  const outlineOnly = make({ colorWash: false, shadingSize: 0 });
  const outline = group(outlineOnly, 'engraving');
  const texture = group(ink, 'color-texture');
  assert.ok(texture && marks(texture).length > 0, `${name}: nonempty ink texture`);
  assert.ok(!ink.includes('mol-wash'), `${name}: no wash under ink`);
  assert.equal(group(ink, 'engraving'), outline, `${name}: engraving contains exactly unchanged black outlines`);
  assert.equal(attr(outline, 'stroke'), '#161616');
  assert.ok(marks(outline).every(tag => !attr(tag, 'fill') && !attr(tag, 'stroke')));
  const legacyTexture = mode.shadingMode === 'hatch'
    ? subtract(geometry(group(wash, 'engraving')), geometry(outline))
    : geometry(group(wash, 'dots'));
  assert.deepEqual(geometry(texture), legacyTexture, `${name}: exact legacy texture geometry multiset (including widths/radii)`);
  assert.equal(marks(ink).length, marks(texture).length + marks(outline).length, 'no stray marks outside texture and outline groups');
  const allowed = new Set([...elements, null].map(element => elementInkColor(element)));
  for (const color of colors(texture)) assert.ok(allowed.has(color), `${name}: expected element ink ${color}`);
  for (const element of elements) assert.ok(colors(texture).includes(elementInkColor(element)), `${name}: ${element} texture exists, including nonwhite H/unknown`);
  if (mode.shadingMode === 'hatch') {
    for (const mark of marks(texture)) {
      if (mode.variableWidth) { assert.equal(attr(mark, 'stroke'), 'none'); assert.ok(attr(mark, 'fill')); }
      else { assert.ok(attr(mark, 'stroke')); assert.equal(attr(mark, 'fill'), undefined); }
    }
  } else assert.ok(marks(texture).every(mark => mark.startsWith('<circle') && attr(mark, 'fill')), 'every dot has explicit color');
  for (const [key, value] of [['colorSaturation', 0], ['washStrength', 0], ['colorSaturation', 2], ['washStrength', 1]]) {
    const changed = make({ ...inkOptions, [key]: value });
    const changedTexture = group(changed, 'color-texture');
    assert.deepEqual(geometry(changedTexture), geometry(texture), `${name}: ${key}=${value} preserves geometry/tone`);
    assert.equal(group(changed, 'engraving'), outline);
    assert.deepEqual(labels(changed), labels(ink));
    const expected = new Set([...elements, null].map(e => elementInkColor(e, key === 'washStrength' ? value : .65, key === 'colorSaturation' ? value : 1)));
    for (const color of colors(changedTexture)) assert.ok(expected.has(color));
    if (value === 0) for (const color of colors(changedTexture)) {
      if (key === 'washStrength') assert.equal(color, '#ffffff');
      else { assert.equal(color.slice(1, 3), color.slice(3, 5)); assert.equal(color.slice(3, 5), color.slice(5, 7)); }
    }
  }
  const zero = make({ ...inkOptions, shadingSize: 0 });
  assert.deepEqual(marks(group(zero, 'color-texture')), []);
  assert.equal(group(zero, 'engraving'), outline);
  assert.equal(marks(zero).length, marks(outline).length, 'size zero leaves only outlines');
  assert.equal(make({ colorWash: true }), wash, 'implicit default wash is byte-identical to explicit wash');
  assert.equal(make({ colorWash: false, colorMode: 'ink' }), make({ colorWash: false, colorMode: 'wash' }), 'master false mode selection is byte-identical');
  for (const match of [true, false]) {
    const svg = make({ ...inkOptions, labelMatchFill: match, labelStrokeColor: '#abcdef' });
    for (const label of labels(svg).filter(tag => tag.includes('element-label'))) assert.equal(attr(label, 'stroke'), match ? '#ffffff' : '#abcdef');
  }
  // Isolated surfaces give an independent, unambiguous ownership oracle for all modes.
  for (const element of elements) {
    const single = render({ atoms: [{ element, position: [0, 0, 0], ...(element==='Xx'?{radius:.48}:{}) }], bonds: [] }, { ...base, ...mode, ...inkOptions, width: 260, height: 260 });
    const actual = colors(group(single, 'color-texture'));
    assert.ok(actual.length > 0);
    assert.ok(actual.every(color => color === elementInkColor(element)), `${name}: isolated ${element} owns its texture`);
  }
  // Unknowns and bonds are both neutral; known O endpoints isolate cylinder coloring.
  const bonded = render({ atoms: [{ element: 'O', position: [-1, 0, 0] }, { element: 'O', position: [1, 0, 0] }], bonds: [[0, 1]] }, { ...base, ...mode, ...inkOptions });
  assert.ok(colors(group(bonded, 'color-texture')).includes(elementInkColor(null)), `${name}: visible bond is neutral nonwhite ink`);
  console.log(`PASS ${name}: geometry, ownership, outlines, controls, halos, legacy defaults`);
}
for (const colorMode of ['', 'INK', 'unknown', null, 0]) assert.throws(() => render(molecule, { colorMode }), /colorMode/);

// Overlapping spheres deliberately reverse center order versus front surface order.
const sphere = (x, z, r, element) => ({ kind: 'sphere', c: [x, 0, z], r, element });
const scene = [sphere(-5, 0, 17, 'O'), sphere(6, 5, 11, 'N')];
const project = p => [p[0], -p[1]];
function ownerAt(x, y, shapes = scene) {
  let owner = null, best = -Infinity;
  for (const shape of shapes) {
    const z = depthAt(shape, x, -y);
    if (Number.isFinite(z) && z > best) { owner = shape; best = z; }
  }
  return owner;
}
for (const shadingMode of ['stipple', 'halftone']) {
  const opts = { shadingMode, dotSpacing: 2, dotSize: 1, dotContrast: 1.2 };
  const make = callback => buildDots(scene, depthAt, project, 1, () => -.5, opts, callback);
  const plain = make(undefined), ink = make(e => elementInkColor(e, 1));
  assert.equal(make(null), plain, 'omitted/null callback byte-identical');
  assert.deepEqual(geometry(ink), geometry(plain), 'direct callback preserves every dot');
  assert.deepEqual(geometry(buildDots([...scene].reverse(), depthAt, project, 1, () => -.5, opts, e => elementInkColor(e, 1))), geometry(ink), 'non-tied visibility independent of scene ordering');
  let contrary = 0;
  const seen = new Set();
  for (const circle of marks(ink)) {
    const x = Number(attr(circle, 'cx')), y = Number(attr(circle, 'cy')), r = Number(attr(circle, 'r'));
    const owner = ownerAt(x, y);
    assert.ok(owner, 'dot center has finite visible depth');
    seen.add(owner.element);
    assert.equal(attr(circle, 'fill'), elementInkColor(owner.element, 1), 'dot uses foremost surface, not center-sorted sphere');
    if (owner === scene[0] && Number.isFinite(depthAt(scene[1], x, -y))) contrary++;
    for (const ring of [.5, 1]) for (let j = 0; j < 32; j++) {
      const angle = j * Math.PI / 16;
      assert.equal(ownerAt(x + r * ring * Math.cos(angle), y + r * ring * Math.sin(angle)), owner, 'rounded dot disk retains same nearest depth owner');
    }
  }
  assert.deepEqual([...seen].sort(), ['N', 'O']);
  assert.ok(contrary > 0, 'fixture catches incorrect center-depth sorting');
  for (const invalid of [false, 0, {}, '#123456']) assert.throws(() => make(invalid), /Invalid dot color callback/);
  for (const invalid of ['red', '#fff', '#12345678', '123456', '#gggggg', '#123456"/><path', null, undefined, 123456]) assert.throws(() => make(() => invalid), /Invalid dot ink color/);
  assert.ok(marks(make(() => '#ABCDEF')).every(tag => attr(tag, 'fill') === '#ABCDEF'), 'six-digit uppercase hex accepted');
  console.log(`PASS direct ${shadingMode}: ${marks(ink).length} dots, ${contrary} center-order counterexamples, depth disks and callback validation`);
}
console.log('PASS all color ink regressions (no files generated).');
