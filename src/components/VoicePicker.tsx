/**
 * VoicePicker.tsx — زرّ اختيار الصوت، صالح لكل النوافذ
 * ───────────────────────────────────────────────────────────────────────
 * يُوضع في شريط عنوان أي نافذة بجانب زرّ الاستماع. الاختيار واحد لكل
 * التطبيق (voicePref)، فتغييره من أي نافذة يسري على الباقي فوراً.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as haptics from '../utils/haptics';
import { VOICE_CATALOG, getVoicePref, setVoicePref, subscribeVoice, currentVoiceMeta } from '../utils/voicePref';
import { useApp } from '../context/AppContext';

// نصوص النافذة بأربع لغات. كانت عربيةً ثابتة فتظهر داخل واجهة إنجليزية.
const UI = {
  ar: { title: '🎙️ اختر الصوت', close: 'إغلاق', dialog: 'اختيار الصوت',
        current: (v: string) => `الصوت: ${v}`, change: (v: string) => `تغيير الصوت — الحالي ${v}` },
  en: { title: '🎙️ Choose a voice', close: 'Close', dialog: 'Voice selection',
        current: (v: string) => `Voice: ${v}`, change: (v: string) => `Change voice — currently ${v}` },
  es: { title: '🎙️ Elegir voz', close: 'Cerrar', dialog: 'Selección de voz',
        current: (v: string) => `Voz: ${v}`, change: (v: string) => `Cambiar voz — actual ${v}` },
  zh: { title: '🎙️ 选择语音', close: '关闭', dialog: '语音选择',
        current: (v: string) => `语音：${v}`, change: (v: string) => `更改语音 — 当前 ${v}` },
} as const;

interface Props {
  darkMode?: boolean;
  /** 'bar' لشريط عنوان ملوّن (أيقونة بيضاء)، 'plain' لخلفية عادية. */
  variant?: 'bar' | 'plain';
  className?: string;
}

export default function VoicePicker({ darkMode = true, variant = 'bar', className = '' }: Props) {
  const { language, direction } = useApp();
  const S = UI[language] ?? UI.en;
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(getVoicePref);

  // اختيارٌ غُيِّر من نافذة أخرى يجب أن يظهر هنا بلا إعادة فتح
  useEffect(() => subscribeVoice(setVoice), []);

  const meta = currentVoiceMeta(language);

  const pick = (id: string) => {
    haptics.tap('light');
    setVoicePref(id);
    setVoice(id);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => { haptics.tap('light'); setOpen(true); }}
        title={S.current(meta.label)}
        aria-label={S.change(meta.label)}
        className={`flex h-8 items-center gap-1 rounded-full px-2 text-sm transition active:scale-95 ${
          variant === 'bar'
            ? 'bg-white/20 text-white hover:bg-white/30'
            : darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        } ${className}`}
      >
        <span>🎙️</span>
        <span className="text-[10px] font-bold">{meta.label}</span>
      </button>

      {open && createPortal(
        // ⚠️ portal إلى body: الشريط الجانبي ونوافذ الهاتف تسكن داخل
        // عنصر عليه transform دائم، وأي position:fixed بداخله يُقاس
        // بالنسبة إليه لا إلى الشاشة — فتُحبس اللائحة في زاوية صغيرة.
        <div
          className="modal-backdrop fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={S.dialog}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={direction}
            className={`flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border animate-scale-in ${
              darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'
            }`}
          >
            <div className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
              darkMode ? 'border-gray-800' : 'border-gray-200'
            }`}>
              <span className={`flex items-center gap-2 text-sm font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {S.title}
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label={S.close}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                  darkMode ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-500'
                }`}
              >✕</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {VOICE_CATALOG.map(v => {
                const active = v.id === voice;
                return (
                  <button
                    key={v.id}
                    onClick={() => pick(v.id)}
                    className={`mb-1 flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-start transition ${
                      active
                        ? 'bg-violet-500/15 ring-1 ring-violet-500/50'
                        : darkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold ${
                        active ? 'text-violet-400' : darkMode ? 'text-gray-100' : 'text-gray-800'
                      }`}>{v.emoji} {v.label[language] ?? v.label.en}</span>
                      <span className={`block truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {v.hint[language] ?? v.hint.en}
                      </span>
                    </span>
                    {active && <span className="shrink-0 text-violet-400">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
