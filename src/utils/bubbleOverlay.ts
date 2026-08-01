/**
 * bubbleOverlay.ts — جسر JS↔Native لميزة "الفقعة العائمة"
 * ─────────────────────────────────────────────────────────────────────
 * يتواصل مع BubbleOverlayPlugin.java + BubbleService.java (انظر
 * android-patches/apply-bubble-overlay.sh) عبر Capacitor registerPlugin.
 *
 * Android فقط — iOS لا يدعم النوافذ العائمة فوق التطبيقات الأخرى
 * إطلاقاً بسبب قيود نظام Apple، والويب لا معنى له هنا (لا يوجد
 * "تطبيقات أخرى" خارج المتصفح). كل الدوال هنا تتحقق من المنصة أولاً
 * وتُرجع قيماً آمنة (false/null) على غير أندرويد بدل رمي أخطاء.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface BubbleOverlayPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isActive(): Promise<{ active: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  ensureRunning(): Promise<{ enabled: boolean; restarted: boolean }>;
  getPendingAction(): Promise<{ action: string }>;
  setLanguage(options: { lang: string }): Promise<void>;
}

const BubbleOverlay = registerPlugin<BubbleOverlayPlugin>('BubbleOverlay');

/** الميزة متاحة فقط على أندرويد الأصلي (ليست الويب أو iOS) */
export function isBubbleSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** هل إذن "العرض فوق التطبيقات الأخرى" مُمنوح حالياً؟ */
export async function checkBubblePermission(): Promise<boolean> {
  if (!isBubbleSupported()) return false;
  try {
    const { granted } = await BubbleOverlay.checkPermission();
    return granted;
  } catch {
    return false;
  }
}

/** يفتح شاشة إعدادات النظام لمنح الإذن يدوياً (لا يمكن طلبه تلقائياً) */
export async function requestBubblePermission(): Promise<void> {
  if (!isBubbleSupported()) return;
  try { await BubbleOverlay.requestPermission(); } catch { /* ignore */ }
}

/** يبدأ خدمة الفقعة (يفشل بهدوء إن لم يكن الإذن مُمنوحاً) */
export async function startBubble(): Promise<boolean> {
  if (!isBubbleSupported()) return false;
  try {
    await BubbleOverlay.start();
    return true;
  } catch {
    return false;
  }
}

/** يوقف خدمة الفقعة */
export async function stopBubble(): Promise<void> {
  if (!isBubbleSupported()) return;
  try { await BubbleOverlay.stop(); } catch { /* ignore */ }
}

/** هل الفقعة نشطة الآن؟ (حالة الخدمة اللحظية في الذاكرة) */
export async function isBubbleActive(): Promise<boolean> {
  if (!isBubbleSupported()) return false;
  try {
    const { active } = await BubbleOverlay.isActive();
    return active;
  } catch {
    return false;
  }
}

/** هل الفقعة "مُفعَّلة" (الحالة المحفوظة التي اختارها المستخدم)؟
 *  هذا المصدر الصحيح لعرض حالة المفتاح — لا يتأثّر بقتل النظام للخدمة. */
export async function isBubbleEnabled(): Promise<boolean> {
  if (!isBubbleSupported()) return false;
  try {
    const { enabled } = await BubbleOverlay.isEnabled();
    return enabled;
  } catch {
    return false;
  }
}

/** يضمن تشغيل الفقعة إن كانت مُفعَّلة وقُتلت — يُستدعى عند فتح التطبيق.
 *  يُرجع الحالة المحفوظة (enabled) ليُحدّث الواجهة بها. */
export async function ensureBubbleRunning(): Promise<boolean> {
  if (!isBubbleSupported()) return false;
  try {
    const { enabled } = await BubbleOverlay.ensureRunning();
    return enabled;
  } catch {
    return false;
  }
}

/** يُزامِن لغة قائمة الفقعة الأصلية (Java) مع لغة التطبيق الحالية —
 *  بدون هذا تبقى قائمة الفقعة بالعربية دائماً بصرف النظر عن لغة المستخدم. */
export async function setBubbleLanguage(lang: string): Promise<void> {
  if (!isBubbleSupported()) return;
  try { await BubbleOverlay.setLanguage({ lang }); } catch { /* ignore */ }
}

export type BubbleAction = 'quick_note' | 'ai_chat' | 'reminder' | '';

/**
 * يستهلك الإجراء المُؤجَّل (إن وُجد) القادم من اختيار المستخدم في
 * قائمة الفقعة — يُستدعى مرة واحدة عند تشغيل التطبيق/استئنافه.
 * يُعيد '' إن لم يكن هناك إجراء معلَّق أو على غير أندرويد.
 */
export async function consumePendingBubbleAction(): Promise<BubbleAction> {
  if (!isBubbleSupported()) return '';
  try {
    const { action } = await BubbleOverlay.getPendingAction();
    return (action as BubbleAction) || '';
  } catch {
    return '';
  }
}
