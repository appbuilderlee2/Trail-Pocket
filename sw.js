const APP_VERSION = "4.1.5";
const PREFIX =
  "trail-pocket-shell:" + new URL(self.registration.scope).pathname + ":";
const VERSION = PREFIX + "v" + APP_VERSION;
const ASSETS = [
  "./unified-ui.mjs",
  "./unified-ui-base.mjs",
  "./unified-ui.css",
  "./v41-enhancements.mjs",
  "./heading.mjs",
  "./reliability-core.mjs",
  "./markers.mjs",
  "./hiking-ui.css",
  "./backup.mjs",
  "./package-storage.mjs",
  "./package-manifest.mjs",
  "./package-downloader.mjs",
  "./package-manager.mjs",
  "./package-manager-base.mjs",
  "./package-manager.css",
  "./package-manager-controls.css",
  "./config/sa-index.json",
  "./package-search.mjs",
  "./package-routing.mjs",
  "./sha256.mjs",
  "./vector-map.mjs",
  "./vector-map.css",
  "./outdoor-style.mjs",
  "./pmtiles-opfs.mjs",
  "./wake-lock.mjs",
  "./offline-download.mjs",
  "./offline-search.mjs",
  "./offline-regions.mjs",
  "./routing-core.mjs",
  "./routing-client.mjs",
  "./route-worker.mjs",
  "./offline-package.mjs",
  "./activity.mjs",
  "./activity-core.mjs",
  "./activity.css",
  "./geopdf.mjs",
  "./geopdf-core.mjs",
  "./geopdf-parser.mjs",
  "./geopdf-render.mjs",
  "./geopdf.css",
  "./map-source.css",
  "./vendor/pdf-lib.min.mjs",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
  "./vendor/maplibre-gl.mjs",
  "./vendor/maplibre-gl-shared.mjs",
  "./vendor/maplibre-gl-worker.mjs",
  "./vendor/maplibre-gl.css",
  "./vendor/pmtiles.js",
  "./",
  "./index.html",
  "./style.css",
  "./adventure.css",
  "./explore.css",
  "./explore-core.mjs",
  "./online-map.mjs",
  "./terrain.mjs",
  "./explore.mjs",
  "./explore-base.mjs",
  "./app.mjs",
  "./core.mjs",
  "./storage.mjs",
  "./map.mjs",
  "./adventure.mjs",
  "./adventure-core.mjs",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/devils-route.json",
  "./assets/devils-base.json",
];

function safeBootHtml(response) {
  if (!response) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  return response.text().then((source) => {
    let html = source
      .replaceAll("v4.1.1", "v" + APP_VERSION)
      .replaceAll("V4.1.1", "V" + APP_VERSION)
      .replaceAll("v4.1.0", "v" + APP_VERSION)
      .replaceAll("V4.1.0", "V" + APP_VERSION);
    const normal = '<script type="module" src="./app.mjs"></script>';
    const safe = `<script type="module">
      import('./app.mjs?v=${APP_VERSION}').catch((error) => {
        console.error('Trail Pocket boot failed', error);
        const banner = document.getElementById('banner');
        const version = document.querySelector('.header-status .version');
        if (version) version.textContent = 'v${APP_VERSION}';
        if (banner) {
          banner.classList.remove('hide');
          banner.textContent = 'App 啟動失敗：' + (error?.message || '主程式未能載入') + '。';
          const link = document.createElement('a');
          link.href = './repair.html?t=' + Date.now();
          link.textContent = ' 強制修復 App';
          link.style.fontWeight = '700';
          link.style.marginLeft = '8px';
          banner.append(link);
        }
      });
    </script>`;
    html = html.includes(normal) ? html.replace(normal, safe) : html;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("cache-control", "no-cache");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

self.addEventListener("install", (e) =>
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      c.addAll(
        ASSETS.map(
          (p) =>
            new Request(new URL(p, self.registration.scope), {
              cache: "reload",
            }),
        ),
      ),
    ),
  ),
);

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(PREFIX) && key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("message", (e) => {
  if (e.data?.type === "UPDATE") self.skipWaiting();
  if (e.data?.type === "STATUS")
    e.waitUntil(
      (async () => {
        const c = await caches.open(VERSION);
        const ok = (
          await Promise.all(
            ASSETS.map((p) =>
              c.match(new URL(p, self.registration.scope).href),
            ),
          )
        ).every(Boolean);
        e.ports[0]?.postMessage({ ready: ok, version: VERSION });
      })(),
    );
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== self.location.origin ||
    !u.href.startsWith(self.registration.scope)
  )
    return;

  if (u.pathname.endsWith("/repair.html")) return;

  const allowed = ASSETS.map(
    (p) => new URL(p, self.registration.scope).pathname,
  );
  if (!allowed.includes(u.pathname) && e.request.mode !== "navigate") return;

  e.respondWith(
    (async () => {
      const c = await caches.open(VERSION);
      if (e.request.mode === "navigate") {
        let page = null;
        if (u.searchParams.has("recover")) {
          try {
            const fresh = await fetch(new Request(e.request, { cache: "reload" }));
            if (fresh.ok) page = fresh;
          } catch {}
        }
        if (!page) {
          page =
            (await c.match(e.request, { ignoreSearch: true })) ||
            (await c.match(new URL("./index.html", self.registration.scope).href));
        }
        if (!page) {
          try {
            page = await fetch(e.request);
          } catch {}
        }
        return safeBootHtml(page);
      }

      const cached = await c.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(e.request);
    })(),
  );
});
