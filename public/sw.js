/* Prevì — Service Worker
 *
 * Strategia (app SSR + dati sensibili Supabase/Anthropic):
 *  - Richieste cross-origin (Supabase, Anthropic, storage, ecc.) → mai gestite/cachate.
 *  - Richieste non-GET → mai cachate.
 *  - Navigazioni (HTML) → network-first, fallback alla cache, poi pagina offline.
 *  - Asset statici same-origin → stale-while-revalidate.
 *
 * NB: dati sanitari e risposte API non vengono mai messi in cache.
 */

const VERSION = "v1";
const STATIC_CACHE = `previ-static-${VERSION}`;
const RUNTIME_CACHE = `previ-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// Risorse minime per garantire una schermata offline.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Permette alla pagina di forzare l'attivazione del nuovo SW.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET, solo same-origin: dati API e cross-origin passano direttamente alla rete.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigazioni: network-first con fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          return response;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL));
        }
      })(),
    );
    return;
  }

  // Asset statici: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      return cached || (await network) || Response.error();
    })(),
  );
});
