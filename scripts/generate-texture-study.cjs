'use strict';
// Design study only: does not alter renderer mappings or scientific geometry.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'design/element-textures';
const entries = [
  // Core: no tiny hollow glyphs. Carbon has the greatest nominal ink coverage.
  ['H', '留白', 'core', 6, ''],
  ['C', '深色斜交叉网', 'core', 6, '<path d="M0 3H6M3 0V6" stroke-width="1.2"/>', 45],
  ['O', '斜线', 'core', 7, '<path d="M0 3.5H7"/>', 45],
  ['N', '横线', 'core', 7, '<path d="M0 3.5H7"/>'],
  ['S', '实心点', 'core', 6, '<circle cx="3" cy="3" r="1.15" fill="#161616" stroke="none"/>'],
  ['P', '竖线', 'core', 7, '<path d="M0 3.5H7"/>', 90],
  // Important halogens: SAME wave geometry; distinguish gross orientation only.
  ['F', '横向波线', 'priority', 12, '<path d="M0 6Q3 0 6 6T12 6"/>'],
  ['Cl', '竖向波线', 'priority', 12, '<path d="M0 6Q3 0 6 6T12 6"/>', 90],
  ['Br', '斜向波线', 'priority', 12, '<path d="M0 6Q3 0 6 6T12 6"/>', 45],
  // Secondary continuous structures: no dashes, zigzags or miniature glyphs.
  ['I', '成对横线', 'candidate', 10, '<path d="M0 3H10M0 6H10"/>'],
  ['B', '反向斜线', 'candidate', 7, '<path d="M0 3.5H7"/>', 135],
  ['Si', '正交网格', 'candidate', 9, '<path d="M0 4.5H9M4.5 0V9"/>'],
  ['Se', '成对斜线', 'candidate', 10, '<path d="M0 3H10M0 6H10"/>', 45],
  ['Li', '反斜双线', 'candidate', 10, '<path d="M0 3H10M0 6H10"/>', 135],
  ['Na', '成对竖线', 'candidate', 10, '<path d="M0 3H10M0 6H10"/>', 90],
  ['K', '连续回纹', 'candidate', 20, '<path d="M0 0V2.5H17.5V17.5H2.5V7.5H12.5V12.5H7.5V10H5V15H15V5H0V20"/>'],
  ['Mg', '粗细交替横线', 'candidate', 12, '<path d="M0 3H12" stroke-width="2"/><path d="M0 9H12"/>'],
  ['Ca', '竖向砖纹', 'candidate', 12, '<path d="M0 3H12M0 9H12M3 3V9M9 0V3M9 9V12"/>', 90],
  ['Al', '横向砖纹', 'candidate', 12, '<path d="M0 3H12M0 9H12M3 3V9M9 0V3M9 9V12"/>'],
];
assert.equal(entries.length, 19);
assert.equal(new Set(entries.map(e => e[0])).size, 19);
const definitions = entries.map(([symbol, , , pitch, body, angle = 0]) =>
  `<pattern id="study-${symbol}" data-element="${symbol}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" width="${pitch}" height="${pitch}" patternTransform="rotate(${angle})"><g fill="none" stroke="#161616" stroke-width="0.9" stroke-linecap="butt" stroke-linejoin="round">${body}</g></pattern>`);
assert.equal(entries[0][4], '', 'Hydrogen must contain no ink marks');
assert.equal(entries.slice(0, 6).map(e => e[0]).join(''), 'HCONSP');
assert(entries.slice(6).every(e => !/<(?:circle|rect|polygon)\b/.test(e[4])), 'No secondary miniature glyphs');
assert(!definitions.join('').includes('stroke-dasharray'), 'No dashed textures');
assert.equal(new Set(entries.slice(6, 9).map(e => e[4])).size, 1, 'Halogens share the same wave shape');
assert.deepEqual(entries.slice(6, 9).map(e => e[5] || 0), [0, 90, 45]);
assert.equal(entries.slice(0, 9).map(e => e[0]).join(' '), 'H C O N S P F Cl Br');
// Rotation is part of a recipe: O/N/P intentionally share a line primitive.
assert.equal(new Set(definitions.map(d => d.replace(/ (?:id|data-element|data-role|data-pattern)="[^"]*"/g, ''))).size, 19);
const text = (x, y, value, size = 14, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${value}</text>`;
const atom = (symbol, x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="white"/><circle data-sample="${symbol}" cx="${x}" cy="${y}" r="${r}" fill="url(#study-${symbol})" stroke="#161616" stroke-width="1"/>`;
const cards = entries.map(([symbol, name, status], i) => {
  const x = 24 + (i % 2) * 536, y = 174 + Math.floor(i / 2) * 112;
  // Translate the entire card so every sample uses a reproducible pattern phase.
  return `<g transform="translate(${x} ${y})"><rect width="520" height="104" rx="5" fill="white" stroke="#ddd"/>
${text(12, 25, symbol, 23, 'font-weight="700"')}${text(12, 48, name, 14)}${text(12, 76, status === 'core' ? '核心简纹' : status === 'priority' ? '重点卤素' : '辅助候选', 12, 'fill="#666"')}
${atom(symbol, 180, 47, 32)}${atom(symbol, 257, 47, 16)}${atom(symbol, 315, 47, 8)}
${atom(symbol, 388, 47, 24)}<circle cx="408" cy="47" r="24" fill="white" stroke="#161616" stroke-width="1"/>
<rect x="463" y="35" width="24" height="24" fill="url(#study-${symbol})" stroke="#aaa" stroke-width="0.5"/>
${text(168, 96, '64')}${text(246, 96, '32')}${text(304, 96, '16')}${text(363, 96, '遮挡 48')}${text(455, 96, '图例 24')}
</g>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1350" viewBox="0 0 1100 1350" role="img" aria-labelledby="title desc">
<title id="title">19 种常用元素：独立纹理候选样张</title><desc id="desc">自定义设计，不是行业标准。六种核心简纹、三种重点卤素波线和十种辅助候选；无虚线；展示64、32、16像素直径、48像素遮挡及24像素图例。应用映射尚未修改。</desc>
<defs>${definitions.join('\n')}</defs><rect width="1100" height="1350" fill="white"/>
<g font-family="Arial, Microsoft YaHei, sans-serif" fill="#161616">
${text(24, 42, '19 种常用元素 · 独立纹理候选样张', 27, 'font-weight="700"')}
${text(24, 74, '自定义方案 v3｜F / Cl / Br 用横 / 竖 / 斜波线；无虚线，保留双线、砖纹，加入回纹。', 16)}
${text(24, 102, '数字表示圆直径 / 图例边长（SVG px）；仅测试纹理辨识，不代表原子半径或 Å 尺度。', 14)}
${text(24, 128, '无颜色、无光影；白圆模拟前景遮挡。请按 100% 查看，小尺寸仍需元素标签。', 14)}
${text(24, 152, '优先比较 H / C / O / N / S / P / F / Cl / Br；其余为辅助候选。尚未接入应用。', 14)}
${cards.join('\n')}
${text(24, 1322, '建议：先评审样张，再固定映射。图案不同不等于缩小、打印或遮挡后仍可可靠识别。', 14)}
</g></svg>`;
assert(!/<(?:image|filter)\b/.test(svg));
assert.equal((svg.match(/data-sample=/g) || []).length, 19 * 4);
for (const [symbol] of entries) assert(svg.includes(`id="study-${symbol}"`));
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/common-19-study.svg`, svg);
const coreRows = [1, .75, .5, 1 / 3].map((scale, i) => {
  const y = 140 + i * 102;
  return text(24, y + 5, `${Math.round(scale * 100)}% / Ø${48 * scale}px`, 16) + entries.slice(0, 6).map(([symbol], j) =>
    `<g transform="translate(${230 + j * 140} ${y}) scale(${scale})">${atom(symbol, 0, 0, 24)}</g>`).join('');
}).join('\n');
const coreSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="560" viewBox="0 0 1020 560"><title>核心六元素 v3：整体缩小测试</title><defs>${definitions.slice(0, 6).join('')}</defs><rect width="1020" height="560" fill="white"/><g font-family="Arial, Microsoft YaHei, sans-serif" fill="#161616">${text(24, 38, '核心六元素 v3 · 纹理与圆一起缩小', 25)}${text(24, 66, 'H 留白 / C 深网 / O 斜线 / N 横线 / S 实心点 / P 竖线；无颜色、无光影。', 16)}${entries.slice(0, 6).map(([s], j) => text(222 + j * 140, 101, s, 21)).join('')}${coreRows}${text(24, 528, '底行模拟原图整体缩至 1/3；细线仍会损失，小尺寸不能取消元素标签。样张不改变应用。', 16)}</g></svg>`;
assert.equal((coreSvg.match(/data-sample=/g) || []).length, 24);
fs.writeFileSync(`${out}/core-6-study.svg`, coreSvg);
const priorityRows = [1, .75, .5, 1 / 3].map((scale, i) => {
  const y = 140 + i * 102;
  return text(24, y + 5, `${Math.round(scale * 100)}% / Ø${48 * scale}px`, 16) + entries.slice(0, 9).map(([symbol], j) =>
    `<g transform="translate(${180 + j * 100} ${y}) scale(${scale})">${atom(symbol, 0, 0, 24)}</g>`).join('');
}).join('\n');
const prioritySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="560" viewBox="0 0 1040 560"><title>重点九元素 v3：含氟氯溴的整体缩小测试</title><defs>${definitions.slice(0, 9).join('')}</defs><rect width="1040" height="560" fill="white"/><g font-family="Arial, Microsoft YaHei, sans-serif" fill="#161616">${text(24, 38, '重点九元素 v3 · 核心六种 + F / Cl / Br', 25)}${text(24, 66, 'F 横波线 / Cl 竖波线 / Br 斜波线：同一波形、不同方向；无虚线、不用波线与折线作区别。', 16)}${entries.slice(0, 9).map(([s], j) => text(172 + j * 100, 101, s, 21)).join('')}${priorityRows}${text(24, 528, '圆与纹理一起缩小；最底行是原尺寸 1/3。另见19元素样张中的遮挡、双线、砖纹和回纹。', 16)}</g></svg>`;
assert.equal((prioritySvg.match(/data-sample=/g) || []).length, 36);
fs.writeFileSync(`${out}/priority-9-study.svg`, prioritySvg);
fs.writeFileSync(`${out}/index.html`, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>常用元素纹理候选</title><style>body{margin:24px;background:#eee;font:16px Arial,'Microsoft YaHei',sans-serif;color:#222}button{padding:8px 16px;margin:0 8px 12px 0}#sheet{overflow:auto;background:white}img{display:block;width:1100px;max-width:none}body.fit img{width:100%;height:auto}body.half img{width:550px;height:auto}p{line-height:1.6}@media print{body{margin:0;background:white}nav,p{display:none}#sheet{overflow:visible}img{width:100%;height:auto}}</style><nav><button onclick="document.body.className=''">100% 尺寸</button><button onclick="document.body.className='half'">整体缩小至 50%</button><button onclick="document.body.className='fit'">适应宽度</button><a href="common-19-study.svg" download>下载19元素 SVG</a> · <a href="priority-9-study.svg">重点九元素缩小测试（含 F / Cl / Br）</a> · <a href="core-6-study.svg">核心六元素</a></nav><p>这是评审样张，不会改变应用中的纹理。默认 100%：纹理与圆尺寸同时缩小时的印刷表现，需要另行检查。</p><div id="sheet"><img src="common-19-study.svg" alt="19种元素纹理多尺寸候选对照表"></div></html>`);
console.log(`PASS: 19 unique definitions, 76 atom samples, 24 core + 36 priority downscaling samples, blank H, no dashes, shared halogen wave shape, vector-only. Wrote ${out}/common-19-study.svg and index.html`);
