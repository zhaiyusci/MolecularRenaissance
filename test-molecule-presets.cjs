'use strict';
const assert=require('node:assert/strict'),api=require('./renderer.js'),{makeUI}=require('./scripts/ui-harness.cjs');
const expected={
 methane:[{C:1,H:4},4,{'C-H':1.09}],
 ammonia:[{N:1,H:3},3,{'H-N':1.01}],
 carbonDioxide:[{C:1,O:2},2,{'C-O':1.16}],
 methanol:[{C:1,H:4,O:1},5,{'C-H':1.09,'C-O':1.43,'H-O':.96}],
 benzene:[{C:6,H:6},12,{'C-C':1.397,'C-H':1.09}],
 hydrogenPeroxide:[{H:2,O:2},3,{'H-O':.97,'O-O':1.48}],
 phenol:[{C:6,H:6,O:1},13],
 isopropanol:[{C:3,H:8,O:1},11],
 sulfuricAcid:[{H:2,S:1,O:4},6],
 glycine:[{C:2,H:5,N:1,O:2},9],
 glucose:[{C:6,H:12,O:6},24],
 phospholipid:[{C:20,H:40,N:1,O:8,P:1},69]
};
for(const [key,[formula,nBonds,lengths]] of Object.entries(expected)){
 const m=api.examples[key],counts={},seen=new Set();assert(m,key);
 for(const a of m.atoms){counts[a.element]=(counts[a.element]||0)+1;assert.equal(a.position.length,3);assert(a.position.every(Number.isFinite));}
 assert.deepEqual(counts,formula,key);assert.equal(m.bonds.length,nBonds,key);
 for(const [a,b] of m.bonds){assert(a!==b&&m.atoms[a]&&m.atoms[b]);const id=[a,b].sort((x,y)=>x-y).join(':');assert(!seen.has(id));seen.add(id);
  const el=[m.atoms[a].element,m.atoms[b].element].sort().join('-'),d=Math.hypot(...m.atoms[a].position.map((x,i)=>x-m.atoms[b].position[i]));
  if(lengths)assert(Math.abs(d-lengths[el])<1e-9,`${key} ${el}: ${d}`);
  else assert(d>.7&&d<1.9,`${key} implausible bond ${el}: ${d}`);
 }
 const neighbors=m.atoms.map(()=>[]);for(const [a,b] of m.bonds){neighbors[a].push(b);neighbors[b].push(a);}
 const connected=new Set([0]);for(const a of connected)for(const b of neighbors[a])connected.add(b);assert.equal(connected.size,m.atoms.length);
 m.atoms.forEach((a,i)=>{if(a.element==='H')assert.equal(neighbors[i].length,1);if(a.element==='O')assert(neighbors[i].length<=2);if(a.element==='P'||a.element==='S')assert.equal(neighbors[i].length,4);});
 if(key==='phospholipid'){const ni=m.atoms.findIndex(a=>a.element==='N');assert.equal(neighbors[ni].length,4);assert(neighbors[ni].every(i=>m.atoms[i].element==='C'));}
 for(let i=0;i<m.atoms.length;i++)for(let j=i+1;j<m.atoms.length;j++)assert(Math.hypot(...m.atoms[i].position.map((x,k)=>x-m.atoms[j].position[k]))>.55,`${key}: coincident/clashing centers ${i},${j}`);
 for(const renderMode of ['precise','fast'])for(const shadingMode of ['hatch','stipple','halftone'])for(const quality of ['preview','export']){
  const svg=api.render(m,{renderMode,shadingMode,quality,colorWash:true,labels:true,width:900,height:700,scale:30});
  assert(svg.startsWith('<svg'));assert(!/NaN|Infinity|undefined/.test(svg));
  if(renderMode==='fast')assert(svg.includes(`data-sphere-count="${m.atoms.length}"`));
 }
}
// Signed tetrahedral volumes with graph-derived CIP neighbor priorities.
// Positive determinant = S, negative = R; independently checks the named stereoisomers.
function handedness(m,order){
 const [a,b,c,d]=order.map(i=>m.atoms[i].position),v=[a,b,c].map(p=>p.map((x,i)=>x-d[i]));
 const det=v[0][0]*(v[1][1]*v[2][2]-v[1][2]*v[2][1])-v[0][1]*(v[1][0]*v[2][2]-v[1][2]*v[2][0])+v[0][2]*(v[1][0]*v[2][1]-v[1][1]*v[2][0]);
 assert(Math.abs(det)>1e-3);return det>0?'S':'R';
}
const g=api.examples.glucose;
assert.deepEqual([[5,7,1,12],[8,0,2,13],[9,1,3,14],[10,4,2,15],[5,3,6,16]].map(o=>handedness(g,o)),['S','R','S','S','R']);
assert(g.atoms[7].position[2]<g.atoms[0].position[2]);assert(g.atoms[6].position[2]>g.atoms[4].position[2],'alpha anomer: OH1 and C6 on opposite ring faces');
assert.equal(handedness(api.examples.phospholipid,[3,2,0,30]),'R','sn-glycerol configuration');
const ui=makeUI();ui.flush();const options=ui.elements.model.querySelectorAll('option').map(n=>n.value);
assert.equal(options.length,15);assert(!options.includes('sphere'));assert(!options.includes('pair'));assert.equal(ui.elements.model.value,'water');
for(const locale of ['en','zh-CN']){
 ui.locale(locale);
 for(const key of Object.keys(expected)){
  ui.change('model',key);ui.flush();const name=ui.context.MolI18n.t('model.'+key);assert(!name.startsWith('model.'));
  assert.equal(ui.elements['molecule-caption'].textContent,name);ui.elements.download.click();assert.equal(ui.calls.at(-1).model.name,name);assert.equal(ui.calls.at(-1).options.quality,'export');
 }
}
ui.elements.reset.click();ui.flush();assert.equal(ui.elements.model.value,'water');
console.log('Molecule presets passed: formulas, connectivity, bond lengths, 144 real renders, 15-item localized menu and exports.');
