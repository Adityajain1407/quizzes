// Aditya's Portal — Service Worker
// Strategy: cache the app shell (index.html, manifest, icons) for offline access
// and instant repeat loads. Everything else (quiz HTML files, Firebase calls,
// GitHub API) goes network-first, since that content changes frequently and
// must always reflect the latest version — the cache here is purely a fallback
// for when the network is unavailable.

const CACHE_NAME = 'aditya-portal-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME)
             .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests — everything else (POST to Firebase, etc.) passes through untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin requests (Firebase, GitHub API, fonts, etc.) —
  // let the browser handle those normally so auth/headers work correctly.
  if (url.origin !== self.location.origin) return;

  const isAppShellFile = APP_SHELL.some((path) => {
    const resolved = new URL(path, self.location.origin + self.registration.scope).href;
    return resolved === request.url || request.url === resolved;
  });

  if (isAppShellFile) {
    // App shell: cache-first for instant loads, but refresh the cache in the
    // background so the next launch picks up any update.
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  } else {
    // Everything else same-origin (quiz HTML files, etc.): network-first,
    // falling back to cache only if completely offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
