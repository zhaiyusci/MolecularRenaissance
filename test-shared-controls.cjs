'use strict';
const assert=require('node:assert/strict');
const {render,examples}=require('./renderer.js');
const base={shadingDensity:1,shadingSize:1,shadingContrast:1.2};
const engraving=s=>s.match(/<g data-role="engraving"[^>]*>([\s\S]*?)<\/g>/)[1];
for(const shadingMode of ['hatch','stipple','halftone']){
 const make=o=>render(examples.sphere,{shadingMode,...o});
 assert.equal(make(base),make({}),`${shadingMode}: shared defaults preserve artwork`);
 assert.equal(make({shadingDensity:2,shadingSize:.5}),make({density:48,dotSpacing:2.5,hatchWidth:.4,dotSize:.5}),`${shadingMode}: common density and size mapping`);
 const zero=make({...base,shadingSize:0});
 assert.ok(!zero.includes('<circle'));
 assert.ok(!engraving(zero).includes('fill="#161616"'));
 assert.ok(engraving(zero).includes('<path'));
 const blank=make({...base,shadingSize:0,outlineWidth:0,colorWash:true,labels:true});
 assert.equal(engraving(blank),'');assert.ok(blank.includes('mol-wash'));assert.ok(blank.includes('element-label'));
 for(const key of ['shadingDensity','shadingSize','shadingContrast']){
  const a=make({...base,[key]:key==='shadingDensity'?.5:key==='shadingSize'?.4:.5});
  const b=make({...base,[key]:key==='shadingDensity'?2:key==='shadingSize'?1.4:2.5});
  assert.notEqual(a,b,`${shadingMode}: ${key} changes output`);
  assert.equal(engraving(a).match(/<path[^>]*>/)[0],engraving(b).match(/<path[^>]*>/)[0],`${key} preserves sphere outline`);
 }
 for(const variableWidth of [true,false]){
  const a=make({...base,variableWidth,shadingContrast:.5}),b=make({...base,variableWidth,shadingContrast:2.5});
  assert.notEqual(a,b,`${shadingMode}: contrast works in either width mode`);
 }
 assert.equal(make({shadingDensity:1,shadingSize:1,density:60,dotSpacing:2,hatchWidth:0,dotSize:0}),make(base),'common controls override legacy fields');
 for(const extreme of [{shadingDensity:.4,shadingSize:0,shadingContrast:.5},{shadingDensity:2.5,shadingSize:1.5,shadingContrast:2.5}])assert.ok(!/NaN|Infinity|undefined/.test(make(extreme)));
 console.log('PASS shared controls: '+shadingMode);
}
for(const [key,min,max] of [['shadingDensity',.4,2.5],['shadingSize',0,1.5],['shadingContrast',.5,2.5]])for(const v of [NaN,Infinity,'1',null,min-.01,max+.01])assert.throws(()=>render(examples.sphere,{[key]:v}),/Invalid option/);
assert.equal(render(examples.sphere,{shadingContrast:undefined}),render(examples.sphere));
console.log('PASS shared control validation and undefined default');
