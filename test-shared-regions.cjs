'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const urls=new Map();
function moduleURL(file){
  file=path.resolve(__dirname,'build/ts',file);if(urls.has(file))return urls.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,ref)=>`from ${q}${moduleURL(path.resolve(path.dirname(file),ref))}${q}`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');urls.set(file,url);return url;
}
function disks(svg){
  const body=svg.match(/<g data-role="dots"[\s\S]*?<\/g>/)?.[0]||'',out=[];
  for(const m of body.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g))out.push(m.slice(1).join(','));
  for(const m of body.matchAll(/<path data-stipple-radius="([^"]+)"[^>]* d="([^"]+)"/g)){
    const attrs=m[0];assert(attrs.includes('stroke-linecap="round"')&&attrs.includes('fill="none"'));
    assert.equal(+attrs.match(/stroke-width="([^"]+)"/)[1],2*+m[1]);
    for(const point of m[2].matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g))out.push(point[1]+','+point[2]+','+m[1]);
  }
  return out.sort();
}
async function main(){
  const current=await import('./dist/molplotter.mjs');
  const {prepareScene,depthAt}=await import(moduleURL('scene.js')),{normalizeOptions}=await import(moduleURL('options.js'));
  const {createSurfaceAtlas}=await import(moduleURL('surface-atlas.js'));
  const boundaries=require('./boundaries.js'),classic=require('./renderer.js');
  const build=boundaries.build;let regionClips=0;
  boundaries.build=(...args)=>{
    const result=build(...args);if(!result)return result;
    result.clipCircle=()=>{throw Error('Repeated per-hatch scene circle solver used');};
    result.clipLine=()=>{throw Error('Repeated per-hatch scene line solver used');};
    const get=result.dotRegions;result.dotRegions=()=>{const r=get();if(r?.surface)regionClips++;return r;};return result;
  };
  try{for(const name of ['sphere','ethanol','c60'])for(const castShadows of [false,true]){
    const svg=classic.render(classic.examples[name],{castShadows,quality:'preview'});
    assert(!/NaN|Infinity/.test(svg));
  }}finally{boundaries.build=build;}
  assert.equal(regionClips,6,'all certified hatch renders consume the shared owner index');
  const reports=[];
  for(const lightType of ['directional','point']){
    const o=normalizeOptions({castShadows:true,lightType,lightAttenuation:.2,quality:'preview'}),p=prepareScene(current.examples.ethanol,o);
    const b=boundaries.build(p.scene,depthAt,p.project,p.scale);assert(b.validate(()=> '#fff'));
    const regions=b.dotRegions();assert(regions?.surface);
    const oracleFor=p.lightingFor;let traceQueries=0;
    p.lightingFor=s=>{const f=oracleFor(s);return (n,v)=>{traceQueries++;return f(n,v);};};
    if(lightType==='directional'){const ctx=p.directionalShadows(),original=ctx.shadowed;ctx.shadowed=(...args)=>{traceQueries++;return original(...args);};}
    const atlas=createSurfaceAtlas(p,regions,o);
    for(const s of p.scene){const one=atlas.shadow(s);assert.equal(atlas.shadow(s),one);atlas.lightingFor(s);}
    const builds=atlas.stats.shadowBuilds,samples=atlas.stats.shadowSamples,traces=traceQueries,origin=p.project([0,0,0]);
    let checked=0,different=0;
    for(let y=220.31;y<470;y+=1.37)for(let x=300.27;x<600;x+=1.37){
      const hit=regions.query(x,y,.1);if(!hit)continue;const s=p.scene[hit.id];if(s.kind!=='sphere')continue;
      const wx=(x-origin[0])/p.scale,wy=(origin[1]-y)/p.scale,z=depthAt(s,wx,wy),point=[wx,wy,z],n=point.map((v,i)=>(v-s.c[i])/s.r);
      if(Math.abs(atlas.lightingFor(s)(n,point)-oracleFor(s)(n,point))>1e-8)different++;checked++;
    }
    assert.equal(atlas.stats.shadowBuilds,builds,'no repeated shadow extraction');
    assert.equal(atlas.stats.shadowSamples,samples,'no repeated shadow sampling');
    assert.equal(traceQueries,traces,'texture queries do not invoke physical shadow callbacks');
    assert(checked>1000&&different/checked<.02,'local shadow classification differs on under 2% of visible probes');
    reports.push({lightType,checked,different,fraction:different/checked,builds,samples});
  }
  if(fs.existsSync('build/baselines/pre-regions.mjs')){
    const before=await import('./build/baselines/pre-regions.mjs');
    const {coverage}=require('./test-style-coverage.cjs');
    for(const name of ['ethanol','c60']){
      const options={shadingMode:'hatch',castShadows:true,quality:'preview',textureScale:1};
      const old=before.render(before.examples[name],options),next=current.render(current.examples[name],options);
      const a=coverage(old,[200,100,700,600]),b=coverage(next,[200,100,700,600]);
      assert(Math.abs(a-b)<.01,`${name}: shadowed hatch ink stays within one percentage point in the same window`);
      console.log('Shadowed hatch window coverage:',{name,before:a,after:b});
    }
    for(const name of ['sphere','ethanol','c60']){
      const options={shadingMode:'stipple',castShadows:false,quality:'preview',textureScale:1};
      const old=before.render(before.examples[name],options),next=current.render(current.examples[name],options);
      const oldDisks=disks(old),newDisks=disks(next);assert(oldDisks.length>1000);
      assert.deepEqual(newDisks,oldDisks,`${name}: every unshadowed disk retains its exact serialized position and radius`);
      assert(next.length<old.length*.6,'batching removes per-mark XML overhead');
    }
  }
  console.table(reports);console.log('Shared-region integration checks passed');
}
module.exports={disks};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
