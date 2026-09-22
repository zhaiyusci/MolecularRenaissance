'use strict';
const assert=require('node:assert/strict'),{makeUI}=require('./scripts/ui-harness.cjs');
const api=require('./renderer.js'),before=JSON.stringify(api.examples);
function verifyStatic(ui,locale){
 const i=ui.context.MolI18n;assert.equal(i.getLocale(),locale);assert.equal(ui.document.documentElement.lang,locale);assert.equal(ui.document.title,i.t('static.brand'));
 for(const [a,target] of [['data-i18n',null],['data-i18n-title','title'],['data-i18n-aria-label','aria-label']])for(const n of ui.document.querySelectorAll('['+a+']')){
  const key=n.getAttribute(a);assert(Object.hasOwn(i.messages.en,key)&&Object.hasOwn(i.messages['zh-CN'],key),key);
  assert.equal(target?n.getAttribute(target):n.textContent,i.t(key),key);
 }
 const header=ui.document.querySelector('header').textContent;
 assert(!header.includes(locale==='en'?'分子文艺复兴':'Molecular Renaissance'),'no bilingual header');
 assert.equal(ui.elements.language.value,locale);
 assert.equal(i.t('static.quantizedShading'),locale==='en'?'16-level shading':'16级明暗');
 for(const [english,chinese] of [
  ['Invalid quantizeShading','16级明暗开关设置无效'],
  ['16-level shading switch requires precise rendering','16级明暗开关需要精确渲染'],
  ['Conflicting quantizeShading and hatchMode','16级明暗开关与排线模式冲突'],
  ['Invalid hatchMode','排线模式无效'],
  ['Layered hatching requires precise rendering','分级排线需要精确渲染']
 ])assert.equal(i.error(new Error(english)),locale==='en'?english:chinese);
 assert.deepEqual(ui.elements.language.querySelectorAll('option').map(n=>n.textContent),['English','简体中文'],'language names stay in their own languages');
 assert.equal(ui.elements.language.querySelectorAll('[data-i18n]').length,0);
 assert(ui.elements.language.parent.querySelector('svg'),'language entry uses a universal icon');
 if(locale==='en')assert(!/\p{Script=Han}/u.test(ui.document.body.textContent.replace('简体中文','')),'only the language selector uses an autonym in another language');
}
(async()=>{
 const ui=makeUI(),e=ui.elements;ui.flush();verifyStatic(ui,'en');
 assert.deepEqual(Object.keys(ui.context.MolI18n.messages.en).sort(),Object.keys(ui.context.MolI18n.messages['zh-CN']).sort());
 assert.equal(e['molecule-caption'].textContent,'Water');
 const root=e.preview.querySelector('svg'),n=ui.calls.length;
 e['scale'].value='87';e['scale'].listeners.input();ui.flush();
 ui.change('fast-overlay',true);ui.flush();ui.change('shading-enabled',false);ui.flush();ui.change('label-hydrogens',false);ui.flush();
 const count=ui.calls.length,options=JSON.stringify(ui.calls.at(-1).options);
 ui.locale('zh-CN');verifyStatic(ui,'zh-CN');assert.equal(ui.calls.length,count,'locale switch must not regenerate geometry');
 assert.equal(e.scale.value,'87');assert(e['fast-overlay'].checked);assert(!e['shading-enabled'].checked);assert(!e['label-hydrogens'].checked);
 assert.equal(e['molecule-caption'].textContent,'水');assert.equal(e.preview.querySelector('svg').querySelector('title').textContent,'水');
 e.download.click();assert.equal(ui.calls.at(-1).model.name,'水');assert.equal(ui.calls.at(-1).options.quality,'export');
 ui.locale('en');verifyStatic(ui,'en');e.download.click();assert.equal(ui.calls.at(-1).model.name,'Water');
 assert.equal(JSON.stringify({...ui.calls.at(-1).options,quality:'preview'}),options,'language changes preserve export parameters');
 assert.equal(ui.store['molplotter.locale'],'en');
 // Actual XYZ parser errors and pending reads are retranslated without resetting them.
 await ui.upload('bad.xyz','1\ncomment\nC NaN 0 0');ui.flush();assert.match(e['xyz-status'].textContent,/XYZ line 3/);
 ui.locale('zh-CN');assert.match(e['xyz-status'].textContent,/第 3 行/);assert(!e['xyz-status'].textContent.includes('line'));assert.equal(e['xyz-status'].attrs['data-error'],'true');
 let resolve;const pending=new Promise(r=>resolve=r),job=ui.upload('water.xyz',pending);
 assert(e.download.disabled);ui.locale('en');assert.match(e['xyz-status'].textContent,/Reading water.xyz/);assert(e.download.disabled);
 resolve('3\nwater\nO 0 0 0\nH .9572 0 0\nH -.239 .927 0');await job;ui.flush();
 assert.match(e['xyz-status'].textContent,/2 inferred bonds/);const selected=e.model.value;
 ui.locale('zh-CN');assert.equal(e.model.value,selected);assert.equal(e['molecule-caption'].textContent,'water.xyz');assert.match(e['xyz-status'].textContent,/2 条推断键/);
 e.download.click();assert.equal(ui.downloads.at(-1),'mol-water.svg');assert.equal(ui.calls.at(-1).model.bonds.length,2);
 // Unknown engine details are not pasted in the wrong language; persistent errors switch too.
 ui.setFailure(Error('INTERNAL ENGLISH DIAGNOSTIC'));e.download.click();assert(!e.error.textContent.includes('INTERNAL'));assert.match(e.error.textContent,/导出失败/);
 ui.locale('en');assert.match(e.error.textContent,/Export failed/);assert(!/\p{Script=Han}/u.test(e.error.textContent));
 ui.setFailure(null);e.download.click();ui.locale('zh-CN');assert(e.error.hidden);assert.equal(e.error.textContent,'');
 e.reset.click();ui.flush();assert.equal(ui.context.MolI18n.getLocale(),'zh-CN');assert(e['label-hydrogens'].checked);
 assert.equal(JSON.stringify(api.examples),before,'built-in model names are never mutated');
 // Browser preference, saved preference, unsupported locale and storage denial.
 for(const [opts,want] of [[{browserLanguage:'zh-TW'},'zh-CN'],[{browserLanguage:'fr-FR'},'en'],[{browserLanguage:'zh-CN',store:{'molplotter.locale':'en'}},'en'],[{store:{'molplotter.locale':'zh-CN'}},'zh-CN'],[{browserLanguage:'zh-CN',store:{'molplotter.locale':'invalid'}},'zh-CN'],[{browserLanguage:'zh-CN',storageThrows:true},'zh-CN']]){
  const x=makeUI(opts);x.flush();verifyStatic(x,want);x.locale('en');verifyStatic(x,'en');x.context.MolI18n.setLocale('bad');assert.equal(x.context.MolI18n.getLocale(),'en');
 }
 const absent=makeUI({missingEngine:true});assert.match(absent.elements.error.textContent,/renderer.js/);absent.locale('zh-CN');assert.match(absent.elements.error.textContent,/同一/);
 // No OS-language native file button is displayed; the translated button opens it.
 let picked=false;e['xyz-file'].click=()=>{picked=true;};e['xyz-choose'].click();assert(picked);assert(e['xyz-file'].attrs.class.includes('visually-hidden'));
 console.log('i18n passed: static/ARIA/title parity, single-language branding, persistence/fallback, dynamic errors, pending XYZ reads, unchanged state and localized SVG export.');
})().catch(e=>{console.error(e);process.exitCode=1;});
