# 使用 Molplotter 渲染器

## 边界

```text
Molecule + RenderOptions → render() → SVG 字符串
```

渲染器不读 DOM，不创建 Canvas，不依赖浏览器窗口、网络或第三方运行时库，也不修改输入模型和参数。调用是同步的；换用 TypeScript 不会自动将计算移出 GUI 主线程。`app.js` 只负责交互、显示和下载，不属于渲染库。

## TypeScript / ES Module

在本仓库运行 `npm ci && npm run build` 后，其他项目可用本地依赖安装：

```sh
npm install ../molplotter
```

这是本地包示例，项目尚未发布到 npm。

```ts
import { render, examples, type Molecule, type RenderOptions } from 'molplotter';

const model: Molecule = {
  name: '双球',
  atoms: [
    { element: 'C', position: [-0.85, 0, 0] },
    { element: 'O', position: [ 0.85, 0, 0] }
  ],
  bonds: [[0, 1]]
};
const options: RenderOptions = {
  width: 900,
  height: 700,
  scale: 60, // 整体投影比例，SVG 单位/Å
  atomRadiusScale: 0.5, // 用户决定球半径倍率，不改变原子间距或键柱粗细
  quality: 'export',
  shadingMode: 'hatch',
  colorWash: true,
  yaw: Math.PI / 4,
  pitch: 0
};
const svg: string = render(model, options);
const fullereneSvg = render(examples.c60, options);
```

模型坐标为以 **Å** 为单位的三元组，键为两个原子的零基索引。原子默认采用有文献来源的共价半径，详见 [RADII.md](RADII.md)；可通过 `atom.radius` 明确指定 Å 半径，未收录的元素必须指定。`scale` 默认固定 60 SVG 单位/Å，不随模型、旋转或画布改变；超出画幅不会自动缩小。相机和光源角度用**弧度**。`quality: 'preview'` 跳过路径拟合，`quality: 'export'` 默认生成紧凑可编辑路径。完整选项和允许值见 `src/types.ts`；旧的密度/线宽参数仍兼容，新的共享明暗控制优先。

包入口根据调用方式选择 CommonJS 或 ES Module，并附带 `.d.ts` 类型声明。也可以不安装包，直接导入独立产物：

```js
import { render, examples } from './molplotter/dist/molplotter.mjs';
const svg = render(examples.c60, { colorWash: true });
```

**`dist/molplotter.mjs` 是独立单文件**，内部已包含几何、排线、填色和网点实现，不需再加载其他模块。浏览器以模块方式加载时，应遵守浏览器的模块 URL/CORS 限制；直接双击的现有 GUI 仍使用下面的经典脚本方案。

## CommonJS

```js
const { render, examples } = require('molplotter');
const svg = render(examples.c60, { shadingMode: 'stipple', colorWash: true });
```

原先的相对路径调用也保持兼容：

```js
const { render } = require('./molplotter/renderer.js');
```

此时要一起保留 `renderer.js`、`boundaries.js`、`dot-regions.js`、`wash.js` 和 `dots.js`，因为 CommonJS 入口会加载这些模块；不需要 `app.js`、`index.html` 或 TypeScript 编译器。

## 经典浏览器脚本 / file:// GUI

```html
<script src="dot-regions.js"></script>
<script src="boundaries.js"></script>
<script src="wash.js"></script>
<script src="dots.js"></script>
<script src="renderer.js"></script>
<script>
  const svg = MolEngraver.render(MolEngraver.examples.c60, { colorWash: true });
  // 显示、保存和交互由宿主项目负责。
</script>
```

既有 `MolEngraver`、`MolBoundaries`、`MolWash`、`MolDots`、`MolDotRegions` 全局入口保留。主 API 的 `examples`、`depthAt`、`engravingWidth`、配色函数和色板也保持兼容。

## 维护与验证（源码仓库）

源码默认采用静态 ES Module 依赖，模块依赖图无循环。`runtime-legacy.ts` 仅在构建经典脚本 / CommonJS 兼容产物时替换加载方式，不改变数值实现。

- **源码唯一编辑入口：`src/*.ts`。** 根目录渲染 JS、`dist/molplotter.mjs` 和 `dist/types/` 均由构建生成。
- `npm ci`：按锁文件安装开发工具。
- `npm run typecheck`：严格类型检查，只有 ES2022 标准库，没有 DOM 类型库。
- `npm run build`：生成兼容模块、独立 ESM 和声明文件。
- `npm test`：先构建，再运行全部测试，不覆盖已有样张；单独运行 `node test.cjs` 仍可重新生成默认样张。
- `npm test -- --quick`：跳过三组较长的旋转压力扫描，其余类型、可见性和输出测试仍运行。

`test-typescript.cjs` 用 49 组迁移前 SVG 的哈希基线，以显式历史半径和固定比例夹具在 CommonJS、ES Module、无 DOM 的经典脚本环境分别对照（不再假定旧默认值）；`test-radii-scale.cjs` 另行验证科学半径和固定比例；另有实际包入口的 TypeScript 消费者编译测试（包括错误参数必须被拒绝）。原有遮挡、共享边界、排线、点刻、C60 和 GUI 交互测试保留，不用放宽几何容差来迁就迁移。
