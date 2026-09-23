'use strict';
// node test-tone-switch.cjs [--source]: focused, small-scene checks; no build/files.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=process.argv.includes('--source');
const cache=new Map();
function loadSource(name){
  const file=path.resolve(__dirname,'src',name.replace(/\.(js|ts)$/,'')+'.ts');
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const ts=require('typescript');
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(id=>id.startsWith('.')?loadSource(path.relative(path.join(__dirname,'src'),path.resolve(path.dirname(file),id))):require(id),module,module.exports);
  return module.exports;
}
const {buildDots}=source?loadSource('dots'):require('./dots.js');
const {render,depthAt}=source?loadSource('renderer'):require('./renderer.js');
const sphere={kind:'sphere',c:[0,0,0],r:1};
const scene=[sphere],scale=80,project=p=>[90+p[0]*scale,90-p[1]*scale];
const options={shadingMode:'halftone',dotSpacing:5,dotSize:1,width:180,height:180};
const light=n=>.7*n[0]+.3*n[1];
// Exact single-sphere clearance, independently of the production arrangement.
const regions={query(x,y,r){const d=80-Math.hypot(x-90,y-90);return d>0?{id:0,clearance:Math.min(r,d)}:null;}};
const dots=(o={},r=regions,surfaces)=>buildDots(scene,depthAt,project,scale,light,{...options,...o},r,undefined,surfaces);
const marks=svg=>[...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"\/>/g)].map(m=>({x:+m[1],y:+m[2],r:+m[3]}));
const pattern=dots({},null);
if(source){
  const baseline=require('./dots.js').buildDots;
  assert.equal(pattern,baseline(scene,depthAt,project,scale,light,options,null),'true pattern bytes match distributed baseline');
  const legacyOptions={...options,shadingMode:'stipple'};
  assert.equal(dots(legacyOptions),baseline(scene,depthAt,project,scale,light,legacyOptions,regions),'stipple bytes match distributed baseline');
}
assert(pattern.includes('<pattern'));
assert.equal(dots({quantizeShading:true},null),pattern,'default screen is byte-identical to explicit true');
assert.equal(dots({quantizeShading:true},{query(){throw Error('pattern must not query regions');}}),pattern);
const continuous=dots({quantizeShading:false});
assert(!continuous.includes('<pattern'),'off emits real circles, never repeated tone tiles');
const circles=marks(continuous);
assert(circles.length>1000);
assert(new Set(circles.map(c=>c.r)).size>16,'sphere has more than 16 actual radii');
for(const c of circles){
  const a=c.x,b=c.y; // g/5 = 1 here.
  assert(Math.abs(a-Math.round(a))<1e-6&&Math.abs(b-Math.round(b))<1e-6);
  assert.equal(Math.abs((Math.round(a)+Math.round(b))%2),1,'same rotate(45) pattern phase');
  assert(c.r>0&&c.r<=1+1e-6);
  if(Math.hypot(c.x-90,c.y-90)<70){
    const lit=.7*(c.x-90)/80+.3*(90-c.y)/80;
    const coverage=Math.pow((1-lit)/2,1.2);
    if(coverage<=Math.PI/4)assert(Math.abs(c.r-Math.SQRT2*Math.sqrt(coverage/Math.PI))<.000003,'interior radius follows continuous physical coverage');
  }
  assert(Math.hypot(c.x-90,c.y-90)+c.r<=80+1e-6,'complete disk stays on owner');
}
for(const dotSpacing of [1,5,12.5]){
  const svg=dots({quantizeShading:false,dotSpacing,width:24,height:110});
  for(const c of marks(svg))assert(c.x-c.r>=-1e-6&&c.y-c.r>=-1e-6&&c.x+c.r<=24+1e-6&&c.y+c.r<=110+1e-6,'all scales respect viewport bounds');
}
assert.equal(dots({quantizeShading:false,dotSize:0}),'');
assert.equal(buildDots(scene,depthAt,project,scale,()=>1,{...options,quantizeShading:false},regions),'');
assert.equal(buildDots([],depthAt,project,scale,light,{...options,quantizeShading:false}),'');
// Offscreen geometry must not inflate work to a full-scene rotated bounding grid.
const huge=[{kind:'sphere',c:[0,0,0],r:1e6}];
const hugeRegions={query(x,y,r){return {id:0,clearance:r};}};
const tiny=buildDots(huge,depthAt,p=>[p[0],-p[1]],1,()=>0,{...options,quantizeShading:false,width:8,height:8},hugeRegions);
assert(marks(tiny).length>0&&marks(tiny).length<100);
assert.throws(()=>buildDots(huge,depthAt,p=>[p[0],-p[1]],1,()=>0,{...options,quantizeShading:false,width:4000,height:4000},hugeRegions),/Too many halftone marks/);
// Surface callback is authoritative for continuous tone; emitSurface gets bodies.
const emitted=[];
assert.equal(dots({quantizeShading:false},regions,{paths:null,illumination:()=>1,emitSurface:(...args)=>emitted.push(args)}),'');
assert.equal(emitted.length,0);
const returned=dots({quantizeShading:false},regions,{paths:null,illumination:()=>0,emitSurface:(...args)=>emitted.push(args)});
assert.equal(returned,'');assert.equal(emitted.length,1);assert.equal(emitted[0][0],0);assert(marks(emitted[0][1]).length>0);
// Certified white front bond: both ownership and full disk clearance matter.
const rod={kind:'cylinder',a:[-1,0,1],u:[1,0,0],length:2,r:.12};
const mixed=[sphere,rod],body=[];
const exact={query(x,y,r){
  const d=80-Math.hypot(x-90,y-90);if(d<=0)return null;
  const edge=Math.abs(y-90)-9.6;
  return {id:edge<0?1:0,clearance:Math.min(r,d,Math.abs(edge))};
}};
const ink=buildDots(mixed,depthAt,project,scale,()=>-1,{...options,quantizeShading:false},exact,undefined,{paths:null,illumination:s=>s===rod?1:-.3,emitSurface:(id,svg)=>body.push([id,svg])});
assert.equal(ink,'');assert(body.length>0&&body.every(([id])=>id===0),'white bond emits no marks');
for(const [,svg] of body)for(const c of marks(svg))assert(Math.abs(c.y-90)-c.r>=9.6-1e-6,'rear dots never leak onto white foreground bond');
// The pre-existing uncertified numerical footprint fallback remains available.
const fallback=buildDots(scene,depthAt,p=>[16+12*p[0],16-12*p[1]],12,()=>0,{...options,quantizeShading:false,width:32,height:32,dotSpacing:5});
for(const c of marks(fallback))assert(Math.hypot(c.x-16,c.y-16)+c.r<=12+.003);
// Continuous stipple must stay byte-identical; the explicit 16-level switch is a
// deliberate tone quantization on the same flat path, never a repeated texture tile.
const stipple={shadingMode:'stipple',dotSpacing:5,dotSize:1,width:180,height:180};
assert.equal(dots({...stipple,quantizeShading:false}),dots(stipple));
const quantized=dots({...stipple,quantizeShading:true});
assert.notEqual(quantized,dots(stipple),'explicit 16-level stippling changes tone');
assert(!quantized.includes('<pattern')&&!quantized.includes('<clipPath'),'quantized stipple stays flat: no tiles, no owner clips');
const compact=dots({...stipple,quantizeShading:true},regions,{compactStipple:true});
const levels=[...compact.matchAll(/data-birth-level="(\d+)"/g)].map(m=>+m[1]);
assert(levels.length>=8,'quantized stipple serializes one flat batch per level');
assert(levels.every(l=>Number.isInteger(l)&&l>=1&&l<=16)&&new Set(levels).size<=16,'birth levels stay inside the shared tone palette');
for(const p of compact.matchAll(/<path data-stipple-radius="([^"]+)"[^>]*stroke-width="([^"]+)"/g))assert.equal(+p[2],2*+p[1],'quantized batches keep exact round-cap disk radii');
const marksOf=svg=>(svg.match(/h0/g)||[]).length;
const continuousMarks=marksOf(dots({...stipple,quantizeShading:false},regions,{compactStipple:true}));
assert(Math.abs(marksOf(compact)-continuousMarks)/continuousMarks<.15,'nearest-band quantization preserves mean tone');
for(const q of [null,0,1,'false',{},[]])assert.throws(()=>dots({quantizeShading:q}),/quantizeShading/);
if(!process.argv.includes('--dots-only')){
  const model={atoms:[{element:'C',position:[0,0,0],radius:1}],bonds:[]};
  const base={width:200,height:200,scale:24,quality:'preview',labels:false};
  for(const shadingMode of ['hatch','halftone','stipple']){
    const make=o=>render(model,{...base,shadingMode,...o});
    assert.equal(make({}),make({quantizeShading:true}),shadingMode+': default true');
    assert.notEqual(make({}),make({quantizeShading:false}),shadingMode+': off changes shading');
    if(shadingMode==='stipple'){
      // The shipped default delivers stipple ink as baked bitmap tiles; the flat
      // quantized mark delivery is still available and declared when requested.
      assert.match(make({}),/data-stipple-mode="bitmap"/);
      const flat=make({stippleFill:'marks'});
      assert.match(flat,/data-stipple-mode="quantized"/);
      assert(!flat.includes('<pattern'),'quantized stipple emits flat marks, not tiles');
      assert(!make({quantizeShading:false}).includes('data-stipple-mode="quantized"'));
    }
  }
  assert.equal(render(model,{...base,quantizeShading:false}),render(model,{...base,hatchMode:'continuous'}),'off hatching uses exact legacy continuous renderer');
  assert.equal(render(model,{...base,shadingMode:'halftone',hatchMode:'continuous'}),render(model,{...base,shadingMode:'halftone'}),'legacy hatch alias cannot disable default halftone quantization');
  assert.equal(render(model,{...base,shadingMode:'halftone',hatchMode:'layered',quantizeShading:false}),render(model,{...base,shadingMode:'halftone',quantizeShading:false}),'legacy hatch alias does not conflict outside hatch style');
  for(const q of [null,0,'false',{},[]])assert.throws(()=>render(model,{...base,quantizeShading:q}),/Invalid.*quantizeShading/);
  for(const q of [true,false]){
    for(const shadingMode of ['hatch','halftone','stipple']){
      const fast=render(model,{...base,shadingMode,renderMode:'fast',quantizeShading:q});
      assert.match(fast,/data-render-mode="fast"/,'fast accepts explicit quantized and legacy continuous routes');
      assert.notEqual(fast,render(model,{...base,shadingMode,renderMode:'fast',quantizeShading:!q}),shadingMode+': fast quantization changes actual output');
    }
    const hatchMode=q?'layered':'continuous';
    assert.equal(render(model,{...base,quantizeShading:q,hatchMode}),render(model,{...base,quantizeShading:q}),'consistent legacy hatch alias accepted');
    assert.throws(()=>render(model,{...base,quantizeShading:q,hatchMode:q?'continuous':'layered'}),/Conflicting.*quantizeShading.*hatchMode/);
  }
}
console.log('PASS focused tone switch: grid, continuous radii, bounds, owner disks, callbacks, stipple and API');
