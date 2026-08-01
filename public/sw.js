/*
 * Service worker for the installed (home-screen) app.
 *
 * Goal: FitRam opens and works in a gym basement with no signal. The app shell - HTML, the JS
 * bundle, icons - is cached on install and served from cache first. Exercise photographs come
 * from an external CDN and are cached opportunistically as you view them.
 *
 * Deliberately simple. There is no user data here to sync: everything the user records lives in
 * localStorage, which the browser persists independently of this cache.
 */

// Bumped by scripts/build-web.mjs on every build so a new deploy replaces the old cache.
const CACHE = 'fitram-__BUILD_ID__';

/*
 * Precache list, injected at build time by scripts/build-web.mjs.
 *
 * The JS bundle's filename is content-hashed, so it cannot be written here by hand - and it
 * cannot be left to the fetch handler either. The service worker only registers on `load`, by
 * which point the browser has already fetched the bundle without it, so nothing would be cached
 * until the *second* visit. Anyone who installed the app and immediately went to a gym with no
 * signal would get a blank screen. Precaching on install fixes that.
 */
const BUILD_ASSETS = __PRECACHE__;

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...BUILD_ASSETS,
];

const PHOTO_HOST = 'raw.githubusercontent.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // A single missing entry must not fail the whole install, so each is added individually.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Exercise photographs: cache on first view, then serve offline forever.
  if (url.hostname === PHOTO_HOST) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copy));
              }
              return response;
            })
            .catch(() => new Response('', { status: 504 })),
      ),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations: always land on the cached shell when offline. expo-router is a single-page
  // app, so every route resolves to the same document.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((hit) => hit ?? caches.match('/'))),
    );
    return;
  }

  // Everything else (the JS bundle, fonts, icons): cache first, since filenames are hashed.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
