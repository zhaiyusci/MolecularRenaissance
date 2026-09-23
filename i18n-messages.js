/* Dynamic UI messages and presentation-only error translation. Load after i18n.js. */
(function () {
  'use strict';
  var i18n = window.MolI18n;
  var en = i18n.messages.en;
  var zh = i18n.messages['zh-CN'];
  function add(key, english, chinese) {
    en[key] = english;
    zh[key] = chinese;
  }
  var messages = {
    'static.shadingLevels': ['Shading levels', '明暗级数'],
    'error.xyzTooLarge': ['XYZ files must be no larger than 2 MiB.', 'XYZ 文件大小不得超过 2 MiB。'],
    'error.parserMissing': ['XYZ parser unavailable. Update renderer.js.', 'XYZ 解析器不可用，请更新 renderer.js。'],
    'error.invalidSVG': ['The renderer returned invalid SVG output.', '渲染器返回了无效的 SVG 输出。'],
    'error.displaySVG': ['Could not display the SVG illustration.', '无法显示 SVG 插图。'],
    'error.engineMissing': ['Rendering engine unavailable. Keep renderer.js, index.html and app.js in the same folder.', '渲染引擎不可用，请将 renderer.js、index.html 和 app.js 放在同一文件夹中。'],
    'error.gizmoMissing': ['Rotation control unavailable. Keep rotation-gizmo.js beside index.html.', '旋转控件不可用，请将 rotation-gizmo.js 放在 index.html 同一文件夹中。'],
    'error.noExamples': ['No built-in models are available.', '没有可用的内置模型。'],
    'error.readUnknown': ['Cannot read the XYZ file.', '无法读取 XYZ 文件。'],
    'error.renderUnknown': ['Rendering failed.', '渲染失败。'],
    'error.exportUnknown': ['Export failed.', '导出失败。'],
    'status.preparing': ['Preparing illustration…', '正在准备插图…'],
    'status.engineMissing': ['Rendering engine unavailable', '渲染引擎不可用'],
    'status.noExamples': ['No built-in models', '没有内置模型'],
    'status.renderFailed': ['Rendering failed · adjust settings and retry', '渲染失败 · 请调整设置后重试'],
    'status.waiting': ['Waiting to render', '等待渲染'],
    'status.incomplete': ['Render incomplete', '渲染未完成'],
    'status.precise': ['Precise rendering', '精确渲染'],
    'status.fast': ['Fast overlay · on', '快速覆盖 · 已启用'],
    'status.renderTime': ['Rendered in {ms} ms', '渲染耗时 {ms} 毫秒'],
    'status.dragTime': ['Drag preview (no shading) · {ms} ms', '拖动预览（无光影）· {ms} 毫秒'],
    'status.modelInfo': ['{atoms} atoms · {bonds} bonds · 900 × 700', '{atoms} 个原子 · {bonds} 条化学键 · 900 × 700'],
    'status.previewAria': ['{name} molecular illustration', '{name}分子插图'],
    'status.xyzCancelled': ['XYZ import cancelled', '已取消 XYZ 导入'],
    'status.xyzReading': ['Reading {name}…', '正在读取 {name}…'],
    'status.xyzLoaded': ['Loaded {name} · {atoms} atoms · {bonds} inferred bonds', '已加载 {name} · {atoms} 个原子 · {bonds} 条推断键'],
    'status.xyzFailed': ['XYZ import failed: {detail}', 'XYZ 导入失败：{detail}'],
    'status.exportFailed': ['SVG export failed: {detail}', 'SVG 导出失败：{detail}'],
    'model.local': ['Local · {name}', '本地 · {name}'],
    'model.sphere': ['Single sphere', '单球'],
    'model.pair': ['Two spheres', '双球'],
    'model.water': ['Water', '水'],
    'model.ethanol': ['Ethanol', '乙醇'],
    'model.c60': ['Fullerene', '富勒烯'],
    'model.methane': ['Methane', '甲烷'],
    'model.ammonia': ['Ammonia', '氨'],
    'model.carbonDioxide': ['Carbon dioxide', '二氧化碳'],
    'model.methanol': ['Methanol', '甲醇'],
    'model.benzene': ['Benzene', '苯'],
    'model.hydrogenPeroxide': ['Hydrogen peroxide', '过氧化氢'],
    'model.phenol': ['Phenol', '苯酚'],
    'model.isopropanol': ['Isopropanol', '异丙醇'],
    'model.glucose': ['Glucose (α-D)', '葡萄糖（α-D）'],
    'model.sulfuricAcid': ['Sulfuric acid', '硫酸'],
    'model.glycine': ['Glycine', '甘氨酸'],
    'model.phospholipid': ['Phospholipid (DHPC)', '磷脂（DHPC）'],
    'error.xyzLine': ['XYZ line {line}: {detail}', 'XYZ 第 {line} 行：{detail}']
  };
  Object.keys(messages).forEach(function (key) {
    add(key, messages[key][0], messages[key][1]);
  });

  // Exact matches, never machine-translated fragments of an arbitrary exception.
  var exact = Object.create(null);
  function known(key, english, chinese) {
    add(key, english, chinese);
    exact[english] = key;
  }
  var parser = [
    ['atomicNumber', 'unknown element: atomic number must be in 1–118', '未知元素：原子序数必须在 1–118 之间'],
    ['elementToken', 'unknown element: expected a chemical symbol or atomic number', '未知元素：应为化学元素符号或原子序数'],
    ['coordinateSyntax', 'coordinates must be finite decimal/scientific numbers (not NaN, Inf or hexadecimal)', '坐标必须为有限的十进制数或科学计数法数值（不接受非数值、无穷大或十六进制）'],
    ['coordinateFinite', 'coordinates must be finite', '坐标必须为有限数值'],
    ['coordinateLimit', 'coordinate exceeds the absolute limit of 1000000 angstrom', '坐标绝对值超过 1000000 埃的上限'],
    ['textRequired', 'input must be text', '输入必须为文本'],
    ['textBudget', 'text exceeds the 2097152-character safety budget', '文本超过 2097152 个字符的安全上限'],
    ['optionsObject', 'options must be an object', '解析选项必须为对象'],
    ['maxAtoms', 'maxAtoms must be a positive integer no greater than 2000', '最大原子数必须为不大于 2000 的正整数'],
    ['nameString', 'name must be a string', '名称必须为字符串'],
    ['inferBoolean', 'inferBonds must be a boolean', '是否推断化学键必须为布尔值'],
    ['atomCount', 'expected a positive integer atom count', '原子数必须为正整数'],
    ['safeAtomCount', 'expected a positive safe-integer atom count', '原子数必须为安全范围内的正整数'],
    ['comment', 'missing mandatory comment line (use an empty line if unnamed)', '缺少必需的注释行（没有名称时请保留空行）'],
    ['extended', 'extended XYZ Properties layouts are unsupported; convert to standard four-column element x y z XYZ (no reordered fields)', '不支持扩展 XYZ 属性布局；请转换为标准四列 XYZ：元素、x、y、z（不可调整字段顺序）'],
    ['columns', 'expected exactly four columns: element x y z; blank records and extra atom properties are unsupported', '每条记录必须恰好包含四列：元素、x、y、z；不支持空记录或额外的原子属性'],
    ['trailing', 'unexpected trailing data: only one XYZ frame is supported (extra records/frames are not allowed)', '存在多余的尾部数据：仅支持一个 XYZ 帧（不允许额外记录或帧）'],
    ['bondLimit', 'bond inference exceeds the 10000-bond safety limit; disable inferBonds for this dense structure', '推断的化学键超过 10000 条的安全上限；请关闭此密集结构的化学键推断']
  ];
  parser.forEach(function (row) { known('error.xyz.' + row[0], row[1], row[2]); });
  add('error.xyz.unknownElement', 'unknown chemical element {element}', '未知化学元素 {element}');
  add('error.xyz.unsupportedElement', 'unsupported element {element}: no sourced covalent radius available for rendering (supported: H–Cm, Z=1–96)', '不支持元素 {element}：没有可用于渲染且有来源依据的共价半径（支持 H–Cm，原子序数 1–96）');
  add('error.xyz.declaredCount', 'declared atom count {count} exceeds maxAtoms {max}', '声明的原子数 {count} 超过最大原子数 {max}');
  add('error.xyz.missingRecord', 'missing coordinate record {record} of {count}', '缺少第 {record} 条坐标记录（共 {count} 条）');

  var engine = [
    ['labelHydrogens', 'Invalid labelHydrogens', '氢原子标签设置无效'],
    ['quality', 'Invalid quality', '渲染质量设置无效'],
    ['scale', 'Invalid scale: expected positive finite SVG units per angstrom', '缩放比例无效：每埃对应的 SVG 单位数必须为有限正数'],
    ['radiusScale', 'Invalid atomRadiusScale: expected a positive finite multiplier', '原子半径倍率无效：必须为有限正数'],
    ['castShadows', 'Invalid castShadows', '投影开关设置无效'],
    ['shadowStrength', 'Invalid shadowStrength: expected 0–1', '投影强度无效：必须在 0–1 之间'],
    ['colorScheme', 'Invalid colorScheme', '配色方案无效'],
    ['shadingMode', 'Invalid shadingMode', '明暗纹理模式无效'],
    ['quantizeShading', 'Invalid quantizeShading', '明暗量化设置无效'],
    ['shadingLevels', 'Invalid shadingLevels: expected 4, 8, 16, 32, or 64', '明暗级数无效：请选择 4、8、16、32 或 64'],
    ['quantizedConflict', 'Conflicting quantizeShading and hatchMode', '明暗量化与排线模式冲突'],
    ['hatchMode', 'Invalid hatchMode', '排线模式无效'],
    ['layeredPrecise', 'Layered hatching requires precise rendering', '分级排线需要精确渲染'],
    ['dots', 'Invalid dot settings', '网点设置无效'],
    ['dimensions', 'Invalid output dimensions or line width', '输出尺寸或线宽无效'],
    ['saturation', 'colorSaturation must be between 0 and 4', '色彩饱和度必须在 0–4 之间'],
    ['wash', 'washStrength must be between 0 and 1', '淡彩强度必须在 0–1 之间'],
    ['labelSize', 'Invalid label size or stroke width', '标签字号或描边宽度无效'],
    ['labelFont', 'Invalid label font', '标签字体无效'],
    ['renderMode', 'Invalid renderMode', '渲染模式无效'],
    ['fastLight', 'Fast rendering requires castShadows=false', '快速渲染需要关闭投影'],
    ['molecule', 'Expected atoms and bonds', '模型必须包含非空原子数组和化学键数组'],
    ['position', 'Invalid atom position', '原子位置无效'],
    ['bond', 'Invalid bond', '化学键无效'],
    ['zeroBond', 'Zero length bond', '化学键长度为零'],
    ['radius', 'Invalid atom radius: expected a positive finite value in angstrom', '原子半径无效：必须为以埃为单位的有限正数'],
    ['dotMode', 'Invalid dot mode', '网点模式无效'],
    ['simpleScale', 'Invalid scale', '缩放比例无效'],
    ['dotScreen', 'Dot screen too large; increase spacing or reduce output size', '网点区域过大；请增加间距或减小输出尺寸'],
    ['stippleDensity', 'Stipple density too high; increase dot size', '点描密度过高；请增大点的尺寸'],
    ['stippleCount', 'Too many stipple marks; use a coarser texture', '点描数量过多；请使用更粗的纹理'],
    ['fastProjection', 'Fast painter bond projection exceeds finite SVG coordinates', '快速渲染的化学键投影超出有限 SVG 坐标范围'],
    ['fastSamples', 'Fast painter bond mask sample budget exceeded; reduce scale/output size or use precise mode', '快速渲染的化学键遮罩采样超出上限；请减小缩放比例或输出尺寸，或使用精确模式'],
    ['fastGrid', 'Fast painter bond mask grid budget exceeded; reduce scale/output size or use precise mode', '快速渲染的化学键遮罩网格超出上限；请减小缩放比例或输出尺寸，或使用精确模式'],
    ['washMissing', 'Missing wash.js: load it before renderer.js', '缺少 wash.js：请在 renderer.js 之前加载'],
    ['dotsMissing', 'Load dots.js before renderer.js', '请在 renderer.js 之前加载 dots.js'],
    ['washOutdated', 'Load updated wash.js before renderer.js', '请在 renderer.js 之前加载更新后的 wash.js'],
    ['colors', 'Element colors must be #rrggbb', '元素颜色必须采用六位十六进制格式（#rrggbb）'],
    ['bounds', 'Projected bounds overflow', '投影边界溢出'],
    ['extent', 'Projected extent overflow', '投影尺寸溢出'],
    ['orientation', 'Invalid orientation: expected four finite quaternion components', '姿态无效：四元数必须包含四个有限数值'],
    ['zeroOrientation', 'Invalid orientation: quaternion must be nonzero', '姿态无效：四元数不能全部为零'],
    ['orientationAxis', 'Invalid orientation axis: expected x, y, or z', '旋转轴无效：请选择 X、Y 或 Z'],
    ['orientationAngle', 'Invalid orientation angle: expected finite radians', '旋转角度无效：必须为有限弧度值'],
    ['euler', 'Invalid Euler angles: expected three finite radians', '欧拉角无效：必须包含三个有限弧度值'],
    ['elementTextures', 'Invalid elementTextures: expected a boolean', '元素纹理开关必须为布尔值'],
    ['elementTextureScale', 'Invalid elementTextureScale: expected a finite number between 0.5 and 3', '元素纹理大小必须为 0.5–3 之间的有限数值'],
    ['elementTextureSymbol', 'Invalid element texture symbol: expected ASCII letters', '元素纹理符号必须由英文字母组成'],
    ['elementTextureId', 'Invalid element texture pattern id', '元素纹理图案标识无效'],
    ['elementTextureProjection', 'Element texture projection exceeds finite SVG coordinates', '元素纹理投影超出有限 SVG 坐标范围'],
    ['elementTextureSample', 'Element texture fallback sample budget exceeded; reduce scale/output size or enable analytic boundaries', '元素纹理回退采样超出上限；请缩小比例或输出尺寸，或启用解析边界'],
    ['elementTextureGrid', 'Element texture fallback grid budget exceeded; reduce scale/output size or enable analytic boundaries', '元素纹理回退网格超出上限；请缩小比例或输出尺寸，或启用解析边界'],
    ['elementTextureTile', 'Element texture fallback tile budget exceeded; reduce scale/output size or enable analytic boundaries', '元素纹理回退分块超出上限；请缩小比例或输出尺寸，或启用解析边界'],
    ['elementTextureDepth', 'Element texture fallback depth budget exceeded; reduce molecule size or enable analytic boundaries', '元素纹理回退深度查询超出上限；请减少原子数量，或启用解析边界']
  ];
  engine.forEach(function (row) { known('error.engine.' + row[0], row[1], row[2]); });
  add('error.engine.removedLighting', 'Removed lighting option: {option}; only directional lighting is supported', '已移除光照选项：{option}；仅支持平行光');
  add('error.engine.option', 'Invalid option: {option}', '选项无效：{option}');
  add('error.engine.labelColor', 'Invalid label color: {option}', '标签颜色无效：{option}');
  add('error.engine.noRadius', 'No covalent radius for element {element}; provide atom.radius in angstrom', '元素 {element} 没有共价半径；请提供以埃为单位的原子半径');
  var optionNames = {
    shadingBrightness: '明暗亮度', textureScale: '纹理比例', shadingDensity: '纹理密度',
    shadingSize: '纹理尺寸', shadingContrast: '明暗对比度', dotSpacing: '网点间距',
    dotSize: '网点尺寸', dotContrast: '网点对比度', outlineWidth: '轮廓线宽',
    hatchWidth: '排线宽度', colorSaturation: '色彩饱和度', width: '宽度', height: '高度',
    yaw: '水平旋转角', pitch: '俯仰角', lightAzimuth: '光源方位角', lightElevation: '光源仰角',
    density: '密度', lineWidth: '线宽', labelSize: '标签字号',
    labelStrokeWidth: '标签描边宽度', washStrength: '淡彩强度',
    labelColor: '标签颜色', labelStrokeColor: '标签描边颜色'
  };
  Object.keys(optionNames).forEach(function (key) { add('error.option.' + key, key, optionNames[key]); });

  function translateKnown(message) {
    if (Object.prototype.hasOwnProperty.call(exact, message)) return i18n.t(exact[message]);
    var match;
    if ((match = /^Removed lighting option: (lightType|lightDistance|lightAttenuation); only directional lighting is supported$/.exec(message))) {
      return i18n.t('error.engine.removedLighting', { option: match[1] });
    }
    if ((match = /^unknown chemical element ([A-Z][a-z]?)$/.exec(message))) {
      return i18n.t('error.xyz.unknownElement', { element: match[1] });
    }
    if ((match = /^unsupported element ([A-Z][a-z]?): no sourced covalent radius available for rendering \(supported: H–Cm, Z=1–96\)$/.exec(message))) {
      return i18n.t('error.xyz.unsupportedElement', { element: match[1] });
    }
    if ((match = /^declared atom count (\d+) exceeds maxAtoms (\d+)$/.exec(message))) {
      return i18n.t('error.xyz.declaredCount', { count: match[1], max: match[2] });
    }
    if ((match = /^missing coordinate record (\d+) of (\d+)$/.exec(message))) {
      return i18n.t('error.xyz.missingRecord', { record: match[1], count: match[2] });
    }
    if ((match = /^(Invalid option: |Invalid label color: )([A-Za-z]+)$/.exec(message)) && Object.prototype.hasOwnProperty.call(optionNames, match[2])) {
      return i18n.t(match[1] === 'Invalid option: ' ? 'error.engine.option' : 'error.engine.labelColor', { option: i18n.t('error.option.' + match[2]) });
    }
    if ((match = /^No covalent radius for element ([A-Z][a-z]?); provide atom\.radius in angstrom$/.exec(message))) {
      return i18n.t('error.engine.noRadius', { element: match[1] });
    }
    return null;
  }

  i18n.error = function (cause, fallbackKey) {
    // Require a real dictionary key: unknown keys must not leak as UI text.
    var locale = typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
    var dictionary = i18n.messages[locale] || en;
    function has(key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(dictionary, key); }
    var fallback = has(fallbackKey) ? fallbackKey : 'error.renderUnknown';
    if (cause && has(cause.uiKey)) return i18n.t(cause.uiKey);
    var message = typeof cause === 'string' ? cause : cause && typeof cause.message === 'string' ? cause.message : '';
    var line = /^XYZ line (\d+): ([\s\S]*)$/.exec(message);
    if (line) {
      return i18n.t('error.xyzLine', { line: line[1], detail: translateKnown(line[2]) || i18n.t(fallback) });
    }
    return translateKnown(message) || i18n.t(fallback);
  };
}());
