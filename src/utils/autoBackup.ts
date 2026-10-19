/**
 * autoBackup.ts — نسخة احتياطية تلقائية يومية إلى ملف
 * ───────────────────────────────────────────────────────────────────────
 * الفجوة التي يسدّها: بيانات التطبيق كلها في localStorage داخل حدود
 * التطبيق. أي خلل — امتلاء التخزين، مسح بيانات التطبيق، عطل في الجهاز —
 * يمحوها بلا رجعة، لأن المستخدم عملياً لا يصدّر يدوياً أبداً.
 *
 * ما يفعله: لقطة JSON كاملة مرة كل 24 ساعة، تُكتب كملف، مع الاحتفاظ
 * بآخر 3 نسخ (نقطة تراجع إن أفسد خللٌ ما بيانات اليوم).
 *
 * أين تُكتب — وهذا هو بيت القصيد:
 *   Directory.Documents = مجلد المستندات العام. **يبقى بعد حذف التطبيق.**
 *   Directory.Data      = داخل التطبيق. يُمحى معه.
 * نحاول العام أولاً ونتراجع للداخلي عند الرفض، ونُبلّغ الواجهة أيّ
 * مستوى تحقّق فعلاً (isBackupDurable) بدل ادّعاء أمانٍ لا وجود له.
 *
 * الاسترجاع في backupRestore.ts — بلا قراءة، كانت هذه الميزة نصفَ ميزة.
 *
 * ⚠️ تصحيح ادّعاء كان مكتوباً هنا: لا شيء في هذا المشروع يُهيّئ
 * Android Auto Backup. سلوكه يعتمد على افتراضات أندرويد وعلى تفعيل
 * المستخدم لنسخ Google Drive — فلا نَعِد به. الضمان الحقيقي الذي نملكه
 * هو ملف المستندات أعلاه، ثم مزامنة سحابية بحساب (غير مبنية بعد).
 */
import { Capacitor } from '@capacitor/core';

const LAST_BACKUP_KEY = 'notic-last-autobackup';
const INTERVAL_MS = 24 * 60 * 60 * 1000; // يومياً
const KEEP = 3;                           // عدد النسخ المحفوظة
/** مجلد النسخ — مُصدَّر كي يقرأ منه الاسترجاع نفس المكان بالضبط. */
export const DIR = 'backups';
/** بادئة ملفات النسخ التلقائية (التدوير والاسترجاع يعتمدان عليها). */
export const BACKUP_PREFIX = 'notic-backup-';

/**
 * المفاتيح التي تحمل بيانات المستخدم الحقيقية — لا تفضيلات العرض.
 * ⚠️ الأسماء منسوخة حرفياً من AppContext والمكوّنات، لا مكتوبة من الذاكرة:
 * مفتاح باسم خاطئ لا يُسبّب أي خطأ — يُتخطّى بصمت، فتخرج النسخة ناقصة
 * ولا يُكتشف ذلك إلا يوم الاسترجاع. (وقع هذا فعلاً: كُتب 'notic-debts'
 * بدل 'notic-debtscredits' فكانت الديون ستضيع من كل نسخة.)
 */
export const DATA_KEYS = [
  'notic-notes',
  'notic-projects',
  'notic-habits',
  'notic-debtscredits',
  'notic-transactions',
  'notic-braindumps',
  'notic-monthly-budget',
  'notic-recurring-txns',
  'notic-ai-rules',
];

export interface BackupResult {
  /** هل كُتبت في مجلد يبقى بعد حذف التطبيق؟ (Documents وليس Data) */
  survivesUninstall?: boolean;
  ok: boolean;
  path?: string;
  bytes?: number;
  reason?: string;
}

/** يجمع لقطة كاملة من البيانات الحالية. */
function snapshot(): string {
  const data: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {
      // مفتاح تالف أو غير JSON — نتخطّاه بدل إسقاط النسخة بأكملها.
      // نسخة ناقصة خير من لا نسخة.
    }
  }
  return JSON.stringify({
    app: 'Notic Tahiro',
    version: 1,
    createdAt: new Date().toISOString(),
    data,
  });
}

/**
 * يحذف النسخ الأقدم مُبقياً آخر KEEP.
 * ⚠️ يأخذ المجلد الفعلي (قيمة) لا نوع التعداد: الكتابة قد تقع في
 * Documents أو تتراجع إلى Data، والتدوير يجب أن يجري حيث كُتبت فعلاً —
 * وإلا نظّفنا مجلداً ونتركنا الآخر يتضخّم بلا حد.
 */
async function rotate(
  Filesystem: typeof import('@capacitor/filesystem').Filesystem,
  directory: import('@capacitor/filesystem').Directory,
): Promise<void> {
  try {
    const { files } = await Filesystem.readdir({ path: DIR, directory });
    const mine = files
      .map((f) => (typeof f === 'string' ? f : f.name))
      .filter((n) => n.startsWith(BACKUP_PREFIX) && n.endsWith('.json'))
      .sort(); // الاسم يحمل التاريخ ISO ⇒ الترتيب الأبجدي = الزمني
    for (const name of mine.slice(0, Math.max(0, mine.length - KEEP))) {
      await Filesystem.deleteFile({ path: `${DIR}/${name}`, directory })
        .catch(() => { /* ملف محذوف مسبقاً — غير مهم */ });
    }
  } catch {
    // لا مجلد بعد (أول نسخة) — لا شيء يُدوَّر.
  }
}

/**
 * ينفّذ النسخ الاحتياطي إن مرّ يوم على آخر واحدة.
 * `force` يتجاوز الفاصل الزمني (لزرّ "انسخ الآن").
 */
const DURABLE_KEY = 'notic-backup-durable';

/** هل آخر نسخة كُتبت في مكان ينجو من حذف التطبيق؟ */
export function isBackupDurable(): boolean {
  try { return localStorage.getItem(DURABLE_KEY) === '1'; } catch { return false; }
}

export async function runAutoBackupIfDue(force = false): Promise<BackupResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: 'WEB_UNSUPPORTED' };
  }

  if (!force) {
    try {
      const last = parseInt(localStorage.getItem(LAST_BACKUP_KEY) ?? '0', 10) || 0;
      if (Date.now() - last < INTERVAL_MS) return { ok: false, reason: 'NOT_DUE' };
    } catch { /* تعذّر القراءة — ننسخ احتياطاً */ }
  }

  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const content = snapshot();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `${DIR}/${BACKUP_PREFIX}${stamp}.json`;

    // ⚠️ الوجهة هي جوهر الميزة كلها:
    //   Directory.Data        = مجلد التطبيق الداخلي — يُمحى مع حذف التطبيق.
    //                           أي أن النسخة تموت بنفس الكارثة التي وُجدت لتمنعها.
    //   Directory.Documents   = مجلد المستندات العام — يبقى بعد حذف التطبيق.
    // نحاول العام أولاً. قد يرفضه أندرويد 11+ (Scoped Storage)، فنتراجع
    // للداخلي: حمايةٌ أقل (من تلف البيانات لا من الحذف) خيرٌ من لا شيء —
    // ونُبلّغ الواجهة أيّ مستوى تحقّق فعلاً بدل ادّعاء أمان لا وجود له.
    let dir: Directory = Directory.Documents;
    let survivesUninstall = true;

    const write = async (d: Directory) => {
      await Filesystem.mkdir({ path: DIR, directory: d, recursive: true })
        .catch(() => { /* موجود مسبقاً */ });
      await Filesystem.writeFile({ path, data: content, directory: d, encoding: Encoding.UTF8 });
    };

    try {
      await write(Directory.Documents);
    } catch {
      dir = Directory.Data;
      survivesUninstall = false;
      await write(Directory.Data); // لو فشل هذا أيضاً، يلتقطه catch الخارجي
    }

    try { localStorage.setItem(DURABLE_KEY, survivesUninstall ? '1' : '0'); } catch { /* غير حرج */ }

    await rotate(Filesystem, dir);

    // ⚠️ نسجّل الوقت بعد نجاح الكتابة فقط. لو سجّلناه قبلها، فشلٌ واحد
    // يؤجّل المحاولة التالية 24 ساعة كاملة — أي لا نسخة حين تشتدّ الحاجة.
    try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch { /* غير حرج */ }

    return { ok: true, path, bytes: content.length, survivesUninstall };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** وقت آخر نسخة ناجحة (للعرض في الإعدادات) — أو null. */
export function getLastBackupTime(): Date | null {
  try {
    const t = parseInt(localStorage.getItem(LAST_BACKUP_KEY) ?? '0', 10);
    return t > 0 ? new Date(t) : null;
  } catch { return null; }
}
