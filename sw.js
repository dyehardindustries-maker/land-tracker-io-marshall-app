// Service worker for the iPhone web app. scripts/pwa/finalize.mjs fills in
// VERSION and SHELL and writes it to the build as sw.js.
//
// - On install, saves the app itself (SHELL) so it opens with no internet.
// - Pages load from the network when there's a connection (so updates arrive),
//   falling back to the saved app when there isn't.
// - Everything else is answered from what's saved (the app, and the offline
//   map pack the page saves; see src/offline/pwa.ts), else from the network.

const VERSION = '2d2c3e51eedd'
const SHELL = [
 "./",
 "apple-touch-icon.png",
 "assets/index-Bj7KFN5e.js",
 "assets/index-aCy79iJ1.css",
 "assets/maplibre-gl-worker-DQ040SI1.js",
 "favicon.svg",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "icons/icon-maskable.svg",
 "icons/icon.svg",
 "index.html",
 "manifest.webmanifest",
 "offline/manifest.json"
]
const SHELL_CACHE = `land-tracker-marshall-shell-${VERSION}`
const PAGE_TIMEOUT_MS = 6000

const scopeUrl = (path) => new URL(path, self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await cache.addAll(SHELL.map((path) => new Request(scopeUrl(path), { cache: 'reload' })))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('land-tracker-marshall-shell-') && key !== SHELL_CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

function fetchWithTimeout(request, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetchWithTimeout(request, PAGE_TIMEOUT_MS)
        } catch {
          const cache = await caches.open(SHELL_CACHE)
          return (await cache.match(scopeUrl('./'))) ?? (await cache.match(scopeUrl('index.html'))) ?? Response.error()
        }
      })(),
    )
    return
  }

  // The page asks for a fresh copy when it saves the offline map.
  if (request.cache === 'reload') return

  event.respondWith(
    (async () => (await caches.match(request)) ?? fetch(request))(),
  )
})
