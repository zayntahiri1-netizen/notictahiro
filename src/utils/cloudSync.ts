/**
 * cloudSync.ts — مزامنة سحابية مربوطة بالجهاز، بلا حساب
 * ───────────────────────────────────────────────────────────────────────
 * ما تحلّه: حتى الآن كانت كل بيانات المستخدم في localStorage وحده. النسخة
 * الاحتياطية تحمي من التلف، والاسترجاع يُعيدها بعد إعادة التثبيت — لكن
 * كليهما يعتمد على ملف على نفس الهاتف. ضياع الهاتف = ضياع كل شيء.
 *
 * التصميم — ولماذا هكذا:
 *   • لا حساب ولا تسجيل دخول (قرار المستخدم). الهوية معرّف + سرّ عشوائيان
 *     يُحفظان في ملف ينجو من حذف التطبيق (انظر deviceIdentity.ts).
 *   • الدفع كامل لا تفاضلي: البيانات صغيرة (نصوص)، والمزامنة التفاضلية
 *     تحتاج سجل تغييرات لكل مفتاح — تعقيدٌ يُنتج أعطاباً صامتة أكثر مما
 *     يوفّر من بايتات. لقطة واحدة سهلة التدقيق.
 *   • عند التعارض لا نكتب فوق أحد: نسحب لقطة الخادم، ندمجها بمنطق
 *     backupMerge المُختبَر (الأحدث محلياً يفوز)، ثم نُعيد الدفع.
 *
 * ⚠️ ما لا تفعله هذه المزامنة، بصراحة:
 *   • لا تنتقل تلقائياً لهاتف جديد — ذلك طبيعة الربط بالجهاز. الانتقال
 *     يتم برمز نقل يُدخله المستخدم بنفسه (transferCode.ts).
 *   • ليست تشفيراً طرفياً: الخادم يرى المحتوى. من يملك السرّ يملك البيانات.
 */
import { Capacitor } from '@capacitor/core';
import { DATA_KEYS } from './autoBackup';
import { mergeValue } from './backupMerge';
import { getIdentity } from './deviceIdentity';
import { logError } from './errorLog';
import { reportWriteFailure } from './storageHealth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/device-sync`;

const ENABLED_KEY = 'notic-sync-enabled';
const REV_KEY = 'notic-sync-rev';
const LAST_KEY = 'notic-sync-last';
/** تأجيل الدفع بعد آخر تغيير — لا نرفع عند كل ضغطة مفتاح. */
const PUSH_DEBOUNCE_MS = 8000;
const TIMEOUT_MS = 20000;

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  state: SyncState;
  /** آخر مزامنة ناجحة */
  lastAt: Date | null;
  /** رسالة الخطأ الأخيرة إن وُجدت — تُعرض للمستخدم كما هي */
  error: string | null;
}

let _status: SyncStatus = { state: 'off', lastAt: null, error: null };
const _subs = new Set<(s: SyncStatus) => void>();
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _inFlight = false;

function setStatus(patch: Partial<SyncStatus>): void {
  _status = { ..._status, ...patch };
  _subs.forEach((cb) => { try { cb(_status); } catch { /* مشترك معطوب لا يُسقط البقية */ } });
}

export function getSyncStatus(): SyncStatus { return _status; }

export function onSyncStatus(cb: (s: SyncStatus) => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}

// ─── التفعيل ──────────────────────────────────────────────────────────

/** المزامنة اختيارية ومُطفأة افتراضياً: البيانات لا تغادر الجهاز بلا إذن. */
export function isSyncEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}

export function setSyncEnabled(on: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* غير حرج */ }
  setStatus({ state: on ? 'idle' : 'off', error: null });
}

/**
 * 🔴 مفتاح إطفاء المزامنة لهذا الإصدار.
 *
 * السبب: التطبيق تحت إجراء تنفيذي من Google Play بسبب "الوظائف المعطّلة".
 * الهدف من هذا الإصدار إصلاح ذلك وحده. والمزامنة تُخرج بيانات المستخدم من
 * الجهاز، فتستلزم تحديث نموذج "أمان البيانات" في Play Console — ورفع نسخة
 * بجمع بيانات غير مُصرَّح به يفتح مخالفة **ثانية** فوق الأولى.
 *
 * فنُطفئها هنا حتى يُصفّى الوضع، ثم تعود في تحديث مستقلّ بعد تحديث النموذج.
 *
 * ⚠️ الإطفاء من هذه النقطة وحدها مقصود: كل مداخل المزامنة
 * (syncNow / scheduleSync / initSync / forgetCloudData) تمرّ من
 * isSyncConfigured أولاً، فيكفي حرفٌ واحد هنا لإعادتها — بلا نزع الملفات
 * ثم إعادة كتابتها، وهو ما يُدخل أخطاءً جديدة في كل جولة.
 *
 * لإعادة التفعيل: اجعلها true، وحدّث نموذج أمان البيانات، وأعد فقرة
 * المزامنة إلى صفحة الخصوصية (StaticPage.tsx).
 */
const SYNC_FEATURE_ENABLED = false;

export function isSyncConfigured(): boolean {
  if (!SYNC_FEATURE_ENABLED) return false;
  return !!SUPABASE_URL && !!ANON_KEY && Capacitor.isNativePlatform();
}

function readRev(): number {
  try { return parseInt(localStorage.getItem(REV_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function writeRev(r: number): void {
  try { localStorage.setItem(REV_KEY, String(r)); } catch { /* غير حرج */ }
}

export function getLastSyncTime(): Date | null {
  try {
    const t = parseInt(localStorage.getItem(LAST_KEY) ?? '0', 10);
    return t > 0 ? new Date(t) : null;
  } catch { return null; }
}

// ─── الاتصال ──────────────────────────────────────────────────────────

interface ApiResponse {
  ok?: boolean; error?: string; conflict?: boolean;
  payload?: Record<string, unknown>; rev?: number; existed?: boolean;
  maxBytes?: number;
}

/**
 * نداء الدالة. المهلة ضرورية: شبكة الهاتف قد تُبقي الطلب معلّقاً للأبد،
 * فتبقى الحالة "تتم المزامنة…" إلى ما لا نهاية ويظنّ المستخدم أنها تعمل.
 */
async function call(action: string, extra: Record<string, unknown> = {}): Promise<ApiResponse> {
  const { deviceId, secret } = await getIdentity();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ action, deviceId, secret, ...extra }),
      signal: ctrl.signal,
    });
    const body = (await res.json()) as ApiResponse;
    if (!res.ok && !body.error) body.error = `HTTP_${res.status}`;
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// ─── اللقطة المحلية ───────────────────────────────────────────────────

function localSnapshot(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch { /* مفتاح تالف — نتخطّاه بدل إسقاط المزامنة كلها */ }
  }
  return data;
}

/**
 * يكتب لقطة الخادم محلياً بعد دمجها.
 * يُعيد عدد المفاتيح التي تعذّرت كتابتها — فشل الكتابة هنا يعني أن
 * المستخدم يرى بيانات لن تبقى، وهو أسوأ من خطأ شبكة ظاهر.
 */
function applyRemote(remote: Record<string, unknown>): string[] {
  const failed: string[] = [];
  for (const key of DATA_KEYS) {
    const incoming = remote[key];
    if (incoming === undefined) continue;
    let current: unknown;
    try {
      const raw = localStorage.getItem(key);
      current = raw === null ? undefined : JSON.parse(raw);
    } catch { current = undefined; }

    const merged = mergeValue(current, incoming);
    try {
      localStorage.setItem(key, JSON.stringify(merged));
    } catch (e) {
      reportWriteFailure(key, e);
      failed.push(key);
    }
  }
  return failed;
}

// ─── العمليات ─────────────────────────────────────────────────────────

export interface SyncOutcome {
  ok: boolean;
  /** هل تغيّرت البيانات المحلية؟ (الواجهة تحتاج إعادة تحميل حينها) */
  changedLocal: boolean;
  error?: string;
}

/**
 * دورة مزامنة كاملة: سحب → دمج → دفع.
 *
 * نسحب أولاً دائماً. الدفع المباشر كان سيكتب فوق ما رفعه جهاز آخر
 * (أو نفس الجهاز قبل إعادة التثبيت) بلا أن يراه أحد.
 */
export async function syncNow(force = false): Promise<SyncOutcome> {
  if (!isSyncConfigured()) return { ok: false, changedLocal: false, error: 'NOT_CONFIGURED' };
  if (!force && !isSyncEnabled()) return { ok: false, changedLocal: false, error: 'DISABLED' };
  if (_inFlight) return { ok: false, changedLocal: false, error: 'BUSY' };

  _inFlight = true;
  setStatus({ state: 'syncing', error: null });
  try {
    // 1) تسجيل الجهاز (لا يفعل شيئاً إن كان مسجَّلاً)
    const reg = await call('register');
    if (reg.error) throw new Error(reg.error);

    // 2) سحب
    const pulled = await call('pull');
    if (pulled.error) throw new Error(pulled.error);

    let changedLocal = false;
    const remote = pulled.payload ?? {};
    if (Object.keys(remote).length > 0) {
      const failed = applyRemote(remote);
      changedLocal = true;
      if (failed.length > 0) throw new Error(`STORAGE_FULL: ${failed.join(', ')}`);
    }

    // 3) دفع اللقطة المدموجة
    let rev = pulled.rev ?? readRev();
    let pushed = await call('push', { payload: localSnapshot(), rev });

    // تعارض: جهاز آخر كتب بيننا. ندمج لقطته ونُعيد المحاولة مرة واحدة —
    // محاولة واحدة تكفي عملياً، والحلقة المفتوحة تصير عاصفة طلبات.
    if (pushed.conflict) {
      const failed = applyRemote(pushed.payload ?? {});
      changedLocal = true;
      if (failed.length > 0) throw new Error(`STORAGE_FULL: ${failed.join(', ')}`);
      rev = pushed.rev ?? rev;
      pushed = await call('push', { payload: localSnapshot(), rev });
    }

    if (pushed.error) throw new Error(pushed.error);
    if (typeof pushed.rev === 'number') writeRev(pushed.rev);

    try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* غير حرج */ }
    setStatus({ state: 'idle', lastAt: new Date(), error: null });
    return { ok: true, changedLocal };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // لا نُسجّل جسم الطلب أبداً — يحمل السرّ وبيانات المستخدم
    logError('sync', msg);
    setStatus({ state: 'error', error: msg });
    return { ok: false, changedLocal: false, error: msg };
  } finally {
    _inFlight = false;
  }
}

/** دفع مؤجَّل — يُستدعى عند كل تغيير في البيانات. */
export function scheduleSync(): void {
  if (!isSyncEnabled() || !isSyncConfigured()) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => { void syncNow(); }, PUSH_DEBOUNCE_MS);
}

/** يحذف بيانات هذا الجهاز من السحابة (لا يمسّ ما على الهاتف). */
export async function forgetCloudData(): Promise<boolean> {
  if (!isSyncConfigured()) return false;
  try {
    const res = await call('forget');
    if (res.error && res.error !== 'NOT_REGISTERED') throw new Error(res.error);
    writeRev(0);
    try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
    setStatus({ state: isSyncEnabled() ? 'idle' : 'off', lastAt: null, error: null });
    return true;
  } catch (e) {
    logError('sync', e);
    return false;
  }
}

/** تهيئة عند الإقلاع — تضبط الحالة الأولية وتسحب إن كانت المزامنة مُفعَّلة. */
export function initSync(): void {
  if (!isSyncConfigured()) { setStatus({ state: 'off' }); return; }
  setStatus({ state: isSyncEnabled() ? 'idle' : 'off', lastAt: getLastSyncTime() });
  if (isSyncEnabled()) void syncNow();
}
