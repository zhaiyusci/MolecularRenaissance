'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('./renderer.js'),boundaries=require('./boundaries.js');
const {render,elementTexturePattern:pattern,elementTextureDefinition:definition,elementTextureSwatch:swatch}=api;
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const tags=(svg,role)=>[...svg.matchAll(/<[\w:-]+\b[^>]*>/g)].map(m=>attrs(m[0])).filter(a=>a['data-role']===role);
// Compare recipe markup, not whole SVG: illumination may still change shading and fast namespaces.
const normalize=s=>s.replace(/\bid="[^"]*"/g,'id="ID"');
const definitions=svg=>[...svg.matchAll(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)].map(m=>m[0]).filter(s=>s.includes('data-role="element-pattern"')).map(normalize).sort();
const model={atoms:['H','C','N','O','P','S'].map((element,i)=>({element,position:[(i%3)*3,Math.floor(i/3)*3,0]})),bonds:[[0,1],[1,2]]};
const base={width:500,height:400,scale:30,shadingSize:0,outlineWidth:0,colorWash:false,labels:false};
function vectorOnly(svg){assert.doesNotMatch(svg,/<(?:image|filter|foreignObject|script)\b|(?:href|src)="(?:https?:|data:)|NaN|Infinity/);const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const m of svg.matchAll(/url\(#([^)]*)\)/g))assert(ids.includes(m[1]),'resolved pattern/clip reference');}
assert.equal(typeof pattern,'function');assert.equal(typeof definition,'function');assert.equal(typeof swatch,'function');
assert.deepEqual(['H','C','N','O','P','S'].map(pattern),['blank','crosshatch','horizontal-lines','diagonal-hatch','vertical-lines','dots']);
const elements=Object.keys(api.covalentRadii);assert.equal(elements.length,96,'H–Cm radius table');
assert.equal(new Set(elements.map(pattern)).size,elements.length,'all supported elements have distinct deterministic keys');
const recipes=elements.map(element=>{const d=definition(element,'recipe');assert.equal(d,definition(element,'recipe'));vectorOnly(d);const s=swatch(element);vectorOnly(s);assert(s.includes(definition(element,'mp-element-swatch-'+element)));assert.equal(tags(s,'element-texture')[0]['data-element'],element);return normalize(d).replace(/ data-element="[^"]*"| data-pattern="[^"]*"/g,'');});
assert.equal(new Set(recipes).size,elements.length,'distinct keys also produce distinct drawing recipes');
for(const scale of [.5,1,3])assert.match(definition('C','recipe',scale),new RegExp('scale\\('+scale+'\\)'));
assert.notEqual(definition('C','recipe',.5),definition('C','recipe',3));
assert.match(pattern('Xx'),/^fallback-/);assert.equal(swatch('Xx'),swatch('Xx'));
assert.throws(()=>render({atoms:[{element:'Xx',position:[0,0,0]}],bonds:[]},{elementTextures:true}),/No covalent radius/);
assert.match(render({atoms:[{element:'Xx',radius:.5,position:[0,0,0]}],bonds:[]},{...base,elementTextures:true}),/data-element="Xx"/);
// Script-like symbols must be safely rejected (the public helper accepts ASCII symbols only).
for(const bad of ['<script>alert(1)</script>','C" onload="alert(1)','C&N','',null,3])for(const helper of [pattern,x=>definition(x,'safe'),swatch])assert.throws(()=>helper(bad),/Invalid element texture/);
for(const bad of ['x" onload="bad','<script>','1bad'])assert.throws(()=>definition('C',bad),/Invalid/);
for(const element of ['<script>alert(1)</script>','C" onload="bad'])for(const renderMode of ['precise','fast'])assert.throws(()=>render({atoms:[{element,radius:.5,position:[0,0,0]}],bonds:[]},{...base,elementTextures:true,renderMode}),/Invalid/,'explicit radius does not permit injected SVG markup');
for(const bad of [null,'true',0,1,{},[]])assert.throws(()=>render(model,{...base,elementTextures:bad}),/Invalid/);
for(const bad of [null,'1',NaN,Infinity,-1,.49,3.01]){assert.throws(()=>render(model,{...base,elementTextureScale:bad}),/Invalid/);assert.throws(()=>definition('C','safe',bad),/Invalid/);}
for(const renderMode of ['precise','fast'])for(const quality of ['preview','export'])for(const shadingMode of ['hatch','stipple','halftone']){
 const options={...base,renderMode,quality,shadingMode};
 const off=render(model,options);assert.deepEqual(definitions(off),[]);assert.equal(tags(off,'element-texture').length,0);
 assert.equal(off,render(model,{...options,elementTextures:false}),'explicit false preserves default SVG');
 assert.equal(off,render(model,{...options,elementTextures:undefined,elementTextureScale:undefined}),'explicit undefined uses optional defaults');

 const on=render(model,{...options,elementTextures:true});vectorOnly(on);assert.equal(definitions(on).length,6);assert.equal(tags(on,'element-texture').length,6,'categorical patterns survive shadingSize:0');
 assert.deepEqual(definitions(on),definitions(render(model,{...options,elementTextures:true,elementTextureScale:1})));
 const lit={...options,elementTextures:true,shadingSize:.6};const reference=definitions(render(model,lit));
 for(const change of [{lightAzimuth:1.2,lightElevation:.7},{shadingBrightness:.4,shadingContrast:2},{textureScale:2},{shadowStrength:.8},...(renderMode==='precise'?[{castShadows:true,shadowStrength:.8},{lightType:'point',lightDistance:3,lightAttenuation:.5}]:[])]){
  const svg=render(model,{...lit,...change});vectorOnly(svg);assert.deepEqual(definitions(svg),reference,`${renderMode}/${quality}/${shadingMode}: recipes independent of lighting/shading`);
 }
 for(const scale of [.5,3])assert.notDeepEqual(definitions(render(model,{...options,elementTextures:true,elementTextureScale:scale})),definitions(on));
 for(const labelHydrogens of [true,false]){
  const svg=render(model,{...options,elementTextures:true,labels:true,labelHydrogens});assert.equal(tags(svg,'element-texture').length,6);assert.equal(tags(svg,'element-label').length,labelHydrogens?6:5);
 }
 // White bonds never acquire a categorical fill.
 assert(tags(on,'element-texture').every(a=>Number(a['data-surface-id'])<model.atoms.length));
 assert(tags(on,'surface-fill').some(a=>a.fill==='#ffffff'));
 if(renderMode==='precise')for(const m of on.matchAll(/<g data-role="surface-layer" data-surface-id="(\d+)">([\s\S]*?)<\/g>/g))if(+m[1]>=model.atoms.length){assert.equal(tags(m[2],'surface-fill')[0].fill,'#ffffff','bond fill stays white');assert.equal(tags(m[2],'element-texture').length,0,'no categorical texture on bonds');}
}
for(const renderMode of ['precise','fast']){
 const repeated={atoms:[{element:'C',position:[-2,0,0]},{element:'C',position:[2,0,0]}],bonds:[]};
 const svg=render(repeated,{...base,renderMode,elementTextures:true});assert.equal(definitions(svg).length,1,'one reusable definition per unique element');assert.equal(tags(svg,'element-texture').length,2);assert.equal(new Set(tags(svg,'element-texture').map(a=>a.fill)).size,1);
}
// Capture the same boundary build arguments as test-radii-scale without touching its fixture.
function capture(m,options,forceNull=false){const original=boundaries.build;let args,built;boundaries.build=(...a)=>{args=a;built=forceNull?null:original(...a);return built;};try{return {svg:render(m,{...base,...options}),args:()=>args,built:()=>built};}finally{boundaries.build=original;}}
for(const atomRadiusScale of [.5,1,1.5]){
 const before=capture(model,{atomRadiusScale}),after=capture(model,{atomRadiusScale,elementTextures:true});
 assert.deepEqual(after.args()[0],before.args()[0],'texture cannot change sphere radii or bond geometry');assert.equal(after.args()[3],30);assert.deepEqual(after.args()[2]([0,0,0]),[250,200]);
}
// Independent polygon parity and front-sphere ray oracle; never call production region membership/depth.
function loops(d){const tokens=d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[],out=[];let i=0,command,loop,p;const point=()=>[+tokens[i++],+tokens[i++]];while(i<tokens.length){if(/^[A-Za-z]$/.test(tokens[i]))command=tokens[i++];if(command==='Z'||command==='z'){p=loop[0];command=null;continue;}if(command==='M'){p=point();loop=[p];out.push(loop);command='L';}else if(command==='L'){p=point();loop.push(p);}else if(command==='C'){const a=p,b=point(),c=point(),end=point();for(let j=1;j<=64;j++){const t=j/64,u=1-t;loop.push([0,1].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*end[k]));}p=end;}else throw Error('Unsupported ownership path command '+command);}assert(out.length&&out.every(p=>p.length>=3),'closed polygonal/cubic ownership path');return out;}
function inside(polys,x,y){let odd=false;for(const p of polys)for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])odd=!odd;}return odd;}
const overlap={atoms:[{element:'C',position:[-.45,0,-.1],radius:1},{element:'O',position:[.45,0,.1],radius:.9}],bonds:[]};
for(const forceNull of [false,true])for(const quality of ['preview','export']){
 const c=capture(overlap,{elementTextures:true,quality,width:200,height:200,scale:30,yaw:0,pitch:0},forceNull),svg=c.svg,scene=c.args()[0],project=c.args()[2],origin=project([0,0,0]),fills=tags(svg,'element-texture');vectorOnly(svg);assert.equal(fills.length,2);
 const clips=new Map([...svg.matchAll(/<clipPath\b([^>]*)>([\s\S]*?)<\/clipPath>/g)].map(m=>[attrs(m[1]).id,[...m[2].matchAll(/<path\b[^>]*>/g)].map(p=>loops(attrs(p[0]).d))]));
 let geometry;
 if(forceNull){assert(svg.indexOf('data-role="element-texture-fallback"')<svg.indexOf('data-role="engraving"'),'categorical fallback paints before illumination');const metadata=tags(svg,'element-texture-fallback')[0];assert(metadata,'explicit sampled fallback metadata');assert.equal(+metadata['data-mask-step'],quality==='preview'?.5:.25);assert(+metadata['data-mask-samples']<=16000000);assert(+metadata['data-mask-tiles']<=4096);geometry=fills.map(a=>clips.get(a['clip-path'].match(/url\(#([^)]*)\)/)[1]));}
 else {assert.equal(tags(svg,'element-texture-fallback').length,0);const paths=c.built().surfacePaths(false);assert(paths,'certified paths available');geometry=fills.map(a=>{assert.equal(a.d,paths[+a['data-surface-id']],'paint uses exact certified visibility path');return [loops(a.d)];});}
 let checked=0;
 for(let y=64.37;y<136;y+=2.17)for(let x=55.21;x<145;x+=2.31){
  const depths=scene.map(s=>{const dx=(x-origin[0])/30-s.c[0],dy=(origin[1]-y)/30-s.c[1],q=s.r*s.r-dx*dx-dy*dy;return q>0?s.c[2]+Math.sqrt(q):-Infinity;});
  const winner=depths[0]>depths[1]?0:1;
  // Ignore an explicit 0.8 screen-unit tolerance near silhouettes and equality boundaries.
  const stable=[[-.8,0],[.8,0],[0,-.8],[0,.8]].every(([dx,dy])=>{const z=scene.map(s=>{const q=s.r*s.r-((x+dx-origin[0])/30-s.c[0])**2-((origin[1]-y-dy)/30-s.c[1])**2;return q>0?s.c[2]+Math.sqrt(q):-Infinity;});return z.some(Number.isFinite)&& (z[0]>z[1]?0:1)===winner;});
  if(!depths.some(Number.isFinite)||!stable)continue;
  for(let i=0;i<fills.length;i++)assert.equal(geometry[i].some(p=>inside(p,x,y)),+fills[i]['data-surface-id']===winner,`independent ray ownership fallback=${forceNull} ${quality} (${x},${y})`);checked++;
 }
 assert(checked>300,'dense independent ownership sampling');
}
// Fast mode must not enter global boundary discovery even while categorical paint is enabled.
const original=boundaries.build;boundaries.build=()=>{throw Error('global boundary query in fast mode');};try{for(const shadingMode of ['hatch','stipple','halftone'])assert(tags(render(model,{...base,renderMode:'fast',elementTextures:true,shadingMode}),'element-texture').length);}finally{boundaries.build=original;}
(async()=>{const esm=await import('./dist/molplotter.mjs'),browser=vm.createContext({});for(const name of ['dot-regions','boundaries','wash','dots','renderer'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),browser);for(const module of [esm,browser.MolEngraver])for(const element of ['H','C','O','N','S','P','F','Cl','Br','I','B','Si','Se','Li','Na','K','Mg','Ca','Al','Cm','Xx']){assert.equal(module.elementTexturePattern(element),pattern(element));assert.equal(module.elementTextureSwatch(element),swatch(element));assert.equal(module.elementTextureDefinition(element,'shared',1.5),definition(element,'shared',1.5));}console.log('PASS element texture helpers, validation, all render/quality/shading modes, invariant recipes, geometry, labels, certified ownership and forced bounded fallback');})().catch(e=>{console.error(e);process.exitCode=1;});
