import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {load} from './load-painter.mjs';
import {painterCases} from './painter-cases.mjs';
const {renderPainter}=await load('painter-experiment.js'),{render,examples}=await load('renderer.js');
const report=JSON.parse(readFileSync('benchmarks/painter-experiment.json','utf8'));
const dir='experiments/painter';mkdirSync(dir,{recursive:true});
const selected=new Set(['overlap-separated','stack-32','c60-original','c60-atoms-only']);
const manifest=[],sections=[];
for(const {name,model} of painterCases(examples)){
  if(!selected.has(name))continue;
  const before=render(model,report.options),trial=renderPainter(model,report.options),{svg,...diagnostics}=trial;
  writeFileSync(`${dir}/${name}-before.svg`,before);writeFileSync(`${dir}/${name}-painter.svg`,svg);
  const row=report.rows.find(r=>r.name===name);manifest.push({name,...diagnostics,measurement:row});
  sections.push(`<section><h2>${name}</h2><p>路线：<b>${trial.route}</b> · ${trial.reason} · 原版 ${row.beforeMs} ms → 实验 ${row.afterMs} ms</p><div class="pair"><figure><figcaption>基线 b79d28d <a href="${name}-before.svg">打开 SVG</a></figcaption><img src="${name}-before.svg" alt="基线 ${name}"></figure><figure><figcaption>前景覆盖实验 <a href="${name}-painter.svg">打开 SVG</a></figcaption><img src="${name}-painter.svg" alt="实验 ${name}"></figure></div></section>`);
}
writeFileSync(`${dir}/manifest.json`,JSON.stringify({baselineCommit:'b79d28d',options:report.options,cases:manifest},null,2)+'\n');
writeFileSync(`${dir}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>前景覆盖实验</title><style>body{font:16px system-ui;margin:24px auto;max-width:1200px;padding:0 20px;color:#222;background:#f4f2ee}h1{font-size:26px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;background:white;border:1px solid #ccc}figcaption{padding:10px}img{display:block;width:100%;height:auto}section{margin:32px 0}a{color:#345582}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>前景覆盖：独立实验，不替换默认引擎</h1><p>安全排序时不计算跨原子可见片段、不测试标签中心。同半径球面复用完整排线。当前仅支持平行光；含键、投影阴影、非排线模式或球面前后关系反转时回退原引擎。旧光照选项 lightType、lightDistance、lightAttenuation 显式提供均会被拒绝。所列计时为历史测量，非当前版本重测。</p><p><b>C60 atoms only 明确移除了键，仅为实验夹具，不能冒充原 C60 的性能。</b>计时只包含 SVG 生成；图版比例固定，两栏参数相同。本页可离线打开。</p>${sections.join('')}</html>`);
console.log(`Wrote ${dir}/index.html and ${manifest.length} SVG comparison pairs.`);
