'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('./renderer.js');
const water='3\nwater\nO 0 0 0\nH 0.9572 0 0\nH -0.239 0.927 0\n';
function checks(r){
  const raw=r.parseXYZ(water);assert.equal(raw.name,'water');assert.equal(raw.atoms.length,3);assert.deepEqual(JSON.parse(JSON.stringify(raw.bonds)),[]);
  assert.deepEqual(JSON.parse(JSON.stringify(raw.atoms[1].position)),[.9572,0,0]);
  const bonded=r.parseXYZ(water,{inferBonds:true,name:'local.xyz'});
  assert.equal(bonded.name,'local.xyz');assert.deepEqual(JSON.parse(JSON.stringify(bonded.bonds)),[[0,1],[0,2]]);
  const windows=r.parseXYZ('\ufeff3\r\nwater\r\n8 0 0 0\r\nh 9.572D-1 0 0\r\nH -.239 .927 0\r\n');
  assert.equal(windows.atoms[0].element,'O');assert.equal(windows.atoms[1].position[0],.9572);
  assert.equal(r.parseXYZ('1\n\ncl 0 0 0').atoms[0].element,'Cl');
  assert.equal(r.parseXYZ('1\n\n26 0 0 0').atoms[0].element,'Fe');
  for(const text of ['', '0\nempty\n','-1\nnegative\n','1.5\ncount\n','1\nC 0 0 0',water+'1\nsecond\nC 0 0 0','2\nshort\nC 0 0 0','1\nextra\nC 0 0 0 1','1\nunknown\nXx 0 0 0','1\nmissing radius\nOg 0 0 0','1\nProperties=pos:R:3:species:S:1\n0 0 0 C','1\ninvalid\nC NaN 0 0','1\ninvalid\nC Infinity 0 0','1\ninvalid\nC 0x10 0 0','1\ninvalid\nC 1e100 0 0'])assert.throws(()=>r.parseXYZ(text),`reject malformed XYZ: ${text.slice(0,40)}`);
  assert.throws(()=>r.parseXYZ('1\ncomment\nC no 0 0'),/line\s*3/i);
  assert.throws(()=>r.parseXYZ(water,{maxAtoms:2}));
  assert.throws(()=>r.parseXYZ(water,{maxAtoms:0}));
  assert.throws(()=>r.parseXYZ(water,{inferBonds:'yes'}));
  assert.throws(()=>r.parseXYZ(null));
  assert.throws(()=>r.parseXYZ('1\n'+' '.repeat(2*1024*1024)+'\nC 0 0 0'));
  assert.throws(()=>r.parseXYZ(water,{maxAtoms:2001}));
  assert.equal(r.parseXYZ('1\nlarge\nC 1e6 0 0').atoms[0].position[0],1e6);
  assert.equal(r.parseXYZ('2\ncoincident\nC 0 0 0\nC 0 0 0',{inferBonds:true}).bonds.length,0);
  for(const mode of ['precise','fast']){
    const svg=r.render(bonded,{renderMode:mode,shadingSize:0,labels:true});assert.match(svg,/<svg\s/);
    if(mode==='fast')assert.match(svg,/data-bond-count="2"/);
  }
  const unsafe=r.parseXYZ('1\n<script>alert(1)</script>\nC 0 0 0');
  assert(!r.render(unsafe,{renderMode:'fast',shadingSize:0}).includes('<script>'),'comment is text, never SVG/HTML');
}
(async()=>{
  checks(api);checks(await import('./dist/molplotter.mjs'));
  const dense='320\ndense\n'+Array.from({length:320},(_,i)=>`C ${(i%8)*.1} ${(Math.floor(i/8)%8)*.1} ${Math.floor(i/64)*.1}`).join('\n');
  assert.throws(()=>api.parseXYZ(dense,{inferBonds:true}),/10000-bond/);
  assert.equal(api.parseXYZ(dense).atoms.length,320,'dense files still parse with inference disabled');
  const browser=vm.createContext({});
  for(const name of ['dot-regions','boundaries','wash','dots','renderer'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),browser);
  checks(browser.MolEngraver);
  for(const [element,radius] of Object.entries({H:.31,C:.76,N:.71,O:.66,P:1.07,S:1.05,F:.57,Cl:1.02,Fe:1.32}))assert.equal(api.covalentRadii[element],radius);
  console.log('XYZ checks passed: CJS, ESM, classic browser API; counts, units, symbols, inference, malformed data and renderer integration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
