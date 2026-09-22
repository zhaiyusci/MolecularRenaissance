'use strict';
const assert=require('node:assert/strict');
const api=require('./renderer.js'),boundaries=require('./boundaries.js');
const {marks}=require('./test-style-coverage.cjs');
const names=['hydrogenPeroxide','isopropanol','glycine','glucose','phospholipid'];
const poses=[[.25,-.16],[0,0],[Math.PI/2,0],[0,Math.PI/2],[.7,.43],[-.8,-.4]];
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
let renders=0,probes=0,labels=0;
function capture(model,options){let ctx;const old=boundaries.build;boundaries.build=(scene,depth,project,scale)=>{const result=old(scene,depth,project,scale);ctx={scene,depth,project,scale,result};return result;};try{return {svg:api.render(model,{width:800,height:600,scale:32,shadingSize:0,outlineWidth:0,labels:true,labelSize:17,quality:'preview',...options}),ctx};}finally{boundaries.build=old;}}
function verify(model,options,label){
 const original=JSON.stringify(model),{svg,ctx}=capture(model,options);
 assert(ctx.result,label+': certified build');assert.doesNotMatch(svg,/NaN|Infinity|data-role="element-texture-fallback"/);
 const layers=[...svg.matchAll(/<g data-role="surface-layer" data-surface-id="(\d+)">/g)].map(m=>({id:+m[1],at:m.index}));
 const fills=[...svg.matchAll(/<path data-role="surface-fill"[^>]*\/>/g)];assert(fills.length>0);
 const solids=layers.map((l,i)=>{const end=layers[i+1]?.at??svg.length,chunk=svg.slice(l.at,end),tag=chunk.match(/<path data-role="surface-fill"[^>]*\/>/)[0];return {id:l.id,shape:marks(tag.replace(/fill="[^"]*"/,'fill="#161616"'))[0]};});
 const text=[...svg.matchAll(/<text data-role="element-label"[^>]*>/g)];assert(text.length>0,label+': labels cannot all disappear');
 for(const m of text){const a=attrs(m[0]),id=+a['data-surface-id'],owner=ctx.scene[id];assert.equal(owner.kind,'sphere');if(options.labelHydrogens===false)assert.notEqual(owner.element,'H');assert(!a['clip-path']&&!a.mask);
  const [x,y]=ctx.project(owner.c);assert(Math.abs(+a.x-x)<=.00501);assert(Math.abs(+a.y-(y+17*.3))<=.00501);
  const layer=layers.find(l=>l.id===id);assert(layer&&layer.at<m.index);const next=layers.find(l=>l.at>layer.at);assert(!next||m.index<next.at,'label stays inside its own layer');
  assert(ctx.scene.every(s=>ctx.depth(s,owner.c[0],owner.c[1])<=owner.c[2]+owner.r+.00015),'visible label anchor');labels++;
 }
 // Check actual exported owner fills against independently enumerated depth.
 // Screen only points with an independently verified owner transition nearby.
 const origin=ctx.project([0,0,0]);
 const own=(x,y)=>{const wx=(x-origin[0])/ctx.scale,wy=(origin[1]-y)/ctx.scale;let id=-1,z=-Infinity;ctx.scene.forEach((s,i)=>{const d=ctx.depth(s,wx,wy);if(Number.isFinite(d)&&(d>z||(d===z&&s.kind==='cylinder'))){id=i;z=d;}});return id;};
 const spheres=ctx.scene.filter(s=>s.kind==='sphere'),ps=spheres.map(s=>({p:ctx.project(s.c),r:s.r*ctx.scale}));
 const lo=[0,1].map(k=>Math.min(...ps.map(s=>s.p[k]-s.r))-1),hi=[0,1].map(k=>Math.max(...ps.map(s=>s.p[k]+s.r))+1);
 for(let j=0;j<15;j++)for(let i=0;i<19;i++){const x=lo[0]+(hi[0]-lo[0])*(i+.37)/19,y=lo[1]+(hi[1]-lo[1])*(j+.61)/15,id=own(x,y);
  if([[.03,0],[-.03,0],[0,.03],[0,-.03]].some(([dx,dy])=>own(x+dx,y+dy)!==id))continue;
  const hits=solids.filter(s=>s.shape.contains(x,y));assert(hits.length<=1,label+': owner fills overlap');assert.equal(hits[0]?.id??-1,id,label+': physical owner mismatch');probes++;
 }
 assert.equal(JSON.stringify(model),original,'scientific coordinates and radii are not changed');renders++;
}
for(const name of names)for(const [yaw,pitch] of poses)for(const elementTextures of [false,true])verify(api.examples[name],{yaw,pitch,elementTextures},`${name}/${yaw}/${pitch}/${elementTextures}`);
for(const name of names){
 verify(api.examples[name],{quality:'export',elementTextures:true},name+'/export');
 verify(api.examples[name],{labelHydrogens:false},name+'/no-H-labels');
 assert.doesNotMatch(capture(api.examples[name],{labels:false,elementTextures:true}).svg,/data-role="element-label"/,'labels off remains respected');
}
for(const delta of [-5e-9,0,5e-9])for(const [yaw,pitch] of poses){const d=2+delta;verify({atoms:[{element:'C',radius:1,position:[-d/2,0,0]},{element:'O',radius:1,position:[d/2,0,0]}],bonds:[[0,1]]},{yaw,pitch,elementTextures:true},'bonded tangent '+delta);}
const sphere=x=>({kind:'sphere',element:'C',c:[x,0,0],r:1});
const a=sphere(-1),b=sphere(1),rod={kind:'cylinder',a:[-1,0,0],u:[1,0,0],length:2,r:.115};
const project=p=>[400+p[0]*1000,300-p[1]*1000];
assert(boundaries.build([a,b,rod],api.depthAt,project,1000),'covered external tangent supported');
assert.equal(boundaries.build([a,b],api.depthAt,project,1000),null,'uncovered tangent remains fail-closed');
assert.equal(boundaries.build([a,b,{...rod,r:.0001}],api.depthAt,project,1000),null,'rod cannot cover the uncertainty ball');
assert.equal(boundaries.build([a,b,{...rod,length:1}],api.depthAt,project,1000),null,'finite rod must cover axial extent and match endpoints');
assert.equal(boundaries.build([a,b,{...rod,u:[1.01,0,0]}],api.depthAt,project,1000),null,'invalid cylinder axis remains rejected');
assert.equal(boundaries.build([sphere(0),{...sphere(.5),r:.5}],api.depthAt,project,1000),null,'nested/internal tangency remains rejected');
console.log(`PASS ${renders} tangent/preset renders, ${labels} layered labels, ${probes} independent owner probes, preserved geometry and conservative rejection cases`);
