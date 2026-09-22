'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {examples,render}=require('./renderer.js');
const {disks}=require('./test-shared-regions.cjs');
const {coverage}=require('./test-style-coverage.cjs');
const m=examples.c60;
assert.equal(m.atoms.length,60);assert.equal(m.bonds.length,90);
assert.ok(m.atoms.every(a=>a.element==='C'&&a.position.every(Number.isFinite)));
const p=m.atoms.map(a=>a.position),adj=p.map(()=>new Set()),edges=new Set();
for(const [a,b] of m.bonds){
 assert.ok(a>=0&&b<p.length&&a<b);const key=a+','+b;assert.ok(!edges.has(key));edges.add(key);
 adj[a].add(b);adj[b].add(a);assert.ok(Math.abs(Math.hypot(...p[a].map((x,k)=>x-p[b][k]))-1.42)<1e-10);
}
assert.ok(adj.every(a=>a.size===3));
assert.equal(new Set(p.map(a=>a.map(x=>x.toFixed(10)).join(','))).size,60);
for(let k=0;k<3;k++)assert.ok(Math.abs(p.reduce((s,a)=>s+a[k],0))<1e-10);
const radius=Math.hypot(...p[0]);assert.ok(p.every(a=>Math.abs(Math.hypot(...a)-radius)<1e-10));
const visited=new Set(),queue=[0];while(queue.length){const i=queue.pop();if(visited.has(i))continue;visited.add(i);queue.push(...adj[i]);}assert.equal(visited.size,60);
// Enumerate independent chordless 5/6-cycles and verify a closed soccer-ball cage.
const faces=[];
for(let start=0;start<60;start++){
 function walk(path){
  for(const next of adj[path.at(-1)]){
   if(next===start){
    if((path.length===5||path.length===6)&&path[1]<path.at(-1)){
     let chord=false;for(let i=0;i<path.length;i++)for(let j=i+2;j<path.length;j++)
      if(!(i===0&&j===path.length-1)&&adj[path[i]].has(path[j]))chord=true;
     if(!chord)faces.push(path.slice());
    }
   }else if(path.length<6&&next>start&&!path.includes(next))walk([...path,next]);
  }
 }
 walk([start]);
}
assert.equal(faces.filter(f=>f.length===5).length,12);
assert.equal(faces.filter(f=>f.length===6).length,20);
assert.equal(60-90+faces.length,2);
const incidences=new Map();for(const f of faces)for(let i=0;i<f.length;i++){
 const a=f[i],b=f[(i+1)%f.length],key=[Math.min(a,b),Math.max(a,b)].join(',');
 incidences.set(key,(incidences.get(key)||0)+1);
}
assert.equal(incidences.size,90);assert.ok([...incidences.values()].every(x=>x===2));
console.log('PASS C60: 60 carbons, 90 equal-length edges, degree 3, 12 pentagons, 20 hexagons, connected closed cage');
for(const shadingMode of ['hatch','stipple','halftone'])for(const quality of ['preview','export']){
 const start=performance.now(),svg=render(m,{shadingMode,quality,colorWash:true});
 assert.ok(svg.includes('C₆₀')&&(svg.includes('mol-wash')||svg.includes('data-role="surface-fill"')));assert.ok(!/NaN|Infinity|undefined/.test(svg));
 const artwork=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/g,'');
 if(shadingMode==='stipple')assert.ok(disks(svg).length>1000,'actual nonzero-radius stipple disks, including round-cap batches');
 else if(shadingMode==='halftone'){
  const patterns=new Set([...svg.matchAll(/<pattern\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]));
  const paints=[...artwork.matchAll(/<rect\b[^>]*data-tone-level="[^"]+"[^>]*>/g)];
  assert.ok(paints.length>0,'halftone must paint artwork, not merely define tile circles');
  for(const paint of paints)assert.ok(patterns.has(/fill="url\(#([^)]*)\)"/.exec(paint[0])?.[1]),'actual tone paint resolves its pattern');
 }else {
  assert.match(svg,/data-hatch-mode="layered"/);
  const skeletons=new Set([...svg.matchAll(/<path\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]));
  const uses=[...artwork.matchAll(/<use\b[^>]*href="#([^"]+)"/g)];assert(uses.length>100,'actual default hatch instances');
  for(const use of uses)assert(skeletons.has(use[1]),'painted use resolves a real skeleton');
 }
 // This path/pattern coverage oracle does not expand <use>. Keep its original
 // continuous calibration; default band/owner membership is independently tested
 // over C60 and all presets in test-layered-hatching, not inferred from defs ink.
 const measured=shadingMode==='hatch'?render(m,{shadingMode,quality,colorWash:true,hatchMode:'continuous'}):svg;
 assert.ok(coverage(measured,[390,290,510,410])>.01,'nonzero central texture ink');
 console.log(`PASS C60 ${shadingMode}/${quality}: ${(performance.now()-start).toFixed(0)} ms`);
}
const rotated=render(m,{shadingMode:'halftone',quality:'preview',yaw:.73,pitch:.41,colorWash:true});
assert.ok(!/NaN|Infinity/.test(rotated));
assert.ok(fs.readFileSync('./app.js','utf8').includes('Object.keys(engine.examples)'),'UI discovers C60 automatically');
