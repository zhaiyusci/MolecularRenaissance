'use strict';
// Structural/geometric oracle; browser antialias/ink coverage is checked separately.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const modules=new Map();
function source(name){
 const file=path.resolve(__dirname,'src',name.replace(/\.(?:js|ts)$/,'')+'.ts');
 if(modules.has(file))return modules.get(file).exports;
 const module={exports:{}};modules.set(file,module);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(id=>id.startsWith('.')?source(path.relative(path.join(__dirname,'src'),path.resolve(path.dirname(file),id))):require(id),module,module.exports);
 return module.exports;
}
const {buildSurfacePatterns,halftoneRadiusRatio}=source('halftone');
const rect=(l,t,r,b)=>`M${l} ${t}H${r}V${b}H${l}Z`,full=rect(0,0,100,100);
function parse(svg){
 const root={tag:'root',a:{},children:[]},stack=[root],ids=new Map();
 for(const [text] of svg.matchAll(/<\/?[\w:-]+\b[^>]*>/g)){
  if(text.startsWith('</')){stack.pop();continue;}
  const tag=text.match(/^<([\w:-]+)/)[1],a={};for(const m of text.matchAll(/([\w:-]+)="([^"]*)"/g))a[m[1]]=m[2];
  const node={tag,a,children:[]};stack.at(-1).children.push(node);if(a.id){assert(!ids.has(a.id));ids.set(a.id,node);}if(!text.endsWith('/>'))stack.push(node);
 }
 assert.equal(stack.length,1);
 function polygon(node,x,y){
  if(!node.rings){
   const tokens=(node.a.d||'').match(/[MLHVZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)||[];
   assert(!/[CQASTcqast]/.test(node.a.d||''),'linear-path oracle must not silently approximate curves');
   let i=0,cmd='',px=0,py=0,ring=[];const rings=[];
   while(i<tokens.length){if(/^[MLHVZ]$/.test(tokens[i]))cmd=tokens[i++];if(cmd==='Z'){if(ring.length)rings.push(ring);ring=[];cmd='';continue;}if(cmd==='M'||cmd==='L'){if(cmd==='M'&&ring.length){rings.push(ring);ring=[];}px=+tokens[i++];py=+tokens[i++];ring.push([px,py]);cmd='L';}else if(cmd==='H'){px=+tokens[i++];ring.push([px,py]);}else if(cmd==='V'){py=+tokens[i++];ring.push([px,py]);}else throw Error('Unsupported path token '+cmd);}
   if(ring.length)rings.push(ring);node.rings=rings;
  }
  let inside=false;for(const ring of node.rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
 }
 const reference=value=>{const m=/^url\(#([^)]*)\)$/.exec(value||'');assert(m,'valid local clip');assert(ids.has(m[1]),'resolved clip');return ids.get(m[1]);};
 function shape(node,x,y){const a=node.a;if(a['clip-path']&&!shape(reference(a['clip-path']),x,y))return false;if(node.tag==='path')return polygon(node,x,y);if(node.tag==='rect')return x>=+a.x&&y>=+a.y&&x<=+a.x+(+a.width)&&y<=+a.y+(+a.height);if(node.tag==='circle')return (x-(+a.cx))**2+(y-(+a.cy))**2<(+a.r)**2;return node.children.some(n=>shape(n,x,y));}
 return {ids,levels(x,y){const levels=[];function walk(node){if(node.tag==='defs')return;if(node.a['clip-path']&&!shape(reference(node.a['clip-path']),x,y))return;if(node.a['data-tone-level']&&shape(node,x,y))levels.push(+node.a['data-tone-level']);for(const n of node.children)walk(n);}walk(root);return levels;}};
}
function paint(layers,n=4,emit){return buildSurfacePatterns({bounds:[0,0,100,100],pitch:4,silhouette:`<path d="${full}"/>`,layers,method:'test',shadingLevels:n},emit);}
// A linear tone ramp has one and only one nearest-quantized pattern at each point.
for(const n of [4,8,16,32,64]){
 const tones=Array.from({length:n},(_,i)=>rect((i+.5)/n*100,0,100,100));
 const svg=paint([{sourceId:0,clip:full,tones}],n),oracle=parse(svg);
 assert(!/<image\b|<mask\b|<filter\b|opacity=/.test(svg),'keep editable opaque vector patterns');
 for(let i=0;i<997;i++){const x=(i+.317)/997*100,expected=Math.round(x/100*n);assert.deepEqual(oracle.levels(x,47.13),expected?[expected]:[],`exclusive ramp N${n} x${x}`);}
 assert(svg.includes('-next-outside'),'explicit inverse contour clips');
 const emitted=[];const defs=paint([{sourceId:0,clip:full,tones}],n,(id,body)=>emitted.push({id,body}));assert.equal(emitted.length,1);assert.equal(emitted[0].id,0);
 const emittedOracle=parse(defs+emitted[0].body);for(const x of [3.13,29.11,54.57,98.19])assert.deepEqual(emittedOracle.levels(x,43.7),oracle.levels(x,43.7),'per-owner and combined output agree');
 // Radius calibration uses disk UNION area and is independent of band delivery.
 for(let k=1;k<=n;k++){const c=k/n,r=halftoneRadiusRatio(c),area=r<=.5?Math.PI*r*r:Math.PI*r*r-4*(r*r*Math.acos(.5/r)-.5*Math.sqrt(r*r-.25));assert(Math.abs(area-c)<1e-7,`union coverage ${n}/${k}`);}
}
// Identical contours leave just their highest nonempty level; zero stays paper.
assert.deepEqual(parse(paint([{clip:full,tones:[full,full,'','']}])).levels(50,50),[2]);
assert.equal(paint([{clip:full,tones:['','','','']}]),'');
// A nonnested next-contour overhang cannot generate lower-band ink outside Pi.
const overhang=parse(paint([{clip:full,tones:[rect(10,10,50,90),rect(30,10,70,90),'','']}])) ;
assert.deepEqual(overhang.levels(20,40),[1]);assert.deepEqual(overhang.levels(40,40),[2]);assert.deepEqual(overhang.levels(60,40),[2]);assert.deepEqual(overhang.levels(80,40),[]);
// Evenodd holes survive both the positive contour and its finite complement.
const annulus=rect(10,10,90,90)+rect(35,35,65,65),holes=parse(paint([{clip:full,tones:[full,annulus,'','']}])) ;
assert.deepEqual(holes.levels(20,20),[2]);assert.deepEqual(holes.levels(50,50),[1]);assert.deepEqual(holes.levels(5,50),[1]);
// Shadow clips replace normal paint. Empty shadow tones must not expose normal ink.
for(const dark of [true,false]){
 const layer={sourceId:0,clip:full,tones:[full,full,'',''],shadow:{sourceId:0,clip:annulus,tones:dark?[full,full,full,'']:['','','','']}};
 const oracle=parse(paint([layer]));assert.deepEqual(oracle.levels(20,20),dark?[3]:[]);assert.deepEqual(oracle.levels(50,50),[2]);assert.deepEqual(oracle.levels(5,50),[2]);
 const emitted=[];const defs=paint([layer],4,(id,body)=>emitted.push(body));assert.deepEqual(parse(defs+emitted.join('')).levels(20,20),dark?[3]:[]);
}
// Exercise the actual sampled scalar-field fallback through the distributed engine.
const {buildDots}=require('./dots.js'),{depthAt,render}=require('./renderer.js');
const sphere={kind:'sphere',c:[0,0,0],r:1};
for(const n of [4,8,16,32,64])for(const calibrated of [false,true]){
 const svg=buildDots([sphere],depthAt,p=>[40+30*p[0],40-30*p[1]],30,(_n,p)=>-p[0],{shadingMode:'halftone',dotSpacing:5,dotSize:1,dotContrast:calibrated?1.2:1,width:80,height:80,quality:'preview',shadingLevels:n,quantizeShading:true},null,calibrated?(_s,_n,lit)=>(1-lit)/2:undefined);
 const oracle=parse(svg);
 for(let i=0;i<149;i++){const x=15+(i+.271)/149*50,c=(1+(x-40)/30)/2,expected=Math.round(c*n);assert.deepEqual(oracle.levels(x,40.17),expected?[expected]:[],`sampled scalar fallback ${n}/${x}`);}
}
// Both top-level modes actually route halftone through the exclusive-band painter.
const model={atoms:[{element:'C',position:[0,0,0],radius:1}],bonds:[]};
for(const renderMode of ['precise','fast'])for(const n of [4,64]){
 const svg=render(model,{width:220,height:220,scale:60,renderMode,shadingMode:'halftone',shadingLevels:n,quantizeShading:true,castShadows:false});assert(svg.includes('-next-outside'));assert(svg.includes(`data-tone-levels="${n}"`));
}
// Historical exception strips balanced texture groups only, never following art.
const {assertHalftonePaintMigration}=require('./test-fixtures/halftone-parity.cjs');
const historical='<svg><g data-role="dots"><defs><pattern id="p"><g><circle r="2"/></g></pattern></defs><g><g><rect width="5"/></g></g></g><path data-role="outline" d="M0 0L5 5"/></svg>';
const migrated=historical.replace('<rect width="5"/>','<g><rect width="6"/></g>');
assertHalftonePaintMigration(migrated,historical,'balanced texture-only exception');
assert.throws(()=>assertHalftonePaintMigration(migrated.replace('L5 5','L6 6'),historical,'outside geometry must fail'),/non-texture SVG/);
assert.throws(()=>assertHalftonePaintMigration(migrated.replace('r="2"','r="3"'),historical,'palette mutation must fail'),/pattern coverage/);
console.log('PASS halftone exclusive bands: five palettes, union-area radii, holes, overhangs, shadow replacement, per-owner emission, sampled scalar fallback, both renderer modes and strict historical exception');
