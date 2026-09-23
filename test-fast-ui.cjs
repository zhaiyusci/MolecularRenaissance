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
assert.equal(elements['quantized-shading'],undefined,'obsolete quantization checkbox removed');
assert.equal(elements['shading-levels'].tagName,'SELECT');
assert.equal(elements['shading-levels'].value,'16','16 shading levels is the default');
assert.equal(calls.at(-1).shadingLevels,16);
assert.equal(elements['shading-levels'].disabled,false);
assert.deepEqual(elements['shading-levels'].querySelectorAll('option').map(n=>n.value),['4','8','16','32','64']);
for(const levels of [4,8,16,32,64]){
ui.change('shading-levels',String(levels));flush();
for(const fast of [false,true,false]){
  check('fast-overlay',fast);
  for(const mode of ['hatch','stipple','halftone','hatch']){
    elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();flush();
    assert.equal(calls.at(-1).quantizeShading,true);
    assert.equal(calls.at(-1).shadingLevels,levels);
    assert.equal(elements['shading-levels'].disabled,false);
    assert.equal(elements['shading-levels'].value,String(levels),'style and fast switches retain the level selection');
    const preview={...calls.at(-1)};
    elements.download.listeners.click();assert.deepEqual(calls.at(-1),{...preview,quality:'export'});
    check('shading-enabled',false);
    assert(elements['shading-levels'].disabled);assert.equal(elements['shading-levels'].value,String(levels));
    assert.equal(calls.at(-1).shadingSize,0);assert.equal(calls.at(-1).quantizeShading,true);assert.equal(calls.at(-1).shadingLevels,levels);
    check('shading-enabled',true);
    assert.equal(elements['shading-levels'].disabled,false);
  }
  assert.equal(calls.at(-1).castShadows,!fast,'level preference does not change shadow restoration');
}
}
check('fast-overlay',true);ui.change('shading-levels','8');flush();
assert.equal(calls.at(-1).shadingLevels,8,'level selection remains editable in fast mode');
check('shading-enabled',false);check('fast-overlay',false);check('fast-overlay',true);
assert(elements['shading-levels'].disabled);assert.equal(elements['shading-levels'].value,'8');
elements.reset.listeners.click();flush();
assert.equal(elements['shading-levels'].value,'16');assert.equal(elements['shading-levels'].disabled,false);
assert.equal(calls.at(-1).shadingLevels,16);
const resetPreview={...calls.at(-1)};elements.download.listeners.click();assert.deepEqual(calls.at(-1),{...resetPreview,quality:'export'});
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
assert(ui.calls.every(call=>call.options.quantizeShading===true),'all GUI frames and exports use quantization, including fast mode');
assert(ui.calls.every(call=>[4,8,16,32,64].includes(call.options.shadingLevels)),'all GUI frames forward numeric shading levels');
assert(ui.calls.every(call=>call.options.stippleFill==='bitmap'),'preview and export retain bitmap stippling');
for(const option of ['hatchMode','lightType','lightDistance','lightAttenuation'])assert(ui.calls.every(call=>!Object.hasOwn(call.options,option)));
console.log('UI checks passed: fast mode, shading master switch, all textures, parameter restoration, unshaded SVG export, compact help and reset.');
