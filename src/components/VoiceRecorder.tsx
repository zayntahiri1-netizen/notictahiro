/**
 * VoiceRecorder.tsx
 * ─────────────────────────────────────────────────────────────────────
 * تدوين صوتي حقيقي — يحل مشكلتين معاً:
 *
 * 1) التسجيل: MediaRecorder يسجّل صوتاً حقيقياً (لا يُستخدم getUserMedia
 *    فقط لقياس مستوى الصوت كما كان سابقاً — الصوت نفسه يُحفظ الآن).
 * 2) الحفظ الدائم: الصوت يُكتب فعلياً على الجهاز عبر @capacitor/filesystem
 *    (Directory.Data/voice-notes/) فيبقى متاحاً للاستماع حتى بعد إغلاق
 *    التطبيق — على الويب (معاينة غير أصلية) يُستخدم Blob URL مؤقت.
 * 3) التحويل إلى نص: الصوت يُرسل إلى Gemini عبر gemini-proxy (دالة
 *    geminiTranscribeAudio) بدل الاعتماد على Web Speech API غير
 *    الموثوقة داخل WebView على أندرويد — أدق وتدعم الدارجة المغربية.
 * 4) عند فشل التحويل (شبكة/حصة): الصوت يبقى محفوظاً دائماً، مع زر
 *    "إعادة محاولة التحويل" بدل ضياع التسجيل بالكامل.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';
import { geminiTranscribeAudio } from '../utils/geminiService';

export interface VoiceResult {
  text: string;
  audio?: {
    uri: string;
    path?: string;
    duration: number;
    mimeType: string;
    pendingTranscription?: boolean;
  };
}

interface VoiceRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: VoiceResult) => void;
  darkMode: boolean;
}

type RecordState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

// ── أفضل صيغة صوت مدعومة على هذا الجهاز ──────────────────────────────
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return 'audio/webm';
}

function extFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('aac')) return 'aac';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

// ── تحويل Blob إلى base64 خام (بدون رأس data:...) ────────────────────
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── حفظ الصوت بشكل دائم (أصلي) أو مؤقت (ويب) ─────────────────────────
async function persistAudio(blob: Blob, base64: string, mimeType: string): Promise<{ uri: string; path?: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const fileName = `voice-notes/${Date.now()}.${extFromMime(mimeType)}`;
      // إنشاء المجلد الفرعي إن لم يكن موجوداً (recursive)
      try {
        await Filesystem.mkdir({ path: 'voice-notes', directory: Directory.Data, recursive: true });
      } catch { /* المجلد موجود مسبقاً */ }
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Data,
      });
      // نُعيد المسار الخام (fileName) أيضاً — يلزم لإعادة قراءة الملف
      // عبر Filesystem.readFile عند إعادة محاولة التحويل لاحقاً (ربما
      // بعد إغلاق التطبيق وإعادة فتحه، حيث لا يبقى base64 في الذاكرة).
      return { uri: Capacitor.convertFileSrc(result.uri), path: fileName };
    } catch (e) {
      console.warn('[VoiceRecorder] Filesystem save failed, falling back to blob URL:', e);
    }
  }
  // الويب (معاينة غير أصلية) — رابط مؤقت لا يبقى بعد إعادة التحميل
  return { uri: URL.createObjectURL(blob) };
}

export default function VoiceRecorder({ isOpen, onClose, onResult, darkMode }: VoiceRecorderProps) {
  const { t } = useApp();
  const [state, setState] = useState<RecordState>('idle');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [savedAudio, setSavedAudio] = useState<{ uri: string; path?: string; duration: number; mimeType: string; base64: string } | null>(null);
  const [isOfflineSave, setIsOfflineSave] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  useEffect(() => {
    if (!isOpen) {
      stopAll();
      setError('');
      setDuration(0);
      setSavedAudio(null);
      setIsOfflineSave(false);
      setState('idle');
    }
  }, [isOpen]);

  function stopAll() {
    try { mediaRecorderRef.current?.state !== 'inactive' && mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    mediaRecorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close().catch(() => null);
    }
    audioCtxRef.current = null;
  }

  useEffect(() => stopAll, []);

  function startVolumeMonitor(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(100, avg * 2));
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch { /* بيئة بدون AudioContext */ }
  }

  // ── بدء التسجيل الحقيقي ──────────────────────────────────────────
  async function startRecording() {
    setError('');
    setDuration(0);
    setSavedAudio(null);
    setIsOfflineSave(false);

    if (typeof MediaRecorder === 'undefined') {
      setError(t('vrNoSupport'));
      setState('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t('vrMicDenied'));
      setState('error');
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      void handleStopped();
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    startVolumeMonitor(stream);

    setState('recording');
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }

  // ── إيقاف التسجيل ثم المعالجة ────────────────────────────────────
  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    setState('transcribing');
  }

  async function handleStopped() {
    const finalDuration = duration;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });

    if (blob.size === 0) {
      setError(t('vrErrNoSpeech'));
      setState('error');
      return;
    }

    try {
      const base64 = await blobToBase64(blob);
      const { uri, path } = await persistAudio(blob, base64, mimeTypeRef.current);
      setSavedAudio({ uri, path, duration: finalDuration, mimeType: mimeTypeRef.current, base64 });

      // ── لا يوجد إنترنت: لا تحاول الاتصال بـ Gemini أصلاً (توفير وقت
      // وبطارية) — الصوت محفوظ بالفعل بشكل دائم. نعرض رسالة واضحة بدل
      // الإغلاق الصامت، ثم نُغلق تلقائياً بعد لحظة (أو فوراً عند نقر المستخدم).
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setIsOfflineSave(true);
        setError(t('vrOfflineSaved'));
        setState('done');
        return;
      }

      // إرسال للتحويل عبر Gemini
      try {
        const text = await geminiTranscribeAudio(base64, mimeTypeRef.current);
        if (text.trim()) {
          onResult({
            text: formatTranscript(text),
            audio: { uri, path, duration: finalDuration, mimeType: mimeTypeRef.current },
          });
          onClose();
          return;
        }
        // نص فارغ — اعتبره فشلاً ودياً
        setError(t('vrSavedNoText'));
        setState('done');
      } catch (transcribeErr) {
        console.warn('[VoiceRecorder] transcription failed:', transcribeErr);
        // فشل أثناء الاتصال (شبكة متقطعة/حصة/مهلة) — نُبقي المستخدم في
        // النافذة مع خيار إعادة المحاولة فوراً أو إدراج الصوت بدون نص
        // (سيُعاد المحاولة تلقائياً في الخلفية أيضاً لو أُدرِج بدون نص).
        setError(t('vrSavedNoText'));
        setState('done');
      }
    } catch (saveErr) {
      console.error('[VoiceRecorder] save failed:', saveErr);
      setError(t('vrErrAborted'));
      setState('error');
    }
  }

  // ── إعادة محاولة التحويل فقط (الصوت محفوظ مسبقاً) ────────────────
  async function retryTranscribe() {
    if (!savedAudio) return;
    setState('transcribing');
    setError('');
    try {
      const text = await geminiTranscribeAudio(savedAudio.base64, savedAudio.mimeType);
      if (text.trim()) {
        onResult({
          text: formatTranscript(text),
          audio: { uri: savedAudio.uri, path: savedAudio.path, duration: savedAudio.duration, mimeType: savedAudio.mimeType },
        });
        onClose();
        return;
      }
      setError(t('vrSavedNoText'));
      setState('done');
    } catch (e) {
      console.warn('[VoiceRecorder] retry failed:', e);
      setError(t('vrSavedNoText'));
      setState('done');
    }
  }

  // ── إدراج الصوت بدون نص (المستخدم يكتب يدوياً، أو لا إنترنت الآن) ──
  // pendingTranscription=true يُسجَّل دائماً هنا — حتى لو كان الفشل بسبب
  // آخر غير الشبكة، فلا ضرر من إعادة محاولة تلقائية لاحقاً عند الاتصال.
  function insertAudioOnly() {
    if (!savedAudio) return;
    onResult({
      text: '',
      audio: { uri: savedAudio.uri, path: savedAudio.path, duration: savedAudio.duration, mimeType: savedAudio.mimeType, pendingTranscription: true },
    });
    onClose();
  }

  function formatTranscript(raw: string): string {
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    return `\n\n## 🎙️ ${t('vrVoiceNote')}\n\n${cleaned}\n\n> 🤖 ${t('vrAutoNote')}`;
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>

        <div className="relative px-6 pt-6 pb-4 text-center"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
          <button onClick={() => { stopAll(); onClose(); }}
            className="absolute top-4 end-4 text-white/70 hover:text-white text-xl">✕</button>
          <p className="text-white/80 text-sm font-medium mb-1">{t('vrRecordingTitle')}</p>

          <div className="flex items-center justify-center gap-0.5 my-3 h-12">
            {state === 'recording' ? (
              Array.from({ length: 20 }).map((_, i) => (
                <div key={i}
                  className="w-1 rounded-full transition-all duration-75"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    height: `${Math.max(4, Math.random() * volume * 0.4 + 4)}px`,
                    animationDelay: `${i * 50}ms`
                  }}
                />
              ))
            ) : (
              <span className="text-4xl">
                {state === 'idle' && '🎙️'}
                {state === 'transcribing' && '⏳'}
                {state === 'done' && (error ? '🎧' : '✅')}
                {state === 'error' && '❌'}
              </span>
            )}
          </div>

          {(state === 'recording' || state === 'done') && (
            <p className="text-white font-mono text-lg">{fmt(duration)}</p>
          )}
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {state === 'idle' && (
            <p className={`text-sm text-center mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('vrHint')}
            </p>
          )}
          {state === 'transcribing' && (
            <p className={`text-sm text-center mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('vrTranscribing')}
            </p>
          )}

          <div className="flex gap-3">
            {(state === 'idle' || state === 'error') && (
              <button onClick={startRecording}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm
                  active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                {t('vrStart')}
              </button>
            )}

            {state === 'recording' && (
              <button onClick={stopRecording}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm
                  active:scale-95 transition-transform animate-pulse"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                {t('vrStop')}
              </button>
            )}

            {state === 'done' && error && savedAudio && (
              <>
                <button onClick={insertAudioOnly}
                  className={`${isOfflineSave ? 'flex-1' : ''} px-4 py-3 rounded-2xl text-sm font-medium active:scale-95
                    ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  {t('vrSaveQueued')}
                </button>
                {!isOfflineSave && (
                  <button onClick={retryTranscribe}
                    className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm
                      active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                    {t('vrRetryTranscribe')}
                  </button>
                )}
              </>
            )}
          </div>

          <p className={`text-xs text-center mt-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            يدعم العربية (الدارجة) · English · Español · 中文
          </p>
        </div>
      </div>
    </div>
  );
}
