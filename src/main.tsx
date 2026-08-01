import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

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

// تسجيل عامل الخدمة (للويب فقط — Capacitor يعمل من الأصول المُدمَجة)
if (
  'serviceWorker' in navigator &&
  !window.location.protocol.startsWith('capacitor') &&
  !window.location.protocol.startsWith('file')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // يفشل بصمت في بيئات لا تدعم العامل (مثل بعض المتصفّحات داخل التطبيقات)
    });
  });
}
