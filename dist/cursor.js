'use strict';
(() => {
  const body = document.body;
  if (!body) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let textTarget = null,
    lastPointer = null,
    textFrame = 0;
  const controls =
    'a,button,summary,select,label[for],[role="button"],input,textarea,[contenteditable],canvas,svg';
  function clearTextCursor() {
    textTarget?.classList.remove('cursor-over-text');
    textTarget = null;
  }
  function findTextTarget() {
    if (!fine.matches || !lastPointer || document.hidden) return null;
    const { x, y } = lastPointer,
      target = document.elementFromPoint(x, y);
    if (!target || target.closest(controls) || getComputedStyle(target).userSelect === 'none')
      return null;
    // Caret APIs can return the nearest text even in whitespace. Check the
    // adjacent characters' rectangles before showing the selection cursor.
    const caret = document.caretPositionFromPoint?.(x, y);
    const fallback = !caret ? document.caretRangeFromPoint?.(x, y) : null;
    const node = caret?.offsetNode || fallback?.startContainer;
    const offset = caret?.offset ?? fallback?.startOffset;
    if (
      !node ||
      node.nodeType !== Node.TEXT_NODE ||
      !node.textContent.trim() ||
      !target.contains(node)
    )
      return null;
    for (const start of [offset - 1, offset]) {
      if (start < 0 || start >= node.length) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + 1);
      const hit = [...range.getClientRects()].some(
        (rect) =>
          rect.width > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
      if (hit) return target;
    }
    return null;
  }
  function updateTextCursor() {
    textFrame = 0;
    const next = findTextTarget();
    if (next !== textTarget) {
      clearTextCursor();
      textTarget = next;
      textTarget?.classList.add('cursor-over-text');
    }
    if (lastPointer && loader.classList.contains('is-visible'))
      loader.style.transform = 'translate3d(' + lastPointer.x + 'px,' + lastPointer.y + 'px,0)';
  }
  function scheduleTextCursor() {
    if (!textFrame) textFrame = requestAnimationFrame(updateTextCursor);
  }
  addEventListener('scroll', scheduleTextCursor, { passive: true, capture: true });
  const leaveText = () => {
    lastPointer = null;
    clearTextCursor();
  };
  document.documentElement.addEventListener('pointerleave', leaveText);
  addEventListener('blur', leaveText);
  document.addEventListener('visibilitychange', leaveText);
  fine.addEventListener('change', leaveText);
  const loader = document.createElement('div');
  loader.className = 'cursor-loader';
  loader.setAttribute('aria-hidden', 'true');
  body.append(loader);
  let pageLoading = document.readyState !== 'complete',
    fontLoading = document.fonts?.status === 'loading',
    operations = 0,
    pointerVisible = false;
  let markedBusy = !!document.querySelector('[aria-busy="true"]');
  let busySince = null, busyTimer = 0;
  const loadingDelay = 300;
  function update() {
    const busy = pageLoading || fontLoading || operations > 0 || markedBusy ||
      document.documentElement.classList.contains('nysa-page-leaving');
    if (busy && busySince === null) {
      busySince = performance.now();
      busyTimer = setTimeout(update, loadingDelay);
    } else if (!busy) {
      clearTimeout(busyTimer);
      busyTimer = 0;
      busySince = null;
    }
    const visible = fine.matches && pointerVisible && !document.hidden && busy &&
      performance.now() - busySince >= loadingDelay;
    if (visible && !loader.classList.contains('is-visible')) scheduleTextCursor();
    loader.classList.toggle('is-visible', visible);
  }
  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' || !fine.matches) {
        lastPointer = null;
        clearTextCursor();
        pointerVisible = false;
        update();
        return;
      }
      lastPointer = { x: event.clientX, y: event.clientY };
      scheduleTextCursor();
      if (!pointerVisible) {
        pointerVisible = true;
        update();
      }
    },
    { passive: true }
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointerVisible = false;
    update();
  });
  addEventListener('blur', () => {
    pointerVisible = false;
    update();
  });
  document.addEventListener('visibilitychange', update);
  fine.addEventListener('change', update);
  addEventListener(
    'load',
    () => {
      pageLoading = false;
      update();
    },
    { once: true }
  );
  if (document.fonts) {
    const settle = () => {
      fontLoading = document.fonts.status === 'loading';
      update();
    };
    document.fonts.addEventListener('loading', settle);
    document.fonts.addEventListener('loadingdone', settle);
    document.fonts.addEventListener('loadingerror', settle);
    document.fonts.ready.then(settle);
  }
  // Observe the stable document node, including when an iframe is navigating.
  new MutationObserver(() => {
    markedBusy = !!document.querySelector('[aria-busy="true"]');
    update();
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class'],
  });
  addEventListener('pageshow', event => {
    if (event.persisted) {
      pageLoading = false;
      fontLoading = document.fonts?.status === 'loading';
      update();
    }
  });
  // Async features can register their real pending promise; rejection still clears busy.
  window.NysaCursor = {
    track: async (promise) => {
      operations++;
      update();
      try {
        return await promise;
      } finally {
        operations--;
        update();
      }
    },
  };
  update();
})();
