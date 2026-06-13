// Minimal service worker - required for "Add to Home Screen" / install prompts on
// Android/Chrome and desktop. Doesn't aggressively cache (so quiz/portal updates
// always show), just satisfies the PWA installability requirement and lets pages
// load offline if previously visited.
const CACHE_NAME = 'quiz-portal-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Network-first, falling back to cache (so updates are picked up immediately
// when online, but pages still open when offline if visited before).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
