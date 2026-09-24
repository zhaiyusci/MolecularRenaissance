'use strict';
const assert=require('node:assert/strict');
const {historicalRenderer}=require('./test-fixtures/historical-renderer.cjs');
const {assertHalftonePaintMigration}=require('./test-fixtures/halftone-parity.cjs');
const {marks}=require('./test-style-coverage.cjs');
const {disks}=require('./test-shared-regions.cjs');
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function layers(svg){
  const stack=[],out=[],texts=[];
  for(const m of svg.matchAll(/<\/?(?:g|text|path)\b[^>]*>/g)){
    const tag=m[0],a=attrs(tag);
    if(tag.startsWith('</g')){stack.pop();continue;}
    if(/^<g\b/.test(tag)){
      const item={attrs:a,index:m.index};stack.push(item);
      if(a['data-role']==='surface-layer')out.push(item);
      continue;
    }
    const owner=stack.findLast(g=>g.attrs['data-role']==='surface-layer');
    if(a['data-role']==='surface-fill'){assert(owner);owner.fill={tag,attrs:a,index:m.index};}
    if(a['data-role']==='element-label'){
      assert(owner,'label is drawn with its owner, not in the final overlay');
      assert.equal(a['data-surface-id'],owner.attrs['data-surface-id']);
      assert(!a['clip-path']&&!a.mask&&!stack.some(g=>g.attrs['clip-path']||g.attrs.mask),'text and ancestors have no clip or mask');
      assert(owner.fill&&owner.fill.index<m.index,'owner fill precedes its label');
      texts.push({attrs:a,index:m.index,owner});
    }
  }
  return {out,texts};
}
const allDisks=svg=>[...svg.matchAll(/<g data-role="dots"[\s\S]*?<\/g>/g)].flatMap(m=>disks(m[0])).sort();
(async()=>{
  const current=await import('./dist/molplotter.mjs');
  const fixture={atoms:[{element:'C',position:[0,0,0],radius:1},{element:'O',position:[.7,0,.25],radius:1}],bonds:[]};
  let cases=0;
  for(const shadingMode of ['hatch','stipple','halftone'])for(const colorWash of [false,true])for(const quality of ['preview','export'])for(const castShadows of [false,true]){
    const options={labels:true,labelSize:24,labelStrokeWidth:4,shadingMode,colorWash,quality,castShadows,yaw:0,pitch:0};
    const svg=current.render(fixture,options),parsed=layers(svg);
    assert.equal(parsed.texts.length,2,'both label anchors are visible');
    const back=parsed.texts.find(t=>t.attrs['data-surface-id']==='0'),front=parsed.out.find(g=>g.attrs['data-surface-id']==='1');
    assert(front.fill.index>back.index,'foreground geometry paints after rear text');
    if(!colorWash)assert.equal(front.fill.attrs.fill,'#ffffff','white mode still paints an opaque occluder');
    const px=+back.attrs.x+8,py=+back.attrs.y-24*.3;
    const solid=marks(front.fill.tag.replace(/fill="[^"]+"/,'fill="#161616"'));
    assert(solid.some(m=>m.contains(px,py)),'foreground fill actually covers the rear label neighbourhood');
    const skeletonIds=new Set([...svg.matchAll(/<path\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]));
    for(const use of svg.matchAll(/<use\b[^>]*>/g)){
      const href=/\bhref="#([^"]+)"/.exec(use[0]);assert(href&&skeletonIds.has(href[1]),'uses may reuse skeleton paths, never whole scene/group snapshots');
    }
    const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
    for(const ref of svg.matchAll(/url\(#([^)]+)\)/g))assert(ids.includes(ref[1]),'shared definition references resolve');
    cases++;
  }
  for(const shadingMode of ['hatch','stipple','halftone']){
    // allDisks() reads flat round-cap stipple mark batches, so request that delivery.
    const options={labels:true,labelSize:24,shadingMode,quality:'preview',colorWash:true,castShadows:true,stippleFill:'marks'};
    const svg=current.render(current.examples.c60,options),parsed=layers(svg);
    assert(parsed.texts.length>10&&parsed.out.length>20,'C60 labels use owner layers');
    if(shadingMode==='stipple')assert.deepEqual(allDisks(svg),allDisks(current.render(current.examples.c60,{...options,labels:false})),'layering preserves every stipple disk');
  }
  {
    const before=await historicalRenderer('pre-labels');
    for(const name of ['sphere','ethanol','c60'])for(const shadingMode of ['hatch','stipple','halftone']){
      const options={labels:false,shadingMode,castShadows:false,lightAzimuth:0,lightElevation:0,colorWash:true,quality:'preview'};
      // Front-lit unshadowed visible normals have n.L>=0, the domain in which
      // old and new physical lighting agree. Keep that historical no-label
      // contract; the shadowed/backlit appearance intentionally changed.
      const legacy={...options,hatchMode:'continuous',atomRadiusScale:1,...(shadingMode==='stipple'?{quantizeShading:false}:{})};
      const actual=current.render(current.examples[name],legacy),expected=before.render(before.examples[name],options);
      // Exclusive halftone bands intentionally replace cumulative repainting.
      // Keep exact palette and ALL non-texture no-label geometry/metadata guards.
      if(shadingMode==='halftone')assertHalftonePaintMigration(actual,expected,`${name}/halftone no-label`);
      else assert.equal(actual,expected,`${name}/${shadingMode}: no-label SVG unchanged`);
    }
  }
  console.log(`Label depth checks passed: ${cases} overlap cases, three C60 styles, unchanged no-label geometry/palettes, no text clipping.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
