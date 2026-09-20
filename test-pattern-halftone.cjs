const assert=require('node:assert/strict');
const {buildDots}=require('./dots.js');

function inspect(svg){
  const patterns=[...svg.matchAll(/<pattern\b([^>]*)>([\s\S]*?)<\/pattern>/g)];
  assert(patterns.length>0&&patterns.length<=16,'at most 16 reusable screens');
  const phase=new Set(patterns.map(m=>m[1].match(/patternTransform="([^"]+)"/)[1]));
  const pitch=new Set(patterns.map(m=>m[1].match(/\bwidth="([^"]+)"/)[1]));
  assert.deepEqual([...phase],['rotate(45)']);assert.equal(pitch.size,1);
  for(const [,attrs,content] of patterns){
    assert(attrs.includes('patternUnits="userSpaceOnUse"'));
    assert((content.match(/<circle\b/g)||[]).length<=9,'only a tile and wrap copies');
    if(Number(attrs.match(/data-coverage="([^"]+)"/)[1])>Math.PI/4)
      assert.equal((content.match(/<circle\b/g)||[]).length,9,'dark disks wrap across tile edges');
  }
  const body=svg.replace(/<defs>[\s\S]*?<\/defs>/g,'');
  assert(!body.includes('<circle'),'no individual screen dots outside definitions');
  assert(!/<image\b|<filter\b|<mask\b|Gradient\b|opacity=/.test(svg),'opaque vector paint and clipping only');
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'unique IDs within a document');
  for(const m of svg.matchAll(/url\(#([^)]*)\)/g))assert(ids.includes(m[1]),'all local references resolve');
  return {patterns:patterns.length,circles:(svg.match(/<circle\b/g)||[]).length,pitch:+[...pitch][0]};
}

(async()=>{
  const {render,examples}=await import('./dist/molplotter.mjs');
  const model={atoms:[{element:'O',position:[0,0,0]}],bonds:[]};
  const options={shadingMode:'halftone',quality:'preview',textureScale:1};
  const baseline=render(model,options);
  inspect(baseline);
  assert(baseline.includes('data-tone-method="analytic"'),'directional sphere uses geometric tone curves');
  assert.equal(render(model,options),baseline,'deterministic geometry and IDs');
  assert.equal(render(model,{shadingMode:'halftone',quality:'preview'}),baseline,'default equals explicit 1x');
  const brighter=render(model,{...options,shadingBrightness:.2});
  const firstId=svg=>svg.match(/<pattern id="([^"]+)"/)[1];
  assert.notEqual(firstId(brighter),firstId(baseline),'different fields get independent pattern IDs');
  assert(!render(model,{...options,shadingSize:0}).includes('<pattern'),'lightweight preview skips the screen');
  assert(!render(model,{...options,shadingBrightness:1}).includes('<pattern'),'full positive brightness has no ink');
  const results=[];
  for(const textureScale of [.2,1,2.5]){
    const start=Date.now();
    const svg=render(examples.c60,{...options,textureScale});
    assert(svg.includes('data-tone-method="analytic"'),'C60 must not fall back to a sampled tone field');
    results.push({textureScale,...inspect(svg),bytes:svg.length,ms:Date.now()-start});
  }
  // The set of used tone levels may change slightly with calibrated mean
  // coverage, but node count is bounded by levels, never by screen frequency.
  assert(results.every(r=>r.circles<=60+16*9),'bounded tile definitions plus 60 surface clips');
  assert(Math.abs(results[0].pitch/results[1].pitch-.2)<.001,'pitch follows the UI scale');
  assert(results.every(r=>r.bytes<10000000),'C60 stays below 10 MB at all screen pitches');
  console.log('C60 pattern checks:',results);
  // End-on and side-on closed cylinders must retain their projected clip geometry.
  for(const u of [[0,0,1],[1,0,0]]){
    const svg=buildDots([{kind:'cylinder',a:[0,0,0],u,length:1,r:.5}],()=>0,p=>[60*p[0],-60*p[1]],60,()=>0,
      {shadingMode:'halftone',dotSpacing:2.5,dotSize:.5},null,()=>.5);
    inspect(svg);assert(svg.includes('<ellipse'),'cylinder end caps have vector clips');
  }
  // A deliberately discontinuous reference can influence only the mean:
  // uniform physical illumination must not inherit its left/right bands.
  const smooth=buildDots([{kind:'sphere',c:[0,0,0],r:1}],()=>0,p=>[60*p[0],-60*p[1]],60,()=>0,
    {shadingMode:'halftone',dotSpacing:2.5,dotSize:.5},null,(s,n)=>n[0]<0?.1:.7);
  const smoothLevels=[...smooth.matchAll(/data-tone-level="(\d+)"/g)].map(m=>+m[1]);
  assert.equal(Math.max(...smoothLevels),6,'mean .4 maps to .375, not the local .7 reference band');
  console.log('Pattern halftone checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
