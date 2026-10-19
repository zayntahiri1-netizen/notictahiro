/**
 * shareTarget.ts — تحويل النصّ المُشارَك إلى ملاحظة
 * ───────────────────────────────────────────────────────────────────────
 * الجزء الأصلي (Java) يلتقط النص من قائمة مشاركة أندرويد. هذا الملف
 * يقرّر شكل الملاحظة الناتجة: ما العنوان وما المحتوى.
 *
 * المنطق هنا خالص بلا أي اعتماد على Capacitor أو DOM — لأنه الجزء الذي
 * يحتاج تدقيقاً فعلياً، ويجب أن يكون قابلاً للاختبار بذاته.
 *
 * قاعدة العنوان: لا نُولّد عنواناً إلا إذا كان **مختلفاً فعلاً** عن
 * المحتوى. تكرار نفس السطر في العنوان والمحتوى يبدو خللاً لا ميزة،
 * والتطبيق أصلاً يعرض "بلا عنوان" بشكل لائق حين يكون فارغاً.
 */

/** حدّ طول العنوان المُشتقّ — بعده نقطع عند أقرب مسافة. */
const TITLE_MAX = 60;

export interface SharedPayload {
  text: string;
  /** EXTRA_SUBJECT من التطبيق المصدر — غالباً فارغ */
  subject?: string;
}

export interface ShapedNote {
  title: string;
  content: string;
}

/** يقطع عند أقرب مسافة قبل الحدّ، بلا بتر كلمة في منتصفها. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  // إن كانت الكلمة الأولى نفسها أطول من الحدّ (رابط مثلاً) نقطع كما هو
  return lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
}

/** هل النصّ كلّه رابط واحد لا غير؟ */
function soleUrl(text: string): URL | null {
  const t = text.trim();
  if (/\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/**
 * يُحوّل حمولة المشاركة إلى {عنوان، محتوى}.
 *
 * الحالات، بالترتيب:
 *   1. عنوان أرسله المصدر (بريد، مقال)     → نستعمله كما هو.
 *   2. رابط وحيد (نسخ رابط من متصفح)        → العنوان = اسم الموقع.
 *   3. نصّ متعدّد الأسطر (مقتطف + رابط)     → العنوان = السطر الأول،
 *                                             المحتوى = ما تبقّى.
 *   4. سطر واحد                             → بلا عنوان، النصّ محتوى.
 */
export function shapeSharedNote(payload: SharedPayload): ShapedNote {
  const text = (payload.text ?? '').trim();
  const subject = (payload.subject ?? '').trim();

  if (!text) return { title: subject, content: '' };

  // 1) عنوان صريح من المصدر
  if (subject && subject !== text) {
    return { title: truncate(subject, TITLE_MAX), content: text };
  }

  // 2) رابط وحيد → اسم الموقع عنواناً (بلا www.)
  const url = soleUrl(text);
  if (url) {
    return { title: url.hostname.replace(/^www\./, ''), content: text };
  }

  // 3) عدّة أسطر → أول سطر غير فارغ عنواناً، والباقي محتوى
  const lines = text.split('\n');
  const firstIdx = lines.findIndex((l) => l.trim() !== '');
  const first = firstIdx >= 0 ? lines[firstIdx].trim() : '';
  const rest = lines.slice(firstIdx + 1).join('\n').trim();
  if (rest && first) {
    return { title: truncate(first, TITLE_MAX), content: rest };
  }

  // 4) سطر واحد — عنوانٌ مُشتقّ منه سيكرّره حرفياً، فنتركه فارغاً
  return { title: '', content: text };
}

/**
 * يُمرّر الملاحظة المُشكَّلة إلى المحرّر عبر نفس آلية sessionStorage
 * التي تستعملها الفقعة والقوالب — آلية قائمة ومُختبَرة، أفضل من إضافة
 * مسار تمرير ثالث للبيانات نفسها.
 */
export function stageSharedNote(shaped: ShapedNote, projectId?: string): void {
  try {
    if (shaped.title) sessionStorage.setItem('notic-ghost-title', shaped.title);
    sessionStorage.setItem(
      'notic-template',
      JSON.stringify({ content: shaped.content, projectId: projectId ?? null }),
    );
  } catch {
    // sessionStorage محجوب — تُفتح ملاحظة فارغة بدل أن ينهار الفتح
  }
}
