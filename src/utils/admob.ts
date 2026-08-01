/**
 * admob.ts — مدير إعلانات AdMob لتطبيق Notic Tahiro
 *
 * FIX الكامل (يونيو 2026):
 *  1. resumeBanner() لا توجد في v8 — استُبدلت بـ showBanner() مجدداً
 *  2. ADAPTIVE_BANNER يحتاج width صريح وإلا يفشل صامتاً على بعض الأجهزة
 *  3. حارس _bannerBusy لمنع الاستدعاءات المتوازية
 *  4. حارس _appOpenInFlight لمنع تكرار App Open
 *  5. IS_TESTING مبني على Vite mode (DEV) — صحيح تلقائياً في الإنتاج
 *
 * معرّفات AdMob (أندرويد):
 *   APP_ID:       ca-app-pub-1725525147318224~8481725862
 *   BANNER:       ca-app-pub-1725525147318224/4977595129
 *   INTERSTITIAL: ca-app-pub-1725525147318224/4765842134
 *   APP_OPEN:     ca-app-pub-1725525147318224/5479892076
 *   NATIVE:       ca-app-pub-1725525147318224/6796843179  (مُسجَّل — غير مُفعَّل، انظر أدناه)
 */

import { Capacitor } from '@capacitor/core';
// ⚠️ استيراد ثابت (وليس ديناميكياً) — مقصود وحاسم:
// الاستيراد الديناميكي `await import(...)` يُخرج الإضافة في ملف chunk منفصل
// يُطلَب عبر الشبكة داخل WebView. إن تعذّر تحميل ذلك الطلب أو تعلّق، يتوقف
// كل شيء بصمت: لا خطأ يُرمى ولا مهلة تنطبق (لأن التعليق يقع قبلها) —
// وهذا ما كان يحدث: «التهيئة لم تكتمل» بلا أي خطأ. الاستيراد الثابت يدمج
// الإضافة في الحزمة الرئيسية، فلا طلب إضافي ولا احتمال تعليق.
import {
  AdMob as AdMobPlugin,
  BannerAdPluginEvents,
  BannerAdSize,
  BannerAdPosition,
} from '@capacitor-community/admob';

// ─── معرّفات AdMob الإنتاجية (أندرويد) ──────────────────────────────
export const ADMOB_IDS = {
  APP_ID:       'ca-app-pub-1725525147318224~8481725862',
  BANNER:       'ca-app-pub-1725525147318224/4977595129',
  INTERSTITIAL: 'ca-app-pub-1725525147318224/4765842134',
  APP_OPEN:     'ca-app-pub-1725525147318224/5479892076',
  // ⚠️ الإعلانات «المتقدمة المدمجة مع المحتوى» (Native Advanced) تتطلب عرضاً
  //    أصلياً مخصّصاً (NativeAd view) لا تدعمه إضافة @capacitor-community/admob
  //    الحالية (تدعم: banner / interstitial / rewarded / app-open فقط). لذلك
  //    نحتفظ بالمعرّف موثّقاً وجاهزاً هنا، دون ربطه بأي مسار عرض — كي لا نطلب
  //    إعلاناً لا نستطيع عرضه (وهو ما قد يخالف سياسات AdMob). لتفعيله لاحقاً
  //    يلزم تكامل أصلي مستقل. لا تستعمله في banner/interstitial بأي حال.
  NATIVE:       'ca-app-pub-1725525147318224/6796843179',
} as const;

// ─── معرّفات الاختبار الرسمية من Google ─────────────────────────────
const TEST_IDS = {
  BANNER:       'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  APP_OPEN:     'ca-app-pub-3940256099942544/9257395921',
};

// ─── وضع الاختبار — false في الإنتاج تلقائياً ───────────────────────
// import.meta.env.DEV = true فقط في `vite dev`، false في `vite build`
// ⚠️ للتحقق من أن AdMob يعمل: غيّر FORCE_TEST إلى true مؤقتاً، ابنِ APK،
// وستظهر إعلانات اختبارية فوراً (آمنة للضغط). بعد التأكد، أعِده false
// للإعلانات الحقيقية. لا تضغط إعلاناتك الحقيقية أبداً (خطر حظر الحساب).
const FORCE_TEST = false;
// ⚠️ حتمية: نكتب `import.meta.env.DEV` بشكله الحرفي كي يستبدله Vite نصياً
// وقت البناء (كان مكتوباً بـ optional chaining فلا يستبدله Vite دائماً):
//   npm run dev   → true  → إعلانات اختبار
//   vite build    → false → إعلانات حقيقية  ← هذا ما يدخل في الـ APK
// الـ try/catch حماية: لو لم يُستبدل لأي سبب، النتيجة false = إعلانات حقيقية.
const IS_DEV: boolean = (() => {
  try { return (import.meta as unknown as { env: { DEV: boolean } }).env.DEV === true; }
  catch { return false; }
})();
export const IS_TESTING = FORCE_TEST || IS_DEV;

export const isNative = () => Capacitor.isNativePlatform();

// ─── معرّفات الإعلانات النشطة (الإنتاج مقابل الاختبار) ─────────────
export const AD = {
  BANNER:       IS_TESTING ? TEST_IDS.BANNER       : ADMOB_IDS.BANNER,
  INTERSTITIAL: IS_TESTING ? TEST_IDS.INTERSTITIAL : ADMOB_IDS.INTERSTITIAL,
  APP_OPEN:     IS_TESTING ? TEST_IDS.APP_OPEN     : ADMOB_IDS.APP_OPEN,
};
export const HOME_BANNER = AD.BANNER;

// ─── حدود التكرار ────────────────────────────────────────────────────
const APP_OPEN_KEY      = 'notic_app_open_ts';
const APP_OPEN_INTERVAL = 2 * 60 * 60 * 1000; // ساعتان بين إعلانَي فتح التطبيق

// ─── سياسة إعلانات احترافية ─────────────────────────────────────────
// كان الفاصل 45 ثانية: قد يرى مستخدم يحرّر ملاحظاته بسرعة إعلاناً كل دقيقة
// تقريباً — تجربة مزعجة، تضر بالاحتفاظ بالمستخدمين، وقد تُخالف إرشادات
// AdMob حول الإعلانات المُفرطة. المعيار في تطبيقات الإنتاجية: 3 دقائق
// كحد أدنى + سقف يومي + فترة سماح للمستخدم الجديد.
const INTERSTITIAL_MIN_GAP   = 3 * 60 * 1000;  // 3 دقائق بين إعلانين بينيين
const INTERSTITIAL_DAILY_MAX = 6;              // سقف يومي (يحمي التجربة والحساب)
const NEW_USER_GRACE         = 5 * 60 * 1000;  // لا إعلانات بينية أول 5 دقائق
const FIRST_RUN_KEY = 'notic_first_run_ts';
const INT_DAY_KEY   = 'notic_int_day';         // 'YYYY-MM-DD:عدد'

// ─── تخزين آمن (Capacitor Preferences + localStorage كاحتياطي) ───────
async function storageGet(key: string): Promise<string | null> {
  if (isNative()) {
    try { const { Preferences } = await import('@capacitor/preferences'); return (await Preferences.get({ key })).value; }
    catch { /* fallback */ }
  }
  try { return localStorage.getItem(key); } catch { return null; }
}
async function storageSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    try { const { Preferences } = await import('@capacitor/preferences'); await Preferences.set({ key, value }); return; }
    catch { /* fallback */ }
  }
  try { localStorage.setItem(key, value); } catch { /* بيئة بدون storage */ }
}

// ─── الوصول إلى الإضافة (مستوردة استيراداً ثابتاً — بلا طلب شبكي) ────
let _lastError = ''; // آخر خطأ — يظهر في شاشة التشخيص داخل التطبيق
/**
 * 🔴 السبب الجذري الذي عطّل كل الإعلانات (يجب أن تبقى هذه الدالة متزامنة):
 *
 * كانت هذه الدالة `async` وتُرجع كائن إضافة Capacitor. وكائنات إضافات
 * Capacitor هي Proxy تُرجع دالة لأي اسم خاصية يُطلب منها — بما في ذلك
 * `then`. وفي JavaScript، أي كائن يملك `then` يُعامَل كـ «وعد» (thenable):
 * فعند `getAdMob()` يستدعي المحرّك `plugin.then(resolve, reject)`،
 * فيُنشئ الـ Proxy دالة وهمية باسم `then` تُنادي طريقة أصلية غير موجودة،
 * ولا تستدعي `resolve` أبداً → الانتظار يتعلّق إلى الأبد.
 *
 * النتيجة كانت مطابقة تماماً لما رُصد: لا خطأ، لا مهلة (لأن المهل كانت
 * داخل الكود الذي لم يُبلَغ أصلاً)، وتعطّل كل أنواع الإعلانات معاً.
 *
 * ⚠️ لا تجعلها async ولا تُعِد كائن الإضافة من دالة async أبداً.
 */
function getAdMob(): typeof AdMobPlugin | null {
  if (!isNative()) return null;
  if (!AdMobPlugin) {
    _lastError = 'إضافة AdMob غير متوفّرة في هذه النسخة';
    return null;
  }
  return AdMobPlugin;
}

// ─── موافقة UMP / GDPR ───────────────────────────────────────────────
// التسلسل الرسمي المعتمد من Google (EU User Consent Policy):
//   1. AdMob.initialize  2. requestConsentInfo  3. showConsentForm (إن لزم)
//   4. عندها فقط نُحمّل الإعلانات.
// هذا يضمن أن مستخدمي الاتحاد الأوروبي/UK يرون نموذج الموافقة قبل أي إعلان،
// بينما يتجاهله مستخدمو المغرب وباقي الدول تلقائياً (Google يحدّد ذلك جغرافياً).
async function requestConsent(): Promise<boolean> {
  const AdMob = getAdMob();
  if (!AdMob) return true; // لا مكتبة (ويب) → نسمح بالمتابعة
  const api = AdMob as unknown as {
    requestConsentInfo?: (o?: unknown) => Promise<{ status?: string; isConsentFormAvailable?: boolean; canRequestAds?: boolean }>;
    showConsentForm?: () => Promise<{ canRequestAds?: boolean }>;
  };
  if (typeof api.requestConsentInfo !== 'function') return true;
  try {
    const info = await api.requestConsentInfo({ tagForUnderAgeOfConsent: false });
    // إن كان النموذج مطلوباً ومتاحاً → اعرضه وانتظر قرار المستخدم
    if (info?.isConsentFormAvailable && info?.status === 'REQUIRED' && typeof api.showConsentForm === 'function') {
      const result = await api.showConsentForm();
      // بعد عرض النموذج، canRequestAds يعكس قرار المستخدم
      return result?.canRequestAds !== false;
    }
    // لا نموذج مطلوب (خارج الاتحاد الأوروبي مثل المغرب) → يُسمح بالإعلانات
    return info?.canRequestAds !== false;
  } catch (e) {
    _lastError = 'خطأ في نموذج الموافقة: ' + String(e);
    console.warn('[AdMob] consent:', e);
    return true; // عند الخطأ لا نمنع الإعلانات (سلوك آمن غير معطّل)
  }
}

/**
 * يعرض نموذج خيارات الخصوصية ليُغيّر المستخدم الأوروبي رأيه لاحقاً.
 * يُستدعى من زر "إعدادات الخصوصية" في صفحة الإعدادات.
 * على مستخدمي خارج الاتحاد الأوروبي قد لا يفعل شيئاً (لا نموذج) — وهذا طبيعي.
 */
export async function showPrivacyOptions(): Promise<void> {
  const AdMob = getAdMob();
  if (!AdMob) return;
  const api = AdMob as unknown as { showPrivacyOptionsForm?: () => Promise<unknown> };
  if (typeof api.showPrivacyOptionsForm === 'function') {
    try { await withTimeout(api.showPrivacyOptionsForm(), 15000); }
    catch (e) { console.warn('[AdMob] privacy options:', e); }
  }
}

// ─── 1. التهيئة (idempotent) ─────────────────────────────────────────
// ─── تشخيص: نلتقط آخر حالة/خطأ لعرضها داخل التطبيق ──────────────────
let _initialized    = false;
let _initTimedOut   = false;
let _listenersAttached = false; // يمنع تكرار المستمعات عند إعادة التهيئة

// ─── سجل تتبّع مرئي (لتشخيص بلا حاسوب) ──────────────────────────────
// نسجّل كل مرحلة بتوقيتها منذ تحميل الوحدة، ونعرضها في نافذة التشخيص.
// هذا يحسم السؤال: أين يتوقّف التنفيذ بالضبط؟
const _T0 = Date.now();
const _trace: string[] = [];
function trace(step: string): void {
  const t = ((Date.now() - _T0) / 1000).toFixed(1);
  _trace.push(`${t}s ${step}`);
  if (_trace.length > 24) _trace.shift();
}
trace('وحدة admob حُمِّلت');
let _consentTimedOut = false;
let _bannerLoadErr = '';
/** يُرجع تقرير حالة AdMob لعرضه في الواجهة (تشخيص بدون حاسوب) */
/**
 * الارتفاع الذي يجب حجزه أسفل الشاشة حالياً.
 * لا يُرجع صفراً ما دام البانر معروضاً: حدث SizeChanged قد يتأخّر، وحينها
 * كان --banner-h يبقى 0 فترتفع النوافذ صفر بكسل ويغطّي الإعلان الأزرار.
 * نُرجع آخر ارتفاع معروف، وإلا 60px تحفّظياً.
 */
export function bannerReservedHeight(): number {
  if (!_bannerShown || _bannerHidden) return 0;
  if (_bannerHeight > 0) return _bannerHeight;
  return _lastKnownHeight > 0 ? _lastKnownHeight : 60;
}

export function getAdDiagnostics() {
  return {
    native:        isNative(),
    testing:       IS_TESTING,
    initialized:   _initialized,
    initTimedOut:  _initTimedOut,
    consentTimedOut: _consentTimedOut,
    canRequestAds: _canRequestAds,
    bannerShown:   _bannerShown,
    bannerHidden:  _bannerHidden,
    bannerHeight:  _bannerHeight,
    bannerUnit:    _bannerUnit || AD.BANNER,
    retries:       _bannerRetryCount,
    dailyShown:    _dailyShownCache,
    dailyMax:      INTERSTITIAL_DAILY_MAX,
    trace:         _trace.slice(-14).join('\n'),
    lastError:     _lastError,
    bannerError:   _bannerLoadErr,
  };
}

let _initPromise: Promise<void> | null = null;
let _canRequestAds = true; // بوابة GDPR: هل يُسمح بطلب الإعلانات بعد الموافقة؟
/**
 * سباق مع مهلة زمنية. سبب وجودها: MobileAds.initialize() على أندرويد قد
 * لا يستدعي دالة الرجوع (callback) أبداً في بعض الأجهزة/الشبكات — فيبقى
 * الوعد معلّقاً للأبد. وبما أن showBanner() ينتظر التهيئة، كان البانر
 * يعلَق صامتاً: لا خطأ، لا إعلان، لا محاولات إعادة. هذا ما كان يحدث.
 *
 * ملاحظة مهمة: توثيق Google ينص أن طلب الإعلانات قبل اكتمال التهيئة آمن
 * (تُوضع في الطابور)، لذا المتابعة بعد المهلة سلوك صحيح وليس التفافاً.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | '__TIMEOUT__'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<'__TIMEOUT__'>((resolve) => {
    timer = setTimeout(() => { timedOut = true; resolve('__TIMEOUT__'); }, ms);
  });

  // حماية من «رفض غير مُعالَج»: بعد فوز المهلة بالسباق لا يبقى للوعد
  // الأصلي أي مُعالِج، فلو رفض لاحقاً يظهر Unhandled Rejection في
  // الـ WebView. نلتقطه هنا صراحةً ونتجاهله (المهلة سبقته أصلاً).
  // كما نُصفّي المؤقّت في finally مهما كانت النتيجة (نجاح أو رفض).
  const guarded = promise
    .then((v) => v)
    .catch((e) => {
      if (timedOut) return '__TIMEOUT__' as const; // المهلة سبقت — ابتلع بهدوء
      throw e;                                      // وإلا مرّره للمستدعي
    })
    .finally(() => { if (timer !== undefined) clearTimeout(timer); });

  return Promise.race([guarded, timeoutPromise]);
}

export function initAdMob(): Promise<void> {
  trace('initAdMob() استُدعيت');
  if (_initPromise) { trace('→ وعد قائم، إعادة استعمال'); return _initPromise; }
  _initPromise = (async () => {
    trace('طلب كائن الإضافة…');
    const AdMob = getAdMob();
    if (!AdMob) {
      trace('❌ الإضافة غير متوفّرة');
      if (!_lastError) _lastError = 'تعذّر تحميل إضافة AdMob على هذا الجهاز';
      return;
    }
    trace('✓ الإضافة متوفّرة');
    try {
      // تهيئة متدرّجة: بعض إصدارات الإضافة تغيّر أسماء/أنواع الخيارات،
      // وخيار غير معروف قد يُفشل التهيئة كلياً فتتعطّل كل الإعلانات.
      // نحاول بالخيارات الكاملة، ثم بالحد الأدنى، ثم بلا خيارات إطلاقاً.
      const initAttempts: Array<[string, Record<string, unknown>]> = [
        ['كامل',      { requestTrackingAuthorization: true, testingDevices: [], initializeForTesting: IS_TESTING }],
        ['مبسّط',      { initializeForTesting: IS_TESTING }],
        ['بلا خيارات', {}],
      ];
      let initRes: unknown = '__TIMEOUT__';
      let lastInitErr: unknown = null;
      for (const [label, opts] of initAttempts) {
        try {
          trace(`initialize(${label})…`);
          initRes = await withTimeout(
            (AdMob.initialize as (o: unknown) => Promise<unknown>)(opts),
            8000,
          );
          if (initRes !== '__TIMEOUT__') {
            if (label !== 'كامل') {
              _lastError = `ℹ️ التهيئة نجحت بخيارات «${label}» (الخيارات الكاملة رُفضت)`;
            }
            break; // نجحت
          }
          break; // مهلة — لا فائدة من إعادة المحاولة بخيارات أخرى
        } catch (err) {
          lastInitErr = err;
          console.warn(`[AdMob] initialize (${label}) فشلت:`, err);
          // جرّب المستوى التالي
        }
      }
      if (initRes === '__TIMEOUT__' && lastInitErr) {
        // فشلت المحاولات الثلاث جميعاً — هذا خطأ حقيقي وليس مهلة
        _lastError = 'فشل تهيئة AdMob بكل الخيارات: ' + String(lastInitErr);
        throw lastInitErr;
      }
      if (initRes === '__TIMEOUT__') {
        // لا نتوقف: نتابع تحميل الإعلانات (الطلبات تُوضع في الطابور).
        _initTimedOut = true;
        console.warn('[AdMob] initialize تجاوز 8 ثوانٍ — نتابع بدون انتظار');
      }
      trace('✓ التهيئة اكتملت');
      _initialized = true;
      void _dailyCount().then((n) => { _dailyShownCache = n; }); // دقّة التشخيص بعد إعادة التشغيل
      console.log('[AdMob] ✅ initialized | testing=', IS_TESTING, '| banner=', AD.BANNER);
      // ⚠️ حارس ضروري: التهيئة قد تُعاد بعد فشل (أضفنا إعادة المحاولة).
      // بدون هذا الحارس تُسجَّل المستمعات مرة أخرى في كل محاولة، فيُستدعى
      // _onBannerFail عدة مرات لكل فشل واحد → عاصفة إعادة محاولات متوازية.
      try {
        if (_listenersAttached) throw new Error('__ALREADY__');
        _listenersAttached = true;
        AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
          try { _bannerLoadErr = typeof err === 'string' ? err : JSON.stringify(err); } catch { _bannerLoadErr = 'load failed'; }
          console.warn('[AdMob] banner failed:', err);
          void _onBannerFail();
        });
        AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          _bannerLoadErr = '';
          console.log('[AdMob] banner loaded ✅');
          _bannerRetryCount = 0; // نجح التحميل → صفّر عدّاد إعادة المحاولة
        });
        AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: { width: number; height: number }) => {
          _bannerHeight = Math.max(0, Math.round(size?.height ?? 0));
          if (_bannerHeight > 0) _lastKnownHeight = _bannerHeight;
          _heightSubs.forEach(cb => { try { cb(_bannerHeight); } catch { /* ignore */ } });
        });
      } catch { /* مسجَّلة مسبقاً، أو إصدار لا يدعم الأحداث */ }
      // ⚠️ GDPR حاسم: ننتظر اكتمال الموافقة قبل تحضير أي إعلان.
      // إن رفض المستخدم الأوروبي، _canRequestAds=false فلا نُحمّل إعلانات.
      trace('طلب الموافقة (GDPR)…');
      const consentRes = await withTimeout(requestConsent(), 8000);
      trace('✓ الموافقة انتهت');
      if (consentRes === '__TIMEOUT__') {
        _consentTimedOut = true;
        _canRequestAds = true; // لا نمنع الإعلانات بسبب بطء الشبكة
        console.warn('[AdMob] نموذج الموافقة تجاوز 8 ثوانٍ — نتابع');
      } else {
        _canRequestAds = consentRes;
      }
      if (_canRequestAds) {
        // ⚠️ لا ننتظر: كان `await` هنا يحجب اكتمال initAdMob()، وبما أن
        // showBanner() ينتظر initAdMob()، فإن تعليق تحضير الإعلان البيني
        // كان يمنع البانر نهائياً — رغم أن التشخيص يقول «التهيئة نجحت»
        // (لأن _initialized يُضبط قبل هذا السطر). البانر والإعلان البيني
        // مستقلّان ويجب ألا يحجب أحدهما الآخر.
        void withTimeout(prepareInterstitial(), 15000);
      } else {
        console.log('[AdMob] consent denied → ads disabled for this user');
      }
    } catch (e) {
      // كان الخطأ يُطبع في الـ console فقط — غير مرئي على الجهاز.
      _lastError = 'فشل تهيئة AdMob: ' + String(e);
      console.warn('[AdMob] init error:', e);
      throw e; // مرّره ليُعالَج أدناه (إعادة المحاولة)
    }
  })().catch(() => {
    // 🔴 عيب جوهري: الوعد كان يُخزَّن حتى عند الفشل — فأي فشل واحد
    // (شبكة بطيئة عند الإقلاع، تأخر تسجيل الإضافة) كان يُعطّل كل
    // الإعلانات نهائياً طوال تشغيل التطبيق دون أي محاولة ثانية.
    // الآن نُفرّغ الوعد ليُعاد المحاولة عند أول طلب إعلان لاحق.
    _initPromise = null;
  });
  return _initPromise;
}

// ─── 2. Banner ───────────────────────────────────────────────────────
let _bannerShown   = false;
let _bannerHidden  = false;  // معروض ومحمَّل، لكنه مُخفى مؤقتاً (داخل المحرّر)
let _bannerUnit    = '';
let _bannerRetryCount = 0;   // عداد محاولات إعادة تحميل البانر الذكية
let _bannerHeight  = 0;
let _lastKnownHeight = 0; // آخر ارتفاع فعلي — لاستعادته بعد الإخفاء
let _bannerBusy    = false;
const _heightSubs  = new Set<(h: number) => void>();

export function onBannerHeight(cb: (h: number) => void): () => void {
  _heightSubs.add(cb);
  cb(_bannerHeight);
  return () => { _heightSubs.delete(cb); };
}

export async function showBanner(
  adId: string = AD.BANNER,
  opts?: { isRetry?: boolean },
): Promise<void> {
  trace('showBanner() استُدعيت');
  if (!isNative()) { trace('✗ ليس جهازاً حقيقياً'); return; }
  await initAdMob();
  trace('✓ عادت من انتظار التهيئة');
  // بوابة GDPR: إن رفض المستخدم الأوروبي الموافقة، لا نعرض إعلانات
  if (!_canRequestAds) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  // إذا نفس الوحدة معروضة بالفعل — لا نعيد
  // ⚠️ كان: (_bannerShown && _bannerUnit === adId) — وهذا يمنع إعادة
  // الإظهار بعد hideBanner، لأن hideBanner تُبقي _bannerShown=true عمداً
  // (البانر يبقى محمّلاً). النتيجة كانت: البانر يختفي عند دخول المحرّر
  // ولا يعود أبداً. نستثني الآن حالة «مخفي مؤقتاً».
  if (_bannerShown && !_bannerHidden && _bannerUnit === adId) return;
  if (_bannerBusy) return;
  _bannerBusy = true;
  try {
    // أزِل القديم أولاً إن وُجد
    if (_bannerShown) {
      try { await withTimeout(AdMob.removeBanner(), 6000); } catch { /* ignore */ }
      _bannerShown = false;
    }
    // ⚠️ لا نُصفّر العدّاد أثناء إعادة المحاولة، وإلا بقي التصعيد عالقاً
    // عند 30 ثانية للأبد (كل محاولة تستدعي showBanner فتُصفّره) فيتكرّر
    // الطلب بلا نهاية. نصفّره فقط عند طلب جديد من التطبيق (تغيّر شاشة).
    if (!opts?.isRetry) _bannerRetryCount = 0;


    // FIX: ADAPTIVE_BANNER يحتاج width لضمان العمل على كل الأجهزة
    // نستخدم عرض الشاشة الكامل لكنه يُحدَّد تلقائياً لو لم يُحدَّد
    // مهلة: أي استدعاء أصلي قد يتعلّق فيبقى _bannerBusy مرفوعاً ويُقفل
    // البانر للأبد. المهلة تضمن مرور finally دائماً.
    trace('طلب عرض البانر من النظام…');
    const res = await withTimeout(AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: IS_TESTING,
      // ملاحظة: لا نُضيف isTablet لأنها غير موجودة في v8 API
      // وتُسبب فشلاً صامتاً على بعض الأجهزة
    }), 10000);
    if (res === '__TIMEOUT__') {
      _lastError = '⏱️ showBanner تجاوز المهلة (10 ثوانٍ) — استدعاء أصلي معلّق';
      _bannerShown = false;
      return;
    }

    trace('✓ البانر عُرض');
    _bannerShown  = true;
    _bannerHidden = false;
    // شبكة أمان: حدث SizeChanged قد يتأخّر لحظات بعد ظهور البانر. في تلك
    // اللحظة يكون --banner-h = 0 فتُغطّى أزرار الواجهة. نحجز ارتفاعاً
    // تحفّظياً فوراً (يصحّحه SizeChanged بعد قليل بالقيمة الدقيقة).
    if (_bannerHeight === 0) {
      _bannerHeight = _lastKnownHeight > 0 ? _lastKnownHeight : 60;
      _heightSubs.forEach(cb => { try { cb(_bannerHeight); } catch { /* ignore */ } });
    }
    _bannerUnit   = adId;
    console.log('[AdMob] banner shown ✅', adId);
  } catch (e) {
    _lastError = String(e);
    console.warn('[AdMob] showBanner error:', e);
    _bannerShown = false;
  } finally {
    _bannerBusy = false;
  }
}

// hideBanner/resumeBanner — v8.0.0 تدعم resumeBanner فعلاً.
// (تعليق قديم كان يقول العكس، وعليه بُني خطأ منع عودة البانر.)
let _bannerShouldShow = false;

export async function hideBanner(): Promise<void> {
  if (!isNative()) return;
  const AdMob = getAdMob();
  if (!AdMob || !_bannerShown) return;
  try {
    // نستخدم hideBanner وليس removeBanner:
    // hideBanner تُخفي البانر مع إبقائه محمّلاً → إعادة العرض أسرع (لا تحميل جديد)
    // removeBanner تُزيله كلياً → يحتاج تحميل جديد عند كل إظهار (أبطأ + يستهلك quota)
    await withTimeout(AdMob.hideBanner(), 6000);
    _bannerShouldShow = true;
    _bannerHidden     = true;
    _bannerHeight = 0;
    _heightSubs.forEach(cb => { try { cb(0); } catch { /* ignore */ } });
    console.log('[AdMob] banner hidden (still loaded)');
  } catch (e) {
    console.warn('[AdMob] hideBanner:', e);
  }
}

// resumeBanner: تُعيد إظهار البانر المخفي
// v8.0.0 تدعم resumeBanner فعلاً — نحاول استخدامها، وإن فشلت نعيد showBanner
export async function resumeBanner(): Promise<void> {
  if (!isNative()) return;
  if (!_bannerShouldShow && _bannerShown) return;
  _bannerShouldShow = false;
  const AdMob = getAdMob();
  if (!AdMob) return;
  try {
    // نحاول resumeBanner أولاً (تُظهر البانر المحمّل بدون تحميل جديد)
    const r = await withTimeout(
      (AdMob as unknown as { resumeBanner: () => Promise<void> }).resumeBanner(),
      6000,
    );
    if (r === '__TIMEOUT__') throw new Error('resumeBanner timeout');

    // ⚠️ ضروري: بدون تصفير هذا العلم يبقى النظام يظن أن البانر مخفي،
    // فيطلب showBanner إعلاناً جديداً بدل استئناف المحمَّل — هدر في
    // مرات العرض وبطء بلا داعٍ. (رُصد فعلياً: التشخيص يقول «مُخفى»
    // بينما البانر ظاهر على الشاشة.)
    _bannerHidden = false;
    // ⚠️ إعادة بثّ الارتفاع ضرورية: hideBanner تبثّ 0 للواجهة، وبدون
    // استعادته هنا يبقى المتغيّر --banner-h = 0، فتفقد كل النوافذ حجزها
    // للمساحة السفلية ويغطّي الإعلان حقول الكتابة والأزرار (مخالفة
    // لسياسات AdMob، وليست مجرد مشكلة شكلية).
    if (_lastKnownHeight > 0) {
      _bannerHeight = _lastKnownHeight;
      _heightSubs.forEach(cb => { try { cb(_bannerHeight); } catch { /* ignore */ } });
    }
    trace('✓ البانر استُؤنف');
    console.log('[AdMob] banner resumed ✅');
  } catch {
    // إن لم تتوفر resumeBanner نستخدم showBanner مجدداً
    trace('resumeBanner غير متاحة → showBanner');
    console.log('[AdMob] resumeBanner N/A → calling showBanner');
    _bannerHidden = false; // اسمح لـ showBanner بالعرض من جديد
    _bannerShown  = false;
    await showBanner(_bannerUnit || AD.BANNER);
  }
}

export async function removeBanner(): Promise<void> {
  if (!isNative()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  try { await withTimeout(AdMob.removeBanner(), 6000); } catch { /* ignore */ }
  _bannerShown = false;
  _bannerHidden = false;
  _bannerUnit  = '';
  _bannerHeight = 0;
  _bannerShouldShow = false;
  _heightSubs.forEach(cb => { try { cb(0); } catch { /* ignore */ } });
}

// إعادة محاولة ذكية عند فشل البانر (no-fill): محاولات متعددة بفواصل
// متزايدة (30s → 60s → 120s → 300s) بدل مرة واحدة. هذا يرفع معدل ظهور
// الإعلانات كثيراً، خاصة في المناطق ذات التعبئة المنخفضة حيث قد لا يتوفر
// إعلان لحظة الطلب الأول لكنه يتوفر بعد دقائق.
const _BANNER_RETRY_DELAYS = [30_000, 60_000, 120_000, 300_000];

async function _onBannerFail(): Promise<void> {
  if (_bannerRetryCount >= _BANNER_RETRY_DELAYS.length) {
    console.log('[AdMob] banner: max retries reached, will retry on next screen change');
    return;
  }
  const delay = _BANNER_RETRY_DELAYS[_bannerRetryCount];
  _bannerRetryCount++;
  const unit = _bannerUnit || AD.BANNER;
  console.log(`[AdMob] banner no-fill → retry #${_bannerRetryCount} in ${delay / 1000}s`);
  setTimeout(() => {
    _bannerShown = false;
    _bannerUnit  = '';
    void showBanner(unit, { isRetry: true });
  }, delay);
}

// ─── 3. App Open ────────────────────────────────────────────────────
let _appOpenInFlight = false;

export async function showAppOpenAd(): Promise<void> {
  if (!isNative()) return;
  if (_appOpenInFlight) return;
  _appOpenInFlight = true;
  try {
    await initAdMob();
    if (!_canRequestAds) return; // بوابة GDPR
    const AdMob = getAdMob();
    if (!AdMob) return;

    // الانطباع الأول: لا نستقبل مستخدماً جديداً بإعلان ملء الشاشة.
    const { firstEver } = await _graceState();
    if (firstEver) {
      await storageSet(APP_OPEN_KEY, String(Date.now())); // ابدأ العدّ من الآن
      console.log('[AdMob] App Open skipped — أول تشغيل (انطباع أول نظيف)');
      return;
    }

    const lastStr = await storageGet(APP_OPEN_KEY);
    const last    = parseInt(lastStr ?? '0', 10);
    if (Date.now() - last < APP_OPEN_INTERVAL) return;

    const api = AdMob as unknown as {
      prepareAppOpen?: (o: unknown) => Promise<unknown>;
      showAppOpen?   : () => Promise<unknown>;
    };
    if (typeof api.prepareAppOpen !== 'function' || typeof api.showAppOpen !== 'function') {
      console.log('[AdMob] App Open not supported — skipping');
      return;
    }
    await storageSet(APP_OPEN_KEY, String(Date.now()));
    const prep = await withTimeout(api.prepareAppOpen({ adId: AD.APP_OPEN, isTesting: IS_TESTING }), 10000);
    if (prep === '__TIMEOUT__') { _lastError = '⏱️ prepareAppOpen تجاوز المهلة'; return; }
    await withTimeout(api.showAppOpen(), 10000);
    console.log('[AdMob] App Open ✅');
  } catch (e) {
    console.warn('[AdMob] App Open error:', e);
  } finally {
    _appOpenInFlight = false;
  }
}

// ─── 4. Interstitial ────────────────────────────────────────────────
let _interstitialReady = false;
let _lastInterstitial  = 0;

export async function prepareInterstitial(): Promise<void> {
  const AdMob = getAdMob();
  if (!AdMob || _interstitialReady) return;
  try {
    const r = await withTimeout(AdMob.prepareInterstitial({ adId: AD.INTERSTITIAL, isTesting: IS_TESTING }), 15000);
    if (r === '__TIMEOUT__') { _lastError = '⏱️ prepareInterstitial تجاوز المهلة'; return; }
    _interstitialReady = true;
    console.log('[AdMob] interstitial ready ✅');
  } catch (e) { console.warn('[AdMob] prepare interstitial:', e); }
}

/**
 * فترة سماح المستخدم الجديد: لا نعرض إعلانات بينية في أول 5 دقائق من أول
 * تشغيل. الانطباع الأول حاسم للاحتفاظ بالمستخدم — والاحتفاظ هو ما يصنع
 * العائد على المدى الطويل، لا الإعلان الأول.
 * يُرجع أيضاً ما إذا كان هذا أول تشغيل على الإطلاق (لتخطّي إعلان الفتح).
 */
async function _graceState(): Promise<{ inGrace: boolean; firstEver: boolean }> {
  try {
    const stored = await storageGet(FIRST_RUN_KEY);
    if (!stored) {
      await storageSet(FIRST_RUN_KEY, String(Date.now()));
      return { inGrace: true, firstEver: true };
    }
    const first = parseInt(stored, 10) || 0;
    return { inGrace: Date.now() - first < NEW_USER_GRACE, firstEver: false };
  } catch {
    return { inGrace: false, firstEver: false };
  }
}

/** السقف اليومي للإعلانات البينية */
function _todayKey(): string { return new Date().toISOString().slice(0, 10); }
async function _dailyCount(): Promise<number> {
  try {
    const raw = await storageGet(INT_DAY_KEY);
    if (!raw) return 0;
    const [day, n] = raw.split(':');
    return day === _todayKey() ? (parseInt(n, 10) || 0) : 0;
  } catch { return 0; }
}
async function _bumpDaily(): Promise<void> {
  try {
    const n = await _dailyCount();
    await storageSet(INT_DAY_KEY, `${_todayKey()}:${n + 1}`);
    _dailyShownCache = n + 1;
  } catch { /* ignore */ }
}
let _dailyShownCache = 0;

// ─── الإعلان البيني عند انتقالات النوافذ (نظام مركزي) ───────────────
let _transitionCount = 0;

/**
 * كل نوافذ التطبيق تُبلّغ هنا عند الفتح/الإغلاق، فيتولّى هذا النظام قرار
 * العرض وفق سياسة التكرار (3 دقائق + سقف يومي 6 + فترة سماح 5 دقائق).
 *
 * ⚠️ لماذا العرض عند الإغلاق فقط افتراضياً؟
 * إرشادات AdMob تنصّ على عرض الإعلانات البينية عند «نقاط انتقال طبيعية»
 * (بعد إنهاء مهمة)، لا عند بدئها. عرض إعلان عند *فتح* نافذة يعترض نيّة
 * المستخدم قبل أن يرى محتواه، ويرفع النقرات العرضية — وهو سبب شائع
 * لإنذارات «مشاكل تنفيذ الإعلانات» وقد يُعرّض الحساب للتقييد.
 * الانتقالات عند الفتح تُحتسب في العدّاد لكن لا تعرض إعلاناً.
 * لتغيير ذلك: اجعل SHOW_ON_OPEN = true (على مسؤوليتك).
 */
const SHOW_ON_OPEN = false;
const INTERSTITIAL_EVERY_N = 2; // إعلان محتمل كل انتقالين

export async function onScreenTransition(kind: 'open' | 'close'): Promise<void> {
  _transitionCount++;
  trace(`انتقال نافذة (${kind}) #${_transitionCount}`);
  if (kind === 'open' && !SHOW_ON_OPEN) return;
  if (_transitionCount % INTERSTITIAL_EVERY_N !== 0) return;
  await showInterstitial();
}

export async function showInterstitial(): Promise<void> {
  if (!isNative()) return;
  await initAdMob();
  if (!_canRequestAds) return; // بوابة GDPR
  const AdMob = getAdMob();
  if (!AdMob) return;
  if (Date.now() - _lastInterstitial < INTERSTITIAL_MIN_GAP) return;
  // فترة سماح المستخدم الجديد
  const { inGrace } = await _graceState();
  if (inGrace) { console.log('[AdMob] interstitial skipped — فترة سماح المستخدم الجديد'); return; }
  // السقف اليومي
  if (await _dailyCount() >= INTERSTITIAL_DAILY_MAX) {
    console.log('[AdMob] interstitial skipped — بلغ السقف اليومي');
    return;
  }
  if (!_interstitialReady) {
    await prepareInterstitial();
    if (!_interstitialReady) return;
  }
  try {
    await withTimeout(AdMob.showInterstitial(), 10000);
    _interstitialReady = false;
    _lastInterstitial  = Date.now();
    void _bumpDaily();
    setTimeout(() => prepareInterstitial(), 3000);
    console.log('[AdMob] interstitial ✅');
  } catch (e) {
    _interstitialReady = false;
    console.warn('[AdMob] showInterstitial:', e);
  }
}
