'use strict';
// Standalone, dependency-free: node test-analytic-boundaries.cjs. Writes no samples.
const assert = require('node:assert/strict');
const renderer = require('./renderer.js');
const boundaries = require('./boundaries.js');
const { buildWash } = require('./wash.js');
const started = performance.now();
const failures = [], fallbackCases = [], stats = { cases: 0, analytic: 0, buildFallback: 0, washFallback: 0, rays: 0, screened: 0, boundary: 0 };
const palette = { C: '#db4422', O: '#245acc', H: '#ffffff', N: '#33aa66', W: '#ffffff' };
const colors = e => palette[e] || '#d59922';
let seed = 0x6d2b79f5;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function test(name, fn) { try { fn(); } catch (e) { failures.push(name + ': ' + e.message); console.error('FAIL ' + failures.at(-1)); } }
const mid = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
function distance(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
  const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
// Independent de Casteljau flattening, not the production fitter or arrangement.
function flatten(d,closed=true) {
  assert.equal(d.replace(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?|[\s,]/gi,''),'','only M/L/C/Z supported');
  const tokens=d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
  const loops=[];let points=null,p,i=0;
  const point=()=>{const q=[Number(tokens[i++]),Number(tokens[i++])];assert.ok(q.every(Number.isFinite));return q;};
  function cubic(a,b,c,d,depth=0) {
    const flat=Math.max(distance(b,a,d),distance(c,a,d))<.001;
    assert.ok(depth<24||flat,'flattening converges');
    if(flat){points.push(d);return;}
    const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
    cubic(a,ab,abc,m,depth+1);cubic(m,bcd,cd,d,depth+1);
  }
  while(i<tokens.length) {
    const cmd=tokens[i++];
    if(cmd==='M'){assert.equal(points,null,'previous contour closed');p=point();points=[p];}
    else if(cmd==='L'){assert.ok(points);p=point();points.push(p);}
    else if(cmd==='C'){assert.ok(points);const b=point(),c=point(),q=point();cubic(p,b,c,q);p=q;}
    else if(cmd==='Z'){
      assert.ok(points&&points.length>=(closed?4:2),'nondegenerate contour');
      // The arrangement must actually meet, not use Z to conceal a missing arc.
      if(closed)assert.ok(Math.hypot(p[0]-points[0][0],p[1]-points[0][1])<.0002,'no implicit closing chord');
      loops.push(points);points=null;
    } else assert.fail('unexpected command '+cmd);
  }
  assert.equal(points,null,'all contours explicitly closed');return loops;
}
function parse(svg, analytic=true) {
  assert.equal(typeof svg,'string');assert.ok(!/NaN|Infinity|<image\b|<rect\b/.test(svg));
  if(analytic)assert.match(svg,/data-boundaries="analytic"/);
  const paths=[...svg.matchAll(/<path fill="([^"]+)" fill-rule="evenodd" d="([^"]+)"\/>/g)].map(m=>({color:m[1],loops:flatten(m[2])}));
  assert.equal(paths.length,(svg.match(/<path\b/g)||[]).length,'all fills parsed');
  for(const path of paths){path.edges=path.loops.flatMap(loop=>loop.slice(1).map((b,i)=>[loop[i],b]));}
  return paths;
}
function inside(loop,x,y) {
  let hit=false;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[i],b=loop[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
function actual(paths,x,y) {
  const hits=paths.filter(p=>p.loops.reduce((v,l)=>v!==inside(l,x,y),false));
  assert.ok(hits.length<=1,`overlapping color contours at ${x},${y}`);
  return hits.length?hits[0].color:null;
}
function oracle(ctx,colorFor,x,y) {
  const o=ctx.project([0,0,0]);x=(x-o[0])/ctx.scale;y=(o[1]-y)/ctx.scale;
  let best=-Infinity,color=null;
  for(const s of ctx.scene){const z=renderer.depthAt(s,x,y),c=s.kind==='sphere'?colorFor(s.element):null;
    const empty=c===null||c==='#ffffff';
    if(Number.isFinite(z)&&(z>best||(z===best&&empty))){best=z;color=empty?null:c;}
  }return color;
}
function capture(molecule,options={}) {
  const original=boundaries.build;let context;
  boundaries.build=function(scene,depthAt,project,scale){
    const result=original(scene,depthAt,project,scale);context={scene,project,scale,result};return result;
  };
  try { const svg=renderer.render(molecule,{width:460,height:360,colorWash:true,hatchWidth:0,outlineWidth:0,...options});assert.match(svg,/<svg/); }
  finally { boundaries.build=original; }
  assert.ok(context,'renderer calls boundaries.build');return context;
}
function check(name,ctx,{required=false,fallback=false,colorFor=colors,dense=false,preview=false}={}) {
  stats.cases++;
  const result=ctx.result===undefined?boundaries.build(ctx.scene,renderer.depthAt,ctx.project,ctx.scale):ctx.result;
  const svg=result?result.wash(colorFor,preview):null;
  if(svg===null){
    stats[result?'washFallback':'buildFallback']++;
    fallbackCases.push({name,stage:result?'wash':'build'});
    // Exercise the actual general implementation: fallback must return finite SVG.
    const legacy=buildWash(ctx.scene,renderer.depthAt,ctx.project,ctx.scale,colorFor,{fitCurves:false});
    assert.equal(typeof legacy,'string');assert.match(legacy,/<g/);assert.ok(!/NaN|Infinity/.test(legacy));
    assert.ok(!required,name+' unexpectedly fell back');return null;
  }
  stats.analytic++;assert.ok(!fallback,name+' must conservatively fall back');
  assert.ok(Number.isInteger(result.curveCount)&&result.curveCount>0);
  assert.ok(Number.isInteger(result.segmentCount)&&result.segmentCount>0);
  const paths=parse(svg), edges=paths.flatMap(p=>p.edges);
  const ps=ctx.scene.filter(s=>s.kind==='sphere').map(s=>({p:ctx.project(s.c),r:s.r*ctx.scale}));
  const lo=[0,1].map(k=>Math.min(...ps.map(s=>s.p[k]-s.r))-2),hi=[0,1].map(k=>Math.max(...ps.map(s=>s.p[k]+s.r))+2);
  // Offset oracle screening rejects genuinely ambiguous near-boundary rays, not errors.
  for(let i=0;i<1400;i++){
    const x=lo[0]+random()*(hi[0]-lo[0]),y=lo[1]+random()*(hi[1]-lo[1]);
    const expected=oracle(ctx,colorFor,x,y);
    if([[.03,0],[-.03,0],[0,.03],[0,-.03]].some(([dx,dy])=>oracle(ctx,colorFor,x+dx,y+dy)!==expected)) {stats.screened++;continue;}
    if(edges.some(([a,b])=>distance([x,y],a,b)<.03)){stats.screened++;continue;}
    stats.rays++;assert.equal(actual(paths,x,y),expected,`${name}: membership at ${x.toFixed(5)},${y.toFixed(5)}`);
  }
  if(dense){
    // Along every flattened arc, <= .75 SVG spacing; test both oracle sides .03 away.
    // Endpoints are avoided because multi-way intersection normals are undefined.
    for(const [a,b] of edges){const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-7)continue;
      const n=Math.max(1,Math.ceil(length/.75));
      for(let j=0;j<n;j++)for(const sign of [-1,1]){
        const t=(j+.5)/n,x=a[0]+t*dx-sign*dy/length*.03,y=a[1]+t*dy+sign*dx/length*.03;
        stats.boundary++;
         const got=actual(paths,x,y),expected=oracle(ctx,colorFor,x,y);
         // Near tangent contours a .03 normal probe can land on a DIFFERENT
         // boundary. Allow only an independently verified true transition within
         // .003 (cubic + flattening budget), not a blanket tangency exemption.
         const onOtherBoundary=got!==expected&&Array.from({length:32},(_,k)=>{
           const angle=k*Math.PI/16;
           return oracle(ctx,colorFor,x+.003*Math.cos(angle),y+.003*Math.sin(angle))!==expected;
         }).some(Boolean);
         assert.ok(got===expected||onOtherBoundary,`${name}: continuous boundary sides at ${x.toFixed(5)},${y.toFixed(5)}: ${got} vs ${expected}`);
      }
    }
  }
  return paths;
}
const sphere=(x,y,z,r=1,element='C')=>({kind:'sphere',c:[x,y,z],r,element});
function rod(a,b,r=.22){const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);return {kind:'cylinder',a,u:d.map(v=>v/length),length,r};}
const context=scene=>({scene,project:p=>[180+p[0]*40,180-p[1]*40],scale:40});
function sceneTest(name,scene,options={}){test(name,()=>check(name,context(scene),options));}
for(const [name,molecule] of Object.entries(renderer.examples))test('default '+name,()=>check(name,capture(molecule),{required:true,dense:name==='sphere'||name==='pair'}));
let sweepAccepted=0;
// Fix the camera corpus independently of geometry/probe counts and early failures.
let angleSeed=0x18ac7463;
const angleRandom=()=>{angleSeed^=angleSeed<<13;angleSeed^=angleSeed>>>17;angleSeed^=angleSeed<<5;return (angleSeed>>>0)/4294967296;};
const sweepAngles=Array.from({length:40},()=>[(angleRandom()*2-1)*Math.PI,(angleRandom()-.5)*Math.PI]);
for(let i=0;i<40;i++){
  const [yaw,pitch]=sweepAngles[i];
  test('ethanol sweep '+i,()=>{if(check(`ethanol ${i} yaw=${yaw} pitch=${pitch}`,capture(renderer.examples.ethanol,{yaw,pitch}),{dense:[15,24,31,36].includes(i)}))sweepAccepted++;});
}
console.log(`Ethanol deterministic sweep acceptance: ${sweepAccepted}/40`);
test('all ordinary rotation views remain analytic',()=>assert.equal(sweepAccepted,40,'ordinary ethanol rotations must not fall back to the area grid'));
sceneTest('disjoint color overlap',[sphere(-.6,0,0,1,'C'),sphere(.6,0,2.5,1,'O')],{required:true,dense:true});
sceneTest('identical hues',[sphere(-.6,0,0),sphere(.6,0,2.5)],{required:true,colorFor:()=> '#33aa66',dense:true});
test('white hole',()=>{
  const p=check('white hole',context([sphere(0,0,0,2),sphere(0,0,3,.55,'W')]),{required:true,dense:true});
  assert.equal(p.length,1);assert.equal(p[0].loops.length,2);assert.equal(actual(p,180,180),null);
});
sceneTest('all white',[sphere(0,0,0)],{required:true,colorFor:()=> '#ffffff'});
for(const [name,b] of [['horizontal',[3,0,0]],['vertical',[0,3,0]],['camera parallel',[0,0,3]],['oblique',[2,1,2]],['near axial',[.0003,0,3]],['grazing',[3,0,.001]]]){
  const a=[0,0,0];sceneTest(name,[sphere(...a),sphere(...b,1,'O'),rod(a,b)],{required:name==='oblique',dense:true});
}
for(const yaw of [0,.4,1.2,Math.PI/2-1e-5])test('rotated pair '+yaw,()=>check('rotated pair '+yaw,capture(renderer.examples.pair,{yaw,pitch:.3}),{dense:true}));
sceneTest('intersecting spheres',[sphere(0,0,0),sphere(1,0,.4,1,'O')],{required:true,dense:true});
sceneTest('free caps',[sphere(0,0,0),rod([-2,0,2],[2,0,2])],{fallback:true});
sceneTest('nonincident cylinder contact',[sphere(-3,0,0),sphere(3,0,0),sphere(0,.6,0,.5,'O'),rod([-3,0,0],[3,0,0])],{fallback:true});
for(const reversed of [false,true]){
  const a=[-2,0,0],b=[2,.3,.7];sceneTest(reversed?'reversed duplicate bonds':'duplicate bonds',[sphere(...a),sphere(...b,1,'O'),rod(a,b),rod(reversed?b:a,reversed?a:b)]);
}
const a=[0,0,0],b=[4,0,0],c=[3.7,1.7,0];
sceneTest('acute same endpoint cylinders',[sphere(...a),sphere(...b,.65,'O'),sphere(...c,.65,'N'),rod(a,b,.4),rod(a,c,.4)],{dense:true});
const ends=[[-3,0,0],[3,0,0],[0,-3,0],[0,3,0]];
sceneTest('crossing rods',[...ends.map((p,i)=>sphere(...p,.7,i<2?'C':'O')),rod(ends[0],ends[1]),rod(ends[2],ends[3])],{dense:true});
sceneTest('preview sphere/contact',[sphere(0,0,0),sphere(2,1,2,1,'O'),rod([0,0,0],[2,1,2])],{required:true,preview:true,dense:true});
test('shared sphere outlines stay visible silhouettes, never contact arcs',()=>{
  for(const [name,molecule] of Object.entries(renderer.examples)){
    const ctx=capture(molecule),o=ctx.project([0,0,0]);assert.ok(ctx.result);
    let probes=0;
    for(const s of ctx.scene.filter(s=>s.kind==='sphere')){
      const svg=ctx.result.outline(s,false,.8),center=ctx.project(s.c);
      assert.ok(!/NaN|Infinity/.test(svg));
      for(const match of svg.matchAll(/\bd="([^"]+)"/g))for(const loop of flatten(match[1]+'Z',false)){
        for(let i=1;i<loop.length;i++){
          const p=mid(loop[i-1],loop[i]);
          assert.ok(Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-s.r*ctx.scale)<.003,`${name}: outline is a sphere silhouette, not a contact ellipse`);
          const x=(p[0]-o[0])/ctx.scale,y=(o[1]-p[1])/ctx.scale;
          for(const other of ctx.scene)if(other!==s)assert.ok(renderer.depthAt(other,x,y)<=s.c[2]+.00015+.03/ctx.scale,`${name}: hidden silhouette stroke at ${p}`);
          probes++;
        }
      }
    }
    assert.ok(probes>100,`${name}: dense outline coverage`);
  }
});
test('analytic fill never invokes grid fallback',()=>{
  const helper=require('./wash.js'), original=helper.buildWash;
  helper.buildWash=()=>{throw new Error('analytic example invoked grid fallback');};
  try {for(const molecule of Object.values(renderer.examples)){
    const svg=renderer.render(molecule,{colorWash:true,hatchWidth:0,outlineWidth:0});
    assert.match(svg,/data-boundaries="analytic"/);
  }} finally {helper.buildWash=original;}
});
for(const stage of ['build','wash'])test('renderer fallback wiring '+stage,()=>{
  const helper=require('./wash.js'),originalBuild=boundaries.build,originalWash=helper.buildWash;let calls=0;
  boundaries.build=stage==='build'?()=>null:()=>({wash:()=>null,validate:()=>true,outline:()=>''});
  helper.buildWash=function(...args){calls++;return originalWash(...args);};
  try {const svg=renderer.render(renderer.examples.sphere,{width:240,height:240,colorWash:true,hatchWidth:0,outlineWidth:0});
    assert.equal(calls,1);assert.match(svg,/<g class="mol-wash"/);assert.ok(!/NaN|Infinity/.test(svg));
  }finally {boundaries.build=originalBuild;helper.buildWash=originalWash;}
});
test('classic browser script loading',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const browser=vm.createContext({console});
  for(const file of ['boundaries.js','wash.js','dots.js','renderer.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),browser,{filename:file});
  assert.equal(typeof browser.MolBoundaries.build,'function');assert.equal(typeof browser.MolDots.buildDots,'function');
  const original=browser.MolWash.buildWash;browser.MolWash.buildWash=()=>{throw new Error('browser example invoked grid fallback');};
  try {for(const molecule of Object.values(browser.MolEngraver.examples)){
    const svg=browser.MolEngraver.render(molecule,{colorWash:true,hatchWidth:0,outlineWidth:0});
    assert.match(svg,/data-boundaries="analytic"/);assert.ok(!/NaN|Infinity/.test(svg));
  }}finally {browser.MolWash.buildWash=original;}
});
// Additional failures found by the 1,325-view stress corpus. Require analytic
// geometry at both the small regression canvas and the actual default size.
const grazingViews=[
 [-.18644507928306797,.49061171110132223],[.569000828299843,-.8215483422946456],
 [-.8126780526286194,-.8432483437868096],[-.6371577324970495,-.9645005467020416],
 [-2.986086815598884,.03985344337017005],[.09604898368284481,.14384343165630245],
 [2.1967801227669246,-.9380755231594577],[-2.8262499530434164,-1.1747330660160389],
 [.3844761932624149,.9840663796632341],[-2.683071432283322,.4655343511000486],
 [-Math.PI/4,-Math.PI/3]
];
for(const [i,[yaw,pitch]] of grazingViews.entries())for(const [width,height] of [[460,360],[900,700]])
 test('grazing rotation '+i+' width '+width,()=>check('grazing rotation '+i+' width '+width,
  capture(renderer.examples.ethanol,{yaw,pitch,width,height}),{required:true,dense:true}));
for(const delta of [-.0005,0,.0005]){
  sceneTest('projected external tangency '+delta,[sphere(0,0,0),sphere(2+delta,0,3,1,'O')],{dense:true});
  sceneTest('projected tangent hole '+delta,[sphere(0,0,0,2),sphere(1.5+delta,0,4,.5,'W')],{dense:true});
}
test('unrepresentable side probes cannot silently erase a region',()=>{
 const scene=[sphere(0,0,0)];
 assert.equal(boundaries.build(scene,renderer.depthAt,p=>[1e13+p[0]*40,1e13-p[1]*40],40),null);
});
console.log('Fallback cases: '+JSON.stringify(fallbackCases));
console.log(JSON.stringify({...stats,sweepAccepted,failures:failures.length,milliseconds:Math.round(performance.now()-started)}));
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('PASS analytic boundary regressions');
