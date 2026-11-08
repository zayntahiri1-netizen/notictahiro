/**
 * siteLinks.ts — روابط الصفحات القانونية العامة
 * ───────────────────────────────────────────────────────────────────────
 * Google Play تشترط رابطاً **عاماً** لسياسة الخصوصية وآخر لحذف البيانات:
 * رابطاً يفتحه مراجعُ Play ومستخدمٌ لم يثبّت التطبيق أصلاً. وصفحةٌ تعيش
 * داخل التطبيق وحده لا تفي بذلك مهما كان محتواها.
 *
 * فهذه الروابط تشير إلى الموقع المنشور، وتُفتح في متصفّح النظام خارج
 * التطبيق.
 *
 * ⚠️ المسارات بلا امتداد .html عن قصد. استضافة Firebase تعيد توجيه **
 *    إلى index.html، فيلتقط الموجّه الداخلي المسار ويعرض الصفحة. ورابطٌ
 *    ينتهي بـ.html يُقيّد الموقع بشكل ملفاته، ويكسر كل رابط نشرته إن
 *    تغيّرت بنية البناء يوماً.
 *
 * ⚠️ قبل أن تعمل هذه الروابط يجب نشر الموقع مرة واحدة:
 *      npx vite build && npx firebase-tools deploy --only hosting
 *    وإلا فُتحت صفحة غير موجودة.
 */

/** أصل الموقع المنشور — بلا شرطة في آخره. */
export const SITE_ORIGIN = 'https://notictahiro.web.app';

export const SITE = {
  privacy: `${SITE_ORIGIN}/privacy`,
  terms: `${SITE_ORIGIN}/terms`,
  deleteData: `${SITE_ORIGIN}/delete-data`,
} as const;

/** الناشر المسؤول — يظهر في الصفحات القانونية وتطلبه Play للتعريف. */
export const PUBLISHER = {
  name: 'Ahmed Bakkali Tahiri',
  email: 'zayntahiri1@gmail.com',
  location: { ar: 'تطوان، المغرب', en: 'Tetouan, Morocco', es: 'Tetuán, Marruecos', zh: '摩洛哥 得土安' },
} as const;
