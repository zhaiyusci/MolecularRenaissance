import {render,examples} from '../dist/molplotter.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const rows=[];
for(const model of ['sphere','ethanol','c60'])for(const castShadows of [false,true])for(const shadingMode of ['hatch','halftone']){
  const options={shadingMode,castShadows,colorWash:true,quality:'preview',textureScale:1};
  render(examples[model],options);
  const times=[];let svg='';
  for(let i=0;i<3;i++){const start=performance.now();svg=render(examples[model],options);times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);
  rows.push({model,castShadows,shadingMode,ms:+times[1].toFixed(2),bytes:svg.length});
}
console.table(rows);
if(process.argv[2]){mkdirSync('benchmarks',{recursive:true});writeFileSync(process.argv[2],JSON.stringify({note:'Core SVG generation only; same options, warmup + median of 3; excludes browser paint.',rows},null,2)+'\n');}
