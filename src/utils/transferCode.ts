/**
 * transferCode.ts — ترميز رمز النقل بين هاتفين (خالص، بلا اعتماديات)
 * ───────────────────────────────────────────────────────────────────────
 * المزامنة المربوطة بالجهاز لا تنتقل لهاتف آخر بطبيعتها. هذا الرمز يمنح
 * ذلك الانتقال بلا حساب: يُقرأ من الهاتف القديم ويُدخَل في الجديد.
 *
 * فُصل عن deviceIdentity.ts ليكون قابلاً للاختبار وحده: خطأ حرف واحد
 * هنا يعني رمزاً يبدو سليماً ولا يفتح شيئاً — عطبٌ لا يظهر إلا يوم
 * ينتقل المستخدم لهاتف جديد، وهو أسوأ وقت لاكتشافه.
 *
 * الشكل: 16 بايت معرّف + 16 بايت سرّ = 32 بايت → base64url (43 محرفاً).
 */

export interface TransferPayload {
  deviceId: string;
  secret: string;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** يحوّل الهوية إلى رمز نصّي. يرمي إن كانت الهوية مشوّهة. */
export function encodeTransferCode(id: TransferPayload): string {
  const hex = id.deviceId.replace(/-/g, '');
  if (hex.length !== 32 || id.secret.length !== 32) {
    throw new Error('هوية بطول غير متوقّع');
  }
  const all = new Uint8Array(32);
  all.set(hexToBytes(hex), 0);
  all.set(hexToBytes(id.secret), 16);
  return b64urlEncode(all);
}

/**
 * يقرأ رمز نقل. يُعيد null لأي رمز غير صالح.
 * نتسامح مع المسافات وفواصل الأسطر: المستخدم سينسخه من رسالة أو صورة،
 * ورفضُ رمزٍ صحيح بسبب مسافة زائدة إحباطٌ بلا سبب.
 */
export function decodeTransferCode(code: string): TransferPayload | null {
  const bytes = b64urlDecode(code.trim().replace(/\s+/g, ''));
  if (!bytes || bytes.length !== 32) return null;
  const h = bytesToHex(bytes.slice(0, 16));
  return {
    deviceId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
    secret: bytesToHex(bytes.slice(16)),
  };
}

/** تقسيم بصري يسهّل النسخ والقراءة — لا يُغيّر الرمز نفسه. */
export function prettyCode(code: string): string {
  return (code.match(/.{1,11}/g) ?? [code]).join(' ');
}
