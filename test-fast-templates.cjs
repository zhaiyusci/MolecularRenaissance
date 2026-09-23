'use strict';
// Full atom-local quantized texture instancing; no browser or private exports.
const assert=require('node:assert/strict');
const api=require('./renderer.js');
function parse(svg){
 const root={tag:'root',a:{},children:[],parent:null},stack=[root],nodes=[],ids=new Map();
 for(const m of svg.matchAll(/<\/?[A-Za-z][^>]*>/g)){
  const text=m[0];if(text.startsWith('</')){const n=stack.pop();n.end=m.index+text.length;continue;}
  const tag=text.match(/^<([^\s/>]+)/)[1],a=Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const node={tag,a,children:[],parent:stack.at(-1),start:m.index,end:m.index+text.length};node.parent.children.push(node);nodes.push(node);
  if(a.id){assert(!ids.has(a.id),'unique id '+a.id);ids.set(a.id,node);}if(!text.endsWith('/>'))stack.push(node);
 }
 for(const m of svg.matchAll(/(?:url\(#|href="#)([^)" ]+)/g))assert(ids.has(m[1]),'resolved SVG reference '+m[1]);
 const descendants=n=>n.children.flatMap(c=>[c,...descendants(c)]);
 const atoms=nodes.filter(n=>n.a['data-role']==='surface-layer'&&n.a['data-atom-id']!==undefined);
 const atomUses=atoms.map(n=>{const uses=descendants(n).filter(c=>c.tag==='use'&&c.a.transform?.startsWith('translate('));assert.equal(uses.length,1,'one translated texture instance per atom');return uses[0];});
 const templateIds=[...new Set(atomUses.map(n=>n.a.href.slice(1)))];
 const templates=templateIds.map(id=>ids.get(id));
 const text=n=>svg.slice(n.start,n.end);
 // Namespace changes are not evidence that actual geometry changed.
 const closure=n=>{const found=new Set(),out=[];function visit(item){if(found.has(item))return;found.add(item);out.push(item);for(const m of text(item).matchAll(/(?:url\(#|href="#)([^)" ]+)/g))visit(ids.get(m[1]));}visit(n);return out;};
 const content=n=>closure(n).map(item=>text(item).replace(/\bid="[^"]*"/g,'id="ID"').replace(/\bhref="#[^"]*"/g,'href="#ID"').replace(/url\(#[^)]*\)/g,'url(#ID)')).join('');
 return {svg,nodes,ids,atoms,atomUses,templates,descendants,text,content,closure};
}
const attr=(svg,key)=>+(svg.match(new RegExp('\\s'+key+'="([^"]+)"'))?.[1]??NaN);
const base={renderMode:'fast',quantizeShading:true,castShadows:false,width:900,height:700,scale:60,atomRadiusScale:.75,yaw:0,pitch:0,quality:'preview',textureScale:1};
const one={atoms:[{element:'C',position:[0,0,0],radius:.76}],bonds:[]};
const normContent=t=>t.templates.slice().sort((a,b)=>+a.a['data-template-radius']- +b.a['data-template-radius']).map(t.content).join('');
let scenes=0;
for(const shadingMode of ['hatch','stipple','halftone'])for(const shadingLevels of [4,16,64]){
 const options={...base,shadingMode,shadingLevels},svg=api.render(api.examples.c60,options),t=parse(svg);scenes++;
 assert.equal(attr(svg,'data-atom-template-count'),1);
 assert.equal(attr(svg,'data-atom-template-instances'),60);
 assert.equal(t.templates.length,1);assert.equal(t.atomUses.length,60);
 assert.equal(attr(svg,'data-boundary-builds'),0);assert.equal(attr(svg,'data-sphere-pair-tests'),0);
 assert.equal(attr(svg,shadingMode==='hatch'?'data-quantized-hatch-builds':'data-dot-texture-builds'),1+attr(svg,'data-bond-texture-builds'),'build each full atom texture once plus each visible bond texture');
 const template=t.text(t.templates[0]);
 assert(template.includes(`data-tone-levels="${shadingLevels}"`),'full quantized body is inside template');
 assert(t.closure(t.templates[0]).some(n=>n.tag==='clipPath'),'shared template references complete tone/silhouette definitions');
 if(shadingMode!=='hatch')assert(t.closure(t.templates[0]).some(n=>n.tag==='pattern'),'patterns are shared with the full atom texture');
 for(const atom of t.atoms)assert(!t.descendants(atom).some(n=>['clipPath','pattern','defs'].includes(n.tag)),'instance does not rebuild tone or pattern definitions');
 const single=parse(api.render(one,options));
 assert.equal(normContent(t),normContent(single),'same-radius full template does not depend on atom count/position');
 // Projection and front-to-back painter ordering remain independent of instancing.
 const positions=api.examples.c60.atoms.map(a=>a.position),center=[0,1,2].map(k=>positions.reduce((s,p)=>s+p[k],0)/positions.length);
 const ordered=positions.map((p,id)=>({id,z:p[2]-center[2]})).sort((a,b)=>a.z-b.z||a.id-b.id).map(a=>a.id);
 assert.deepEqual(t.atoms.map(n=>+n.a['data-atom-id']),ordered);
 for(const atom of t.atoms){const id=+atom.a['data-atom-id'],fill=t.descendants(atom).find(n=>n.a['data-role']==='surface-fill');assert(fill);
  assert(Math.abs(+fill.a.cx-(450+60*(positions[id][0]-center[0])))<1e-9);assert(Math.abs(+fill.a.cy-(350-60*(positions[id][1]-center[1])))<1e-9);
  assert.equal(+fill.a.r,.76*.75*60);
  const instance=t.atomUses[t.atoms.indexOf(atom)],template=t.ids.get(instance.a.href.slice(1)),origin=+template.a['data-template-origin'];
  const translation=instance.a.transform.match(/translate\(([^)]*)\)/)[1].split(/[ ,]+/).map(Number);
  assert(Math.abs(translation[0]+origin- +fill.a.cx)<1e-9,'template light center maps to physical atom x');
  assert(Math.abs(translation[1]+origin- +fill.a.cy)<1e-9,'template light center maps to physical atom y');
  assert.equal(+template.a['data-template-radius']*base.scale,+fill.a.r,'template does not rescale the atom');
 }
}
const mixed={atoms:[{element:'C',position:[-2,0,-1],radius:.8},{element:'O',position:[0,0,0],radius:.8},{element:'N',position:[2,0,1],radius:.5},{element:'H',position:[0,2,2],radius:.5}],bonds:[]};
for(const shadingMode of ['hatch','stipple','halftone']){
 const options={...base,shadingMode,shadingLevels:16,colorWash:true,labels:true,elementTextures:true,labelMatchFill:true};
 const t=parse(api.render(mixed,options));scenes++;
 assert.equal(t.templates.length,2);assert.equal(attr(t.svg,'data-atom-template-count'),2);
 const byId=new Map(t.atoms.map((n,i)=>[+n.a['data-atom-id'],{n,use:t.atomUses[i]}]));
 assert.equal(byId.get(0).use.a.href,byId.get(1).use.a.href,'equal C/O radii share texture');assert.equal(byId.get(2).use.a.href,byId.get(3).use.a.href);
 assert.notEqual(byId.get(0).use.a.href,byId.get(2).use.a.href,'different radii have separate templates');
 const fills=[];
 for(const [id,{n}]of byId){const descendants=t.descendants(n),label=descendants.find(n=>n.a['data-role']==='element-label'),fill=descendants.find(n=>n.a['data-role']==='surface-fill');
  assert(label&&fill);assert(t.text(label).includes('>'+mixed.atoms[id].element+'</text>'));assert.equal(label.a.stroke,fill.a.fill);fills.push(fill.a.fill);
 }
 assert(new Set(fills).size>2,'same-radius instances retain independent element colors');
 for(const template of t.templates)assert(!t.descendants(template).some(n=>n.tag==='text'||n.a['data-role']==='surface-fill'),'color and labels are not baked into shared light texture');
 // The first painter atom is far outside the viewport. Its cached texture must
 // still be complete when a later same-radius atom is visible.
 const offscreen={atoms:[{element:'C',position:[-20,0,-2],radius:.8},{element:'C',position:[0,0,0],radius:.8},{element:'C',position:[20,0,2],radius:.8}],bonds:[]};
 const small={...base,width:200,height:200,scale:20,shadingMode,shadingLevels:16};
 const off=parse(api.render(offscreen,small)),solo=parse(api.render({atoms:[{element:'C',position:[0,0,0],radius:.8}],bonds:[]},small));
 assert.equal(+off.atoms[0].a['data-atom-id'],0);assert.equal(normContent(off),normContent(solo),'offscreen first owner cannot crop/empty the visible template');
 assert(off.templates[0].children.length>0);
 // New renders invalidate both namespace and geometric/tonal content when
 // physical light, size, or artistic controls change.
 const initial=parse(api.render(one,{...base,shadingMode,shadingLevels:16}));
 for(const change of [{scale:85},{atomRadiusScale:1},{lightAzimuth:1.1},{lightElevation:-.4},{shadingLevels:4},{textureScale:.55},{shadingBrightness:-.2},{shadingContrast:.7}]){
  const next=parse(api.render(one,{...base,shadingMode,shadingLevels:16,...change}));
  assert.notEqual(next.templates[0].a.id,initial.templates[0].a.id,'new template namespace '+JSON.stringify(change));
  assert.notEqual(normContent(next),normContent(initial),'actual template refresh '+JSON.stringify(change));
 }
 const rotated=parse(api.render(mixed,{...options,yaw:.9,pitch:.4}));
 assert.notEqual(rotated.atomUses.map(n=>n.a.transform).join(),t.atomUses.map(n=>n.a.transform).join(),'model orientation changes instance placement, not world light');
 assert.equal(normContent(rotated),normContent(t),'spherical local lighting is independent of model orientation');
}
for(const shadingMode of ['hatch','stipple','halftone']){
 const svg=api.render(mixed,{...base,shadingMode,shadingSize:0,elementTextures:true,labels:true,colorWash:true});
 assert(!svg.includes('data-role="dots"'));assert(!svg.includes('data-hatch-renderer="layered"'));
 assert.equal(attr(svg,'data-atom-template-count'),0);assert.equal(attr(svg,'data-atom-template-instances'),0);assert.equal(attr(svg,'data-bond-texture-builds'),0);
 assert(svg.includes('data-role="element-label"'));assert(svg.includes('data-role="surface-fill"'));assert(/fill="url\(#/.test(svg),'categorical element patterns survive shading off');
}
const legacy=api.render(api.examples.c60,{...base,quantizeShading:undefined,shadingMode:'hatch'});
assert(!legacy.includes('data-hatch-renderer="layered"'),'omitted quantization retains continuous fast hatch');
assert.equal(legacy,api.render(api.examples.c60,{...base,quantizeShading:undefined,shadingMode:'hatch',hatchMode:'continuous'}));
for(const shadingMode of ['stipple','halftone']){
 const continuous=api.render(one,{...base,shadingMode,quantizeShading:false});
 assert(!continuous.includes('data-tone-levels='),'explicit false retains continuous backend');
}
console.log(`PASS fast atom templates: ${scenes} count/style cases, complete clips/patterns, projection/depth, offscreen reuse, parameter refresh, shading-off and legacy routes`);
