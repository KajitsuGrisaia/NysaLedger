// Cache only public application files. Documents and backups never enter this cache.
const CACHE = 'nysaledger-shell-v45';
const FILES = ['./visual-palette.mjs','./workflow.mjs','./assets/kofi.png','./appearance-init.js','./appearance.mjs','./appearance.css','./cursor.js','./cursor.css','./assets/cursors/cursor-dracula-link.svg','./assets/cursors/cursor-dracula.svg','./assets/cursors/cursor-light-link.svg','./assets/cursors/cursor-light.svg','./', './index.html', './style.css', './app.mjs', './xml.mjs', './ledger.mjs', './storage.mjs', './demo.mjs', './project.mjs', './community.mjs', './pwa.mjs', './motion.mjs', './ledger-scene.mjs', './logo-geometry.mjs', './assets/symbol-geometry.svg', './assets/symbol-details.svg', './manifest.webmanifest', './assets/favicon.png', './assets/ecuador.svg', './assets/symbol.svg', './assets/symbol-animated.svg', './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png'];
const urls = new Set(FILES.map(file => new URL(file, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('nysaledger-shell-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.hash = '';
  // Appearance-only links may use the public shell offline; never cache arbitrary queries.
  if(url.search){
    for(const [key,value] of url.searchParams){
      if(key==='design'&&['orbit','aurora','terminal','eclipse'].includes(value))continue;
      if(key==='mode'&&['light','dark'].includes(value))continue;
      return;
    }
    url.search='';
  }
  if (!urls.has(url.href)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(url.href);
    return cached || fetch(request);
  })());
});
