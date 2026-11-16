'use strict';
(() => {
  // Resolve CSS once per appearance change, shared by Canvas and WebGL scenes.
  const root = document.documentElement;
  const listeners = new Set();
  const fallback = {
    purple: '#bd93f9',
    pink: '#ff79c6',
    cyan: '#8be9fd',
    green: '#50fa7b',
    fg: '#f8f8f2',
    muted: '#b4b8cc',
    primary: '#bd93f9',
    secondary: '#8be9fd',
    tertiary: '#ff79c6',
    rock: '#b4b8cc',
    shadow: '#282a36',
  };
  let palette,
    revision = 0;
  const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const rgba = (color, alpha) => 'rgba(' + rgb(color).join(',') + ',' + alpha + ')';
  const mix = (a, b, amount) => {
    const A = rgb(a),
      B = rgb(b);
    return (
      '#' +
      A.map((v, i) =>
        Math.round(v + (B[i] - v) * amount)
          .toString(16)
          .padStart(2, '0')
      ).join('')
    );
  };
  function update() {
    const css = getComputedStyle(root);
    const next = {};
    for (const name of Object.keys(fallback)) {
      const token = ['primary', 'secondary', 'tertiary', 'rock', 'shadow'].includes(name)
        ? '--art-' + name
        : '--' + name;
      const value = css.getPropertyValue(token).trim();
      next[name] = /^#[a-f\d]{6}$/i.test(value) ? value : fallback[name];
    }
    next.light = root.dataset.theme === 'light';
    next.revision = ++revision;
    palette = next;
    for (const listener of listeners) listener(palette);
  }
  const logoKeys = { '#bd93f9': 'primary', '#8be9fd': 'secondary', '#ff79c6': 'tertiary', '#e78acb':'tertiary', '#ef8fd0':'tertiary' };
  window.NysaVisualPalette = {
    get: () => palette,
    rgb,
    rgba,
    mix,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    logoColor(color) {
      return palette[logoKeys[color.toLowerCase()]] || color;
    },
  };
  update();
  new MutationObserver(update).observe(root, {
    attributes: true,
    attributeFilter: ['data-design', 'data-theme'],
  });
})();
