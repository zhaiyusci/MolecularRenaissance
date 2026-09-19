'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {render,examples,depthAt,engravingWidth}=require('./renderer.js');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('sphere front depth and miss',()=>{
 const s={kind:'sphere',c:[0,0,2],r:1};
 assert.equal(depthAt(s,0,0),3);assert.equal(depthAt(s,2,0),-Infinity);assert.equal(depthAt(s,1,0),2);
});
check('transverse cylinder intersection',()=>{
 const c={kind:'cylinder',a:[-1,0,0],u:[1,0,0],length:2,r:.2};
 assert.ok(Math.abs(depthAt(c,0,0)-.2)<1e-10);assert.equal(depthAt(c,2,0),-Infinity);
});
check('camera-parallel cylinder caps',()=>{
 const c={kind:'cylinder',a:[0,0,-1],u:[0,0,1],length:2,r:.2};
 assert.equal(depthAt(c,0,0),1);assert.equal(depthAt(c,1,0),-Infinity);
});
check('all scenes and end-on views render finite paths',()=>{
 for(const m of Object.values(examples))for(const yaw of [0,Math.PI/2,Math.PI]){
  const svg=render(m,{yaw});assert.ok(svg.includes('<path'));assert.ok(!/NaN|Infinity|undefined/.test(svg));
 }
});
check('deterministic output and rotation',()=>{
 const a=render(examples.ethanol);assert.equal(a,render(examples.ethanol));assert.notEqual(a,render(examples.ethanol,{yaw:1}));
});
check('cross hatching adds strokes',()=>{
 const count=s=>(s.match(/<path /g)||[]).length;
 assert.ok(count(render(examples.sphere))>count(render(examples.sphere,{crossHatch:false})));
});
check('metadata escaped',()=>{
 const svg=render({...examples.sphere,name:'<script>&"'});assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));
});
check('invalid geometry rejected',()=>{
 assert.throws(()=>render({atoms:[],bonds:[]}));assert.throws(()=>render(examples.sphere,{yaw:NaN}));
 assert.throws(()=>render({...examples.sphere,bonds:[[0,1]]}));
});
check('fully hidden rear sphere contributes no geometry',()=>{
 const front={element:'C',position:[0,0,1]},back={element:'H',position:[0,0,-1]};
 const svg=render({name:'test',atoms:[front,back],bonds:[]},{yaw:0,pitch:0});
 const solo=render({name:'test',atoms:[front],bonds:[]},{yaw:0,pitch:0});
 assert.equal(svg,solo);
});
check('light azimuth and elevation change shading but not silhouette',()=>{
 const a=render(examples.sphere,{lightAzimuth:-1,lightElevation:.5});
 const b=render(examples.sphere,{lightAzimuth:1,lightElevation:.5});
 const c=render(examples.sphere,{lightAzimuth:-1,lightElevation:-.5});
 assert.notEqual(a,b);assert.notEqual(a,c);
 assert.equal(a.match(/<path[^>]+/)[0],b.match(/<path[^>]+/)[0]);
 assert.equal(a.match(/<path[^>]+/)[0],c.match(/<path[^>]+/)[0]);
});
check('extreme light directions remain finite',()=>{
 for(const lightAzimuth of [-Math.PI,0,Math.PI])for(const lightElevation of [-Math.PI/2,0,Math.PI/2]){
  const s=render(examples.pair,{lightAzimuth,lightElevation});
  assert.ok(s.includes('<path'));assert.ok(!/NaN|Infinity|undefined/.test(s));
 }
 assert.throws(()=>render(examples.sphere,{lightAzimuth:NaN}));
 assert.throws(()=>render(examples.sphere,{lightElevation:Infinity}));
});
check('point light distance changes local shading only in point mode',()=>{
 const close=render(examples.ethanol,{lightType:'point',lightDistance:1.2});
 const far=render(examples.ethanol,{lightType:'point',lightDistance:12});
 assert.notEqual(close,far);
 assert.equal(close.match(/<path[^>]+/)[0],far.match(/<path[^>]+/)[0]);
 assert.equal(render(examples.sphere,{lightDistance:1.2}),render(examples.sphere,{lightDistance:12}));
 assert.throws(()=>render(examples.sphere,{lightType:'invalid'}));
 for(const lightDistance of [0,1,NaN,Infinity])assert.throws(()=>render(examples.sphere,{lightType:'point',lightDistance}));
});
check('point illumination converges to directional light at long distance',()=>{
 const opts={variableWidth:false,optimizePaths:false,lightAzimuth:.6,lightElevation:.4};
 const count=s=>(s.match(/L/g)||[]).length;
 const a=count(render(examples.sphere,opts));
 const b=count(render(examples.sphere,{...opts,lightType:'point',lightDistance:1e8}));
 assert.ok(Math.abs(a-b)<=2);
});
check('engraving width is smoothly darker thicker and scales with base',()=>{
 let previous=Infinity;
 for(let lit=-1;lit<=1;lit+=.05){
  const w=engravingWidth(.8,lit);assert.ok(w>0&&w<=previous);previous=w;
  assert.equal(engravingWidth(1.6,lit),2*w);
 }
 assert.ok(engravingWidth(.8,-.8)>2*engravingWidth(.8,.8));
});
check('baseline variable line geometry forms finite closed tapered ribbons',()=>{
 // Inspect the original sampled geometry here; test-optimize checks the fitted
 // export against it, including both ribbon sides and every tapered endpoint.
 const svg=render(examples.sphere,{optimizePaths:false}),flat=render(examples.sphere,{variableWidth:false,optimizePaths:false});
 const ribbons=[...svg.matchAll(/<path fill="#161616" stroke="none" d="([^"]+)"/g)];
 assert.ok(ribbons.length>10);assert.ok(!flat.includes('stroke="none"'));
 // Opposite ribbon boundaries coincide at the tips but enclose nonzero width.
 for(const [,d] of ribbons){
  assert.ok(d.endsWith('Z'));assert.ok(!/NaN|Infinity/.test(d));
  const pts=[...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m=>[+m[1],+m[2]]);
  assert.deepEqual(pts[0],pts.at(-1));
  const half=pts.length/2;
  assert.deepEqual(pts[half-1],pts[half]);
  assert.ok(pts.slice(1,half-1).some((p,i)=>Math.hypot(p[0]-pts.at(-i-2)[0],p[1]-pts.at(-i-2)[1])>.01));
 }
 assert.equal(svg.match(/<path[^>]+/)[0],flat.match(/<path[^>]+/)[0]);
});
check('point light extremes and both line modes are finite',()=>{
 for(const lightAzimuth of [-Math.PI,0,Math.PI])for(const lightElevation of [-Math.PI/2,0,Math.PI/2])for(const variableWidth of [false,true]){
  const s=render(examples.pair,{lightType:'point',lightDistance:1.2,lightAzimuth,lightElevation,variableWidth});
  assert.ok(s.includes('<path'));assert.ok(!/NaN|Infinity|undefined/.test(s));
 }
});
check('UI light controls convert angles, update and reset',()=>{
 const vm=require('node:vm');
 const html=fs.readFileSync('index.html','utf8'),elements={};
 for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
  const tag=match[0];elements[match[1]]={value:(tag.match(/\bvalue="([^"]*)"/)||[])[1]||'',checked:/\bchecked\b/.test(tag),disabled:/\bdisabled\b/.test(tag),textContent:'',listeners:{},addEventListener(e,f){this.listeners[e]=f;},appendChild(o){if(!this.value)this.value=o.value;}};
 }
 for(const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  const options=[...match[2].matchAll(/<option\b[^>]*>/g)].map(m=>m[0]);
   const selected=options.find(tag=>/\bselected\b/.test(tag))||options[0];
   if(selected)elements[match[1]].value=selected.match(/\bvalue="([^"]+)"/)[1];
 }
 elements.preview.querySelector=()=>({hasAttribute:()=>true,setAttribute(){}});
 let queued,opts;
 vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
  document:{getElementById:id=>elements[id],createElement:()=>({})},
  window:{addEventListener(){},MolEngraver:{examples,render(m,o){opts=o;return '<svg></svg>';}}},
  requestAnimationFrame:f=>{queued=f;return 1;},performance:{now:()=>0},
  XMLSerializer:class{serializeToString(){return '<svg></svg>';}}
 });
 queued();assert.ok(Math.abs(opts.lightAzimuth-(-29*Math.PI/180))<1e-12);
  assert.equal(elements['color-mode'].value,'wash');assert.equal(opts.colorMode,'wash');
  assert.equal(elements['color-mode'].disabled,false);
  const colorModeOptions=html.match(/<select\b[^>]*id="color-mode"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.match(colorModeOptions,/<option value="wash" selected>/);
  assert.match(colorModeOptions,/<option value="ink">/);
 elements['light-azimuth'].value='90';elements['light-elevation'].value='-45';
 elements['light-azimuth'].listeners.input();queued();
 assert.equal(opts.lightAzimuth,Math.PI/2);assert.equal(opts.lightElevation,-Math.PI/4);
 assert.equal(elements['light-azimuth-value'].textContent,'90°');
 assert.equal(opts.lightType,'directional');assert.equal(opts.variableWidth,true);
 assert.equal(elements['light-distance'].disabled,true);assert.equal(elements['light-distance-value'].textContent,'∞');
 elements['point-light'].checked=true;elements['point-light'].listeners.change();queued();
 assert.equal(opts.lightType,'point');assert.equal(elements['light-distance'].disabled,false);
 elements['light-distance'].value='1.5';elements['light-distance'].listeners.input();queued();
 assert.equal(opts.lightDistance,1.5);assert.equal(elements['light-distance-value'].textContent,'1.5 R');
 elements['variable-width'].checked=false;elements['variable-width'].listeners.change();queued();
 assert.equal(opts.variableWidth,false);
 assert.equal(elements['label-settings'].disabled,true);
 elements.labels.checked=true;elements.labels.listeners.change();queued();
 assert.equal(elements['label-settings'].disabled,false);
 for(const [id,value] of [['label-size','36'],['label-font','Arial, sans-serif'],['label-color','#112233'],['label-stroke-width','0'],['label-stroke-color','#abcdef']]){
  elements[id].value=value;elements[id].listeners.input();queued();
 }
 elements['label-bold'].checked=true;elements['label-bold'].listeners.change();queued();
 elements['label-italic'].checked=false;elements['label-italic'].listeners.change();queued();
 assert.equal(opts.labelSize,36);assert.equal(opts.labelFont,'Arial, sans-serif');
 assert.equal(opts.labelColor,'#112233');assert.equal(opts.labelStrokeWidth,0);assert.equal(opts.labelStrokeColor,'#abcdef');
 assert.equal(opts.labelBold,true);assert.equal(opts.labelItalic,false);
 assert.equal(elements['label-stroke-color'].disabled,true);
 assert.equal(elements['label-size-value'].textContent,'36');
 elements['label-font'].value=' ';elements['label-font'].listeners.input();queued();
 assert.equal(opts.labelFont,"Georgia, 'Times New Roman', serif");
 assert.equal(opts.colorWash,true);assert.equal(opts.washStrength,.65);assert.equal(opts.labelMatchFill,true);
 elements['color-wash'].checked=false;elements['color-wash'].listeners.change();queued();
 assert.equal(opts.colorWash,false);assert.equal(opts.colorMode,'wash');
  const colorIds=['color-mode','wash-strength','color-saturation'];
  for(const id of colorIds)assert.equal(elements[id].disabled,true);
  elements['color-wash'].checked=true;elements['color-wash'].listeners.change();queued();
  for(const mode of ['ink','wash','ink']){
   elements['color-mode'].value=mode;elements['color-mode'].listeners.change();queued();
   assert.equal(opts.colorMode,mode);assert.equal(opts.colorWash,true);
   for(const id of colorIds)assert.equal(elements[id].disabled,false);
  }
  elements['color-wash'].checked=false;elements['color-wash'].listeners.change();queued();
  assert.equal(opts.colorWash,false);assert.equal(opts.colorMode,'ink');
  assert.equal(elements['color-mode'].value,'ink');
  for(const id of colorIds)assert.equal(elements[id].disabled,true);
 elements['color-wash'].checked=true;elements['color-wash'].listeners.change();queued();
 assert.equal(opts.colorMode,'ink');assert.equal(elements['color-mode'].value,'ink');
  for(const id of colorIds)assert.equal(elements[id].disabled,false);
  elements['wash-strength'].value='40';elements['wash-strength'].listeners.input();queued();
 assert.equal(opts.washStrength,.4);assert.equal(elements['wash-strength-value'].textContent,'40%');
 elements['label-stroke-width'].value='4';elements['label-stroke-width'].listeners.input();queued();
 assert.equal(elements['label-stroke-color'].disabled,true);
 elements['label-match-fill'].checked=false;elements['label-match-fill'].listeners.change();queued();
 assert.equal(opts.labelMatchFill,false);assert.equal(elements['label-stroke-color'].disabled,false);
 for(const [id,value] of [['shading-size','0'],['outline-width','1.2'],['color-saturation','250']]){
  elements[id].value=value;elements[id].listeners.input();queued();
 }
 assert.equal(opts.shadingSize,0);assert.equal(opts.outlineWidth,1.2);assert.equal(opts.colorSaturation,2.5);
 elements['outline-width'].value='0';elements['outline-width'].listeners.input();queued();assert.equal(opts.outlineWidth,0);
 elements['color-wash'].checked=false;elements['color-wash'].listeners.change();queued();
 for(const id of colorIds)assert.equal(elements[id].disabled,true);
  assert.equal(opts.colorMode,'ink');assert.equal(elements['color-mode'].value,'ink');
  assert.deepEqual(colorIds.map(id=>elements[id].value),['ink','40','250']);
 assert.equal(opts.shadingMode,'hatch');
 for(const id of ['dot-spacing','dot-size','dot-contrast','density','line-width'])assert.equal(elements[id],undefined);
 const sharedIds=['shading-density','shading-size','shading-contrast'];
 for(const [id,min,max,step,value] of [['shading-density','40','250','5','100'],['shading-size','0','150','5','100'],['shading-contrast','0.5','2.5','0.1','1.2']]){
  const tag=html.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'))[0];
  for(const [attr,expected] of Object.entries({min,max,step,value}))assert.ok(tag.includes(attr+'="'+expected+'"'));
 }
 for(const [id,value] of [['shading-density','175'],['shading-size','65'],['shading-contrast','2']]){elements[id].value=value;elements[id].listeners.input();queued();}
 for(const mode of ['stipple','halftone','hatch']){
  elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();queued();
  assert.equal(opts.shadingMode,mode);
  for(const id of ['cross-hatch','variable-width'])assert.equal(elements[id].disabled,mode!=='hatch');
  for(const id of sharedIds)assert.equal(elements[id].disabled,false);
  assert.deepEqual(sharedIds.map(id=>elements[id].value),['175','65','2']);
  assert.equal(opts.shadingDensity,1.75);assert.equal(opts.shadingSize,.65);assert.equal(opts.shadingContrast,2);
  assert.equal(elements['shading-density-value'].textContent,'175%');
  assert.equal(elements['shading-size-value'].textContent,'65%');
  assert.equal(elements['shading-contrast-value'].textContent,'2.0');
  for(const key of ['density','hatchWidth','dotSpacing','dotSize','dotContrast'])assert.ok(!Object.hasOwn(opts,key));
  assert.equal(elements['outline-width'].disabled,false);assert.equal(opts.outlineWidth,0);
  elements['shading-size'].value='0';elements['shading-size'].listeners.input();queued();
  assert.equal(opts.shadingSize,0);assert.equal(elements['shading-size-value'].textContent,'0%');
  elements['shading-size'].value='65';elements['shading-size'].listeners.input();queued();
 }
 elements.reset.listeners.click();queued();
  assert.equal(opts.colorMode,'wash');assert.equal(elements['color-mode'].value,'wash');
  for(const id of colorIds)assert.equal(elements[id].disabled,false);
 assert.equal(opts.shadingMode,'hatch');assert.equal(opts.shadingDensity,1);assert.equal(opts.shadingSize,1);assert.equal(opts.shadingContrast,1.2);
 assert.deepEqual(sharedIds.map(id=>elements[id].value),['100','100','1.2']);
 assert.deepEqual(sharedIds.map(id=>elements[id+'-value'].textContent),['100%','100%','1.2']);
 for(const id of [...sharedIds,'cross-hatch','variable-width'])assert.equal(elements[id].disabled,false);
 assert.equal(opts.outlineWidth,.8);assert.equal(opts.colorSaturation,1);
 assert.equal(opts.colorWash,true);assert.equal(opts.washStrength,.65);assert.equal(opts.labelMatchFill,true);
 assert.equal(opts.labels,false);assert.equal(opts.labelSize,17);assert.equal(opts.labelStrokeWidth,4);
 assert.equal(opts.labelColor,'#161616');assert.equal(opts.labelStrokeColor,'#ffffff');
 assert.equal(opts.labelBold,false);assert.equal(opts.labelItalic,true);
 assert.equal(elements['label-settings'].disabled,true);
 assert.equal(opts.lightType,'directional');assert.equal(opts.lightDistance,3);assert.equal(opts.variableWidth,true);
 assert.equal(elements['light-distance'].disabled,true);
 assert.equal(elements['light-azimuth'].value,'-29');assert.equal(elements['light-elevation'].value,'32');
});
check('element label styles export without affecting plate titles',()=>{
 const svg=render(examples.water,{labels:true,labelSize:32,labelStrokeWidth:7,labelStrokeColor:'#ffcc00',labelColor:'#112233',labelFont:'Arial, sans-serif',labelBold:true,labelItalic:false});
 const tags=[...svg.matchAll(/<text data-role="element-label"[^>]*>/g)].map(m=>m[0]);
 assert.equal(tags.length,3);
 for(const tag of tags)for(const attr of ['font-size="32"','stroke-width="7"','stroke="#ffcc00"','fill="#112233"','font-family="Arial, sans-serif"','font-weight="700"','font-style="normal"','paint-order="stroke fill"'])assert.ok(tag.includes(attr),attr);
 assert.ok(svg.includes('font-size="19"'));
 const plain=render(examples.sphere,{labels:true,labelStrokeWidth:0});
 assert.ok(plain.match(/<text data-role="element-label"[^>]*>/)[0].includes('stroke="none"'));
 assert.ok(!render(examples.water,{labels:false}).includes('data-role="element-label"'));
});
check('label style validation and attribute escaping',()=>{
 for(const opts of [{labelSize:NaN},{labelSize:0},{labelSize:97},{labelStrokeWidth:-1},{labelStrokeWidth:Infinity},{labelStrokeWidth:17},{labelColor:'red'},{labelStrokeColor:'url(https://example.com)'},{labelFont:''}])assert.throws(()=>render(examples.sphere,opts));
 const svg=render(examples.sphere,{labels:true,labelFont:'" onload="bad<>&'});
 assert.ok(svg.includes('&quot; onload=&quot;bad&lt;&gt;&amp;'));assert.ok(!svg.includes(' onload="'));
});
check('color wash preserves all engraving and matches label halos',()=>{
 const {elementColor}=require('./renderer.js');
 const mono=render(examples.ethanol),color=render(examples.ethanol,{colorWash:true});
 const lines=s=>s.match(/<g data-role="engraving"[\s\S]*?<\/g>/)[0];
 assert.equal(lines(mono),lines(color));assert.ok(color.includes('class="mol-wash"'));
 assert.ok(!mono.includes('class="mol-wash"'));assert.ok(!color.includes('<image'));
 assert.equal(render(examples.ethanol,{colorWash:true,washStrength:0}),mono);
 const svg=render(examples.sphere,{colorWash:true,labels:true,labelMatchFill:true});
 assert.ok(svg.match(/<text data-role="element-label"[^>]*>/)[0].includes('stroke="'+elementColor('C')+'"'));
 assert.equal(elementColor('H'),'#ffffff');assert.equal(elementColor('O',0),'#ffffff');
 for(const washStrength of [-1,2,NaN])assert.throws(()=>render(examples.sphere,{washStrength}));
});
check('outline and hatch widths are independent and zero removes paths',()=>{
 const ink=s=>s.match(/<g data-role="engraving"[\s\S]*?<\/g>/)[0];
 for(const variableWidth of [true,false]){
  const outline=ink(render(examples.sphere,{hatchWidth:0,variableWidth}));
  assert.equal((outline.match(/<path /g)||[]).length,1);
  const hatches=ink(render(examples.sphere,{outlineWidth:0,variableWidth}));
  assert.ok((hatches.match(/<path /g)||[]).length>10);
  const none=ink(render(examples.ethanol,{outlineWidth:0,hatchWidth:0,variableWidth,colorWash:true}));
  assert.ok(!none.includes('<path'));
 }
 const fillOnly=render(examples.ethanol,{outlineWidth:0,hatchWidth:0,colorWash:true});
 assert.ok(fillOnly.includes('class="mol-wash"'));
 assert.equal(render(examples.sphere,{lineWidth:1}),render(examples.sphere,{outlineWidth:1,hatchWidth:1}));
 assert.equal(ink(render(examples.sphere,{lineWidth:0})).includes('<path'),false);
 assert.equal(ink(render(examples.sphere,{hatchWidth:0,outlineWidth:1})),ink(render(examples.sphere,{lineWidth:3,hatchWidth:0,outlineWidth:1})));
 for(const opts of [{outlineWidth:-1},{hatchWidth:NaN},{outlineWidth:Infinity},{hatchWidth:-1}])assert.throws(()=>render(examples.sphere,opts));
});
check('saturation changes chroma independently of concentration',()=>{
 const {elementColor,elementPalette}=require('./renderer.js');
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 for(const e of ['C','O','N','S','P']){
  assert.equal(elementColor(e,1,1),elementPalette[e]);
  const gray=rgb(elementColor(e,1,0));assert.equal(gray[0],gray[1]);assert.equal(gray[1],gray[2]);
  const basic=rgb(elementColor(e,1,1)),vivid=rgb(elementColor(e,1,4));
  assert.ok(Math.max(...vivid)-Math.min(...vivid)>Math.max(...basic)-Math.min(...basic));
  assert.ok(Math.abs(Math.max(...vivid)+Math.min(...vivid)-Math.max(...basic)-Math.min(...basic))<=1);
 }
 assert.equal(elementColor('H',1,4),'#ffffff');assert.equal(elementColor('O',0,4),'#ffffff');
 for(const colorSaturation of [-1,5,NaN])assert.throws(()=>render(examples.sphere,{colorSaturation}));
});
check('fill-only exports retain the same smooth cubic color boundaries',()=>{
 const opts={colorWash:true,outlineWidth:0,hatchWidth:0};
 const plain=render(examples.ethanol,opts),outlined=render(examples.ethanol,{colorWash:true});
 const plate=s=>s.match(/<g class="mol-wash"[\s\S]*?<\/g>/)[0];
 assert.match(plate(plain),/C[-\d]/);
 assert.equal(plate(plain),plate(outlined));
 assert.ok(!/<image|<filter|feGaussianBlur/.test(plain));
 assert.ok(!plain.match(/<g data-role="engraving"[\s\S]*?<\/g>/)[0].includes('<path'));
});
const writeSamples=!process.argv.includes('--no-samples');
if(writeSamples)fs.mkdirSync('samples',{recursive:true});
for(const [key,m] of Object.entries(examples)){
 const svg=render(m);
 if(writeSamples)fs.writeFileSync(`samples/${key}.svg`,svg);
}
console.log(`${checks} tests passed${writeSamples?'; SVG samples written to samples/':''}`);
