/* Node or native qjs --std --script; cwd must be the project root. */
(function(){
'use strict';
var node=typeof process==='object'&&!!process.versions&&!!process.versions.node,fs=node?require('node:fs'):null;
if(!node)['dot-regions','boundaries','wash','dots','renderer'].forEach(function(n){std.loadScript(n+'.js');});
var api=node?require('../renderer.js'):globalThis.MolEngraver,engine=node?'node-jit':'quickjs-ng';
var cases=[['sphere',false],['ethanol',false],['c60',false],['glucose',false],['phospholipid',false],['ethanol',true]],rows=[];
function save(path,text){if(node)fs.writeFileSync(path,text);else{var f=std.open(path,'w');if(!f)throw Error(path);f.puts(text);f.close();}}
cases.forEach(function(c){
 var opts={width:800,height:640,scale:50,quality:'preview',shadingMode:'hatch',castShadows:c[1],labels:c[0]==='glucose'},times=[[],[]],reference=['',''];
 function run(side){var o=Object.assign({},opts,{hatchMode:side?'layered':'continuous'}),start=performance.now(),svg=api.render(api.examples[c[0]],o),elapsed=performance.now()-start;
  if(reference[side]&&svg!==reference[side])throw Error('Nondeterministic '+c+'/'+side);reference[side]=svg;
  if(side&&svg.indexOf('data-hatch-mode="layered"')<0)throw Error('Fallback cannot count as a speedup '+c);return elapsed;}
 for(var w=0;w<2;w++){run(0);run(1);}for(var round=0;round<5;round++)(round%2?[1,0]:[0,1]).forEach(function(side){times[side].push(run(side));});
 function result(side){var sorted=times[side].slice().sort(function(a,b){return a-b;});return {samplesMs:times[side],medianMs:sorted[2],svgCharacters:reference[side].length};}
 var before=result(0),after=result(1),row={name:c[0],castShadows:c[1],options:opts,continuous:before,layered:after,speedup:before.medianMs/after.medianMs,approximateVisualOutput:true};rows.push(row);console.log(JSON.stringify({engine:engine,name:c[0],shadows:c[1],continuousMs:before.medianMs,layeredMs:after.medianMs,speedup:row.speedup}));
});
save('build/layered-hatching/'+engine+'.json',JSON.stringify({engine:engine,nodeVersion:node?process.versions.node:null,protocol:'2 warmups per mode, 5 alternating timed pairs, median render-only latency. Determinism and active layered route checked outside timing. Outputs intentionally visually approximate; not byte-identical. Does not measure browser paint.',rows:rows},null,2)+'\n');
})();
