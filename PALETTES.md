# 元素色表来源

本项目不再使用自配的柔彩、矿物、大地、蓝晒、石墨等色表。以下均取自分子可视化软件的元素颜色数据。原有基础色表收录 H、C、N、O、P、S；新增 ORTEP 随附配置采用完整的 108 条原始记录，另明确加入 Db→Ha 旧符号兼容映射。

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

## ORTEP · 随附配置

GUI 新增独立选项，API 为 `colorScheme: 'ortep'`；默认仍为 Jmol。

| 元素 | ORTEP 实际配置 |
| --- | --- |
| H | #FFFFFF |
| C | #007FFF |
| N | #DB70DB |
| O | #FF0000 |
| P | #FF8000 |
| S | #FFFF00 |
| F | #99CC32 |
| Cl / I | #70DB93 |
| Br | #A52A2A |
| Fe | #FF8000 |

来源是[官方 ORTEP 发行包](https://www.chem.gla.ac.uk/~louis/software/downloads/ortep_2026.1.zip)随附 `atomcols.def` 的实际数据行（文件头标注 April 2008），结合[原始 RGB 字典存档](https://web.archive.org/web/19980712194749id_/http://www.chem.gla.ac.uk:80/~louis/software/ortep3/ortep32.zip)、同包 RGB 增补和手册 Table 6.4 核对。完整源数据、行号和校验值见 `references/ortep-colors/`，调查说明见 [PALETTE-RESEARCH-XP-ORTEP.md](PALETTE-RESEARCH-XP-ORTEP.md)。

注意：原文件注释称内置 CPK 的 C 为 LightGrey、N 为 LightBlue，但实际配置覆盖成 SlateBlue、Orchid；本项复现的是随附配置，不是假定的内置 CPK，更不是 RasMol 的别名。

保留原表 108 条（包括旧符号 Ha 及 D/Ct/Q），并明确将现代 Db 作为 Ha 的颜色别名；这不改变原始参考文件。表外元素、空元素名的底色采用源文件注释声明的 Pink（#BC8F8F），是本应用明确采用的回退策略，不声称验证过原软件缺失配置时的二进制行为。颜色支持不改变原子半径支持范围或任何几何参数。

SHELXTL/XP 尚无核实的数字 RGB，未猜用 CSS 同名色，因此本轮不新增 XP 选项。验证：`node test-ortep-palette.cjs`、`node test-ortep-ui.cjs`。

## 3Dmol 碳色变体

同一份 [3Dmol 官方源码](https://github.com/3dmol/3Dmol.js/blob/master/src/colors.ts) 提供：
- `greenCarbon`：继承 RasMol，仅将 C 改为 #00FF00。
- `cyanCarbon`：继承 RasMol，仅将 C 改为 #00FFFF。
- `magentaCarbon`：继承 RasMol，仅将 C 改为 #FF00FF。

这三项是软件真实内置的变体，不是三套全新的元素编码。未选取白碳、橙碳和黄碳变体，避免与本项目的 H、P、S 过于接近。

## 显示与例外

- 默认 Jmol，浓度和饱和度均为 100%，此时原子底色就是上表值。用户降低浓度会混入白色，降低饱和度会减少颜色差异。
- 颜色只用于元素底色；规则网点、点刻和排线统一使用黑色表达明暗，不再提供彩色纹理模式。关闭元素底色即为白底黑纹理。
- 氢的光影纹理同样使用黑墨，底色保留源色表的白色或近白色；独立的「元素纹理」则让H留白、不加类别墨迹。两层互不替代。
- 键的底色仍为白色。原有六项配色的未知元素仍回退到各自碳色；ORTEP 项按上述说明回退 Pink。这些回退规则不等于源软件中每个未知元素的专门颜色。
- API 已移除 `colorMode`、`elementInkColor` 和 `elementInkPalette`；`buildDots` 的第七个参数现在直接传可见区域 `regions`，不再接受颜色回调。
- 传统元素色并不保证色觉缺陷友好，也不能保证所有浓度/饱和度下都可凭颜色辨认；需要无歧义识别时可以启用元素标签。
