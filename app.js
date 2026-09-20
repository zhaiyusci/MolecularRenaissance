/* Classic script: works directly from file:// alongside renderer.js. */
(function () {
  'use strict';

  var byId = function (id) { return document.getElementById(id); };
  var i18n = window.MolI18n;
  var t = i18n.t;
  i18n.apply(document);
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
  var rotationGizmo = null;
  var gizmoInteracting = false;
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
  var controlPointer = null;

  // Keep message descriptors, not translated strings, so language changes also
  // update pending imports and errors without rerendering or resetting inputs.
  var notices = new Map();
  var modelOptions = {};
  var displayed = null;
  function paintMessage(node, message) {
    var values = Object.assign({}, message.values);
    if (message.fallback) values.detail = i18n.error(message.cause, message.fallback);
    node.textContent = message.key ? t(message.key, values) : values.detail;
  }
  function message(node, key, values, cause, fallback) {
    var state = { key: key, values: values, cause: cause, fallback: fallback };
    notices.set(node, state);
    paintMessage(node, state);
  }
  function uiError(key) {
    var cause = new Error(key);
    cause.uiKey = key;
    return cause;
  }
  function modelName(key, molecule) {
    if (key === importedKey) return molecule.name || key;
    var name = t('model.' + key);
    return name === 'model.' + key ? (molecule.name || key) : name;
  }
  function localizedModel(key, molecule) {
    return key === importedKey ? molecule : Object.assign({}, molecule, { name: modelName(key, molecule) });
  }
  function updateCaption() {
    if (!displayed) return;
    var name = modelName(displayed.key, displayed.model);
    displayed.root.setAttribute('aria-label', t('status.previewAria', { name: name }));
    var title = displayed.root.querySelector && displayed.root.querySelector('title');
    if (title) title.textContent = name;
    var caption = byId('molecule-caption');
    if (caption) caption.textContent = name;
  }
  byId('language').addEventListener('change', function () {
    i18n.setLocale(byId('language').value);
    i18n.apply(document);
    Object.keys(modelOptions).forEach(function (key) {
      modelOptions[key].textContent = modelName(key, engine.examples[key]);
    });
    if (importedOption) importedOption.textContent = t('model.local', { name: imported.name });
    notices.forEach(function (state, node) { paintMessage(node, state); });
    updateCaption();
    if (rotationGizmo) rotationGizmo.sync();
    byId('render-mode-status').textContent = t(fastOverlay.checked ? 'status.fast' : 'status.precise');
  });
  byId('xyz-choose').addEventListener('click', function () { xyzFile.click(); });
  message(preview, 'status.preparing');
  message(timing, 'status.waiting');
  byId('render-mode-status').textContent = t('status.precise');

  function showError(cause) {
    message(error, null, null, cause, 'error.renderUnknown');
    error.hidden = false;
    message(timing, 'status.incomplete');
    download.disabled = true;
    lastRender = null;
  }

  if (!engine || typeof engine.render !== 'function' || !engine.examples ||
      typeof engine.rotateOrientation !== 'function' || typeof engine.orientationToEulerXYZ !== 'function') {
    message(preview, 'status.engineMissing');
    showError(uiError('error.engineMissing'));
    return;
  }

  function initialOrientation() {
    // Preserve the old default view: Y +25°, then X -15°. No Euler feedback loop.
    return engine.rotateOrientation(engine.rotateOrientation([0, 0, 0, 1], 'y', 25 * Math.PI / 180), 'x', -15 * Math.PI / 180);
  }
  var orientation = initialOrientation();
  if (!window.MolRotationGizmo || typeof window.MolRotationGizmo.create !== 'function') {
    message(preview, 'status.renderFailed');
    showError(uiError('error.gizmoMissing'));
    return;
  }
  rotationGizmo = window.MolRotationGizmo.create({
    root: byId('rotation-gizmo'),
    engine: engine,
    getOrientation: function () { return orientation.slice(); },
    onChange: function (q) { orientation = engine.normalizeOrientation(q); scheduleRender(); },
    onInteraction: function (active) { gizmoInteracting = active; scheduleRender(); }
  });
  byId('rotation-reset').addEventListener('click', function () {
    rotationGizmo.cancel();
    orientation = initialOrientation();
    scheduleRender();
  });

  // Geometric study fixtures remain API-compatible, but are not molecule presets.
  var keys = Object.keys(engine.examples).filter(function (key) {
    return key !== 'sphere' && key !== 'pair';
  });
  if (!keys.length) {
    message(preview, 'status.noExamples');
    showError(uiError('error.noExamples'));
    return;
  }
  keys.forEach(function (key) {
    var option = document.createElement('option');
    option.value = key;
    option.textContent = modelName(key, engine.examples[key]);
    modelOptions[key] = option;
    model.appendChild(option);
  });

  // Keep the local slot separate from the engine's immutable example catalog.
  while (Object.prototype.hasOwnProperty.call(engine.examples, importedKey)) importedKey += '_';

  function setXYZStatus(key, failed, values, cause) {
    message(xyzStatus, key, values, cause, failed ? 'error.readUnknown' : null);
    xyzStatus.setAttribute('data-error', failed ? 'true' : 'false');
  }

  function cancelImport() {
    importRequest += 1;
    if (importLoading) setXYZStatus('status.xyzCancelled', false);
    importLoading = false;
  }

  function parseImport(text, name) {
    if (typeof engine.parseXYZ !== 'function') throw uiError('error.parserMissing');
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
    importedOption.textContent = t('model.local', { name: next.name });
    if (select) model.value = importedKey;
    setXYZStatus('status.xyzLoaded', false, { name: next.name, atoms: next.model.atoms.length, bonds: next.model.bonds.length });
  }

  xyzFile.addEventListener('change', async function () {
    var file = xyzFile.files && xyzFile.files[0];
    xyzFile.value = ''; // Permit choosing the same file again, including after failure.
    if (!file) return;
    var request = ++importRequest;
    importLoading = true;
    download.disabled = true;
    lastRender = null;
    setXYZStatus('status.xyzReading', false, { name: file.name });
    try {
      if (file.size > 2 * 1024 * 1024) throw uiError('error.xyzTooLarge');
      var text = await file.text();
      if (request !== importRequest) return;
      var next = parseImport(text, file.name);
      if (request !== importRequest) return;
      commitImport(next, true);
    } catch (cause) {
      if (request !== importRequest) return;
      setXYZStatus('status.xyzFailed', true, null, cause);
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
    byId('render-mode-status').textContent = t(fastOverlay.checked ? 'status.fast' : 'status.precise');
    byId('scale-value').textContent = scale.value;
    byId('atom-radius-scale-value').textContent = Number(atomRadiusScale.value).toFixed(2) + '×';
    engine.orientationToEulerXYZ(orientation).forEach(function (angle, index) {
      var degrees = Math.round(angle * 1800 / Math.PI) / 10;
      byId('euler-' + ['x', 'y', 'z'][index]).textContent = (degrees === 0 ? 0 : degrees).toFixed(1) + '°';
    });
    if (rotationGizmo) rotationGizmo.sync();
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
    var interacting = !!controlPointer || gizmoInteracting;
    try {
      var options = {
        quality: 'preview',
        renderMode: fastOverlay.checked ? 'fast' : 'precise',
        width: 900,
        height: 700,
        scale: Number(scale.value),
        atomRadiusScale: Number(atomRadiusScale.value),
        orientation: orientation.slice(),
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
      var svg = engine.render(localizedModel(modelKey, molecule), interacting ? Object.assign({}, options, { shadingSize: 0, castShadows: false }) : options);
      if (typeof svg !== 'string' || !/<svg[\s>]/i.test(svg)) {
        throw uiError('error.invalidSVG');
      }
      notices.delete(preview);
      preview.innerHTML = svg;
      var root = preview.querySelector('svg');
      if (!root) throw uiError('error.displaySVG');
      if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', '0 0 900 700');
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      root.setAttribute('role', 'img');
      displayed = { key: modelKey, model: molecule, root: root };
      updateCaption();
      // Keep the successful preview inputs, not its sampled SVG geometry.
      lastRender = interacting || importLoading ? null : { key: modelKey, filename: filename, model: molecule, options: options };
      message(byId('model-info'), 'status.modelInfo', { atoms: molecule.atoms.length, bonds: molecule.bonds.length });
      message(timing, interacting ? 'status.dragTime' : 'status.renderTime', { ms: (performance.now() - start).toFixed(1) });
      error.hidden = true;
      notices.delete(error);
      error.textContent = '';
      download.disabled = interacting || importLoading;
    } catch (cause) {
      displayed = null;
      message(preview, 'status.renderFailed');
      showError(cause);
    }
  }

  function scheduleRender() {
    syncOutputs();
    download.disabled = true;
    if (frame === null) frame = requestAnimationFrame(renderNow);
  }

  [scale, atomRadiusScale, lightAzimuth, lightElevation, lightDistance, lightAttenuation, shadowStrength, textureScale, shadingBrightness, shadingContrast, outlineWidth, washStrength, colorSaturation, labelSize, labelFont, labelColor, labelStrokeWidth, labelStrokeColor].forEach(function (input) {
    input.addEventListener('input', scheduleRender);
  });
  [fastOverlay, shadingEnabled, shadingMode, pointLight, castShadows, variableWidth, crossHatch, colorWash, colorScheme, labelMatchFill, labels, labelHydrogens, labelBold, labelItalic].forEach(function (input) {
    input.addEventListener('change', scheduleRender);
  });

  // Native range inputs keep their own drag/capture behavior. Window release
  // handlers also cover releasing outside the slider. No idle timer/debounce.
  [scale, atomRadiusScale, lightAzimuth, lightElevation, lightDistance, lightAttenuation, shadowStrength, textureScale, shadingBrightness, shadingContrast, outlineWidth, washStrength, colorSaturation, labelSize, labelStrokeWidth].forEach(function (input) {
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
  });

  byId('reset').addEventListener('click', function () {
    cancelImport();
    endControl();
    model.value = keys[0];
    scale.value = '60';
    atomRadiusScale.value = '1';
    orientation = initialOrientation();
    rotationGizmo.cancel();
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
      var svg = engine.render(localizedModel(snapshot.key, snapshot.model), Object.assign({}, snapshot.options, { quality: 'export' }));
      if (typeof svg !== 'string' || !/<svg[\s>]/i.test(svg)) {
        throw uiError('error.invalidSVG');
      }
      var blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = url;
      link.download = safeFilename(snapshot.filename);
      document.body.appendChild(link);
      link.click();
      error.hidden = true;
      notices.delete(error);
      error.textContent = '';
    } catch (cause) {
      message(error, 'status.exportFailed', null, cause, 'error.exportUnknown');
      error.hidden = false;
    } finally {
      if (link) link.remove();
      // Allow the browser to finish opening the download before revoking its URL.
      if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      download.disabled = importLoading || frame !== null || !lastRender;
    }
  });

  scheduleRender();
}());
