/* Run from repo root in Node or native qjs --std --script. Baseline is the
 * fixed, 48-tests-passing snapshot in build/perf-round2/baseline, NOT git HEAD. */
(function(){
'use strict';
var node=typeof process==='object'&&!!process.versions&&!!process.versions.node;
var engine=node?(process.execArgv.indexOf('--jitless')>=0?'node-jitless':'node-jit'):'quickjs-ng';
var fs=node?require('node:fs'):null,files=['dot-regions','boundaries','wash','dots','renderer'],globals=['MolDotRegions','MolBoundaries','MolWash','MolDots','MolEngraver'];
function load(prefix){if(node)return {api:require(prefix==='.'?'../renderer.js':'../'+prefix+'/renderer.js')};files.forEach(function(f){std.loadScript(prefix+'/'+f+'.js');});return {api:globalThis.MolEngraver,helpers:globals.map(function(g){return globalThis[g];})};}
// Keep this helper portable to native QuickJS as well as Node.
function comparable(svg,mode){
 if(mode!=='fast')return svg;
 var prefixes=svg.match(/fast-painter-[0-9a-f]+-[0-9a-f]+/g)||[];
 if(!prefixes.length||prefixes.some(function(p){return p!==prefixes[0];}))throw Error('Expected exactly one fast hash namespace');
 return svg.split(prefixes[0]).join('fast-painter-NAMESPACE');
}
var versions=[load('build/perf-round2/baseline'),load('.')];
function select(v){if(!node)globals.forEach(function(g,i){globalThis[g]=v.helpers[i];});}
function save(file,text){if(node)fs.writeFileSync(file,text);else{var f=std.open(file,'w');if(!f)throw Error('Cannot write '+file);try{f.puts(text);}finally{f.close();}}}
var report={engine:engine,hatchMode:'continuous',protocol:'Historical continuous-hatch compatibility, not the current layered default: baseline options unchanged; current bundle explicitly uses hatchMode=continuous. Independent fixed-baseline/current bundles in same process; 1 initial + 3 warmups each, 6 alternating timed pairs. Outputs compared outside render timer: precise byte-for-byte; fast exactly after validating/replacing only its single hash namespace and references. No geometry, sampling or tolerances changed.',rows:[]};
var cases=[{name:'phenol',mode:'precise'},{name:'c60',mode:'precise'},{name:'c60',mode:'fast'},{name:'c60',mode:'precise',elements:true},{name:'glucose',mode:'precise',labels:true},{name:'c60',mode:'precise',shading:'stipple'}];
cases.forEach(function(c){
 var options={width:800,height:700,scale:50,quality:'preview',renderMode:c.mode,shadingMode:c.shading||'hatch',castShadows:false,colorWash:false,labels:!!c.labels,elementTextures:!!c.elements};if(c.elements)options.shadingSize=0;
 var afterOptions=Object.assign({},options,{hatchMode:'continuous'});
 var id=c.name+'-'+c.mode+'-'+(c.elements?'elements':options.shadingMode)+(c.labels?'-labels':''),molecule=versions[0].api.examples[c.name],first=[],times=[[],[]],svg=['',''],reference;
 function run(side){select(versions[side]);var start=performance.now();svg[side]=versions[side].api.render(molecule,side?afterOptions:options);var ms=performance.now()-start;if(reference!==undefined&&comparable(svg[side],c.mode)!==comparable(reference,c.mode))throw Error('Output changed '+id+'/'+side);return ms;}
 first[0]=run(0);reference=svg[0];first[1]=run(1);for(var k=0;k<3;k++){run(0);run(1);}for(var j=0;j<6;j++)(j%2?[1,0]:[0,1]).forEach(function(side){times[side].push(run(side));});
 function summary(side){var a=times[side].slice().sort(function(x,y){return x-y;});return {firstMs:first[side],samplesMs:times[side],medianMs:(a[2]+a[3])/2,minMs:a[0],maxMs:a[5]};}
 var before=summary(0),after=summary(1);report.rows.push({id:id,options:options,afterOptions:afterOptions,before:before,after:after,speedup:before.medianMs/after.medianMs,byteIdentical:svg[0]===svg[1],comparison:c.mode==='fast'?'namespace-normalized':'byte-identical'});
 save('build/perf-round2/'+engine+'.json',JSON.stringify(report,null,2)+'\n');save('build/perf-round2/'+engine+'-'+id+'.svg',svg[1]);console.log(JSON.stringify({engine:engine,id:id,beforeMs:before.medianMs,afterMs:after.medianMs,speedup:before.medianMs/after.medianMs,byteIdentical:svg[0]===svg[1],comparison:c.mode==='fast'?'namespace-normalized':'byte-identical'}));
});
})();
