/**
 * backlinks.ts — نظام الروابط الثنائية بين الملاحظات
 *
 * الصياغة:  [[اسم الملاحظة]]
 *  • مماثلة بدون حساسية لحالة الأحرف.
 *  • الإشارة لاسم غير موجود تُعتبر "رابط شبح" (ghost link) قابل للإنشاء.
 *
 * هذه الوحدة لا تُعدّل الحالة. تُوفّر دوال خالصة (pure) للقراءة فقط.
 */

import type { Note } from '../context/AppContext';

const LINK_RE = /\[\[([^\[\]\n]+?)\]\]/g;

/** يستخرج أسماء كل الروابط [[X]] من النصّ (بعد إزالة المسافات الزائدة) */
export function extractLinks(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    const name = m[1].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** يبحث عن ملاحظة بعنوان معيّن (بدون حساسية لحالة الأحرف، مع إزالة المسافات) */
export function findNoteByTitle(notes: Note[], title: string): Note | undefined {
  const needle = title.trim().toLowerCase();
  if (!needle) return undefined;
  return notes.find(n => (n.title || '').trim().toLowerCase() === needle);
}

/** يُعيد كل الملاحظات التي تُشير إلى الملاحظة المستهدفة (الإشارات المرتدّة) */
export function getBacklinks(allNotes: Note[], target: Note): Note[] {
  const targetTitle = (target.title || '').trim().toLowerCase();
  if (!targetTitle) return [];
  return allNotes.filter(n => {
    if (n.id === target.id) return false; // لا تَعُدّ الملاحظة نفسها
    if (n.isLocked) return false; // محتوى مُشفَّر — لا يمكن فحصه دون الرقم السري
    return extractLinks(n.content).some(
      link => link.trim().toLowerCase() === targetTitle
    );
  });
}

/** يقترح ملاحظات لاستكمال الكتابة بعد [[ (مطابقة جزئية) */
export function suggestNotes(notes: Note[], query: string, limit = 7): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // بدون استعلام: أعِد آخر الملاحظات المُحدَّثة
    return [...notes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }
  return notes
    .filter(n => (n.title || '').toLowerCase().includes(q))
    .slice(0, limit);
}

/**
 * يكشف ما إذا كان مؤشّر الكتابة الحالي داخل سياق [[...]] غير مكتمل،
 * ويُعيد الاستعلام الحالي وموقع البداية لإدراج الاكتمال لاحقاً.
 */
export function detectLinkContext(
  text: string,
  caret: number
): { query: string; openAt: number } | null {
  // ابحث للخلف من المؤشّر عن [[ ولم نمرّ بـ ]] بعد
  for (let i = caret - 1; i >= Math.max(0, caret - 100); i--) {
    if (text[i] === ']' && text[i - 1] === ']') return null; // قبل المؤشّر مغلق
    if (text[i] === '[' && text[i - 1] === '[') {
      const query = text.slice(i + 1, caret);
      // اعتبره سياقاً صالحاً إذا لم يحوِ سطراً جديداً أو ]]
      if (!query.includes('\n') && !query.includes(']]')) {
        return { query, openAt: i - 1 };
      }
      return null;
    }
  }
  return null;
}

/**
 * يستبدل سياق [[...]] الحالي عند موقع المؤشّر بـ [[العنوان]]
 * ويُعيد النصّ الجديد وموقع المؤشّر الجديد.
 */
export function applyLinkCompletion(
  text: string,
  caret: number,
  ctx: { openAt: number },
  noteTitle: string
): { text: string; caret: number } {
  const before = text.slice(0, ctx.openAt);
  const after = text.slice(caret);
  // ابحث عن أيّ ]] لاحقة قريبة لمنع التكرار
  const trailing = after.startsWith(']]') ? after.slice(2) : after;
  const insertion = `[[${noteTitle}]]`;
  const newText = before + insertion + trailing;
  const newCaret = (before + insertion).length;
  return { text: newText, caret: newCaret };
}
