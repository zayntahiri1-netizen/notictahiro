/**
 * deviceIdentity.ts — هوية الجهاز للمزامنة بلا حساب
 * ───────────────────────────────────────────────────────────────────────
 * المشكلة التي يحلّها هذا الملف — وهي ليست بديهية:
 *
 * "مزامنة مربوطة بالجهاز" تعني أن المفتاح هو معرّف يُولّده التطبيق. لو
 * خزّنّا ذلك المعرّف في localStorage — كما يفعل أغلب التطبيقات — لمات
 * بالضبط في الحالة التي وُجدت المزامنة من أجلها: حذف التطبيق يمحو
 * localStorage، فيُولّد التطبيق عند إعادة التثبيت معرّفاً جديداً، ولا
 * يجد بيانات الجهاز القديم أبداً رغم أنها سليمة في السحابة.
 *
 * لذلك الهوية تُكتب في ملف داخل **مجلد المستندات** — نفس المكان الذي
 * أثبت أنه يبقى بعد حذف التطبيق (نسخ autoBackup). و localStorage مجرّد
 * ذاكرة سريعة أمامه، لا مصدر الحقيقة.
 *
 * الأمان: السرّ 128 بت عشوائية، يعمل كـ"مفتاح حامل". من يملكه يملك
 * البيانات — ولهذا لا يُسجَّل في سجل الأخطاء ولا يظهر في أي رسالة، ولا
 * يُرسَل إلى قاعدة البيانات (الخادم يحفظ hash فقط).
 */
import { Capacitor } from '@capacitor/core';
import { logError } from './errorLog';
import { encodeTransferCode, decodeTransferCode } from './transferCode';

const FILE = 'notic-sync-id.json';
const DIR = 'sync';
const CACHE_KEY = 'notic-sync-identity';

export interface DeviceIdentity {
  deviceId: string;
  secret: string;
}

let _memo: DeviceIdentity | null = null;

// ─── توليد عشوائي ─────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** UUID v4. لا نعتمد على crypto.randomUUID وحدها — غير موجودة في كل WebView. */
function uuidv4(): string {
  if (typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch { /* نُكمل بالبديل */ }
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // النسخة 4
  b[8] = (b[8] & 0x3f) | 0x80; // المتغيّر
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function isValid(v: unknown): v is DeviceIdentity {
  const o = v as DeviceIdentity | null;
  return !!o && typeof o.deviceId === 'string' && typeof o.secret === 'string'
    && /^[0-9a-f-]{36}$/i.test(o.deviceId) && o.secret.length >= 32;
}

// ─── التخزين ──────────────────────────────────────────────────────────

function readCache(): DeviceIdentity | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return isValid(v) ? v : null;
  } catch { return null; }
}

function writeCache(id: DeviceIdentity): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(id)); } catch { /* غير حرج */ }
}

/** يقرأ الهوية من الملف الدائم. null إن لم توجد. */
async function readFile(): Promise<DeviceIdentity | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    for (const directory of [Directory.Documents, Directory.Data]) {
      try {
        const { data } = await Filesystem.readFile({
          path: `${DIR}/${FILE}`, directory, encoding: Encoding.UTF8,
        });
        const v: unknown = JSON.parse(typeof data === 'string' ? data : '');
        if (isValid(v)) return v;
      } catch { /* غير موجود هنا — جرّب التالي */ }
    }
  } catch { /* الإضافة غير متاحة */ }
  return null;
}

/**
 * يكتب الهوية في الملف الدائم.
 * يُرجع true إن وصلت إلى مجلد المستندات تحديداً — وهو الفرق بين
 * "تنجو من حذف التطبيق" و"لا تنجو". نُبلّغ الواجهة بالحقيقة لا بالأمنية.
 */
async function writeFile(id: DeviceIdentity): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const content = JSON.stringify(id);
    for (const [directory, durable] of [[Directory.Documents, true], [Directory.Data, false]] as const) {
      try {
        await Filesystem.mkdir({ path: DIR, directory, recursive: true }).catch(() => { /* موجود */ });
        await Filesystem.writeFile({ path: `${DIR}/${FILE}`, data: content, directory, encoding: Encoding.UTF8 });
        return durable;
      } catch { /* جرّب الوجهة التالية */ }
    }
  } catch (e) {
    logError('sync', e, 'warn');
  }
  return false;
}

/** هل الهوية محفوظة في مكان ينجو من حذف التطبيق؟ */
const DURABLE_KEY = 'notic-sync-id-durable';
export function isIdentityDurable(): boolean {
  try { return localStorage.getItem(DURABLE_KEY) === '1'; } catch { return false; }
}

/**
 * يُعيد هوية هذا الجهاز، ويُنشئها عند أول نداء.
 *
 * ترتيب البحث مقصود: الذاكرة ← localStorage ← الملف الدائم ← إنشاء جديد.
 * الملف قبل الإنشاء هو بيت القصيد: بعد إعادة التثبيت يكون localStorage
 * فارغاً والملف موجوداً، فنستعيد نفس الهوية ونجد البيانات في السحابة.
 */
export async function getIdentity(): Promise<DeviceIdentity> {
  if (_memo) return _memo;

  const cached = readCache();
  if (cached) {
    _memo = cached;
    // الملف قد يكون ضاع (مسح مستندات) — أعِد كتابته بهدوء
    void writeFile(cached).then((d) => {
      try { localStorage.setItem(DURABLE_KEY, d ? '1' : '0'); } catch { /* ignore */ }
    });
    return cached;
  }

  const fromFile = await readFile();
  if (fromFile) {
    _memo = fromFile;
    writeCache(fromFile);
    try { localStorage.setItem(DURABLE_KEY, '1'); } catch { /* ignore */ }
    return fromFile;
  }

  const fresh: DeviceIdentity = { deviceId: uuidv4(), secret: randomHex(16) };
  _memo = fresh;
  writeCache(fresh);
  const durable = await writeFile(fresh);
  try { localStorage.setItem(DURABLE_KEY, durable ? '1' : '0'); } catch { /* ignore */ }
  return fresh;
}

// ─── رمز النقل إلى هاتف جديد ──────────────────────────────────────────
// المزامنة المربوطة بالجهاز لا تنتقل لهاتف آخر بطبيعتها. هذا الرمز يمنح
// ذلك الانتقال بلا حساب: تقرأه من الهاتف القديم وتُدخله في الجديد.
// من يحصل على الرمز يحصل على البيانات — ولذلك نقول ذلك صراحةً في الواجهة.

/** رمز نصّي مضغوط يحمل المعرّف والسرّ معاً (32 بايت → 43 محرفاً). */
export async function getTransferCode(): Promise<string> {
  return encodeTransferCode(await getIdentity());
}

/**
 * يتبنّى هوية جهاز آخر من رمز نقل.
 * ⚠️ يستبدل هوية هذا الجهاز — بيانات الجهاز القديمة تبقى في السحابة
 * تحت معرّفها السابق، لكن هذا الجهاز يتوقّف عن الوصول إليها.
 */
export async function applyTransferCode(code: string): Promise<DeviceIdentity | null> {
  const parsed = decodeTransferCode(code);
  if (!parsed || !isValid(parsed)) return null;

  _memo = parsed;
  writeCache(parsed);
  const durable = await writeFile(parsed);
  try { localStorage.setItem(DURABLE_KEY, durable ? '1' : '0'); } catch { /* ignore */ }
  return parsed;
}

/** ينسى الهوية محلياً (لا يحذف من السحابة — ذلك فعل منفصل وصريح). */
export async function forgetIdentityLocally(): Promise<void> {
  _memo = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(DURABLE_KEY); } catch { /* ignore */ }
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    for (const directory of [Directory.Documents, Directory.Data]) {
      await Filesystem.deleteFile({ path: `${DIR}/${FILE}`, directory }).catch(() => { /* غير موجود */ });
    }
  } catch { /* ignore */ }
}
