// Voda Time Tracker — service worker
// Caches the app shell so it opens instantly and works even with a weak or
// dropped signal. Data itself (entries, jobs, etc.) still needs a live
// connection to sync with the Google Sheet backend — this only makes the
// APP ITSELF available offline, not new data.
//
// v2 (2026-11-05): the app page itself is always fetched with
// cache:'no-store', so a new upload to GitHub shows up on the next open
// instead of the browser quietly re-using an old saved copy. Bumping the
// cache name also clears out every copy saved by the old version.
const CACHE_NAME = 'voda-time-tracker-v2';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never touch calls to the Google Apps Script backend or Job Tracker —
  // that data must always be fresh.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }
  const isAppPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  // App page: always ask GitHub for the newest copy (no browser cache).
  // Other files (icons, manifest): normal network-first.
  const netReq = isAppPage ? new Request(req.url, { cache: 'no-store', credentials: req.credentials }) : req;
  event.respondWith(
    fetch(netReq)
      .then((res) => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          // Saved under the plain address, so the offline copy is found
          // whatever "?..." was on the end of the link
          const key = isAppPage ? './' : req;
          caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
        }
        return res;
      })
      // No signal: fall back to the last saved copy
      .catch(() => caches.match(isAppPage ? './' : req, { ignoreSearch: true }))
  );
});
