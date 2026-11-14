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
 * أين تُكتب — وهذا هو بيت القصيد، وفيه تعارضٌ حقيقي لا حلّ واحد له:
 *   Directory.Data      = داخل التطبيق. يُمحى مع حذفه. لا يقرأه غيره.
 *   Directory.Documents = مجلد المستندات العام. يبقى بعد حذف التطبيق،
 *                         **وتستطيع تطبيقات أخرى على الجهاز قراءته.**
 *
 * ⚠️ كانت النسخة تُكتب في المجلد العام افتراضياً وبلا علم المستخدم. وهذا
 * يعني أن ملف JSON غير مشفَّر فيه ملاحظاته وديونه ومعاملاته المالية
 * وميزانيته كان يُكتب تلقائياً في تخزين مشترك كل 24 ساعة، ويبقى هناك
 * بعد حذف التطبيق، ولا يمسحه زرّ «حذف البيانات». ثلاثُ مشكلات في آن:
 * كشفُ بياناتٍ ماليةٍ لتطبيقات أخرى، ومعالجةٌ بلا موافقة، ووعدُ حذفٍ
 * لا يتحقّق. وسياسات Google تشترط إفصاحاً صريحاً وموافقةً قبل كتابة
 * بيانات شخصية في تخزين مشترك.
 *
 * القرار: الافتراض الآن **Directory.Data** — لا إفصاح يلزم، ولا كشف،
 * ويُمحى مع التطبيق. ومن أراد نسخةً تنجو من حذف التطبيق يُفعّل المفتاح
 * بنفسه (isPublicBackupEnabled) بعد أن يقرأ معنى ذلك في الواجهة.
 *
 * ولمَ لا نُشفّر بدل ذلك؟ لأن التشفير هنا يحلّ المشكلة الخطأ: في المخزن
 * الخاص لا داعي له (حدود التطبيق تكفي)، وفي المخزن العام يحتاج مفتاحاً،
 * ومفتاحٌ محفوظ في localStorage يموت مع حذف التطبيق فتصير النسخة
 * «الناجية» ملفاً لا يُقرأ — أي نقضُ الغرض الذي وُجدت له.
 *
 * الاسترجاع في backupRestore.ts، وهو يقرأ من المجلدين كليهما — فالنسخ
 * القديمة في المستندات تظل قابلة للاسترجاع بعد هذا التغيير.
 *
 * وAndroid Auto Backup: يُستبعد مجلد النسخ والصوتيات منه عبر
 * android-patches/apply-backup-rules.sh، وإلا رفعت Google Drive ما
 * حرصنا على إبقائه داخل الجهاز.
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
/**
 * مفتاح الموافقة على الكتابة في المستندات العامة.
 * الافتراض **إيقاف**: الغياب يعني «لا»، فمستخدمو النسخ السابقة لا
 * يُورَّثون موافقةً لم يمنحوها.
 */
const PUBLIC_KEY = 'notic-backup-public';

/** هل آخر نسخة كُتبت في مكان ينجو من حذف التطبيق؟ */
export function isBackupDurable(): boolean {
  try { return localStorage.getItem(DURABLE_KEY) === '1'; } catch { return false; }
}

/** هل وافق المستخدم على كتابة النسخ في المستندات العامة؟ (افتراضاً: لا) */
export function isPublicBackupEnabled(): boolean {
  try { return localStorage.getItem(PUBLIC_KEY) === '1'; } catch { return false; }
}

/** يضبط الموافقة. يُستدعى من مفتاح الواجهة وحده — لا تلقائياً. */
export function setPublicBackupEnabled(on: boolean): void {
  try { localStorage.setItem(PUBLIC_KEY, on ? '1' : '0'); } catch { /* غير حرج */ }
}

/**
 * يحذف كل ملفات النسخ من **المجلدين** — الخاص والعام.
 * يُستدعى من مسار «حذف البيانات»: كان الزرّ يمسح localStorage وحده،
 * فتبقى النسخ (وفيها البيانات نفسها) على الجهاز بعد حذفٍ أعلنَ تمامه.
 * ويشمل المجلد العام كي تُنظَّف نسخُ الإصدارات السابقة أيضاً.
 */
export async function purgeAllBackups(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  let removed = 0;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    for (const directory of [Directory.Data, Directory.Documents]) {
      try {
        const { files } = await Filesystem.readdir({ path: DIR, directory });
        for (const f of files) {
          const name = typeof f === 'string' ? f : f.name;
          if (!name.startsWith(BACKUP_PREFIX)) continue;
          await Filesystem.deleteFile({ path: `${DIR}/${name}`, directory })
            .then(() => { removed += 1; })
            .catch(() => { /* محذوف مسبقاً أو ممنوع — لا نُسقط الباقي */ });
        }
      } catch { /* لا مجلد في هذا الموضع — طبيعي */ }
    }
  } catch { /* الإضافة غير متاحة */ }
  try {
    localStorage.removeItem(LAST_BACKUP_KEY);
    localStorage.removeItem(DURABLE_KEY);
  } catch { /* غير حرج */ }
  return removed;
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

    // ⚠️ الوجهة تتبع موافقة المستخدم، لا الأفضلية التقنية:
    //   مُوافِق     → المستندات العامة (تنجو من حذف التطبيق)، وعند رفض
    //                 أندرويد 11+ لها (Scoped Storage) نتراجع للمخزن الخاص.
    //   غير مُوافِق → المخزن الخاص وحده. لا محاولة للعام إطلاقاً.
    // وisBackupDurable يُبلّغ الواجهة بما تحقّق فعلاً لا بما كان مطلوباً.
    const write = async (d: Directory) => {
      await Filesystem.mkdir({ path: DIR, directory: d, recursive: true })
        .catch(() => { /* موجود مسبقاً */ });
      await Filesystem.writeFile({ path, data: content, directory: d, encoding: Encoding.UTF8 });
    };

    let dir: Directory;
    let survivesUninstall: boolean;

    if (isPublicBackupEnabled()) {
      dir = Directory.Documents;
      survivesUninstall = true;
      try {
        await write(Directory.Documents);
      } catch {
        dir = Directory.Data;
        survivesUninstall = false;
        await write(Directory.Data); // لو فشل هذا أيضاً، يلتقطه catch الخارجي
      }
    } else {
      dir = Directory.Data;
      survivesUninstall = false;
      await write(Directory.Data);
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
