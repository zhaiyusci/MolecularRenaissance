import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
const capture=process.argv.includes('--capture'),paired=process.argv.includes('--paired');
if(capture&&paired)throw Error('Capture before editing; paired comparisons must not overwrite the baseline.');
if(capture){mkdirSync('build/baselines',{recursive:true});copyFileSync('dist/molplotter.mjs','build/baselines/pre-regions.mjs');}
const {render,examples}=await import(capture?'../build/baselines/pre-regions.mjs':'../dist/molplotter.mjs');
const before=paired?await import('../build/baselines/pre-regions.mjs'):null;
const rows=[];
for(const model of ['sphere','ethanol','c60'])for(const castShadows of [false,true])for(const shadingMode of ['hatch','stipple']){
  const options={shadingMode,castShadows,colorWash:true,quality:'preview',textureScale:1};
  const afterOptions={...options,hatchMode:'continuous'},currentOptions=capture?options:afterOptions;
  if(before){
    const engines=[before.render,render],models=[before.examples[model],examples[model]],times=[[],[]],bytes=[];
    for(let k=0;k<2;k++)for(let side=0;side<2;side++)engines[side](models[side],side?afterOptions:options);
    for(let k=0;k<5;k++)for(const side of (k%2?[1,0]:[0,1])){
      const start=performance.now(),svg=engines[side](models[side],side?afterOptions:options);times[side].push(performance.now()-start);bytes[side]=svg.length;
    }
    times.forEach(t=>t.sort((a,b)=>a-b));
    rows.push({model,castShadows,shadingMode,beforeMs:+times[0][2].toFixed(2),afterMs:+times[1][2].toFixed(2),beforeBytes:bytes[0],afterBytes:bytes[1]});continue;
  }
  render(examples[model],currentOptions);
  const times=[];let svg='';
  for(let i=0;i<3;i++){const start=performance.now();svg=render(examples[model],currentOptions);times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);rows.push({model,castShadows,shadingMode,ms:+times[1].toFixed(2),bytes:svg.length});
}
console.table(rows);mkdirSync('benchmarks',{recursive:true});
writeFileSync('benchmarks/regions-'+(paired?'paired':capture?'before':'after')+'.json',JSON.stringify({hatchMode:capture?'captured-bundle-default':'continuous',compatibility:capture?'Baseline capture retains original options and the captured bundle default; use a historical continuous-default bundle for historical comparisons.':'Historical continuous-hatch compatibility, not the current layered default: baseline options unchanged; current bundle explicitly uses hatchMode=continuous.',note:paired?'Core SVG only, no browser paint. Same process, two warmups each; 5 alternating old/new pairs per model/settings, medians. Scale 60, textureScale 1, preview, color wash.':'Core SVG generation only; fixed scale 60, textureScale 1, preview, color wash; warmup + median of 3, no browser paint.',rows},null,2)+'\n');
