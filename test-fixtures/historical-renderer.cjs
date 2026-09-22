'use strict';
// Tracked historical renderers for shading optimization and label comparisons.
// Never substitute the current renderer or silently skip an unavailable baseline.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const fixtures={
  'pre-shading':{commit:'c353cc5e34dc97ab3f5bce23ed27728016261c26',blob:'8f246848fd361d59822263f21f7c83d867ce2a0b'},
  // First tracked depth-label renderer: its labels:false output is the
  // independent historical contract, with the same pre-centering projection.
  'pre-labels':{commit:'b79d28daca8215ad32b7421e74106125f21ec17f',blob:'316e205acd73ceff99b903f7468fcf48b6c14ad7'},
};
const root=path.resolve(__dirname,'..');
const historicalProjection='const project = p => [(p[0] - cx) * scale + o.width / 2, o.height / 2 - 12 - (p[1] - cy) * scale];';
const centeredProjection='const project = p => [p[0] * scale + o.width / 2, o.height / 2 - p[1] * scale];';
async function historicalRenderer(name='pre-shading'){
  assert(Object.hasOwn(fixtures,name),`unknown historical renderer fixture: ${name}`);
  const {commit,blob}=fixtures[name];
  const directory=path.join(root,'build/baselines');fs.mkdirSync(directory,{recursive:true});
  const cache=path.join(directory,`tracked-${commit}.mjs`);
  if(!fs.existsSync(cache)){
    const temporary=cache+'.'+process.pid+'.tmp',fd=fs.openSync(temporary,'w');
    let result;
    try{result=spawnSync('git',['show',`${commit}:dist/molplotter.mjs`],{cwd:root,stdio:['ignore',fd,'inherit'],timeout:15000});}
    finally{fs.closeSync(fd);}
    if(result.error||result.status!==0){
      fs.rmSync(temporary,{force:true});
      throw Error(`Historical renderer required. Retrieve pinned history with: git fetch origin ${commit}. Then rerun. ${result.error||'git show failed'}`);
    }
    fs.renameSync(temporary,cache);
  }
  const bytes=fs.readFileSync(cache);
  const actual=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(actual,blob,'historical fixture must match its pinned Git blob (remove corrupt cache and rerun)');
  const source=bytes.toString('utf8');
  assert.equal(source.split(historicalProjection).length,2,'replace exactly the known historical projection');
  // Screen-space stipple seeds depend on the projection. Align before rendering,
  // not by translating the resulting marks. No historical shading code changes.
  return import('data:text/javascript;base64,'+Buffer.from(source.replace(historicalProjection,centeredProjection)).toString('base64'));
}
module.exports={historicalRenderer};
