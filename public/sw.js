// Minimal service worker (SPEC.md section 10: "PWA ... หน้า offline พื้นฐาน").
// Only job: cache the offline fallback page and serve it when a navigation
// request fails because there's no network. No asset precaching/runtime
// caching strategy beyond that -- out of scope for this MVP.
const CACHE_NAME = "changdee-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_URL)),
    ),
  );
});
