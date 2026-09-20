import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {load} from './scripts/load-painter.mjs';
const require=createRequire(import.meta.url),{marks}=require('./test-style-coverage.cjs');
const current=await import('./dist/molplotter.mjs');
const {existsSync}=await import('node:fs');
const before=existsSync(new URL('./build/baselines/pre-fast.mjs',import.meta.url))?await import('./build/baselines/pre-fast.mjs'):null;
if(!before)console.log('Optional local pre-fast snapshot absent; skipping historical byte comparison.');
const {prepareScene}=await load('scene.js'),{normalizeOptions}=await load('options.js');
const attr=(svg,name)=>+(svg.match(new RegExp(`\\s${name}="([^"]+)"`))?.[1]??NaN);
for(const shadingMode of ['hatch','stipple','halftone']){
  const o={labels:true,shadingMode,colorWash:true,quality:'preview',castShadows:false};
  if(before)assert.equal(current.render(current.examples.c60,o),before.render(before.examples.c60,o),'precise path unchanged');
  for(const atomRadiusScale of [1,.65]){
    const svg=current.render(current.examples.c60,{...o,renderMode:'fast',atomRadiusScale});
    assert.match(svg,/data-render-mode="fast"/);assert.equal(attr(svg,'data-bond-count'),current.examples.c60.bonds.length);
    assert.equal((svg.match(/data-role="bond-layer"/g)||[]).length,current.examples.c60.bonds.length);
    assert.equal(attr(svg,'data-whole-labels'),60);assert.equal(attr(svg,'data-boundary-builds'),0);assert.equal(attr(svg,'data-sphere-pair-tests'),0);
    if(atomRadiusScale===.65)assert(attr(svg,'data-bond-visible-count')>0,'bonds genuinely render when exposed');
    const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
    for(const m of svg.matchAll(/(?:url\(#|href="#)([^)" ]+)/g))assert(ids.includes(m[1]),'all clip/template references resolve');
    const groups=[];
    for(const m of svg.matchAll(/<\/?(?:g|text)\b[^>]*>/g)){
      const tag=m[0];if(tag.startsWith('</g'))groups.pop();else if(tag.startsWith('<g')&&!tag.endsWith('/>'))groups.push(tag);
      else if(tag.includes('data-role="element-label"'))assert(!/clip-path=|mask=/.test(tag)&&groups.every(g=>!/clip-path=|mask=/.test(g)));
    }
  }
}
for(const o of [{lightType:'point'},{castShadows:true}])assert.throws(()=>current.render(current.examples.sphere,{renderMode:'fast',...o}),/requires directional/);
assert.throws(()=>current.render(current.examples.sphere,{renderMode:'guess'}),/Invalid renderMode/);
// Independent closed-cylinder ray equation, including both end caps.
function cylinderZ(s,x,y){
  const q=[x-s.a[0],y-s.a[1],-s.a[2]],t=q.reduce((v,n,k)=>v+n*s.u[k],0),q2=q.reduce((v,n)=>v+n*n,0),A=1-s.u[2]**2,B=2*(q[2]-t*s.u[2]),C=q2-t*t-s.r*s.r,candidates=[];
  if(A>1e-12){const D=B*B-4*A*C;if(D>=0)for(const z of [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)]){const h=t+z*s.u[2];if(h>=0&&h<=s.length)candidates.push(z);}}
  if(Math.abs(s.u[2])>1e-12)for(const h of [0,s.length]){const z=(h-t)/s.u[2];if(q[0]**2+q[1]**2+(q[2]+z)**2-h*h<=s.r*s.r+1e-10)candidates.push(z);}
  return Math.max(-Infinity,...candidates);
}
let checked=0;
for(const z of [-.8,.8])for(const quality of ['preview','export']){
  const model={atoms:[{element:'C',position:[-2,0,0],radius:.28},{element:'C',position:[2,0,0],radius:.28},{element:'O',position:[0,0,z],radius:.8}],bonds:[[0,1]]};
  const o=normalizeOptions({renderMode:'fast',yaw:.25,pitch:.13,labels:true,quality,shadingSize:0}),p=prepareScene(model,o),svg=current.render(model,o);
  const paths=[...svg.matchAll(/<path data-role="bond-fill"[^>]*>/g)].map(m=>m[0].replace('<path ','<path fill="#161616" ')).join('');assert(paths);
  const shapes=marks(`<g fill="#161616" stroke="none">${paths}</g>`),origin=p.project([0,0,0]);
  const truth=(x,y)=>{const wx=(x-origin[0])/p.scale,wy=(origin[1]-y)/p.scale,bz=cylinderZ(p.cylinders[0],wx,wy);if(!Number.isFinite(bz))return false;return p.spheres.every(s=>{const q=s.r*s.r-(wx-s.c[0])**2-(wy-s.c[1])**2;return q<0||s.c[2]+Math.sqrt(q)<=bz+1e-9;});};
  const ends=[p.project(p.cylinders[0].a),p.project(p.cylinders[0].a.map((v,k)=>v+p.cylinders[0].u[k]*p.cylinders[0].length))];
  for(let y=Math.min(...ends.map(p=>p[1]))-8;y<Math.max(...ends.map(p=>p[1]))+8;y+=1.3)for(let x=Math.min(...ends.map(p=>p[0]))-8;x<Math.max(...ends.map(p=>p[0]))+8;x+=1.3){
    const expected=truth(x,y),margin=quality==='preview'?.8:.45;
    if([[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].some(([dx,dy])=>truth(x+dx*margin,y+dy*margin)!==expected))continue;
    assert.equal(shapes.some(s=>s.contains(x,y)),expected,`bond mask oracle at z=${z} quality=${quality} xy=${x},${y} paths=${shapes.length}`);checked++;
  }
}
console.log(`Fast renderer passed: all three C60 modes and radii, ${before?'unchanged precise output, ':''}whole labels, real bonds, ${checked} independent bond-mask probes.`);
