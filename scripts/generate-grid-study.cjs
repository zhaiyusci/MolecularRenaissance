'use strict';
// Standalone design study: no element assignments or application changes.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'design/element-textures';
const h = 18 * Math.sqrt(3) / 2;
// Infinite line families: a*x + b*y = k*d. Translation by either tile edge
// must add an integer number of periods, including all triangle diagonals.
const grids = [
  { id:'carbon', name:'C 深色斜交叉网', note:'参照：1.2 线宽 / 6 节距', w:6, h:6, ink:1.5, angle:45, families:[[1,0,6],[0,1,6]] },
  { id:'square', name:'正方网', note:'9 × 9；四向交点', w:9, h:9, ink:.9, families:[[1,0,9],[0,1,9]] },
  { id:'rect-h', name:'横长方网', note:'18 × 6；宽高比 3∶1', w:18, h:6, ink:.9, families:[[1,0,18],[0,1,6]] },
  { id:'rect-v', name:'竖长方网', note:'6 × 18；宽高比 1∶3', w:6, h:18, ink:.9, families:[[1,0,6],[0,1,18]] },
  { id:'rhombus', name:'扁菱形网', note:'对角线 24 × 8；不是斜方网', w:24, h:8, ink:.9, families:[[-1/3,1,8],[1/3,1,8]] },
  { id:'triangle', name:'等边三角形网', note:'边长 18；三组直线共点', w:18, h:2*h, ink:.9, families:[[0,1,h],[Math.sqrt(3),1,2*h],[-Math.sqrt(3),1,2*h]] },
  { id:'brick-h', name:'横向砖纹', note:'18 × 6 砖块；半砖错缝', w:18, h:12, ink:.9, brick:true },
  { id:'brick-v', name:'竖向砖纹', note:'同一砖纹旋转 90°', w:18, h:12, ink:.9, brick:true, angle:90 },
];
// Match actual FACE area (not SVG tile area or black coverage).
// Each 64px circle now contains ~40 complete-cell equivalents regardless of mesh.
const targetCellArea = 81;
function cellArea(g) {
  if (g.id==='triangle') return g.w*g.h/4;
  if (g.id==='rhombus' || g.brick) return g.w*g.h/2;
  return g.w*g.h;
}
function coverage(g, scale=1) {
  const t=g.ink/scale;
  if (g.id==='triangle') return 1-(1-1.5*t/(g.h/2))**2;
  if (g.id==='rhombus') {
    const [a,b,d]=g.families[0], gap=d/Math.hypot(a,b);
    return 1-(1-t/gap)**2;
  }
  return 1-(1-t/g.w)*(1-t/(g.brick?g.h/2:g.h));
}
for (const g of grids) {
  g.before=coverage(g);
  const factor=Math.sqrt(targetCellArea/cellArea(g));
  g.w*=factor; g.h*=factor;
  if (g.families) g.families=g.families.map(([a,b,d])=>[a,b,d*factor]);
  g.spacingScale=factor;
  g.after=coverage(g);
  assert(Math.abs(cellArea(g)-targetCellArea)<1e-8);
  g.note=`每格 81 px² · 线宽 ${g.ink} px`;
}
function segments(g) {
  if (g.brick) return [[0,0,g.w,0],[0,g.h/2,g.w,g.h/2],[0,g.h,g.w,g.h],[g.w/4,0,g.w/4,g.h/2],[3*g.w/4,g.h/2,3*g.w/4,g.h]];
  const lines=[];
  for (const [a,b,d] of g.families) {
    const max = Math.ceil((Math.abs(a)*g.w*3 + Math.abs(b)*g.h*3)/d)+2;
    for (let k=-max;k<=max;k++) {
      if (!b) lines.push([k*d/a,-g.h,k*d/a,2*g.h]);
      else lines.push([-g.w,(k*d+a*g.w)/b,2*g.w,(k*d-a*2*g.w)/b]);
    }
  }
  return lines;
}
function definition(g) {
  const paths=segments(g).map(([x,y,u,v])=>`M${x} ${y}L${u} ${v}`).join('');
  return `<pattern id="grid-${g.id}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" width="${g.w}" height="${g.h}" patternTransform="rotate(${g.angle||0})" overflow="hidden"><path d="${paths}" fill="none" stroke="#161616" stroke-width="${g.ink}" stroke-linecap="butt"/></pattern>`;
}
const near = (a,b) => Math.abs(a-b)<1e-8;
for (const g of grids) for (const [a,b,d] of g.families||[]) {
  assert(near(a*g.w/d,Math.round(a*g.w/d)),`${g.id}: horizontal seam`);
  assert(near(b*g.h/d,Math.round(b*g.h/d)),`${g.id}: vertical seam`);
}
const triangle=grids.find(g=>g.id==='triangle');
assert(near(Math.hypot(triangle.w/2,triangle.h/2),triangle.w),'Triangle edges must be equilateral');
for (const [x,y] of [[0,0],[triangle.w,0],[triangle.w/2,triangle.h/2],[0,triangle.h]]) {
  assert(triangle.families.every(([a,b,d])=>near((a*x+b*y)/d,Math.round((a*x+b*y)/d))), 'All three families must meet at lattice vertices');
}
assert(near(grids[2].w/grids[2].h,3));
assert(near(grids[3].h/grids[3].w,3));
assert(near(grids[4].w/grids[4].h,3));
// Independent deterministic stratified area sampling of actual stroke unions.
// This checks vector geometry, not browser antialiasing or print perception.
function distancePeriodic(x,period) { return Math.abs(x-Math.round(x/period)*period); }
function isInk(g,x,y) {
  const r=g.ink/2;
  if (g.brick) {
    if (distancePeriodic(y,g.h/2)<=r) return true;
    return distancePeriodic(x-(y<g.h/2?g.w/4:3*g.w/4),g.w)<=r;
  }
  return g.families.some(([a,b,d])=>distancePeriodic(a*x+b*y,d)/Math.hypot(a,b)<=r);
}
for (const g of grids) {
  const n=640; let hits=0, seed=123456789;
  const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
    if (isInk(g,(x+random())*g.w/n,(y+random())*g.h/n)) hits++;
  }
  g.sampled=hits/(n*n);
  assert(Math.abs(g.sampled-g.after)<.002,`${g.id}: sampled stroke union disagrees with target`);
}
assert.equal(new Set(grids.map(g=>g.id)).size,8);
const defs = grids.map(definition).join('\n');
const text=(x,y,s,size=14)=>`<text x="${x}" y="${y}" font-size="${size}">${s}</text>`;
const samples=[];
function circle(g,x,y,r,scale=1,occluded=false) {
  samples.push({g,x,y,r,scale,occluded});
  return `<g transform="translate(${x} ${y}) scale(${scale})"><circle r="${r}" fill="white"/><circle data-grid-sample="${g.id}" r="${r}" fill="url(#grid-${g.id})" stroke="#161616" stroke-width="1"/>${occluded?`<circle cx="${r*.85}" r="${r}" fill="white" stroke="#161616" stroke-width="1"/>`:''}</g>`;
}
const rows=grids.map((g,i)=>{
  const y=205+i*112;
  return `<g>${text(24,y-13,g.name,19)}${text(24,y+14,g.note,12)}
${circle(g,300,y,32)}${circle(g,395,y,16)}${circle(g,470,y,8)}
${circle(g,570,y,32,.5)}${circle(g,665,y,32,1/3)}
${circle(g,780,y,24,1,true)}
<rect x="898" y="${y-32}" width="64" height="64" fill="url(#grid-${g.id})" stroke="#aaa" stroke-width=".5"/>
<path d="M24 ${y+52}H986" stroke="#ddd"/></g>`;
}).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="1150" viewBox="0 0 1020 1150" role="img" aria-labelledby="title desc"><title id="title">连续网纹候选：缩小与遮挡对照</title><desc id="desc">C 深网参照、正方网、横竖长方网、扁菱形网、等边三角网、横竖砖纹。除 C 外尚未分配元素，不含回纹或虚线。</desc><defs>${defs}</defs><rect width="1020" height="1150" fill="white"/><g font-family="Arial, Microsoft YaHei, sans-serif" fill="#161616">
${text(24,40,'连续网纹候选 · 同格子量级版',26)}
${text(24,72,'各网纹每小格面积 81 px²；C 同样大小但用 1.5 px 粗线，其他为 0.9 px。不再统一墨量。',16)}
${text(24,99,'左侧缩小圆不缩纹理；中间两列将圆和纹理一起缩小。右侧检查遮挡和连续结构。')}
${text(24,124,'菱形采用扁长比例，三角网采用真正三方向等边网；尺寸均为 SVG px，不代表原子半径。')}
${text(277,160,'Ø64')}${text(376,160,'Ø32')}${text(452,160,'Ø16')}${text(541,160,'整图 50%')}${text(633,160,'整图 33%')}${text(751,160,'遮挡 Ø48')}${text(897,160,'纹理平铺')}
${rows}
${text(24,1102,'观察重点：C / 扁菱形 / 三角网；长方网 / 砖纹。小圆可能只露出线段，仍需标签辅助。')}
${text(24,1127,'Ø64 圆约容纳 40 个小格等效面积；形状方向仍影响观感，需结合实际尺寸评审。应用未改。')}
</g></svg>`;
assert.equal((svg.match(/data-grid-sample=/g)||[]).length,48);
assert(!/stroke-dasharray|<(?:image|filter)\b/.test(svg));
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/grid-comparison.svg`,svg);
fs.writeFileSync(`${out}/grid-comparison.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>连续网纹对照</title><style>body{margin:20px;font:16px Arial,'Microsoft YaHei',sans-serif;background:#eee}button{padding:8px;margin:0 8px 12px 0}section{overflow:auto;background:white}img{display:block;width:1020px;max-width:none}.fit img{width:100%;height:auto}.half img{width:510px;height:auto}</style><nav><button onclick="document.body.className=''">100%</button><button onclick="document.body.className='half'">整体50%</button><button onclick="document.body.className='fit'">适应宽度</button><a href="grid-comparison.svg" download>下载 SVG</a></nav><section><img src="grid-comparison.svg" alt="八种连续网纹的多尺寸与遮挡对照"></section></html>`);
fs.writeFileSync(`${out}/grid-density.json`,JSON.stringify({targetCellArea,method:'Equal geometric face area, not equal ink coverage. Different shapes may still differ perceptually; coverage is diagnostic only.',grids:grids.map(g=>({id:g.id,name:g.name,lineWidth:g.ink,tileWidth:g.w,tileHeight:g.h,cellArea:cellArea(g),cellsPer64pxCircle:Math.PI*32*32/cellArea(g),spacingScale:g.spacingScale,afterCoverage:g.after,sampledCoverage:g.sampled}))},null,2)+'\n');
console.table(grids.map(g=>({grid:g.id,cellArea:cellArea(g).toFixed(2),lineWidth:g.ink,coverage:`${(g.after*100).toFixed(2)}%`,sampled:`${(g.sampled*100).toFixed(2)}%`})));
assert.equal(grids[0].w,grids[1].w,'Carbon must use the same grid scale as square mesh');
require('./grid-study-raster.cjs')(grids,isInk,`${out}/grid-geometry-preview.png`);
console.log('PASS: equal face areas, geometry raster generated; 8 grids, 48 circles; periodic seams and shape proportions retained.');
