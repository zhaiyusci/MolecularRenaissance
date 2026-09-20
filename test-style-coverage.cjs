// Numerical union-area checks only: no browser, screenshots, or image libraries.
const assert = require('node:assert/strict');
const {buildDots} = require('./dots.js');
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const reference=value=>/^url\(#([^)]*)\)$/.exec(value||'')?.[1];
function polygonPath(d){
  // Keep subpaths separate: evenodd must preserve holes and disconnected islands.
  assert(!d.replace(/[MLCZ\s,\d.eE+\-]/g,''),'use supported M/L/C/Z curves for the area check');
  const tokens=d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
  const paths=[];let p=null;
  for(let i=0;i<tokens.length;){
    const token=tokens[i++];
    if(token==='M'){p=[];paths.push(p);}
    else if(token==='Z'){p=null;continue;}
    else if(token==='C'){
      assert(p&&p.length&&i+5<tokens.length,'valid cubic coordinates');
      const a=p[p.length-1],b=[+tokens[i++],+tokens[i++]],c=[+tokens[i++],+tokens[i++]],end=[+tokens[i++],+tokens[i++]];
      for(let j=1;j<=24;j++){
        const t=j/24,u=1-t;p.push([0,1].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*end[k]));
      }
      continue;
    }
    else if(token!=='L')i--;
    assert(p&&i+1<tokens.length,'valid closed polygon coordinates');
    const x=+tokens[i++],y=+tokens[i++];assert(Number.isFinite(x)&&Number.isFinite(y));p.push([x,y]);
  }
  const edges=new Map();let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const points of paths)for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    x0=Math.min(x0,a[0]);x1=Math.max(x1,a[0]);y0=Math.min(y0,a[1]);y1=Math.max(y1,a[1]);
    if(a[1]===b[1])continue;
    // Row-index contour edges so fine marching-squares paths stay inexpensive.
    for(let row=Math.floor(Math.min(a[1],b[1])/2);row<=Math.floor(Math.max(a[1],b[1])/2);row++){
      if(!edges.has(row))edges.set(row,[]);edges.get(row).push([a,b]);
    }
  }
  return {box:[x0,y0,x1,y1],contains:(x,y)=>{
    if(x<x0||x>x1||y<y0||y>y1)return false;
    let inside=false;
    for(const [a,b] of edges.get(Math.floor(y/2))||[])
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    return inside;
  }};
}
function shape(tag){
  const a=attrs(tag);
  if(tag.startsWith('<path'))return polygonPath(a.d);
  const x=+a.cx,y=+a.cy,rx=+(a.r??a.rx),ry=+(a.r??a.ry);
  const rotation=/^rotate\(([^)]+)\)$/.exec(a.transform||'');
  assert(!a.transform||rotation,'only ellipse rotation is supported');
  const values=rotation?rotation[1].trim().split(/[\s,]+/).map(Number):[0];
  assert(values.length===1||(values.length===3&&values[1]===x&&values[2]===y),'rotation is about ellipse center');
  const angle=values[0]*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),r=Math.max(rx,ry);
  return {box:[x-r,y-r,x+r,y+r],contains:(px,py)=>{
    if(!(rx>0&&ry>0))return false;
    const dx=px-x,dy=py-y;return ((c*dx+s*dy)/rx)**2+((-s*dx+c*dy)/ry)**2<=1;
  }};
}
function marks(svg) {
  const out=[],patterns=new Map(),clips=new Map();
  for(const m of svg.matchAll(/<clipPath\b([^>]*)>([\s\S]*?)<\/clipPath>/g)){
    const parts=[...m[2].matchAll(/<(?:circle|ellipse|path)\b[^>]*\/>/g)].map(v=>shape(v[0]));
    assert(parts.length,'clip must contain supported shapes');
    clips.set(attrs(m[1]).id,(x,y)=>parts.some(p=>p.contains(x,y)));
  }
  for(const m of svg.matchAll(/<pattern\b([^>]*)>([\s\S]*?)<\/pattern>/g)){
    const a=attrs(m[1]),dots=[...m[2].matchAll(/<circle\b[^>]*\/>/g)].map(v=>attrs(v[0]));
    assert.equal(a.patternUnits,'userSpaceOnUse');
    assert.equal(a.patternTransform,'rotate(45)');
    const w=+a.width,h=+a.height;assert(w>0&&h===w&&dots.length>0);
    const first=dots[0],cx=+first.cx,cy=+first.cy,r=+first.r;
    assert(dots.every(d=>+d.r===r),'wrapped disks must share a radius');
    patterns.set(a.id,{w,h,x:+(a.x||0),y:+(a.y||0),cx,cy,r,ink:+a['data-coverage'],dots});
  }
  // Definition circles (both screen tiles and surface clips) are NOT artwork.
  const artwork=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/g,'');
  const stack=[[]];
  for(const m of artwork.matchAll(/<\/?(?:g|circle|path|rect)\b[^>]*>/g)){
    const tag=m[0],a=attrs(tag);
    if(tag.startsWith('</g')){assert(stack.length>1);stack.pop();continue;}
    const inherited=stack[stack.length-1],clip=a['clip-path']?reference(a['clip-path']):null;
    if(a['clip-path'])assert(clip&&clips.has(clip),'clip reference must resolve');
    const active=clip?[...inherited,clips.get(clip)]:inherited;
    if(/^<g\b/.test(tag)){if(!tag.endsWith('/>'))stack.push(active);continue;}
    if(/^<path\b/.test(tag)&&a['data-stipple-radius']){
      const r=+a['data-stipple-radius'];
      assert.equal(a['stroke-linecap'],'round');assert.equal(a.fill,'none');assert.equal(a.stroke,'#161616');
      assert(Math.abs(+a['stroke-width']-2*r)<1e-10);
      const points=[...a.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g)];
      assert.equal(points.map(p=>p[0]).join(''),a.d,'only isolated zero-length round subpaths');
      for(const p of points){const x=+p[1],y=+p[2];out.push({box:[x-r,y-r,x+r,y+r],contains:(px,py)=>(px-x)**2+(py-y)**2<=r*r&&active.every(c=>c(px,py))});}
      continue;
    }
    let mark;
    if(/^<circle\b/.test(tag))mark=shape(tag);
    else if(/^<path\b/.test(tag)&&a.fill==='#161616')mark=shape(tag);
    else if(/^<rect\b/.test(tag)&&a['data-tone-level']){
      const pattern=patterns.get(reference(a.fill));assert(pattern,'tone paint server must resolve');
      assert.equal(pattern.ink,+a['data-tone-level']/16);
      assert(clip&&(clip.includes('-tone-')||clip.endsWith('-tone'))&&active.length>=2,'tone and outer surface clips are required');
      const x=+a.x,y=+a.y,w=+a.width,h=+a.height;
      mark={box:[x,y,x+w,y+h],contains:(px,py)=>{
        if(px<x||px>x+w||py<y||py>y+h)return false;
        // Invert rotate(45), then measure distance to the closest periodic disk.
        // This measures union area even for overlapping disks above pi/4 ink.
        const u=(px+py)*Math.SQRT1_2-pattern.x-pattern.cx;
        const v=(py-px)*Math.SQRT1_2-pattern.y-pattern.cy;
        const dx=u-Math.round(u/pattern.w)*pattern.w,dy=v-Math.round(v/pattern.h)*pattern.h;
        return dx*dx+dy*dy<=pattern.r*pattern.r;
      }};
    }
    if(mark){const contains=mark.contains;mark.contains=(x,y)=>contains(x,y)&&active.every(c=>c(x,y));out.push(mark);}
  }
  return out;
}
function assertPatternStructure(svg){
  const patterns=[...svg.matchAll(/<pattern\b([^>]*)>([\s\S]*?)<\/pattern>/g)];
  assert(patterns.length>0&&patterns.length<=16,'at most 16 cumulative patterns');
  const artwork=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/g,'');
  assert(!/<circle\b/.test(artwork),'halftone must not emit standalone dot circles');
  assert(!/<(?:image|filter)\b|\b(?:[\w-]*opacity|filter)\s*=/i.test(svg),'vector-only opaque ink');
  const levels=[...artwork.matchAll(/<rect\b[^>]*data-tone-level="(\d+)"/g)].map(m=>+m[1]);
  assert.equal(levels.length,patterns.length);assert.equal(new Set(levels).size,levels.length);
  const first=attrs(patterns[0][1]);let previous=0;
  for(const m of patterns){
    const a=attrs(m[1]);
    for(const key of ['width','height','x','y','patternUnits','patternContentUnits','patternTransform'])assert.equal(a[key],first[key],`matching lattice ${key}`);
    assert.equal(a.patternTransform,'rotate(45)');
    const circles=[...m[2].matchAll(/<circle\b[^>]*\/>/g)].map(v=>attrs(v[0]));
    assert(circles.length>0&&circles.length<=9,'bounded tile wrap copies');
    const pitch=+a.width,r=+circles[0].r;assert(r>=previous,'nested cumulative disks');previous=r;
    for(const c of circles){
      assert.equal(+c.r,r);
      for(const key of ['cx','cy'])assert(Math.abs((+c[key]/pitch-.5)-Math.round(+c[key]/pitch-.5))*pitch<.0002,'matching disk phase despite coordinate rounding');
    }
    assert.equal(circles.length,r>pitch/2?9:1,'large disks require neighbor wrap copies');
  }
}
function coverage(svg,box,mask=()=>true){
  const buckets=new Map(),cell=2;
  for(const mark of marks(svg)){
    const [x0,y0,x1,y1]=mark.box;
    // Only index the requested integration window, not the entire SVG.
    for(let j=Math.floor(Math.max(y0,box[1])/cell);j<=Math.floor(Math.min(y1,box[3])/cell);j++)for(let i=Math.floor(Math.max(x0,box[0])/cell);i<=Math.floor(Math.min(x1,box[2])/cell);i++){
      const key=i+','+j;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(mark);
    }
  }
  let ink=0,total=0,seed=173;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Stratified probes avoid aliasing a .3-unit sampling grid against the
  // rotated periodic screen (whose XY repeat can be exactly one unit).
  for(let y0=box[1];y0<box[3];y0+=.3)for(let x0=box[0];x0<box[2];x0+=.3){
    const x=x0+random()*Math.min(.3,box[2]-x0),y=y0+random()*Math.min(.3,box[3]-y0);
    if(!mask(x,y))continue;total++;
    if((buckets.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]).some(m=>m.contains(x,y)))ink++;
  }
  return ink/total;
}
if(require.main===module){
const scene=[{kind:'sphere',c:[0,0,0],r:1}];
for(const mode of ['stipple','halftone'])for(const target of [.1,.35,.65]){
  const svg=buildDots(scene,()=>0,p=>[p[0]*60,-p[1]*60],60,()=>0,
    {shadingMode:mode,dotSpacing:2.5,dotSize:.5},
    {query:(x,y,r)=>({id:0,clearance:r})},()=>target);
  if(mode==='halftone')assertPatternStructure(svg);
  const actual=coverage(svg,[-40,-40,40,40]);
  console.log(`${mode} target=${target.toFixed(3)} actual=${actual.toFixed(3)}`);
  const tolerance=mode==='halftone'?1/32+.008:.025;
  assert(Math.abs(actual-target)<tolerance,'dot union coverage should follow its target (including 16-level quantization)');
}
(async()=>{
  const {render}=await import('./dist/molplotter.mjs');
  const model={atoms:[{element:'O',position:[0,0,0]}],bonds:[]};
  const result={};
  for(const shadingMode of ['hatch','stipple','halftone']){
    const svg=render(model,{width:200,height:200,quality:'preview',textureScale:1,shadingMode});
    // Rendered SVGs also contain atom/outline artwork, so only validate the
    // screen fragment structurally in the direct buildDots cases above.
    // Normalize over the visible disk, not a cropped interior: the smooth
    // lighting deliberately redistributes the hatch model's crowded rim ink.
    result[shadingMode]=coverage(svg,[60,48,140,128],(x,y)=>(x-100)**2+(y-88)**2<39.5**2);
  }
  console.log('Sphere mean texture coverage (excluding outlines):',result);
  for(const mode of ['stipple','halftone'])assert(Math.abs(result[mode]-result.hatch)<.04,'style means should agree within 4 percentage points');
})().catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={coverage,marks};
