/**
 * voicePref.ts — الصوت المختار، مشترك بين كل النوافذ
 * ───────────────────────────────────────────────────────────────────────
 * كان الصوت يُختار داخل زرّ الاستماع نفسه، فلكلّ نافذة اختيارها، ولا
 * يملك المستخدم أي طريقة لتغييره. وهنا تفضيلٌ واحد محفوظ، تقرؤه كل
 * أزرار الاستماع في التطبيق، ويُبثّ تغييره فوراً إلى كل نافذة مفتوحة
 * بلا إعادة تحميل.
 */

/**
 * الأصوات المعروضة — منتقاة من قائمة Gemini الرسمية (30 صوتاً).
 * الوصف العربي مأخوذ من توصيف Google لكل صوت، لا من انطباع:
 * Gacrux=Mature، Sadaltager=Knowledgeable، Rasalgethi=Informative،
 * Algenib=Gravelly، Alnilam/Orus=Firm، Sulafat=Warm، Charon=Informative،
 * Vindemiatrix=Gentle، Achird=Friendly، Puck=Upbeat، Zephyr=Bright.
 *
 * ⚠️ الأسماء حسّاسة لحالة الأحرف، واسمٌ خارج القائمة الرسمية يُفشل طلب
 * الصوت فيسقط النطق إلى محرّك الجهاز بصمت. لا يُضاف هنا اسم غير موثَّق.
 */
export const VOICE_CATALOG: Array<{ id: string; label: string; hint: string }> = [
  { id: 'auto',          label: '🎲 تلقائي',   hint: 'يتنوّع حسب نوع المحتوى' },
  { id: 'Gacrux',        label: '🧔 راشد',      hint: 'ناضج ورصين' },
  { id: 'Sadaltager',    label: '🎓 عليم',      hint: 'نبرة خبير' },
  { id: 'Rasalgethi',    label: '📰 إخباري',    hint: 'واضح ومعلوماتي' },
  { id: 'Algenib',       label: '🪨 خشن',       hint: 'عميق وفيه حبّة' },
  { id: 'Alnilam',       label: '🎯 حازم',      hint: 'ثابت وواثق' },
  { id: 'Orus',          label: '🏛️ رزين',      hint: 'حازم ومتّزن' },
  { id: 'Charon',        label: '📡 مُطّلع',     hint: 'معلوماتي وهادئ' },
  { id: 'Sulafat',       label: '🔥 دافئ',      hint: 'ودود وقريب' },
  { id: 'Vindemiatrix',  label: '🌙 لطيف',      hint: 'ناعم ومريح' },
  { id: 'Achird',        label: '🙂 صديق',      hint: 'ودّي وعفوي' },
  { id: 'Puck',          label: '⚡ حيوي',      hint: 'شابّ ومرح' },
  { id: 'Zephyr',        label: '☀️ مشرق',      hint: 'خفيف ومنير' },
];

const KEY = 'notic-voice';
const DEFAULT_VOICE = 'auto';

type Listener = (voice: string) => void;
const _subs = new Set<Listener>();

/** الصوت المختار حالياً ('auto' يعني التنويع التلقائي). */
export function getVoicePref(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && VOICE_CATALOG.some(x => x.id === v)) return v;
  } catch { /* تخزين محجوب — نكتفي بالافتراضي */ }
  return DEFAULT_VOICE;
}

/** يحفظ الاختيار ويُبلّغ كل النوافذ المفتوحة فوراً. */
export function setVoicePref(voice: string): void {
  try { localStorage.setItem(KEY, voice); } catch { /* غير حرج */ }
  for (const fn of _subs) {
    try { fn(voice); } catch { /* مشترك واحد لا يُسقط البقية */ }
  }
}

export function subscribeVoice(fn: Listener): () => void {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}

/** بطاقة الصوت المختار — للعرض على الزرّ. */
export function currentVoiceMeta() {
  const id = getVoicePref();
  return VOICE_CATALOG.find(v => v.id === id) ?? VOICE_CATALOG[0];
}
