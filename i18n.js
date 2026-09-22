/* Classic-script localization: usable directly from file:// with no dependencies. */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'molplotter.locale';
  // Public, mutable dictionaries: callers may add application-specific keys at runtime.
  const messages = {
    en: {
      'static.brand': 'Molecular Renaissance',
      'static.artboard': 'Molecular plate',
      'static.preview': 'Molecular preview',
      'static.rotateHint': 'Drag the rotation rings',
      'static.controls': 'Rendering controls',
      'static.settings': 'Plate settings',
      'static.model': 'Model',
      'static.xyzImport': 'Import local XYZ',
      'static.xyzChoose': 'Choose XYZ file',
      'static.xyzHelp': 'XYZ import help',
      'static.xyzHint': 'Bonds are inferred automatically by distance. Coordinates in Å; one frame, up to 500 atoms and 2 MiB. Files are read locally and never uploaded.',
      'static.outlineWidth': 'Outline width',
      'static.sizeView': 'Size and view',
      'static.scale': 'Overall scale',
      'static.scaleHint': 'SVG units/Å; scales geometry only, not texture',
      'static.atomRadius': 'Atom radius multiplier',
      'static.rotation': 'Rotation',
      'static.eulerXYZ': 'Euler XYZ',
      'static.rotationReset': 'Reset view',
      'gizmo.label': '3D rotation control',
      'gizmo.x': 'Rotate around local X',
      'gizmo.y': 'Rotate around local Y',
      'gizmo.z': 'Rotate around local Z',
      'gizmo.screen': 'Rotate in the image plane',
      'static.shading': 'Shading',
      'static.shadingEnabled': 'Enable shading',
      'static.fastOverlay': 'Fast overlay',
      'static.fastHelp': 'Fast overlay help',
      'static.fastHint': 'Orthographic projection, parallel light, no cast shadows. Spheres overlap by depth; only local bond–atom occlusion is handled. Turning this off restores the previous cast-shadow setting.',
      'static.texture': 'Texture',
      'static.shadingMode': 'Shading mode',
      'static.hatch': 'Hatching',
      'static.stipple': 'Stippling',
      'static.halftone': 'Regular halftone',
      'static.textureScale': 'Texture scale',
      'static.textureHint': 'Left: finer and denser; right: coarser and sparser, with similar average darkness',
      'static.brightness': 'Brightness',
      'static.contrast': 'Contrast',
      'static.variableWidth': 'Variable line width',
      'static.crossHatch': 'Cross-hatching',
      'static.quantizedShading': '16-level shading',
      'static.lighting': 'Lighting and shadows',
      'static.lightAzimuth': 'Light azimuth',
      'static.lightElevation': 'Light elevation',
      'static.castShadows': 'Cast shadows',
      'static.shadowStrength': 'Shadow strength',
      'static.colors': 'Colors',
      'static.colorEnabled': 'Enable element colors',
      'static.colorScheme': 'Palette',
      'static.pymol': 'PyMOL element colors',
      'static.ortep': 'ORTEP · Shipped configuration',
      'static.greenCarbon': '3Dmol · Green carbon',
      'static.cyanCarbon': '3Dmol · Cyan carbon',
      'static.magentaCarbon': '3Dmol · Magenta carbon',
      'static.washStrength': 'Intensity',
      'static.saturation': 'Saturation',
      'static.elementTextures': 'Element textures',
      'static.elementTextureScale': 'Pattern size',
      'static.elementTextureLegend': 'Element texture legend',
      'static.labels': 'Element labels',
      'static.labelsEnabled': 'Show element labels',
      'static.labelStyle': 'Element label style',
      'static.labelHydrogens': 'Show H labels',
      'static.labelSize': 'Font size',
      'static.labelFont': 'Font',
      'static.bold': 'Bold',
      'static.italic': 'Italic',
      'static.labelColor': 'Text color',
      'static.labelStrokeWidth': 'Stroke width',
      'static.labelMatchFill': 'Match stroke to fill',
      'static.labelStrokeColor': 'Stroke color',
      'static.reset': 'Reset',
      'static.download': 'Download SVG'
    },
    'zh-CN': {
      'static.brand': '分子文艺复兴',
      'static.artboard': '分子图版',
      'static.preview': '分子预览',
      'static.rotateHint': '拖动旋转圆环',
      'static.controls': '渲染控制',
      'static.settings': '图版设置',
      'static.model': '模型',
      'static.xyzImport': '导入本地 XYZ',
      'static.xyzChoose': '选择 XYZ 文件',
      'static.xyzHelp': 'XYZ 导入帮助',
      'static.xyzHint': '自动按距离推断键。坐标单位 Å；支持单帧，最多 500 原子、2 MiB。文件仅在本地读取，不上传。',
      'static.outlineWidth': '轮廓线宽',
      'static.sizeView': '大小与视角',
      'static.scale': '整图比例',
      'static.scaleHint': 'SVG 单位/Å；只缩放几何，不缩放纹理',
      'static.atomRadius': '原子半径倍率',
      'static.rotation': '旋转',
      'static.eulerXYZ': '欧拉角 XYZ',
      'static.rotationReset': '重置视角',
      'gizmo.label': '三维旋转控件',
      'gizmo.x': '绕局部 X 轴旋转',
      'gizmo.y': '绕局部 Y 轴旋转',
      'gizmo.z': '绕局部 Z 轴旋转',
      'gizmo.screen': '绕视线旋转',
      'static.shading': '光影',
      'static.shadingEnabled': '启用光影',
      'static.fastOverlay': '快速覆盖',
      'static.fastHelp': '快速覆盖帮助',
      'static.fastHint': '正交投影、平行光、无投影阴影。球体按深度覆盖，仅处理键与原子的局部遮挡；关闭后恢复原投影开关设置。',
      'static.texture': '纹理',
      'static.shadingMode': '明暗模式',
      'static.hatch': '排线',
      'static.stipple': '点刻',
      'static.halftone': '规则网点',
      'static.textureScale': '纹理粗细',
      'static.textureHint': '向左更细密，向右更粗疏，平均黑度尽量不变',
      'static.brightness': '亮度',
      'static.contrast': '对比度',
      'static.variableWidth': '渐变线宽',
      'static.crossHatch': '交叉排线',
      'static.quantizedShading': '16级明暗',
      'static.lighting': '光照与阴影',
      'static.lightAzimuth': '光源方位',
      'static.lightElevation': '光源仰角',
      'static.castShadows': '投射阴影',
      'static.shadowStrength': '阴影强度',
      'static.colors': '配色',
      'static.colorEnabled': '启用元素底色',
      'static.colorScheme': '色表',
      'static.pymol': 'PyMOL 元素色',
      'static.ortep': 'ORTEP · 随附配置',
      'static.greenCarbon': '3Dmol · 绿碳',
      'static.cyanCarbon': '3Dmol · 青碳',
      'static.magentaCarbon': '3Dmol · 品红碳',
      'static.washStrength': '浓度',
      'static.saturation': '饱和度',
      'static.elementTextures': '元素纹理',
      'static.elementTextureScale': '纹理大小',
      'static.elementTextureLegend': '元素纹理图例',
      'static.labels': '元素标签',
      'static.labelsEnabled': '显示元素标签',
      'static.labelStyle': '元素标签样式',
      'static.labelHydrogens': '显示 H 标签',
      'static.labelSize': '字号',
      'static.labelFont': '字体',
      'static.bold': '粗体',
      'static.italic': '斜体',
      'static.labelColor': '文字颜色',
      'static.labelStrokeWidth': '描边宽度',
      'static.labelMatchFill': '描边匹配底色',
      'static.labelStrokeColor': '描边颜色',
      'static.reset': '重置',
      'static.download': '下载 SVG'
    }
  };

  function isLocale(value) {
    return value === 'en' || value === 'zh-CN';
  }

  function initialLocale() {
    try {
      const saved = global.localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) return saved;
    } catch (_) {
      // Storage can be unavailable or denied, especially on file://.
    }
    const navigator = global.navigator || {};
    const language = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    return /^zh/i.test(language) ? 'zh-CN' : 'en';
  }

  let locale = initialLocale();

  function t(key, vars) {
    // Resolve dictionaries on each call so extensions and replacements stay live.
    const localized = messages[locale];
    const english = messages.en;
    const own = Object.prototype.hasOwnProperty;
    let text = localized && own.call(localized, key) ? localized[key]
      : english && own.call(english, key) ? english[key] : key;
    text = String(text);
    return text.replace(/\{([^{}]+)\}/g, function (match, name) {
      return vars && own.call(vars, name) ? String(vars[name]) : match;
    });
  }

  function setLocale(value) {
    if (!isLocale(value)) return locale;
    locale = value;
    try {
      global.localStorage.setItem(STORAGE_KEY, locale);
    } catch (_) {
      // The in-memory preference remains usable without persistence.
    }
    return locale;
  }

  function getLocale() {
    return locale;
  }

  function apply(root = global.document) {
    if (!root) return;
    const attributes = [
      ['data-i18n', null],
      ['data-i18n-aria-label', 'aria-label'],
      ['data-i18n-title', 'title']
    ];
    attributes.forEach(function (entry) {
      const selector = '[' + entry[0] + ']';
      const nodes = Array.from(root.querySelectorAll(selector));
      if (root.matches && root.matches(selector)) nodes.unshift(root);
      nodes.forEach(function (node) {
        const text = t(node.getAttribute(entry[0]));
        if (entry[1]) node.setAttribute(entry[1], text);
        else node.textContent = text;
      });
    });
    const document = root.nodeType === 9 ? root : root.ownerDocument || global.document;
    if (document) {
      document.title = t('static.brand');
      if (document.documentElement) document.documentElement.lang = locale;
    }
    const language = root.id === 'language' ? root : root.querySelector('#language');
    if (language) language.value = locale;
  }

  // No automatic DOM changes or event listeners; the application controls apply().
  global.MolI18n = { t, setLocale, getLocale, apply, messages };
})(window);
