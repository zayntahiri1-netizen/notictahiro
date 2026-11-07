/**
 * DebtMessageModal.tsx — صياغة رسالة دَين وإرسالها
 * ───────────────────────────────────────────────────────────────────────
 * النبرة أولاً، ثم الرسالة، ثم الإرسال. والمستخدم يملك النصّ: يُعدّله قبل
 * أن يُرسله، لأن رسالةً عن مالٍ بين شخصين لا تُرسَل على عمياء.
 *
 * ⚠️ لا إذن جهات اتصال ولا إذن رسائل — وهذا مقصود، لا تقصير:
 *    إشعار سياسة Google Play في 29 أكتوبر 2026 قيّد READ_CONTACTS ووجّه
 *    التطبيقات الأخرى إلى «عناصر intent الخاصة بالنظام والمحدودة النطاق».
 *    فكل إرسالٍ هنا رابطٌ يفتحه النظام، ويضغط المستخدم «إرسال» بيده.
 *    لا رسالة تُرسَل دون علمه، ولا جهة اتصال تُقرأ.
 */
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  generateDebtMessage, fallbackMessage, waLink, smsLink, telLink,
  getPhone, setPhone, normalizePhone,
  type DebtRole, type MsgTone,
} from '../utils/debtMessage';
import * as haptics from '../utils/haptics';

interface Props {
  personName: string;
  amount: number;
  currency: string;
  dueDate: string;
  /** 'credit' = لك عنده (دائن) · 'debt' = عليك له (مدين) */
  type: 'credit' | 'debt';
  onClose: () => void;
}

const UI = {
  ar: {
    title: 'رسالة إلى', asCreditor: 'أنت الدائن', asDebtor: 'أنت المدين',
    hintCreditor: 'تذكيرٌ يحفظ العلاقة', hintDebtor: 'اعتذارٌ وطلب مهلة',
    tone: 'النبرة', soft: 'ألطف', neutral: 'متوازنة', firm: 'أكثر وضوحاً',
    gen: '✨ ولّد الرسالة', regen: '↻ صُغ غيرها', generating: 'جارٍ الصياغة…',
    offline: 'صيغت محلياً (تعذّر الاتصال)', byAi: 'صيغت بالذكاء الاصطناعي',
    edit: 'يمكنك تعديل النص قبل الإرسال',
    phone: 'رقم الهاتف (اختياري)', phoneHint: 'يُحفظ لهذا الشخص على جهازك فقط',
    send: 'إرسال عبر', wa: 'واتساب', sms: 'رسالة', call: 'اتصال',
    copy: '📋 نسخ', share: '📤 مشاركة', copied: 'نُسخ ✅',
    needPhone: 'أدخل رقم الهاتف أولاً',
    note: 'لا يُرسَل شيء تلقائياً — يفتح التطبيق ثم تضغط إرسال بنفسك.',
  },
  en: {
    title: 'Message to', asCreditor: 'You are owed', asDebtor: 'You owe',
    hintCreditor: 'A reminder that keeps the relationship', hintDebtor: 'An apology and a request for time',
    tone: 'Tone', soft: 'Softer', neutral: 'Balanced', firm: 'Clearer',
    gen: '✨ Write the message', regen: '↻ Try another', generating: 'Writing…',
    offline: 'Written locally (no connection)', byAi: 'Written by AI',
    edit: 'You can edit the text before sending',
    phone: 'Phone number (optional)', phoneHint: 'Saved for this person on your device only',
    send: 'Send via', wa: 'WhatsApp', sms: 'SMS', call: 'Call',
    copy: '📋 Copy', share: '📤 Share', copied: 'Copied ✅',
    needPhone: 'Enter a phone number first',
    note: 'Nothing is sent automatically — the app opens and you press send yourself.',
  },
  es: {
    title: 'Mensaje para', asCreditor: 'Te deben', asDebtor: 'Debes',
    hintCreditor: 'Un recordatorio que cuida la relación', hintDebtor: 'Una disculpa y una petición de tiempo',
    tone: 'Tono', soft: 'Más suave', neutral: 'Equilibrado', firm: 'Más claro',
    gen: '✨ Redactar mensaje', regen: '↻ Probar otro', generating: 'Redactando…',
    offline: 'Redactado localmente (sin conexión)', byAi: 'Redactado con IA',
    edit: 'Puedes editar el texto antes de enviarlo',
    phone: 'Teléfono (opcional)', phoneHint: 'Se guarda para esta persona solo en tu dispositivo',
    send: 'Enviar por', wa: 'WhatsApp', sms: 'SMS', call: 'Llamar',
    copy: '📋 Copiar', share: '📤 Compartir', copied: 'Copiado ✅',
    needPhone: 'Introduce primero un teléfono',
    note: 'No se envía nada automáticamente: se abre la app y tú pulsas enviar.',
  },
  zh: {
    title: '发给', asCreditor: '对方欠你', asDebtor: '你欠对方',
    hintCreditor: '不伤和气的提醒', hintDebtor: '致歉并请求宽限',
    tone: '语气', soft: '更柔和', neutral: '平衡', firm: '更明确',
    gen: '✨ 生成消息', regen: '↻ 换一条', generating: '生成中…',
    offline: '本地生成（无网络）', byAi: '由 AI 生成',
    edit: '发送前可以修改文字',
    phone: '电话号码（可选）', phoneHint: '仅保存在你的设备上',
    send: '发送方式', wa: 'WhatsApp', sms: '短信', call: '拨打',
    copy: '📋 复制', share: '📤 分享', copied: '已复制 ✅',
    needPhone: '请先输入电话号码',
    note: '不会自动发送 — 应用打开后由你自己点击发送。',
  },
} as const;

export default function DebtMessageModal({ personName, amount, currency, dueDate, type, onClose }: Props) {
  const { darkMode, language, direction } = useApp();
  const S = UI[language] ?? UI.en;
  const role: DebtRole = type === 'credit' ? 'creditor' : 'debtor';

  const [tone, setTone] = useState<MsgTone>('neutral');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [byAi, setByAi] = useState(false);
  const [phone, setPhoneState] = useState(() => getPhone(personName));
  const [flash, setFlash] = useState('');

  const input = { personName, amount, currency, dueDate, role, tone, lang: language };

  const gen = useCallback(async (t: MsgTone) => {
    setBusy(true); setFlash('');
    const res = await generateDebtMessage({ ...input, tone: t });
    setText(res.text); setByAi(res.ai); setBusy(false);
    void haptics.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personName, amount, currency, dueDate, role, language]);

  // رسالةٌ محلّية فورية عند الفتح، فلا تبدأ النافذة فارغة
  useEffect(() => { setText(fallbackMessage({ ...input, tone: 'neutral' })); /* eslint-disable-next-line */ }, []);

  const pickTone = (t: MsgTone) => { haptics.tap('light'); setTone(t); setText(fallbackMessage({ ...input, tone: t })); setByAi(false); };

  const savePhone = (v: string) => { setPhoneState(v); setPhone(personName, v); };

  const open = (url: string) => { try { window.open(url, '_blank', 'noopener'); } catch { location.href = url; } };

  const needPhone = (): boolean => {
    if (normalizePhone(phone).length < 6) { setFlash(S.needPhone); return false; }
    return true;
  };

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(text); setFlash(S.copied); void haptics.success(); } catch { /* تجاهل */ }
  };

  const doShare = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ text });
      } else if (navigator.share) { await navigator.share({ text }); }
      else { void doCopy(); }
    } catch { /* ألغى المستخدم */ }
  };

  const card = darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const grad = role === 'creditor' ? 'from-emerald-600 to-teal-600' : 'from-rose-600 to-orange-600';

  return (
    <div className="fixed inset-0 pb-banner z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        dir={direction}
        className={`w-full max-w-md max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col animate-scale-in ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
      >
        <div className={`relative bg-gradient-to-r ${grad} p-4 text-white`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                {role === 'creditor' ? S.asCreditor : S.asDebtor} · {role === 'creditor' ? S.hintCreditor : S.hintDebtor}
              </div>
              <h3 className="mt-0.5 truncate text-lg font-black">{S.title} {personName}</h3>
              <div className="text-xs opacity-90">{amount} {currency} · {dueDate}</div>
            </div>
            <button onClick={onClose} aria-label="✕" className="shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <div className={`mb-1.5 text-[11px] font-bold ${muted}`}>{S.tone}</div>
            <div className="flex gap-1.5">
              {(['soft', 'neutral', 'firm'] as const).map(t => (
                <button key={t} onClick={() => pickTone(t)}
                  className={`flex-1 rounded-xl px-2 py-2 text-xs font-black transition ${tone === t ? 'bg-violet-500 text-white' : darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  {S[t]}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => void gen(tone)} disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-black text-white transition hover:scale-[1.01] disabled:opacity-50">
            {busy ? S.generating : text ? S.regen : S.gen}
          </button>

          <div>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setFlash(''); }}
              rows={5}
              className={`w-full resize-none rounded-xl border p-3 text-sm leading-7 outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
            />
            <div className={`mt-1 flex items-center justify-between text-[10px] ${muted}`}>
              <span>{S.edit}</span>
              <span>{byAi ? `✨ ${S.byAi}` : `📄 ${S.offline}`}</span>
            </div>
          </div>

          <div>
            <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.phone}</label>
            <input
              inputMode="tel" value={phone}
              onChange={e => { savePhone(e.target.value); setFlash(''); }}
              placeholder="+212…"
              dir="ltr"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-600' : 'border-gray-200 bg-white placeholder-gray-400'}`}
            />
            <p className={`mt-1 text-[10px] ${muted}`}>{S.phoneHint}</p>
          </div>

          <div>
            <div className={`mb-1.5 text-[11px] font-bold ${muted}`}>{S.send}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => open(waLink(phone, text))}
                className="rounded-xl bg-[#25D366] px-2 py-2.5 text-xs font-black text-white transition hover:brightness-110">
                {S.wa}
              </button>
              <button onClick={() => { if (needPhone()) open(smsLink(phone, text)); }}
                className={`rounded-xl px-2 py-2.5 text-xs font-black transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
                {S.sms}
              </button>
              <button onClick={() => { if (needPhone()) open(telLink(phone)); }}
                className={`rounded-xl px-2 py-2.5 text-xs font-black transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
                {S.call}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={doCopy} className={`rounded-xl px-2 py-2 text-xs font-bold transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>{S.copy}</button>
            <button onClick={doShare} className={`rounded-xl px-2 py-2 text-xs font-bold transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>{S.share}</button>
          </div>

          {flash && <div className="text-center text-xs font-bold text-violet-500">{flash}</div>}
          <p className={`rounded-xl border p-2 text-center text-[10px] leading-5 ${card} ${muted}`}>{S.note}</p>
        </div>
      </div>
    </div>
  );
}
