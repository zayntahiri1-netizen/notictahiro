/**
 * MicButton.tsx — زر ميكروفون مشترك (تسجيل صوتي → تحويل لنص)
 * ─────────────────────────────────────────────────────────────────────
 * مكوّن واحد قابل لإعادة الاستخدام في كل مكان يحتاج إدخالاً صوتياً
 * (تفريغ الدماغ، محادثة AI، إلخ). يسجّل عبر MediaRecorder ويحوّل عبر
 * Gemini (يدعم الدارجة المغربية). يستدعي onTranscribed بالنص الناتج.
 *
 * الاستخدام:
 *   <MicButton onTranscribed={(text) => setValue(prev => prev + ' ' + text)} />
 */

import { useState, useRef } from 'react';
import { geminiTranscribeAudio } from '../utils/geminiService';

interface MicButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
  /** حجم الزر: 'sm' للحقول الصغيرة، 'md' الافتراضي */
  size?: 'sm' | 'md';
  darkMode?: boolean;
}

export default function MicButton({ onTranscribed, disabled, size = 'md', darkMode }: MicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>('audio/webm');

  const pickMime = (): string => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return 'audio/webm';
  };

  const startRecording = async () => {
    if (isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      mimeRef.current = mimeType.split(';')[0];
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mimeRef.current });
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const text = await geminiTranscribeAudio(base64, mimeRef.current);
          if (text?.trim()) onTranscribed(text.trim());
        } catch (e) {
          console.warn('[MicButton] transcription failed:', e);
        } finally {
          setIsTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.warn('[MicButton] mic error:', e);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
  };

  const toggle = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const dim = size === 'sm' ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isTranscribing}
      title="🎤"
      className={`${dim} shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-40
        ${isRecording
          ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-300'
          : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {isTranscribing ? '⏳' : isRecording ? '⏹️' : '🎤'}
    </button>
  );
}
