'use strict';
(() => {
  const root = document.documentElement;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  // Let CSS request the fonts actually used by the current theme. Eagerly loading
  // an unused heading face delays fonts.ready on every initial navigation.
  let changing = false,
    cancelReveal = null;
  const run = (update, event, trigger, color) => {
    if (changing) return;
    const updateInPlace = () => {
      const before = trigger?.getBoundingClientRect?.();
      const scroll = window.scrollY;
      update();
      // Keep the control under the pointer when a heading font changes its wrapping.
      if (before && Number.isFinite(scroll) && typeof window.scrollTo === 'function') {
        const after = trigger.getBoundingClientRect();
        if (Math.abs(after.top - before.top) > 0.5)
          window.scrollTo({ top: window.scrollY + after.top - before.top, behavior: 'instant' });
      }
    };
    if (document.hidden || motion?.matches || !root.animate || !trigger) {
      updateInPlace();
      return;
    }
    changing = true;
    trigger?.setAttribute('aria-busy', 'true');
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      cancelReveal = null;
      changing = false;
      trigger?.removeAttribute('aria-busy');
    };
    const box = trigger.getBoundingClientRect();
    const pointerClick =
      event.detail > 0 && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
    const x = pointerClick ? event.clientX : box.left + box.width / 2;
    const y = pointerClick ? event.clientY : box.top + box.height / 2;
    const radius =
      Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) * 1.15;
    const from = 'circle(0px at ' + x + 'px ' + y + 'px)';
    const to = 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)';
    let committed = false;
    const commit = () => {
      if (!committed && !ended) {
        committed = true;
        updateInPlace();
      }
    };
    if (document.startViewTransition) {
      try {
        let animation;
        const transition = document.startViewTransition(commit);
        cancelReveal = (commitPending = true) => {
          if (commitPending) commit();
          animation?.cancel();
          transition.skipTransition?.();
          finish();
        };
        const revealed = transition.ready
          .then(() => {
            if (ended) return;
            animation = root.animate(
              { clipPath: [from, to] },
              {
                duration: 1250,
                easing: 'cubic-bezier(.22,.7,.2,1)',
                pseudoElement: '::view-transition-new(root)',
              }
            );
            return animation.finished;
          })
          .catch(() => {
            commit();
          });
        Promise.allSettled([revealed, transition.finished]).then(finish);
      } catch {
        commit();
        finish();
      }
      return;
    }
    // Older browsers receive a colour wave while the actual page updates normally.
    commit();
    const wave = document.createElement('div');
    wave.className = 'theme-color-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.background = color || 'var(--ui-accent)';
    document.body.append(wave);
    const cleanup = () => {
      wave.remove();
      finish();
    };
    let waveAnimation;
    cancelReveal = () => {
      waveAnimation?.cancel();
      cleanup();
    };
    try {
      waveAnimation = wave.animate(
        [
          { clipPath: from, opacity: 0.38 },
          { clipPath: to, opacity: 0.16, offset: 0.75 },
          { clipPath: to, opacity: 0 },
        ],
        { duration: 1250, easing: 'cubic-bezier(.22,.7,.2,1)' }
      );
      waveAnimation.finished.then(cleanup, cleanup);
    } catch {
      cleanup();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelReveal?.();
  });
  addEventListener('pagehide', () => cancelReveal?.());
  addEventListener('pageshow', (event) => { if (event.persisted) cancelReveal?.(); });
  motion?.addEventListener?.('change', () => {
    if (motion.matches) cancelReveal?.();
  });

  window.NysaThemeTransition = {
    run,
    cancel: (commit = false) => cancelReveal?.(commit),
    get changing() {
      return changing;
    },
  };
})();
