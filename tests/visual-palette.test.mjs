import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('visual palette updates paused renderers on theme changes without reading layout in frame loops', () => {
  let notify,
    reads = 0,
    changes = 0;
  const root = { dataset: { theme: 'dark' } };
  const values = { '--art-primary': '#bd93f9', '--art-secondary': '#8be9fd' };
  const context = {
    window: {},
    document: { documentElement: root },
    getComputedStyle() {
      reads++;
      return { getPropertyValue: (key) => values[key] || '' };
    },
    MutationObserver: class {
      constructor(fn) {
        notify = fn;
      }
      observe() {}
    },
  };
  vm.runInNewContext(fs.readFileSync('dist/visual-palette.mjs', 'utf8'), context);
  const api = context.window.NysaVisualPalette;
  const unsubscribe = api.subscribe(() => changes++);
  for (let i = 0; i < 1000; i++) assert.equal(api.get().primary, '#bd93f9');
  assert.equal(reads, 1);
  values['--art-primary'] = '#236c82';
  root.dataset.theme = 'light';
  notify();
  assert.equal(changes, 1);
  assert.equal(api.get().light, true);
  assert.equal(api.logoColor('#bd93f9'), '#236c82');
  assert.equal(api.rgba(api.get().primary, 0.4), 'rgba(35,108,130,0.4)');
  assert.equal(api.mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(reads, 2);
  unsubscribe();
  notify();
  assert.equal(changes, 1);
});
