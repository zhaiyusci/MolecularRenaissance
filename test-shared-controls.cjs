'use strict';
const assert=require('node:assert/strict');
const {render,examples}=require('./renderer.js');
const {marks}=require('./test-style-coverage.cjs');
const base={shadingDensity:1,shadingSize:1,shadingContrast:1.2};
// Explicit physical scale bounds texture work without changing control ranges.
// The path-only marks oracle measures continuous ink; layered band/owner
// membership and style controls are independently checked in test-layered-hatching.
// marks() cannot read ink inside a raster tile, so the flat mark delivery is
// requested explicitly; the raster tone is verified at the tile level by test-stipple-bitmap.cjs.
const frame={hatchMode:'continuous',width:260,height:220,scale:28,quality:'preview',stippleFill:'marks'};
function groups(svg,role){
 const out=[];
 for(const start of svg.matchAll(new RegExp(`<g data-role="${role}"[^>]*>`,'g'))){
  let depth=0;
  for(const m of svg.slice(start.index).matchAll(/<\/?g\b[^>]*>/g)){
   depth+=m[0].startsWith('</')?-1:1;
   if(depth===0){out.push(svg.slice(start.index,start.index+m.index+m[0].length));break;}
  }
 }
 return out;
}
const engraving=s=>groups(s,'engraving').join('');
const texture=(s,mode)=>mode==='hatch'?engraving(s).replace(/<path stroke-width="[^"]+" d="[^"]+"\/>/,''):groups(s,'dots').join('');
for(const shadingMode of ['hatch','stipple','halftone']){
 const make=o=>render(examples.sphere,{...frame,shadingMode,...o});
 // Current style defaults are calibrated independently. Explicit shared 1x
 // controls instead retain their documented mapping to legacy numeric fields.
 assert.equal(make({shadingContrast:1.2}),make({}),`${shadingMode}: default contrast preserves artwork`);
 assert.equal(make(base),make({density:24,dotSpacing:5,hatchWidth:.8,dotSize:1,dotContrast:1.2}),`${shadingMode}: shared 1x mapping`);
 assert.equal(make({shadingDensity:2,shadingSize:.5}),make({density:48,dotSpacing:2.5,hatchWidth:.4,dotSize:.5}),`${shadingMode}: common density and size mapping`);
 const zero=make({...base,shadingSize:0});
 assert.equal(groups(zero,'dots').length,0,'zero size emits no actual dot layer or unused pattern definitions');
 assert.ok(!engraving(zero).includes('fill="#161616"'));
 assert.ok(engraving(zero).includes('<path'));
 const blank=make({...base,shadingSize:0,outlineWidth:0,colorWash:true,labels:true});
 assert.equal(marks(blank).length,0,'zero shading plus zero outline has no painted black marks');
 assert.equal(groups(blank,'dots').length,0);
 assert(!/<path\b/.test(engraving(blank)),'all engraving groups are empty');
 const layers=groups(blank,'surface-layer');assert(layers.length>0,'wash and labels use certified owner layers');
 assert(layers.some(g=>g.includes('data-role="surface-fill"')&&g.includes('fill="#909090"')),'opaque carbon wash survives');
 assert(layers.some(g=>g.includes('data-role="element-label"')),'label survives on its owner');
 for(const key of ['shadingDensity','shadingSize','shadingContrast']){
  const a=make({...base,[key]:key==='shadingDensity'?.5:key==='shadingSize'?.4:.5});
  const b=make({...base,[key]:key==='shadingDensity'?2:key==='shadingSize'?1.4:2.5});
  assert.notEqual(texture(a,shadingMode),texture(b,shadingMode),`${shadingMode}: ${key} changes actual texture, not only metadata`);
  assert.equal(engraving(a).match(/<path[^>]*>/)[0],engraving(b).match(/<path[^>]*>/)[0],`${key} preserves sphere outline`);
  assert(marks(texture(a,shadingMode)).length>0&&marks(texture(b,shadingMode)).length>0,'both settings paint real ink');
 }
 for(const variableWidth of [true,false]){
  const a=make({...base,variableWidth,shadingContrast:.5}),b=make({...base,variableWidth,shadingContrast:2.5});
  assert.notEqual(texture(a,shadingMode),texture(b,shadingMode),`${shadingMode}: contrast works in either width mode`);
 }
 assert.equal(make({shadingDensity:1,shadingSize:1,density:60,dotSpacing:2,hatchWidth:0,dotSize:0}),make(base),'common controls override legacy fields');
 for(const extreme of [{shadingDensity:.4,shadingSize:0,shadingContrast:.5},{shadingDensity:2.5,shadingSize:1.5,shadingContrast:2.5}])assert.ok(!/NaN|Infinity|undefined/.test(make(extreme)));
 console.log('PASS shared controls: '+shadingMode);
}
for(const [key,min,max] of [['shadingDensity',.4,2.5],['shadingSize',0,1.5],['shadingContrast',.5,2.5]])for(const v of [NaN,Infinity,'1',null,min-.01,max+.01])assert.throws(()=>render(examples.sphere,{...frame,[key]:v}),/Invalid option/);
assert.equal(render(examples.sphere,{...frame,shadingContrast:undefined}),render(examples.sphere,frame));
console.log('PASS shared control validation and undefined default');
