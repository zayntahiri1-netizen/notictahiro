/**
 * firebase.ts — تهيئة Firebase Analytics لتطبيق Notic Tahiro
 * ─────────────────────────────────────────────────────────────────────
 * مشروع Firebase: notictahiro
 *
 * ⚠️ ملاحظة مهمة عن البيئة الهجينة (Capacitor/WebView):
 * حزمة Firebase JS SDK (المُستخدَمة هنا) صُمِّمت أصلاً لمتصفحات الويب
 * العادية. داخل WebView على أندرويد/iOS قد لا تعمل بعض ميزات Analytics
 * بشكل كامل (تتبّع التثبيت الحقيقي من Play Store، ربط الجهاز، الأحداث
 * الخاصة بدورة حياة التطبيق الأصلي) لأنها تعتمد على IndexedDB وطلبات
 * gtag.js الخاصة بالمتصفح وليس على SDK أندرويد/iOS الأصلي لـ Firebase.
 *
 * للحصول على تتبّع موثوق بالكامل (فتحات التطبيق، الانهيارات، خصائص
 * المستخدم) يُفضَّل لاحقاً الانتقال لإضافة Capacitor أصلية مثل
 * `@capacitor-firebase/analytics` (تحتاج google-services.json من
 * Firebase Console لمعرّف الحزمة com.notictahiro.app). الكود هنا يبقى
 * مفيداً بأي حال لمعاينة الويب ولوحة Firebase Console الأساسية.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyAalFnDySpwdTvIDIS_y1EWfnkRRRNcVcY',
  authDomain: 'notictahiro.firebaseapp.com',
  projectId: 'notictahiro',
  storageBucket: 'notictahiro.firebasestorage.app',
  messagingSenderId: '971276439424',
  appId: '1:971276439424:web:6a56784b67a5c95ada3b65',
  measurementId: 'G-B2NYHZLVX3',
};

let _app: FirebaseApp | null = null;
let _analytics: Analytics | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * يهيّئ Firebase + Analytics مرة واحدة فقط (idempotent)، ويتحقق أولاً
 * أن البيئة الحالية تدعم Analytics (isSupported) قبل استدعاء getAnalytics
 * — تفادياً لرمي استثناء صامت يُسقط بقية تهيئة التطبيق في بيئات لا تدعمه
 * (مثل بعض إصدارات WebView القديمة أو وضع التصفح الخفي).
 */
export function initFirebase(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      _app = initializeApp(firebaseConfig);
      const { isSupported, getAnalytics } = await import('firebase/analytics');
      if (await isSupported()) {
        _analytics = getAnalytics(_app);
        console.log('[Firebase] ✅ Analytics initialized');
      } else {
        console.log('[Firebase] Analytics not supported in this environment — skipped');
      }
    } catch (e) {
      console.warn('[Firebase] init error:', e);
    }
  })();
  return _initPromise;
}

/**
 * يسجّل حدث Analytics مخصصاً (لا يفعل شيئاً إن لم تكن التهيئة قد
 * نجحت — لا يرمي خطأً أبداً، آمن للاستدعاء من أي مكان في التطبيق).
 */
export async function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  if (!_analytics) return;
  try {
    const { logEvent } = await import('firebase/analytics');
    logEvent(_analytics, eventName, params);
  } catch { /* ignore — لا نُسقط أي ميزة في التطبيق بسبب فشل تتبّع */ }
}
