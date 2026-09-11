// Voda Time Tracker — service worker
// Caches the app shell so it opens instantly and works even with a weak or
// dropped signal. Data itself (entries, jobs, etc.) still needs a live
// connection to sync with the Google Sheet backend — this only makes the
// APP ITSELF available offline, not new data.
const CACHE_NAME = 'voda-time-tracker-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache calls to the Google Apps Script backend — that data must
  // always be fresh, not served from a stale cache.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }
  // App shell files: try the network first (to pick up updates), fall back
  // to cache if offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
