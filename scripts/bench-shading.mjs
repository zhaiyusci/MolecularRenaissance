import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
const capture=process.argv.includes('--capture');
if(capture){mkdirSync('build/baselines',{recursive:true});copyFileSync('dist/molplotter.mjs','build/baselines/pre-shading.mjs');}
const {render,examples}=await import(capture?'../build/baselines/pre-shading.mjs':'../dist/molplotter.mjs');
const rows=[];
for(const model of ['sphere','ethanol','c60'])for(const castShadows of [false,true])for(const shadingMode of ['hatch','stipple']){
  const options={shadingMode,castShadows,colorWash:true,quality:'preview',textureScale:1};
  render(examples[model],options);
  const times=[];let svg='';
  for(let i=0;i<3;i++){const start=performance.now();svg=render(examples[model],options);times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);rows.push({model,castShadows,shadingMode,ms:+times[1].toFixed(2),bytes:svg.length});
}
console.table(rows);mkdirSync('benchmarks',{recursive:true});
writeFileSync('benchmarks/shading-'+(capture?'before':'after')+'.json',JSON.stringify({note:'Core SVG generation only; fixed scale 60, textureScale 1, preview, color wash; warmup + median of 3, no browser paint.',rows},null,2)+'\n');
