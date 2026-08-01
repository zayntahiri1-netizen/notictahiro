/**
 * notifications.ts — نظام الإشعارات المحلية الموحد
 * يجدول إشعارات حقيقية على Android/iOS عبر Capacitor LocalNotifications:
 *   • منبهات الملاحظات (alarm.alarmTime)
 *   • استحقاقات الديون (قبل يوم واحد + يوم الاستحقاق صباحاً)
 *   • تذكير العادات المسائي (8 مساءً إذا توجد عادات لم تُنجز)
 * على الويب: يتجاهل بصمت (الإشعارات تتطلب التطبيق الأصلي).
 */

import type { DebtCredit, Note } from '../context/AppContext';

// معرّفات ثابتة لكل نوع لتجنب التكرار (نطاقات منفصلة)
const ID_BASE_NOTE  = 100_000;
const ID_BASE_DEBT  = 200_000;
const ID_HABIT_DAILY = 300_001;


// ─── نصوص الإشعارات متعددة اللغات ──────────────────────────────────
type NotifLang = 'ar' | 'en' | 'es' | 'zh';
function getNotifLang(): NotifLang {
  try {
    const l = localStorage.getItem('notic-language');
    if (l === 'ar' || l === 'en' || l === 'es' || l === 'zh') return l;
  } catch { /* بيئة بدون storage */ }
  return 'en';
}
const NOTIF_TXT: Record<NotifLang, {
  noteTime: string;
  debtTomorrowTitle: string; debtTodayTitle: string;
  owesYou: (n: string) => string; youOwe: (n: string) => string;
  amount: (a: number, c: string) => string;
  habitTitle: string; habitBody: string;
}> = {
  ar: {
    noteTime: 'حان وقت ملاحظتك',
    debtTomorrowTitle: '💳 تذكير: استحقاق غداً',
    debtTodayTitle: '💳 استحقاق اليوم',
    owesYou: n => `${n} مدين لك`,
    youOwe: n => `أنت مدين لـ ${n}`,
    amount: (a, c) => `بمبلغ ${a} ${c}`,
    habitTitle: '🔥 لا تكسر سلسلتك!',
    habitBody: 'تبقّى وقت لإنجاز عادات اليوم. افتح متتبع العادات الآن.',
  },
  en: {
    noteTime: 'Time for your note',
    debtTomorrowTitle: '💳 Reminder: due tomorrow',
    debtTodayTitle: '💳 Due today',
    owesYou: n => `${n} owes you`,
    youOwe: n => `You owe ${n}`,
    amount: (a, c) => `${a} ${c}`,
    habitTitle: "🔥 Don't break your streak!",
    habitBody: "There's still time to finish today's habits. Open the habit tracker now.",
  },
  es: {
    noteTime: 'Es hora de tu nota',
    debtTomorrowTitle: '💳 Recordatorio: vence mañana',
    debtTodayTitle: '💳 Vence hoy',
    owesYou: n => `${n} te debe`,
    youOwe: n => `Le debes a ${n}`,
    amount: (a, c) => `${a} ${c}`,
    habitTitle: '🔥 ¡No rompas tu racha!',
    habitBody: 'Aún hay tiempo para completar los hábitos de hoy. Abre el rastreador ahora.',
  },
  zh: {
    noteTime: '该看看你的笔记了',
    debtTomorrowTitle: '💳 提醒：明天到期',
    debtTodayTitle: '💳 今天到期',
    owesYou: n => `${n} 欠你`,
    youOwe: n => `你欠 ${n}`,
    amount: (a, c) => `${a} ${c}`,
    habitTitle: '🔥 不要中断你的连续记录！',
    habitBody: '今天的习惯还有时间完成。立即打开习惯追踪器。',
  },
};

let _available: boolean | null = null;

/**
 * ⚠️ نفس الفخ الذي عطّل AdMob: إعادة كائن إضافة Capacitor من دالة async
 * تجعل `await` يعامله كـ «وعد» (لأن الـ Proxy يُنتج دالة `then` وهمية لا
 * تستدعي resolve أبداً) فيتعلّق الانتظار للأبد.
 * الحل: نغلّف الكائن داخل غلاف بسيط، فلا يُفحص الكائن نفسه كـ thenable.
 */
async function getPlugin() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const mod = await import('@capacitor/local-notifications');
    // نُعيد الكائن عبر غلاف { p } بدل إعادته مباشرة — يمنع معاملته كـ thenable
    return mod.LocalNotifications ? { p: mod.LocalNotifications } : null;
  } catch {
    return null;
  }
}

/** طلب الإذن مرة واحدة — يُستدعى عند أول تفعيل منبه */
export async function ensureNotificationPermission(): Promise<boolean> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN) return false;
  try {
    const status = await LN.checkPermissions();
    if (status.display === 'granted') { _available = true; return true; }
    const req = await LN.requestPermissions();
    _available = req.display === 'granted';
    return _available;
  } catch {
    _available = false;
    return false;
  }
}

function hashId(base: number, key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return base + (Math.abs(h) % 90_000);
}

/** جدولة منبه ملاحظة (يُلغي القديم لنفس الملاحظة أولاً، ويجدول المنبهات المتسلسلة) */
export async function scheduleNoteAlarm(note: Note): Promise<void> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN || !note.alarm?.hasAlarm || !note.alarm.alarmTime) return;
  const when = new Date(note.alarm.alarmTime);
  if (when.getTime() <= Date.now()) return;

  const id = hashId(ID_BASE_NOTE, note.id);
  const noteBody = (note.aiData?.summary || note.content || '').replace(/[#*>`\u0060]/g, '').slice(0, 100) || NOTIF_TXT[getNotifLang()].noteTime;

  // ── بناء قائمة الإشعارات: المنبه الرئيسي + المتسلسلة ──────────
  const notifList: Array<{
    id: number; title: string; body: string;
    schedule: { at: Date; every?: 'day' | 'week' | 'month' };
  }> = [];

  // المنبه الرئيسي
  notifList.push({
    id,
    title: '⏰ ' + note.title,
    body: noteBody,
    schedule: note.alarm.isRecurring
      ? {
          at: when,
          every: note.alarm.recurrenceType === 'daily' ? 'day'
               : note.alarm.recurrenceType === 'weekly' ? 'week'
               : 'month',
        }
      : { at: when },
  });

  // المنبهات المتسلسلة (تذكير مسبق) — كانت تُبنى لكن لا تُجدَّل (إصلاح)
  if (note.alarm.chainedAlarms?.length) {
    note.alarm.chainedAlarms.forEach((chained, i) => {
      const chainedAt = new Date(chained.time);
      if (chainedAt.getTime() <= Date.now()) return; // تجاوز المواعيد الماضية
      const chainedId = hashId(ID_BASE_NOTE, `${note.id}:chain:${i}`);
      notifList.push({
        id: chainedId,
        title: `🔔 ${chained.label}`,
        body: note.title,
        schedule: { at: chainedAt },
      });
    });
  }

  try {
    // إلغاء جميع المنبهات القديمة لهذه الملاحظة قبل إعادة الجدولة
    const allIds = notifList.map(n => ({ id: n.id }));
    await LN.cancel({ notifications: allIds });

    await LN.schedule({
      notifications: notifList.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: n.schedule,
        sound: 'default',
        smallIcon: 'ic_stat_notification',
      })),
    });
  } catch (e) {
    console.warn('[notifications] note alarm failed:', e);
  }
}
export async function cancelNoteAlarm(noteId: string, chainCount = 3): Promise<void> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN) return;
  try {
    // إلغاء المنبه الرئيسي + ما يصل إلى chainCount من المنبهات المتسلسلة
    const ids = [
      { id: hashId(ID_BASE_NOTE, noteId) },
      ...Array.from({ length: chainCount }, (_, i) => ({
        id: hashId(ID_BASE_NOTE, `${noteId}:chain:${i}`),
      })),
    ];
    await LN.cancel({ notifications: ids });
  } catch { /* ignore */ }
}
/** جدولة تذكيرات دين: قبل يوم (6 مساءً) + يوم الاستحقاق (9 صباحاً) */
export async function scheduleDebtReminders(debt: DebtCredit): Promise<void> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN || debt.status === 'paid') return;

  const due = new Date(debt.dueDate);
  const dayBefore = new Date(due); dayBefore.setDate(due.getDate() - 1); dayBefore.setHours(18, 0, 0, 0);
  const dueMorning = new Date(due); dueMorning.setHours(9, 0, 0, 0);

  const remaining = debt.amount - debt.paidAmount;
  const TXT = NOTIF_TXT[getNotifLang()];
  const who = debt.type === 'credit' ? TXT.owesYou(debt.personName) : TXT.youOwe(debt.personName);
  const idBefore = hashId(ID_BASE_DEBT, debt.id + ':before');
  const idDue    = hashId(ID_BASE_DEBT, debt.id + ':due');

  const toSchedule: Array<{ id: number; title: string; body: string; at: Date }> = [];
  if (dayBefore.getTime() > Date.now())
    toSchedule.push({ id: idBefore, title: TXT.debtTomorrowTitle, body: `${who} — ${TXT.amount(remaining, debt.currency)}`, at: dayBefore });
  if (dueMorning.getTime() > Date.now())
    toSchedule.push({ id: idDue, title: TXT.debtTodayTitle, body: `${who} — ${TXT.amount(remaining, debt.currency)}`, at: dueMorning });

  if (!toSchedule.length) return;
  try {
    await LN.cancel({ notifications: [{ id: idBefore }, { id: idDue }] });
    await LN.schedule({
      notifications: toSchedule.map(n => ({
        id: n.id, title: n.title, body: n.body,
        schedule: { at: n.at }, sound: 'default', smallIcon: 'ic_stat_notification',
      })),
    });
  } catch (e) {
    console.warn('[notifications] debt reminder failed:', e);
  }
}

export async function cancelDebtReminders(debtId: string): Promise<void> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN) return;
  try {
    await LN.cancel({ notifications: [
      { id: hashId(ID_BASE_DEBT, debtId + ':before') },
      { id: hashId(ID_BASE_DEBT, debtId + ':due') },
    ]});
  } catch { /* ignore */ }
}

/** تذكير العادات اليومي 8 مساءً (متكرر) — يُفعَّل مرة واحدة */
export async function scheduleHabitDailyReminder(): Promise<void> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN) return;
  const at = new Date(); at.setHours(20, 0, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  try {
    await LN.cancel({ notifications: [{ id: ID_HABIT_DAILY }] });
    await LN.schedule({
      notifications: [{
        id: ID_HABIT_DAILY,
        title: NOTIF_TXT[getNotifLang()].habitTitle,
        body: NOTIF_TXT[getNotifLang()].habitBody,
        schedule: { at, every: 'day' },
        sound: 'default',
        smallIcon: 'ic_stat_notification',
      }],
    });
  } catch (e) {
    console.warn('[notifications] habit reminder failed:', e);
  }
}

export async function cancelHabitDailyReminder(): Promise<void> {
  const LN = (await getPlugin())?.p ?? null;
  if (!LN) return;
  try { await LN.cancel({ notifications: [{ id: ID_HABIT_DAILY }] }); } catch { /* ignore */ }
}
