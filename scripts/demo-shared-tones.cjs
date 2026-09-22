'use strict';
const fs=require('node:fs'),path=require('node:path'),api=require('../renderer.js');
const out='build/shared-tones';fs.mkdirSync(out,{recursive:true});
const cases=[['sphere-hatch','sphere',{shadingMode:'hatch',scale:95}],['sphere-halftone','sphere',{shadingMode:'halftone',scale:95}],['ethanol-halftone-shadow','ethanol',{shadingMode:'halftone',castShadows:true,labels:true,scale:55}]];
const sections=cases.map(([id,name,extra])=>{
 const images=[true,false].map(quantizeShading=>{
  const file=id+(quantizeShading?'-16':'-continuous')+'.svg';
  fs.writeFileSync(path.join(out,file),api.render(api.examples[name],{width:460,height:340,quality:'export',...extra,quantizeShading}));
  return `<figure><figcaption>${quantizeShading?'16级明暗／16 levels':'连续线宽或半径／continuous'}</figcaption><img src="${file}" width="460" height="340"></figure>`;
 });return `<section><h2>${id}</h2><div>${images.join('')}</div></section>`;
});
fs.writeFileSync(path.join(out,'comparison.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>共用16级明暗开关</title><style>body{font:16px system-ui;margin:24px;background:#f3f2ed;color:#222}section{margin:24px 0}section>div{display:flex;gap:16px}figure{margin:0;background:white;padding:12px}figcaption{padding-bottom:8px}img{display:block;max-width:100%;height:auto}</style><h1>共用16级明暗开关</h1><p>固定相同几何、光照和参数；仅切换 quantizeShading。关闭时保留完整纹理，以连续线宽或连续半径表达明暗；边界处理和量化差异会改变局部外观，并非逐像素等价。</p>'+sections.join('')+'</html>');
console.log('Created build/shared-tones/comparison.html and six independent SVGs');
