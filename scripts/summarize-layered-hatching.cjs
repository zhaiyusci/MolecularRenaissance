'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const paths=['renderer.js','boundaries.js','dot-regions.js','dots.js','wash.js','scripts/bench-layered-hatching.cjs'];
const report={experiment:'default 16-level hatching versus explicit continuous compatibility, shared sphere skeletons, disjoint tone/shadow bands',recordedAt:new Date().toISOString(),comparison:'Visually approximate alternative to continuous ribbons, NOT equal-output optimization',rendererHashes:Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),continuousCompatibility:read('build/layered-hatching/continuous-parity.json'),engines:[read('build/layered-hatching/node-jit.json'),read('build/layered-hatching/quickjs-ng.json')]};
fs.writeFileSync('benchmarks/layered-hatching.json',JSON.stringify(report,null,2)+'\n');
console.log('| Case | V8 continuous → layered (ms) | Speedup | QuickJS continuous → layered (ms) | Speedup |');
console.log('|---|---:|---:|---:|---:|');
report.engines[0].rows.forEach((r,i)=>{const q=report.engines[1].rows[i];if(r.name!==q.name||r.castShadows!==q.castShadows)throw Error('Mismatched benchmark rows');console.log(`| ${r.name}${r.castShadows?' + shadows':''} | ${r.continuous.medianMs.toFixed(2)} → ${r.layered.medianMs.toFixed(2)} | ${r.speedup.toFixed(2)}× | ${q.continuous.medianMs.toFixed(2)} → ${q.layered.medianMs.toFixed(2)} | ${q.speedup.toFixed(2)}× |`);});
