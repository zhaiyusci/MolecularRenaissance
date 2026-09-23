'use strict';
// Bitmap stipple fill: the baked 1-bit tiles must be valid PNGs whose ink grows
// with the tone level, and the renderer must deliver them as shared paint
// servers with no per-owner transform and no vector mark geometry.
const assert=require('node:assert/strict'),zlib=require('node:zlib');
const api=require('./renderer.js');
// Internal build module, not part of the public export contract.
const loadTiles=()=>import('./scripts/load-painter.mjs').then(({load})=>load('stipple-tiles.generated.js'));

// --- independent PNG reader: chunks, CRC, inflate, 1-bit unpack ---
const CRC=(()=>{const t=new Int32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[i]=c;}return t;})();
function readPng(data){
  const buf=Buffer.from(String(data).replace(/^data:[^,]*,/,''),'base64');
  assert.deepEqual([...buf.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG signature');
  const chunks={idat:[]};let p=8;
  while(p<buf.length){
    const len=buf.readUInt32BE(p),type=buf.toString('latin1',p+4,p+8),body=buf.subarray(p+8,p+8+len);
    let crc=0xffffffff;for(const b of buf.subarray(p+4,p+8+len))crc=CRC[(crc^b)&255]^(crc>>>8);
    assert.equal((crc^0xffffffff)>>>0,buf.readUInt32BE(p+8+len),type+' chunk CRC');
    if(type==='IHDR'){chunks.width=body.readUInt32BE(0);chunks.height=body.readUInt32BE(4);chunks.depth=body[8];chunks.color=body[9];}
    if(type==='PLTE')chunks.plte=Buffer.from(body);
    if(type==='tRNS')chunks.trns=Buffer.from(body);
    if(type==='IDAT')chunks.idat.push(body);
    p+=12+len;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks.idat));
  const stride=Math.ceil(chunks.width/8);
  assert.equal(raw.length,(stride+1)*chunks.height,'inflated size matches 1-bit rows plus filter bytes');
  const pixels=new Uint8Array(chunks.width*chunks.height);
  let ink=0;
  for(let y=0;y<chunks.height;y++){
    assert.equal(raw[y*(stride+1)],0,'filter type none');
    for(let x=0;x<chunks.width;x++) if((raw[y*(stride+1)+1+(x>>3)]>>(7-(x&7)))&1){pixels[y*chunks.width+x]=1;ink++;}
  }
  return {...chunks,pixels,ink,inkFraction:ink/(chunks.width*chunks.height)};
}

(async()=>{
const {STIPPLE_TILES}=await loadTiles();

// --- 1. the baked asset itself ---
assert.equal(STIPPLE_TILES.levels.length,16,'one tile per tone level');
assert(Number.isInteger(STIPPLE_TILES.px)&&STIPPLE_TILES.px>0,'tile pixel size');
assert(Number.isInteger(STIPPLE_TILES.markPx)&&STIPPLE_TILES.markPx>=1,'mark size in pixels');
assert(STIPPLE_TILES.period>0&&STIPPLE_TILES.dpi>0,'period and dpi recorded');
assert(new Set(STIPPLE_TILES.levels).size===16,'tiles are distinct');
const decoded=STIPPLE_TILES.levels.map(readPng);
for(const tile of decoded){
  assert.equal(tile.width,STIPPLE_TILES.px);assert.equal(tile.height,STIPPLE_TILES.px);
  assert.equal(tile.depth,1,'1-bit');assert.equal(tile.color,3,'indexed color keeps 1 bit and still allows transparency');
  assert.equal(tile.plte.length,6,'two palette entries');
  assert.equal(tile.plte[3],0);assert.equal(tile.plte[4],0);assert.equal(tile.plte[5],0,'index 1 is black ink');
  assert(tile.trns&&tile.trns.length===2,'tRNS carries per-entry alpha');
  // Paper must be fully transparent: otherwise the opaque white would paint over
  // the element colour wash underneath, which the vector marks never did.
  assert.equal(tile.trns[0],0,'index 0 (paper) is transparent');
  assert.equal(tile.trns[1],255,'index 1 (ink) is opaque');
  assert(tile.inkFraction>0&&tile.inkFraction<1,'tile carries marks and paper');
}
// Each level is an independent Poisson birth group, so a single increment may
// dip below its predecessor by chance. The tone contract is the overlay: levels
// 1..L unioned must reproduce coverage min(L/16, .995).
{
  const cumulative=new Uint8Array(decoded[0].pixels.length);
  let previous=0;
  for(let level=1;level<=decoded.length;level++){
    const born=decoded[level-1].pixels;
    for(let i=0;i<cumulative.length;i++) if(born[i]) cumulative[i]=1;
    let ink=0; for(const v of cumulative) ink+=v;
    const fraction=ink/cumulative.length, target=Math.min(level/16,0.995);
    assert(Math.abs(fraction-target)<.01,`level 1..${level} union covers ${(target*100).toFixed(1)}%, got ${(fraction*100).toFixed(2)}%`);
    assert(fraction>previous,`level 1..${level} union is denser than level 1..${level-1}`);
    previous=fraction;
  }
}
// The provisional print target must at least be self-consistent.
assert(Math.abs(STIPPLE_TILES.period-STIPPLE_TILES.px/((STIPPLE_TILES.printWidthMm/25.4)*STIPPLE_TILES.dpi/900))<1,'px derived from the recorded print target');

// --- 2. renderer delivery ---
const base={quality:'preview',renderMode:'precise',width:900,height:700,scale:60,shadingMode:'stipple',colorWash:true,castShadows:true};
const count=(svg,re)=>(svg.match(re)||[]).length;
for(const name of ['sphere','ethanol','c60']){
  const model=api.examples[name];
  // The first render tests the flat mark delivery explicitly; the bitmap legs name theirs too.
  const marks=api.render(model,{...base,quantizeShading:true,stippleFill:'marks'});
  assert.equal(count(marks,/<image /g),0,name+': marks delivery has no bitmap');
  assert.match(marks,/data-stipple-mode="quantized"/,name+': marks mode is declared');
  assert.match(marks,/data-birth-level="\d+"/,name+': marks carry birth levels');

  const bitmap=api.render(model,{...base,quantizeShading:true,stippleFill:'bitmap'});
  assert.match(bitmap,/data-stipple-mode="bitmap"/,name+': bitmap mode is declared');
  const images=count(bitmap,/<image /g);
  assert(images>0,name+': bitmap paints image tiles');
  assert.equal(count(bitmap,/<pattern [^>]*data-tile="bitmap"/g),images,name+': every tile pattern is marked bitmap');
  for(const m of bitmap.matchAll(/<image [^>]*href="([^"]*)"/g))assert.match(m[1],/^data:image\/png;base64,/,'tiles are inline PNG data URIs');
  // One transform for every owner, so a browser rasterizes each tile once.
  const transforms=new Set([...bitmap.matchAll(/patternTransform="([^"]*)"/g)].map(m=>m[1]));
  assert.equal(transforms.size,1,name+': shared pattern transform');
  // No per-owner transform and no vector mark batches on the bitmap path.
  assert.equal(count(bitmap,/<g transform="translate\(/g),0,name+': no per-owner pattern transform');
  assert.equal(count(bitmap,/data-stipple-radius/g),0,name+': no vector mark batches');
  // The baked tile payload is a fixed cost, so the delivery that wins depends on how
  // many marks the current density asks for, not on which molecule this is. At the
  // default density the flat mark set is still small for these models, so the bitmap
  // pays a few times its payload; the density sweep below is where it pulls ahead.
  assert(bitmap.length<marks.length*2.5,name+': bitmap stays within its fixed tile payload at the default density');
  assert.equal(api.render(model,{...base,quantizeShading:true,stippleFill:'bitmap'}),bitmap,name+': deterministic');
  // Untiling levels that carry no tone must not emit a tile.
  assert(images<=16,name+': at most one tile per level');
}
// Density decides the delivery, not molecule size. Finer texture means more marks,
// and the flat path is unbounded: its own guards start throwing while the bitmap
// stays flat. This is the property that a default-density-only check missed.
{
  const fine={...base,quantizeShading:true,textureScale:.3};
  for(const name of ['sphere','water','ethanol','glucose']){
    const model=api.examples[name];
    const bitmap=api.render(model,{...fine,stippleFill:'bitmap'});
    let marks=null;
    try{ marks=api.render(model,{...fine,stippleFill:'marks'}); }catch(e){ marks=null; }
    if(marks)assert(bitmap.length<marks.length*.5,`${name}: bitmap is far smaller once the density is fine (got ${(bitmap.length/marks.length).toFixed(2)}x)`);
    assert(bitmap.length<4*1048576,`${name}: bitmap stays bounded at fine density`);
  }
  // Larger models exceed the flat path's own budget at this density; the bitmap must
  // still render, and its size must not track the mark count that broke the flat one.
  for(const name of ['c60','phospholipid']){
    const model=api.examples[name];
    assert.throws(()=>api.render(model,{...fine,stippleFill:'marks'}),/Too many stipple marks|Dot screen too large/,`${name}: the flat mark path is the one that runs out of budget`);
    const bitmap=api.render(model,{...fine,stippleFill:'bitmap'});
    assert(bitmap.includes('<image')&&bitmap.length<4*1048576,`${name}: bitmap still renders and stays bounded`);
  }
  // Coarse densities reverse the trade, so the switch has to be two-sided.
  const coarse={...base,quantizeShading:true,textureScale:2.5};
  const coarseMarks=api.render(api.examples.water,{...coarse,stippleFill:'marks'});
  const coarseBitmap=api.render(api.examples.water,{...coarse,stippleFill:'bitmap'});
  assert(coarseBitmap.length>coarseMarks.length*2,'coarse density favours the flat marks, so the choice is not one-way');
}
assert.throws(()=>api.render(api.examples.sphere,{...base,stippleFill:'png'}),/Invalid stippleFill/,'unknown delivery rejected');
// Fast mode never uses the atlas; the option must be inert rather than throwing.
const fast=api.render(api.examples.sphere,{...base,renderMode:'fast',castShadows:false,quantizeShading:undefined,stippleFill:'bitmap'});
assert(!fast.includes('<image'),'fast mode ignores the bitmap delivery');
console.log(`PASS bitmap stipple fill: 16 valid 1-bit PNG tiles (mark ${STIPPLE_TILES.markPx}px at ${STIPPLE_TILES.dpi} dpi, tile ${STIPPLE_TILES.px}px), shared paint servers, deterministic, marks path intact`);
})().catch(e=>{console.error(e);process.exitCode=1;});
