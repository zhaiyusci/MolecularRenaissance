'use strict';
const assert=require('node:assert/strict'),api=require('./renderer.js');
const {makeUI}=require('./scripts/ui-harness.cjs');
const swatchCalls=[],blobs=[];
const ui=makeUI({configureContext(ctx){const actual=ctx.MolEngraver.elementTextureSwatch;assert.equal(actual,api.elementTextureSwatch,'mock exposes actual backend helper');ctx.MolEngraver.elementTextureSwatch=element=>{swatchCalls.push(element);return actual(element);};ctx.Blob=class{constructor(parts){blobs.push(parts.join(''));}};}});
const {elements:e,calls,flush}=ui;
const flushAll=()=>{while(ui.queue.length)flush();};
const input=(id,value)=>{e[id].value=value;e[id].listeners.input();flushAll();};
const check=(id,value)=>{ui.change(id,value);flushAll();};
function legend(){const node=e['element-texture-legend'];const expected=[...new Set(calls.at(-1).model.atoms.map(a=>a.element))].sort();assert.equal(node.hidden,false);const chips=node.children.filter(x=>typeof x!=='string');assert.equal(chips.length,expected.length);assert.deepEqual(chips.map(c=>c.children[1].textContent),expected,'symbol-only current model legend, unique and sorted');for(let i=0;i<chips.length;i++){const holder=chips[i].children[0];assert.equal(holder.innerHTML,api.elementTextureSwatch(expected[i]),'exact real backend SVG swatch, not a mocked circle');assert.equal(holder.querySelectorAll('svg').length,1);assert.equal(holder.querySelectorAll('pattern').length,1);assert.equal(holder.querySelector('[data-role="element-pattern"]').getAttribute('data-element'),expected[i]);assert.equal(holder.querySelectorAll('script').length,0);}return expected;}
function exportSnapshot(){const snapshot=calls.at(-1);e.download.click();assert.equal(calls.at(-1).options.quality,'export');assert.deepEqual(calls.at(-1).options,{...snapshot.options,quality:'export'});assert.equal(calls.at(-1).options.elementTextures,e['element-textures'].checked);assert.equal(calls.at(-1).options.elementTextureScale,Number(e['element-texture-scale'].value)/100);assert(blobs.at(-1).includes('<svg>'));}
(async()=>{
 assert(e['element-textures']);assert.equal(e['element-textures'].checked,false);assert.equal(e['element-texture-scale'].value,'100');assert.equal(e['element-texture-scale'].getAttribute('min'),'50');assert.equal(e['element-texture-scale'].getAttribute('max'),'300');
 flushAll();assert.equal(calls.at(-1).options.elementTextures,false);assert.equal(calls.at(-1).options.elementTextureScale,1);assert.equal(e['element-texture-legend'].hidden,true);assert.equal(e['element-texture-scale'].disabled,true);assert.equal(swatchCalls.length,0,'no helper calls while off');
 const wrapper=e['element-texture-title-controls'];assert(wrapper);const header=wrapper.parentElement;let bubbled=0;header.addEventListener('click',()=>bubbled++);wrapper.dispatchEvent({type:'click',bubbles:true});e['element-textures'].dispatchEvent({type:'click',bubbles:true});assert.equal(bubbled,0,'header wrapper and checkbox do not toggle accordion');
 check('element-textures',true);assert.equal(e['element-texture-scale'].disabled,false);assert.equal(calls.at(-1).options.elementTextures,true);legend();exportSnapshot();
 check('shading-enabled',false);assert.equal(calls.at(-1).options.shadingSize,0);assert.equal(calls.at(-1).options.elementTextures,true);assert.equal(e['element-textures'].disabled,false);legend();
 for(const [value,scale] of [['50',.5],['175',1.75],['300',3]]){input('element-texture-scale',value);assert.equal(calls.at(-1).options.elementTextureScale,scale);assert.equal(e['element-texture-scale-value'].textContent,scale.toFixed(2)+'×');legend();exportSnapshot();}
 const beforeLocale=swatchCalls.length;
 for(const locale of ['zh-CN','en']){ui.locale(locale);flushAll();legend();assert.equal(calls.at(-1).options.elementTextures,true);assert.equal(calls.at(-1).options.elementTextureScale,3);}
 assert.equal(swatchCalls.length,beforeLocale,'locale preserves symbol-only legend without regenerating identical recipes');
 for(const model of ['ethanol','sphere','water']){ui.change('model',model);flushAll();legend();assert.equal(calls.at(-1).options.elementTextureScale,3);}
 await ui.upload('salts.xyz','4\nfixture\nNa 0 0 0\nCl 3 0 0\nNa 0 3 0\nCl 3 3 0\n');flushAll();const imported=e.model.value;assert.deepEqual(legend(),['Cl','Na']);assert.equal(calls.at(-1).options.elementTextures,true);exportSnapshot();
 ui.change('model','ethanol');flushAll();legend();ui.change('model',imported);flushAll();assert.deepEqual(legend(),['Cl','Na']);
 ui.locale('zh-CN');flushAll();assert.deepEqual(legend(),['Cl','Na']);assert.equal(calls.at(-1).options.elementTextureScale,3);
 await ui.upload('invalid.xyz','2\nmissing atoms\n');flushAll();assert.deepEqual(legend(),['Cl','Na'],'failed import retains current model legend');
 // Imported halogens and newly assigned meshes must use the real shared recipes.
 const approvedImported={F:'horizontal-waves',Cl:'vertical-waves',Br:'diagonal-waves',B:'horizontal-rectangle-grid',Si:'square-grid',Se:'rhombus-grid',Li:'vertical-rectangle-grid',K:'triangle-grid',Ca:'vertical-brickwork',Al:'horizontal-brickwork'};
 const importedSymbols=Object.keys(approvedImported);
 await ui.upload('approved-textures.xyz',`${importedSymbols.length}\napproved categorical fixtures\n${importedSymbols.map((symbol,i)=>`${symbol} ${i*4} 0 0`).join('\n')}\n`);flushAll();
 assert.deepEqual(legend(),importedSymbols.slice().sort());
 for(const chip of e['element-texture-legend'].children.filter(x=>typeof x!=='string')){
  const symbol=chip.children[1].textContent,definition=chip.children[0].querySelector('[data-role="element-pattern"]');
  assert.equal(definition.getAttribute('data-pattern'),approvedImported[symbol],'import legend shows approved recipe, not stale atomic fallback');
 }
 exportSnapshot();ui.locale('en');flushAll();assert.deepEqual(legend(),importedSymbols.slice().sort());
 check('element-textures',false);const n=swatchCalls.length;ui.change('model','ethanol');flushAll();assert.equal(e['element-texture-legend'].hidden,true);assert.equal(swatchCalls.length,n);check('element-textures',true);assert.deepEqual(legend(),['C','H','O']);
 check('shading-enabled',true);
 for(const fast of [false,true]){check('fast-overlay',fast);for(const mode of ['hatch','stipple','halftone']){ui.change('shading-mode',mode);flushAll();assert.equal(calls.at(-1).options.renderMode,fast?'fast':'precise');assert.equal(calls.at(-1).options.elementTextures,true);exportSnapshot();
  ui.pointer('element-texture-scale','pointerdown');input('element-texture-scale','125');assert.equal(calls.at(-1).options.shadingSize,0);assert.equal(calls.at(-1).options.castShadows,false);assert.equal(calls.at(-1).options.elementTextures,true,'lightweight drag retains categorical patterns');assert.equal(calls.at(-1).options.elementTextureScale,1.25);assert.equal(e.download.disabled,true);const count=calls.length;e.download.click();assert.equal(calls.length,count);ui.pointer('window','pointerup');flushAll();assert.equal(calls.at(-1).options.elementTextures,true);assert.equal(calls.at(-1).options.elementTextureScale,1.25);legend();exportSnapshot();}}
 check('shading-enabled',false);ui.pointer('scale','pointerdown');flushAll();assert.equal(calls.at(-1).options.elementTextures,true);ui.pointer('window','pointerup');flushAll();assert.equal(calls.at(-1).options.shadingSize,0);legend();exportSnapshot();
 e.reset.click();flushAll();assert.equal(e['element-textures'].checked,false);assert.equal(e['element-texture-scale'].value,'100');assert.equal(e['element-texture-scale-value'].textContent,'1.00×');assert.equal(e['element-texture-legend'].hidden,true);assert.equal(calls.at(-1).options.elementTextures,false);assert.equal(calls.at(-1).options.elementTextureScale,1);exportSnapshot();
 console.log('PASS actual SVG legends, independent checkbox/header, scale/export values, locale/model/import retention, all-mode lightweight drag, reset');
})().catch(error=>{console.error(error);process.exitCode=1;});
