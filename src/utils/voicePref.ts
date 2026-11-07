/**
 * voicePref.ts — الصوت المختار، مشترك بين كل النوافذ
 * ───────────────────────────────────────────────────────────────────────
 * كان الصوت يُختار داخل زرّ الاستماع نفسه، فلكلّ نافذة اختيارها، ولا
 * يملك المستخدم أي طريقة لتغييره. وهنا تفضيلٌ واحد محفوظ، تقرؤه كل
 * أزرار الاستماع في التطبيق، ويُبثّ تغييره فوراً إلى كل نافذة مفتوحة
 * بلا إعادة تحميل.
 *
 * ⚠️ الأسماء والأوصاف مترجَمة إلى اللغات الأربع. كانت عربيةً ثابتة، فكان
 *    المستخدم الإنجليزي يرى «لطيف» و«ناعم ومريح» داخل واجهة إنجليزية.
 *    المعرّف (id) وحده هو ما يُرسل إلى Gemini — والترجمة للعرض فقط.
 */
import type { AppLanguage } from '../i18n';

type L = Record<AppLanguage, string>;

export interface VoiceEntry {
  id: string;
  emoji: string;
  label: L;
  hint: L;
}

/**
 * الأصوات المعروضة — منتقاة من قائمة Gemini الرسمية (30 صوتاً).
 * الوصف مأخوذ من توصيف Google لكل صوت، لا من انطباع:
 * Gacrux=Mature، Sadaltager=Knowledgeable، Rasalgethi=Informative،
 * Algenib=Gravelly، Alnilam/Orus=Firm، Sulafat=Warm، Charon=Informative،
 * Vindemiatrix=Gentle، Achird=Friendly، Puck=Upbeat، Zephyr=Bright.
 *
 * ⚠️ الأسماء حسّاسة لحالة الأحرف، واسمٌ خارج القائمة الرسمية يُفشل طلب
 * الصوت فيسقط النطق إلى محرّك الجهاز بصمت. لا يُضاف هنا اسم غير موثَّق.
 */
export const VOICE_CATALOG: VoiceEntry[] = [
  { id: 'auto', emoji: '🎲',
    label: { ar: 'تلقائي', en: 'Automatic', es: 'Automática', zh: '自动' },
    hint:  { ar: 'يتنوّع حسب نوع المحتوى', en: 'Varies with the kind of content',
             es: 'Varía según el tipo de contenido', zh: '根据内容类型变化' } },
  { id: 'Gacrux', emoji: '🧔',
    label: { ar: 'راشد', en: 'Mature', es: 'Madura', zh: '成熟' },
    hint:  { ar: 'ناضج ورصين', en: 'Grown-up and composed',
             es: 'Madura y serena', zh: '沉稳持重' } },
  { id: 'Sadaltager', emoji: '🎓',
    label: { ar: 'عليم', en: 'Knowledgeable', es: 'Experta', zh: '博学' },
    hint:  { ar: 'نبرة خبير', en: 'An expert tone',
             es: 'Tono de experto', zh: '专家语气' } },
  { id: 'Rasalgethi', emoji: '📰',
    label: { ar: 'إخباري', en: 'Informative', es: 'Informativa', zh: '资讯' },
    hint:  { ar: 'واضح ومعلوماتي', en: 'Clear and informative',
             es: 'Clara e informativa', zh: '清晰而富有信息' } },
  { id: 'Algenib', emoji: '🪨',
    label: { ar: 'خشن', en: 'Gravelly', es: 'Áspera', zh: '低沉' },
    hint:  { ar: 'عميق وفيه حبّة', en: 'Deep with a bit of grain',
             es: 'Profunda y con textura', zh: '低沉而带颗粒感' } },
  { id: 'Alnilam', emoji: '🎯',
    label: { ar: 'حازم', en: 'Firm', es: 'Firme', zh: '坚定' },
    hint:  { ar: 'ثابت وواثق', en: 'Steady and confident',
             es: 'Estable y segura', zh: '稳定而自信' } },
  { id: 'Orus', emoji: '🏛️',
    label: { ar: 'رزين', en: 'Steady', es: 'Sobria', zh: '稳重' },
    hint:  { ar: 'حازم ومتّزن', en: 'Firm and balanced',
             es: 'Firme y equilibrada', zh: '坚定而均衡' } },
  { id: 'Charon', emoji: '📡',
    label: { ar: 'مُطّلع', en: 'Briefed', es: 'Documentada', zh: '知悉' },
    hint:  { ar: 'معلوماتي وهادئ', en: 'Informative and calm',
             es: 'Informativa y tranquila', zh: '信息丰富且平静' } },
  { id: 'Sulafat', emoji: '🔥',
    label: { ar: 'دافئ', en: 'Warm', es: 'Cálida', zh: '温暖' },
    hint:  { ar: 'ودود وقريب', en: 'Friendly and close',
             es: 'Amable y cercana', zh: '亲切而贴近' } },
  { id: 'Vindemiatrix', emoji: '🌙',
    label: { ar: 'لطيف', en: 'Gentle', es: 'Suave', zh: '柔和' },
    hint:  { ar: 'ناعم ومريح', en: 'Soft and restful',
             es: 'Suave y relajante', zh: '柔软而舒缓' } },
  { id: 'Achird', emoji: '🙂',
    label: { ar: 'صديق', en: 'Friendly', es: 'Amigable', zh: '友好' },
    hint:  { ar: 'ودّي وعفوي', en: 'Warm and easy-going',
             es: 'Cordial y espontánea', zh: '亲切而自然' } },
  { id: 'Puck', emoji: '⚡',
    label: { ar: 'حيوي', en: 'Upbeat', es: 'Animada', zh: '活力' },
    hint:  { ar: 'شابّ ومرح', en: 'Young and cheerful',
             es: 'Joven y alegre', zh: '年轻而愉快' } },
  { id: 'Zephyr', emoji: '☀️',
    label: { ar: 'مشرق', en: 'Bright', es: 'Luminosa', zh: '明亮' },
    hint:  { ar: 'خفيف ومنير', en: 'Light and bright',
             es: 'Ligera y luminosa', zh: '轻快而明亮' } },
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

/** بطاقة الصوت المختار. تُمرَّر اللغة لتُعاد النصوص مترجَمة. */
export function currentVoiceMeta(lang: AppLanguage = 'ar'): {
  id: string; emoji: string; label: string; hint: string;
} {
  const id = getVoicePref();
  const v = VOICE_CATALOG.find(x => x.id === id) ?? VOICE_CATALOG[0];
  return { id: v.id, emoji: v.emoji, label: v.label[lang] ?? v.label.en, hint: v.hint[lang] ?? v.hint.en };
}
