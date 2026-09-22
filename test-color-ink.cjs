'use strict';
// PALETTES.md: color belongs to the wash; all illumination marks remain black.
// Standalone regression; no generated files.
const assert=require('node:assert/strict'),fs=require('node:fs');
const engine=require('./renderer.js');
const {render:rawRender,depthAt,elementColor,elementPalette}=engine;
// Layered IDs hash the full option payload. Normalize only its single namespace;
// all geometry, styles, definitions and corresponding references remain compared.
function render(...args){const svg=rawRender(...args),ids=[...new Set(svg.match(/\blh-[a-z0-9]+-[a-z0-9]+(?=-)/g)||[])];assert(ids.length<=1);return ids.length?svg.split(ids[0]).join('lh-NAMESPACE'):svg;}
const colorSchemes={
  jmol:{H:'#ffffff',C:'#909090',N:'#3050f8',O:'#ff0d0d',P:'#ff8000',S:'#ffff30'},
  rasmol:{H:'#ffffff',C:'#c8c8c8',N:'#8f8fff',O:'#f00000',P:'#ffa500',S:'#ffc832'},
  pymol:{H:'#e6e6e6',C:'#33ff33',N:'#3333ff',O:'#ff4d4d',P:'#ff8000',S:'#e6c640'},
  ortep:{H:'#ffffff',C:'#007fff',N:'#db70db',O:'#ff0000',P:'#ff8000',S:'#ffff00'},
};
for(const [name,C] of [['greenCarbon','#00ff00'],['cyanCarbon','#00ffff'],['magentaCarbon','#ff00ff']])colorSchemes[name]={...colorSchemes.rasmol,C};
const {buildDots}=require('./dots.js');
const {disks}=require('./test-shared-regions.cjs');
const {marks:paintMarks}=require('./test-style-coverage.cjs');
const elements=['C','H','O','N','S','P','Xx'];
const molecule={name:'Ink <ownership> & geometry',atoms:elements.map((element,i)=>({element,position:[(i%4)*1.8,Math.floor(i/4)*1.8,0],...(element==='Xx'?{radius:.48}:{})})),bonds:[[0,1],[1,2],[4,5],[5,6]]};
const base={width:740,height:540,yaw:0,pitch:0,labels:true,labelMatchFill:false,density:12,dotSpacing:5,washStrength:.65,colorSaturation:1};
const modes=[{shadingMode:'hatch',variableWidth:false},{shadingMode:'hatch',variableWidth:true},{shadingMode:'stipple'},{shadingMode:'halftone'}];
const attr=(tag,name)=>new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
function groups(svg,attribute,value){
  const out=[],stack=[];
  for(const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)){
    if(m[0]==='</g>'){const start=stack.pop();assert(start);if(start.match)out.push(svg.slice(start.index,m.index+m[0].length));}
    else if(!m[0].endsWith('/>'))stack.push({index:m.index,match:attr(m[0],attribute)===value});
  }
  assert.equal(stack.length,0);return out;
}
const ink=svg=>[...(svg.match(/<defs data-hatch-renderer="layered"[\s\S]*?<\/defs>/g)||[]),...['engraving','dots'].flatMap(role=>groups(svg,'data-role',role))];
const wash=svg=>groups(svg,'class','mol-wash').join('')+(svg.match(/<path\b[^>]*data-role="surface-fill"[^>]*\/>/g)||[]).join('');
const washGeometry=svg=>wash(svg).replace(/\bfill="[^"]*"/g,'');
const labels=svg=>svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/g)||[];
function assertBlack(svg){
  const pieces=[...ink(svg),...(svg.match(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)||[])];
  assert(pieces.length>0);
  for(const piece of pieces)for(const m of piece.matchAll(/\b(?:fill|stroke)="([^"]+)"/g))
    assert(['none','#161616'].includes(m[1])||/^url\(#/.test(m[1]),`monochrome texture/outline, not ${m[1]}`);
  assert(!svg.includes('color-texture'),'removed colored texture groups stay absent');
}
for(const key of ['elementInkColor','elementInkPalette'])assert(!Object.hasOwn(engine,key),`${key} remains removed`);
assert.deepEqual(elementPalette,{H:'#ffffff',C:'#909090',N:'#3050f8',O:'#ff0d0d',P:'#ff8000',S:'#ffff30'});
for(const scheme of Object.keys(colorSchemes))for(const e of [...elements,null,undefined]){
  const expected=e!=null&&Object.hasOwn(colorSchemes[scheme],e)?colorSchemes[scheme][e]:scheme==='ortep'?'#bc8f8f':colorSchemes[scheme].C;
  assert.equal(elementColor(e,1,1,scheme),expected);
  assert.equal(elementColor(e,0,1,scheme),'#ffffff');
  const gray=elementColor(e,.65,0,scheme);assert.equal(gray.slice(1,3),gray.slice(3,5));assert.equal(gray.slice(3,5),gray.slice(5,7));
}
console.log('PASS published palette values, unknown fallback, concentration and saturation endpoints');
const html=fs.readFileSync(require.resolve('./index.html'),'utf8'),app=fs.readFileSync(require.resolve('./app.js'),'utf8');
assert.doesNotMatch(html,/\b(?:id|for)="(?:wash-offset-[xy](?:-value)?|color-mode)"/);
assert.doesNotMatch(app,/wash-offset-[xy]|washOffset[XY]|colorMode/);
const removed=[{washOffsetX:0,washOffsetY:0},{washOffsetX:7.25,washOffsetY:-4.5},{washOffsetX:-20,washOffsetY:20},{washOffsetX:Number.MAX_VALUE,washOffsetY:-Number.MAX_VALUE},{washOffsetX:NaN,washOffsetY:Infinity},{washOffsetX:-Infinity,washOffsetY:NaN},{washOffsetX:'invalid',washOffsetY:null},{washOffsetX:undefined,washOffsetY:{}}];
for(const shadingMode of ['hatch','stipple','halftone'])for(const colorWash of [false,true]){
  const options={...base,shadingMode,colorWash},expected=render(molecule,options);
  for(const old of [...removed,...['wash','ink','','INK','unknown',null,0].map(colorMode=>({colorMode}))])assert.equal(render(molecule,{...options,...old}),expected,'unknown keys change no output after validating/normalizing only the layered namespace');
  assert(!expected.includes('color-registration'));
}
for(const mode of modes){
  const make=o=>render(molecule,{...base,...mode,...o}),mono=make({colorWash:false}),colored=make({colorWash:true});
  assertBlack(mono);assertBlack(colored);
  assert(wash(colored).includes('<path'),'actual colored surface wash');
  assert([...wash(mono).matchAll(/\bfill="([^"]+)"/g)].every(m=>m[1]==='#ffffff'),'disabled wash leaves white opaque owners');
  assert.equal(washGeometry(colored),washGeometry(mono),'color changes no surface geometry');
  assert.deepEqual(ink(colored),ink(mono),'wash leaves every owner engraving/dot group byte-identical');
  assert.deepEqual(labels(colored),labels(mono),'manual label styling independent of wash');
  assert(labels(colored).length>=elements.length,'all test elements have labels');
  for(const [key,value] of [['colorSaturation',0],['washStrength',0],['colorSaturation',2],['washStrength',1]]){
    const changed=make({colorWash:true,[key]:value});
    assert.deepEqual(ink(changed),ink(mono),'wash controls preserve all widths, positions, radii, patterns and owner groups');
    assert.deepEqual(labels(changed),labels(mono));assertBlack(changed);
    assert.equal(washGeometry(changed),washGeometry(colored),'concentration and saturation preserve every surface boundary');
    if(key==='washStrength'&&value===0)assert.equal(changed,mono);
    const allowed=new Set(elements.map(e=>elementColor(e,key==='washStrength'?value:.65,key==='colorSaturation'?value:1)));
    allowed.add('#ffffff');
    for(const m of wash(changed).matchAll(/\bfill="([^"]+)"/g))assert(allowed.has(m[1]),'wash uses the selected physical element palette');
  }
  const zero=make({colorWash:true,shadingSize:0}),outlineOnly=make({colorWash:false,shadingSize:0});
  assert.deepEqual(ink(zero),ink(outlineOnly),'zero shading leaves unchanged black outlines');
  assert(groups(zero,'data-role','dots').every(g=>!/<(?:path|circle|rect)\b/.test(g)));
  assert.equal(wash(zero),wash(colored),'shading off preserves all colored surface boundaries');
  for(const element of elements){
    const model={atoms:[{element,position:[0,0,0],...(element==='Xx'?{radius:.48}:{})}],bonds:[]};
    const options={...base,...mode,colorWash:true,width:260,height:260};
    const single=render(model,options);assertBlack(single);
    const expected=elementColor(element,.65,1),fills=[...wash(single).matchAll(/\bfill="([^"]+)"/g)].map(m=>m[1]);
    assert(fills.every(c=>c===expected||c==='#ffffff'));
    if(expected!=='#ffffff')assert(fills.includes(expected),`isolated ${element} owns its wash`);
    const texture=mode.shadingMode==='hatch'?groups(single,'data-role','engraving').join(''):groups(single,'data-role','dots').join('');
    assert(/<(?:path|circle|rect)\b/.test(texture),`${element}, including white H, retains black illumination marks`);
    for(const match of [false,true]){
      const styled=render(model,{...options,labelMatchFill:match,labelStrokeColor:'#abcdef'});
      for(const tag of labels(styled))assert.equal(attr(tag,'stroke'),match?expected:'#abcdef','label halo matches actual wash or manual style');
    }
  }
  const bonded=render({atoms:[{element:'O',position:[-1,0,0]},{element:'O',position:[1,0,0]}],bonds:[[0,1]]},{...base,...mode,colorWash:true});
  assertBlack(bonded);assert(wash(bonded).includes('fill="#ffffff"'),'visible bond is explicitly white, never element-colored');
  console.log(`PASS ${mode.shadingMode}/${mode.variableWidth??''}: all-owner geometry, black ink, wash controls, isolated elements, white bonds and label halos`);
}
// Independent physical oracle: overlapping front surfaces reverse center order.
const sphere=(x,z,r,element)=>({kind:'sphere',c:[x,0,z],r,element});
const scene=[sphere(-5,0,17,'O'),sphere(6,5,11,'N')],project=p=>[p[0],-p[1]];
function ownerAt(x,y,shapes=scene){let owner=null,best=-Infinity;for(const s of shapes){const z=depthAt(s,x,-y);if(Number.isFinite(z)&&z>best){owner=s;best=z;}}return owner;}
for(const shadingMode of ['stipple','halftone']){
  const options={shadingMode,dotSpacing:2,dotSize:1,dotContrast:1.2};
  const make=(shapes=scene,regions=null,surfaces)=>buildDots(shapes,depthAt,project,1,()=>-.5,options,regions,undefined,surfaces);
  const plain=make(),layers=new Map(),definitions=make(scene,null,{emitSurface:(id,svg)=>layers.set(id,svg)});
  assertBlack(plain);assert.equal(buildDots(scene,depthAt,project,1,()=>-.5,options),plain,'omitted/null regions are equivalent');
  assert.equal(layers.size,2,'both physical owners emit texture');
  let contrary=0,checked=0;const seen=new Set();
  if(shadingMode==='stipple'){
    assert.deepEqual(disks(make([...scene].reverse())),disks(plain),'non-tied disk geometry independent of center ordering');
    assert.deepEqual([...layers.values()].flatMap(disks).sort(),disks(plain),'owner routing retains every disk with multiplicity');
    for(const [id,svg] of layers)for(const disk of disks(svg)){
      const [x,y,r]=disk.split(',').map(Number),owner=ownerAt(x,y);assert.equal(owner,scene[id]);seen.add(owner.element);checked++;
      if(owner===scene[0]&&Number.isFinite(depthAt(scene[1],x,-y)))contrary++;
      for(const ring of [.5,1])for(let j=0;j<32;j++){const a=j*Math.PI/16;assert.equal(ownerAt(x+r*ring*Math.cos(a),y+r*ring*Math.sin(a)),owner,'entire rounded disk retains nearest physical owner');}
    }
    let callbackCalls=0;assert.throws(()=>make(scene,()=>{callbackCalls++;return '#123456';}),/query/);assert.equal(callbackCalls,0,'seventh argument is regions, never an element-color callback');
  }else{
    // Halftone is clipped pattern paint, not disks from definitions. Sample
    // actual paint per owner, away from the numerical contour boundary only.
    const byOwner=[...layers].map(([id,svg])=>[id,paintMarks(definitions+svg)]);
    const flat=paintMarks(plain),reverse=paintMarks(make([...scene].reverse()));
    for(let y=-18.37;y<18;y+=.41)for(let x=-23.29;x<19;x+=.41){
      const owner=ownerAt(x,y);
      // A 0.1-unit ring defines stable interior probes for sampled tone paths.
      if(!owner||Array.from({length:32},(_,j)=>ownerAt(x+.1*Math.cos(j*Math.PI/16),y+.1*Math.sin(j*Math.PI/16))).some(s=>s!==owner))continue;
      const painted=flat.some(m=>m.contains(x,y));assert.equal(reverse.some(m=>m.contains(x,y)),painted,'halftone paint independent of center ordering');
      const active=byOwner.filter(([,marks])=>marks.some(m=>m.contains(x,y)));
      assert.equal(active.length,painted?1:0,'routed paint neither duplicated nor lost');
      if(!painted)continue;assert.equal(scene[active[0][0]],owner,'halftone paint belongs to nearest physical surface');checked++;seen.add(owner.element);
      if(owner===scene[0]&&Number.isFinite(depthAt(scene[1],x,-y)))contrary++;
    }
  }
  assert(checked>100);assert.deepEqual([...seen].sort(),['N','O']);assert(contrary>0,'fixture rejects center-depth sorting');
  console.log(`PASS direct ${shadingMode}: ${checked} physical ownership probes, ${contrary} center-order counterexamples`);
}
console.log('PASS monochrome ink / color wash regressions (no generated files)');
