let installPrompt = null, registration = null, ready = false;
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export function pwaState() { return { installed: installed(), canPrompt: !!installPrompt, offlineReady: ready, updateReady: !!registration?.waiting, supported: 'serviceWorker' in navigator && isSecureContext }; }
const notify = () => document.dispatchEvent(new CustomEvent('nysa:pwa-state'));
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; notify(); });
window.addEventListener('appinstalled', () => { installPrompt = null; notify(); });
export async function requestInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt; installPrompt = null;
  await prompt.prompt(); await prompt.userChoice; notify(); return true;
}
export function applyUpdate() { registration?.waiting?.postMessage({type: 'ACTIVATE_UPDATE'}); }
export async function preparePwa() {
  if (!pwaState().supported) return;
  try {
    registration = await navigator.serviceWorker.register('./sw.mjs', {scope: './', type: 'module', updateViaCache: 'none'});
    const watchInstall = () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed' || worker.state === 'activated') notify(); });
    };
    registration.addEventListener('updatefound', watchInstall);
    watchInstall();
    const active = await navigator.serviceWorker.ready;
    ready = !!active.active; notify();
    // Never reload automatically: an import or a form may be in progress.
    navigator.serviceWorker.addEventListener('controllerchange', notify);
  } catch { ready = false; notify(); }
}
