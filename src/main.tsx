import { StrictMode } from "react";
import { installGlobalHandlers } from './utils/errorLog';
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

declare global {
  interface Window {
    __noticShowRecovery?: () => void;
    __noticBootErrors?: string[];
  }
}

const rootElement = document.getElementById("root");

// قبل التصيير: نلتقط حتى أخطاء الإقلاع نفسها
installGlobalHandlers();

// ⚠️ التصيير داخل try/catch.
// ErrorBoundary يلتقط ما يقع **داخل** شجرة React بعد بدئها؛ أما فشلٌ في
// createRoot نفسه أو في أول تصيير متزامن فيخرج من هنا، ولو تركناه يرمي
// لبقي #root بمحتواه الاحتياطي بلا تفسير. نُسلّمه لشاشة الاستعادة في
// index.html — فيفتح التطبيق على رسالة مفهومة بدل شاشة صامتة.
try {
  if (!rootElement) throw new Error("Root element not found.");
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (e) {
  try {
    window.__noticBootErrors?.push(e instanceof Error ? e.message : String(e));
    window.__noticShowRecovery?.();
  } catch { /* شبكة الأمان نفسها لا يجوز أن تكون مصدر عطب */ }
}

// إخفاء شاشة البداية يدوياً فور جاهزية React (أسرع من الانتظار الإفتراضي)
requestAnimationFrame(async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    }
  } catch {
    // الإضافة غير متوفّرة أو خطأ آخر — نتركها للإخفاء التلقائي
  }
});

/**
 * عامل الخدمة — للويب وحده، ومع تنظيف إجباري داخل التطبيق.
 *
 * ⚠️ العطب الذي صُحِّح هنا، وهو سبب "يُثبَّت ويُفتح ولا يعمل":
 *
 * كان الشرط يستثني بروتوكولَي capacitor:// و file:// فقط. لكن
 * capacitor.config.ts يضبط androidScheme: 'https'، فالبروتوكول داخل
 * التطبيق هو https: — ويمرّ الشرط. فكان عامل الخدمة **يُسجَّل داخل
 * تطبيق أندرويد**، ويُخزّن index.html وكل الأصول باستراتيجية
 * "الكاش أولاً".
 *
 * وعند كل تحديث للتطبيق يُولّد Vite أسماء أصول جديدة (بصمات مختلفة)،
 * بينما يُقدّم العامل index.html القديم من كاش النسخة السابقة. فيختلط
 * جزءٌ قديم بآخر جديد، ويقرأ أحدهما رمزاً من الآخر قبل تهيئته:
 *     Cannot access 'X' before initialization
 * فيسقط التطبيق فور الفتح. والتثبيت النظيف يعمل (لا كاش بعد)، ولهذا
 * لا يراه المطوّر — ويراه كل من حدّث التطبيق.
 *
 * ولا فائدة منه أصلاً داخل التطبيق: الأصول مُدمَجة في الحزمة، فالعمل
 * دون اتصال مضمون بلا أي تخزين مؤقّت.
 *
 * فهنا: لا نُسجّله على المنصّة الأصلية، و**نُزيل** ما سجّلته النسخ
 * السابقة ونمسح كاشها — وإلا بقي كل مستخدم حالي عالقاً في نسخة معطوبة.
 */
void (async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      const regs = await navigator.serviceWorker.getRegistrations();
      let removed = false;
      for (const r of regs) removed = (await r.unregister()) || removed;
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) { await caches.delete(k); removed = true; }
      }
      // إعادة تحميل واحدة لا أكثر: الصفحة الحالية قد تكون مبنية على أصول
      // قديمة أتت من الكاش، فلا يكفي المسح دون إعادة جلبها. والحارس يمنع
      // حلقة إعادة تحميل لا تنتهي لو فشل المسح لأي سبب.
      if (removed && !sessionStorage.getItem('notic-sw-purged')) {
        sessionStorage.setItem('notic-sw-purged', '1');
        location.reload();
      }
      return;
    }

    // الويب/PWA فقط
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // بيئات لا تدعم العامل — تجاهل صامت
      });
    });
  } catch {
    // تعذّر تحميل Capacitor — لا نُسجّل شيئاً. الامتناع أأمن من التسجيل.
  }
})();
