/**
 * backupRestore.ts — قراءة النسخ الاحتياطية وإرجاعها
 * ───────────────────────────────────────────────────────────────────────
 * الفجوة التي يسدّها
 * ──────────────────
 * autoBackup.ts كان يكتب لقطة JSON يومياً في مجلد المستندات — مكانٌ يبقى
 * بعد حذف التطبيق. لكن **لا شيء في التطبيق كان يقرأ تلك الملفات**.
 * القراءة الوحيدة كانت في rotate() لحذف الأقدم.
 *
 * النتيجة عملياً: المستخدم يحذف التطبيق ويُعيد تثبيته، وملفات نسخه
 * موجودة أمامه على الهاتف، والتطبيق لا يملك أي طريقة لاستعمالها. ميزةٌ
 * نصفها مبني — وهو أسوأ من عدم بنائها، لأنها تمنح شعوراً زائفاً بالأمان.
 *
 * هذا الملف يُكمل النصف الثاني: سرد النسخ، معاينتها، وإرجاعها بأمان.
 *
 * مبادئ السلامة المُطبَّقة هنا:
 *   1. لا نكتب شيئاً قبل التحقّق من أن الملف نسخةُ هذا التطبيق فعلاً.
 *   2. قبل أي استبدال، نحفظ لقطة "ما قبل الاسترجاع" — تراجعٌ ممكن دائماً.
 *   3. فشل أي مفتاح يُبلَّغ عنه صراحةً ولا يُبتلع (التخزين قد يمتلئ).
 */
import { Capacitor } from '@capacitor/core';
import { DATA_KEYS, DIR, BACKUP_PREFIX } from './autoBackup';
import { dateFromName, mergeValue, isMeaningful } from './backupMerge';
import { reportWriteFailure } from './storageHealth';
import { logError } from './errorLog';

/** لقطة الحالة الراهنة قبل الاسترجاع — ملفٌ واحد يُستبدل في كل مرة. */
const PRE_RESTORE_NAME = 'notic-prerestore.json';
/** نعرض عرض الاسترجاع مرة واحدة لكل تثبيت، لا عند كل إقلاع. */
const OFFERED_KEY = 'notic-restore-offered';

type Dir = import('@capacitor/filesystem').Directory;

export interface BackupFile {
  name: string;
  /** المسار داخل المجلد المُختار */
  path: string;
  directory: Dir;
  /** هل هو في مجلد يبقى بعد حذف التطبيق؟ */
  survivesUninstall: boolean;
  /** التاريخ المُستخرج من اسم الملف — أدقّ من mtime بعد النسخ/النقل */
  createdAt: Date | null;
  bytes: number;
}

export interface BackupEnvelope {
  app: string;
  version: number;
  createdAt: string;
  data: Record<string, unknown>;
}

/**
 * يسرد النسخ المتاحة من المجلدين معاً.
 *
 * نفحص الاثنين لأن الكتابة تحاول Documents أولاً وتتراجع إلى Data عند
 * الرفض — فقد تكون نسخ المستخدم موزّعة بين المجلدين عبر الزمن، والبحث
 * في واحد فقط كان سيُخفي نصف نسخه عنه بلا أي رسالة.
 */
export async function listBackups(): Promise<BackupFile[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const out: BackupFile[] = [];
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const targets: Array<[Dir, boolean]> = [
      [Directory.Documents, true],
      [Directory.Data, false],
    ];
    for (const [directory, survivesUninstall] of targets) {
      try {
        const { files } = await Filesystem.readdir({ path: DIR, directory });
        for (const f of files) {
          const name = typeof f === 'string' ? f : f.name;
          if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith('.json')) continue;
          const bytes = typeof f === 'string' ? 0 : (f.size ?? 0);
          out.push({
            name,
            path: `${DIR}/${name}`,
            directory,
            survivesUninstall,
            createdAt: dateFromName(name),
            bytes,
          });
        }
      } catch {
        // المجلد غير موجود في هذه الوجهة — حالة طبيعية لا خطأ.
      }
    }
  } catch (e) {
    logError('restore', e);
    return [];
  }
  // الأحدث أولاً؛ الملفات بلا تاريخ صالح تُدفع للآخر
  return out.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** يقرأ ملف نسخة ويتحقّق من بنيته. يُعيد null إن لم يكن نسخةً صالحة. */
export async function readBackup(file: BackupFile): Promise<BackupEnvelope | null> {
  try {
    const { Filesystem, Encoding } = await import('@capacitor/filesystem');
    const { data } = await Filesystem.readFile({
      path: file.path,
      directory: file.directory,
      encoding: Encoding.UTF8,
    });
    const parsed: unknown = JSON.parse(typeof data === 'string' ? data : '');
    if (
      !parsed || typeof parsed !== 'object' ||
      (parsed as BackupEnvelope).app !== 'Notic Tahiro' ||
      typeof (parsed as BackupEnvelope).data !== 'object' ||
      (parsed as BackupEnvelope).data === null
    ) {
      logError('restore', `ملف ليس نسخة صالحة: ${file.name}`, 'warn');
      return null;
    }
    return parsed as BackupEnvelope;
  } catch (e) {
    logError('restore', e);
    return null;
  }
}

/** عدد العناصر في كل مفتاح — لعرضه قبل الاسترجاع. */
export function previewBackup(env: BackupEnvelope): { counts: Record<string, number>; total: number } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const key of DATA_KEYS) {
    const v = env.data[key];
    const n = Array.isArray(v) ? v.length : v === undefined || v === null ? 0 : 1;
    if (n > 0) { counts[key] = n; total += n; }
  }
  return { counts, total };
}

/** هل التطبيق فارغ فعلياً؟ (تثبيت جديد — لا شيء يُخشى فقدانه) */
export function isAppEmpty(): boolean {
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      if (isMeaningful(JSON.parse(raw) as unknown)) return false;
    } catch {
      // مفتاح تالف لا يُعدّ محتوى
    }
  }
  return true;
}

/**
 * بعد إعادة التثبيت: هل نعرض على المستخدم استرجاع نسخته؟
 * الشرطان معاً — التطبيق فارغ **و** توجد نسخة. ونعرض مرة واحدة فقط،
 * فمن رفض العرض لا يُلاحَق به عند كل فتح.
 */
export async function findRestoreOffer(): Promise<BackupFile | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try { if (localStorage.getItem(OFFERED_KEY)) return null; } catch { return null; }
  if (!isAppEmpty()) return null;
  const backups = await listBackups();
  return backups[0] ?? null;
}

/** يُعلّم أن العرض قُدِّم (قُبل أو رُفض) فلا يتكرّر. */
export function markRestoreOffered(): void {
  try { localStorage.setItem(OFFERED_KEY, '1'); } catch { /* غير حرج */ }
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  ok: boolean;
  /** المفاتيح التي كُتبت بنجاح */
  restored: string[];
  /** المفاتيح التي فشلت الكتابة فيها (التخزين ممتلئ غالباً) */
  failed: string[];
  /** هل حُفظت لقطة تراجع قبل الاستبدال؟ */
  undoSaved: boolean;
}

/** يقرأ قيمة مفتاح من التخزين الحالي. */
function readCurrent(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * يكتب لقطة الحالة الراهنة إلى ملف تراجع واحد يُستبدل في كل مرة.
 * اسمه خارج بادئة النسخ التلقائية عمداً: فلا يُحذف في التدوير، ولا
 * يظهر في قائمة النسخ فيُربك المستخدم.
 */
async function saveUndoSnapshot(): Promise<boolean> {
  if (isAppEmpty()) return false; // لا شيء يُخشى فقدانه
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const data: Record<string, unknown> = {};
    for (const key of DATA_KEYS) {
      const v = readCurrent(key);
      if (v !== undefined) data[key] = v;
    }
    const content = JSON.stringify({
      app: 'Notic Tahiro', version: 1, createdAt: new Date().toISOString(), data,
    });
    for (const directory of [Directory.Documents, Directory.Data]) {
      try {
        await Filesystem.mkdir({ path: DIR, directory, recursive: true }).catch(() => { /* موجود */ });
        await Filesystem.writeFile({
          path: `${DIR}/${PRE_RESTORE_NAME}`, data: content, directory, encoding: Encoding.UTF8,
        });
        return true;
      } catch { /* جرّب الوجهة التالية */ }
    }
    return false;
  } catch (e) {
    logError('restore', e, 'warn');
    return false;
  }
}

/**
 * يُرجع البيانات من نسخة احتياطية.
 *
 * ⚠️ لا يُعيد تحميل الواجهة بنفسه. الحالة في React قُرئت من localStorage
 * عند الإقلاع، فالكتابة وحدها لا تُحدّث الشاشة — المُستدعي هو من يقرّر
 * متى يُعيد التحميل، بعد أن يعرض للمستخدم ما نجح وما فشل.
 */
export async function restoreBackup(env: BackupEnvelope, mode: RestoreMode): Promise<RestoreResult> {
  const restored: string[] = [];
  const failed: string[] = [];

  const undoSaved = mode === 'replace' ? await saveUndoSnapshot() : false;

  for (const key of DATA_KEYS) {
    const incoming = env.data[key];
    if (incoming === undefined) continue; // النسخة لا تحمل هذا المفتاح
    const value = mode === 'replace' ? incoming : mergeValue(readCurrent(key), incoming);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      restored.push(key);
    } catch (e) {
      // التخزين ممتلئ غالباً — نُبلّغ القناة نفسها التي تُغذّي شريط التحذير
      reportWriteFailure(key, e);
      logError('restore', `تعذّرت كتابة ${key}: ${String(e)}`);
      failed.push(key);
    }
  }

  return { ok: failed.length === 0 && restored.length > 0, restored, failed, undoSaved };
}
