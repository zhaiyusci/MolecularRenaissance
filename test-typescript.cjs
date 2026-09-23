'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const crypto=require('node:crypto'),ts=require('typescript');
const cases=require('./test-fixtures/renderer-cases.cjs');
const {historicalRenderer}=require('./test-fixtures/historical-renderer.cjs');
const cjs=require('./renderer.js');
const legacyAtoms=require('./test-fixtures/legacy-atoms.cjs'),legacyScales=require('./test-fixtures/legacy-scales.json');
const digest=svg=>crypto.createHash('sha256').update(svg).digest('hex');
(async()=>{
 const esm=await import('./dist/molplotter.mjs');
 const browser=vm.createContext({});
 for(const name of ['dot-regions','boundaries','wash','dots','renderer'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),browser,{filename:name+'.js'});
 assert.equal(vm.runInContext('typeof document',browser),'undefined');
 assert.equal(vm.runInContext('typeof window',browser),'undefined');
 const apiNames=['render','examples','depthAt','engravingWidth','elementColor','elementPalette','covalentRadii','covalentRadiusSource','normalizeOrientation','rotateOrientation','orientationFromEulerXYZ','orientationToEulerXYZ','parseXYZ','elementTexturePattern','elementTextureDefinition','elementTextureSwatch'].sort();
 const moduleHashes=new Map();
 for(const [label,api] of [['CommonJS',cjs],['ESM',esm],['classic scripts without DOM',browser.MolEngraver]]){
  assert.deepEqual(Object.keys(api).sort(),apiNames,label+' public exports');
  for(const c of cases){
   // Preserve the historical geometry/scale cases, but not hashes encoding
   // retired GUI captions, colorMode, and the old off-center projection.
   const {colorMode,...options}=c.options;
   const scale=legacyScales[c.legacyScaleId||c.id];
   assert(Number.isFinite(scale),`missing archived scale for ${c.id}`);
   const svg=api.render(legacyAtoms(api.examples[c.model]),{...options,scale});
   assert.equal(typeof svg,'string');assert(!/NaN|Infinity/.test(svg));
   for(const tag of svg.match(/<text\b[^>]*>/g)||[])assert.ok(tag.includes('data-role="element-label"'),label+' SVG has no GUI captions');
   const hash=digest(svg);
   if(label==='CommonJS')moduleHashes.set(c.id,hash);
   else assert.equal(hash,moduleHashes.get(c.id),`${label}: module-format parity ${c.id}`);
  }
  // Independent physical projection oracle, not a hash regenerated from the
  // implementation: radius 2 A * scale 30 px/A, centered at (160,120).
  const molecule={atoms:[{element:'C',position:[4,-3,7],radius:2}],bonds:[]};
  const options={width:320,height:240,scale:30,atomRadiusScale:1,yaw:0,pitch:0,shadingSize:0,outlineWidth:0,colorWash:true};
  const sphere=api.render(molecule,options);
  // Select the certified owner fill, independently of attribute order.
   const fills=[...sphere.matchAll(/<path\b(?=[^>]*\bdata-role="surface-fill")(?=[^>]*\bfill-rule="evenodd")[^>]*\bd="([^"]+)"/g)];
   assert.equal(fills.length,1,label+' one physical sphere fill exists');
   const contour=fills[0];
  assert(contour,label+' physical sphere fill exists');
  let point=null,samples=0;const xs=[],ys=[];
  const check=(x,y)=>{samples++;xs.push(x);ys.push(y);assert(Math.abs(Math.hypot(x-160,y-120)-60)<.001,label+' physical radius and centered projection');};
  for(const m of contour[1].matchAll(/([MLCZ])([^MLCZ]*)/g)){
   const n=(m[2].match(/[-+]?\d+(?:\.\d+)?/g)||[]).map(Number);
   if(m[1]==='M'||m[1]==='L'){point=n;check(...point);}
   else if(m[1]==='C'){
    assert(point);const [x,y]=point;
    for(let k=1;k<=16;k++){const t=k/16,u=1-t;check(u*u*u*x+3*u*u*t*n[0]+3*u*t*t*n[2]+t*t*t*n[4],u*u*u*y+3*u*u*t*n[1]+3*u*t*t*n[3]+t*t*t*n[5]);}
    point=n.slice(4);
   }
  }
  assert(samples>100);assert.deepEqual([Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)],[100,220,60,180]);
  assert.equal(sphere,api.render({...molecule,atoms:[{...molecule.atoms[0],position:[0,0,0]}]},options),'centroid projection is translation invariant');
  assert.throws(()=>api.render(api.examples.sphere,{shadingMode:'noise'}),/Invalid shadingMode/);
  assert.throws(()=>api.render(api.examples.sphere,{width:NaN}),/Invalid option/);
  assert.throws(()=>api.render({atoms:[{element:'C',position:[0,0]}],bonds:[]}),/Invalid atom position/);
  const frozen=Object.freeze({name:'immutable',atoms:Object.freeze([Object.freeze({element:'C',position:Object.freeze([0,0,0])})]),bonds:Object.freeze([])});
  assert.ok(api.render(frozen,Object.freeze({quality:'preview'})).startsWith('<svg'));
  console.log(`PASS ${label}: ${cases.length} module parity cases, physical scale/projection, validation, immutable input`);
 }
 // Independent pinned historical implementation: only its approved projection
 // change is isolated. Mandatory baseline; a missing ignored file cannot pass.
 const before=await historicalRenderer('pre-labels');
 for(const name of ['sphere','ethanol','c60'])for(const shadingMode of ['hatch','stipple','halftone']){
  const options={labels:false,shadingMode,castShadows:true,colorWash:true,quality:'preview'};
  // Stipple tone quantization and the 0.75 atom radius default are deliberate
  // post-baseline changes: pin both here and leave the shipped defaults to the
  // tests that own them.
  const legacy={...options,hatchMode:'continuous',atomRadiusScale:1,...(shadingMode==='stipple'?{quantizeShading:false}:{})};
  assert.equal(digest(cjs.render(cjs.examples[name],legacy)),digest(before.render(before.examples[name],options)),`${name}/${shadingMode}: pinned historical no-label parity`);
 }
 // Test package self-resolution and the shipped declaration graph as an actual
 // strict consumer, with neither DOM nor Node ambient type libraries installed.
 const program=ts.createProgram([path.resolve('test-fixtures/types-consumer.mts')],{
  module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,
  target:ts.ScriptTarget.ES2022,lib:['lib.es2022.d.ts'],types:[],strict:true,noEmit:true
 });
 const errors=ts.getPreEmitDiagnostics(program);
 assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
 console.log('PASS pinned historical parity, shipped declarations, typed package imports and negative API cases without DOM');
})().catch(error=>{console.error(error);process.exitCode=1;});
