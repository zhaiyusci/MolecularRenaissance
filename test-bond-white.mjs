import assert from 'node:assert/strict';
import {render} from './dist/molplotter.mjs';
const model={atoms:[{element:'C',position:[-1.5,0,0],radius:.45},{element:'O',position:[1.5,0,0],radius:.45}],bonds:[[0,1]]};
let cases=0;
for(const renderMode of ['precise','fast'])for(const quality of ['preview','export'])for(const shadingMode of ['hatch','stipple','halftone'])for(const colorScheme of ['jmol','rasmol','pymol','greenCarbon','cyanCarbon','magentaCarbon']){
  const svg=render(model,{renderMode,quality,shadingMode,colorScheme,colorWash:true,labels:true,castShadows:false});
  const fill=renderMode==='fast'
    ?svg.match(/<g data-role="bond-layer"[^>]*data-mask-empty="false"[^>]*><g data-role="surface-fill" fill="([^"]+)"/)
    :svg.match(/<g data-role="surface-layer" data-surface-id="2"><path data-role="surface-fill" fill="([^"]+)"/);
  assert(fill,`${renderMode}/${quality}/${shadingMode}/${colorScheme}: exposed bond must be present`);
  assert.equal(fill[1],'#ffffff','bond base remains opaque white independently of element palette');cases++;
}
console.log(`White bond regression passed: ${cases} renderer/quality/texture/palette combinations.`);
