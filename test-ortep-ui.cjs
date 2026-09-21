'use strict';
const assert=require('node:assert/strict'),api=require('./renderer.js');
const {makeUI}=require('./scripts/ui-harness.cjs');
const downloads=[];
const ui=makeUI({configureContext(ctx){
 const tracked=ctx.MolEngraver.render;
 ctx.MolEngraver.render=(model,options)=>{tracked(model,options);return api.render(model,options);};
 ctx.Blob=class{constructor(parts){downloads.push(parts.join(''));}};
}});
const e=ui.elements;
const flush=()=>{while(ui.queue.length)ui.flush();};
const change=(id,value)=>{ui.change(id,value);flush();};
const palette=()=>ui.calls.at(-1).options.colorScheme;
(async()=>{
 flush();assert.equal(palette(),'jmol');
 const option=e['color-scheme'].querySelector('[value="ortep"]');assert(option);
 change('shading-enabled',false);change('model','glycine');change('color-scheme','ortep');
 assert.equal(palette(),'ortep');
 for(const color of ['#007fff','#db70db','#ff0000'])assert(e.preview.innerHTML.includes(color));
 for(const [locale,label] of [['zh-CN','ORTEP · 随附配置'],['en','ORTEP · Shipped configuration']]){
  ui.locale(locale);flush();assert.equal(option.textContent,label);assert.equal(e['color-scheme'].value,'ortep');assert.equal(palette(),'ortep');
 }
 for(const fast of [false,true]){
  change('fast-overlay',fast);change('element-textures',true);
  assert(e.preview.innerHTML.includes('data-role="element-texture"'));
  assert(e.preview.innerHTML.includes('#007fff'));
  e.download.click();assert.equal(palette(),'ortep');assert.equal(ui.calls.at(-1).options.quality,'export');
  assert(downloads.at(-1).includes('#007fff'));assert(downloads.at(-1).includes('#db70db'));
 }
 change('color-wash',false);assert.equal(palette(),'ortep');assert.equal(e['color-scheme'].disabled,true);
 assert(!e.preview.innerHTML.includes('#007fff'));e.download.click();assert(!downloads.at(-1).includes('#007fff'));
 change('color-wash',true);assert(e.preview.innerHTML.includes('#007fff'));
 await ui.upload('salt.xyz','2\nSalt\nNa 0 0 0\nCl 3 0 0\n');flush();
 assert.equal(palette(),'ortep');assert(e.preview.innerHTML.includes('#70db93'));assert(e.preview.innerHTML.includes('#ffff00'));
 ui.locale('zh-CN');flush();assert.equal(palette(),'ortep');
 e.reset.click();flush();assert.equal(palette(),'jmol');assert.equal(e['color-scheme'].value,'jmol');
 console.log('PASS ORTEP localized option, real preview/export in both modes, patterns, color toggle, import and reset');
})().catch(error=>{console.error(error);process.exitCode=1;});
