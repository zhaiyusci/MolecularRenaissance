/* Portable native-engine benchmark. Run from the repository root.
 * Node: node [--jitless] scripts/bench-js-engines.cjs
 * QuickJS-ng: qjs --std --script scripts/bench-js-engines.cjs
 * Pre-create build/engine-bench. No application source or option changes.
 */
(function () {
  'use strict';
  var node = typeof process === 'object' && !!process.versions && !!process.versions.node;
  var engine = node ? (process.execArgv.indexOf('--jitless') >= 0 ? 'node-jitless' : 'node-jit') : 'quickjs-ng';
  var fs = node ? require('node:fs') : null;
  var api;
  var loadStart = performance.now();
  if (node) api = require('../renderer.js');
  else {
    ['dot-regions.js', 'boundaries.js', 'wash.js', 'dots.js', 'renderer.js'].forEach(function (file) { std.loadScript(file); });
    api = globalThis.MolEngraver;
  }
  var loadMs = performance.now() - loadStart;
  if (!api || typeof api.render !== 'function') throw new Error('Renderer API did not load');
  var out = 'build/engine-bench/';
  function save(name, value) {
    if (node) fs.writeFileSync(out + name, value);
    else {
      var file = std.open(out + name, 'w');
      if (!file) throw new Error('Cannot open benchmark output ' + name);
      try { file.puts(value); } finally { file.close(); }
    }
  }
  var report = {
    engine: engine,
    runtime: node ? {node: process.version, v8: process.versions.v8} : {implementation: 'QuickJS-ng', version: '0.16.2', versionNote: 'Host qjs --help verified; recheck when using another binary'},
    loadMs: loadMs,
    note: 'Native engine, same classic bundle, 1 initial render + 3 warmups + 5 measured renders per case. Sequential cases in a single process. First-case timings include any remaining engine initialization. Timed section is render() only, excluding file IO, hashing and browser paint.',
    rows: []
  };
  console.log(JSON.stringify({engine: engine, runtime: report.runtime, loadMs: loadMs}));
  var cases = [['phenol', 'precise', true, false], ['c60', 'precise', true, false], ['c60', 'fast', true, false], ['c60', 'precise', false, true]];
  cases.forEach(function (item) {
    var name = item[0], mode = item[1], shading = item[2], textures = item[3];
    var options = {width: 800, height: 700, scale: 50, quality: 'preview', renderMode: mode, shadingMode: 'hatch', castShadows: false, colorWash: false, labels: false, elementTextures: textures};
    if (!shading) options.shadingSize = 0;
    var start = performance.now(), svg = api.render(api.examples[name], options), firstMs = performance.now() - start;
    for (var i = 0; i < 3; i++) api.render(api.examples[name], options);
    var times = [];
    for (var j = 0; j < 5; j++) {
      var t = performance.now();
      svg = api.render(api.examples[name], options);
      times.push(performance.now() - t);
    }
    var sorted = times.slice().sort(function (a, b) { return a - b; });
    var id = name + '-' + mode + (shading ? '-hatch' : '-elements');
    if (svg.indexOf('<svg') !== 0 || /NaN|Infinity/.test(svg)) throw new Error('Invalid SVG: ' + id);
    save(engine + '-' + id + '.svg', svg);
    var row = {id: id, options: options, firstMs: firstMs, timesMs: times, medianMs: sorted[2], minMs: sorted[0], maxMs: sorted[4], chars: svg.length};
    report.rows.push(row);
    save(engine + '.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({engine: engine, id: id, firstMs: firstMs, medianMs: sorted[2], minMs: sorted[0], maxMs: sorted[4], chars: svg.length}));
  });
}());
