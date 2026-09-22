'use strict';
// Run: node test-dots.cjs. No dependencies, snapshots, or filesystem writes.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const vm = require('node:vm');
const { render, examples, depthAt } = require('./renderer.js');
const { buildDots } = require('./dots.js');
const {marks:artwork,coverage}=require('./test-style-coverage.cjs');
const modes = ['stipple', 'halftone'];
const renderOptions={width:260,height:220,scale:22,quality:'preview'};
const draw=(m,o={})=>render(m,{...renderOptions,...o});
const stats = [], failures = [];
let passed = 0;
const started = performance.now();
function test(name, fn) {
  const t = performance.now();
  try { fn(); passed++; console.log(`PASS ${name} (${(performance.now()-t).toFixed(1)} ms)`); }
  catch (e) { failures.push({ name, error:e.stack }); console.error(`FAIL ${name}: ${e.message}`); }
}
function layer(svg,role){
  const start=svg.indexOf(`<g data-role="${role}"`);if(start<0)return '';
  let depth=0;for(const m of svg.slice(start).matchAll(/<\/?g\b[^>]*>/g)){
    depth+=m[0].startsWith('</')?-1:1;if(depth===0)return svg.slice(start,start+m.index+m[0].length);
  }
  throw Error('unclosed artwork group');
}
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function circles(svg) {
  assert(!/NaN|Infinity|undefined/.test(svg), 'nonfinite or undefined SVG');
  const painted=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/g,'');
  const out=[...painted.matchAll(/<circle\b([^>]*)\/?\s*>/g)].map(m=>{
    const a=attrs(m[1]);return {x:+a.cx,y:+a.cy,r:+a.r};
  });
  for(const m of painted.matchAll(/<path\b[^>]*data-stipple-radius="[^"]+"[^>]*\/>/g)){
    const a=attrs(m[0]);assert.equal(a['stroke-linecap'],'round');assert.equal(a.stroke,'#161616');assert.equal(a.fill,'none');
    const r=+a['data-stipple-radius'];assert.equal(+a['stroke-width'],2*r);
    const points=[...a.d.matchAll(/M([-\d.]+) ([-\d.]+)h0/g)];
    assert.equal(points.map(p=>p[0]).join(''),a.d,'only isolated round-cap disks');
    for(const p of points)out.push({x:+p[1],y:+p[2],r});
  }
  for(const p of out)assert(Object.values(p).every(Number.isFinite)&&p.r>0,'invalid painted disk');
  return out;
}
function patterns(svg){
  assert(!/NaN|Infinity|undefined/.test(svg),'finite halftone');
  const out=[...svg.matchAll(/<pattern\b([^>]*)>([\s\S]*?)<\/pattern>/g)].map(m=>({a:attrs(m[1]),disks:[...m[2].matchAll(/<circle\b[^>]*\/>/g)].map(c=>attrs(c[0]))}));
  assert(out.length>0&&out.length<=16,'bounded tone definitions');
  const ids=new Set(out.map(p=>p.a.id));let previous=0;
  for(const {a,disks} of out){
    assert.equal(a.patternTransform,'rotate(45)');assert.equal(a.patternUnits,'userSpaceOnUse');
    const pitch=+a.width;assert(pitch>0&&pitch===+a.height);assert(disks.length>0);
    const r=+disks[0].r;assert(r>=previous);previous=r;
    for(const d of disks){assert.equal(+d.r,r);for(const k of ['cx','cy'])assert(Math.abs(+d[k]/pitch-.5-Math.round(+d[k]/pitch-.5))*pitch<.0002,'fixed lattice phase');}
    assert.equal(disks.length,r>pitch/2?9:1,'periodic disks wrap at tile edge');
  }
  const painted=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/g,'');
  assert.equal(circles(svg).length,0,'definition circles are not halftone artwork');
  const rects=[...painted.matchAll(/<rect\b[^>]*data-tone-level="[^\"]+"[^>]*\/>/g)];assert(rects.length>0,'patterns are actually painted');
  for(const rect of rects)assert(ids.has(/^url\(#([^)]*)\)$/.exec(attrs(rect[0]).fill)?.[1]),'paint server resolves');
  assert(artwork(svg).length>0,'independent parser resolves tone AND silhouette clips');
  return out;
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
// Explicit small physical projection bounds numerical fallback work; tests
// still exercise all five distinct solids, not a skipped slow-case subset.
const scale=22, origin=[83.27,71.19];
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
const oracleDirs=Array.from({length:256},(_,i)=>[Math.cos((i+.5)*2*Math.PI/256),Math.sin((i+.5)*2*Math.PI/256)]);
function fits(scene,c,r,id,directions=dirs) {
  return [.5,1].every(k=>directions.every(([dx,dy])=>owner(scene,c.x+dx*r*k,c.y+dy*r*k)?.id===id));
}
function expectedRadius(scene,c,id,raw) {
  let r=raw;
  // Independent staggered 256-direction oracle, not the production fallback
  // stencil. Same serialization tolerance is retained by the caller.
  if(!fits(scene,c,r,id,oracleDirs)) {
    let lo=0,hi=r;
    for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(fits(scene,c,mid,id,oracleDirs))lo=mid;else hi=mid;}
    r=lo;
  }
  return Math.floor(Math.min(raw/1.03,Math.max(0,r*Math.cos(Math.PI/16)-.003*Math.min(1,raw/1.03)))*1000)/1000;
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
  const implicit=draw(examples.pair),explicit=draw(examples.pair,{shadingMode:'hatch',dotSpacing:5,dotSize:1,dotContrast:1.2});
  // Inactive dot controls enter the layered ID hash, not its actual geometry.
  const canonical=s=>{const ids=[...new Set(s.match(/\blh-[a-z0-9]+-[a-z0-9]+(?=-)/g)||[])];assert(ids.length<=1);return ids.length?s.split(ids[0]).join('lh-NAMESPACE'):s;};
  assert.equal(canonical(implicit),canonical(explicit)); assert.equal(circles(implicit).length,0);
  assert.equal(canonical(implicit),canonical(draw(examples.pair,{dotSpacing:14,dotSize:0,dotContrast:2.5})));
  assert(/<(?:path|use)\b/.test(layer(implicit,'engraving')));
});
for(const mode of modes) {
  test(`${mode}: renderer finite/deterministic, outline only, zero switches, wash invariance`,()=>{
    const options={shadingMode:mode},t=performance.now(),svg=draw(examples.ethanol,options),ms=performance.now()-t;
    const marks=mode==='stipple'?circles(svg):patterns(svg);assert(marks.length>(mode==='stipple'?30:0));
    stats.push({case:`ethanol/${mode}`,marks:marks.length,ms:+ms.toFixed(2),bytes:svg.length});
    assert.equal(svg,draw(examples.ethanol,options));
    assert.match(layer(svg,'dots'),new RegExp(`^<g data-role="dots" data-mode="${mode}"`));
    if(mode==='stipple')assert(layer(svg,'dots').includes('fill="#161616"'));
    const outline=layer(svg,'engraving'); assert(outline.includes('<path'));
    assert.equal(outline,layer(draw(examples.ethanol,{shadingMode:'hatch',hatchMode:'continuous',hatchWidth:0}),'engraving'));
    assert.equal(outline,layer(draw(examples.ethanol,{...options,hatchWidth:4,density:60,crossHatch:false}),'engraving'));
    const zero=draw(examples.ethanol,{...options,dotSize:0});
    assert.equal(circles(zero).length,0); assert.equal(layer(zero,'dots'),''); assert.equal(layer(zero,'engraving'),outline);
    const noOutline=draw(examples.ethanol,{...options,outlineWidth:0});
    assert(!layer(noOutline,'engraving').includes('<path')); assert.equal(layer(noOutline,'dots'),layer(svg,'dots'));
    for(const wash of [{colorWash:true},{colorWash:true,washStrength:.9,colorSaturation:2}]) {
      assert.equal(layer(draw(examples.ethanol,{...options,...wash}),'dots'),layer(svg,'dots'));
    }
    const directional=layer(draw(examples.sphere,options),'dots');
    assert.notEqual(directional,layer(draw(examples.sphere,{...options,lightAzimuth:1.5,lightElevation:-.4}),'dots'));
  });
  test(`${mode}: spacing/size/contrast legal extrema and empty output`,()=>{
    for(const dotSpacing of [.3,19])for(const dotSize of [0,4])for(const dotContrast of [.5,2.5]) {
      const svg=direct([sphere([0,0,0],.8)],mode,()=>-.5,{dotSpacing,dotSize,dotContrast});
      if(dotSize===0)assert.equal(svg,'');else if(mode==='stipple')assert(circles(svg).length>0);else patterns(svg);
    }
    assert.equal(direct([],mode),'');
  });
}

test('halftone: fixed 45-degree pattern phase, quantized union ink and contrast',()=>{
  const dark=direct(big,'halftone',()=>-.8),bright=direct(big,'halftone',()=>.6);
  const d=patterns(dark),b=patterns(bright);
  for(const key of ['width','height','x','y','patternTransform'])assert.equal(d[0].a[key],b[0].a[key],'light does not change lattice');
  assert(+d.at(-1).disks[0].r>+b.at(-1).disks[0].r,'dark tone expands periodic disks');
  const box=[origin[0]-20,origin[1]-20,origin[0]+20,origin[1]+20];
  const darkInk=coverage(dark,box),brightInk=coverage(bright,box);
  for(const [actual,lit] of [[darkInk,-.8],[brightInk,.6]])assert(Math.abs(actual-((1-lit)/2)**1.2)<1/32+.008,'16-level quantization of physical union ink');
  assert(darkInk>brightInk);
  const low=coverage(direct(big,'halftone',()=>0,{dotContrast:.5}),box),high=coverage(direct(big,'halftone',()=>0,{dotContrast:2.5}),box);
  assert(low>high,'contrast exponent changes physical coverage');
  stats.push({case:'halftone lattice/union',darkInk,brightInk,low,high});
});
test('stipple: Poisson count/union tone, equal interior radii, overlapping candidates',()=>{
  const bright=circles(direct(big,'stipple',()=>.65)),dark=circles(direct(big,'stipple',()=>-.85));
  assert(dark.length>bright.length,`dark count ${dark.length} must exceed bright ${bright.length}`);
  const variable=circles(direct(big,'stipple',n=>n[0]));
  const leftMarks=variable.filter(c=>c.x<origin[0]-10),rightMarks=variable.filter(c=>c.x>origin[0]+10);
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
    for(let y=origin[1]-44+step/2;y<origin[1]+44;y+=step)
      for(let x=origin[0]-44+step/2;x<origin[0]+44;x+=step)
        if((bins.get(`${Math.floor(x/cell)},${Math.floor(y/cell)}`)||[]).some(c=>(x-c.x)**2+(y-c.y)**2<=c.r*c.r))ink++;
    return ink*step*step;
  }
  const brightInk=inkArea(bright),darkInk=inkArea(dark),leftInk=inkArea(leftMarks),rightInk=inkArea(rightMarks);
  assert(darkInk>brightInk,`dark union ink ${darkInk} must exceed bright ${brightInk}`);
  assert(leftInk>rightInk,`spatial dark union ink ${leftInk} must exceed bright ${rightInk}`);
  // Independent Poisson sampling is not a hard-core jitter lattice: nearby
  // marks can overlap. Spatial buckets avoid the former quadratic all-pairs test.
  const buckets=new Map();let overlaps=0;
  for(const c of dark){
    const i=Math.floor(c.x),j=Math.floor(c.y);
    for(let y=j-1;y<=j+1;y++)for(let x=i-1;x<=i+1;x++)for(const p of buckets.get(`${x},${y}`)||[])if(Math.hypot(c.x-p.x,c.y-p.y)<c.r+p.r)overlaps++;
    const key=`${i},${j}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);
    if(Math.hypot(c.x-origin[0],c.y-origin[1])<40)assert.equal(c.r,.5,'interior disks have fixed physical radius');
  }
  assert(overlaps>0,'Poisson screen has overlapping marks, not forced lattice separation');
  const box=[origin[0]-20,origin[1]-20,origin[0]+20,origin[1]+20];
  const low=coverage(direct(big,'stipple',()=>0,{dotContrast:.5}),box),high=coverage(direct(big,'stipple',()=>0,{dotContrast:2.5}),box);
  assert(low>high,'contrast controls union ink');
  stats.push({case:'stipple Poisson tone',bright:bright.length,dark:dark.length,brightInk,darkInk,left,right,leftInk,rightInk,overlaps,low,high});
});

const scenes={
  'overlapping spheres':[sphere([0,0,-.3],2),sphere([.5,.2,1.65],.65)],
  'transverse cylinder':[sphere([0,0,-.3],2),cylinder([-1.55,.12,2.15],[1.5,.38,2.15],.26)],
  'oblique cylinder':[sphere([0,0,-.3],2),cylinder([-.85,-1.1,1.55],[.75,1.2,2.6],.33)],
  'end-on cylinder':[cylinder([0,0,-.4],[0,0,1.4],1.3)],
  'rear sphere/front cap':[sphere([0,0,-.3],2),cylinder([.37,.21,1.5],[.37,.21,2.5],.52)]
};
test('fallback regression: transverse rod corner cannot intrude into rear sphere disk',()=>{
  // Existing optimization baseline emitted radius .462 here: one diagonal
  // clips the finite rod corner between the former 16 angular sample rays.
  const scene=scenes['transverse cylinder'],light=unit([-.4,.3,-.65]);
  const svg=direct(scene,'stipple',n=>dot(n,light),{dotSpacing:3,dotSize:.6,dotContrast:1.2});
  const c=circles(svg).find(c=>c.x===116.816&&c.y===68.978);
  assert(c,'fix must preserve the Poisson candidate, not remove all edge marks');
  const h=owner(scene,c.x,c.y);assert.equal(h?.id,0,'rear sphere owns this center');
  assert(fits(scene,c,Math.max(0,c.r-.005),h.id,oracleDirs),'256 staggered footprint probes find no rod-corner intrusion');
  assert(c.r>.4&&c.r<.457,'local boundary correction, not global dot shrink');
});
for(const [name,scene] of Object.entries(scenes))for(const mode of modes) {
  test(`${mode}: independent nearest-surface normal + painted ownership / ${name}`,()=>{
    const light=unit([-.4,.3,-.65]);let callbacks=0;
    const illum=(n,p)=> {
      const h=owner(scene,...project(p));assert(h,'illumination called on background');
      assert(Math.abs(h.p[2]-p[2])<1e-7,'wrong nearest surface depth');
      assert(Math.hypot(...sub(h.n,n))<1e-6,'wrong nearest surface normal');callbacks++;
      return dot(h.n,light);
    };
    const options={dotSpacing:3,dotSize:.6,dotContrast:1.2};
    const t=performance.now(),svg=direct(scene,mode,illum,options),elapsed=performance.now()-t;
    assert(callbacks>30,'nonvacuous nearest-surface lighting queries');
    assert.equal(svg,direct(scene,mode,illum,options));
    const owners=new Set();let shrunk=0,painted=0;
    if(mode==='stipple'){
      const disks=circles(svg);assert(disks.length>30);
      for(const c of disks){
        const h=owner(scene,c.x,c.y);assert(h,'disk center in background');owners.add(h.id);
        // Keep the original serialization budget and 64 staggered directions.
        assert(fits(scene,c,Math.max(0,c.r-.005),h.id,denseDirs),`disk crosses owner/background at ${JSON.stringify(c)}`);
        const expected=expectedRadius(scene,c,h.id,options.dotSize*1.03);
        assert(c.r<=options.dotSize&&c.r>=expected-.005-1e-9,`radius ${c.r} over-shrunk below independently safe ${expected} at ${JSON.stringify(c)}`);
        // Different angular stencils may conservatively contract different
        // amounts. A larger radius is acceptable only if its FINAL physical
        // disk independently clears all 256 staggered probes, not by equality
        // with a copied production sampling recipe.
        assert(fits(scene,c,Math.max(0,c.r-.005),h.id,oracleDirs),`256-direction disk crosses owner/background at ${JSON.stringify(c)}`);
        if(c.r<options.dotSize-.018)shrunk++;
      }
      assert(shrunk>0,'conservative boundary shrinking exercised');painted=disks.length;
    }else{
      patterns(svg);const ink=artwork(svg);
      // Sample actual referenced/clipped pattern ink, never circles in defs.
      for(let y=origin[1]-46+.317;y<origin[1]+46;y+=.71)for(let x=origin[0]-46+.193;x<origin[0]+46;x+=.71){
        if(!ink.some(m=>m.contains(x,y)))continue;
        const h=owner(scene,x,y);assert(h,'halftone paint outside physical union silhouette');owners.add(h.id);painted++;
      }
      assert(painted>30);
    }
    assert.equal(owners.size,scene.length,'each visible primitive receives actual ink');
    if(scene.length>1){
      const blank=direct(scene,mode,(n,p)=>owner(scene,...project(p)).id===0?-1:1,options);
      if(mode==='stipple'){
        const disks=circles(blank);assert(disks.length>30);
        for(const c of disks){
          const h=owner(scene,c.x,c.y);assert(h);assert(fits(scene,c,Math.max(0,c.r-.005),h.id,denseDirs),'blank-front disk still respects whole-disk ownership');
          // Poisson tone is sampled once at the owning screen cell center.
          // A boundary cell can straddle two owners; that is tone sampling,
          // not a hidden rear disk. Interior foreground cells must be blank.
          const possible=[];
          // Serialized .001 coordinates can round across a grid boundary.
          for(const dx of [-.000501,.000501])for(const dy of [-.000501,.000501]){
            const x=(Math.floor((c.x+dx)/options.dotSpacing)+.5)*options.dotSpacing,y=(Math.floor((c.y+dy)/options.dotSpacing)+.5)*options.dotSpacing;
            possible.push(owner(scene,x,y)?.id);
          }
          assert(possible.includes(0),'lit foreground cell emitted stipple');
        }
      }else{
        patterns(blank);const ink=artwork(blank);let foreground=0,backgroundInk=0;
        for(let y=origin[1]-44+.317;y<origin[1]+44;y+=.71)for(let x=origin[0]-44+.193;x<origin[0]+44;x+=.71){
          const h=owner(scene,x,y);if(!h)continue;
          const painted=ink.some(m=>m.contains(x,y));if(h.id===0){if(painted)backgroundInk++;continue;}
          // Numerical tone contours use a one-unit discovery grid. Only
          // independently verified interior points avoid its boundary band.
          if(!fits(scene,{x,y},1.5,h.id,denseDirs))continue;
          foreground++;assert(!painted,'hidden rear pattern shines through bright foreground interior');
        }
        assert(foreground>20&&backgroundInk>30,'nonvacuous blank foreground and dark background');
      }
    }
    stats.push({case:`${name}/${mode}`,painted,shrunk,callbacks,ms:+elapsed.toFixed(2)});
  });
}

test('unknown modes, nonnumeric/out-of-range options and invalid scale rejected',()=>{
  for(const mode of ['unknown','STIPPLE','',null,0]) {
    assert.throws(()=>draw(examples.sphere,{shadingMode:mode}));
    assert.throws(()=>direct(big,mode));
  }
  assert.throws(()=>direct(big,'hatch'));
  const bad={dotSpacing:[.299,19.001,0,-1,NaN,Infinity,-Infinity,'5',null,undefined],dotSize:[-.001,4.001,NaN,Infinity,'1',null,undefined],dotContrast:[.499,2.501,NaN,Infinity,'1.2',null,undefined]};
  for(const [key,values] of Object.entries(bad))for(const value of values) {
    for(const shadingMode of ['hatch',...modes]){
      if(value===undefined&&(key==='dotSpacing'||key==='dotSize'))assert.equal(draw(examples.sphere,{shadingMode,[key]:value}),draw(examples.sphere,{shadingMode}),'undefined style-specific size/spacing restores defaults');
      else assert.throws(()=>draw(examples.sphere,{shadingMode,[key]:value}),`${shadingMode}/${key}=${value}`);
    }
    for(const mode of modes)assert.throws(()=>direct(big,mode,()=>0,{[key]:value}));
  }
  for(const s of [0,-1,NaN,Infinity])assert.throws(()=>buildDots(big,depthAt,project,s,()=>0,{shadingMode:'stipple'}));
  assert.throws(()=>direct(big,'stipple',()=>-.5,{dotSpacing:19,dotSize:.001}),/Stipple density too high/,'legal settings still enforce bounded Poisson count');
  assert.throws(()=>buildDots(big,depthAt,p=>[p[0]*1e6,p[1]*1e6],1e6,()=>0,{shadingMode:'stipple'}),/Dot screen too large/,'oversized candidate grids fail before iteration');
});
console.log('\nCOUNTS / PERFORMANCE (informational, no machine-specific time limits)');
console.table(stats);
console.log(`\n${passed} passed, ${failures.length} failed; total ${(performance.now()-started).toFixed(1)} ms`);
console.log('Hatch compatibility is checked against explicit current defaults; no historical SVG snapshot is available.');
if(failures.length){for(const f of failures)console.error(`\n${f.name}\n${f.error}`);process.exitCode=1;}
