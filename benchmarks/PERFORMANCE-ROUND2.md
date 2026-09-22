# 第二轮渲染性能优化

## 基线与结论

基线是刚完成标签/点刻修复、48个测试脚本全部通过的工作区版本，已经包含第一轮热点优化。不是Git HEAD，也不是修复前的旧108例基线。

本轮保留：精确模式有明确收益，原生QuickJS也有温和收益；**不能宣称所有引擎、所有场景都更快**。V8快速小场景两轮方向不一致，jitless快速场景退步，均保留原始数字；低于几个百分点的变化应视作接近噪声。

## 实现

- `src/svg-number.ts`：保留原始`Math.round(value*1000)`，在安全常用范围以整数和1000个私有小数后缀生成完全相同字符串；极值、非有限值保留原生格式化。
- `src/strokes.ts`：复用切向长度/偏移，减少临时对象；预览带状线用按最终顺序填充的字符串数组一次join，保留拟合分支及所有采样。
- `src/region-clipping.ts`、`src/dot-regions.ts`：仅缓存已复制私有边的差值/长度平方，椭圆逆变换改为标量并复用范数；不改运算结合顺序、除法、阈值或检查。
- `src/boundaries.ts`：顶点桶改用嵌套数值Map，保留原搜索顺序和距离判断；超过64条曲线时，以私有包围盒层次索引预选侧向间距候选，按原曲线编号排序，再执行原始当前epsilon筛选及全部距离检查。非有限值回退线性扫描，扫描中epsilon异常则恢复原线性后缀。交点求解与所有权判定未更换。

新增后缀表、每边数值字段和临时空间索引会占用内存；未声称峰值内存下降。没有跨可变场景缓存，没有降低几何精度/纹理密度，也没有削减64方向数值点刻检查。

## 测量协议

同一进程加载独立的新旧bundle；每版本1次初始渲染、3次预热，再进行6个交替顺序配对。表为两次独立运行的中位数；计时仅含render，每次完整字符串相等检查在计时之外。引擎顺序运行，不与测试/其他基准并发。全部六场景为800×700、scale=50、preview；导出只验证正确性，不推断其加速比例。

**耗时减少为正表示更快，为负表示更慢。**

### 原生QuickJS-ng

| 场景 | 轮次 | 原版→新版（ms） | 耗时减少 |
|---|---:|---:|---:|
| phenol-precise-hatch | 1 | 413.50 → 404.31 | 2.22% |
| c60-precise-hatch | 1 | 2239.01 → 2096.71 | 6.36% |
| c60-fast-hatch | 1 | 34.58 → 32.83 | 5.05% |
| c60-precise-elements | 1 | 864.54 → 825.64 | 4.50% |
| glucose-precise-hatch-labels | 1 | 744.80 → 695.59 | 6.61% |
| c60-precise-stipple | 1 | 2808.29 → 2753.55 | 1.95% |
| phenol-precise-hatch | 2 | 413.63 → 393.81 | 4.79% |
| c60-precise-hatch | 2 | 2207.16 → 2111.13 | 4.35% |
| c60-fast-hatch | 2 | 35.76 → 32.19 | 9.99% |
| c60-precise-elements | 2 | 879.16 → 825.79 | 6.07% |
| glucose-precise-hatch-labels | 2 | 770.82 → 719.28 | 6.69% |
| c60-precise-stipple | 2 | 2805.32 → 2784.16 | 0.75% |

### V8默认JIT

| 场景 | 轮次 | 原版→新版（ms） | 耗时减少 |
|---|---:|---:|---:|
| phenol-precise-hatch | 1 | 34.39 → 25.94 | 24.57% |
| c60-precise-hatch | 1 | 137.71 → 103.35 | 24.95% |
| c60-fast-hatch | 1 | 2.69 → 3.56 | -32.28% |
| c60-precise-elements | 1 | 40.44 → 29.13 | 27.97% |
| glucose-precise-hatch-labels | 1 | 51.04 → 39.30 | 22.99% |
| c60-precise-stipple | 1 | 148.89 → 142.86 | 4.05% |
| phenol-precise-hatch | 2 | 41.34 → 32.68 | 20.94% |
| c60-precise-hatch | 2 | 132.75 → 110.51 | 16.75% |
| c60-fast-hatch | 2 | 3.03 → 2.50 | 17.50% |
| c60-precise-elements | 2 | 40.84 → 29.96 | 26.64% |
| glucose-precise-hatch-labels | 2 | 54.49 → 41.99 | 22.93% |
| c60-precise-stipple | 2 | 159.48 → 141.18 | 11.48% |

### V8 jitless（补充一轮）

| 场景 | 轮次 | 原版→新版（ms） | 耗时减少 |
|---|---:|---:|---:|
| phenol-precise-hatch | 1 | 174.75 → 172.69 | 1.18% |
| c60-precise-hatch | 1 | 865.93 → 795.32 | 8.15% |
| c60-fast-hatch | 1 | 11.87 → 12.43 | -4.65% |
| c60-precise-elements | 1 | 304.00 → 265.57 | 12.64% |
| glucose-precise-hatch-labels | 1 | 302.79 → 273.83 | 9.56% |
| c60-precise-stipple | 1 | 1073.27 → 1046.08 | 2.53% |

## 验证

- 272组完整SVG与本轮修复后基线逐字节相同，覆盖17个模型、两种渲染模式/质量、三种阴影，以及旋转、标签、纹理、色洗和投影阴影。
- 2,106,018组数字格式对照分别在V8和原生QuickJS通过，包括负零、半整数舍入、进位、极值和非有限值。
- 永久`test-boundary-index.cjs`通过6,729项独立线性/索引对照，覆盖64/65阈值、顺序、异常epsilon后缀恢复及真实原始图结构/最终路径。
- 私有边/逆变换另有23,332项原版源码快照差分；永久区域测试增加输入变更隔离断言。
- 六个基准场景跨V8/QuickJS输出：5/6逐字节相同，仅葡萄糖不同；另行重跑优化前快照证实该差异原已存在，两引擎各自的新旧输出完全一致。未声称所有场景跨引擎字节相同。
- 最终完整测试结果：**npm test全部50个脚本通过，未使用--quick；严格类型检查通过。**

## 淘汰与修正

直接拆分整数/小数的最初格式化候选虽加快V8，却拖慢QuickJS，未采用。第一版左侧字符串逐项拼接在V8带标签葡萄糖场景出现退步；经分项对比改为最终顺序单次join，并加入有保守性证明的侧向间距索引。中间候选及分项数据保留于`build/perf-round2/candidate-b/`和`ablation*.json`，不混入最终两轮数据。

## 复现与限制

`build/perf-round2/baseline/`是优化前保存的五个经典bundle及独立ESM，SHA-256见配套JSON。该目录被Git忽略；请保留快照，不能用当前bundle或旧Git HEAD冒充。脚本在缺少快照时直接报错。

```powershell
node scripts/check-perf-round2-parity.cjs
node scripts/bench-perf-round2.cjs
& "C:\Users\jairy\Documents\trae_projects\mathjax4\quickjs-build-shared\qjs.exe" --std --script scripts/bench-perf-round2.cjs
node --jitless scripts/bench-perf-round2.cjs
npm test
npm run typecheck
```

每次基准写入同引擎JSON，重复时应另存轮次文件。原始样本、初始耗时、每轮中位数、bundle哈希均见`performance-round2.json`。不将第一轮和本轮百分比直接相加；未提交或推送。
