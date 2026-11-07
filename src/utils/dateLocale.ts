/**
 * dateLocale.ts — تنسيق التواريخ والأرقام بلغة الواجهة
 * ───────────────────────────────────────────────────────────────────────
 * كان 'ar-MA' مكتوباً يدوياً في أربعة عشر موضعاً عبر أحد عشر ملفاً. فكان
 * المستخدم الإنجليزي يقرأ واجهةً إنجليزية ثم يرى «الجمعة، 20 نونبر 2026»
 * تحت سجلّ دَينه، والصيني يرى الشهور بالعربية.
 *
 * المشكلة أنّ التكرار نفسه هو العطب: كل موضع جديد يُكتب فيه 'ar-MA' يعيد
 * الخطأ. فالحلّ مصدرٌ واحد، لا تصحيح أربعة عشر موضعاً وترك الخامس عشر.
 */
import type { AppLanguage } from '../i18n';

/** رمز BCP-47 المناسب للغة الواجهة. */
export const DATE_LOCALES: Record<AppLanguage, string> = {
  ar: 'ar-MA',
  en: 'en-US',
  es: 'es-ES',
  zh: 'zh-CN',
};

/** يُرجع رمز اللغة، ويقع على الإنجليزية إن جاءت قيمة غير متوقَّعة. */
export function localeFor(lang: string | undefined): string {
  return DATE_LOCALES[(lang ?? 'en') as AppLanguage] ?? 'en-US';
}

/** تاريخ مُنسَّق بلغة الواجهة. يقبل Date أو نصاً أو رقماً. */
export function fmtDate(
  value: Date | string | number,
  lang: string | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleDateString(localeFor(lang), opts); }
  catch { return d.toLocaleDateString('en-US', opts); }
}

/** وقت مُنسَّق بلغة الواجهة. */
export function fmtTime(
  value: Date | string | number,
  lang: string | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleTimeString(localeFor(lang), opts); }
  catch { return d.toLocaleTimeString('en-US', opts); }
}

/** تاريخ ووقت معاً. */
export function fmtDateTime(
  value: Date | string | number,
  lang: string | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleString(localeFor(lang), opts); }
  catch { return d.toLocaleString('en-US', opts); }
}

/** رقم مُنسَّق بلغة الواجهة (فواصل الآلاف والعشرية). */
export function fmtNumber(
  value: number,
  lang: string | undefined,
  opts?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return '–';
  try { return value.toLocaleString(localeFor(lang), opts); }
  catch { return value.toLocaleString('en-US', opts); }
}
