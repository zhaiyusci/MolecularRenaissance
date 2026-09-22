# 第一轮渲染热路径优化

> 本文及配套JSON保留纯热点优化阶段的历史测量。随后发现并修复的相切标签、数值点刻角落及测试契约问题见 `../REGRESSION-FIXES.md`；修复阶段完整 `npm test` 为48个脚本全部通过。后续第二轮性能优化见 `PERFORMANCE-ROUND2.md`，当前为50个脚本全部通过。四个性能基准场景的SVG仍逐字节不变，但修复后五个预设不再走旧回退路径，因此不能把当时108例的旧版逐字节比较当作当前全部输出不变的承诺。

## 结论

保留本轮改动：在两轮原版/新版交替测试中，原生 **QuickJS-ng 0.16.2** 四个场景的生成耗时均减少，约 **12%–22%**；V8默认模式约 **9%–34%**。这是有收益的常数项优化，不是数量级提升，也没有消除QuickJS与V8的差距。

**V8 jitless 并非稳定全面受益**：第一轮各场景耗时变化从增加8.2%到减少9.1%；第二轮为增加1.1%到减少6.0%。不能把本轮改动宣称为所有解释器/所有场景都更快。

应用已重新构建；没有改变半径、比例、纹理、遮挡规则、采样密度或几何容差。未commit/push。

## 实现

- `src/math.ts`：密集三维向量的加、减、乘、点积改为显式分量计算，减少map/reduce回调；其他维度保留通用路径。点积保留原始初值+0及运算顺序。
- `src/hatch-curves.ts`：投影圆的三角函数从逐分量回调中移出，二维坐标/切向量直接计算，并提供共享sin/cos的路径。
- `src/renderer.ts`、`src/strokes.ts`：球面采样与二维投影共用三角函数，采样点可携带已算好的xy；排线族的轴与光向量点积移到内层循环之外。没有用`project(p)`替代原投影表达式，也没有缓存会被后续修改的完整采样对象。
- `src/boundaries.ts`：私有二维/三维向量热路径标量化；圆的world/at/tangent计算融合，减少嵌套临时向量；包围盒范围和同一段的解析端点复用。吸附后的共享节点与解析端点严格区分。
- 保留原浮点运算分组；例如边界中的`C + (U*cos + V*sin)`没有改成`(C + U*cos) + V*sin`。这不是改变舍入行为的FMA优化。

先运行了V8采样CPU profile，观察到投影point/tangent、边界向量mul/add、曲线生成、节点定位、数字格式化及GC等工作；该profile不是QuickJS的逐函数归因，也没有证明每项改动各自贡献多少。性能结果衡量的是本轮组合。

## 两轮配对结果

每轮、每引擎、每场景：原版和新版各1次初始渲染、3次预热，再交替顺序运行6对。报告每版本6次的中位数（中间两项均值）。只计时render，不包含版本选择、加载、写文件和字符串比对。三种引擎顺序运行，测量期间没有同时跑项目回归测试。

基线是提交`b351c7b`的五个原始经典脚本。Node通过独立目录require；QuickJS加载两份独立闭包，并在计时外切换对应的全局依赖，避免原版误用新版辅助模块。

### 两轮耗时减少范围

| 场景 | V8默认 | 原生QuickJS-ng |
|---|---:|---:|
| 苯酚，精确＋排线 | 25.4%–33.6% | 15.2%–17.8% |
| C60，精确＋排线 | 15.3%–28.3% | 12.7%–14.0% |
| C60，快速＋排线 | 16.8%–28.5% | 18.0%–21.5% |
| C60，精确＋元素纹理，无光影 | 8.7%–19.9% | 11.7%–12.4% |

### 第二轮原生QuickJS耗时

| 场景 | 原版ms | 新版ms |
|---|---:|---:|
| 苯酚，精确＋排线 | 535.42 | 439.97 |
| C60，精确＋排线 | 2678.91 | 2339.92 |
| C60，快速＋排线 | 41.31 | 32.41 |
| C60，精确＋元素纹理，无光影 | 1012.48 | 893.52 |

本机不同批次的绝对耗时变化明显，所以不把这里的新版耗时与早先独立运行的`NATIVE-QUICKJS.md`数值相除当作加速比。表格使用同轮交替测量的对照；也不是硬件隔离、跨机器或长期统计结论。第一轮后仅补充了非常规投影维度的通用切向量回退，标准二维测试路径的算术不变。

环境：Node v26.8.2 / V8 14.6.202.34-node.28；原生QuickJS-ng 0.16.2 Release（本机MSVC /O2构建）。四组参数沿用上轮：800×700、scale50、preview、方向光、无投影、无配色和标签；元素纹理场景关闭光影。详细参数与每次样本见`hotpath-optimization.json`。

## 正确性与回归

- **108个完整渲染场景**与保存的原版SVG逐字节一致：17个预设×2种渲染模式×3种光影，共102例，均开启元素纹理/标签/配色并改变视角；另加6例点光源/平行光、投影、非默认明暗参数的export测试。
- 三引擎、四个性能场景，每次配对渲染都检查与原版字符串一致；最终文件统一用Node计算SHA-256，跨引擎也逐字节相同。
- 新增`test-hotpath-math.cjs`：检查三维标量路径及其他维度回退，覆盖正负零、NaN、无穷和极端数值；1000组投影圆/共享三角函数计算逐分量精确相等。
- 选择的29个回归脚本中 **20个通过**，包括1325个乙醇边界视角、466个C60视角、1325个共享点区域视角，以及深度、光照、阴影、元素纹理、半径、旋转及UI测试。
- **9个脚本仍失败，但在独立解包并构建的`b351c7b`基线上也出现相同失败诊断**：`test-hatch-intervals.cjs`、`test-hatch-renderer.cjs`、`test-hatch-optimization.cjs`、`test-shared-regions.cjs`、`test-label-depth.cjs`、`test-typescript.cjs`、`test-analytic-boundaries.cjs`、`test-c60.cjs`、`test-dot-regions.cjs`。
- 核对时同步了忽略于git的历史`build/baselines/`文件，避免基线版本因缺少可选文件而跳过断言；基线也实际执行build以支持读取编译后源码的测试。旧API、历史画布中心基线、预期解析路径与现有回退行为等问题没有在本轮顺手修复。
- 这**不是全套测试全绿**。最初的不限时全套尝试在旧`test-dots.cjs`长时间运行时中止，随后改为逐项有超时的29项测试；原先已知失败的`test.cjs`和`test-color-ink.cjs`未纳入本轮29项。

## 复现

在仓库根，先准备原版（仅写build目录）：

```powershell
New-Item -ItemType Directory -Force build/engine-baseline,build/engine-bench,build/optimization-baseline-repo | Out-Null
git archive --format=tar --output=build/optimization-baseline-repo.tar b351c7b
tar -xf build/optimization-baseline-repo.tar -C build/optimization-baseline-repo
Copy-Item build/optimization-baseline-repo/renderer.js,build/optimization-baseline-repo/boundaries.js,build/optimization-baseline-repo/dot-regions.js,build/optimization-baseline-repo/wash.js,build/optimization-baseline-repo/dots.js build/engine-baseline/
```

在`build/optimization-baseline-repo`运行一次`npm run build`，然后回到根目录：

```powershell
npm run build
node scripts/check-optimization-parity.cjs
node scripts/check-hotpath-regressions.cjs
node scripts/bench-hotpath-optimization.cjs
node --jitless scripts/bench-hotpath-optimization.cjs
& 'C:\Users\jairy\Documents\trae_projects\mathjax4\quickjs-build-shared\qjs.exe' --std --script scripts/bench-hotpath-optimization.cjs
node scripts/summarize-hotpath-optimization.cjs
```

第二轮前可将`build/engine-bench/optimization-<engine>.json`复制为`optimization-<engine>-round1.json`，再重复三引擎测试和汇总。其他机器需替换qjs路径并核对版本。原始SVG、profile及回归日志保留在忽略的build目录，汇总JSON保存完整样本和结果。
