'use strict';
const assert=require('node:assert/strict');
const {makeUI,rotateRing}=require('./scripts/ui-harness.cjs');
const ui=makeUI({browserLanguage:'zh-CN'}),{html,elements,flush}=ui;
const calls={at:i=>ui.calls.at(i).options};
function check(id,value){elements[id].checked=value;elements[id].listeners.change();flush();}
flush();assert.equal(calls.at(-1).renderMode,'precise');
for(const id of ['point-light','light-distance','light-distance-value','light-attenuation','light-attenuation-value'])assert.equal(elements[id],undefined);
assert.equal(calls.at(-1).castShadows,true);
assert.equal(calls.at(-1).quantizeShading,true);
assert.equal(elements['quantized-shading'].checked,true,'16-level shading is the default');
assert.equal(elements['quantized-shading'].disabled,false);
for(const preference of [true,false]){
check('quantized-shading',preference);
for(const fast of [false,true,false]){
  check('fast-overlay',fast);
  for(const mode of ['hatch','stipple','halftone','hatch']){
    elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();flush();
    const expected=!fast?preference:undefined;
    assert.equal(calls.at(-1).quantizeShading,expected);
    assert.equal(elements['quantized-shading'].disabled,fast);
    assert.equal(elements['quantized-shading'].checked,preference,'style and fast switches retain either preference');
    elements.download.listeners.click();assert.equal(calls.at(-1).quality,'export');assert.equal(calls.at(-1).quantizeShading,expected);
    check('shading-enabled',false);
    assert(elements['quantized-shading'].disabled);assert.equal(elements['quantized-shading'].checked,preference);
    assert.equal(calls.at(-1).shadingSize,0);assert.equal(calls.at(-1).quantizeShading,expected);
    check('shading-enabled',true);
    assert.equal(elements['quantized-shading'].disabled,fast);
  }
  assert.equal(calls.at(-1).castShadows,!fast,'hatch preference does not change shadow restoration');
}
}
check('fast-overlay',true);elements.reset.listeners.click();flush();
assert.equal(elements['quantized-shading'].checked,true);assert.equal(elements['quantized-shading'].disabled,false);
assert.equal(calls.at(-1).quantizeShading,true);assert.equal(calls.at(-1).castShadows,true);
check('fast-overlay',true);
assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).castShadows,false);
assert(elements['cast-shadows'].disabled);
assert.match(elements['render-mode-status'].textContent,/快速覆盖.*已启用/);
for(const mode of ['hatch','stipple','halftone']){
  elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();flush();
  assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).shadingMode,mode);
  const engine=require('./renderer.js'),previous=calls.at(-1).orientation.slice();
  ui.key('z','ArrowRight',true);flush();
  const expected=rotateRing(previous,'z',Math.PI/12);
  calls.at(-1).orientation.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-12));
  assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).shadingMode,mode);
  assert(!Object.hasOwn(calls.at(-1),'shadingSize'),'discrete keyboard rotation does not leave lightweight shading active');
  const orientation=calls.at(-1).orientation.slice();
  elements.download.listeners.click();assert.equal(calls.at(-1).quality,'export');assert.equal(calls.at(-1).renderMode,'fast');assert.equal(calls.at(-1).castShadows,false);
  assert.deepEqual(Array.from(calls.at(-1).orientation),Array.from(orientation));
}
check('fast-overlay',false);
assert.equal(calls.at(-1).renderMode,'precise');assert.equal(calls.at(-1).castShadows,true);
assert(!elements['cast-shadows'].disabled);
check('cast-shadows',false);check('fast-overlay',true);check('fast-overlay',false);
assert.equal(calls.at(-1).castShadows,false,'fast mode restores an unchecked shadow preference too');
check('cast-shadows',true);
for(const fast of [false,true]){
  check('fast-overlay',fast);
  for(const mode of ['hatch','stipple','halftone']){
    elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();flush();
    const savedScale=elements['texture-scale'].value;
    check('shading-enabled',false);
    assert.equal(calls.at(-1).shadingSize,0);assert.equal(calls.at(-1).castShadows,false);
    assert(elements['shading-mode'].disabled&&elements['texture-scale'].disabled&&elements['cast-shadows'].disabled);
    assert(!elements['outline-width'].disabled,'outlines remain adjustable');
    elements.download.listeners.click();assert.equal(calls.at(-1).quality,'export');assert.equal(calls.at(-1).shadingSize,0);assert.equal(calls.at(-1).castShadows,false);
    const engine=require('./renderer.js'),svg=engine.render(engine.examples.sphere,{...calls.at(-1),labels:true,colorWash:true});
    assert(!svg.includes('data-role="dots"'));assert(svg.includes('data-role="surface-fill"'));assert(svg.includes('data-role="element-label"'));
    if(fast)assert(svg.includes('data-hatch-curves="0"'));
    check('shading-enabled',true);
    assert(!Object.hasOwn(calls.at(-1),'shadingSize'));assert.equal(calls.at(-1).castShadows,!fast);
    assert.equal(elements['texture-scale'].value,savedScale);assert.equal(elements['shading-mode'].value,mode);
  }
}
assert(!/<p id="(?:xyz-hint|fast-overlay-hint)"/.test(html));
assert.equal((html.match(/role="tooltip"/g)||[]).length,2);
assert(!html.includes('shading-hint'),'no unnecessary help icon on shading title');
const shadingTitle=ui.document.querySelector('[data-i18n="static.shading"]').parent;
assert(shadingTitle.querySelector('#shading-enabled'));
const shadingGroup=shadingTitle.parent;
for(const id of ['fast-overlay','shading-mode','light-azimuth','cast-shadows'])assert(shadingGroup.querySelector('#'+id));
assert(!shadingGroup.querySelector('#outline-width'));
assert(html.indexOf('id="outline-width"')<html.indexOf('<details'),'outline is outside all option tabs');
assert.equal((html.match(/<details\b/g)||[]).length,5);
for(const id of ['shading-title-controls','color-title-controls','element-texture-title-controls','labels-title-controls']){
  let stopped=false;elements[id].listeners.click({stopPropagation(){stopped=true;}});assert(stopped);
}
assert(ui.document.querySelector('[data-i18n="static.colors"]').parent.querySelector('#color-wash'));
assert(ui.document.querySelector('[data-i18n="static.labels"]').parent.querySelector('#labels'));
check('color-wash',false);assert(elements['color-scheme'].disabled);check('color-wash',true);assert(!elements['color-scheme'].disabled);
check('labels',true);assert(!elements['label-settings'].disabled);
check('label-hydrogens',false);assert.equal(calls.at(-1).labelHydrogens,false);
elements.download.listeners.click();assert.equal(calls.at(-1).labelHydrogens,false);assert.equal(calls.at(-1).quality,'export');
check('labels',false);assert(elements['label-settings'].disabled);
check('labels',true);assert.equal(calls.at(-1).labelHydrogens,false,'label master toggle retains H preference');
assert.match(html,/\.help:focus-within \.help-tooltip/);
check('shading-enabled',false);elements.reset.listeners.click();flush();
assert(elements['shading-enabled'].checked);assert(elements['label-hydrogens'].checked);
assert(!elements['fast-overlay'].checked);assert.equal(calls.at(-1).renderMode,'precise');assert.equal(calls.at(-1).castShadows,true);
assert(ui.calls.filter(call=>call.options.renderMode==='fast').every(call=>!Object.hasOwn(call.options,'quantizeShading')),'fast mode omits the switch');
assert(ui.calls.filter(call=>call.options.renderMode==='precise').every(call=>typeof call.options.quantizeShading==='boolean'),'all precise textures forward the switch');
for(const option of ['hatchMode','lightType','lightDistance','lightAttenuation'])assert(ui.calls.every(call=>!Object.hasOwn(call.options,option)));
console.log('UI checks passed: fast mode, shading master switch, all textures, parameter restoration, unshaded SVG export, compact help and reset.');
