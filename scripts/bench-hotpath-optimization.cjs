/* Paired before/after benchmark, from repo root. Native Node or QuickJS-ng.
 * Baseline bundles: build/engine-baseline/{renderer,boundaries,wash,dots,dot-regions}.js
 * Outputs: build/engine-bench/optimization-<engine>.json
 * qjs --std --script scripts/bench-hotpath-optimization.cjs
 */
(function(){
'use strict';
var node=typeof process==='object'&&!!process.versions&&!!process.versions.node;
var engine=node?(process.execArgv.indexOf('--jitless')>=0?'node-jitless':'node-jit'):'quickjs-ng';
var fs=node?require('node:fs'):null;
var files=['dot-regions','boundaries','wash','dots','renderer'];
var globals=['MolDotRegions','MolBoundaries','MolWash','MolDots','MolEngraver'];
function load(prefix){
  if(node)return {api:require(prefix==='.'?'../renderer.js':'../'+prefix+'/renderer.js')};
  files.forEach(function(f){std.loadScript(prefix+'/'+f+'.js');});
  return {api:globalThis.MolEngraver,helpers:globals.map(function(g){return globalThis[g];})};
}
// Keep this helper portable to native QuickJS as well as Node.
function comparable(svg,mode){
 if(mode!=='fast')return svg;
 var prefixes=svg.match(/fast-painter-[0-9a-f]+-[0-9a-f]+/g)||[];
 if(!prefixes.length||prefixes.some(function(p){return p!==prefixes[0];}))throw Error('Expected exactly one fast hash namespace');
 return svg.split(prefixes[0]).join('fast-painter-NAMESPACE');
}
var versions=[load('build/engine-baseline'),load('.')];
function select(v){if(!node)globals.forEach(function(g,i){globalThis[g]=v.helpers[i];});}
function save(file,text){if(node)fs.writeFileSync(file,text);else{var f=std.open(file,'w');if(!f)throw Error('Cannot write '+file);try{f.puts(text);}finally{f.close();}}}
var report={engine:engine,hatchMode:'continuous',protocol:'Historical continuous-hatch compatibility, not the current layered default: baseline options unchanged; current bundle explicitly uses hatchMode=continuous. Same process, independent bundles. One initial render and 3 warmups per version, then 6 timed pairs with alternating order. Median = mean of two middle values. Timed render() only; dependency selection and equality check outside timer. Precise output compares byte-for-byte; fast output compares exactly after validating/replacing only its single hash namespace and references. No lowered tolerances or samples.',rows:[]};
var cases=[['phenol','precise',true,false],['c60','precise',true,false],['c60','fast',true,false],['c60','precise',false,true]];
cases.forEach(function(item){
 var name=item[0],mode=item[1],shading=item[2],textures=item[3];
 var options={width:800,height:700,scale:50,quality:'preview',renderMode:mode,shadingMode:'hatch',castShadows:false,colorWash:false,labels:false,elementTextures:textures};
 if(!shading)options.shadingSize=0;
 var afterOptions=Object.assign({},options,{hatchMode:'continuous'});
 var molecule=versions[0].api.examples[name],first=[],times=[[],[]],svg=['',''],reference;
 function run(side){select(versions[side]);var start=performance.now();svg[side]=versions[side].api.render(molecule,side?afterOptions:options);var ms=performance.now()-start;if(reference!==undefined&&comparable(svg[side],mode)!==comparable(reference,mode))throw Error('Output changed '+name+'/'+mode+'/'+side);return ms;}
 first[0]=run(0);reference=svg[0];first[1]=run(1);
 for(var k=0;k<3;k++){run(0);run(1);}
 for(var j=0;j<6;j++){var order=j%2?[1,0]:[0,1];order.forEach(function(side){times[side].push(run(side));});}
 function summarize(side){var a=times[side].slice().sort(function(x,y){return x-y;});return {firstMs:first[side],samplesMs:times[side],medianMs:(a[2]+a[3])/2,minMs:a[0],maxMs:a[5]};}
 var before=summarize(0),after=summarize(1),id=name+'-'+mode+(shading?'-hatch':'-elements');
 var row={id:id,options:options,afterOptions:afterOptions,before:before,after:after,speedup:before.medianMs/after.medianMs,byteIdentical:svg[0]===svg[1],comparison:mode==='fast'?'namespace-normalized':'byte-identical'};report.rows.push(row);
 save('build/engine-bench/optimization-'+engine+'.json',JSON.stringify(report,null,2)+'\n');
 save('build/engine-baseline/'+engine+'-'+id+'.svg',reference);
 save('build/engine-bench/optimized-'+engine+'-'+id+'.svg',svg[1]);
 console.log(JSON.stringify({engine:engine,id:id,beforeMs:before.medianMs,afterMs:after.medianMs,speedup:row.speedup,byteIdentical:svg[0]===svg[1],comparison:mode==='fast'?'namespace-normalized':'byte-identical'}));
});
}());
