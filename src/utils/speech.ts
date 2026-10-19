/**
 * speech.ts — غلاف Web Speech API للإدخال الصوتي
 *
 * يدعم الدارجة المغربية أوّلاً، ثم العربية الفصحى كاحتياط.
 * يعمل على أندرويد (Chrome WebView) والمتصفّحات الحديثة.
 * iOS WKWebView لا يدعمه بشكل موثوق — نتلاشى بصمت.
 */

type Listener = (text: string, isFinal: boolean) => void;
type ErrorListener = (msg: string) => void;

interface SpeechController {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
}

// أنواع Web Speech API ليست في TS بشكل افتراضي — نُعرّفها بمرونة
interface SR {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSRConstructor(): (new () => SR) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
  return getSRConstructor() !== null;
}

/** قائمة اللغات المُجرَّبة بالترتيب — تُعطي أولوية للدارجة المغربية */
const LANG_FALLBACKS = ['ar-MA', 'ar-EG', 'ar-SA', 'ar'];

export function createSpeechController(opts: {
  onResult: Listener;
  onError?: ErrorListener;
  onEnd?: () => void;
  preferredLang?: string;
}): SpeechController {
  const Ctor = getSRConstructor();
  if (!Ctor) {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  let recognition: SR | null = null;
  let stopped = false;
  let langIndex = 0;
  const langs = opts.preferredLang
    ? [opts.preferredLang, ...LANG_FALLBACKS.filter(l => l !== opts.preferredLang)]
    : LANG_FALLBACKS;

  const tryStart = () => {
    if (stopped) return;
    try {
      recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langs[langIndex];
      recognition.onresult = (ev) => {
        let interim = '';
        let final = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const transcript = res[0]?.transcript || '';
          if (res.isFinal) final += transcript + ' ';
          else interim += transcript;
        }
        if (final) opts.onResult(final.trim(), true);
        if (interim) opts.onResult(interim, false);
      };
      recognition.onerror = (ev) => {
        // ابحث عن لغة بديلة عند فشل اللغة الحالية
        if (ev.error === 'language-not-supported' && langIndex < langs.length - 1) {
          langIndex++;
          setTimeout(tryStart, 200);
          return;
        }
        if (ev.error === 'no-speech' || ev.error === 'aborted') {
          // ليست أخطاء جوهرية — تجاهل
          return;
        }
        opts.onError?.(translateError(ev.error));
      };
      recognition.onend = () => {
        if (!stopped) {
          // أعد التشغيل تلقائياً للحفاظ على الاستمرارية
          setTimeout(() => { if (!stopped) tryStart(); }, 100);
        } else {
          opts.onEnd?.();
        }
      };
      recognition.start();
    } catch (e) {
      opts.onError?.(translateError('start-failed'));
    }
  };

  return {
    isSupported: true,
    start: () => { stopped = false; langIndex = 0; tryStart(); },
    stop: () => {
      stopped = true;
      try { recognition?.stop(); } catch {}
      try { recognition?.abort(); } catch {}
      recognition = null;
    },
  };
}

/**
 * لغة الواجهة الحالية. كانت translateError تستدعي getStoredLang() وهي
 * دالة غير معرّفة في المشروع إطلاقاً — فكل خطأ في الإدخال الصوتي كان
 * يتحوّل إلى ReferenceError بدل رسالة مفهومة. (البناء لا يكتشفها لأن
 * esbuild لا يفحص الأنواع، فتظهر وقت التشغيل فقط.)
 */
function getStoredLang(): string {
  try { return localStorage.getItem('notic-language') || 'ar'; }
  catch { return 'ar'; }
}

function translateError(code: string): string {
  const lang = getStoredLang();
  const MSG: Record<string, Record<string, string>> = {
    'not-allowed': {
      ar: 'يجب السماح للتطبيق باستخدام الميكروفون من إعدادات النظام',
      en: 'Please allow microphone access in system settings',
      es: 'Permite el acceso al micrófono en la configuración del sistema',
      zh: '请在系统设置中允许麦克风访问',
    },
    'service-not-allowed': {
      ar: 'يجب السماح للتطبيق باستخدام الميكروفون من إعدادات النظام',
      en: 'Please allow microphone access in system settings',
      es: 'Permite el acceso al micrófono en la configuración del sistema',
      zh: '请在系统设置中允许麦克风访问',
    },
    'audio-capture': {
      ar: 'لا يوجد ميكروفون متاح',
      en: 'No microphone available',
      es: 'No hay micrófono disponible',
      zh: '没有可用的麦克风',
    },
    'network': {
      ar: 'الإدخال الصوتي يحتاج اتصالاً بالإنترنت',
      en: 'Voice input requires an internet connection',
      es: 'La entrada de voz requiere conexión a internet',
      zh: '语音输入需要网络连接',
    },
    'start-failed': {
      ar: 'تعذّر بدء الإدخال الصوتي',
      en: 'Could not start voice input',
      es: 'No se pudo iniciar la entrada de voz',
      zh: '无法启动语音输入',
    },
  };
  const entry = MSG[code];
  if (entry) return entry[lang] ?? entry['en'];
  const fallback: Record<string, string> = {
    ar: `خطأ في الإدخال الصوتي: ${code}`,
    en: `Voice input error: ${code}`,
    es: `Error de entrada de voz: ${code}`,
    zh: `语音输入错误：${code}`,
  };
  return fallback[lang] ?? fallback['en'];
}
