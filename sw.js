// Service worker for the iPhone web app. scripts/pwa/finalize.mjs fills in
// VERSION and SHELL and writes it to the build as sw.js.
//
// - On install, saves the app itself (SHELL) so it opens with no internet.
// - Pages load from the network when there's a connection (so updates arrive),
//   falling back to the saved app when there isn't.
// - Everything else is answered from what's saved (the app, and the offline
//   map pack the page saves; see src/offline/pwa.ts), else from the network.

const VERSION = 'a5b397ac39af'
const SHELL = [
 "./",
 "apple-touch-icon.png",
 "assets/DocumentViewer-DchbPB1b.js",
 "assets/DocumentViewer-paQgW0Or.css",
 "assets/cursor-editorTextHighlight-kG3uUOwL.svg",
 "assets/index-BXvpNgFN.css",
 "assets/index-BxF0QKHE.js",
 "assets/maplibre-gl-worker-DQ040SI1.js",
 "assets/pdf-BI-fePKm.js",
 "assets/pdf.worker.min-Dkey6ZUl.mjs",
 "assets/pdf_viewer-C3ABEFaE.js",
 "favicon.svg",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "icons/icon-maskable.svg",
 "icons/icon.svg",
 "index.html",
 "manifest.webmanifest",
 "offline/manifest.json",
 "pdfjs/iccs/CGATS001Compat-v2-micro.icc",
 "pdfjs/iccs/LICENSE",
 "pdfjs/standard_fonts/FoxitDingbats.pfb",
 "pdfjs/standard_fonts/FoxitFixed.pfb",
 "pdfjs/standard_fonts/FoxitFixedBold.pfb",
 "pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb",
 "pdfjs/standard_fonts/FoxitFixedItalic.pfb",
 "pdfjs/standard_fonts/FoxitSerif.pfb",
 "pdfjs/standard_fonts/FoxitSerifBold.pfb",
 "pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb",
 "pdfjs/standard_fonts/FoxitSerifItalic.pfb",
 "pdfjs/standard_fonts/FoxitSymbol.pfb",
 "pdfjs/standard_fonts/LICENSE_FOXIT",
 "pdfjs/standard_fonts/LICENSE_LIBERATION",
 "pdfjs/standard_fonts/LiberationSans-Bold.ttf",
 "pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf",
 "pdfjs/standard_fonts/LiberationSans-Italic.ttf",
 "pdfjs/standard_fonts/LiberationSans-Regular.ttf",
 "pdfjs/wasm/jbig2.wasm",
 "pdfjs/wasm/jbig2_nowasm_fallback.js",
 "pdfjs/wasm/openjpeg.wasm",
 "pdfjs/wasm/openjpeg_nowasm_fallback.js",
 "pdfjs/wasm/qcms_bg.wasm"
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
