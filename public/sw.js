/**
 * sw.js — عامل خدمة للويب/PWA فقط
 *
 * ⚠️ لا يُسجَّل داخل تطبيق أندرويد إطلاقاً (انظر src/main.tsx). الأصول
 * هناك مُدمَجة في الحزمة، فلا فائدة منه — وقد تسبّب سقوط التطبيق عند كل
 * تحديث حين كان يُسجَّل بالخطأ.
 *
 * ═══════════════════════════════════════════════════════════════════
 * القاعدة الحاكمة: لا تُخلَط نسختان من البناء أبداً
 * ═══════════════════════════════════════════════════════════════════
 * كانت الاستراتيجية السابقة "الكاش أولاً" لكل شيء بما فيه index.html.
 * وبما أن Vite يُبصم أسماء الأصول في كل بناء، كان العامل يُقدّم
 * index.html قديماً يُشير إلى أصول نسخة سابقة، بينما تأتي أصول أخرى من
 * النسخة الجديدة. فيقرأ جزءٌ رمزاً من جزء لم يُهيَّأ:
 *     Cannot access 'X' before initialization
 * ويسقط التطبيق فور الفتح.
 *
 * ولذلك هنا مسلكان مختلفان، والفرق بينهما مقصود:
 *
 *   • index.html (ووثائق التنقّل): **الشبكة أولاً**. هو وحده ما يُحدّد
 *     أي نسخة من الأصول تُحمَّل، فلا يجوز أن يأتي قديماً. والكاش
 *     احتياطٌ عند انقطاع الاتصال فقط.
 *
 *   • أصول /assets/ المبصومة: **الكاش أولاً** بأمان. اسم الملف يحمل
 *     بصمة محتواه، فالمحتوى لا يتغيّر تحت الاسم نفسه أبداً. ونسخة
 *     جديدة تعني اسماً جديداً لا تصادماً.
 */

const CACHE = 'notic-tahiro-v4';
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

  const url = new URL(req.url);

  // شبكة فقط — لا كاش لردود الذكاء الاصطناعي ولا للإعلانات والتحليلات
  if (/googleads|doubleclick|googlesyndication|google-analytics|supabase\.co|googleapis\.com/.test(url.hostname)) {
    return;
  }

  // ── وثيقة التنقّل: الشبكة أولاً ──────────────────────────────────
  // هي ما يُحدّد أسماء الأصول المطلوبة، فنسخةٌ قديمة منها تعني خلط
  // بناءين — وهو ما يُسقط التطبيق. الكاش احتياطٌ عند الانقطاع فقط.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match('/index.html') || new Response(
            '<!doctype html><meta charset="utf-8"><p>offline</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // ── بقية الأصول: الكاش أولاً مع تحديث في الخلفية ─────────────────
  // آمن هنا لأن أسماء ملفات /assets/ مبصومة بمحتواها: لا يتغيّر محتوى
  // تحت اسم واحد، فالقديم المحفوظ يظلّ صحيحاً لمن يطلبه.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetching = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            cache.put(req, res.clone()).catch(() => null);
          }
          return res;
        })
        .catch(() => cached || new Response(
          JSON.stringify({ error: 'offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        ));
      return cached || fetching;
    })
  );
});
