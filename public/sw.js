// Bunny's Home · Service Worker
const CACHE_NAME = 'bunny-cache-v1';

const PRECACHE = ['/', '/index.html', '/manifest.json', '/bunny.svg', '/bunny-192.png', '/bunny-512.png'];

// 安装：预缓存核心文件
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

// 请求：缓存优先（静态资源），网络优先（API）
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

  // 静态资源：缓存优先，网络回退
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
