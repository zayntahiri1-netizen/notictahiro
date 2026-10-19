/**
 * ErrorLogModal — شاشة سجل الأخطاء داخل التطبيق
 * ───────────────────────────────────────────────────────────────────────
 * الغرض: تحويل "التطبيق لا يعمل" إلى سطر يحدّد السبب.
 * الـ APK لا يُظهر console، فكل خطأ كان يختفي بلا أثر — وهذا ما جعل كل
 * عطب في هذا التطبيق يُشخَّص بالتخمين عبر عدّة نسخ. هنا يُعرض كل شيء،
 * وبضغطة واحدة يُنسخ النص كاملاً لإرساله لمن يساعدك.
 */
import { useEffect, useState } from 'react';
import { getEntries, clearEntries, onEntries, formatForCopy, type LogEntry } from '../utils/errorLog';
import * as haptics from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
  appVersion: string;
}

export default function ErrorLogModal({ isOpen, onClose, darkMode = false, appVersion }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>(() => getEntries());
  const [copied, setCopied] = useState(false);

  useEffect(() => onEntries(setEntries), []);
  useEffect(() => { if (isOpen) setEntries(getEntries()); }, [isOpen]);

  if (!isOpen) return null;

  const copy = async () => {
    haptics.tap('light');
    const text = formatForCopy(appVersion);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // الحافظة محجوبة في بعض الـ WebView — بديل قديم لكنه يعمل هناك.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* تعذّر النسخ — النص ظاهر على الشاشة بأي حال */ }
    }
  };

  const errors = entries.filter((e) => e.level === 'error').length;

  return (
    <div
      className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-no-listen
        className={`glass-card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس */}
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🩺</span>
            <div>
              <div className="font-bold leading-tight">سجل الأخطاء</div>
              <div className="text-[10px] opacity-70">
                {entries.length === 0 ? 'لا أخطاء' : `${entries.length} حدث · ${errors} خطأ`}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="h-8 w-8 rounded-full hover:bg-white/20">✕</button>
        </div>

        {/* القائمة */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <div className={`py-10 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="mb-2 text-4xl">✅</div>
              لا توجد أخطاء مسجّلة.
              <div className="mt-1 text-xs opacity-70">
                إن لاحظت خللاً، افتح هذه الشاشة بعده مباشرة.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...entries].reverse().map((e, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-2 text-xs ${
                    e.level === 'error'
                      ? 'border-red-500/30 bg-red-500/10'
                      : 'border-amber-500/30 bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {e.level === 'error' ? '🔴' : '⚠️'} {e.scope}
                    </span>
                    <span className="shrink-0 text-[10px] opacity-60">
                      {new Date(e.t).toLocaleTimeString('en-GB', { hour12: false })}
                    </span>
                  </div>
                  <div className="mt-1 break-words font-mono text-[11px] leading-snug opacity-90">
                    {e.msg}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* الأزرار */}
        <div className={`flex gap-2 border-t p-3 shrink-0 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            onClick={() => { void copy(); }}
            disabled={entries.length === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {copied ? '✅ نُسخ' : '📋 نسخ السجل'}
          </button>
          <button
            onClick={() => { haptics.tap('light'); clearEntries(); }}
            disabled={entries.length === 0}
            className={`rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-40 ${
              darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}
          >
            🗑️ مسح
          </button>
        </div>
      </div>
    </div>
  );
}
