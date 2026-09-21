# Element textures / 元素纹理

已接入应用的固定、自定义元素映射。**不是行业标准。** 在 `index.html` 勾选「元素纹理 / Element textures」即可使用；关闭光影和配色可查看纯黑白纹样。重置仍默认关闭元素纹理。

## 正式映射

| 元素 | Pattern | 纹样 |
|---|---|---|
| H | blank | 留白，无元素纹理墨迹 |
| C | crosshatch | 斜交叉网，1倍时节距9 px、旋转45°、线宽0.55 px |
| O | diagonal-hatch | 斜线 |
| N | horizontal-lines | 横线 |
| S | dots | 实心点 |
| P | vertical-lines | 竖线 |
| F | horizontal-waves | 横波线 |
| Cl | vertical-waves | 竖波线 |
| Br | diagonal-waves | 斜波线 |
| I | double-horizontal-lines | 横双线 |
| B | horizontal-rectangle-grid | 横长方网 |
| Si | square-grid | 正方网 |
| Se | rhombus-grid | 扁菱形网 |
| Li | vertical-rectangle-grid | 竖长方网 |
| Na | double-vertical-lines | 竖双线 |
| K | triangle-grid | 等边三角网（不再使用回纹） |
| Mg | double-diagonal-lines | 斜双线 |
| Ca | vertical-brickwork | 竖砖纹 |
| Al | horizontal-brickwork | 横砖纹 |

The table above is the application's fixed custom mapping. H has no categorical ink; with `elementTextures` enabled, C again uses `crosshatch`: pitch 9 px, rotation 45°, and stroke 0.55 px at scale 1, matching other pattern strokes. Carbon is not solid black. This changes only the categorical texture, not palette/base colors; disabling `elementTextures` preserves the original palette and shading. Like other elements, carbon receives its categorical texture before shading and labels, with no special carbon paint-after-lighting layer. Lighting and label settings are unchanged. All grid faces, including carbon's, have an area of 81 px² at scale 1. Pattern strokes are 0.55 screen px at scale 1, including legacy fallback strokes; other spacing, grid geometry, dots, outlines, and shading parameters are unchanged. The nineteen common-element recipes contain no dashed strokes or miniature hollow glyphs. Other supported H–Cm elements retain the previous deterministic fallback combinations; this is not a claim of perceptual uniqueness for the whole periodic table.

## 大小、深浅与独立性

- `elementTextureScale: 1` 时，所有网纹（包括C交叉网及砖纹）每个小格的几何面积为 **81 SVG px²**。这里指网眼/小三角/砖块，而非平铺矩形面积。
- C 与 Si 网格节距均为9 px；C 的 `crosshatch` 配方旋转45°，线宽0.55屏幕px，与其他纹理笔画一致。1倍时所有评审纹样及旧回退纹样线宽均为0.55屏幕px；其余间距、81 px²小格几何、圆点、轮廓和光影参数不变。
- C 的交叉网只在开启 `elementTextures` 时作为元素纹理生效，不使用实心黑，不改色表或底色；关闭后保留原有配色与光影。C 与其他元素一样，分类纹理在光影和标签之前正常绘制，不再有C专用的光影后覆盖层；光影与标签设置不变。
- 长方/扁菱形保持3∶1长短比例；三角网保持三组线共点。黑色覆盖率没有强制相等，屏幕观感仍受方向、裁切、抗锯齿影响。
- 纹理滑块范围0.5–3倍，同时缩放图案节距和笔画；不改变真实原子半径、坐标、Å比例或画布中心。
- 图例、预览、快速模式及SVG导出使用相同配方。图例固定1倍，便于辨别图案；原子上的纹理按滑块缩放。
- H的“留白”只表示**不加元素纹理**；启用光影或配色时仍保留那些独立效果。真正纯白需关闭光影与配色。
- 白色键不叠加元素纹理。可见区域遮挡逻辑不变。
- 同一元素不随分子、光源或视角换纹样。很小或被遮挡的原子仍应配合元素标签。

其余已支持的元素保留原有确定性组合纹理。未知ASCII字母标签需明确提供半径，使用有限回退集合，可能重复。只有上表19种采用本轮评审方案。

## 实际应用样例

`design/element-textures/app-approved-19.svg` 由应用的真实 `renderer.js` 导出，并非设计稿绘制器。`app-approved-19.xyz` 可直接导入应用：19个分开摆放的独立原子，仅用于纹理对照，不表示一个真实化合物。开启元素纹理、关闭光影和配色查看；保留真实共价半径和固定Å比例，因此H等小原子不会被偷偷放大。

重新生成：`node scripts/generate-approved-texture-sample.cjs`。

## Implementation and tests

- `src/element-texture-recipes.ts`: immutable reviewed recipes and continuous lattices.
- `src/element-textures.ts`: shared definitions, validation, legacy fallback, visibility handling.
- `scripts/generate-grid-study.cjs`: independent design geometry used for lattice parity tests; no application mapping changes when generating the old study.
- `test-approved-textures.cjs`: approved mapping, grid geometry and rendering integration.
- `test-element-textures.cjs`, `test-element-textures-ui.cjs`: helper/module parity, lighting independence, visibility masks and UI lifecycle.

`design/element-textures/` 中v1–v3样张保留作历史设计参考，早期元素分配及回纹不代表当前应用；当前映射以上表和生产代码为准。
