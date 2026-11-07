/**
 * debtMessage.ts — رسائل الديون الدبلوماسية
 * ───────────────────────────────────────────────────────────────────────
 * كانت الرسالة واحدة لكل الحالات: «اكتب رسالة تذكير مهذّبة». وهذه نبرة
 * خاطئة حين تكون أنت المدين — فالمدين لا «يُذكّر» دائنه، بل يعتذر ويطلب
 * مهلة. والخلط بينهما يُنتج رسالةً محرجة.
 *
 * فهنا مساران منفصلان:
 *   • دائن (creditor): لك مالٌ عند غيرك → تذكيرٌ يحفظ ماء الوجه
 *   • مدين (debtor):   عليك مالٌ لغيرك → اعتذارٌ وطلب مهلة
 *
 * ولكلٍّ ثلاث نبرات، لأن رسالةً لصديق ليست كرسالةٍ لمورّد.
 *
 * ⚠️ القوالب الاحتياطية ليست زينة: مفتاح Gemini قد يفشل أو ينقطع
 *    الاتصال، ومستخدمٌ ضغط «ولّد رسالة» يجب أن يخرج بنصٍّ صالح للإرسال
 *    لا برسالة خطأ. فالقوالب مكتوبة لتكون قابلة للإرسال كما هي.
 */
import type { AppLanguage } from '../i18n';
import { callGemini } from './geminiService';

export type DebtRole = 'creditor' | 'debtor';
export type MsgTone = 'soft' | 'neutral' | 'firm';

export interface MsgInput {
  personName: string;
  amount: number;
  currency: string;
  dueDate: string;
  role: DebtRole;
  tone: MsgTone;
  lang: AppLanguage;
}

const LANG_NAMES: Record<AppLanguage, string> = {
  ar: 'Arabic (Modern Standard)', en: 'English', es: 'Spanish', zh: 'Simplified Chinese',
};

/** وصف النبرة للموجّه — بالإنجليزية لأن النموذج يتبعها أدقّ. */
const TONE_BRIEF: Record<DebtRole, Record<MsgTone, string>> = {
  creditor: {
    soft:    'very gentle and apologetic for even bringing it up; assume they simply forgot; offer flexibility',
    neutral: 'warm, clear and matter-of-fact; state the amount and date plainly without pressure',
    firm:    'courteous but unambiguous; make clear you need it settled, while staying respectful and never threatening',
  },
  debtor: {
    soft:    'sincerely apologetic; ask for a little more time; express genuine appreciation for their patience',
    neutral: 'honest and respectful; acknowledge the obligation and propose a realistic date',
    firm:    'confident and reassuring; commit clearly to a specific date and show you take it seriously',
  },
};

export function buildPrompt(i: MsgInput): string {
  const who = i.role === 'creditor'
    ? `${i.personName} owes the sender ${i.amount} ${i.currency}. The sender is asking to be paid.`
    : `The sender owes ${i.personName} ${i.amount} ${i.currency}. The sender is the one who must pay.`;
  return [
    `Write a short private message in ${LANG_NAMES[i.lang]}, from the sender to ${i.personName}.`,
    who,
    `Due date: ${i.dueDate}.`,
    `Tone: ${TONE_BRIEF[i.role][i.tone]}.`,
    '',
    'Rules:',
    '- Maximum 3 short sentences. It is a personal message, not a letter.',
    '- Diplomatic above all: preserve the other person\'s dignity. Never shame, accuse, threaten, or mention consequences.',
    '- No legal language, no debt-collection wording, no deadlines framed as warnings.',
    '- Mention the amount and the date naturally, not as a bill.',
    '- Start with the person\'s name. End with something warm.',
    '- Output the message text only — no quotes, no explanation, no subject line.',
  ].join('\n');
}

// ─── قوالب احتياطية: دورانِ × ثلاث نبرات × أربع لغات ──────────────────
type Tpl = (n: string, a: string, d: string) => string;

const FALLBACK: Record<AppLanguage, Record<DebtRole, Record<MsgTone, Tpl>>> = {
  ar: {
    creditor: {
      soft: (n, a, d) => `${n}، أعتذر عن الإزعاج، وأعلم أنّ الأمر قد غاب عن البال.\nكان موعد مبلغ ${a} في ${d}.\nلا عجلة، وأخبرني إن كان الوقت غير مناسب.`,
      neutral: (n, a, d) => `مرحباً ${n}، أرجو أن تكون بخير.\nأذكّرك بمبلغ ${a} الذي كان موعده ${d}.\nشكراً لك مقدّماً.`,
      firm: (n, a, d) => `${n}، أرجو أن تكون بخير.\nمبلغ ${a} استحقّ في ${d}، وأحتاجه في أقرب فرصة ممكنة.\nأقدّر لك تفهّمك، وأخبرني بالموعد الذي يناسبك.`,
    },
    debtor: {
      soft: (n, a, d) => `${n}، أعتذر إليك بصدق.\nمبلغ ${a} كان موعده ${d}، وأرجو أن تصبر عليّ قليلاً.\nممتنّ لك على تفهّمك، ولن أتأخّر أكثر.`,
      neutral: (n, a, d) => `مرحباً ${n}، لم يغب عنّي مبلغ ${a} المستحقّ في ${d}.\nأعمل على تدبيره وسأوافيك بموعدٍ محدّد قريباً.\nشكراً لسعة صدرك.`,
      firm: (n, a, d) => `${n}، بخصوص مبلغ ${a} المستحقّ في ${d}.\nألتزم بسداده، وسأتواصل معك لتحديد الموعد.\nشكراً لثقتك.`,
    },
  },
  en: {
    creditor: {
      soft: (n, a, d) => `Hi ${n}, sorry to bring this up — I'm sure it just slipped your mind.\nThe ${a} was due on ${d}.\nNo rush at all, and do tell me if now isn't a good time.`,
      neutral: (n, a, d) => `Hi ${n}, hope you're well.\nJust a note about the ${a} that was due on ${d}.\nThanks a lot.`,
      firm: (n, a, d) => `Hi ${n}, hope you're doing well.\nThe ${a} was due on ${d} and I do need it settled soon.\nI appreciate your understanding — let me know what date works for you.`,
    },
    debtor: {
      soft: (n, a, d) => `${n}, I owe you an apology.\nThe ${a} was due on ${d}, and I'd be grateful for a little more time.\nThank you for your patience — I won't let it drag on.`,
      neutral: (n, a, d) => `Hi ${n}, I haven't forgotten the ${a} due on ${d}.\nI'm sorting it out and will come back to you with a firm date shortly.\nThanks for bearing with me.`,
      firm: (n, a, d) => `${n}, about the ${a} due on ${d}.\nI'm committed to settling it and will be in touch to confirm the date.\nThank you for trusting me.`,
    },
  },
  es: {
    creditor: {
      soft: (n, a, d) => `Hola ${n}, perdona que lo mencione — seguro que se te pasó.\nLos ${a} vencían el ${d}.\nSin prisa, y dime si ahora no es buen momento.`,
      neutral: (n, a, d) => `Hola ${n}, espero que estés bien.\nSolo un recordatorio de los ${a} que vencían el ${d}.\nMuchas gracias.`,
      firm: (n, a, d) => `Hola ${n}, espero que todo vaya bien.\nLos ${a} vencieron el ${d} y necesito resolverlo pronto.\nAgradezco tu comprensión; dime qué fecha te viene bien.`,
    },
    debtor: {
      soft: (n, a, d) => `${n}, te debo una disculpa.\nLos ${a} vencían el ${d} y te agradecería un poco más de tiempo.\nGracias por tu paciencia; no lo alargaré más.`,
      neutral: (n, a, d) => `Hola ${n}, no he olvidado los ${a} del ${d}.\nEstoy resolviéndolo y te confirmaré una fecha concreta en breve.\nGracias por tu comprensión.`,
      firm: (n, a, d) => `${n}, sobre los ${a} con vencimiento el ${d}.\nMe comprometo a saldarlo y te contactaré para fijar la fecha.\nGracias por tu confianza.`,
    },
  },
  zh: {
    creditor: {
      soft: (n, a, d) => `${n}，不好意思打扰你，想必只是一时忘了。\n${a} 的约定日期是 ${d}。\n完全不急，如果现在不方便也请告诉我。`,
      neutral: (n, a, d) => `${n} 你好，希望一切都好。\n想提一下 ${d} 到期的 ${a}。\n非常感谢。`,
      firm: (n, a, d) => `${n} 你好。\n${a} 已于 ${d} 到期，我这边需要尽快结清。\n感谢你的理解，方便的日期请告诉我。`,
    },
    debtor: {
      soft: (n, a, d) => `${n}，真的很抱歉。\n${a} 原定 ${d} 归还，想请你再宽限我一些时间。\n谢谢你的体谅，我不会再拖。`,
      neutral: (n, a, d) => `${n} 你好，${d} 到期的 ${a} 我一直记着。\n正在安排，很快会给你一个确切日期。\n谢谢你的耐心。`,
      firm: (n, a, d) => `${n}，关于 ${d} 到期的 ${a}。\n我会负责结清，并会与你确认具体日期。\n谢谢你的信任。`,
    },
  },
};

/** رسالة محلّية صالحة للإرسال كما هي — تُستعمل عند تعذّر الاتصال. */
export function fallbackMessage(i: MsgInput): string {
  const money = `${i.amount} ${i.currency}`;
  return FALLBACK[i.lang][i.role][i.tone](i.personName, money, i.dueDate);
}

/** يولّد الرسالة عبر Gemini، ويقع على القالب المحلّي عند أي فشل. */
export async function generateDebtMessage(i: MsgInput): Promise<{ text: string; ai: boolean }> {
  try {
    const out = await callGemini(buildPrompt(i), {
      maxTokens: 220, temperature: 0.75,
      model: 'gemini-3.1-flash-lite', functionName: 'debt-message',
    });
    const clean = out.trim().replace(/^["'«»]+|["'«»]+$/g, '');
    // ردٌّ فارغ أو مقتضب جداً ليس رسالة — القالب أفضل منه
    if (clean.length < 15) throw new Error('too short');
    return { text: clean, ai: true };
  } catch {
    return { text: fallbackMessage(i), ai: false };
  }
}

// ─── روابط الإرسال ────────────────────────────────────────────────────
// ⚠️ لا إذن جهات اتصال ولا إذن رسائل. هذه روابط يفتحها النظام فيختار
//    المستخدم بنفسه ويُرسل بيده. وهو ما تطلبه سياسة Google Play: استعمال
//    آليات النظام بدل طلب أذونٍ واسعة.

/** يُبقي الأرقام و + وحدها — واتساب يرفض المسافات والشُرَط. */
export function normalizePhone(raw: string): string {
  const t = raw.trim().replace(/[^\d+]/g, '');
  return t.startsWith('+') ? '+' + t.slice(1).replace(/\+/g, '') : t;
}

export function waLink(phone: string, text: string): string {
  const p = normalizePhone(phone).replace(/^\+/, '');
  return p
    ? `https://wa.me/${p}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const smsLink = (phone: string, text: string): string =>
  `sms:${normalizePhone(phone)}?body=${encodeURIComponent(text)}`;

export const telLink = (phone: string): string => `tel:${normalizePhone(phone)}`;

// ─── دفتر أرقام جانبي ─────────────────────────────────────────────────
// ⚠️ لا نضيف حقل هاتف إلى DebtCredit. تغيير شكل بياناتٍ قائمة عند 454
//    مستخدماً خطرٌ لا داعي له هنا، فالأرقام تُحفظ في خريطة منفصلة
//    مفتاحها اسم الشخص. وحذف الخريطة لا يمسّ أي دَين.
const PHONE_KEY = 'notic-debt-phones';

export function getPhone(person: string): string {
  try {
    const m = JSON.parse(localStorage.getItem(PHONE_KEY) ?? '{}') as Record<string, string>;
    return m[person.trim()] ?? '';
  } catch { return ''; }
}

export function setPhone(person: string, phone: string): void {
  try {
    const m = JSON.parse(localStorage.getItem(PHONE_KEY) ?? '{}') as Record<string, string>;
    const k = person.trim();
    if (phone.trim()) m[k] = normalizePhone(phone); else delete m[k];
    localStorage.setItem(PHONE_KEY, JSON.stringify(m));
  } catch { /* تخزين محجوب — الإرسال يبقى ممكناً بإدخال الرقم يدوياً */ }
}
