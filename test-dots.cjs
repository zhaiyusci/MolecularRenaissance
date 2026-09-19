'use strict';
// Run: node test-dots.cjs. No dependencies, snapshots, or filesystem writes.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const vm = require('node:vm');
const { render, examples, depthAt } = require('./renderer.js');
const { buildDots } = require('./dots.js');
const modes = ['stipple', 'halftone'];
const stats = [], failures = [];
let passed = 0;
const started = performance.now();
function test(name, fn) {
  const t = performance.now();
  try { fn(); passed++; console.log(`PASS ${name} (${(performance.now()-t).toFixed(1)} ms)`); }
  catch (e) { failures.push({ name, error:e.stack }); console.error(`FAIL ${name}: ${e.message}`); }
}
function layer(svg, role) { return svg.match(new RegExp(`<g data-role="${role}"[^>]*>[\\s\\S]*?</g>`))?.[0] || ''; }
function circles(svg) {
  assert(!/NaN|Infinity|undefined/.test(svg), 'nonfinite or undefined SVG');
  return [...svg.matchAll(/<circle\b([^>]*)\/?\s*>/g)].map(m => {
    const attr = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1], x[2]]));
    const p = {x:Number(attr.cx), y:Number(attr.cy), r:Number(attr.r)};
    assert(Object.values(p).every(Number.isFinite) && p.r>0, 'invalid circle');
    return p;
  });
}
const dot = (a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const sub = (a,b)=>a.map((v,i)=>v-b[i]);
const unit = a=>a.map(v=>v/Math.hypot(...a));
const sphere = (c,r)=>({kind:'sphere',c,r});
const cylinder = (a,b,r)=>({kind:'cylinder',a,u:unit(sub(b,a)),length:Math.hypot(...sub(b,a)),r});
// Independent ray/closed-solid oracle. Intersect side and end planes and select
// the nearest camera-facing surface, not the primitive with the greatest center z.
function surface(s,x,y) {
  if (s.kind==='sphere') {
    const dx=x-s.c[0],dy=y-s.c[1],q=s.r*s.r-dx*dx-dy*dy;
    if(q<0)return null;
    const dz=Math.sqrt(q);
    return {p:[x,y,s.c[2]+dz], n:[dx/s.r,dy/s.r,dz/s.r]};
  }
  const origin=[x,y,0],v=sub(origin,s.a), ray=[0,0,1],ax=dot(v,s.u),az=s.u[2];
  const vp=v.map((w,i)=>w-ax*s.u[i]),dp=ray.map((w,i)=>w-az*s.u[i]);
  const A=dot(dp,dp), B=2*dot(vp,dp), C=dot(vp,vp)-s.r*s.r, candidates=[];
  if(A>1e-12 && B*B-4*A*C>=0) {
    for(const z of [(-B-Math.sqrt(B*B-4*A*C))/(2*A),(-B+Math.sqrt(B*B-4*A*C))/(2*A)]) {
      const t=ax+z*az;
      if(t>=0&&t<=s.length) {
        const p=[x,y,z],rad=sub(p,s.a).map((w,i)=>w-t*s.u[i]);
        candidates.push({p,n:unit(rad)});
      }
    }
  }
  if(Math.abs(az)>1e-12)for(const t of [0,s.length]) {
    const z=(t-ax)/az,p=[x,y,z],rad=sub(p,s.a).map((w,i)=>w-t*s.u[i]);
    if(dot(rad,rad)<=s.r*s.r+1e-12)candidates.push({p,n:s.u.map(w=>w*(t===0?-1:1))});
  }
  return candidates.sort((a,b)=>b.p[2]-a.p[2])[0]||null;
}
const scale=70, origin=[193.27,171.19];
const project=p=>[origin[0]+scale*p[0],origin[1]-scale*p[1]];
function owner(scene,x,y) {
  let best=null;
  scene.forEach((s,id)=> {
    const h=surface(s,(x-origin[0])/scale,(origin[1]-y)/scale);
    if(h&&(!best||h.p[2]>best.p[2]))best={...h,id};
  });
  return best;
}
const dirs=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
const denseDirs=Array.from({length:64},(_,i)=>[Math.cos((i+.5)*Math.PI/32),Math.sin((i+.5)*Math.PI/32)]);
function fits(scene,c,r,id,directions=dirs) {
  return [.5,1].every(k=>directions.every(([dx,dy])=>owner(scene,c.x+dx*r*k,c.y+dy*r*k)?.id===id));
}
function expectedRadius(scene,c,id,raw) {
  let r=raw;
  if(!fits(scene,c,r,id)) {
    let lo=0,hi=r;
    for(let i=0;i<9;i++){const mid=(lo+hi)/2;if(fits(scene,c,mid,id))lo=mid;else hi=mid;}
    r=lo;
  }
  return Math.floor(Math.max(0,r*Math.cos(Math.PI/16)-.003)*1000)/1000;
}
function direct(scene,mode,illum=()=>-.5,options={}) {
  return buildDots(scene,depthAt,project,scale,illum,{shadingMode:mode,...options});
}
const big=[sphere([0,0,0],2)];

test('browser UMD exports same deterministic API',()=>{
  const context={}; vm.runInNewContext(fs.readFileSync(require.resolve('./dots.js'),'utf8'),context);
  assert.equal(typeof context.MolDots.buildDots,'function');
  for(const mode of modes)assert.equal(context.MolDots.buildDots(big,depthAt,project,scale,()=>-.5,{shadingMode:mode}),direct(big,mode));
});
test('default hatch unchanged by explicit defaults / dot settings; no circles',()=>{
  const implicit=render(examples.pair),explicit=render(examples.pair,{shadingMode:'hatch',dotSpacing:5,dotSize:1,dotContrast:1.2});
  assert.equal(implicit,explicit); assert.equal(circles(implicit).length,0);
  assert.equal(implicit,render(examples.pair,{dotSpacing:14,dotSize:0,dotContrast:2.5}));
  assert(layer(implicit,'engraving').includes('<path'));
});
for(const mode of modes) {
  test(`${mode}: renderer finite/deterministic, outline only, zero switches, wash invariance`,()=>{
    const options={shadingMode:mode},t=performance.now(),svg=render(examples.ethanol,options),ms=performance.now()-t;
    const marks=circles(svg); assert(marks.length>30);
    stats.push({case:`ethanol/${mode}`,circles:marks.length,ms:+ms.toFixed(2),bytes:svg.length});
    assert.equal(svg,render(examples.ethanol,options));
    assert.match(layer(svg,'dots'),new RegExp(`^<g data-role="dots" data-mode="${mode}" fill="#[a-f0-9]+" stroke="none">`));
    const outline=layer(svg,'engraving'); assert(outline.includes('<path'));
    assert.equal(outline,layer(render(examples.ethanol,{shadingMode:'hatch',hatchWidth:0}),'engraving'));
    assert.equal(outline,layer(render(examples.ethanol,{...options,hatchWidth:4,density:60,crossHatch:false}),'engraving'));
    const zero=render(examples.ethanol,{...options,dotSize:0});
    assert.equal(circles(zero).length,0); assert.equal(layer(zero,'dots'),''); assert.equal(layer(zero,'engraving'),outline);
    const noOutline=render(examples.ethanol,{...options,outlineWidth:0});
    assert(!layer(noOutline,'engraving').includes('<path')); assert.equal(layer(noOutline,'dots'),layer(svg,'dots'));
    for(const wash of [{colorWash:true},{colorWash:true,washStrength:.9,colorSaturation:2}]) {
      assert.equal(layer(render(examples.ethanol,{...options,...wash}),'dots'),layer(svg,'dots'));
    }
    const directional=layer(render(examples.sphere,options),'dots');
    assert.notEqual(directional,layer(render(examples.sphere,{...options,lightAzimuth:1.5,lightElevation:-.4}),'dots'));
    const point=layer(render(examples.sphere,{...options,lightType:'point',lightDistance:1.3}),'dots');
    assert.notEqual(directional,point);
    assert.notEqual(point,layer(render(examples.sphere,{...options,lightType:'point',lightDistance:4,lightAzimuth:1}),'dots'));
  });
  test(`${mode}: spacing/size/contrast legal extrema and empty output`,()=>{
    for(const dotSpacing of [2,14])for(const dotSize of [0,1.5])for(const dotContrast of [.5,2.5]) {
      const svg=direct(big,mode,()=>-.5,{dotSpacing,dotSize,dotContrast});
      if(dotSize===0)assert.equal(svg,'');else assert(circles(svg).length>10);
    }
    assert.equal(direct([],mode),'');
  });
}

test('halftone: fixed 45-degree lattice, illumination changes radius not phase',()=>{
  const dark=circles(direct(big,'halftone',()=>-.8)),bright=circles(direct(big,'halftone',()=>.6));
  for(const c of [...dark,...bright]) {
    const u=(c.x+c.y)*Math.SQRT1_2/5-.5,v=(-c.x+c.y)*Math.SQRT1_2/5-.5;
    assert(Math.abs(u-Math.round(u))<.00015&&Math.abs(v-Math.round(v))<.00015,'not on fixed 45deg lattice');
  }
  const map=new Map(bright.map(c=>[`${c.x},${c.y}`,c]));let paired=0;
  for(const d of dark)if(Math.hypot(d.x-origin[0],d.y-origin[1])<110) {
    const b=map.get(`${d.x},${d.y}`);assert(b);assert(d.r>b.r);paired++;
  }
  assert(paired>500);
  stats.push({case:'halftone lattice',circles:dark.length,paired});
});
test('stipple: dark gains dot count and ink area; >= half-pitch center separation',()=>{
  const bright=circles(direct(big,'stipple',()=>.65)),dark=circles(direct(big,'stipple',()=>-.85));
  assert(dark.length>bright.length,`dark count ${dark.length} must exceed bright ${bright.length}`);
  const variable=circles(direct(big,'stipple',n=>n[0]));
  const leftMarks=variable.filter(c=>c.x<origin[0]-35),rightMarks=variable.filter(c=>c.x>origin[0]+35);
  const left=leftMarks.length,right=rightMarks.length;
  assert(left>right,'spatial dark hemisphere must be denser');
  // Actual disk union, not sum(pi*r*r): dark dots may touch or overlap.
  function inkArea(marks) {
    const bins=new Map(),cell=5,step=.5;
    for(const c of marks)for(let y=Math.floor((c.y-c.r)/cell);y<=Math.floor((c.y+c.r)/cell);y++)
      for(let x=Math.floor((c.x-c.r)/cell);x<=Math.floor((c.x+c.r)/cell);x++) {
        const key=`${x},${y}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(c);
      }
    let ink=0;
    for(let y=origin[1]-140+step/2;y<origin[1]+140;y+=step)
      for(let x=origin[0]-140+step/2;x<origin[0]+140;x+=step)
        if((bins.get(`${Math.floor(x/cell)},${Math.floor(y/cell)}`)||[]).some(c=>(x-c.x)**2+(y-c.y)**2<=c.r*c.r))ink++;
    return ink*step*step;
  }
  const brightInk=inkArea(bright),darkInk=inkArea(dark),leftInk=inkArea(leftMarks),rightInk=inkArea(rightMarks);
  assert(darkInk>brightInk,`dark union ink ${darkInk} must exceed bright ${brightInk}`);
  assert(leftInk>rightInk,`spatial dark union ink ${leftInk} must exceed bright ${rightInk}`);
  let min=Infinity;
  for(let i=0;i<dark.length;i++)for(let j=i+1;j<dark.length;j++)min=Math.min(min,Math.hypot(dark[i].x-dark[j].x,dark[i].y-dark[j].y));
  assert(min>=2.5-.002,`min spacing ${min}`);
  stats.push({case:'stipple tone/spacing',bright:bright.length,dark:dark.length,brightInk,darkInk,left,right,leftInk,rightInk,minDistance:+min.toFixed(6)});
});

const scenes={
  'overlapping spheres':[sphere([0,0,-.3],2),sphere([.5,.2,1.65],.65)],
  'transverse cylinder':[sphere([0,0,-.3],2),cylinder([-1.55,.12,2.15],[1.5,.38,2.15],.26)],
  'oblique cylinder':[sphere([0,0,-.3],2),cylinder([-.85,-1.1,1.55],[.75,1.2,2.6],.33)],
  'end-on cylinder':[cylinder([0,0,-.4],[0,0,1.4],1.3)],
  'rear sphere/front cap':[sphere([0,0,-.3],2),cylinder([.37,.21,1.5],[.37,.21,2.5],.52)]
};
for(const [name,scene] of Object.entries(scenes))for(const mode of modes) {
  test(`${mode}: independent nearest-surface normal + disk occlusion / ${name}`,()=>{
    const light=unit([-.4,.3,-.65]);let callbacks=0;
    const illum=(n,p)=> {
      const h=owner(scene,...project(p)); assert(h,'illumination called on background');
      assert(Math.abs(h.p[2]-p[2])<1e-7,'wrong nearest surface depth');
      assert(Math.hypot(...sub(h.n,n))<1e-6,'wrong nearest surface normal');callbacks++;
      return dot(h.n,light);
    };
    const options={dotSpacing:5,dotSize:1.5,dotContrast:1.2};
    const t=performance.now(),svg=direct(scene,mode,illum,options),elapsed=performance.now()-t;
    const marks=circles(svg);assert(marks.length>30);assert(callbacks>=marks.length);
    assert.equal(svg,direct(scene,mode,illum,options));
    const owners=new Set(), denseFailures=[];let shrunk=0;
    for(const c of marks) {
      const h=owner(scene,c.x,c.y);assert(h,'point center in background');owners.add(h.id);
      // 0.005 SVG-unit tolerance covers serialized centers/radii near boundaries.
      assert(fits(scene,c,Math.max(0,c.r-.005),h.id),`disk crosses owner/background at ${JSON.stringify(c)}`);
      if(!fits(scene,c,Math.max(0,c.r-.005),h.id,denseDirs))denseFailures.push(c);
      // Independent oracle uses the reconstructed nearest-surface normal.
      const clamp01=x=>Math.max(0,Math.min(1,x)),lit=Math.max(-1,Math.min(1,dot(h.n,light)));
      const shade=Math.pow(clamp01((.92-lit)/1.92),options.dotContrast);
      const rim=(1-clamp01(h.n[2]))**2;
      const tone=Math.pow(clamp01((.94-lit)/1.5+.08*rim),options.dotContrast);
      const probability=Math.min(1,1.7*Math.sqrt(tone)),coverage=.58*tone,g=options.dotSpacing;
      const raw=mode==='stipple'
        ?Math.min(g*Math.sqrt(coverage/(Math.PI*.83*probability))*options.dotSize,g*.48)
        :Math.min(g*.48*options.dotSize*Math.sqrt(shade),g*.48);
      const expected=expectedRadius(scene,c,h.id,raw);
      assert(Math.abs(c.r-expected)<=.005+1e-9,`radius ${c.r} expected ${expected} at ${JSON.stringify(c)}`);
      if(c.r<raw*Math.cos(Math.PI/16)-.018)shrunk++;
    }
    assert.equal(owners.size,scene.length,'each visible primitive needs dots');assert(shrunk>0,'boundary shrinking must be exercised');
    stats.push({case:`${name}/${mode}`,circles:marks.length,shrunk,denseLeaks:denseFailures.length,ms:+elapsed.toFixed(2)});
    // Force foreground bright and background dark: hidden back-surface dots
    // must never shine through the foreground, even if it emits no dots itself.
    if(scene.length>1) {
      // At lit=1, stipple's rim term can still emit genuine foreground marks.
      // Contrast 2.5 makes even its maximum tone (.04^2.5) < .006, so
      // this fixture really has a blank foreground; keep the strict owner test.
      const blankOptions=mode==='stipple'?{...options,dotContrast:2.5}:options;
      const blankFront=circles(direct(scene,mode,(n,p)=>owner(scene,...project(p)).id===0?-1:1,blankOptions));
      assert(blankFront.length>30);
      for(const c of blankFront)assert.equal(owner(scene,c.x,c.y)?.id,0,'hidden rear mark leaked through bright foreground');
    }
    assert.equal(denseFailures.length,0,`64-direction disk crosses owner/background; first ${JSON.stringify(denseFailures[0])}`);
  });
}

test('unknown modes, nonnumeric/out-of-range options and invalid scale rejected',()=>{
  for(const mode of ['unknown','STIPPLE','',null,0]) {
    assert.throws(()=>render(examples.sphere,{shadingMode:mode}));
    assert.throws(()=>direct(big,mode));
  }
  assert.throws(()=>direct(big,'hatch'));
  const bad={dotSpacing:[1.999,14.001,0,-1,NaN,Infinity,-Infinity,'5',null,undefined],dotSize:[-.001,1.501,NaN,Infinity,'1',null,undefined],dotContrast:[.499,2.501,NaN,Infinity,'1.2',null,undefined]};
  for(const [key,values] of Object.entries(bad))for(const value of values) {
    for(const shadingMode of ['hatch',...modes])assert.throws(()=>render(examples.sphere,{shadingMode,[key]:value}),`${shadingMode}/${key}=${value}`);
    for(const mode of modes)assert.throws(()=>direct(big,mode,()=>0,{[key]:value}));
  }
  for(const s of [0,-1,NaN,Infinity])assert.throws(()=>buildDots(big,depthAt,project,s,()=>0,{shadingMode:'stipple'}));
});
console.log('\nCOUNTS / PERFORMANCE (informational, no machine-specific time limits)');
console.table(stats);
console.log(`\n${passed} passed, ${failures.length} failed; total ${(performance.now()-started).toFixed(1)} ms`);
console.log('Hatch compatibility is checked against explicit current defaults; no historical SVG snapshot is available.');
if(failures.length){for(const f of failures)console.error(`\n${f.name}\n${f.error}`);process.exitCode=1;}
