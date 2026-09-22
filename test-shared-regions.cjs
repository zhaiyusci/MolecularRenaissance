'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const urls=new Map();
function moduleURL(file){
  file=path.resolve(__dirname,'build/ts',file);if(urls.has(file))return urls.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,ref)=>`from ${q}${moduleURL(path.resolve(path.dirname(file),ref))}${q}`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');urls.set(file,url);return url;
}
function disks(svg){
  // Walk every owner layer, but never count pattern/clip definition circles.
  const artwork=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/g,''),out=[],stack=[false];
  for(const m of artwork.matchAll(/<\/?(?:g|circle|path)\b[^>]*>/g)){
    const tag=m[0],a=Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(v=>[v[1],v[2]]));
    if(tag.startsWith('</g')){assert(stack.length>1);stack.pop();continue;}
    if(/^<g\b/.test(tag)){if(!tag.endsWith('/>'))stack.push(stack.at(-1)||a['data-role']==='dots');continue;}
    if(!stack.at(-1))continue;
    if(/^<circle\b/.test(tag)){
      assert([a.cx,a.cy,a.r].every(v=>v!==undefined&&Number.isFinite(+v))&&+a.r>0);
      out.push([a.cx,a.cy,a.r].join(','));
    }else if(a['data-stipple-radius']!==undefined){
      const r=a['data-stipple-radius'];assert(Number.isFinite(+r)&&+r>0);
      assert.equal(a['stroke-linecap'],'round');assert.equal(a.fill,'none');
      assert(a.stroke&&a.stroke!=='none');assert.equal(+a['stroke-width'],2*+r);
      const points=[...a.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g)];
      assert(points.length>0);assert.equal(points.map(p=>p[0]).join(''),a.d,'all stipple subpaths are isolated disks');
      for(const point of points){assert(Number.isFinite(+point[1])&&Number.isFinite(+point[2]));out.push(point[1]+','+point[2]+','+r);}
    }
  }
  assert.equal(stack.length,1,'balanced artwork groups');return out.sort();
}
async function main(){
  assert.deepEqual(disks('<svg><defs><g data-role="dots"><circle cx="9" cy="9" r="9"/></g></defs><g data-role="dots"><g><circle cx="1" cy="2" r=".3"/></g></g><g><g data-role="dots"><path data-stipple-radius=".2" stroke="black" stroke-width=".4" stroke-linecap="round" fill="none" d="M3 4h0M3 4h0"/></g></g></svg>'),['1,2,.3','3,4,.2','3,4,.2'],'all artwork groups, nested groups, multiplicity, and no definition disks');
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
    const svg=classic.render(classic.examples[name],{hatchMode:'continuous',castShadows,quality:'preview'});
    assert(!/NaN|Infinity/.test(svg));
  }}finally{boundaries.build=build;}
  assert.equal(regionClips,6,'all certified hatch renders consume the shared owner index');
  const reports=[];
  for(const lightAzimuth of [-.6,1.4]){
    const o=normalizeOptions({castShadows:true,lightAzimuth,quality:'preview'}),p=prepareScene(current.examples.ethanol,o);
    const b=boundaries.build(p.scene,depthAt,p.project,p.scale);assert(b.validate(()=> '#fff'));
    const regions=b.dotRegions();assert(regions?.surface);
    const oracleFor=p.lightingFor;let traceQueries=0;
    p.lightingFor=s=>{const f=oracleFor(s);return (n,v)=>{traceQueries++;return f(n,v);};};
    {const ctx=p.directionalShadows(),original=ctx.shadowed;ctx.shadowed=(...args)=>{traceQueries++;return original(...args);};}
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
    reports.push({lightAzimuth,checked,different,fraction:different/checked,builds,samples});
  }
  {
    // Use the tracked pre-shading commit, not the untracked intermediate
    // pre-regions snapshot. Projection is aligned before stochastic sampling.
    const before=await require('./test-fixtures/historical-renderer.cjs').historicalRenderer();
    const {coverage}=require('./test-style-coverage.cjs');
    for(const name of ['ethanol','c60']){
      // Historical ribbon coverage uses a path-only oracle, not layered use/clip expansion.
      const options={hatchMode:'continuous',shadingMode:'hatch',castShadows:true,quality:'preview',textureScale:1};
      const old=before.render(before.examples[name],options),next=current.render(current.examples[name],options);
      const a=coverage(old,[200,100,700,600]),b=coverage(next,[200,100,700,600]);
      assert(Math.abs(a-b)<.01,`${name}: shadowed hatch ink stays within one percentage point in the same window`);
      console.log('Shadowed hatch window coverage:',{name,before:a,after:b});
    }
    for(const name of ['sphere','ethanol','c60']){
      // The historical engine predates tone quantization, so this position/radius
      // guard compares the continuous stream; the quantized default is checked below.
      const options={shadingMode:'stipple',castShadows:false,quality:'preview',textureScale:1};
      const old=before.render(before.examples[name],options),next=current.render(current.examples[name],{...options,quantizeShading:false});
      const oldDisks=disks(old),newDisks=disks(next);assert(oldDisks.length>1000);
      if(name==='sphere')for(const disk of newDisks){
        const [x,y,r]=disk.split(',').map(Number);
        assert(Math.hypot(x-450,y-350)+r<=45.6,'entire serialized disk stays inside the sphere silhouette');
      }
      assert.deepEqual(newDisks,oldDisks,`${name}: every unshadowed disk retains its exact serialized position and radius`);
      assert(next.length<old.length*.6,'batching removes per-mark XML overhead');
      // The default switch quantizes tone on the same flat path, and may only add ink.
      const quantized=current.render(current.examples[name],{...options,quantizeShading:true});
      assert.match(quantized,/data-birth-level="\d+"/,`${name}: default stipple serializes tone levels`);
      assert(!quantized.includes('<pattern')&&!quantized.includes('<clipPath'),`${name}: quantized stipple stays flat`);
      assert(Math.abs(disks(quantized).length-newDisks.length)/newDisks.length<.15,`${name}: nearest-band quantization preserves mean tone`);
    }
  }
  console.table(reports);console.log('Shared-region integration checks passed');
}
module.exports={disks};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
