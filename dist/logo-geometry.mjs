// Generated from the Nysasoft logo renderer.
const root=globalThis;
  // The approved SVG is the geometry source, including its gradients and details.
  // Directional light separates the faces; narrow reflections preserve the SVG saturation.
  function shadeColor(value, normal, side = false, bevel = false, reflectionTint = null) {
    const match = /^#([a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.exec(value);
    if (!match) return value;
    let hex = match[1];
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [x, y, z] = normal;
    const key = Math.max(0, -0.4 * x - 0.55 * y + 0.72 * z);
    const fill = Math.max(0, 0.48 * x - 0.2 * y - 0.72 * z);
    const light = Math.min(1, 0.32 + key * 0.5 + fill * 0.32);
    const facing = Math.min(1, Math.abs(z));
    const specular = Math.min(1, Math.max(0, 0.34 * x - 0.26 * y + 0.9 * facing)) ** 24;
    const brightness = bevel
      ? 0.78 + light * 0.25 + specular * 0.12
      : side
        ? 0.52 + light * 0.3
        : 0.78 + light * 0.3;
    const pink = Math.max(0, Math.min(1, (x + 1) / 2));
    const tint = reflectionTint || [139 + 116 * pink, 233 - 112 * pink, 253 - 55 * pink];
    const reflection = 0.008 + (1 - facing) * 0.012 + specular * (bevel ? 0.06 : 0.012);
    const result = rgb.map((channel, i) =>
      Math.round(
        Math.max(0, Math.min(255, channel * brightness * (1 - reflection) + tint[i] * reflection))
      )
    );
    const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    return 'rgba(' + result.join(',') + ',' + alpha + ')';
  }
  function parsePath(d) {
    const tokens = d.match(/[MLHVZmlhvz]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];
    const contours = [];
    let points = [],
      x = 0,
      y = 0,
      sx = 0,
      sy = 0,
      command = '',
      i = 0;
    const finish = (closed) => {
      if (points.length > 1) contours.push({ points, closed });
      points = [];
    };
    while (i < tokens.length) {
      if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
      const relative = command === command.toLowerCase(),
        kind = command.toUpperCase();
      if (kind === 'Z') {
        finish(true);
        x = sx;
        y = sy;
        command = '';
        continue;
      }
      if (!command) throw Error('Unsupported SVG path');
      if (kind === 'M' || kind === 'L') {
        const nx = Number(tokens[i++]),
          ny = Number(tokens[i++]);
        if (kind === 'M') finish(false);
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        if (kind === 'M') {
          sx = x;
          sy = y;
          command = relative ? 'l' : 'L';
        }
      } else if (kind === 'H') {
        const value = Number(tokens[i++]);
        x = relative ? x + value : value;
      } else if (kind === 'V') {
        const value = Number(tokens[i++]);
        y = relative ? y + value : value;
      } else throw Error('Unsupported SVG path command');
      points.push([x, y]);
    }
    finish(false);
    return contours;
  }
  function settle(rotation, elapsed) {
    const decay = Math.exp(-7 * Math.min(elapsed, 0.05));
    rotation.x *= decay;
    rotation.y *= decay;
    if (Math.abs(rotation.x) < 0.001) rotation.x = 0;
    if (Math.abs(rotation.y) < 0.001) rotation.y = 0;
    return rotation.x !== 0 || rotation.y !== 0;
  }
  function inset(points, amount) {
    const area = points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
      sign = area >= 0 ? 1 : -1;
    return points.map((p, i) => {
      const prev = points[(i + points.length - 1) % points.length],
        next = points[(i + 1) % points.length];
      const a = [p[0] - prev[0], p[1] - prev[1]],
        b = [next[0] - p[0], next[1] - p[1]],
        al = Math.hypot(...a) || 1,
        bl = Math.hypot(...b) || 1;
      const u = [p[0] - (a[1] / al) * amount * sign, p[1] + (a[0] / al) * amount * sign],
        v = [p[0] - (b[1] / bl) * amount * sign, p[1] + (b[0] / bl) * amount * sign];
      const cross = a[0] * b[1] - a[1] * b[0];
      if (Math.abs(cross) < 1e-8) return u;
      const t = ((v[0] - u[0]) * b[1] - (v[1] - u[1]) * b[0]) / cross,
        dx = u[0] + a[0] * t - p[0],
        dy = u[1] + a[1] * t - p[1],
        length = Math.hypot(dx, dy),
        limit = Math.min(1, (amount * 3) / (length || 1));
      return [p[0] + dx * limit, p[1] + dy * limit];
    });
  }
  function create(source) {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    if (svg.querySelector('parsererror')) throw Error('Invalid logo SVG');
    const faces = [],
      circuits = [],
      auraNode = svg.querySelector('circle[fill="url(#aura)"]');
    const aura = auraNode
      ? {
          x: Number(auraNode.getAttribute('cx')) - 256,
          y: Number(auraNode.getAttribute('cy')) - 256,
          r: Number(auraNode.getAttribute('r')),
        }
      : null;
    const orbNode = svg.querySelector('circle[fill="url(#orb)"]');
    const orb = orbNode
      ? {
          x: Number(orbNode.getAttribute('cx')) - 256,
          y: Number(orbNode.getAttribute('cy')) - 256,
          r: Number(orbNode.getAttribute('r')),
        }
      : null;
    const attr = (node, name, fallback) => {
      for (let n = node; n && n !== svg.parentElement; n = n.parentElement) {
        if (n.hasAttribute(name)) return n.getAttribute(name);
      }
      return fallback;
    };
    const paint = (value) => {
      if (!value || value === 'none') return null;
      if (!value.startsWith('url(')) return { color: value };
      const gradient = svg.querySelector(value.slice(4, -1));
      if (!gradient || gradient.localName !== 'linearGradient') return null;
      return {
        from: [Number(gradient.getAttribute('x1')), Number(gradient.getAttribute('y1'))],
        to: [Number(gradient.getAttribute('x2')), Number(gradient.getAttribute('y2'))],
        stops: [...gradient.querySelectorAll('stop')].map((stop) => [
          parseFloat(stop.getAttribute('offset') || '0') /
            ((stop.getAttribute('offset') || '0').includes('%') ? 100 : 1),
          stop.getAttribute('stop-color'),
        ]),
      };
    };
    function extrude(points, material, depth) {
      if(activeTransform)points=points.map(([x,y])=>[x*activeTransform.scale+activeTransform.x,y*activeTransform.scale+activeTransform.y]);
      if (points.length < 3 || !material) return;
      const orientation =
        Math.sign(
          points.reduce((sum, [x, y], i) => {
            const q = points[(i + 1) % points.length];
            return sum + x * q[1] - q[0] * y;
          }, 0)
        ) || 1;
      const bevel = depth >= 30 ? 2.5 : 0,
        inner = bevel ? inset(points, bevel) : points;
      const at = (outline, z) => outline.map(([x, y]) => [x - 256, y - 256, z]);
      const front = at(inner, depth / 2),
        back = at(inner, -depth / 2),
        rim = at(points, depth / 2 - bevel),
        rear = at(points, -depth / 2 + bevel);
      faces.push(
        { points: front, material, side: false, normal: [0, 0, 1] },
        { points: back, material, side: false, normal: [0, 0, -1] }
      );
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length,
          dx = points[j][0] - points[i][0],
          dy = points[j][1] - points[i][1],
          len = Math.hypot(dx, dy) || 1;
        const normal = [(orientation * dy) / len, (-orientation * dx) / len, 0];
        faces.push({ points: [rear[i], rear[j], rim[j], rim[i]], material, side: true, normal });
        if (bevel)
          faces.push(
            {
              points: [rim[i], rim[j], front[j], front[i]],
              material,
              side: true,
              bevel: true,
              normal: [normal[0] * 0.707, normal[1] * 0.707, 0.707],
            },
            {
              points: [back[i], back[j], rear[j], rear[i]],
              material,
              side: true,
              bevel: true,
              normal: [normal[0] * 0.707, normal[1] * 0.707, -0.707],
            }
          );
      }
    }
    let activeTransform=null;
    for (const node of svg.querySelectorAll('path,circle')) {
      const transform=node.closest('[transform]')?.getAttribute('transform')||'';
      const translate=transform.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
      const scale=transform.match(/scale\(([-\d.]+)\)/);
      activeTransform=translate?{x:Number(translate[1]),y:Number(translate[2]),scale:Number(scale?.[1]||1)}:null;
      if (node.closest('defs')) continue;
      const fill = paint(attr(node, 'fill', '#000')),
        stroke = paint(attr(node, 'stroke', 'none')),
        width = Number(attr(node, 'stroke-width', '1'));
      if (node.localName === 'circle') {
        const x = Number(node.getAttribute('cx')),
          y = Number(node.getAttribute('cy')),
          r = Number(node.getAttribute('r'));
        if (node === orbNode) {
          // A sphere, rather than an extruded disk: every viewing angle has a round silhouette.
          const at = (latitude, longitude) => [
            x - 256 + r * Math.sin(latitude) * Math.cos(longitude),
            y - 256 + r * Math.cos(latitude),
            r * Math.sin(latitude) * Math.sin(longitude),
          ];
          // At its on-page radius (~5px), this sphere needs no subpixel facets.
          for (let row = 0; row < 8; row++)
            for (let column = 0; column < 16; column++) {
              const a = (row * Math.PI) / 8,
                b = ((row + 1) * Math.PI) / 8;
              const c = (column * Math.PI) / 8,
                d = ((column + 1) * Math.PI) / 8;
              const middle = at((a + b) / 2, (c + d) / 2);
              faces.push({
                points: [at(a, c), at(a, d), at(b, d), at(b, c)],
                material: { color: '#bd93f9' },
                side: false,
                normal: [(middle[0] - x + 256) / r, (middle[1] - y + 256) / r, middle[2] / r],
              });
            }
          continue;
        }
        if (!fill && !stroke) continue;
        const point = (a, radius) => [x + Math.cos(a) * radius, y + Math.sin(a) * radius];
        if (fill)
          extrude(
            Array.from({ length: 32 }, (_, i) => point((i / 32) * Math.PI * 2, r)),
            fill,
            12
          );
        if (stroke)
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2,
              b = ((i + 1) / 16) * Math.PI * 2;
            extrude(
              [
                point(a, r - width / 2),
                point(b, r - width / 2),
                point(b, r + width / 2),
                point(a, r + width / 2),
              ],
              stroke,
              6
            );
          }
      } else {
        for (const contour of parsePath(node.getAttribute('d'))) {
          if (fill && contour.closed)
            extrude(contour.points, fill, ['url(#left)','url(#right)'].includes(node.getAttribute('fill')) && !activeTransform ? 32 : node.getAttribute('d')?.startsWith('M218 314') ? 2 : node.getAttribute('fill') === '#22212c' || node.parentElement?.getAttribute('fill') === '#22212c' ? 12 : 9);
          if (stroke) {
            const points = contour.closed ? [...contour.points, contour.points[0]] : contour.points;
            if(!activeTransform)circuits.push(points);
            for (let i = 1; i < points.length; i++) {
              const a = points[i - 1],
                b = points[i],
                length = Math.hypot(b[0] - a[0], b[1] - a[1]);
              if (!length) continue;
              const dx = ((-(b[1] - a[1]) / length) * width) / 2,
                dy = (((b[0] - a[0]) / length) * width) / 2;
              extrude(
                [
                  [a[0] + dx, a[1] + dy],
                  [b[0] + dx, b[1] + dy],
                  [b[0] - dx, b[1] - dy],
                  [a[0] - dx, a[1] - dy],
                ],
                stroke,
                6
              );
            }
          }
        }
      }
    }
    let baseCanvas = null,
      baseKey = '';
    function draw(ctx, width, height, rotation, time = 0) {
      if (width <= 0 || height <= 0) return;
      ctx.clearRect(0, 0, width, height);
      const theme = root.NysaVisualPalette;
      const palette = theme?.get();
      const color = (value) => (theme ? theme.logoColor(value) : value);
      const alpha = (value, opacity) => {
        const channels = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
        return 'rgba(' + channels.join(',') + ',' + opacity + ')';
      };
      const scale = Math.min(width, height) / 700,
        cx = width / 2,
        cy = height / 2;
      const cosX = Math.cos(rotation.x),
        sinX = Math.sin(rotation.x),
        cosY = Math.cos(rotation.y),
        sinY = Math.sin(rotation.y);
      const rotate = ([x, y, z]) => {
        const rx = x * cosY + z * sinY,
          rz = -x * sinY + z * cosY;
        return [rx, y * cosX - rz * sinX, y * sinX + rz * cosX];
      };
      const project = (point) => {
        const [x, y, z] = rotate(point),
          perspective = 900 / (900 - z);
        return [cx + x * scale * perspective, cy + y * scale * perspective, z];
      };
      const dpr = ctx.canvas.width / width,
        key = [width, height, rotation.x, rotation.y, dpr, palette?.revision || 0].join(':');
      if (key !== baseKey) {
        baseCanvas = baseCanvas || document.createElement('canvas');
        baseCanvas.width = ctx.canvas.width;
        baseCanvas.height = ctx.canvas.height;
        const baseCtx = baseCanvas.getContext('2d');
        baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintBase(baseCtx);
        baseKey = key;
      }
      ctx.drawImage(baseCanvas, 0, 0, width, height);
      // A slow, occasional glint; keep the static geometry cache intact.
      // time=0 keeps a static pose while still receiving the current palette.
      const exposure = Math.max(0, Math.min(1, (cosX * cosY - 0.05) / 0.4));
      const frontVisibility = exposure * exposure * (3 - 2 * exposure);
      const pulsePhase = ((time % 10500) - 6500) / 2700;
      if (orb && time > 0 && pulsePhase > 0 && pulsePhase < 1) {
        const power = Math.sin(pulsePhase * Math.PI) ** 2,
          p = project([orb.x, orb.y, 0]);
        const radius = (orb.r * scale * 900) / (900 - p[2]),
          spread = radius * (3 + power * 0.5);
        ctx.save();
        const glow = ctx.createRadialGradient(p[0], p[1], radius * 0.4, p[0], p[1], spread);
        glow.addColorStop(0, alpha(palette?.fg || '#f8f8f2', power * 0.25));
        glow.addColorStop(0.4, alpha(palette?.primary || '#bd93f9', power * 0.1));
        glow.addColorStop(1, alpha(palette?.primary || '#bd93f9', 0));
        ctx.fillStyle = glow;
        ctx.fillRect(p[0] - spread, p[1] - spread, spread * 2, spread * 2);
        ctx.globalAlpha = power * 0.48;
        ctx.fillStyle = palette?.fg || '#f8f8f2';
        ctx.beginPath();
        ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      function paintBase(ctx) {
        if (aura) {
          const p = project([aura.x, aura.y, 6]),
            radius = aura.r * scale,
            glow = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], radius);
          glow.addColorStop(0, alpha(palette?.primary || '#bd93f9', 0.12));
          glow.addColorStop(1, alpha(palette?.primary || '#bd93f9', 0));
          ctx.fillStyle = glow;
          ctx.fillRect(p[0] - radius, p[1] - radius, radius * 2, radius * 2);
        }
        const sorted = faces
          .map((face) => {
            const center = rotate(
              face.points.reduce(
                (sum, p) => sum.map((v, i) => v + p[i] / face.points.length),
                [0, 0, 0]
              )
            );
            return { face, center, normal: rotate(face.normal) };
          })
          .filter(
            ({ center, normal }) =>
              -normal[0] * center[0] - normal[1] * center[1] + normal[2] * (900 - center[2]) > 0.001
          )
          .map((entry) => ({ ...entry, points: entry.face.points.map(project) }))
          .sort((a, b) => a.center[2] - b.center[2]);
        // Cast only the main silhouette shadows, once per cached pose.
        ctx.save();
        ctx.shadowColor = alpha(palette?.shadow || '#282a36', palette?.light ? 0.22 : 0.62);
        ctx.shadowBlur = 13 * scale;
        ctx.shadowOffsetX = 5 * scale;
        ctx.shadowOffsetY = 9 * scale;
        ctx.fillStyle = alpha(palette?.shadow || '#282a36', 0.22);
        for (const { face, points, normal } of sorted) {
          if (face.side || !face.material.stops || normal[2] <= 0) continue;
          ctx.beginPath();
          points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        for (const { face, points, normal } of sorted) {
          ctx.beginPath();
          points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          const shade = (value) =>
            shadeColor(
              color(value),
              normal,
              face.side,
              face.bevel,
              theme ? theme.rgb(palette.secondary) : null
            );
          if (face.material.color) ctx.fillStyle = shade(face.material.color);
          else {
            const depth =
              face.points.reduce((sum, point) => sum + point[2], 0) / face.points.length;
            const a = project([...face.material.from.map((v) => v - 256), depth]),
              b = project([...face.material.to.map((v) => v - 256), depth]);
            const gradient = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
            face.material.stops.forEach(([offset, color]) =>
              gradient.addColorStop(offset, shade(color))
            );
            ctx.fillStyle = gradient;
          }
          ctx.fill();
          // Cover antialiasing cracks with the surface's own paint, never a wire outline.
          // The width is in physical pixels and stays small at every display density.
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineJoin = 'round';
          ctx.lineWidth = 0.65 / dpr;
          ctx.stroke();
        }
      }
      // Short light packets follow the source SVG wiring and rotate with its front.
      if (time > 0 && frontVisibility > 0) {
        ctx.save();
        ctx.globalAlpha = frontVisibility;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 3;
        ctx.shadowColor = palette?.secondary || '#8be9fd';
        circuits.forEach((route, index) => {
          const lengths = route
            .slice(1)
            .map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
          const total = lengths.reduce((a, b) => a + b, 0),
            head = ((time / 4200 + index * 0.23) % 1) * (total + 24) - 12;
          let distance = 0;
          route.slice(1).forEach((b, i) => {
            const a = route[i],
              length = lengths[i];
            if (!length) return;
            const start = Math.max(0, head - 11 - distance),
              end = Math.min(length, head - distance);
            if (end > start) {
              const at = (t) =>
                project([
                  a[0] + ((b[0] - a[0]) * t) / length - 256,
                  a[1] + ((b[1] - a[1]) * t) / length - 256,
                  4,
                ]);
              const p = at(start),
                q = at(end);
              ctx.strokeStyle =
                index % 2 ? palette?.tertiary || '#ff79c6' : palette?.secondary || '#8be9fd';
              ctx.lineWidth = 1.8 * scale;
              ctx.beginPath();
              ctx.moveTo(p[0], p[1]);
              ctx.lineTo(q[0], q[1]);
              ctx.stroke();
            }
            distance += length;
          });
        });
        ctx.restore();
      }
    }
    return { draw };
  }

export {create,settle,parsePath,inset,shadeColor};
