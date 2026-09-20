'use strict';
const assert=require('node:assert/strict'),r=require('./renderer.js');
const model={atoms:[{element:'O',position:[-1.5,0,0]},{element:'H',position:[1.5,0,0]}],bonds:[[0,1]]};
function geometry(svg){return svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,'').replace(/fast-painter-[0-9a-f]+-[0-9a-f]+/g,'fast-id').replace(/data-whole-labels="\d+"/g,'data-whole-labels="ignored"');}
let cases=0;
for(const renderMode of ['precise','fast'])for(const shadingMode of ['hatch','stipple','halftone'])for(const quality of ['preview','export']){
 const o={renderMode,shadingMode,quality,labels:true,colorWash:true,yaw:0,pitch:0};
 const on=r.render(model,o),off=r.render(model,{...o,labelHydrogens:false});
 assert(on.includes('>H</text>'));assert(!off.includes('>H</text>'));assert(off.includes('>O</text>'));
 assert.equal(geometry(on),geometry(off),'H switch only changes text, never atomic or bond geometry/texture');
 const hidden=r.render(model,{...o,labels:false,labelHydrogens:true});assert(!hidden.includes('data-role="element-label"'));cases++;
}
assert.throws(()=>r.render(model,{labelHydrogens:'false'}),/Invalid labelHydrogens/);
console.log(`Hydrogen labels passed: ${cases} renderer/texture/quality combinations; atoms and bonds unchanged.`);
