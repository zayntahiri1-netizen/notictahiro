/**
 * sw.js — عامل خدمة بسيط لتمكين الوضع دون اتصال لـ Notic Tahiro
 *
 * استراتيجية stale-while-revalidate لكل أصول التطبيق:
 *  • التحميل من الذاكرة المخبّأة فوراً (سرعة).
 *  • تحديث الذاكرة من الشبكة في الخلفية (طزاجة).
 *  • عند الانقطاع: الذاكرة المخبّأة تواصل العمل.
 */

const CACHE = 'notic-tahiro-v3';
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // نتجاهل طلبات الإعلانات والتحليلات والـ API (الشبكة فقط — لا كاش لردود AI)
  const url = new URL(req.url);
  if (/googleads|doubleclick|googlesyndication|google-analytics|supabase\.co|googleapis\.com/.test(url.hostname)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            cache.put(req, res.clone()).catch(() => null);
          }
          return res;
        })
        .catch(() => {
          // عند انقطاع الإنترنت: أرجع الكاش إن وُجد، وإلا استجابة 503 واضحة
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: 'offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        });
      return cached || fetchPromise;
    })
  );
});
