/**
 * haptics.ts — غلاف آمن لردود الفعل اللمسية
 * يعمل على الأجهزة الحقيقية فقط ويتلاشى بصمت على الويب أو عند فشل الإضافة.
 */
import { Capacitor } from '@capacitor/core';

const enabled = Capacitor.isNativePlatform();

type Style = 'light' | 'medium' | 'heavy';

let _hapticsApi: typeof import('@capacitor/haptics') | null = null;
async function api() {
  if (!enabled) return null;
  if (_hapticsApi) return _hapticsApi;
  try {
    _hapticsApi = await import('@capacitor/haptics');
    return _hapticsApi;
  } catch {
    return null;
  }
}

/** نقرة خفيفة — للأزرار العامة وتأكيدات الحفظ. */
export async function tap(style: Style = 'light'): Promise<void> {
  const h = await api();
  if (!h) return;
  try {
    const map = {
      light: h.ImpactStyle.Light,
      medium: h.ImpactStyle.Medium,
      heavy: h.ImpactStyle.Heavy,
    } as const;
    await h.Haptics.impact({ style: map[style] });
  } catch {}
}

/** إشعار نجاح — بعد حفظ ملاحظة أو إكمال مهمة. */
export async function success(): Promise<void> {
  const h = await api();
  if (!h) return;
  try {
    await h.Haptics.notification({ type: h.NotificationType.Success });
  } catch {}
}

/** إشعار تحذير — قبل عملية حذف. */
export async function warning(): Promise<void> {
  const h = await api();
  if (!h) return;
  try {
    await h.Haptics.notification({ type: h.NotificationType.Warning });
  } catch {}
}

/** اهتزاز قصير — للأخطاء أو الإجراءات الحرجة. */
export async function error(): Promise<void> {
  const h = await api();
  if (!h) return;
  try {
    await h.Haptics.notification({ type: h.NotificationType.Error });
  } catch {}
}
