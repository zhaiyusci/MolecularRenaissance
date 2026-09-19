'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const crypto=require('node:crypto'),ts=require('typescript');
const cases=require('./test-fixtures/renderer-cases.cjs'),hashes=require('./test-fixtures/renderer-svg-hashes.json');
const cjs=require('./renderer.js');
const legacyAtoms=require('./test-fixtures/legacy-atoms.cjs'),legacyScales=require('./test-fixtures/legacy-scales.json');
const digest=svg=>crypto.createHash('sha256').update(svg).digest('hex');
(async()=>{
 const esm=await import('./dist/molplotter.mjs');
 const browser=vm.createContext({});
 for(const name of ['dot-regions','boundaries','wash','dots','renderer'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),browser,{filename:name+'.js'});
 assert.equal(vm.runInContext('typeof document',browser),'undefined');
 assert.equal(vm.runInContext('typeof window',browser),'undefined');
 const apiNames=['render','examples','depthAt','engravingWidth','elementColor','elementPalette','elementInkColor','elementInkPalette','covalentRadii','covalentRadiusSource'].sort();
 for(const [label,api] of [['CommonJS',cjs],['ESM',esm],['classic scripts without DOM',browser.MolEngraver]]){
  assert.deepEqual(Object.keys(api).sort(),apiNames,label+' public exports');
  for(const c of cases){
   // Keep the original hash baseline: geometry and scale are explicit fixtures,
   // not obsolete defaults or an auto-fit path inside the production renderer.
   const svg=api.render(legacyAtoms(api.examples[c.model]),{...c.options,scale:legacyScales[c.id]});
   assert.equal(typeof svg,'string');
   for(const tag of svg.match(/<text\b[^>]*>/g)||[])assert.ok(tag.includes('data-role="element-label"'),label+' SVG has no GUI captions');
   // Restore only the removed GUI captions for comparison with the old fixture.
   const width=c.options.width??900,height=c.options.height??700;
   const name=svg.match(/<title id="title">([\s\S]*?)<\/title>/)[1];
   const oldCaptions=`<text x="${width/2}" y="${height-53}" text-anchor="middle" fill="#161616" font-size="19">${name}</text><text x="${width/2}" y="${height-28}" text-anchor="middle" fill="#555" font-size="10" letter-spacing="2">ORTHOGRAPHIC • LINE ENGRAVING</text>`;
   const historical=svg.slice(0,-'</g></svg>'.length)+oldCaptions+'</g></svg>';
   assert.equal(digest(historical),hashes[c.id],`${label}: original geometry/style parity ${c.id}`);
  }
  assert.throws(()=>api.render(api.examples.sphere,{shadingMode:'noise'}),/Invalid shadingMode/);
  assert.throws(()=>api.render(api.examples.sphere,{width:NaN}),/Invalid option/);
  assert.throws(()=>api.render({atoms:[{element:'C',position:[0,0]}],bonds:[]}),/Invalid atom position/);
  const molecule=Object.freeze({name:'immutable',atoms:Object.freeze([Object.freeze({element:'C',position:Object.freeze([0,0,0])})]),bonds:Object.freeze([])});
  assert.ok(api.render(molecule,Object.freeze({quality:'preview'})).startsWith('<svg'));
  console.log(`PASS ${label}: ${cases.length} original SVG hashes, validation, immutable input`);
 }
 // Test package self-resolution and the shipped declaration graph as an actual
 // strict consumer, with neither DOM nor Node ambient type libraries installed.
 const program=ts.createProgram([path.resolve('test-fixtures/types-consumer.mts')],{
  module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,
  target:ts.ScriptTarget.ES2022,lib:['lib.es2022.d.ts'],types:[],strict:true,noEmit:true
 });
 const errors=ts.getPreEmitDiagnostics(program);
 assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
 console.log('PASS shipped TypeScript declarations, typed package imports and negative API cases without DOM');
})().catch(error=>{console.error(error);process.exitCode=1;});
