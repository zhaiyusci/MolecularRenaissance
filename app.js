/* Classic script: works directly from file:// alongside renderer.js. */
(function () {
  'use strict';

  var byId = function (id) { return document.getElementById(id); };
  var model = byId('model');
  var xyzFile = byId('xyz-file');
  var xyzStatus = byId('xyz-status');
  var imported = null;
  var importedOption = null;
  var importRequest = 0;
  var importLoading = false;
  var importedKey = '__local_xyz__';
  var preview = byId('preview');
  var timing = byId('timing');
  var error = byId('error');
  var download = byId('download');
  var scale = byId('scale');
  var atomRadiusScale = byId('atom-radius-scale');
  var yaw = byId('yaw');
  var pitch = byId('pitch');
  var lightAzimuth = byId('light-azimuth');
  var lightElevation = byId('light-elevation');
  var fastOverlay = byId('fast-overlay');
  var preciseLightSettings = null;
  var pointLight = byId('point-light');
  var castShadows = byId('cast-shadows');
  var shadowStrength = byId('shadow-strength');
  var lightDistance = byId('light-distance');
  var lightAttenuation = byId('light-attenuation');
  var variableWidth = byId('variable-width');
  var shadingMode = byId('shading-mode');
  var shadingEnabled = byId('shading-enabled');
  ['shading-title-controls', 'color-title-controls', 'labels-title-controls'].forEach(function (id) {
    byId(id).addEventListener('click', function (event) {
      event.stopPropagation(); // Controls in summary must not toggle the accordion.
    });
  });
  var textureScale = byId('texture-scale');
  var shadingBrightness = byId('shading-brightness');
  var shadingContrast = byId('shading-contrast');
  var outlineWidth = byId('outline-width');
  var crossHatch = byId('cross-hatch');
  var colorWash = byId('color-wash');
  var colorScheme = byId('color-scheme');
  var washStrength = byId('wash-strength');
  var colorSaturation = byId('color-saturation');
  var labelMatchFill = byId('label-match-fill');
  var labels = byId('labels');
  var labelHydrogens = byId('label-hydrogens');
  var labelSize = byId('label-size');
  var labelFont = byId('label-font');
  var labelColor = byId('label-color');
  var labelStrokeWidth = byId('label-stroke-width');
  var labelStrokeColor = byId('label-stroke-color');
  var labelBold = byId('label-bold');
  var labelItalic = byId('label-italic');
  var defaultLabelFont = "Georgia, 'Times New Roman', serif";
  var engine = window.MolEngraver;
  var frame = null;
  var lastRender = null;
  var drag = null;
  var controlPointer = null;

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    timing.textContent = '渲染未完成';
    download.disabled = true;
    lastRender = null;
  }

  if (!engine || typeof engine.render !== 'function' || !engine.examples) {
    preview.textContent = '未能载入渲染器。';
    showError('请确认 renderer.js 与 index.html、app.js 位于同一文件夹，然后重新打开页面。');
    return;
  }

  var keys = Object.keys(engine.examples);
  if (!keys.length) {
    preview.textContent = '没有可用的示例模型。';
    showError('渲染器的 examples 为空。');
    return;
  }
  keys.forEach(function (key) {
    var option = document.createElement('option');
    option.value = key;
    option.textContent = engine.examples[key].name || key;
    model.appendChild(option);
  });

  // Keep the local slot separate from the engine's immutable example catalog.
  while (Object.prototype.hasOwnProperty.call(engine.examples, importedKey)) importedKey += '_';

  function setXYZStatus(message, failed) {
    xyzStatus.textContent = message;
    xyzStatus.setAttribute('data-error', failed ? 'true' : 'false');
  }

  function cancelImport() {
    importRequest += 1;
    if (importLoading) setXYZStatus('已取消待完成的 XYZ 导入。', false);
    importLoading = false;
  }

  function parseImport(text, name) {
    if (typeof engine.parseXYZ !== 'function') throw new Error('未能载入 XYZ 解析器，请更新 renderer.js。');
    var molecule = engine.parseXYZ(text, { name: name, inferBonds: true, maxAtoms: 500 });
    return { name: name, model: molecule };
  }

  function commitImport(next, select) {
    imported = next;
    if (!importedOption) {
      importedOption = document.createElement('option');
      importedOption.value = importedKey;
      model.appendChild(importedOption);
    }
    importedOption.textContent = '本地 · ' + next.name;
    if (select) model.value = importedKey;
    setXYZStatus('已载入 ' + next.name + ' · ' + next.model.atoms.length + ' 个原子 · ' + next.model.bonds.length + ' 个键（距离推断）', false);
  }

  xyzFile.addEventListener('change', async function () {
    var file = xyzFile.files && xyzFile.files[0];
    xyzFile.value = ''; // Permit choosing the same file again, including after failure.
    if (!file) return;
    var request = ++importRequest;
    importLoading = true;
    download.disabled = true;
    lastRender = null;
    setXYZStatus('正在读取 ' + file.name + '…', false);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('XYZ 文件不能超过 2MiB。');
      var text = await file.text();
      if (request !== importRequest) return;
      var next = parseImport(text, file.name);
      if (request !== importRequest) return;
      commitImport(next, true);
    } catch (cause) {
      if (request !== importRequest) return;
      setXYZStatus('XYZ 导入失败：' + (cause && cause.message ? cause.message : '无法读取文件。'), true);
    } finally {
      if (request === importRequest) {
        importLoading = false;
        // A failure renders the prior valid selection, never a partial import.
        scheduleRender();
      }
    }
  });

  model.addEventListener('change', function () {
    cancelImport();
    if (model.value === importedKey && imported) {
      commitImport(imported, false);
    }
    scheduleRender();
  });

  function syncOutputs() {
    // Remember precise-mode preferences only on entry; restore them on exit.
    if (fastOverlay.checked) {
      if (preciseLightSettings === null) {
        preciseLightSettings = { pointLight: pointLight.checked, castShadows: castShadows.checked };
      }
      pointLight.checked = false;
      castShadows.checked = false;
    } else if (preciseLightSettings !== null) {
      pointLight.checked = preciseLightSettings.pointLight;
      castShadows.checked = preciseLightSettings.castShadows;
      preciseLightSettings = null;
    }
    pointLight.disabled = fastOverlay.checked || !shadingEnabled.checked;
    castShadows.disabled = fastOverlay.checked || !shadingEnabled.checked;
    [shadingMode, textureScale, shadingBrightness, shadingContrast, lightAzimuth, lightElevation].forEach(function (input) {
      input.disabled = !shadingEnabled.checked;
    });
    byId('render-mode-status').textContent = fastOverlay.checked ? '快速覆盖 · 已启用' : '精确渲染';
    byId('scale-value').textContent = scale.value;
    byId('atom-radius-scale-value').textContent = Number(atomRadiusScale.value).toFixed(2) + '×';
    byId('yaw-value').textContent = yaw.value + '°';
    byId('pitch-value').textContent = pitch.value + '°';
    byId('light-azimuth-value').textContent = lightAzimuth.value + '°';
    byId('light-elevation-value').textContent = lightElevation.value + '°';
    shadowStrength.disabled = !shadingEnabled.checked || !castShadows.checked;
    byId('shadow-strength-value').textContent = shadowStrength.value + '%';
    lightDistance.disabled = !shadingEnabled.checked || !pointLight.checked;
    lightAttenuation.disabled = !shadingEnabled.checked || !pointLight.checked;
    byId('light-attenuation-value').textContent = Number(lightAttenuation.value).toFixed(3);
    byId('light-distance-value').textContent = pointLight.checked ? Number(lightDistance.value).toFixed(1) + ' R' : '∞';
    var isHatch = shadingMode.value === 'hatch';
    [crossHatch, variableWidth].forEach(function (input) {
      input.disabled = !shadingEnabled.checked || !isHatch;
    });
    byId('texture-scale-value').textContent = (Number(textureScale.value) / 100).toFixed(2) + '×';
    byId('shading-brightness-value').textContent = (Number(shadingBrightness.value) > 0 ? '+' : '') + shadingBrightness.value;
    byId('shading-contrast-value').textContent = Number(shadingContrast.value).toFixed(1);
    byId('outline-width-value').textContent = Number(outlineWidth.value).toFixed(2);
    [colorScheme, washStrength, colorSaturation].forEach(function (input) {
      input.disabled = !colorWash.checked;
    });
    byId('wash-strength-value').textContent = washStrength.value + '%';
    byId('color-saturation-value').textContent = colorSaturation.value + '%';
    byId('label-settings').disabled = !labels.checked;
    byId('label-size-value').textContent = labelSize.value;
    byId('label-stroke-width-value').textContent = Number(labelStrokeWidth.value).toFixed(1);
    labelStrokeColor.disabled = !labels.checked || Number(labelStrokeWidth.value) === 0 || labelMatchFill.checked;
  }

  function renderNow() {
    frame = null;
    var modelKey = model.value;
    var molecule = modelKey === importedKey && imported ? imported.model : engine.examples[modelKey];
    var filename = modelKey === importedKey && imported ? imported.name.replace(/\.xyz$/i, '') : modelKey;
    var start = performance.now();
    var interacting = !!drag || !!controlPointer;
    try {
      var options = {
        quality: 'preview',
        renderMode: fastOverlay.checked ? 'fast' : 'precise',
        width: 900,
        height: 700,
        scale: Number(scale.value),
        atomRadiusScale: Number(atomRadiusScale.value),
        yaw: Number(yaw.value) * Math.PI / 180,
        pitch: Number(pitch.value) * Math.PI / 180,
        lightAzimuth: Number(lightAzimuth.value) * Math.PI / 180,
        lightElevation: Number(lightElevation.value) * Math.PI / 180,
        lightType: pointLight.checked ? 'point' : 'directional',
        lightDistance: Number(lightDistance.value),
        lightAttenuation: Number(lightAttenuation.value),
        castShadows: castShadows.checked,
        shadowStrength: Number(shadowStrength.value) / 100,
        shadingMode: shadingMode.value,
        textureScale: Number(textureScale.value) / 100,
        shadingBrightness: Number(shadingBrightness.value) / 100,
        shadingContrast: Number(shadingContrast.value),
        variableWidth: variableWidth.checked,
        outlineWidth: Number(outlineWidth.value),
        crossHatch: crossHatch.checked,
        colorWash: colorWash.checked,
        colorScheme: colorScheme.value,
        washStrength: Number(washStrength.value) / 100,
        colorSaturation: Number(colorSaturation.value) / 100,
        labelMatchFill: labelMatchFill.checked,
        labels: labels.checked,
        labelHydrogens: labelHydrogens.checked,
        labelSize: Number(labelSize.value),
        labelFont: labelFont.value.trim() || defaultLabelFont,
        labelColor: labelColor.value,
        labelStrokeWidth: Number(labelStrokeWidth.value),
        labelStrokeColor: labelStrokeColor.value,
        labelBold: labelBold.checked,
        labelItalic: labelItalic.checked
      };
      // The master switch suppresses shading in BOTH preview and export snapshots.
      if (!shadingEnabled.checked) {
        options.shadingSize = 0;
        options.castShadows = false;
      }
      // Transient lightweight frame only; never overwrite the user's settings.
      var svg = engine.render(molecule, interacting ? Object.assign({}, options, { shadingSize: 0, castShadows: false }) : options);
      if (typeof svg !== 'string' || !/<svg[\s>]/i.test(svg)) {
        throw new Error('渲染器没有返回有效的 SVG。');
      }
      preview.innerHTML = svg;
      var root = preview.querySelector('svg');
      if (!root) throw new Error('无法显示 SVG。');
      if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', '0 0 900 700');
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      root.setAttribute('role', 'img');
      root.setAttribute('aria-label', (molecule.name || model.value) + '分子线刻图');
      var caption = byId('molecule-caption');
      if (caption) caption.textContent = molecule.name || model.value;
      // Keep the successful preview inputs, not its sampled SVG geometry.
      lastRender = interacting || importLoading ? null : { key: modelKey, filename: filename, model: molecule, options: options };
      byId('model-info').textContent = molecule.atoms.length + ' 个原子 · ' + molecule.bonds.length + ' 个键 · 900 × 700';
      timing.textContent = (interacting ? '拖动预览（无纹理） ' : '渲染 ') + (performance.now() - start).toFixed(1) + ' ms';
      error.hidden = true;
      error.textContent = '';
      download.disabled = interacting || importLoading;
    } catch (cause) {
      preview.textContent = '图版生成失败，请调整设置后重试。';
      showError(cause && cause.message ? cause.message : '未知渲染错误');
    }
  }

  function scheduleRender() {
    syncOutputs();
    download.disabled = true;
    if (frame === null) frame = requestAnimationFrame(renderNow);
  }

  [scale, atomRadiusScale, yaw, pitch, lightAzimuth, lightElevation, lightDistance, lightAttenuation, shadowStrength, textureScale, shadingBrightness, shadingContrast, outlineWidth, washStrength, colorSaturation, labelSize, labelFont, labelColor, labelStrokeWidth, labelStrokeColor].forEach(function (input) {
    input.addEventListener('input', scheduleRender);
  });
  [fastOverlay, shadingEnabled, shadingMode, pointLight, castShadows, variableWidth, crossHatch, colorWash, colorScheme, labelMatchFill, labels, labelHydrogens, labelBold, labelItalic].forEach(function (input) {
    input.addEventListener('change', scheduleRender);
  });

  // Native range inputs keep their own drag/capture behavior. Window release
  // handlers also cover releasing outside the slider. No idle timer/debounce.
  [scale, atomRadiusScale, yaw, pitch, lightAzimuth, lightElevation, lightDistance, lightAttenuation, shadowStrength, textureScale, shadingBrightness, shadingContrast, outlineWidth, washStrength, colorSaturation, labelSize, labelStrokeWidth].forEach(function (input) {
    input.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || input.disabled || controlPointer) return;
      controlPointer = { id: event.pointerId, input: input };
      scheduleRender();
    });
    input.addEventListener('lostpointercapture', endControl);
  });
  function endControl(event) {
    if (!controlPointer || (event && event.pointerId !== controlPointer.id)) return;
    controlPointer = null;
    scheduleRender();
  }
  window.addEventListener('pointerup', endControl);
  window.addEventListener('pointercancel', endControl);
  window.addEventListener('blur', function () {
    endControl();
    if (drag) endDrag({ pointerId: drag.id });
  });

  byId('reset').addEventListener('click', function () {
    cancelImport();
    endControl();
    if (drag) endDrag({ pointerId: drag.id });
    model.value = keys[0];
    scale.value = '60';
    atomRadiusScale.value = '1';
    yaw.value = '25';
    pitch.value = '-15';
    lightAzimuth.value = '-29';
    lightElevation.value = '32';
    fastOverlay.checked = false;
    preciseLightSettings = null;
    pointLight.checked = false;
    castShadows.checked = true;
    shadowStrength.value = '80';
    lightDistance.value = '3';
    lightAttenuation.value = '0';
    shadingEnabled.checked = true;
    shadingMode.value = 'hatch';
    textureScale.value = '100';
    shadingBrightness.value = '0';
    shadingContrast.value = '1.2';
    variableWidth.checked = true;
    outlineWidth.value = '0.8';
    crossHatch.checked = true;
    colorWash.checked = true;
    colorScheme.value = 'jmol';
    washStrength.value = '100';
    colorSaturation.value = '100';
    labelMatchFill.checked = true;
    labels.checked = false;
    labelHydrogens.checked = true;
    labelSize.value = '17';
    labelFont.value = defaultLabelFont;
    labelColor.value = '#161616';
    labelStrokeWidth.value = '4';
    labelStrokeColor.value = '#ffffff';
    labelBold.checked = false;
    labelItalic.checked = true;
    scheduleRender();
  });

  function safeFilename(value) {
    var safe = String(value).normalize('NFKC')
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/^[.\s-]+|[.\s-]+$/g, '')
      .slice(0, 72)
      .replace(/[.\s-]+$/g, '');
    // Prefix avoids Windows reserved names such as CON or AUX.
    return 'mol-' + (safe || 'molecule') + '.svg';
  }

  download.addEventListener('click', function () {
    if (importLoading || !lastRender || frame !== null) return;
    var snapshot = lastRender;
    var url;
    var link;
    download.disabled = true;
    try {
      // Export is deliberately independent of the displayed preview DOM.
      var svg = engine.render(snapshot.model, Object.assign({}, snapshot.options, { quality: 'export' }));
      if (typeof svg !== 'string' || !/<svg[\s>]/i.test(svg)) {
        throw new Error('渲染器没有返回有效的 SVG。');
      }
      var blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = url;
      link.download = safeFilename(snapshot.filename);
      document.body.appendChild(link);
      link.click();
      error.hidden = true;
      error.textContent = '';
    } catch (cause) {
      error.textContent = 'SVG 导出失败：' + (cause && cause.message ? cause.message : '未知导出错误');
      error.hidden = false;
    } finally {
      if (link) link.remove();
      // Allow the browser to finish opening the download before revoking its URL.
      if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      download.disabled = importLoading || frame !== null || !lastRender;
    }
  });

  preview.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: Number(yaw.value), pitch: Number(pitch.value) };
    preview.setPointerCapture(event.pointerId);
    preview.classList.add('dragging');
    scheduleRender();
    event.preventDefault();
  });
  preview.addEventListener('pointermove', function (event) {
    if (!drag || drag.id !== event.pointerId) return;
    var angle = drag.yaw + (event.clientX - drag.x) * 0.45;
    yaw.value = String(Math.round(((angle + 180) % 360 + 360) % 360 - 180));
    pitch.value = String(Math.round(Math.max(-90, Math.min(90, drag.pitch + (event.clientY - drag.y) * 0.45))));
    scheduleRender();
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    preview.classList.remove('dragging');
    if (preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId);
    scheduleRender();
  }
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
  preview.addEventListener('lostpointercapture', endDrag);

  scheduleRender();
}());
