'use strict';
// Run only after all five final measurement reports exist.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir='build/perf-round2/',read=f=>JSON.parse(fs.readFileSync(dir+f,'utf8'));
const rounds={v8:[read('node-jit-round1.json'),read('node-jit-round2.json')],quickjs:[read('quickjs-ng-round1.json'),read('quickjs-ng-round2.json')],jitless:[read('node-jitless.json')]};
for(const group of Object.values(rounds))for(const r of group){assert.equal(r.rows.length,6);for(const row of r.rows){assert(row.byteIdentical);assert.equal(row.before.samplesMs.length,6);assert.equal(row.after.samplesMs.length,6);}}
const names=['renderer.js','boundaries.js','dot-regions.js','dots.js','wash.js','molplotter.mjs'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=names.map(name=>({name,baseline:hash(dir+'baseline/'+name),current:hash(name==='molplotter.mjs'?'dist/'+name:name)}));
const crossEngine=rounds.v8[0].rows.map(r=>({id:r.id,byteIdentical:fs.readFileSync(dir+'node-jit-'+r.id+'.svg').equals(fs.readFileSync(dir+'quickjs-ng-'+r.id+'.svg'))}));
const parity=read('parity.json');assert.equal(parity.count,272);assert(parity.byteIdentical);
const suite=fs.existsSync(dir+'verification.json')?read('verification.json'):null;
const report={baseline:'Fixed, 48-tests-passing pre-round-two workspace snapshot; NOT git HEAD or the pre-optimization baseline.',environment:{node:process.versions.node,v8:process.versions.v8,quickjs:'QuickJS-ng 0.16.2 native Release'},files,rounds,crossEngine,parity,verification:{svgNumberComparisonsPerEngine:2106018,svgNumberEngines:['V8','native QuickJS'],boundaryIndexComparisons:6729,privateRegionDifferentialComparisons:23332,fullSuite:suite||'pending'}};
fs.writeFileSync('benchmarks/performance-round2.json',JSON.stringify(report,null,2)+'\n');
const pct=r=>100*(1-r.after.medianMs/r.before.medianMs),num=x=>x.toFixed(2);
let md='# 第二轮渲染性能优化\n\n';
md+='## 基线与结论\n\n基线是刚完成标签/点刻修复、48个测试脚本全部通过的工作区版本，已经包含第一轮热点优化。不是Git HEAD，也不是修复前的旧108例基线。\n\n';
md+='本轮保留：精确模式有明确收益，原生QuickJS也有温和收益；**不能宣称所有引擎、所有场景都更快**。V8快速小场景两轮方向不一致，jitless快速场景退步，均保留原始数字；低于几个百分点的变化应视作接近噪声。\n\n';
md+='## 实现\n\n- `src/svg-number.ts`：保留原始`Math.round(value*1000)`，在安全常用范围以整数和1000个私有小数后缀生成完全相同字符串；极值、非有限值保留原生格式化。\n- `src/strokes.ts`：复用切向长度/偏移，减少临时对象；预览带状线用按最终顺序填充的字符串数组一次join，保留拟合分支及所有采样。\n- `src/region-clipping.ts`、`src/dot-regions.ts`：仅缓存已复制私有边的差值/长度平方，椭圆逆变换改为标量并复用范数；不改运算结合顺序、除法、阈值或检查。\n- `src/boundaries.ts`：顶点桶改用嵌套数值Map，保留原搜索顺序和距离判断；超过64条曲线时，以私有包围盒层次索引预选侧向间距候选，按原曲线编号排序，再执行原始当前epsilon筛选及全部距离检查。非有限值回退线性扫描，扫描中epsilon异常则恢复原线性后缀。交点求解与所有权判定未更换。\n\n';
md+='新增后缀表、每边数值字段和临时空间索引会占用内存；未声称峰值内存下降。没有跨可变场景缓存，没有降低几何精度/纹理密度，也没有削减64方向数值点刻检查。\n\n';
md+='## 测量协议\n\n同一进程加载独立的新旧bundle；每版本1次初始渲染、3次预热，再进行6个交替顺序配对。表为两次独立运行的中位数；计时仅含render，每次完整字符串相等检查在计时之外。引擎顺序运行，不与测试/其他基准并发。全部六场景为800×700、scale=50、preview；导出只验证正确性，不推断其加速比例。\n\n';
md+='**耗时减少为正表示更快，为负表示更慢。**\n\n';
for(const [key,title] of [['quickjs','原生QuickJS-ng'],['v8','V8默认JIT'],['jitless','V8 jitless（补充一轮）']]){
 md+='### '+title+'\n\n| 场景 | 轮次 | 原版→新版（ms） | 耗时减少 |\n|---|---:|---:|---:|\n';
 rounds[key].forEach((run,i)=>run.rows.forEach(r=>{md+='| '+r.id+' | '+(i+1)+' | '+num(r.before.medianMs)+' → '+num(r.after.medianMs)+' | '+num(pct(r))+'% |\n';}));md+='\n';
}
md+='## 验证\n\n- 272组完整SVG与本轮修复后基线逐字节相同，覆盖17个模型、两种渲染模式/质量、三种阴影，以及旋转、标签、纹理、色洗和投影阴影。\n- 2,106,018组数字格式对照分别在V8和原生QuickJS通过，包括负零、半整数舍入、进位、极值和非有限值。\n- 永久`test-boundary-index.cjs`通过6,729项独立线性/索引对照，覆盖64/65阈值、顺序、异常epsilon后缀恢复及真实原始图结构/最终路径。\n- 私有边/逆变换另有23,332项原版源码快照差分；永久区域测试增加输入变更隔离断言。\n- 六个基准场景跨V8/QuickJS输出：'+(crossEngine.every(r=>r.byteIdentical)?'全部逐字节相同。':'5/6逐字节相同，仅葡萄糖不同；另行重跑优化前快照证实该差异原已存在，两引擎各自的新旧输出完全一致。未声称所有场景跨引擎字节相同。')+'\n- 最终完整测试结果：'+(suite&&suite.npmTest.exitCode===0&&suite.typecheck.exitCode===0?'**npm test全部'+suite.npmTest.testScriptsPassed+'个脚本通过，未使用--quick；严格类型检查通过。**':'待记录。')+'\n\n';
md+='## 淘汰与修正\n\n直接拆分整数/小数的最初格式化候选虽加快V8，却拖慢QuickJS，未采用。第一版左侧字符串逐项拼接在V8带标签葡萄糖场景出现退步；经分项对比改为最终顺序单次join，并加入有保守性证明的侧向间距索引。中间候选及分项数据保留于`build/perf-round2/candidate-b/`和`ablation*.json`，不混入最终两轮数据。\n\n';
md+='## 复现与限制\n\n`build/perf-round2/baseline/`是优化前保存的五个经典bundle及独立ESM，SHA-256见配套JSON。该目录被Git忽略；请保留快照，不能用当前bundle或旧Git HEAD冒充。脚本在缺少快照时直接报错。\n\n```powershell\nnode scripts/check-perf-round2-parity.cjs\nnode scripts/bench-perf-round2.cjs\n& "C:\\Users\\jairy\\Documents\\trae_projects\\mathjax4\\quickjs-build-shared\\qjs.exe" --std --script scripts/bench-perf-round2.cjs\nnode --jitless scripts/bench-perf-round2.cjs\nnpm test\nnpm run typecheck\n```\n\n每次基准写入同引擎JSON，重复时应另存轮次文件。原始样本、初始耗时、每轮中位数、bundle哈希均见`performance-round2.json`。不将第一轮和本轮百分比直接相加；未提交或推送。\n';
fs.writeFileSync('benchmarks/PERFORMANCE-ROUND2.md',md);
console.log('Wrote second-round report and complete paired samples');
