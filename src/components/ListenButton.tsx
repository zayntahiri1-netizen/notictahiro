/**
 * ListenButton — زر استماع موحّد لكل نوافذ التطبيق
 * ───────────────────────────────────────────────────────────────────────
 * لماذا مكوّن واحد بدل زر في كل نافذة؟
 *   • سلوك متطابق في كل مكان (نفس الحالات، نفس الاختصارات، نفس النبرة).
 *   • إصلاح واحد يسري على الجميع.
 *   • ضمان عدم تشغيل صوتين معاً (نوقف الجاري قبل بدء جديد).
 *
 * النبرة: يمرّر وصف أسلوب القراءة إلى نموذج Gemini (صوت Puck الحيوي)،
 * ويرفع السرعة والحدّة قليلاً في محرّكات الجهاز/المتصفح الاحتياطية حتى
 * تبقى النبرة حماسية حتى بلا إنترنت.
 *
 * الحالات المرئية: خامل → جاري التحضير (⏳) → يتحدّث (⏸) → خطأ (⚠️)
 */
import { useEffect, useRef, useState } from 'react';
import * as player from '../utils/ttsPlayer';
import { getVoicePref } from '../utils/voicePref';
import * as haptics from '../utils/haptics';

/** أنماط النبرة الجاهزة — تُختار حسب طبيعة المحتوى */
/**
 * أساليب الإلقاء — عبارات قصيرة لا فقرات.
 *
 * ⚠️ كانت كل واحدة منها فقرة من ~400 حرف ("اقرأ كمدرّب ملهم يقف أمام
 * جمهوره…"). وقد تبيّن أمران:
 *
 *  1) الفقرة كانت تُدمَج في النصّ المُرسَل، ونموذج TTS يعامل ما يصله
 *     كنصّ حرفي — فكان **ينطق التعليمة** قبل الملاحظة بدل أن يطبّقها.
 *     محلّها الصحيح حقل الأسلوب المستقلّ، وهو ما صار يحدث الآن.
 *
 *  2) وحتى في محلّها الصحيح، يحذّر التوثيق صراحةً من فقرات الأسلوب
 *     الطويلة ("Audio Profile" / "Director's Notes") لأنها سبب معروف
 *     لانحراف الصوت، ويوصي بعبارة موجزة تُعاد عبر الجمل.
 *
 * فالإيجاز هنا ليس اختصاراً للجهد — هو الشكل الذي يعمل.
 */
export const VOICE_STYLES = {
  /** افتراضي: للملاحظات والخطط */
  energetic: 'حماسي ودافئ ومحفّز، بإيقاع يتصاعد',
  /** للرؤى والاكتشافات */
  exciting: 'مشوّق ومتغيّر الإيقاع، مع وقفات تصنع الترقّب',
  /** للإنجازات والإحصائيات الكبيرة */
  epic: 'ملحمي مهيب، عميق ومتمهّل',
  /** للأرقام والتقارير المالية */
  confident: 'رصين واثق، منضبط الإيقاع وواضح',
  /** للنصوص الطويلة */
  calm: 'هادئ ودود ومنساب',
} as const;

export type VoiceStyle = keyof typeof VOICE_STYLES;

/**
 * أصوات راشدة متنوّعة لكل نمط.
 *
 * كان الصوت واحداً ثابتاً في كل قراءة: `Puck` — وهو موصوف رسمياً بـ
 * "Upbeat"، أي صوت شابّ مرح. فكانت كل ملاحظة تُقرأ بالنبرة نفسها مهما
 * اختلف مضمونها، وبصوت لا يناسب محتوى جادّاً.
 *
 * الأسماء هنا من قائمة Gemini الرسمية للأصوات المسبقة (30 صوتاً)،
 * مُنتقاة بأوصافها: Gacrux = Mature، Sadaltager = Knowledgeable،
 * Rasalgethi/Charon = Informative، Alnilam/Orus = Firm،
 * Sulafat = Warm، Algenib = Gravelly، Sadachbia = Lively.
 *
 * ⚠️ الأسماء حسّاسة لحالة الأحرف، واسمٌ غير موجود يُفشل الطلب فيسقط
 * النطق إلى محرّك الجهاز بصمت — لذلك لا يُضاف هنا اسم غير موثَّق.
 */
const VOICE_POOLS: Record<VoiceStyle, string[]> = {
  // مدرّب ملهم ناضج — لا متحمّس صبياني
  energetic: ['Gacrux', 'Alnilam', 'Sadachbia'],
  // راوٍ يكشف سرّاً — صوت خبير وفيه خشونة تصنع الترقّب
  exciting:  ['Rasalgethi', 'Algenib', 'Sadaltager'],
  // ملحمي — عمق وثبات
  epic:      ['Algenib', 'Gacrux', 'Orus'],
  // واثق — حزم بلا حدّة
  confident: ['Alnilam', 'Orus', 'Charon'],
  // هادئ — دفء ولين
  calm:      ['Sulafat', 'Vindemiatrix', 'Achernar'],
};

/**
 * يختار صوتاً من مجموعة النمط، ويُدوّر بين القراءات المتتالية.
 * العدّاد في الوحدة لا في المكوّن: التدوير يجب أن يستمرّ عبر كل أزرار
 * الاستماع في التطبيق، لا أن يُصفَّر مع كل إعادة تصيير.
 */
let _voiceTurn = 0;
export function pickVoice(style: VoiceStyle): string {
  const pool = VOICE_POOLS[style] ?? VOICE_POOLS.energetic;
  return pool[_voiceTurn++ % pool.length];
}

interface Props {
  /**
   * النص المقروء. اختياري: إن لم يُمرَّر، يقرأ الزر محتوى نافذته تلقائياً
   * (أقرب عنصر أب يحمل data-listen-scope) — فلا حاجة لربط نص لكل نافذة،
   * ويبقى المقروء مطابقاً لما يراه المستخدم فعلاً حتى لو تغيّر المحتوى.
   */
  text?: string | (() => string);
  /** نبرة القراءة (الافتراضي: energetic) */
  style?: VoiceStyle;
  /** لغة النطق (BCP-47) */
  lang?: string;
  /** حجم الزر */
  size?: 'sm' | 'md';
  /** صنف إضافي للتموضع */
  className?: string;
  /** نص بديل لقارئ الشاشة */
  label?: string;
  darkMode?: boolean;
}

type State = 'idle' | 'loading' | 'speaking' | 'paused' | 'error';

export default function ListenButton({
  text,
  style = 'energetic',
  lang = 'ar-SA',
  size = 'md',
  className = '',
  label = 'استماع',
  darkMode = false,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const mounted = useRef(true);
  const btnRef = useRef<HTMLButtonElement>(null);
  /** هويّة ثابتة لهذا الزرّ — بها يعرف المشغّل مَن يملك التشغيل. */
  const idRef = useRef<string>(`lb-${Math.random().toString(36).slice(2, 9)}`);

  /**
   * يقرأ نص النافذة المحيطة، بعد استبعاد العناصر التفاعلية (أزرار، حقول،
   * أيقونات) التي لا معنى لنطقها. يُقصّ عند 4000 حرف لتفادي طلبات ضخمة.
   */
  const extractScopeText = (): string => {
    const scope = btnRef.current?.closest('[data-listen-scope]') as HTMLElement | null;
    if (!scope) return '';

    // ⚠️ لا نستنسخ العنصر.
    //
    // كانت الطريقة السابقة: cloneNode ثم قراءة textContent. والنسخة
    // المستنسخة خارج الصفحة، فلا تنطبق عليها أنماط CSS — و textContent
    // لا يعرف المرئيّ من المخفيّ أصلاً. فكان الزرّ يقرأ الأقسام المطويّة
    // والبطاقات المخفيّة ونصوص قارئ الشاشة… كلّ ما في الشجرة، ظاهراً كان
    // أو لا. والمستمع يسمع محتوى لا يراه أمامه فيحسبه خللاً.
    //
    // هنا نمشي على العنصر الأصلي — وهو وحده الذي تنطبق عليه الأنماط
    // الحقيقية — ونتخطّى كل فرع غير مرئي.
    const EXCLUDED = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SVG', 'SCRIPT', 'STYLE']);

    const isHidden = (el: Element): boolean => {
      if ((el as HTMLElement).hidden) return true;
      if (el.getAttribute('aria-hidden') === 'true') return true;
      if (el.hasAttribute('data-no-listen')) return true;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      if (parseFloat(cs.opacity || '1') === 0) return true;
      // القصّ إلى صفر: الحيلة الشائعة لإخفاء الأقسام المطويّة
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return true;
      return false;
    };

    const out: string[] = [];
    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent;
        if (t && t.trim()) out.push(t);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      // ⚠️ toUpperCase ضروري: عناصر HTML تُعيد tagName بأحرف كبيرة، أما
      // عناصر SVG فتحتفظ بحالتها الأصلية ('svg' لا 'SVG') لأنها في فضاء
      // أسماء آخر. وبلا هذا التطبيع كان نصّ الأيقونات يُقرأ بصوت عالٍ.
      if (EXCLUDED.has(el.tagName.toUpperCase())) return;
      if (isHidden(el)) return;              // الفرع كلّه يُتخطّى
      node.childNodes.forEach(walk);
    };
    walk(scope);

    return out
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
      // ⚠️ 1200 لا 4000: ما فوقها يتجاوز مهلة Gemini فيسقط النطق إلى
      // محرّك الجهاز بعد انتظار طويل (انظر GEMINI_MAX_CHARS في tts.ts).
      .slice(0, 1200);
  };

  // أوقف الصوت إن أُزيلت النافذة والمستخدم ما زال يستمع — وإلا يستمر
  // الصوت بعد إغلاق النافذة وهو سلوك مربك.
  useEffect(() => {
    mounted.current = true;
    const me = idRef.current;

    // ⚠️ الحالة تُشتقّ من المشغّل لا من هذا المكوّن.
    // المشغّل واحد في التطبيق، وأزرار الاستماع كثيرة. فلو احتفظ كل زرّ
    // بحالته لأضاءت كلّها معاً عند أي تشغيل. هنا يُضيء المالك وحده.
    const unsub = player.subscribe((s) => {
      if (!mounted.current) return;
      if (player.getOwner() !== me) { setState('idle'); return; }
      setState(s === 'paused' ? 'paused' : s === 'idle' ? 'idle' : s === 'loading' ? 'loading' : 'speaking');
    });

    return () => {
      mounted.current = false;
      unsub();
      // لا نوقف إلا إن كنّا نحن المالك: نافذةٌ تُغلق يجب ألّا تُسكت
      // صوتاً بدأه زرٌّ آخر ما زال ظاهراً.
      if (player.getOwner() === me) void player.stop();
    };
  }, []);

  const handleClick = async () => {
    haptics.tap('light');
    const me = idRef.current;
    const mine = player.getOwner() === me;

    // ضغطة أثناء تشغيلي = تجميد · أثناء تجميدي = استئناف من حيث وقفت
    if (mine && (state === 'speaking' || state === 'loading')) { player.pause(); return; }
    if (mine && state === 'paused') { player.resume(); return; }

    const content = (
      text === undefined ? extractScopeText()
      : typeof text === 'function' ? text()
      : text
    ).trim();
    if (!content) {
      setState('error');
      setTimeout(() => mounted.current && setState('idle'), 1800);
      return;
    }

    const pref = getVoicePref();
    await player.play(content, {
      lang,
      style: VOICE_STYLES[style],
      // 'auto' يعني التنويع حسب نوع المحتوى؛ وإلا فاختيار المستخدم يحكم.
      voiceName: pref === 'auto' ? pickVoice(style) : pref,
      // المحركات الاحتياطية (native/browser) لا تفهم وصف النبرة، فالطاقة
      // فيها تأتي من الإيقاع والحدّة فقط. الحدّ المريح للعربية ~1.15
      // سرعة و~1.25 حدّة — بعده يصير الصوت حادّاً مزعجاً لا حماسياً.
      rate:  style === 'calm' ? 0.98 : style === 'epic' ? 1.02 : 1.10,
      pitch: style === 'calm' ? 1.00 : style === 'epic' ? 0.92 : 1.20,
      owner: me,
    });
  };

  const icon =
    state === 'loading' ? '⏳' :
    state === 'paused' ? '▶️' :
    state === 'speaking' ? '⏸️' :
    state === 'error' ? '⚠️' : '🔊';

  const title =
    state === 'loading' ? 'جاري التحضير…' :
    state === 'speaking' ? 'إيقاف مؤقّت' :
    state === 'paused' ? 'استئناف من حيث توقّف' :
    state === 'error' ? 'تعذّر التشغيل' : label;

  const dim = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base';

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => { void handleClick(); }}
      title={title}
      aria-label={title}
      aria-pressed={state === 'speaking' || state === 'paused'}
      className={`${dim} shrink-0 rounded-full flex items-center justify-center transition
        active:scale-90 ${
          state === 'speaking'
            ? 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg'
            : state === 'paused'
            ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50'
            : state === 'error'
            ? 'bg-red-500/15 text-red-500'
            : darkMode
            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } ${className}`}
    >
      <span className={state === 'loading' ? 'animate-pulse' : state === 'speaking' ? 'animate-pulse' : ''}>
        {icon}
      </span>
    </button>
  );
}
