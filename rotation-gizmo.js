/* Standalone classic script. Quaternions are [x,y,z,w]; angles are radians.
 * Camera: X right, Y up, Z toward viewer. RGB rings rotate MODEL-LOCAL axes
 * (q * delta); the grey screen ring rotates camera Z (delta * q).
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TAU = 2 * Math.PI;
  var CENTER = 120;
  var RADIUS = 76;
  var AXES = {
    x: { normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], color: '#ae3542' },
    y: { normal: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], color: '#26713e' },
    z: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], color: '#2866a5' }
  };

  function multiply(a, b) {
    var x = a[0], y = a[1], z = a[2], w = a[3];
    var X = b[0], Y = b[1], Z = b[2], W = b[3];
    return [w * X + x * W + y * Z - z * Y,
      w * Y - x * Z + y * W + z * X,
      w * Z + x * Y - y * X + z * W,
      w * W - x * X - y * Y - z * Z];
  }

  // Input quaternion must already be normalized.
  function rotateVector(p, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var tx = 2 * (y * p[2] - z * p[1]);
    var ty = 2 * (z * p[0] - x * p[2]);
    var tz = 2 * (x * p[1] - y * p[0]);
    return [p[0] + w * tx + y * tz - z * ty,
      p[1] + w * ty + z * tx - x * tz,
      p[2] + w * tz + x * ty - y * tx];
  }

  function axisDelta(axis, angle) {
    var s = Math.sin(angle / 2), c = Math.cos(angle / 2);
    return axis === 'x' ? [s, 0, 0, c] : axis === 'y' ? [0, s, 0, c] : [0, 0, s, c];
  }

  function angleDelta(next, previous) {
    return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
  }

  function basisFor(axis, q) {
    if (axis === 'screen') return { u: [1, 0, 0], v: [0, 1, 0], radius: 100 };
    return { u: rotateVector(AXES[axis].u, q), v: rotateVector(AXES[axis].v, q), radius: RADIUS };
  }

  function ringPoint(basis, angle) {
    var c = Math.cos(angle), s = Math.sin(angle), r = basis.radius;
    return [r * (basis.u[0] * c + basis.v[0] * s),
      r * (basis.u[1] * c + basis.v[1] * s),
      r * (basis.u[2] * c + basis.v[2] * s)];
  }

  // Returns null in the center deadzone or for an edge-on plane.
  function projectedAngle(basis, point) {
    if (Math.hypot(point[0], point[1]) < 10) return null;
    var u = basis.u, v = basis.v;
    var det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 0.2) return null;
    return Math.atan2((u[0] * point[1] - u[1] * point[0]) / det,
      (point[0] * v[1] - point[1] * v[0]) / det);
  }

  function nearestParameter(basis, point, front) {
    var best = Infinity, result = 0;
    for (var i = 0; i < 360; i++) {
      var t = i * TAU / 360, p = ringPoint(basis, t);
      if (front !== undefined && (p[2] >= 0) !== front && Math.abs(p[2]) > 0.001) continue;
      var d = Math.pow(p[0] - point[0], 2) + Math.pow(p[1] - point[1], 2);
      if (d < best) { best = d; result = t; }
    }
    return result;
  }

  function tangentAt(basis, angle) {
    var s = Math.sin(angle), c = Math.cos(angle), r = basis.radius;
    var tangent = [r * (-basis.u[0] * s + basis.v[0] * c),
      r * (-basis.u[1] * s + basis.v[1] * c)];
    // At a projected tip the exact derivative vanishes. A nearby tangent
    // supplies a deterministic direction; clamping sensitivity avoids jumps.
    if (Math.hypot(tangent[0], tangent[1]) < r * 0.1) {
      s = Math.sin(angle + 0.15); c = Math.cos(angle + 0.15);
      tangent = [r * (-basis.u[0] * s + basis.v[0] * c),
        r * (-basis.u[1] * s + basis.v[1] * c)];
    }
    var length = Math.hypot(tangent[0], tangent[1]);
    var scale = Math.max(length, r * 0.3) / (length || 1);
    return [tangent[0] * scale, tangent[1] * scale];
  }

  function create(options) {
    options = options || {};
    var root = options.root, engine = options.engine;
    if (!root || typeof root.appendChild !== 'function' || !engine ||
        typeof engine.normalizeOrientation !== 'function' || typeof engine.rotateOrientation !== 'function' ||
        typeof options.getOrientation !== 'function' || typeof options.onChange !== 'function') {
      throw new TypeError('MolRotationGizmo.create requires root, engine, getOrientation and onChange');
    }
    var doc = root.ownerDocument || global.document;
    var drag = null, destroyed = false, removers = [], rings = {};
    var notify = typeof options.onInteraction === 'function' ? options.onInteraction : function () {};

    function element(name, attrs, parent) {
      var node = doc.createElementNS(NS, name);
      Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      if (parent) parent.appendChild(node);
      return node;
    }
    function listen(node, type, handler) {
      node.addEventListener(type, handler);
      removers.push(function () { node.removeEventListener(type, handler); });
    }
    function translate(key, fallback) {
      var i18n = global.MolI18n;
      var value = i18n && typeof i18n.t === 'function' ? i18n.t(key) : null;
      return value && value !== key ? value : fallback;
    }
    function normalized(q) { return engine.normalizeOrientation(q).slice(); }

    var svg = element('svg', {
      id: 'rotation-gizmo-svg', viewBox: '0 0 240 240', width: '240', height: '240', role: 'group',
      'data-rotation-gizmo': '', preserveAspectRatio: 'xMidYMid meet'
    });
    svg.style.cssText = 'display:block;width:100%;height:auto;max-width:260px;aspect-ratio:1;touch-action:none;user-select:none;-webkit-user-select:none;background:transparent;outline:none;';
    var rear = element('g', {}, svg);
    var front = element('g', {}, svg);
    var center = element('g', { 'pointer-events': 'none', 'aria-hidden': 'true' }, svg);
    var rearHits = element('g', {}, svg);
    var frontHits = element('g', {}, svg);

    ['x', 'y', 'z', 'screen'].forEach(function (axis) {
      var color = axis === 'screen' ? '#929ba8' : AXES[axis].color;
      var backPath = element('path', { fill: 'none', stroke: color, 'stroke-width': 2,
        opacity: 0.32, 'stroke-dasharray': '3 4', 'pointer-events': 'none' }, rear);
      var frontPath = element('path', { fill: 'none', stroke: color,
        'stroke-width': axis === 'screen' ? 1.8 : 2.8, 'pointer-events': 'none' }, front);
      function hit(parent, isFront) {
        var path = element('path', { fill: 'none', stroke: color, 'stroke-opacity': 0,
          'stroke-width': 15, 'pointer-events': 'stroke', 'data-axis': axis,
          'data-front': String(isFront), tabindex: isFront ? 0 : -1,
          role: 'button', 'aria-hidden': isFront ? 'false' : 'true' }, parent);
        path.style.cursor = 'grab';
        path.style.outline = 'none';
        if (isFront) {
          listen(path, 'focus', function () { path.setAttribute('stroke-opacity', '0.24'); });
          listen(path, 'blur', function () { path.setAttribute('stroke-opacity', '0'); });
        }
        return path;
      }
      rings[axis] = { back: backPath, front: frontPath, backHit: hit(rearHits, false), hit: hit(frontHits, true) };
      if (axis !== 'screen') {
        rings[axis].line = element('line', { x1: CENTER, y1: CENTER, stroke: color, 'stroke-width': 1.8 }, center);
        rings[axis].endpoint = element('circle', { r: 8, fill: color, stroke: 'none' }, center);
        rings[axis].label = element('text', { fill: color, 'font-size': 12, 'font-family': 'sans-serif',
          'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, center);
        rings[axis].label.textContent = axis.toUpperCase();
      }
    });
    element('circle', { cx: CENTER, cy: CENTER, r: 4, fill: '#a5afbd', opacity: 0.8 }, center);

    function paths(basis) {
      var back = '', face = '', previousSide = null;
      // Contiguous sampled runs preserve rear dash patterns. Start a new
      // subpath only when crossing between the front and rear hemispheres.
      for (var i = 0; i < 180; i++) {
        var a = ringPoint(basis, i * TAU / 180), b = ringPoint(basis, (i + 1) * TAU / 180);
        var isFront = a[2] + b[2] >= -0.000001;
        var segment = previousSide !== isFront ?
          'M' + (CENTER + a[0]).toFixed(3) + ' ' + (CENTER - a[1]).toFixed(3) : '';
        segment += 'L' + (CENTER + b[0]).toFixed(3) + ' ' + (CENTER - b[1]).toFixed(3);
        if (isFront) face += segment; else back += segment;
        previousSide = isFront;
      }
      return { back: back, front: face };
    }

    function sync() {
      if (destroyed) return;
      var q = normalized(options.getOrientation());
      svg.setAttribute('aria-label', translate('gizmo.label', 'Molecule rotation'));
      Object.keys(rings).forEach(function (axis) {
        var ring = rings[axis], geometry = paths(basisFor(axis, q));
        ring.back.setAttribute('d', geometry.back);
        ring.front.setAttribute('d', geometry.front);
        ring.backHit.setAttribute('d', geometry.back);
        ring.hit.setAttribute('d', geometry.front);
        var label = translate('gizmo.' + axis, axis === 'screen' ? 'Rotate about screen axis' : 'Rotate about local ' + axis.toUpperCase() + ' axis');
        ring.hit.setAttribute('aria-label', label);
        ring.backHit.setAttribute('aria-label', label);
        ring.hit.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight');
        if (axis === 'screen') return;
        var normal = rotateVector(AXES[axis].normal, q);
        var x = CENTER + 55 * normal[0], y = CENTER - 55 * normal[1];
        ring.line.setAttribute('x2', x); ring.line.setAttribute('y2', y);
        ring.endpoint.setAttribute('cx', x); ring.endpoint.setAttribute('cy', y);
        ring.label.setAttribute('x', CENTER + 71 * normal[0]);
        ring.label.setAttribute('y', CENTER - 71 * normal[1]);
        var opacity = normal[2] < 0 ? 0.5 : 1;
        ring.line.setAttribute('opacity', opacity); ring.endpoint.setAttribute('opacity', opacity);
        ring.label.setAttribute('opacity', opacity);
      });
    }

    // Respect SVG meet/letterboxing as well as CSS scale, rather than assuming
    // one client pixel equals one viewBox unit. Coordinates returned are Y-up.
    function pointerPoint(event) {
      var rect = svg.getBoundingClientRect(), scale = Math.min(rect.width, rect.height) / 240;
      if (!(scale > 0)) return null;
      return [(event.clientX - rect.left - rect.width / 2) / scale,
        -(event.clientY - rect.top - rect.height / 2) / scale];
    }
    function targetAxis(event) {
      var node = event.target;
      return node && typeof node.getAttribute === 'function' ? node.getAttribute('data-axis') : null;
    }
    function change(axis, start, angle) {
      var next = axis === 'screen' ? engine.rotateOrientation(start.slice(), 'z', angle) : multiply(start, axisDelta(axis, angle));
      options.onChange(normalized(next));
      sync();
    }
    function cancel() {
      if (!drag) return;
      var previous = drag;
      drag = null; // Clear before release: lostpointercapture may fire synchronously.
      svg.style.cursor = '';
      try {
        if (svg.hasPointerCapture && svg.hasPointerCapture(previous.id)) svg.releasePointerCapture(previous.id);
      } finally { notify(false); }
    }
    function down(event) {
      var axis = targetAxis(event);
      if (destroyed || drag || !rings[axis] || event.button !== 0 || event.isPrimary === false) return;
      var point = pointerPoint(event);
      if (!point || Math.hypot(point[0], point[1]) < 10) return;
      var q = normalized(options.getOrientation()), basis = basisFor(axis, q);
      var parameter = projectedAngle(basis, point);
      var inverse = Math.abs(basis.u[0] * basis.v[1] - basis.u[1] * basis.v[0]) >= 0.2;
      var hit = nearestParameter(basis, point, event.target.getAttribute('data-front') === 'true');
      event.preventDefault();
      if (typeof rings[axis].hit.focus === 'function') rings[axis].hit.focus({ preventScroll: true });
      drag = { id: event.pointerId, axis: axis, start: q, basis: basis, inverse: inverse,
        angle: parameter, total: 0, point: point, tangent: tangentAt(basis, hit) };
      try {
        svg.setPointerCapture(event.pointerId);
        svg.style.cursor = 'grabbing';
        notify(true);
      } catch (error) { cancel(); throw error; }
    }
    function move(event) {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault();
      if (event.buttons === 0) { cancel(); return; }
      var point = pointerPoint(event);
      if (!point) return;
      var current = drag;
      if (Math.hypot(point[0], point[1]) < 10) {
        current.angle = null; current.point = point;
        return;
      }
      if (current.inverse) {
        var angle = projectedAngle(current.basis, point);
        if (current.angle !== null) current.total += angleDelta(angle, current.angle);
        current.angle = angle;
      } else {
        // Incremental displacement along a frozen projected tangent is stable
        // at edge-on views where inverse projection is singular.
        if (Math.hypot(current.point[0], current.point[1]) >= 10) {
          var t = current.tangent;
          current.total += ((point[0] - current.point[0]) * t[0] + (point[1] - current.point[1]) * t[1]) /
            (t[0] * t[0] + t[1] * t[1]);
        }
      }
      current.point = point;
      try { change(current.axis, current.start, current.total); }
      catch (error) { cancel(); throw error; }
    }
    function finish(event) {
      if (drag && event.pointerId === drag.id) cancel();
    }
    function keydown(event) {
      var axis = targetAxis(event);
      if (destroyed || drag || !rings[axis] || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      var angle = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 15 : 5) * Math.PI / 180;
      try {
        notify(true);
        change(axis, normalized(options.getOrientation()), angle);
      } finally { notify(false); }
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      try { cancel(); }
      finally {
        removers.forEach(function (remove) { remove(); });
        removers = [];
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      }
    }

    // Initialize before mounting so invalid initial orientation leaves no DOM.
    sync();
    listen(svg, 'pointerdown', down);
    listen(svg, 'pointermove', move);
    listen(svg, 'lostpointercapture', finish);
    listen(svg, 'keydown', keydown);
    listen(global, 'pointerup', finish);
    listen(global, 'pointercancel', finish);
    listen(global, 'blur', cancel);
    root.appendChild(svg);
    return { sync: sync, cancel: cancel, destroy: destroy };
  }

  global.MolRotationGizmo = {
    create: create,
    math: { multiply: multiply, rotateVector: rotateVector, axisDelta: axisDelta,
      angleDelta: angleDelta, basisFor: basisFor, ringPoint: ringPoint,
      projectedAngle: projectedAngle, nearestParameter: nearestParameter, tangentAt: tangentAt }
  };
})(window);
