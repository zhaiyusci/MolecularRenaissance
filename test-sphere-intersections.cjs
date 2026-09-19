'use strict';
// Scientific-radius overlap oracle. Uses built public modules by default.
// SPHERE_SOURCE=1 transpiles sources in memory during concurrent build work.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const cache=new Map();
function source(name){
  const file=path.resolve(__dirname,'src',name.replace(/\.js$/,'.ts'));
  if(cache.has(file))return cache.get(file).exports;
  const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;cache.set(file,mod);
  mod.require=id=>id.startsWith('./')?source(id):require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
  return mod.exports;
}
const B=process.env.SPHERE_SOURCE?source('boundaries.js'):require('./boundaries.js');
const {depthAt,examples}=process.env.SPHERE_SOURCE?{...source('scene.js'),...source('examples.js')}:require('./renderer.js');
const TAU=2*Math.PI,scale=60,project=p=>[350+p[0]*scale,350-p[1]*scale];
const stats={frames:0,union:0,owners:0,limbs:0,hatches:0,covered:0};
const sphere=(c,r=.76,element='C')=>({kind:'sphere',c,r,element});
function rod(a,b,r=.14){const v=b.map((x,k)=>x-a[k]),length=Math.hypot(...v);return {kind:'cylinder',a,u:v.map(x=>x/length),length,r};}
// Independent ray oracle; cylinder equation formed via cross products.
function ray(s,x,y){
  if(s.kind==='sphere'){const q=s.r*s.r-(x-s.c[0])**2-(y-s.c[1])**2;return q < -1e-12?-Infinity:s.c[2]+Math.sqrt(Math.max(0,q));}
  const wx=x-s.a[0],wy=y-s.a[1],[ux,uy,uz]=s.u,A=ux*ux+uy*uy,B=-2*uz*(wx*ux+wy*uy),C=uz*uz*(wx*wx+wy*wy)+(wx*uy-wy*ux)**2-s.r*s.r;
  let best=-Infinity;
  if(A>1e-24){const d=B*B-4*A*C;if(d>=-1e-12)for(const z of [(-B-Math.sqrt(Math.max(0,d)))/(2*A),(-B+Math.sqrt(Math.max(0,d)))/(2*A)]){const t=wx*ux+wy*uy+z*uz;if(t>=-1e-9&&t<=s.length+1e-9)best=Math.max(best,s.a[2]+z);}}
  if(Math.abs(uz)>1e-14)for(const t of [0,s.length]){const z=(t-wx*ux-wy*uy)/uz;if((wx-t*ux)**2+(wy-t*uy)**2+(z-t*uz)**2<=s.r*s.r+1e-12)best=Math.max(best,s.a[2]+z);}
  return best;
}
function nearest(scene,x,y,exclude=-1){let z=-Infinity,id=-1;scene.forEach((s,i)=>{if(i===exclude)return;const d=ray(s,x,y);if(Number.isFinite(d)&&(d>z||(d===z&&s.kind==='cylinder'))){z=d;id=i;}});return {z,id};}
const member=(runs,t)=>runs.some(([a,b])=>[t,t+TAU,t+2*TAU].some(v=>v>=a&&v<=b));
function limbRuns(svg,s){const c=project(s.c),out=[];for(const m of svg.matchAll(/ d="([^"]+)"/g)){let lo,last;for(const p of m[1].matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)){let t=(Math.atan2(c[1]-Number(p[2]),Number(p[1])-c[0])+TAU)%TAU;if(last===undefined)lo=t;else while(t<last-1e-4)t+=TAU;last=t;}out.push([lo,last]);}return out;}
function polygons(svg){return [...svg.matchAll(/ d="([^"]+)"/g)].flatMap(m=>m[1].split('Z').filter(Boolean).map(loop=>[...loop.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(p=>[+p[1],+p[2]])));}
function inside(poly,x,y){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
let seed=0x76543210;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function verify(label,scene){
  const begin=performance.now(),a=B.build(scene,depthAt,project,scale);assert.ok(a,label+' build');
  assert.ok(a.validate(()=> '#336699'),label+' topology');
  const wash=a.wash(()=> '#336699',true);assert.ok(wash,label+' wash');const polys=polygons(wash);
  // Unique element labels exercise every sphere/sphere color seam, not only union.
  scene.filter(s=>s.kind==='sphere').forEach((s,i)=>{s.element=String(i);});
  const color=e=>'#'+(0x100000+Number(e)*137).toString(16),colored=a.wash(color,true);
  assert.ok(colored,label+' independently colored topology');
  const colorPolys=[...colored.matchAll(/<path fill="([^"]+)"[^>]* d="([^"]+)"/g)].map(m=>({color:m[1],loops:polygons(' d="'+m[2]+'"')}));
  const regions=a.dotRegions();assert.ok(regions,label+' owner regions');
  const pixelOwner=(x,y)=>nearest(scene,(x-350)/scale,(350-y)/scale).id;
  const balls=scene.filter(s=>s.kind==='sphere');
  for(let n=0;n<2000;n++){
    const x=350+(random()*10-5)*scale,y=350+(random()*10-5)*scale,id=pixelOwner(x,y);
    if(Array.from({length:8},(_,k)=>pixelOwner(x+.04*Math.cos(k*TAU/8),y+.04*Math.sin(k*TAU/8))).some(i=>i!==id))continue;
    assert.equal(polys.reduce((v,p)=>v!==inside(p,x,y),false),id>=0,label+' union');
    const hits=colorPolys.filter(p=>p.loops.reduce((v,l)=>v!==inside(l,x,y),false));
    assert.equal(hits.length,id>=0?1:0,label+' color partition');
    if(id>=0)assert.equal(hits[0].color,color(scene[id].element),label+' color owner');stats.union++;
  }
  for(const s of balls){const id=scene.indexOf(s),runs=limbRuns(a.outline(s,true,.8),s);
    for(let k=0;k<360;k++){
      const t=(k+.371)*TAU/360,p=[s.c[0]+s.r*Math.cos(t),s.c[1]+s.r*Math.sin(t)],gap=nearest(scene,...p,id).z-s.c[2];
      if(Math.abs(gap-.00015)<.0003||runs.some(([lo,hi])=>[t,t+TAU,t+2*TAU].some(v=>Math.min(Math.abs(v-lo),Math.abs(v-hi))<.002)))continue;
      assert.equal(member(runs,t),gap<=.00015,label+' limb '+id);stats.limbs++;
    }
    for(let k=0;k<80;k++){
      const t=random()*TAU,r=Math.sqrt(random())*s.r*.999,p=project([s.c[0]+r*Math.cos(t),s.c[1]+r*Math.sin(t),0]),expected=pixelOwner(...p),q=regions.query(...p,1);
      if(!q){const safe=Array.from({length:16},(_,k)=>pixelOwner(p[0]+.03*Math.cos(k*TAU/16),p[1]+.03*Math.sin(k*TAU/16))).every(i=>i===expected);assert.ok(!safe,label+' missing owner');continue;}
      assert.equal(q.id,expected,label+' raw owner');stats.owners++;
    }
    for(const h of [.15,.55,.85])for(const tilt of [0,.6]){
      const rr=s.r*Math.sqrt(1-h*h),axis=[Math.sin(tilt),0,Math.cos(tilt)],center=s.c.map((v,i)=>v+h*s.r*axis[i]),u=[rr*Math.cos(tilt),0,-rr*Math.sin(tilt)],v=[0,rr,0];
      const clips=a.clipCircle(s,center,u,v);assert.notEqual(clips,null,label+' hatch fallback '+id);
      for(let k=0;k<180;k++){
        const t=(k+.371)/180,angle=t*TAU,p=center.map((x,i)=>x+u[i]*Math.cos(angle)+v[i]*Math.sin(angle)),gap=nearest(scene,p[0],p[1],id).z-p[2],front=p[2]-s.c[2];
        if(Math.abs(gap)<1e-7||Math.abs(front)<1e-7||clips.some(([lo,hi])=>Math.min(Math.abs(t-lo),Math.abs(t-hi))<1e-5))continue;
        assert.equal(clips.some(([lo,hi])=>t>=lo&&t<=hi),front>=0&&gap<=1e-9,label+' hatch '+id+' t='+t);stats.hatches++;
      }
    }
  }
  for(const s of scene.filter(s=>s.kind==='cylinder')){const edge=[-s.u[1],s.u[0],0],l=Math.hypot(...edge);if(!l)continue;const p=s.a.map((v,i)=>v+edge[i]*s.r/l),q=p.map((v,i)=>v+s.length*s.u[i]);assert.deepEqual(a.clipLine(s,p,q),[],label+' covered rod');stats.covered++;}
  stats.frames++;console.log('PASS '+label+' '+Math.round(performance.now()-begin)+'ms '+a.curveCount+' carriers');
}
verify('oblique partial overlap',[sphere([0,0,0],1),sphere([1,0,.4],1,'O')]);
verify('edge-on seam',[sphere([0,0,0],1),sphere([1,0,0],1,'O')]);
verify('unequal radii',[sphere([0,0,0],1),sphere([.8,.3,.5],.7,'O')]);
verify('camera aligned seam',[sphere([0,0,0],1),sphere([0,0,.8],1,'O')]);
verify('covered rod preserves raw IDs',[sphere([0,0,0]),rod([0,0,0],[1.2,.2,.1]),sphere([1.2,.2,.1],.76,'O')]);
verify('exact-axis covered rod',[sphere([0,0,0]),rod([0,0,0],[0,0,1.2]),sphere([0,0,1.2],.76,'O')]);
// Mathematical containment alone cannot certify the legacy near-axis ray band.
for(const x of [1e-5,1e-4,3e-4]){
  const a=[0,0,0],b=[x,0,1.2],c=rod(a,b),scene=[sphere(a),c,sphere(b)];
  assert.ok(2*Math.sqrt(.76**2-c.r**2)>c.length+1e-8,'fixture is geometrically covered');
  assert.equal(B.build(scene,depthAt,project,scale),null,'near-axis covered rod retains numerical fallback');
}
function rotated(p,yaw,pitch){const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);return [x,p[1]*Math.cos(pitch)-z*Math.sin(pitch),p[1]*Math.sin(pitch)+z*Math.cos(pitch)];}
for(const [yaw,pitch] of [[0,0],[Math.PI/4,0],[Math.PI/2,0],[.25,-.16],[.73,.42],[1.21,-.73]]){
  const balls=examples.c60.atoms.map(a=>sphere(rotated(a.position,yaw,pitch))),scene=[...balls,...examples.c60.bonds.map(([i,j])=>rod(balls[i].c,balls[j].c))];
  verify('C60 '+yaw+','+pitch,scene);
}
for(const scene of [[sphere([0,0,0]),sphere([0,0,0])],[sphere([0,0,0],2),sphere([.1,0,0],.5)],[sphere([0,0,0],1),sphere([2,0,0],1)]])assert.equal(B.build(scene,depthAt,project,scale),null,'degenerate fallback');
if(process.env.SPHERE_SWEEP){
  const views=[];for(let pitch=-60;pitch<=60;pitch+=30)for(let yaw=0;yaw<=180;yaw+=15)views.push([yaw,pitch]);
  for(let yaw=-180;yaw<=180;yaw++)views.push([yaw,0]);
  for(let i=0;i<40;i++)views.push([Math.round(random()*360-180),Math.round(random()*180-90)]);
  for(const [yaw,pitch] of views){
    const balls=examples.c60.atoms.map(a=>sphere(rotated(a.position,yaw*Math.PI/180,pitch*Math.PI/180))),scene=[...balls,...examples.c60.bonds.map(([i,j])=>rod(balls[i].c,balls[j].c))],a=B.build(scene,depthAt,project,scale);
    assert.ok(a,`rotation build ${yaw},${pitch}`);assert.ok(a.validate(()=> '#336699'),`rotation wash ${yaw},${pitch}`);assert.ok(a.dotRegions(),`rotation owners ${yaw},${pitch}`);
  }
  console.log('PASS '+views.length+' scientific C60 analytic rotations');
}
console.log(JSON.stringify(stats));
