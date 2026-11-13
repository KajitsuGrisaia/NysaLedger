const root = document.documentElement;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set();
const ease = 'cubic-bezier(.22,.7,.2,1)';
let themeBusy = false, stopTheme = null, themeRevision = 0;
const reduced = () => preference.matches || document.hidden;
root.dataset.motionSupport = typeof root.animate==='function' ? 'web-animations' : 'basic';

function animate(element, frames, options) {
  if (!element?.animate || reduced()) return Promise.resolve();
  try {
    const animation = element.animate(frames, {duration:420,easing:ease,...options});
    running.add(animation);
    return animation.finished.catch(()=>{}).finally(()=>running.delete(animation));
  } catch { return Promise.resolve(); }
}

export function revealView(main) {
  if (reduced()) return;
  // Animate only a newly selected view. Saving, filtering and PWA status updates stay still.
  const heading = main.querySelector('.page-head,.project-hero');
  animate(heading, [{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:480});
  const blocks = [...main.querySelectorAll(':scope > .kpis > .kpi,:scope > .two-col > .panel,:scope > .settings-grid > .panel,:scope > .community-grid > .panel,:scope > .panel,:scope > .intro-strip,:scope > .dropzone')];
  for (const [index, element] of blocks.entries()) animate(element,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:460,delay:Math.min(index*38,190),fill:'backwards'});
}
export function revealDialog(dialog) {
  dialog.getAnimations?.().forEach(a=>a.cancel());
  return animate(dialog,[{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:300});
}
export function dismissDialog(dialog) {
  dialog.getAnimations?.().forEach(a=>a.cancel());
  return animate(dialog,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(6px) scale(.99)'}],{duration:170});
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem('nysa-theme',theme);localStorage.setItem('nysasoft-appearance',theme); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f6f6fb':'#101119');
  const button = document.querySelector('[data-action="theme"]');
  button?.setAttribute('aria-pressed',String(theme==='light'));
  button?.setAttribute('title',theme==='light'?'Activar modo oscuro':'Activar modo claro');
}

export async function changeTheme(event, button) {
  if (themeBusy) return;
  const next = root.dataset.theme==='dark'?'light':'dark';
  if (reduced() || !root.animate) { applyTheme(next); return; }
  themeBusy = true;
  const revision=++themeRevision;
  button.setAttribute('aria-busy','true');
  let committed = false, transition, wave, timeout;
  const commit = () => { if (!committed) { committed=true; applyTheme(next); } };
  const cleanup = () => {
    if(revision!==themeRevision)return;
    clearTimeout(timeout); wave?.remove(); root.classList.remove('theme-revealing','theme-fallback');
    button.removeAttribute('aria-busy'); themeBusy=false; stopTheme=null;
  };
  stopTheme = () => { commit(); transition?.skipTransition?.(); cleanup(); };
  const box=button.getBoundingClientRect();
  const x=event.detail>0?event.clientX:box.left+box.width/2;
  const y=event.detail>0?event.clientY:box.top+box.height/2;
  const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  const clipPath=[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`];
  // Always release the control even if the browser abandons a snapshot.
  timeout=setTimeout(()=>stopTheme?.(),2200);
  try {
    if (document.startViewTransition) {
      root.classList.add('theme-revealing');
      transition=document.startViewTransition(commit);
      await transition.ready;
      if (!themeBusy || reduced()) { transition.skipTransition(); return; }
      await animate(root,{clipPath},{duration:1050,pseudoElement:'::view-transition-new(root)'});
      await transition.finished;
    } else {
      root.classList.add('theme-fallback'); commit();
      wave=document.createElement('div');wave.className='theme-wave';wave.setAttribute('aria-hidden','true');document.body.append(wave);
      await animate(wave,[{opacity:.2,clipPath:clipPath[0]},{opacity:0,clipPath:clipPath[1]}],{duration:650});
    }
  } catch { commit(); transition?.skipTransition?.(); }
  finally { cleanup(); }
}
function settle() {
  for (const animation of running) { try { animation.finish(); } catch { animation.cancel(); } }
  stopTheme?.();
}
preference.addEventListener?.('change',()=>{if(preference.matches)settle();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)settle();});
export function syncTheme() { applyTheme(root.dataset.theme==='light'?'light':'dark'); }
