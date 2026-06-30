// Bunny's Home · Service Worker
const CACHE_NAME = 'bunny-cache-v2'; // bump version to force cache refresh

const PRECACHE = ['/manifest.json', '/bunny.svg', '/bunny-192.png', '/bunny-512.png'];

// 安装：预缓存核心资源（不含 HTML — HTML 走网络优先）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求策略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 跳过非 HTTP(S) 请求（chrome-extension:// 等）
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API 请求走网络，不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML 文档：网络优先，网络失败时才用缓存（防止白屏）
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 静态资源（JS/CSS/图片）：缓存优先，网络回退
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});
