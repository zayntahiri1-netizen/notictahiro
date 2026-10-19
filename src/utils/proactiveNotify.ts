/**
 * proactiveNotify.ts — إيصال الرؤية الاستباقية بلا فتح التطبيق
 * ───────────────────────────────────────────────────────────────────────
 * النصف الذي كان ناقصاً
 * ─────────────────────
 * محرّك الرؤى (proactiveInsights.ts) كان يعمل فعلاً، لكنه لا يَظهر إلا
 * داخل نافذة Tahiro AI وهي فارغة. أي أن التطبيق "يُبادر" بشرط أن يفتحه
 * المستخدم أولاً — وهذا ليس مبادرة، بل انتظارٌ مؤدَّب.
 *
 * هنا تصل أهمّ رؤية كإشعار. الحدّ الفاصل الذي اخترناه:
 *
 *   • **الأولوية العالية فقط.** "عندك دين مستحق" يستحق مقاطعة يومك؛
 *     "عندك ملاحظات بلا وسوم" لا يستحقها. إشعارٌ عن أمر تافه يُعلّم
 *     المستخدم تجاهل كل إشعاراتنا، فيضيع الإشعار المهم معها.
 *   • **واحد في اليوم كحدّ أقصى**، ولا نُكرّر نفس الرؤية يومين متتاليين:
 *     رسالة تتكرّر تصير خلفيةً لا يراها أحد.
 *   • **قابل للإطفاء** من الإعدادات بضغطة واحدة.
 */
import type { Note, DebtCredit, Transaction } from '../context/AppContext';
import type { AppLanguage } from '../i18n';
import { generateProactiveInsights } from './proactiveInsights';
import { scheduleProactiveInsight, cancelProactiveInsight } from './notifications';

/**
 * رؤى لها إشعاراتها المخصّصة أصلاً، فلا نُرسلها مرة ثانية.
 * 'debt-due' يغطّيه scheduleDebtReminders (قبل يوم 18:00 + يوم الاستحقاق
 * 9:00). إشعارنا كان سيصل 9:00 عن نفس الدين — إشعاران عن أمر واحد
 * يُعلّمان المستخدم تجاهل كليهما. أما 'budget-gap' فلا يُغطّيه شيء:
 * لا أحد يُخبره أن المستحق يتجاوز ما تبقّى من ميزانيته.
 */
const COVERED_ELSEWHERE = new Set(['debt-due']);

const ENABLED_KEY = 'notic-proactive-notify';
const LAST_SENT_KEY = 'notic-proactive-last';
const LAST_ID_KEY = 'notic-proactive-lastid';

/** مُفعَّل افتراضياً: الميزة بلا إيصال لا قيمة لها، والإطفاء بضغطة. */
export function isProactiveNotifyEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== '0'; } catch { return false; }
}

export function setProactiveNotifyEnabled(on: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* غير حرج */ }
  if (!on) void cancelProactiveInsight();
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export interface ProactiveInput {
  notes: Note[];
  debtsCredits: DebtCredit[];
  transactions: Transaction[];
  language: AppLanguage;
  monthlyBudget?: number;
}

/**
 * يُعيد تسليح إشعار الغد بأحدث رؤية عالية الأولوية.
 * يُستدعى عند الإقلاع وعند كل عودة من الخلفية — الإشعار لمرّة واحدة
 * بطبيعته (انظر scheduleProactiveInsight)، فإعادة التسليح هي ما يُبقيه حيّاً.
 */
export async function refreshProactiveNotification(input: ProactiveInput): Promise<boolean> {
  if (!isProactiveNotifyEnabled()) { await cancelProactiveInsight(); return false; }

  const top = generateProactiveInsights(input)
    .find((i) => i.priority === 'high' && !COVERED_ELSEWHERE.has(i.id));
  if (!top) {
    // لا شيء يستحق المقاطعة اليوم — نُلغي بدل إرسال رسالة فارغة
    await cancelProactiveInsight();
    return false;
  }

  try {
    const lastAt = parseInt(localStorage.getItem(LAST_SENT_KEY) ?? '0', 10) || 0;
    const lastId = localStorage.getItem(LAST_ID_KEY) ?? '';
    // نفس الرؤية أُرسلت اليوم — لا نُعيد جدولتها فتتحوّل إلى ضجيج
    if (top.id === lastId && lastAt > 0 && sameDay(lastAt, Date.now())) return false;
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
    localStorage.setItem(LAST_ID_KEY, top.id);
  } catch { /* تعذّرت القراءة — نُكمل، إشعارٌ زائد أهون من ميزة معطّلة */ }

  await scheduleProactiveInsight(`${top.icon} ${top.title}`, top.description);
  return true;
}
