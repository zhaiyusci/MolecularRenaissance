'use strict';
// Integration contract for the approved categorical recipes. Run after building renderer.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('./renderer.js');
const {elementTexturePattern: pattern, elementTextureDefinition: definition, elementTextureSwatch: swatch, render} = api;
const approved = {
  H:'blank', C:'crosshatch', O:'diagonal-hatch', N:'horizontal-lines', S:'dots', P:'vertical-lines',
  F:'horizontal-waves', Cl:'vertical-waves', Br:'diagonal-waves', I:'double-horizontal-lines',
  B:'horizontal-rectangle-grid', Si:'square-grid', Se:'rhombus-grid', Li:'vertical-rectangle-grid',
  Na:'double-vertical-lines', K:'triangle-grid', Mg:'double-diagonal-lines', Ca:'vertical-brickwork', Al:'horizontal-brickwork'
};
const elements = Object.keys(approved);
const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(m => [m[1],m[2]]));
const tags = (s, role) => [...s.matchAll(/<[\w:-]+\b[^>]*>/g)].map(m => attrs(m[0])).filter(a => a['data-role'] === role);
const patterns = s => [...s.matchAll(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)].map(m => m[0]);
const outer = s => attrs(s.slice(0,s.indexOf('>')+1));
const body = s => s.slice(s.indexOf('>')+1,s.lastIndexOf('</pattern>'));
const canonical = s => s.replace(/\bid=["'][^"']*["']/g,'id="ID"');
const near = (actual, expected, label) => assert(Math.abs(Number(actual)-expected)<1e-8, `${label}: ${actual} != ${expected}`);
function transform(d, scale, angle) {
  const match = outer(d).patternTransform.match(/^\s*scale\(\s*([^ )]+)\s*\)\s+rotate\(\s*([^ )]+)\s*\)\s*$/);
  assert(match, 'outer scale then rotation'); near(match[1],scale,'scale'); near(match[2],angle,'angle');
}
function vectorOnly(svg) {
  assert.doesNotMatch(svg, /<(?:image|filter|foreignObject|script)\b|NaN|Infinity/);
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'unique SVG ids');
  for (const m of svg.matchAll(/url\(#([^)]*)\)/g)) assert(ids.includes(m[1]),'resolved SVG reference '+m[1]);
}
for (const [element,key] of Object.entries(approved)) {
  assert.equal(pattern(element),key,element+' approved mapping');
  for (const scale of [.5,1,3]) {
    const d=definition(element,'approved',scale), a=outer(d);
    assert.equal(a['data-pattern'],key); assert.equal(a['data-element'],element);
    assert.equal(a.patternUnits,'userSpaceOnUse'); assert.equal(a.patternContentUnits,'userSpaceOnUse');
    assert.equal(a.overflow,'hidden','clip repeating tile at its outer boundary');
    assert.doesNotMatch(d,/stroke-dasharray|<(?:image|filter)\b/,'approved recipes have no dashed lines or bitmap ink');
    if (element==='H') assert.doesNotMatch(body(d),/<(?:path|circle|rect|line|polyline|polygon|ellipse)\b/,'H has no ink geometry');
    else if (element!=='S') assert.doesNotMatch(body(d),/<(?:circle|ellipse)\b/,'no miniature hollow icons');
    assert.equal(body(d),body(definition(element,'other',1)),'scale changes outer transform, not recipe');
    vectorOnly(d);
  }
  const s=swatch(element); vectorOnly(s);
  assert.equal(canonical(patterns(s)[0]),canonical(definition(element,'swatch',1)),'real legend uses shared definition');
}
for (const scale of [.5,1,3]) {
  const d=definition('C','carbon',scale), a=outer(d);
  near(a.width,9,'carbon pitch');near(a.height,9,'carbon pitch');transform(d,scale,45);
  assert.doesNotMatch(body(d),/<rect\b|fill="#000000"/,'carbon is an open thin mesh, not solid black');
}
// Carbon uses the ordinary categorical-before-lighting ordering.
for (const renderMode of ['precise','fast']) for (const shadingMode of ['hatch','stipple','halftone']) {
  const svg=render({atoms:[{element:'C',position:[0,0,0]}],bonds:[]},{width:240,height:240,scale:35,elementTextures:true,shadingSize:.6,shadingMode,renderMode,labels:true});
  const start=svg.indexOf('<g data-role="surface-layer"');assert(start>=0);
  const layer=svg.slice(start), paint=layer.indexOf('data-role="element-texture"'), label=layer.indexOf('data-role="element-label"');
  assert(paint>=0&&label>paint,'labels remain above carbon mesh');
  const lighting=renderMode==='precise'?layer.indexOf('data-role="engraving"'):layer.indexOf('data-role="atom-texture-instance"');
  assert(lighting>paint&&lighting<label,'carbon mesh paints before illumination and labels');
}
const supported=Object.keys(api.covalentRadii);
assert.equal(supported.length,96);
assert.equal(new Set(supported.map(pattern)).size,96,'all supported keys remain distinct');
assert.equal(new Set(supported.map(e=>canonical(definition(e,'same')).replace(/ data-(?:element|pattern)="[^"]*"/g,''))).size,96,'actual recipes, not metadata, remain distinct');
assert.match(pattern('Xx'),/^fallback-/);

// Read only the pure geometry section of the approved study: never execute its file writers/rasterizer.
const studySource=fs.readFileSync('scripts/generate-grid-study.cjs','utf8');
const end=studySource.indexOf('const near ='); assert(end>0,'study pure-geometry boundary');
const study=vm.runInNewContext(studySource.slice(0,end)+'\n;grids.map(g=>({...g,svg:definition(g)}));',{require});
const gridIds={C:'carbon',Si:'square',B:'rect-h',Li:'rect-v',Se:'rhombus',K:'triangle',Ca:'brick-v',Al:'brick-h'};
const dimensions={C:[9,9,45],Si:[9,9,0],B:[Math.sqrt(243),Math.sqrt(27),0],Li:[Math.sqrt(27),Math.sqrt(243),0],Se:[Math.sqrt(486),Math.sqrt(54),0],K:[Math.sqrt(324/Math.sqrt(3)),Math.sqrt(324/Math.sqrt(3))*Math.sqrt(3),0],Ca:[Math.sqrt(243),2*Math.sqrt(27),90],Al:[Math.sqrt(243),2*Math.sqrt(27),0]};
// Accept different path formatting, segment order, and H/V shorthand. Compare actual ink unions instead.
function segments(svg) {
  const result=[];
  for(const match of svg.matchAll(/<path\b[^>]*>/g)) {
    const a=attrs(match[0]), t=a.d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
    let i=0,cmd,x=0,y=0,start;
    const number=()=>Number(t[i++]);
    while(i<t.length) {
      if(/^[A-Za-z]$/.test(t[i])) cmd=t[i++];
      const relative=cmd===cmd.toLowerCase(), c=cmd.toUpperCase(); let u=x,v=y;
      if(c==='Z') { [u,v]=start; cmd=null; }
      else if(c==='M'||c==='L') {u=number()+(relative?x:0);v=number()+(relative?y:0);}
      else if(c==='H') u=number()+(relative?x:0);
      else if(c==='V') v=number()+(relative?y:0);
      else throw Error('Unexpected grid path command '+cmd);
      if(c==='M') {start=[u,v];cmd=relative?'l':'L';}
      else result.push([x,y,u,v]);
      x=u;y=v;
    }
  }
  assert(result.length,'grid is made of continuous vector segments');return result;
}
function distance(x,y,[a,b,c,d]) {const dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a-t*dx,y-b-t*dy);}
for(const [element,id] of Object.entries(gridIds)) {
  const reference=study.find(g=>g.id===id), d=definition(element,'grid'), a=outer(d), [w,h,angle]=dimensions[element];
  near(a.width,w,element+' tile width');near(a.height,h,element+' tile height');
  near(w*h/(element==='K'?4:['Se','Ca','Al'].includes(element)?2:1),81,element+' face area');
  for(const scale of [.5,1,3]) transform(definition(element,'grid',scale),scale,angle);
  const widths=[...d.matchAll(/stroke-width="([^"]+)"/g)].map(m=>Number(m[1]));
  assert(widths.length); widths.forEach(width=>near(width,.55,element+' thinner stroke'));
  const actual=segments(d), expected=segments(reference.svg), radius=.55/2; // Geometry is approved-study geometry; line weight was subsequently reduced.
  for(let j=0;j<47;j++) for(let i=0;i<53;i++) {
    const x=(i+.317)*w/53,y=(j+.619)*h/47;
    const wanted=Math.min(...expected.map(s=>distance(x,y,s))),got=Math.min(...actual.map(s=>distance(x,y,s)));
    if(Math.abs(wanted-radius)<1e-7) continue;
    assert.equal(got<=radius,wanted<=radius,element+' approved grid ink at '+x+','+y);
  }
}
for(const [element,pitch,angle] of [['O',7,45],['N',7,0],['P',7,90],['I',10,0],['Na',10,90],['Mg',10,45]]) {
  const d=definition(element,'lines'); near(outer(d).width,pitch,'line pitch');near(outer(d).height,pitch,'line pitch');transform(d,1,angle);
  const lines=segments(d);const ys=[...new Set(lines.map(s=>s[1]))].sort((a,b)=>a-b);
  assert.deepEqual(ys,pitch===10?[3,6]:[3.5],element+' line positions');
  for(const [x,y,u,v] of lines) {near(x,0,'line start');near(u,pitch,'line end');near(y,v,'horizontal recipe line');}
  for(const m of d.matchAll(/stroke-width="([^"]+)"/g)) near(m[1],.55,'line stroke');
}
for(const [element,angle] of [['F',0],['Cl',90],['Br',45]]) {
  const d=definition(element,'wave'), a=outer(d);near(a.width,12,'wave pitch');near(a.height,12,'wave pitch');transform(d,1,angle);
  const paths=[...d.matchAll(/<path\b[^>]*>/g)].map(m=>attrs(m[0]));assert.equal(paths.length,1);
  const tokens=paths[0].d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g).map(t=>/^[A-Za-z]$/.test(t)?t:Number(t));
  assert.deepEqual(tokens,['M',0,6,'Q',3,0,6,6,'T',12,6],'approved continuous wave');
  const widths=[...d.matchAll(/stroke-width="([^"]+)"/g)];assert(widths.length);for(const m of widths) near(m[1],.55,'wave stroke (direct or inherited)');
}
const dots=definition('S','dots');near(outer(dots).width,6,'dot pitch');near(outer(dots).height,6,'dot pitch');
const dot=attrs(dots.match(/<circle\b[^>]*>/)[0]);near(dot.r,1.15,'dot radius');assert.notEqual(dot.fill,'none');

// Real renderer (not the UI render spy), across every approved element and scale.
const model={atoms:elements.map((element,i)=>({element,position:[(i%5)*3-6,Math.floor(i/5)*3-4.5,0]})),bonds:[[0,1],[1,2],[5,6]]};
const base={width:640,height:520,scale:30,yaw:0,pitch:0,shadingSize:0,outlineWidth:0,colorWash:false,labels:false};
for(const renderMode of ['precise','fast']) for(const quality of ['preview','export']) {
  const options={...base,renderMode,quality};const off=render(model,options);
  assert.equal(patterns(off).length,0);
  for(const scale of [.5,1,3]) {
    const on=render(model,{...options,elementTextures:true,elementTextureScale:scale});vectorOnly(on);
    const defs=patterns(on), paints=tags(on,'element-texture');assert.equal(defs.length,19);
    assert.deepEqual([...new Set(paints.map(a=>a['data-element']))].sort(),elements.slice().sort());
    for(const element of elements) {
      const d=defs.find(d=>outer(d)['data-element']===element);assert(d,element+' renderer definition');
      assert.equal(canonical(d),canonical(definition(element,'shared',scale)),'renderer/shared definition agreement');
      for(const paint of paints.filter(a=>a['data-element']===element)) assert.equal(paint.fill,'url(#'+outer(d).id+')');
    }
    assert.doesNotMatch(body(defs.find(d=>outer(d)['data-element']==='H')),/<(?:path|circle|line|rect|polygon|ellipse)\b/,'rendered H pattern deposits no texture ink');
    assert(paints.every(a=>Number(a['data-surface-id'])<19),'no bond acquires categorical ink');
    const unit=render(model,{...options,elementTextures:true,elementTextureScale:1});
    assert.deepEqual(tags(on,'surface-fill'),tags(unit,'surface-fill'),'texture scale cannot alter atom or bond geometry');
    assert(tags(on,'surface-fill').some(a=>a.fill==='#ffffff'),'white bond surfaces retained');
    if(renderMode==='precise') for(const match of on.matchAll(/<g data-role="surface-layer" data-surface-id="(\d+)">([\s\S]*?)<\/g>/g)) if(+match[1]>=19) {
      assert.equal(tags(match[2],'surface-fill')[0].fill,'#ffffff');assert.equal(tags(match[2],'element-texture').length,0);
    }
  }
}
// Turning textures on may select per-surface painting instead of a union fill;
// compare actual boundary scene inputs rather than requiring the same SVG grouping.
const boundaries=require('./boundaries.js');
function sceneInputs(elementTextures) {
  const original=boundaries.build;let captured;
  boundaries.build=(...args)=>{captured=args;return original(...args);};
  try {render(model,{...base,elementTextures});assert(captured);return {scene:captured[0],origin:captured[2]([0,0,0]),scale:captured[3]};}
  finally {boundaries.build=original;}
}
assert.deepEqual(sceneInputs(true),sceneInputs(false),'categorical paint cannot change atom radii, bond geometry or projection');
console.log('PASS approved 19 recipes, equal-face grid study parity, actual 96-recipe uniqueness, shared legend, precise/fast preview/export, scales, blank H and unchanged white-bond geometry');
