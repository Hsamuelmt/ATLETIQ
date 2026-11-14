// ATLETIQ service worker: cache-first para que funcione sin conexiÃ³n.
const CACHE = 'atletiq-v15';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'atletiq-img' && k !== 'atletiq-state').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Fotos de ejercicios: caché primero para que funcionen sin conexión
  if (e.request.method === 'GET' && u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/free-exercise-db/')) {
    e.respondWith(caches.open('atletiq-img').then(c => c.match(e.request.url).then(r => r || fetch(e.request.url, { mode: 'no-cors' }).then(res => { c.put(e.request.url, res.clone()); return res; }))));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Red primero para la pÃ¡gina (asÃ­ ves actualizaciones), cachÃ© si no hay conexiÃ³n.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
// Recordatorio de racha en segundo plano (Periodic Background Sync: Chrome Android con la app instalada)
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'cal-reminder') return;
  e.waitUntil((async () => {
    const r = await (await caches.open('atletiq-state')).match('state'); if (!r) return;
    const st = await r.json(), now = new Date(), d = now.toISOString().slice(0, 10);
    const [h, m] = (st.time || '08:00').split(':').map(Number);
    if (!st.on || st.done === d || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
    await self.registration.showNotification(st.streak ? `🔥 Racha de ${st.streak} días en juego` : 'Calistenia de hoy',
      { body: 'Dominadas, flexiones, fondos y pierna antes de entrenar.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'atletiq-cal' });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : clients.openWindow('./index.html')));
});
