/**
 * errorLog.ts — سجل أخطاء داخل التطبيق
 * ───────────────────────────────────────────────────────────────────────
 * لماذا هذا الملف موجود
 * ─────────────────────
 * كل عطب واجهناه في هذا التطبيق كان صامتاً: الإعلانات التي لا تظهر، المؤشر
 * العربي الذي يقفز، التنزيل الذي لا يحدث، زرّ استماع يبحث عن دور غير
 * موجود. في كل مرة كان الخطأ حقيقياً وواقعاً فعلاً — لكن لا أحد يراه،
 * لأن الـ APK لا يُظهر console. فكان التشخيص تخميناً متكرراً عبر نسخ.
 *
 * هذا السجل يقلب المعادلة: كل خطأ يُلتقط ويُعرض داخل التطبيق نفسه، قابلاً
 * للنسخ بضغطة. فبدل "لا يعمل" تصير الرسالة سطراً يحدّد السبب.
 *
 * قيود مقصودة:
 *   • حلقة محدودة (MAX) — سجل بلا سقف يصير هو نفسه تسريب ذاكرة.
 *   • الحفظ في localStorage مُقلَّم بشدّة: التخزين محدود بـ5MB وبياناتُ
 *     المستخدم أولى به من سجلّ تشخيص.
 *   • لا يُسجَّل أي محتوى ملاحظات أو مبالغ — رسائل تقنية فقط.
 */

export interface LogEntry {
  /** وقت الحدث (ms) */
  t: number;
  /** مستوى الخطورة */
  level: 'error' | 'warn';
  /** من أين جاء: 'admob' | 'tts' | 'storage' | 'ai' | 'global' … */
  scope: string;
  /** الرسالة المختصرة */
  msg: string;
}

const MAX = 60;              // ما يكفي لتشخيص جلسة، ولا يُثقل الذاكرة
const PERSIST_MAX = 20;      // ما يُحفظ بين الجلسات — مُقلَّم عمداً
const KEY = 'notic-errlog';

let _entries: LogEntry[] = load();
const _subs = new Set<(e: LogEntry[]) => void>();

function load(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]).slice(-PERSIST_MAX) : [];
  } catch { return []; }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(_entries.slice(-PERSIST_MAX)));
  } catch {
    // التخزين ممتلئ — بيانات المستخدم أولى من السجل. نكتفي بالذاكرة.
    // (لا نستدعي reportWriteFailure هنا: تحذير "لم يُحفظ" يخصّ بيانات
    //  المستخدم، وإقحام فشل سجلّ تشخيصي فيه يُفزعه بلا سبب.)
  }
}

/** يختصر أي قيمة خطأ إلى سطر مقروء. */
function toMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message + (err.stack ? ` | ${err.stack.split('\n')[1]?.trim() ?? ''}` : '');
  }
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err).slice(0, 300); } catch { return String(err); }
}

/** يسجّل حدثاً. آمن تماماً — لا يرمي أبداً مهما كان المُدخل. */
export function logError(scope: string, err: unknown, level: LogEntry['level'] = 'error'): void {
  try {
    const entry: LogEntry = { t: Date.now(), level, scope, msg: toMessage(err).slice(0, 400) };
    _entries = [..._entries, entry].slice(-MAX);
    persist();
    _subs.forEach((cb) => { try { cb(_entries); } catch { /* مشترك معطوب لا يُسقط البقية */ } });
  } catch { /* السجل نفسه لا يجوز أن يكون مصدر عطب */ }
}

export function getEntries(): LogEntry[] { return _entries; }

export function clearEntries(): void {
  _entries = [];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  _subs.forEach((cb) => { try { cb(_entries); } catch { /* ignore */ } });
}

export function onEntries(cb: (e: LogEntry[]) => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}

/** نص جاهز للنسخ واللصق عند طلب الدعم. */
export function formatForCopy(appVersion: string): string {
  const head = `Notic Tahiro ${appVersion} — سجل الأخطاء (${_entries.length})\n` +
               `${new Date().toISOString()}\n${'─'.repeat(40)}`;
  if (_entries.length === 0) return `${head}\nلا أخطاء مسجّلة ✅`;
  const body = _entries.map((e) => {
    const time = new Date(e.t).toLocaleTimeString('en-GB', { hour12: false });
    return `[${time}] ${e.level === 'error' ? '🔴' : '⚠️'} ${e.scope}: ${e.msg}`;
  }).join('\n');
  return `${head}\n${body}`;
}

/**
 * يلتقط الأخطاء التي لا يمسكها أي try/catch — وهي أخطر نوع لأنها تمرّ
 * بلا أثر إطلاقاً. يُستدعى مرة واحدة عند إقلاع التطبيق.
 */
let _installed = false;
export function installGlobalHandlers(): void {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  window.addEventListener('error', (ev) => {
    // أخطاء تحميل الموارد (صورة/سكربت) تصل هنا بلا ev.error
    const where = ev.filename ? ` @${ev.filename.split('/').pop()}:${ev.lineno}` : '';
    logError('global', (ev.error ?? ev.message ?? 'unknown error') + where);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    // وعد مرفوض بلا catch — بالضبط نمط العطب الذي عطّل الإعلانات
    logError('promise', ev.reason ?? 'unhandled rejection');
  });
}
