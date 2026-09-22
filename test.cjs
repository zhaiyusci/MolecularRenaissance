'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {render:rawRender,examples,depthAt,engravingWidth}=require('./renderer.js');
// IDs encode the full scene/options; compare drawing content, not that namespace.
const canonical=s=>{const ids=[...new Set(s.match(/\blh-[a-z0-9]+-[a-z0-9]+(?=-)/g)||[])];assert(ids.length<=1);return ids.length?s.split(ids[0]).join('lh-NAMESPACE'):s;};
const render=(...args)=>canonical(rawRender(...args));
function inkGroups(svg){const stack=[],out=[];for(const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)){if(m[0]==='</g>'){const s=stack.pop();assert(s);if(s.ink)out.push(svg.slice(s.index,m.index+m[0].length));}else if(!m[0].endsWith('/>'))stack.push({index:m.index,ink:m[0].includes('data-role="engraving"')});}assert.equal(stack.length,0);return out.join('');}
const plates=s=>(s.match(/<path\b[^>]*data-role="surface-fill"[^>]*\/>/g)||[]).join('')||(s.match(/<g class="mol-wash"[\s\S]*?<\/g>/)||[''])[0];
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
 assert(plates(a).includes('data-role="surface-fill"'));
 assert.equal(plates(a),plates(b));assert.equal(plates(a),plates(c));
});
check('extreme light directions remain finite',()=>{
 for(const lightAzimuth of [-Math.PI,0,Math.PI])for(const lightElevation of [-Math.PI/2,0,Math.PI/2]){
  const s=render(examples.pair,{lightAzimuth,lightElevation});
  assert.ok(s.includes('<path'));assert.ok(!/NaN|Infinity|undefined/.test(s));
 }
 assert.throws(()=>render(examples.sphere,{lightAzimuth:NaN}));
 assert.throws(()=>render(examples.sphere,{lightElevation:Infinity}));
});
check('removed lighting options are rejected, never silently ignored',()=>{
 for(const key of ['lightType','lightDistance','lightAttenuation']){
  for(const renderMode of ['precise','fast'])for(const value of [undefined,null,false,0,1,NaN,Infinity,'directional','point']){
   assert.throws(()=>render(examples.sphere,{renderMode,castShadows:false,[key]:value}),
    {message:`Removed lighting option: ${key}; only directional lighting is supported`});
  }
 }
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
 const svg=render(examples.sphere,{hatchMode:'continuous',optimizePaths:false}),flat=render(examples.sphere,{hatchMode:'continuous',variableWidth:false,optimizePaths:false});
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
check('directional light extremes and both line modes are finite',()=>{
 for(const lightAzimuth of [-Math.PI,0,Math.PI])for(const lightElevation of [-Math.PI/2,0,Math.PI/2])for(const variableWidth of [false,true]){
  const s=render(examples.pair,{lightAzimuth,lightElevation,variableWidth});
  assert.ok(s.includes('<path'));assert.ok(!/NaN|Infinity|undefined/.test(s));
 }
});
check('UI light controls convert angles, update and reset',()=>{
 const ui=require('./scripts/ui-harness.cjs').makeUI({browserLanguage:'zh-CN'});
 const {html,elements}=ui;
 let opts;
 function queued(){ui.flush();opts=ui.calls.at(-1).options;}
 queued();assert.ok(Math.abs(opts.lightAzimuth-(-29*Math.PI/180))<1e-12);
 const {rotateOrientation,orientationToEulerXYZ}=require('./renderer.js');
 const initialOrientation=rotateOrientation(rotateOrientation([0,0,0,1],'y',25*Math.PI/180),'x',-15*Math.PI/180);
 const nearOrientation=expected=>opts.orientation.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-12));
 nearOrientation(initialOrientation);
 assert.equal(elements.yaw,undefined);assert.equal(elements.pitch,undefined);
 assert.equal(elements['rotation-step'],undefined);
 assert.equal(Object.hasOwn(opts,'yaw'),false);assert.equal(Object.hasOwn(opts,'pitch'),false);
 ui.key('z','ArrowRight',true);queued();nearOrientation(require('./scripts/ui-harness.cjs').rotateRing(initialOrientation,'z',Math.PI/12));
 orientationToEulerXYZ(opts.orientation).forEach((angle,i)=>{
  const output=elements['euler-'+['x','y','z'][i]];assert.equal(output.tagName,'OUTPUT');
  assert.ok(Math.abs(parseFloat(output.textContent)-angle*180/Math.PI)<=.051);
 });
 assert.equal(ui.document.title,'分子文艺复兴');
 ui.locale('en');assert.equal(ui.document.title,'Molecular Renaissance');
 assert.equal(ui.queue.length,0,'locale changes do not rerender or reset light controls');
 assert.equal(elements['color-scheme'].value,'jmol');assert.equal(opts.colorScheme,'jmol');
 assert.equal(elements['color-scheme'].disabled,false);
 const colorSchemeOptions=html.match(/<select\b[^>]*id="color-scheme"[^>]*>([\s\S]*?)<\/select>/)[1];
 for(const value of ['jmol','rasmol','pymol','greenCarbon','cyanCarbon','magentaCarbon'])assert.ok(colorSchemeOptions.includes('value="'+value+'"'));
 elements['light-azimuth'].value='90';elements['light-elevation'].value='-45';
 elements['light-azimuth'].listeners.input();queued();
 assert.equal(opts.lightAzimuth,Math.PI/2);assert.equal(opts.lightElevation,-Math.PI/4);
 assert.equal(elements['light-azimuth-value'].textContent,'90°');
 assert.equal(opts.variableWidth,true);
 for(const id of ['point-light','light-distance','light-distance-value','light-attenuation','light-attenuation-value'])assert.equal(elements[id],undefined);
 for(const key of ['lightType','lightDistance','lightAttenuation'])assert.equal(Object.hasOwn(opts,key),false);
 assert.equal(elements['cast-shadows'].disabled,false);
 elements['cast-shadows'].checked=false;elements['cast-shadows'].listeners.change();queued();assert.equal(opts.castShadows,false);
 elements['cast-shadows'].checked=true;elements['cast-shadows'].listeners.change();queued();assert.equal(opts.castShadows,true);
 elements['shadow-strength'].value='65';elements['shadow-strength'].listeners.input();queued();assert.equal(opts.shadowStrength,.65);
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
 assert.equal(opts.colorWash,true);assert.equal(opts.washStrength,1);assert.equal(opts.labelMatchFill,true);
 elements['color-wash'].checked=false;elements['color-wash'].listeners.change();queued();
 assert.equal(opts.colorWash,false);assert.equal(opts.colorScheme,'jmol');
  const colorIds=['color-scheme','wash-strength','color-saturation'];
  for(const id of colorIds)assert.equal(elements[id].disabled,true);
  elements['color-wash'].checked=true;elements['color-wash'].listeners.change();queued();
  for(const mode of ['rasmol','pymol','greenCarbon','cyanCarbon','magentaCarbon','jmol','rasmol']){
   elements['color-scheme'].value=mode;elements['color-scheme'].listeners.change();queued();
   assert.equal(opts.colorScheme,mode);assert.equal(opts.colorWash,true);
   for(const id of colorIds)assert.equal(elements[id].disabled,false);
  }
  elements['color-wash'].checked=false;elements['color-wash'].listeners.change();queued();
  assert.equal(opts.colorWash,false);assert.equal(opts.colorScheme,'rasmol');
  assert.equal(elements['color-scheme'].value,'rasmol');
  for(const id of colorIds)assert.equal(elements[id].disabled,true);
 elements['color-wash'].checked=true;elements['color-wash'].listeners.change();queued();
 assert.equal(opts.colorScheme,'rasmol');assert.equal(elements['color-scheme'].value,'rasmol');
  for(const id of colorIds)assert.equal(elements[id].disabled,false);
  elements['wash-strength'].value='40';elements['wash-strength'].listeners.input();queued();
 assert.equal(opts.washStrength,.4);assert.equal(elements['wash-strength-value'].textContent,'40%');
 elements['label-stroke-width'].value='4';elements['label-stroke-width'].listeners.input();queued();
 assert.equal(elements['label-stroke-color'].disabled,true);
 elements['label-match-fill'].checked=false;elements['label-match-fill'].listeners.change();queued();
 assert.equal(opts.labelMatchFill,false);assert.equal(elements['label-stroke-color'].disabled,false);
 elements['shading-enabled'].checked=false;elements['shading-enabled'].listeners.change();queued();
 for(const [id,value] of [['outline-width','1.2'],['color-saturation','250']]){
  elements[id].value=value;elements[id].listeners.input();queued();
 }
 assert.equal(opts.shadingSize,0);assert.equal(opts.outlineWidth,1.2);assert.equal(opts.colorSaturation,2.5);
 elements['outline-width'].value='0';elements['outline-width'].listeners.input();queued();assert.equal(opts.outlineWidth,0);
 elements['color-wash'].checked=false;elements['color-wash'].listeners.change();queued();
 for(const id of colorIds)assert.equal(elements[id].disabled,true);
  assert.equal(opts.colorScheme,'rasmol');assert.equal(elements['color-scheme'].value,'rasmol');
  assert.deepEqual(colorIds.map(id=>elements[id].value),['rasmol','40','250']);
 assert.equal(opts.shadingMode,'hatch');
 for(const id of ['dot-spacing','dot-size','dot-contrast','density','line-width'])assert.equal(elements[id],undefined);
 elements['shading-enabled'].checked=true;elements['shading-enabled'].listeners.change();queued();
 const sharedIds=['texture-scale','shading-brightness','shading-contrast'];
 for(const [id,min,max,step,value] of [['texture-scale','20','250','5','100'],['shading-brightness','-100','100','5','0'],['shading-contrast','0.5','2.5','0.1','1.2']]){
  const tag=html.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'))[0];
  for(const [attr,expected] of Object.entries({min,max,step,value}))assert.ok(tag.includes(attr+'="'+expected+'"'));
 }
 for(const [id,value] of [['texture-scale','175'],['shading-brightness','-25'],['shading-contrast','2']]){elements[id].value=value;elements[id].listeners.input();queued();}
 for(const mode of ['stipple','halftone','hatch']){
  elements['shading-mode'].value=mode;elements['shading-mode'].listeners.change();queued();
  assert.equal(opts.shadingMode,mode);
  for(const id of ['cross-hatch','variable-width'])assert.equal(elements[id].disabled,mode!=='hatch');
  for(const id of sharedIds)assert.equal(elements[id].disabled,false);
  assert.deepEqual(sharedIds.map(id=>elements[id].value),['175','-25','2']);
  assert.equal(opts.textureScale,1.75);assert.equal(opts.shadingBrightness,-.25);assert.equal(opts.shadingContrast,2);
  assert.ok(!Object.hasOwn(opts,'shadingSize'));assert.ok(!Object.hasOwn(opts,'shadingDensity'));
  assert.equal(elements['texture-scale-value'].textContent,'1.75×');
  assert.equal(elements['shading-brightness-value'].textContent,'-25');
  assert.equal(elements['shading-contrast-value'].textContent,'2.0');
  for(const key of ['density','hatchWidth','dotSpacing','dotSize','dotContrast'])assert.ok(!Object.hasOwn(opts,key));
  assert.equal(elements['outline-width'].disabled,false);assert.equal(opts.outlineWidth,0);
  elements['shading-enabled'].checked=false;elements['shading-enabled'].listeners.change();queued();
  assert.equal(opts.shadingSize,0);assert.equal(opts.castShadows,false);
  for(const id of [...sharedIds,'shading-mode','cast-shadows','shadow-strength'])assert.equal(elements[id].disabled,true);
  assert.equal(elements['outline-width'].disabled,false);
  elements['shading-enabled'].checked=true;elements['shading-enabled'].listeners.change();queued();
  assert.ok(!Object.hasOwn(opts,'shadingSize'));assert.equal(opts.castShadows,true);assert.equal(opts.textureScale,1.75);
 }
 elements.reset.listeners.click();queued();
  assert.equal(opts.colorScheme,'jmol');assert.equal(elements['color-scheme'].value,'jmol');
  for(const id of colorIds)assert.equal(elements[id].disabled,false);
 assert.equal(opts.shadingMode,'hatch');assert.equal(opts.textureScale,1);assert.ok(!Object.hasOwn(opts,'shadingSize'));assert.equal(opts.shadingContrast,1.2);
 assert.deepEqual(sharedIds.map(id=>elements[id].value),['100','0','1.2']);
 assert.deepEqual(sharedIds.map(id=>elements[id+'-value'].textContent),['1.00×','0','1.2']);
 for(const id of [...sharedIds,'cross-hatch','variable-width'])assert.equal(elements[id].disabled,false);
 assert.equal(opts.outlineWidth,.8);assert.equal(opts.colorSaturation,1);
 assert.equal(opts.colorWash,true);assert.equal(opts.washStrength,1);assert.equal(opts.labelMatchFill,true);
 assert.equal(opts.labels,false);assert.equal(opts.labelSize,17);assert.equal(opts.labelStrokeWidth,4);
 assert.equal(opts.labelColor,'#161616');assert.equal(opts.labelStrokeColor,'#ffffff');
 assert.equal(opts.labelBold,false);assert.equal(opts.labelItalic,true);
 assert.equal(elements['label-settings'].disabled,true);
 assert.equal(opts.variableWidth,true);assert.equal(opts.castShadows,true);
 for(const key of ['lightType','lightDistance','lightAttenuation'])assert.equal(Object.hasOwn(opts,key),false);
 assert.equal(elements['cast-shadows'].disabled,false);assert.equal(elements['shadow-strength'].disabled,false);
 assert.ok(Math.abs(opts.lightAzimuth-(-29*Math.PI/180))<1e-12);assert.ok(Math.abs(opts.lightElevation-32*Math.PI/180)<1e-12);
 assert.equal(elements['light-azimuth'].value,'-29');assert.equal(elements['light-elevation'].value,'32');
 nearOrientation(initialOrientation);assert.equal(elements['rotation-step'],undefined);
});
check('element label styles export while captions remain in the GUI',()=>{
 const svg=render(examples.water,{labels:true,labelSize:32,labelStrokeWidth:7,labelStrokeColor:'#ffcc00',labelColor:'#112233',labelFont:'Arial, sans-serif',labelBold:true,labelItalic:false});
 const tags=[...svg.matchAll(/<text data-role="element-label"[^>]*>/g)].map(m=>m[0]);
 assert.equal(tags.length,3);
 for(const tag of tags)for(const attr of ['font-size="32"','stroke-width="7"','stroke="#ffcc00"','fill="#112233"','font-family="Arial, sans-serif"','font-weight="700"','font-style="normal"','paint-order="stroke fill"'])assert.ok(tag.includes(attr),attr);
 assert.equal((svg.match(/<text\b/g)||[]).length,tags.length,'SVG text contains only element labels, not a plate caption');
 assert.match(svg,/<title id="title">[^<]+<\/title>/,'accessible SVG title metadata is retained');
 const ui=require('./scripts/ui-harness.cjs').makeUI({browserLanguage:'en'});ui.flush();
 assert.equal(ui.elements['molecule-caption'].textContent,ui.calls.at(-1).model.name,'GUI caption follows the displayed molecule');
 assert.ok(ui.elements['molecule-caption'].textContent,'molecule caption is displayed outside the SVG in the GUI');
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
 const lines=s=>(s.match(/<defs data-hatch-renderer="layered"[\s\S]*?<\/defs>/)||[''])[0]+inkGroups(s);
 assert.equal(lines(mono),lines(color));assert.ok(plates(color).includes(elementColor('C')));
 assert.ok(!plates(mono).includes(elementColor('C')));assert.ok(!color.includes('<image'));
 assert.equal(render(examples.ethanol,{colorWash:true,washStrength:0}),mono);
 const svg=render(examples.sphere,{colorWash:true,labels:true,labelMatchFill:true});
 assert.ok(svg.match(/<text data-role="element-label"[^>]*>/)[0].includes('stroke="'+elementColor('C')+'"'));
 assert.equal(elementColor('H'),'#ffffff');assert.equal(elementColor('O',0),'#ffffff');
 for(const washStrength of [-1,2,NaN])assert.throws(()=>render(examples.sphere,{washStrength}));
});
check('outline and hatch widths are independent and zero removes paths',()=>{
 const ink=inkGroups;
 for(const variableWidth of [true,false]){
  const outline=ink(render(examples.sphere,{hatchWidth:0,variableWidth}));
  assert.equal((outline.match(/<path /g)||[]).length,1);
  const hatches=ink(render(examples.sphere,{outlineWidth:0,variableWidth}));
  assert.ok((hatches.match(/<(?:path|use) /g)||[]).length>10);
  const none=ink(render(examples.ethanol,{outlineWidth:0,hatchWidth:0,variableWidth,colorWash:true}));
  assert.ok(!none.includes('<path'));
 }
 const fillOnly=render(examples.ethanol,{outlineWidth:0,hatchWidth:0,colorWash:true});
 assert.ok(plates(fillOnly).includes('fill='));
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
  const chroma=Math.max(...basic)-Math.min(...basic),capacity=255-Math.abs(Math.max(...basic)+Math.min(...basic)-255);
  if(chroma>0&&chroma<capacity)assert.ok(Math.max(...vivid)-Math.min(...vivid)>chroma,'available chroma increases');
  else assert.deepEqual(vivid,basic,'achromatic carbon and already saturated source colors stay unchanged');
  assert.ok(Math.abs(Math.max(...vivid)+Math.min(...vivid)-Math.max(...basic)-Math.min(...basic))<=1);
 }
 assert.equal(elementColor('H',1,4),'#ffffff');assert.equal(elementColor('O',0,4),'#ffffff');
 for(const colorSaturation of [-1,5,NaN])assert.throws(()=>render(examples.sphere,{colorSaturation}));
});
check('fill-only exports retain the same smooth cubic color boundaries',()=>{
 const opts={colorWash:true,outlineWidth:0,hatchWidth:0};
 const plain=render(examples.ethanol,opts),outlined=render(examples.ethanol,{colorWash:true});
 const plate=plates;
 assert.match(plate(plain),/C[-\d]/);
 assert.equal(plate(plain),plate(outlined));
 assert.ok(!/<image|<filter|feGaussianBlur/.test(plain));
 assert.ok(!plain.match(/<g data-role="engraving"[\s\S]*?<\/g>/)[0].includes('<path'));
});
const writeSamples=!process.argv.includes('--no-samples');
if(writeSamples)fs.mkdirSync('samples',{recursive:true});
for(const [key,m] of Object.entries(examples)){
 const svg=rawRender(m);
 if(writeSamples)fs.writeFileSync(`samples/${key}.svg`,svg);
}
console.log(`${checks} tests passed${writeSamples?'; SVG samples written to samples/':''}`);
