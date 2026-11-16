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
export async function preparePwa({canUpdate=()=>false,onUpdate=()=>location.reload()}={}) {
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
    // All tabs must be idle before activating a new shell: never interrupt a form or import.
    const idle=()=>canUpdate()&&!document.hidden;
    let updating=false,needsReload=false,hadController=!!navigator.serviceWorker.controller;
    const attempt=async()=>{
      if(needsReload&&idle()){needsReload=false;onUpdate();return;}
      if(updating||!registration.waiting||!idle())return;
      if(!navigator.locks)return; // Older browsers keep the explicit update action.
      await navigator.locks.request('nysaledger-work',{mode:'exclusive',ifAvailable:true},lock=>{if(!lock||!idle())return;updating=true;applyUpdate();});
    };
    navigator.serviceWorker.addEventListener('controllerchange',()=>{needsReload=hadController;hadController=true;notify();if(needsReload&&idle()){needsReload=false;onUpdate();}});
    document.addEventListener('nysa:pwa-state',attempt);
    document.addEventListener('nysa:idle',attempt);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){registration.update().catch(()=>{});attempt();}});
    setInterval(attempt,15000);
    attempt();
  } catch { ready = false; notify(); }
}
