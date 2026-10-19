/**
 * backupMerge.ts — منطق الاسترجاع الخالص (بلا ملفات ولا Capacitor)
 * ───────────────────────────────────────────────────────────────────────
 * فُصل عن backupRestore.ts عمداً: هذا هو الجزء الذي يقرّر ما يُكتب فوق
 * بيانات المستخدم، وهو أخطر ما في الميزة — فيجب أن يكون قابلاً للاختبار
 * وحده، بلا نظام ملفات ولا جهاز.
 */

/** بادئة ملفات النسخ (مُكرَّرة هنا عمداً كي يبقى الملف بلا اعتماديات). */
const BACKUP_PREFIX = 'notic-backup-';

/** هل العنصر سجلٌّ له معرّف؟ (لدمج المصفوفات بلا تكرار) */
export function hasId(v: unknown): v is { id: string } {
  return !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string';
}

/**
 * يستخرج تاريخ النسخة من اسم ملفها.
 * الاسم يحمل ISO بنقاطٍ مُستبدلة بشرطات:
 *   notic-backup-2026-10-17T12-30-00-000Z.json
 * نقرأ التاريخ من الاسم لا من mtime، لأن نسخ الملف أو نقله بين المجلدات
 * يُعيد ضبط mtime فيُظهر نسخةً قديمة وكأنها اليوم.
 */
export function dateFromName(name: string): Date | null {
  if (!name.startsWith(BACKUP_PREFIX)) return null;
  const stamp = name.slice(BACKUP_PREFIX.length).replace(/\.json$/, '');
  const m = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * يدمج قيمة من النسخة مع القيمة الحالية.
 *
 * القاعدة الثابتة: **الحالي يفوز دائماً عند التعارض**. الدمج يُضيف ما
 * ينقص فقط — مَن يسترجع نسخة قديمة لا يقصد الكتابة فوق ما كتبه اليوم.
 * (الاستبدال الكامل له وضعه الخاص 'replace'، ويُسبق بلقطة تراجع.)
 */
export function mergeValue(current: unknown, backup: unknown): unknown {
  if (Array.isArray(backup)) {
    if (!Array.isArray(current)) return backup;
    // مصفوفة بلا معرّفات (قائمة نصوص مثلاً): لا سبيل لدمج آمن بلا
    // تكرار، فنُبقي الحالي إن كان فيه شيء بدل خلط لا يُمكن التراجع عنه.
    if (!backup.some(hasId)) return current.length > 0 ? current : backup;
    const seen = new Set(current.filter(hasId).map((x) => x.id));
    return [...current, ...backup.filter((x) => hasId(x) && !seen.has(x.id))];
  }
  if (backup && typeof backup === 'object' && current && typeof current === 'object') {
    return { ...(backup as object), ...(current as object) }; // الحالي يطغى
  }
  return current === undefined || current === null ? backup : current;
}

/**
 * هل هذه القيمة "محتوى فعلي"؟ تُستعمل لتقرير ما إذا كان التطبيق فارغاً.
 * المصفوفة الفارغة والصفر و null ليست محتوى.
 */
export function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}
