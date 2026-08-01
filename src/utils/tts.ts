/**
 * tts.ts — أداة تحويل النص إلى كلام موحّدة لـ Notic Tahiro
 * ─────────────────────────────────────────────────────────────────────
 * تستخدم مكتبة @capacitor-community/text-to-speech الأصلية على الجوال
 * (موثوقة جداً، تدعم العربية إن كان محرك TTS مُثبَّتاً)، وتسقط تلقائياً
 * إلى Web Speech API على المتصفح. واجهة واحدة بسيطة: speak / stop.
 *
 * المكتبة الأصلية تحل مشكلة WebView الشهيرة: speechSynthesis داخل
 * WebView الأندرويد غير موثوق (أصوات لا تُحمّل، صمت بلا خطأ). المحرك
 * الأصلي يتجاوز WebView كلياً ويتحدث مباشرة عبر Android TextToSpeech.
 */

import { Capacitor } from '@capacitor/core';
import { geminiTextToSpeech } from './geminiService';

export interface SpeakOptions {
  text: string;
  lang?: string;   // BCP-47 مثل ar-SA, en-US
  rate?: number;   // 0.1 - 2.0 (الافتراضي ~1)
  pitch?: number;  // 0.0 - 2.0
  onEnd?: () => void;
  onError?: (reason?: string) => void;
  preferGemini?: boolean; // جرّب صوت Gemini الحماسي أولاً (يحتاج إنترنت)
  style?: string;         // وصف نبرة القراءة (يُمرَّر لنموذج Gemini)
  voiceName?: string;     // اسم الصوت في Gemini (الافتراضي: Puck الحيوي)
}

const isNative = () => Capacitor.isNativePlatform();

// مشغّل الصوت الحالي (لإيقافه عند الطلب)
let _currentAudio: HTMLAudioElement | null = null;

/** يحمّل المكتبة الأصلية ديناميكياً فقط على الجوال (يتجنّب كسر بناء الويب) */
/**
 * ⚠️ نُعيد الكائن داخل غلاف { p } وليس مباشرة.
 * إعادة كائن إضافة Capacitor من دالة async تجعل `await` يعامله كـ«وعد»
 * (الـ Proxy يُنتج دالة `then` وهمية لا تستدعي resolve أبداً) فيتعلّق
 * الانتظار للأبد بصمت — وهو العطب نفسه الذي عطّل الإعلانات كلياً.
 */
async function getNativeTTS() {
  try {
    const mod = await import('@capacitor-community/text-to-speech');
    return mod.TextToSpeech ? { p: mod.TextToSpeech } : null;
  } catch {
    return null;
  }
}

/**
 * يحوّل صوت PCM L16 (الذي يُرجعه Gemini) إلى WAV قابل للتشغيل في المتصفح.
 * Gemini يُرجع PCM خام 16-bit، 24000Hz، أحادي القناة — نضيف ترويسة WAV.
 */
function pcmToWavDataUrl(base64Pcm: string, sampleRate = 24000): string {
  const binary = atob(base64Pcm);
  const pcmLen = binary.length;
  const buffer = new ArrayBuffer(44 + pcmLen);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcmLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);       // حجم fmt
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, 1, true);        // قناة واحدة
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, pcmLen, true);
  for (let i = 0; i < pcmLen; i++) view.setUint8(44 + i, binary.charCodeAt(i));

  // حوّل لـ base64 dataURL
  let bin = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

/** يستخرج معدّل العيّنات من mimeType مثل "audio/L16;rate=24000" */
function parseSampleRate(mimeType: string): number {
  const m = mimeType.match(/rate=(\d+)/);
  return m ? parseInt(m[1], 10) : 24000;
}

/**
 * يحاول النطق بصوت Gemini الحماسي. يُرجع true إن نجح وبدأ التشغيل.
 * يحتاج إنترنت — يفشل بهدوء (false) عند انقطاعه ليُجرَّب محرك الجهاز.
 */
async function trySpeakGemini(text: string, onEnd?: () => void, onError?: (r?: string) => void, style?: string, voiceName?: string): Promise<boolean> {
  try {
    const { audioBase64, mimeType } = await geminiTextToSpeech(text, { style, voiceName });
    if (!audioBase64) return false;
    const rate = parseSampleRate(mimeType);
    const dataUrl = pcmToWavDataUrl(audioBase64, rate);
    const audio = new Audio(dataUrl);
    _currentAudio = audio;
    audio.onended = () => { _currentAudio = null; onEnd?.(); };
    audio.onerror = () => { _currentAudio = null; onError?.('GEMINI_AUDIO_PLAY_ERROR'); };
    await audio.play();
    return true;
  } catch (e) {
    console.warn('[tts] Gemini TTS failed, falling back:', e);
    return false;
  }
}

/**
 * ينطق النص. يُعيد true إن بدأ النطق فعلياً، false إن تعذّر (لا محرك/
 * لا لغة مدعومة) — فيستطيع المستدعي عرض رسالة مناسبة.
 */
export async function speak(opts: SpeakOptions): Promise<boolean> {
  const { text, lang = 'ar-SA', rate = 1.06, pitch = 1.12, onEnd, onError, preferGemini = true, style, voiceName } = opts;
  const cleanText = text.trim();
  if (!cleanText) return false;

  // ─── 0. صوت Gemini الحماسي أولاً (إن طُلب وتوفّر إنترنت) ───────────
  if (preferGemini) {
    const geminiOk = await trySpeakGemini(cleanText, onEnd, onError, style, voiceName);
    if (geminiOk) return true;
    // فشل Gemini (لا إنترنت/خطأ) → نكمل لمحرك الجهاز أدناه
  }

  // ─── المسار الأصلي (الجوال) ───────────────────────────────────────
  if (isNative()) {
    const TTS = (await getNativeTTS())?.p ?? null;
    if (TTS) {
      try {
        // تحقق أن اللغة مدعومة (إن لم تكن، نُجرّب أقرب بديل)
        let useLang = lang;
        let langOk = true;
        try {
          const { supported } = await TTS.isLanguageSupported({ lang });
          if (!supported) {
            const prefix = lang.split('-')[0];
            const { languages } = await TTS.getSupportedLanguages();
            const alt = languages.find(l => l.toLowerCase().startsWith(prefix));
            if (alt) {
              useLang = alt;
            } else {
              // اللغة غير مدعومة في المحرك الأصلي → جرّب الويب بدل الاستسلام
              langOk = false;
            }
          }
        } catch { /* بعض الأجهزة لا تدعم isLanguageSupported — نكمل بالأصلي */ }

        if (langOk) {
          await TTS.stop().catch(() => {});
          let settled = false;
          // مهلة أمان: إن لم يبدأ المحرك خلال 1.5s (علّق بصمت)، اسقط للويب
          const safety = setTimeout(() => {
            if (!settled) {
              settled = true;
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                speakWeb(cleanText, lang, rate, pitch, onEnd, onError);
              } else {
                onError?.('NATIVE_TTS_TIMEOUT');
              }
            }
          }, 1500);

          TTS.speak({
            text: cleanText,
            lang: useLang,
            rate,
            pitch,
            volume: 1.0,
            category: 'playback',
          }).then(() => {
            if (!settled) { settled = true; clearTimeout(safety); onEnd?.(); }
          }).catch(() => {
            // فشل المحرك الأصلي → جرّب الويب
            if (!settled) {
              settled = true;
              clearTimeout(safety);
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                speakWeb(cleanText, lang, rate, pitch, onEnd, onError);
              } else {
                onError?.('NATIVE_TTS_FAILED');
              }
            }
          });
          return true;
        }
      } catch { /* خطأ في الأصلي → نسقط للويب أدناه */ }
    }
    // المكتبة غير متوفرة أو اللغة غير مدعومة → نسقط للويب أدناه
  }

  // ─── مسار الويب (المتصفح) ─────────────────────────────────────────
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return speakWeb(cleanText, lang, rate, pitch, onEnd, onError);
  }

  onError?.('NO_TTS_ENGINE');
  return false;
}

/** نطق عبر Web Speech API مع انتظار تحميل الأصوات (موثوقية أعلى) */
function speakWeb(
  text: string, lang: string, rate: number, pitch: number,
  onEnd?: () => void, onError?: (r?: string) => void
): boolean {
  const synth = window.speechSynthesis;
  const langPrefix = lang.split('-')[0].toLowerCase();

  const doSpeak = (): boolean => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const match = voices.find(v => v.lang?.toLowerCase().startsWith(langPrefix));
    if (match) { u.voice = match; u.lang = match.lang; }
    else { u.lang = lang; }
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    u.onend = () => onEnd?.();
    u.onerror = () => onError?.('WEB_TTS_ERROR');
    synth.speak(u);
    // فحص أمان: إن لم يبدأ النطق خلال ثانيتين
    setTimeout(() => {
      if (!synth.speaking && !synth.pending) onError?.('WEB_TTS_SILENT');
    }, 2000);
    return true;
  };

  const voices = synth.getVoices();
  if (voices.length === 0) {
    const onVoices = () => {
      synth.removeEventListener('voiceschanged', onVoices);
      doSpeak();
    };
    synth.addEventListener('voiceschanged', onVoices);
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoices);
      doSpeak();
    }, 1000);
    return true;
  }
  return doSpeak();
}

/** يوقف أي نطق جارٍ (أصلي أو ويب) */
export async function stopSpeaking(): Promise<void> {
  // أوقف صوت Gemini (audio element) إن كان يعمل
  if (_currentAudio) {
    try { _currentAudio.pause(); _currentAudio.currentTime = 0; } catch { /* ignore */ }
    _currentAudio = null;
  }
  if (isNative()) {
    const TTS = (await getNativeTTS())?.p ?? null;
    if (TTS) { try { await TTS.stop(); } catch { /* ignore */ } }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
