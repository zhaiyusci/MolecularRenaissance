'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),api=require('../renderer.js');
const dir='build/layered-hatching';fs.mkdirSync(dir,{recursive:true});
const cases=[['sphere','Sphere / default',{}],['ethanol','Ethanol / curved hatches',{}],['c60','C60 / dense geometry',{}],['glucose','Glucose / labels',{labels:true}],['phospholipid','DHPC / exposed rods',{}],['ethanol','Ethanol / shadows',{castShadows:true,lightAzimuth:1.1,lightElevation:.4}],['sphere','Sphere / constant width',{variableWidth:false}],['ethanol','Ethanol / single family',{crossHatch:false}],['sphere','Sphere / high contrast',{shadingContrast:2,shadingBrightness:-.1}]];
function scoped(svg,prefix){const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const id of ids)svg=svg.split('id="'+id+'"').join('id="'+prefix+id+'"').split('url(#'+id+')').join('url(#'+prefix+id+')').split('href="#'+id+'"').join('href="#'+prefix+id+'"').split('aria-labelledby="'+id+'"').join('aria-labelledby="'+prefix+id+'"');return svg;}
const cards=[];
for(const [i,[name,label,extra]] of cases.entries()){
 const options={width:640,height:520,scale:name==='phospholipid'?28:50,quality:'preview',...extra};
 const continuous=api.render(api.examples[name],{...options,hatchMode:'continuous'}),layered=api.render(api.examples[name],{...options,hatchMode:'layered'});
 assert(layered.includes('data-hatch-mode="layered"'),label+' must exercise experiment');
 fs.writeFileSync(`${dir}/${i}-${name}-continuous.svg`,continuous);fs.writeFileSync(`${dir}/${i}-${name}-layered.svg`,layered);
 cards.push(`<section id="case-${i}"><h2>${label}</h2><div class="pair"><figure><figcaption>Continuous / 连续排线 · ${continuous.length.toLocaleString()} chars</figcaption>${scoped(continuous,'c'+i+'-')}</figure><figure><figcaption>16 levels / 分级排线 · ${layered.length.toLocaleString()} chars</figcaption>${scoped(layered,'l'+i+'-')}</figure></div></section>`);
}
const page=body=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Layered hatching experiment</title><style>body{font:15px system-ui;margin:24px;background:#eee;color:#222}h1{font-size:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;background:white;border:1px solid #ccc}figcaption{padding:10px;border-bottom:1px solid #ddd}svg{display:block;width:100%;height:auto}section{max-width:1320px;margin:28px auto}h2{font-size:18px}</style><h1>固定骨架＋16级明暗裁剪 / Fixed skeleton + 16 tone clips</h1><p>Left: existing continuous widths. Right: experimental non-overlapping clipped tone bands. Same geometry, coordinates, view, light and scale; no canvas fitting. Quantized width and cutoff ends intentionally differ.</p>${body}</html>`;
fs.writeFileSync(`${dir}/comparison.html`,page(cards.join('')));
fs.writeFileSync(`${dir}/comparison-details.html`,page(cards.slice(4).join('')));
console.log('Wrote 9 side-by-side cases and 18 SVGs to '+dir+'/comparison.html');
