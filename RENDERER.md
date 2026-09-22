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

## 16级明暗与兼容选项

`renderMode` 默认 `'precise'`；共享选项 `quantizeShading?: boolean` 在精确模式默认 `true`（省略或 `undefined`），用于排线与规则网点。开启时，排线在固定曲线骨架上按 **16 个互不重叠的明暗带** 裁切，网点使用16级共享 pattern。设为 `false` 时，排线使用旧版连续变宽、端部收尖算法；规则网点则在45°规则网格上逐点输出连续半径，边缘仍收缩圆点以容纳完整标记。这不是分档 pattern 的逐像素等价替代，逐点输出也可能更大。点刻忽略此选项，不量化为16级。

GUI 控件现名 **16级明暗**（英文 **16-level shading**，旧名16级排线）；默认与重置均开启。关闭光影、使用快速模式或点刻时禁用但保留两种勾选偏好，精确规则网点时可用。界面仅为精确排线／规则网点发送该布尔值；快速／点刻省略，不再发送 `hatchMode`。

旧 `hatchMode: 'layered' | 'continuous'` 仍是仅作用于排线样式的兼容别名，分别对应 `true`／`false`，不改变网点算法；排线中同时显式提供两项且不一致时，报错 `Conflicting quantizeShading and hatchMode`。非布尔 `quantizeShading` 报错 `Invalid quantizeShading`。快速模式显式提供任一布尔值均报错 `16-level shading switch requires precise rendering`；请省略或使用 `undefined`，例如 `{ renderMode: 'fast', castShadows: false }`。旧的显式 fast＋layered 错误 `Layered hatching requires precise rendering` 仍保留，快速模式默认排线仍为 continuous。

历史 continuous／layered 性能与默认效果批准记录见 [LAYERED-HATCHING.md](LAYERED-HATCHING.md)，不代表本次共享开关及连续网点的新测量或完整验证结果。

## 平行光与已移除选项

仅支持平行光；`lightAzimuth`、`lightElevation` 控制方向（弧度），精确模式支持 `castShadows` 和 `shadowStrength`。快速模式要求 `castShadows: false`，否则报错 `Fast rendering requires castShadows=false`。GUI 在退出快速模式时仅恢复先前的投影开关。

`lightType`、`lightDistance`、`lightAttenuation` 已从公共 API 删除。显式提供其中任一键都会报错 `Removed lighting option: ${key}; only directional lighting is supported`，包括 `lightType: 'directional'`；迁移时删除这些键，不要传入替代值。

## 四元数姿态与欧拉角

`RenderOptions.orientation?: Quaternion` 为 `[x,y,z,w]`，接受非零、有限的四个分量，归一化副本后使用，优先于 `yaw/pitch`；不传时保留旧旋转算法。只旋转居中的分子坐标，不改 Å 比例、半径或相机空间光照。

包入口同时导出 `normalizeOrientation(q)`、`rotateOrientation(q, axis, radians)`、`orientationFromEulerXYZ([x,y,z])`、`orientationToEulerXYZ(q)`。固定右手轴：X 向右、Y 向上、Z 朝向观察者；增量为 `q_delta * q`，欧拉角约定 `Rz(z) * Ry(y) * Rx(x)`，均用弧度。结果 Y 在 ±π/2 内，X/Z 在 ±π 内；万向锁处选择 Z=0 的等价表示。应始终保存四元数，欧拉角只用于输出，不回写作为下一步旋转状态。

GUI 使用独立 SVG 旋转 Gizmo：红/绿/蓝圆环绕局部 X/Y/Z 轴旋转（`q * q_delta`），灰色外圈绕相机 Z 轴旋转（`q_delta * q`），不支持分子画布拖动。圆环可用左右方向键旋转 5°（Shift：15°）；欧拉角为只读计算结果。`node test-orientation.cjs` 和 `node test-orientation-ui.cjs` 覆盖数学及交互回归。

## 元素纹理

`elementTextures?: boolean` 默认 `false`；`elementTextureScale?: number` 默认 `1`、范围 `0.5–3`。图案按元素确定，独立于光源、阴影、明暗亮度/对比度与 `textureScale`，`shadingSize: 0` 不关闭元素纹理。仅原子表面填充图案，不改变半径、中心、键底色。精确模式使用表面归属路径，必要时采用有预算上限的采样矢量遮罩；快速模式仍按画家排序近似。

导出 `elementTexturePattern(element)` 配方标识、`elementTextureDefinition(element, id, scale?)` SVG 图案定义、`elementTextureSwatch(element)` 24×24 矢量图例。19种常用元素的评审配方集中在 `src/element-texture-recipes.ts`，预览、图例与导出共用：H无元素纹理墨迹，C为 `crosshatch`（斜交叉网，1倍时节距9 px、旋转45°、线宽0.55 px，与其他纹理笔画一致），F/Cl/Br三方向波线；所有网纹（含C）保持每小格面积81 px²（1倍），不再硬凑覆盖率。C 的交叉网只在 `elementTextures: true` 时作为分类纹理生效，不使用实心黑，不改色表或底色；关闭元素纹理保留原有配色与光影。C 与其他元素一样，分类纹理在光影和标签之前正常绘制，不再有C专用的光影后覆盖层；光影与标签设置不变。1倍时元素纹理线宽为0.55屏幕px（含旧回退纹样），其余间距、网格几何、圆点、轮廓及光影参数均不变。正式分配见 [ELEMENT-TEXTURES.md](ELEMENT-TEXTURES.md)。H–Cm 的配方定义不同，但不保证任意小尺寸下肉眼可辨；未知英文字母标签使用有限回退集合，可能重复，仍须提供合法半径。图案ID与符号会验证，不能输入任意HTML。回归为 `test-approved-textures.cjs`、`test-element-textures.cjs` 与 `test-element-textures-ui.cjs`。

## XYZ 文本解析

`parseXYZ` 与渲染器一起导出，无 DOM、文件系统或网络依赖；调用方负责取得文本。返回的坐标原样保留（约定 Å），不修改渲染比例。

```ts
import { parseXYZ, render, type XYZOptions } from 'molplotter';
const options: XYZOptions = { name: 'water.xyz', inferBonds: true, maxAtoms: 500 };
const molecule = parseXYZ(`3
water
O 0 0 0
H .9572 0 0
H -.239 .927 0`, options);
const svg = render(molecule, { renderMode: 'fast', castShadows: false });
```

- `name` 覆盖第二行注释生成的标题；未指定且注释为空时使用 `XYZ molecule`。
- `inferBonds` 默认 **false**，开启后按 `0.4 ≤ d ≤ 1.2 × (ri+rj)`（Å）产生排序后的无向索引对；只做几何推断，无键级、价态或周期边界处理。半径来自物理数据表，而非显示倍率。
- `maxAtoms` 默认 2000，可设 1–2000；另外限制文本最多 2097152 个 UTF-16 代码单元、坐标绝对值不超过 10⁶ Å、推断不超过 10000 根键。GUI 更严格：2 MiB 文件、500 原子。
- 严格单帧、四列标准 XYZ；第二行必须存在，可为空。支持 BOM、LF/CRLF/CR、元素大小写规范化、原子序数和 E/D 科学计数法。拒绝多帧、额外列、`Properties=`、非有限值和缺少半径的元素，并报告行号。
- CommonJS 为 `require('molplotter').parseXYZ`；经典脚本为 `MolEngraver.parseXYZ`。输入注释/文件名始终作为文本数据，渲染时 XML 转义。

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

## 相切场景与标签

精确模式对外切/近外切原子球保留保守保护，但允许一个有条件的例外：只有连接两个球心的有效有限圆柱，严格包住接触点附近的完整不确定区域时，才省略这条不可见的球–球接缝。该区域半径界来自 `|seam-contact|² ≤ 2*ra*epsilon`，并额外加入数值裕量；不是放宽原有相切容差。

这使过氧化氢、异丙醇、甘氨酸、葡萄糖和磷脂等预设保留认证表面及正确分层的标签，不改原子半径、坐标或Å比例。无连接键、键太细/太短、内切或嵌套、无效轴等情况仍保守回退；无法认证的表面仍不冒险绘制浮在前景上的标签。`test-tangent-labels.cjs` 覆盖相切两侧扰动、多视角、标签开关、元素纹理及独立深度所有权。

## 维护与验证（源码仓库）

源码默认采用静态 ES Module 依赖，模块依赖图无循环。`runtime-legacy.ts` 仅在构建经典脚本 / CommonJS 兼容产物时替换加载方式，不改变数值实现。

- **源码唯一编辑入口：`src/*.ts`。** 根目录渲染 JS、`dist/molplotter.mjs` 和 `dist/types/` 均由构建生成。
- `npm ci`：按锁文件安装开发工具。
- `npm run typecheck`：严格类型检查，只有 ES2022 标准库，没有 DOM 类型库。
- `npm run build`：生成兼容模块、独立 ESM 和声明文件。
- `npm test`：先构建，再运行全部测试，不覆盖已有样张；单独运行 `node test.cjs` 仍可重新生成默认样张。
- `npm test -- --quick`：跳过三组较长的旋转压力扫描，其余类型、可见性和输出测试仍运行。

`test-typescript.cjs` 在49组显式历史半径/固定比例场景中，对照 CommonJS、ES Module、无 DOM 经典脚本的完整输出，并独立验证球半径与居中投影；另有9组固定历史实现的完整SVG比较，以及实际包入口的严格 TypeScript 消费者测试（包括错误参数、已删除API必须被拒绝）。`test-radii-scale.cjs` 另行验证科学半径和固定比例。历史对照使用 `test-fixtures/historical-renderer.cjs` 固定的Git提交与blob哈希，仅对齐已批准的投影变更；首次测试自动从本地Git历史提取到忽略的缓存，不再按临时fixture是否存在来跳过断言。浅克隆缺少提交时会明确失败并提示所需的fetch命令，不联网隐式取数。遮挡、共享边界、排线、点刻、C60和GUI检查保留，不用放宽几何容差来迁就实现。
