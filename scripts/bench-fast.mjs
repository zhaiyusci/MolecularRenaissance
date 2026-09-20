import {mkdirSync,writeFileSync} from 'node:fs';
import {render,examples} from '../dist/molplotter.mjs';
const rows=[],options={quality:'preview',labels:true,labelSize:24,colorWash:true,lightType:'directional',castShadows:false};
for(const shadingMode of ['hatch','stipple','halftone'])for(const atomRadiusScale of [1,.65]){
  const o={...options,shadingMode,atomRadiusScale};
  for(let k=0;k<2;k++){render(examples.c60,{...o,renderMode:'precise'});render(examples.c60,{...o,renderMode:'fast'});}
  const times=[[],[]];let precise,fast;
  for(let k=0;k<5;k++)for(const side of k%2?[1,0]:[0,1]){
    const start=performance.now(),svg=render(examples.c60,{...o,renderMode:side?'fast':'precise'});times[side].push(performance.now()-start);if(side)fast=svg;else precise=svg;
  }
  const med=a=>+a.sort((a,b)=>a-b)[2].toFixed(3),attribute=name=>+(fast.match(new RegExp(`${name}="([^"]+)"`))?.[1]??0);
  rows.push({model:'c60',shadingMode,atomRadiusScale,preciseMs:med(times[0]),fastMs:med(times[1]),preciseBytes:Buffer.byteLength(precise),fastBytes:Buffer.byteLength(fast),bonds:attribute('data-bond-count'),visibleBonds:attribute('data-bond-visible-count'),containedBonds:attribute('data-bond-contained-count'),maskSamples:attribute('data-bond-mask-samples')});
}
mkdirSync('benchmarks',{recursive:true});writeFileSync('benchmarks/fast-renderer.json',JSON.stringify({options,note:'Same integrated renderer; actual C60 including all bonds; 2 warmups each, 5 alternating pairs, medians. Core SVG generation only, not browser paint. Radius .65 is an explicit exposed-bond stress fixture, not the default scientific radii.',rows},null,2)+'\n');console.table(rows);
