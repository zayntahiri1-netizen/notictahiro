/**
 * noteLock.ts — قفل الملاحظات/الأفكار برقم سري (تشفير حقيقي، لا قفل واجهة شكلي)
 * ─────────────────────────────────────────────────────────────────────
 * بما أن الملاحظات تُخزَّن في localStorage (بدون مزامنة سحابية)، فإن قفل
 * "واجهة فقط" يمكن تجاوزه بسهولة بفحص localStorage مباشرة. لذلك نُشفِّر
 * المحتوى فعلياً عبر Web Crypto API (مدمجة في كل المتصفحات/WebView، بدون
 * أي مكتبة خارجية):
 *
 *   1) PBKDF2-SHA256 (100,000 تكرار) يستخلص مفتاح تشفير من الرقم السري
 *      + salt عشوائي فريد لكل ملاحظة (الرقم السري نفسه لا يُخزَّن أبداً).
 *   2) AES-GCM-256 يُشفِّر النص — وبفضل خاصية "tag" المُدمجة في GCM، فإن
 *      فك التشفير يفشل تلقائياً برقم سري خاطئ (هذا ما يُستخدَم للتحقق من
 *      صحة الرقم، فلا حاجة لتخزين أو تجزيء الرقم السري بشكل منفصل).
 *   3) IV (متجه التهيئة) يُولَّد عشوائياً وفريداً عند كل عملية تشفير
 *      (كل حفظ) — لا يُعاد استخدامه أبداً مع نفس المفتاح.
 *
 * ⚠️ لا يوجد "استرجاع" للرقم السري المنسي — هذا هو المقصود من التشفير
 * الحقيقي. يجب تحذير المستخدم بوضوح عند إنشاء القفل لأول مرة.
 */

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000; // تجزيء لتفادي تجاوز حدود المكدس على محتوى كبير
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const salt = fromBase64(saltB64);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** salt عشوائي جديد — يُولَّد مرة واحدة فقط عند تفعيل القفل لأول مرة */
export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

/** يُشفِّر النص — يُستدعى عند كل حفظ لملاحظة مقفلة (IV جديد كل مرة) */
export async function encryptNoteContent(
  plainText: string,
  pin: string,
  saltB64: string
): Promise<{ cipher: string; iv: string }> {
  const key = await deriveKey(pin, saltB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plainText);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { cipher: toBase64(cipherBuf), iv: toBase64(iv.buffer) };
}

/**
 * يفكّ تشفير النص. يرمي خطأً إن كان الرقم السري خاطئاً (يُستخدَم هذا
 * السلوك أيضاً للتحقق من صحة الرقم — لا حاجة لدالة تحقق منفصلة).
 */
export async function decryptNoteContent(
  cipherB64: string,
  ivB64: string,
  pin: string,
  saltB64: string
): Promise<string> {
  const key = await deriveKey(pin, saltB64);
  const iv = fromBase64(ivB64);
  const cipherBytes = fromBase64(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}
