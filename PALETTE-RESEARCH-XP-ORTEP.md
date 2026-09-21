# SHELXTL/XP 与 ORTEP-3 配色核对

本文记录原始色表取证；后续已按用户要求将“ORTEP · 随附配置”接入应用（`colorScheme: 'ortep'`）。软件特定的默认约定不等于通用元素颜色标准。

## 当前项目

取证前六项为 Jmol/ChimeraX、RasMol (CPK)、PyMOL，以及继承 RasMol 的绿碳、青碳、品红碳变体；这些原有表仍仅覆盖 H、C、N、O、P、S，其他元素回退各自碳色。现已加入第七项 ORTEP 随附配置：采用完整 108 条源记录，加上明确的现代 Db→旧 Ha 颜色别名，表外回退源文件声明的 Pink。XP 因未核实数字 RGB 仍未加入；默认配色保持 Jmol。

## SHELXTL / XP：已核实颜色索引，未取得可靠 RGB

来源：[SHELXTL Software Reference Manual](https://xray.uky.edu/Resources/manuals/Shelxtl-manual.pdf#page=194)，文档号 269-015901，1997 年 11 月修订，§18.7 / Table 18.1，印刷页 18-6（PDF 第 194 页）。表格已同时核对提取文本与原页图像。

这是设备相关的 16 色索引表，不是全周期表的逐元素 RGB 表。下列为 Monitor 列：

| 色号 | 屏幕颜色名称 | 文档列出的用途/元素 |
|---|---|---|
| 0 | 棕色 | 键；另用于晶胞轮廓 |
| 1 | 绿色 | F、Al、Ni、傅里叶峰 |
| 2 | 暗红 | Pt、Fe、Br |
| 3 | 深蓝 | Co |
| 4 | 黄色 | S、Na |
| 5 | 紫色 | P、K、Mn |
| 6 | 白色 | H |
| 7 | 灰色 | C；PERS / SPIX 中为黑色 |
| 8 | 蓝色 | D、N、Ru、Ag |
| 9 | 深绿 | Cl、其他 |
| 10 | 淡紫（lilac） | Li、Cr、I |
| 11 | 橙色 | B、Sn、Au |
| 12 | 青绿（turquoise） | Cu、Si、Os |
| 13 | 棕色 | Se、Sb、Mo |
| 14 | 深灰 | As、Hg |
| 15 | 红色 | O |

重要区别：

- 默认**颜色**按原子名称识别，并非按 SFAC 类型编号；不要与 ATYP 的原子绘图/纹理类型混淆。颜色可用 ATYP 修改。
- 同一色号在显示器、Deskjet 与笔式绘图仪上不是同一种颜色。例如 H 的色号 6 在 Monitor 列为白色、Deskjet 列为浅绿；N 的色号 8 在 Monitor 列为蓝色、Deskjet 列为青色。
- 白底查看模式 VIEW/W 又将色号 0 改为黑色、4 改为橙色、6 改为浅蓝色。
- 最明显的元素映射差异是 **P 为紫色**，而本项目三套基础表中 P 都为橙色系。
- 文档没有给出这些颜色的数值 RGB。不能直接把 `purple`、`gray` 等套用 CSS 同名颜色，声称为原版 XP 的精确 RGB；也不能凭截图拾色忽略显示模式与设备。
- 若将来实现，应明确标注所采用的版本及设备模式，例如“XP 屏幕配色”，而不是未经限定的“XP 标准”。现有白色键策略无需为了复制色号 0 而改变。

## ORTEP-3 for Windows：已找到实际元素表和 RGB

原始文本和解析结果保存在 `references/ortep-colors/`：

- `atomcols.def`：发行包中的完整元素配置原文。
- `rgbcols-overrides.def`：同包随附的四条颜色增补/覆盖定义。
- `rgbcols-base-1998.def`：早期发行包中的完整 126 色 RGB 字典。
- `element-colors.csv`、`element-colors.json`：按实际配置行解析的 108 条记录，含来源行号、原始小数 RGB、HEX 和校验信息。

### 常用元素：实际配置，而非注释中的 CPK 描述

| 元素 | 配置中的颜色名 | 核对后的 HEX | 当前项目 RasMol |
|---|---|---|---|
| H | White | #FFFFFF | #FFFFFF |
| C | SlateBlue | #007FFF | #C8C8C8 |
| N | Orchid | #DB70DB | #8F8FFF |
| O | Red | #FF0000 | #F00000 |
| P | Orange | #FF8000 | #FFA500 |
| S | Yellow | #FFFF00 | #FFC832 |
| F | YellowGreen | #99CC32 | 未收录，回退碳色 |
| Cl | Aquamarine | #70DB93 | 未收录，回退碳色 |
| Br | Brown | #A52A2A | 未收录，回退碳色 |
| I | Aquamarine | #70DB93 | 未收录，回退碳色 |
| Fe | Orange | #FF8000 | 未收录，回退碳色 |

**关键发现：文件注释写 C=LightGrey、N=LightBlue，但实际数据行是 C=SlateBlue、N=Orchid。** 文件自身说明它用于修改内置默认值。因此上述表应称为“ORTEP 随附配置配色”，不能直接称为“ORTEP 内置 CPK”；也不能把注释或 RasMol 表替换成这些实际数据。

### 配置结构

来源：[ORTEP-3 for Windows Version 2 手册](https://www.chem.gla.ac.uk/~louis/software/ortep/ortep3.pdf)，§4.3、§5.3.4 与 Table 6.4。

- `atomcols.def`：原子种类的默认颜色及其他元素参数。
- `rgbcols.def`：颜色名到浮点 RGB 的定义，可供用户扩展/修改。
- 手册将默认元素配色称为 CPK，但仅凭这个名称不能认定它与 RasMol 的 RGB 逐项相同。
- 手册 Table 6.4（第 37 页）确实提供 RGB 字典，例如 White=(1,1,1)、Blue=(0,0,1)、Red=(1,0,0)、Orange=(1,0.5,0)、Yellow=(1,1,0)、Gray=(0.752941,0.752941,0.752941)。字典本身不能证明某元素默认选用哪个名称，须结合实际发行包的元素映射文件。

### 版本与取证路径

[官方发布页](https://www.chem.gla.ac.uk/~louis/software/downloads/index.html)列出 ORTEP 2026.1（发布日 2025-12-19）；对应[发行包](https://www.chem.gla.ac.uk/~louis/software/downloads/ortep_2026.1.zip)。不要将 Version 2 手册的所有数据未经核对就标成 2026.1 的默认值。

实际找到的 `atomcols.def` 和增补 `rgbcols.def` 文件头均标注 **Version 2.0 (April 2008)**。无需追逐版本才能使用一份可溯源的颜色表；这里固定记录找到的文件及校验值，而不假定文件标题能证明自 2008 年起从未修改。

本轮用已有的纯 Python 解析源码静态读取发行包中的两份文本，并校验压缩块和文件校验和；没有执行 `setup.exe`、模拟安装脚本、安装 ORTEP 或补装被拒绝的依赖。

完整 RGB 基表另从[1998 年原官方发行包存档](https://web.archive.org/web/19980712194749id_/http://www.chem.gla.ac.uk:80/~louis/software/ortep3/ortep32.zip)直接取得；1997/1998 三个包中的该文件逐字节一致。所有实际用到的非覆盖颜色还逐项核对了 Version 2 手册 Table 6.4，RGB 全部一致。脚本按大小写精确匹配名称、再应用四条增补定义；其中 `Lightblue` 不自动混同为 `LightBlue`，四条增补均不影响上述 CHNOPS 六项。

校验值：

- `atomcols.def` SHA-256：`a28d2ac924e7daa6bfa10974f83e9aedf4fe8e8fd36a4b2972818d4c4a294281`
- 随包增补 `rgbcols.def` SHA-256：`6409143f0676064783d7202c0ef95f3f6f8c70bd3fa6d37fbd482473e9a2ff3d`
- 1997/1998 完整 RGB 字典 SHA-256：`96f227d1ef5ebb0f06a229b9b0d8e71a4d1bc211a078628670b9a12aa81b1437`

原文件共有 **108 条配置**：105 条元素/历史元素符号记录，加 `Ct`、`D`、`Q`。历史符号 `Ha` 原样保留，没有偷偷改名，也没有虚构 106–118 号元素条目。文件中同时包含的原子半径并未应用到本项目；本轮只研究颜色。未知元素为 Pink 是文件注释所述，未运行程序验证文件缺失时的内置回退。

提取/转换结果有独立校验，`scripts/research-ortep-colors.py` 仅使用标准库生成 CSV/JSON；取证阶段未修改渲染器或配色菜单，之后的应用接入另见 `PALETTES.md`。之前核对的 GX 1985 源码不含 Windows 界面色表，已经不再用它作为当前元素映射的证据。

## 收录原则

1. 软件名不是独立配色的证据：必须比较真实的元素映射及 RGB，完全重复才合并。
2. 只掌握颜色名时，不擅自换成 CSS 同名颜色或其他软件的 RGB。
3. 分别记录版本、显示/打印模式、源文件、RGB 转换规则、覆盖元素与未知元素处理。
4. 数值转换沿用当前项目 `Math.round(255 * component)`，表示底色数值，并非承诺重现原软件的完整光照或屏幕输出。
5. 若未来加入完整表，也应同时处理当前六元素以外的颜色，不能把碳色回退误称为原软件的默认元素色。
