# 原生 QuickJS 与 V8 实测

## 结论

当前渲染器能直接在本机 **QuickJS-ng 0.16.2** 运行，不需要修改渲染代码或补兼容层。四个测试场景输出与 V8 **逐字节一致（SHA-256一致）**。这是原生 Windows 引擎，不是 QuickJS-WASM，也不是用 V8 `--jitless` 代替 QuickJS。

本次运行 QuickJS-ng 比默认 V8 慢约 **6.5–12.5倍**；精确模式不适合要求低延迟的连续交互，但可用于秒级静态导出。快速模式生成C60 SVG的中位数约47 ms，可用性明显更好；这不是完整GUI帧率。

## 同一批次的结果

单位ms；每场景1次初始渲染、3次额外预热、5次计时取中位数。三种引擎顺序执行，未同时争抢CPU。

| 场景 | V8默认 | V8 jitless | QuickJS-ng | QuickJS / V8 |
|---|---:|---:|---:|---:|
| 苯酚，精确模式＋排线 | 86.89 | 367.53 | 1083.18 | 12.47× |
| C60，精确模式＋排线 | 321.98 | 1833.53 | 2937.59 | 9.12× |
| C60，快速模式＋排线 | 7.25 | 24.33 | 47.29 | 6.52× |
| C60，精确模式＋元素纹理，无光影 | 103.28 | 655.78 | 1127.31 | 10.91× |

QuickJS C60精确排线波动较大：5次计时范围 **2855–5941 ms**，初次5685 ms。其余场景较稳定。没有分析GC/系统调度事件，不能将波动归因于某个确定原因。这是一批次、小样本的本机结果，不是通用性能保证。

精确场景下QuickJS比V8 jitless仍慢约1.6–2.9倍，说明差别不仅是JIT有无，也包含解释器、对象/数组、内建函数及内存管理实现等因素；本次未对这些因素逐项归因。

## 条件与验证

- 应用提交：`b351c7b`；本次没有改动应用逻辑。
- Node v26.8.2，V8 14.6.202.34-node.28。
- QuickJS-ng 0.16.2，`qjs --help`确认。对应构建树为Release，MSVC C编译选项 `/MD /O2 /Ob2 /DNDEBUG`。它是QuickJS-ng分支，不能把结果等同于所有Bellard QuickJS版本。
- 三种运行方式均使用仓库经典脚本构建；Node通过CommonJS加载，QuickJS通过`std.loadScript`加载同一组依赖和`renderer.js`。
- 输出800×700，scale50，preview质量，方向光、无投影、无配色、无标签；排线模式使用当前默认参数。元素纹理场景明确设置`shadingSize:0`。
- 只计时 `render()` 返回SVG字符串；不包含脚本加载、文件写出、哈希、SVG解析及浏览器绘制。
- 每个场景最后一次输出保存在`build/engine-bench/`，由Node统一读取UTF-8并计算SHA-256。四组场景在三种引擎间均逐字节相同，不只是长度或肉眼相似。
- 校验范围仅限这四组场景，不等于全部功能已跨引擎回归。
- 完整五次样本、初次耗时、范围、选项及哈希见 `native-quickjs.json`。

## 复现

在仓库根运行，使用本机已存在的原生QuickJS（未安装新依赖、未重编译引擎）：

```powershell
New-Item -ItemType Directory -Force build/engine-bench | Out-Null
node scripts/bench-js-engines.cjs
node --jitless scripts/bench-js-engines.cjs
& 'C:\Users\jairy\Documents\trae_projects\mathjax4\quickjs-build-shared\qjs.exe' --std --script scripts/bench-js-engines.cjs
node scripts/compare-engine-bench.cjs
```

其他机器需替换qjs路径，并核对版本。脚本中的QuickJS版本记录对应本次宿主实测，换版本应同步更新元信息。基准及汇总写入本项目，不写外部QuickJS项目。
