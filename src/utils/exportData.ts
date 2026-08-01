/**
 * exportData.ts — أدوات تصدير البيانات (CSV) لـ Notic Tahiro
 * ─────────────────────────────────────────────────────────────────────
 * تُصدّر المعاملات أو الديون كملف CSV يفتحه المستخدم في Excel/Sheets.
 * تعمل على الجوال (عبر مشاركة ملف) والويب (تنزيل مباشر).
 *
 * CSV مُتوافق مع Excel العربي: نُضيف BOM (\uFEFF) ليعرض العربية صحيحة.
 */

import { Capacitor } from '@capacitor/core';

/** يحوّل صفوف بيانات إلى نص CSV (مع تهريب الفواصل وعلامات التنصيص) */
function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return '\uFEFF' + lines.join('\n'); // BOM للعربية
}

/**
 * يُصدّر بيانات كملف CSV. على الجوال يفتح قائمة المشاركة (حفظ/إرسال)،
 * على الويب يُنزّل الملف مباشرة.
 */
export async function exportCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<boolean> {
  const csv = toCSV(headers, rows);

  // ─── الجوال: نكتب ملفاً ونفتح المشاركة ───────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const path = `${filename}.csv`;
      await Filesystem.writeFile({
        path,
        data: csv,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: filename,
        url: uri,
        dialogTitle: filename,
      });
      return true;
    } catch (e) {
      console.warn('[exportCSV] native export failed:', e);
      return false;
    }
  }

  // ─── الويب: تنزيل مباشر ───────────────────────────────────────────
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.warn('[exportCSV] web export failed:', e);
    return false;
  }
}
