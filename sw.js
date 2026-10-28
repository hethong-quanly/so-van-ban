const CACHE = "so-van-ban-v46";
// Danh sách tải sẵn để dùng offline. Khi build lại, cập nhật tên file assets và tăng số phiên bản.
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./offline.html", "./bo-tro.js", "./logo-vks.png",
  "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-192-maskable.png", "./icons/icon-512-maskable.png",
  "./gop-excel.js", "./dong-bo-logic.js", "./dong-bo.js", "./vendor/supabase-2.109.0.js",  "./assets/excel-io-BfiNmI4W.js",  "./assets/index-BLob07XJ.js",  "./assets/index-DGHgmcMf.css",  "./assets/pdf.worker.min-Dswkl-cV.mjs",  "./assets/prepare-file-DTnjt4lC.js",
  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HSMIG81Rb0.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HSMIG86Rb0bcw.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HSMIG87Rb0bcw.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HTEJm81Rb0.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HTEJm86Rb0bcw.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HTEJm87Rb0bcw.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HToIW81Rb0.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HToIW86Rb0bcw.woff2",  "./fonts/QdVMSTAyLFyeg_IDWvOJmVES_HToIW87Rb0bcw.woff2",  "./fonts/QdVPSTAyLFyeg_IDWvOJmVES_Hw3BXo.woff2",  "./fonts/QdVPSTAyLFyeg_IDWvOJmVES_Hw4BXoKZA.woff2",  "./fonts/QdVPSTAyLFyeg_IDWvOJmVES_Hw5BXoKZA.woff2",  "./fonts/cY9AfjOCX1hbuyalUrK4397yjA.woff2",  "./fonts/cY9AfjOCX1hbuyalUrK439DyjJBG.woff2",  "./fonts/cY9AfjOCX1hbuyalUrK439HyjJBG.woff2",  "./fonts/fonts.css",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  // Kho chung Supabase / Gemini: luôn đi mạng, không cache dữ liệu.
  if (/\.supabase\.co$/.test(new URL(request.url).hostname)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await caches.match("./index.html");
          if (home) return home;
          const offline = await caches.match("./offline.html");
          if (offline) return offline;
        }
        return new Response("Không có mạng và chưa lưu trang này.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
