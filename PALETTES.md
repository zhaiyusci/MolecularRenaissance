# 元素色表来源

本项目不再使用自配的柔彩、矿物、大地、蓝晒、石墨等色表。以下均取自分子可视化软件的元素颜色数据，目前收录 H、C、N、O、P、S。

## 基础色表

| 元素 | Jmol / ChimeraX | RasMol (CPK) | PyMOL 元素命名色 |
| --- | --- | --- | --- |
| H | #FFFFFF | #FFFFFF | #E6E6E6 |
| C | #909090 | #C8C8C8 | #33FF33 |
| N | #3050F8 | #8F8FFF | #3333FF |
| O | #FF0D0D | #F00000 | #FF4D4D |
| P | #FF8000 | #FFA500 | #FF8000 |
| S | #FFFF30 | #FFC832 | #E6C640 |

来源：
- [Jmol 官方颜色说明](https://jmol.sourceforge.net/jscolors/)；具体六元素数值与 [3Dmol 的 `elementColors.Jmol` 和 `rasmol` 表](https://github.com/3dmol/3Dmol.js/blob/master/src/colors.ts)核对。
- [ChimeraX 官方文档](https://www.cgl.ucsf.edu/chimerax/docs/user/commands/colortables.html#element)明确说明其 `byelement` / `byhet` 使用 Jmol 默认元素颜色，因此合并为一项，不伪装成两套不同色表。
- [PyMOL `Color.cpp`](https://github.com/schrodinger/pymol-open-source/blob/master/layer1/Color.cpp) 的 `carbon`、`hydrogen`、`nitrogen`、`oxygen`、`phosphorus`、`sulfur` 命名色。

PyMOL 的源数据为浮点 RGB：H=(.9,.9,.9)、C=(.2,1,.2)、N=(.2,.2,1)、O=(1,.3,.3)、P=(1,.501960784,0)、S=(.9,.775,.25)。本项目统一用 `round(255 × 分量)` 转为 8 位颜色；这不保证与不同软件帧缓冲的取整方式逐字节一致。PyMOL 还可以按对象/链覆盖碳色，这里明确采用上述元素命名色，不声称涵盖所有默认显示情形。

## 3Dmol 碳色变体

同一份 [3Dmol 官方源码](https://github.com/3dmol/3Dmol.js/blob/master/src/colors.ts) 提供：
- `greenCarbon`：继承 RasMol，仅将 C 改为 #00FF00。
- `cyanCarbon`：继承 RasMol，仅将 C 改为 #00FFFF。
- `magentaCarbon`：继承 RasMol，仅将 C 改为 #FF00FF。

这三项是软件真实内置的变体，不是三套全新的元素编码。未选取白碳、橙碳和黄碳变体，避免与本项目的 H、P、S 过于接近。

## 显示与例外

- 默认 Jmol，浓度和饱和度均为 100%，此时原子底色就是上表值。用户降低浓度会混入白色，降低饱和度会减少颜色差异。
- 颜色只用于元素底色；规则网点、点刻和排线统一使用黑色表达明暗，不再提供彩色纹理模式。关闭元素底色即为白底黑纹理。
- 氢同样使用黑色纹理，底色保留源色表的白色或近白色，不需要灰墨例外。
- 键的底色仍为白色。未知元素的底色使用该表的碳色；这只是显示回退，不是源软件中该元素的颜色数据。
- API 已移除 `colorMode`、`elementInkColor` 和 `elementInkPalette`；`buildDots` 的第七个参数现在直接传可见区域 `regions`，不再接受颜色回调。
- 传统元素色并不保证色觉缺陷友好，也不能保证所有浓度/饱和度下都可凭颜色辨认；需要无歧义识别时可以启用元素标签。
