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
import { speak, stopSpeaking } from '../utils/tts';
import * as haptics from '../utils/haptics';

/** أنماط النبرة الجاهزة — تُختار حسب طبيعة المحتوى */
export const VOICE_STYLES = {
  /** افتراضي: مدرّب ملهم يشعل الهمّة — للملاحظات والخطط */
  energetic:
    'اقرأ كمدرّب ملهم يقف أمام جمهوره لحظة الانطلاق: صوت دافئ مفعم بالطاقة، ' +
    'يبدأ هادئاً ثم يتصاعد. اضغط على أفعال الإنجاز، وارفع النبرة عند كل هدف، ' +
    'واترك نَفَساً قصيراً قبل الجملة الحاسمة ليقع أثرها. لا ترتل ولا ترتب — ' +
    'اجعل كل جملة تدفع للأمام كأن السامع سينهض فوراً لينفّذ.',

  /** تشويقي: للرؤى والاكتشافات — أعلى درجات الإثارة */
  exciting:
    'اقرأ كراوٍ يكشف سرّاً لم يُقَل من قبل: ابدأ بهمس مشدود، ثم فجّر الطاقة ' +
    'عند المعلومة المفصلية. غيّر السرعة بين الجمل — أبطئ عند الغموض، وأسرع ' +
    'عند الكشف. اترك صمتاً قصيراً قبل الرقم أو الخلاصة ليصنع الترقّب، ثم ' +
    'انطق الكلمة المفتاحية بوضوح وقوة كأنها عنوان لا يُنسى.',

  /** ملحمي: للإنجازات والإحصائيات الكبيرة */
  epic:
    'اقرأ بنبرة ملحمية مهيبة كأنك تعلن نتيجة معركة انتصر فيها السامع: ' +
    'عمق في الصوت، تمهّل موزون، وتصاعد ثابت نحو الذروة. عظّم الأرقام، ' +
    'وقف وقفة مهيبة قبل الخلاصة، واختم بجملة تبعث الفخر والاعتزاز.',

  /** واثق: للأرقام والتقارير المالية */
  confident:
    'اقرأ كمحلّل محترف يقدّم نتائج حاسمة في قاعة اجتماعات: صوت رصين واثق، ' +
    'إيقاع منضبط، تشديد واضح على كل رقم، ووقفة قصيرة بعد كل خلاصة لتترسّخ. ' +
    'الثقة هنا تأتي من الوضوح والهدوء، لا من رفع الصوت.',

  /** هادئ: للنصوص الطويلة والقراءة المطوّلة */
  calm:
    'اقرأ بنبرة هادئة ودودة كصديق يحكي في أمسية مريحة: إيقاع متّزن، ' +
    'نَفَس طويل، وانسياب لطيف يريح الأذن في الاستماع المطوّل.',
} as const;

export type VoiceStyle = keyof typeof VOICE_STYLES;

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

type State = 'idle' | 'loading' | 'speaking' | 'error';

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

  /**
   * يقرأ نص النافذة المحيطة، بعد استبعاد العناصر التفاعلية (أزرار، حقول،
   * أيقونات) التي لا معنى لنطقها. يُقصّ عند 4000 حرف لتفادي طلبات ضخمة.
   */
  const extractScopeText = (): string => {
    const scope = btnRef.current?.closest('[data-listen-scope]') as HTMLElement | null;
    if (!scope) return '';
    const clone = scope.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button, input, textarea, select, svg, [data-no-listen]')
      .forEach((el) => el.remove());
    return (clone.textContent || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
      .slice(0, 4000);
  };

  // أوقف الصوت إن أُزيلت النافذة والمستخدم ما زال يستمع — وإلا يستمر
  // الصوت بعد إغلاق النافذة وهو سلوك مربك.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void stopSpeaking();
    };
  }, []);

  const handleClick = async () => {
    haptics.tap('light');

    // ضغطة أثناء التشغيل = إيقاف
    if (state === 'speaking' || state === 'loading') {
      await stopSpeaking();
      if (mounted.current) setState('idle');
      return;
    }

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

    // أوقف أي صوت جارٍ في نافذة أخرى قبل البدء (لا صوتان معاً)
    await stopSpeaking();
    setState('loading');

    const ok = await speak({
      text: content,
      lang,
      style: VOICE_STYLES[style],
      // المحركات الاحتياطية (native/browser) لا تفهم وصف النبرة، فالطاقة
      // فيها تأتي من الإيقاع والحدّة فقط. الحدّ المريح للعربية ~1.15
      // سرعة و~1.25 حدّة — بعده يصير الصوت حادّاً مزعجاً لا حماسياً.
      rate:  style === 'calm' ? 0.98 : style === 'epic' ? 1.02 : 1.10,
      pitch: style === 'calm' ? 1.00 : style === 'epic' ? 0.92 : 1.20,
      onEnd:   () => { if (mounted.current) setState('idle'); },
      onError: () => { if (mounted.current) setState('error'); },
    });

    if (!mounted.current) return;
    if (ok) setState('speaking');
    else {
      setState('error');
      setTimeout(() => mounted.current && setState('idle'), 1800);
    }
  };

  const icon =
    state === 'loading' ? '⏳' :
    state === 'speaking' ? '⏸️' :
    state === 'error' ? '⚠️' : '🔊';

  const title =
    state === 'loading' ? 'جاري التحضير…' :
    state === 'speaking' ? 'إيقاف الاستماع' :
    state === 'error' ? 'تعذّر التشغيل' : label;

  const dim = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base';

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => { void handleClick(); }}
      title={title}
      aria-label={title}
      aria-pressed={state === 'speaking'}
      className={`${dim} shrink-0 rounded-full flex items-center justify-center transition
        active:scale-90 ${
          state === 'speaking'
            ? 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg'
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
