import {mkdirSync,writeFileSync} from 'node:fs';
import {load} from './load-painter.mjs';
import {painterCases} from './painter-cases.mjs';
const {renderPainter,planPainter}=await load('painter-experiment.js');
const {render,examples}=await load('renderer.js');
const options={width:1000,height:1000,scale:60,yaw:0,pitch:0,labels:true,labelSize:24,colorWash:true,quality:'preview',shadingMode:'hatch',castShadows:false};
const rows=[];
for(const {name,model} of painterCases(examples)){
  for(let k=0;k<2;k++){render(model,options);renderPainter(model,options,{reuseHatches:false});renderPainter(model,options);}
  const oldTimes=[],plainTimes=[],newTimes=[],planTimes=[];let old='',plain,trial;
  for(let k=0;k<5;k++){
    const order=[k%3,(k+1)%3,(k+2)%3];if(k%2)order.reverse();
    for(const side of order){
      const start=performance.now();
      if(side===2){trial=renderPainter(model,options);newTimes.push(performance.now()-start);}
      else if(side===1){plain=renderPainter(model,options,{reuseHatches:false});plainTimes.push(performance.now()-start);}
      else{old=render(model,options);oldTimes.push(performance.now()-start);}
    }
    const start=performance.now();planPainter(model,options);planTimes.push(performance.now()-start);
  }
  const median=a=>+a.sort((a,b)=>a-b)[2].toFixed(3);
  rows.push({name,route:trial.route,reason:trial.reason,beforeMs:median(oldTimes),overpaintOnlyMs:median(plainTimes),afterMs:median(newTimes),planningMs:median(planTimes),beforeBytes:old.length,overpaintOnlyBytes:plain.svg.length,afterBytes:trial.svg.length,spheres:trial.sphereCount,templates:trial.hatchTemplates??null,labels:trial.wholeLabels,pairs:trial.testedPairs,pairDepthSamples:trial.depthSamples,boundaryBuilds:trial.boundaryBuilds});
}
mkdirSync('benchmarks',{recursive:true});
writeFileSync('benchmarks/painter-experiment.json',JSON.stringify({baselineCommit:'b79d28d',options,note:'Core SVG generation only. Same canonical compiled module graph; 2 warmups each and 5 rotating-order triples: baseline, overpainting without hatch reuse, overpainting with reuse. Planning measured separately and included in experimental render time. No browser paint measurement. Bondless C60 is explicitly a different fixture, not original C60.',rows},null,2)+'\n');
console.table(rows);
