/**
 * storageHealth.ts — قياس سعة التخزين والإنذار عند امتلائه
 * ───────────────────────────────────────────────────────────────────────
 * لماذا هذا الملف موجود
 * ─────────────────────
 * كل بيانات المستخدم (ملاحظات، عادات، معاملات، ديون، ميزانية) تعيش في
 * localStorage، وحدّه ~5MB. عند امتلائه كانت الكتابة تفشل ويُبتلع الخطأ
 * بسطر console فقط. النتيجة الأسوأ الممكنة:
 *
 *   • المستخدم يكتب ملاحظته ويراها أمامه (حالة React في الذاكرة)
 *   • فيظن أنها محفوظة
 *   • وعند إعادة تشغيل التطبيق — تكون قد ضاعت
 *
 * بلا تحذير ولا مؤشر. وهذا لا يظهر في الاختبار لأنه لا يبدأ إلا بعد شهور
 * من الاستعمال الحقيقي.
 *
 * ما يفعله هذا الملف:
 *   1. يقيس المستهلك فعلياً من localStorage ونسبته إلى الحد.
 *   2. يوفّر قناة اشتراك تُبلّغ الواجهة لحظة فشل أي كتابة — فيصير الفشل
 *      مسموعاً بدل أن يكون صامتاً.
 */

/** الحد الشائع لـ localStorage في المتصفحات و WebView: 5 ميغابايت. */
const QUOTA_BYTES = 5 * 1024 * 1024;

/** عتبة التحذير المبكر — قبل الامتلاء بوقت كافٍ لاتخاذ إجراء. */
export const WARN_THRESHOLD = 0.8;

export interface StorageUsage {
  /** البايتات المستهلكة فعلياً */
  usedBytes: number;
  /** الحد الأقصى المفترض */
  quotaBytes: number;
  /** النسبة 0..1 */
  ratio: number;
  /** هل تجاوزنا عتبة التحذير؟ */
  nearFull: boolean;
}

/**
 * يقيس المستهلك من localStorage.
 * JavaScript يخزّن النصوص بـ UTF-16، أي بايتان لكل محرف — والمفتاح نفسه
 * يُحتسب ضمن الحصة، لذا نجمع طول المفتاح والقيمة معاً.
 */
export function getStorageUsage(): StorageUsage {
  let chars = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      chars += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    // الوصول للتخزين محجوب (وضع خاص/إعدادات صارمة) — نُبلّغ بصفر لا بخطأ.
    return { usedBytes: 0, quotaBytes: QUOTA_BYTES, ratio: 0, nearFull: false };
  }
  const usedBytes = chars * 2; // UTF-16
  const ratio = Math.min(usedBytes / QUOTA_BYTES, 1);
  return { usedBytes, quotaBytes: QUOTA_BYTES, ratio, nearFull: ratio >= WARN_THRESHOLD };
}

/** تنسيق مقروء: 1.4 MB / 512 KB */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ─── قناة بثّ فشل الكتابة ────────────────────────────────────────────
/** وصف فشل كتابة واحد — تستهلكه واجهة التحذير. */
export interface WriteFailure {
  /** مفتاح التخزين الذي فشلت كتابته */
  key: string;
  /** هل السبب امتلاء المساحة؟ (لا خطأ آخر) */
  isQuota: boolean;
}

type FailListener = (info: WriteFailure) => void;
const _listeners = new Set<FailListener>();

/** آخر فشل مُسجَّل — ليلتقطه مكوّن رُكّب بعد وقوع الفشل. */
let _lastFailure: WriteFailure | null = null;

/** يُستدعى من طبقة التخزين عند فشل أي كتابة. */
export function reportWriteFailure(key: string, error: unknown): void {
  // QuotaExceededError يختلف اسمه ورقمه بين المحركات، فنفحص الثلاثة.
  const e = error as { name?: string; code?: number } | undefined;
  const isQuota =
    e?.name === 'QuotaExceededError' ||
    e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e?.code === 22 ||
    e?.code === 1014;

  _lastFailure = { key, isQuota };
  _listeners.forEach((cb) => {
    try { cb({ key, isQuota }); } catch { /* مستمع معطوب لا يُسقط البقية */ }
  });
}

/** اشتراك في أحداث الفشل. يُرجع دالة إلغاء الاشتراك. */
export function onWriteFailure(cb: FailListener): () => void {
  _listeners.add(cb);
  // لو وقع فشل قبل تركيب المكوّن، سلّمه فوراً حتى لا يضيع التحذير.
  if (_lastFailure) {
    const last = _lastFailure;
    queueMicrotask(() => { try { cb(last); } catch { /* ignore */ } });
  }
  return () => { _listeners.delete(cb); };
}

/** يمسح آخر فشل بعد أن يعالجه المستخدم (تصدير/حذف). */
export function clearWriteFailure(): void {
  _lastFailure = null;
}
