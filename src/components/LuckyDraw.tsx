/**
 * LuckyDraw.tsx — القرعة
 * ───────────────────────────────────────────────────────────────────────
 * قائمة مشاركين، ثم سحبٌ عشوائي. مع وضع «بلا تكرار» الذي يُخرج الفائز من
 * القائمة — وهو ما يلزم فعلاً عند توزيع أدوار أو ترتيب دور.
 *
 * ⚠️ العشوائية من crypto.getRandomValues لا من Math.random. السبب أن
 *    القرعة قد تُستعمل في قسمةٍ بين أشخاص، و Math.random في بعض المحرّكات
 *    متحيّزة ويمكن التنبّؤ بها. والفرق لا يكلّف شيئاً هنا.
 */
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as haptics from '../utils/haptics';
import ListenButton from './ListenButton';

interface Props { onClose: () => void }

const KEY = 'notic-draw-names';

const UI = {
  ar: {
    badge: 'اختيار عادل', title: 'القرعة',
    desc: 'اكتب الأسماء أو الخيارات، ودع القرعة تختار',
    placeholder: 'اكتب اسماً أو خياراً ثم اضغط Enter',
    add: 'إضافة', draw: '🎲 اسحب', drawing: 'جارٍ السحب…',
    winner: 'الفائز', noRepeat: 'بلا تكرار (يُخرج الفائز)',
    list: 'القائمة', count: (n: number) => `${n} مدخلاً`,
    empty: 'أضف مدخلين على الأقل لتبدأ القرعة.',
    needTwo: 'تحتاج مدخلين على الأقل',
    dup: 'هذا المدخل موجود',
    clear: 'مسح الكل', confirmClear: 'سيُمسح كل المدخلين. متأكد؟',
    restore: '↺ أعِد الجميع', history: 'آخر النتائج',
    paste: 'أو الصق قائمة (سطر لكل مدخل)',
  },
  en: {
    badge: 'Fair pick', title: 'Lucky draw',
    desc: 'Enter names or options and let the draw choose',
    placeholder: 'Type a name or option, then press Enter',
    add: 'Add', draw: '🎲 Draw', drawing: 'Drawing…',
    winner: 'Winner', noRepeat: 'No repeat (remove the winner)',
    list: 'List', count: (n: number) => `${n} entries`,
    empty: 'Add at least two entries to start the draw.',
    needTwo: 'You need at least two entries',
    dup: 'That entry already exists',
    clear: 'Clear all', confirmClear: 'This clears every entry. Sure?',
    restore: '↺ Restore all', history: 'Recent results',
    paste: 'Or paste a list (one per line)',
  },
  es: {
    badge: 'Elección justa', title: 'Sorteo',
    desc: 'Escribe nombres u opciones y deja que el sorteo elija',
    placeholder: 'Escribe un nombre u opción y pulsa Enter',
    add: 'Añadir', draw: '🎲 Sortear', drawing: 'Sorteando…',
    winner: 'Ganador', noRepeat: 'Sin repetir (quita al ganador)',
    list: 'Lista', count: (n: number) => `${n} entradas`,
    empty: 'Añade al menos dos entradas para sortear.',
    needTwo: 'Necesitas al menos dos entradas',
    dup: 'Esa entrada ya existe',
    clear: 'Borrar todo', confirmClear: 'Se borrarán todas las entradas. ¿Seguro?',
    restore: '↺ Restaurar todo', history: 'Resultados recientes',
    paste: 'O pega una lista (una por línea)',
  },
  zh: {
    badge: '公平抽选', title: '抽签',
    desc: '输入名字或选项，让抽签来决定',
    placeholder: '输入名字或选项，然后按 Enter',
    add: '添加', draw: '🎲 抽签', drawing: '抽选中…',
    winner: '中选', noRepeat: '不重复（移除中选者）',
    list: '列表', count: (n: number) => `${n} 项`,
    empty: '至少添加两项才能开始抽签。',
    needTwo: '至少需要两项',
    dup: '该项已存在',
    clear: '全部清除', confirmClear: '这将清除全部条目。确定吗？',
    restore: '↺ 全部恢复', history: '最近结果',
    paste: '或粘贴列表（每行一项）',
  },
} as const;

/** عدد صحيح عشوائي في [0, max) بلا انحياز القسمة. */
function randomIndex(max: number): number {
  if (max <= 0) return 0;
  try {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    for (let i = 0; i < 20; i++) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
    return buf[0] % max;
  } catch {
    return Math.floor(Math.random() * max);
  }
}

export default function LuckyDraw({ onClose }: Props) {
  const { darkMode, language, direction } = useApp();
  const S = UI[language] ?? UI.en;

  const [all, setAll] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; }
  });
  const [pool, setPool] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [noRepeat, setNoRepeat] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState('');
  const [winner, setWinner] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [warn, setWarn] = useState('');
  const timers = useRef<number[]>([]);

  // المجموعة القابلة للسحب تتبع القائمة حين لا نكون في وضع بلا تكرار
  useEffect(() => { setPool(all); }, [all]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* غير حرج */ }
  }, [all]);

  // ⚠️ المؤقّتات تُلغى عند الإغلاق، وإلا استدعت setState على مكوّن مُزال
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const add = (raw: string) => {
    const names = raw.split('\n').map(x => x.trim()).filter(Boolean);
    if (!names.length) return;
    setAll(prev => {
      const seen = new Set(prev);
      const fresh = names.filter(n => !seen.has(n));
      if (!fresh.length) { setWarn(S.dup); return prev; }
      setWarn('');
      return [...prev, ...fresh].slice(0, 300);
    });
    setInput('');
  };

  const removeOne = (name: string) => {
    haptics.tap('light');
    setAll(prev => prev.filter(n => n !== name));
  };

  const clearAll = () => {
    if (!window.confirm(S.confirmClear)) return;
    haptics.tap('heavy');
    setAll([]); setWinner(''); setHistory([]);
  };

  const draw = () => {
    const source = noRepeat ? pool : all;
    if (source.length < 2) { setWarn(S.needTwo); return; }
    setWarn(''); setWinner(''); setSpinning(true);
    haptics.tap('medium');

    // دوران مرئي قصير — ١٢ قفزة متسارعة ثم الوقوف
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let delay = 60;
    for (let i = 0; i < 12; i++) {
      const id = window.setTimeout(() => setFlash(source[randomIndex(source.length)]), delay);
      timers.current.push(id);
      delay += 25 + i * 14;
    }
    const finalId = window.setTimeout(() => {
      const picked = source[randomIndex(source.length)];
      setFlash('');
      setWinner(picked);
      setSpinning(false);
      setHistory(prev => [picked, ...prev].slice(0, 10));
      void haptics.success();
      if (noRepeat) setPool(prev => prev.filter(n => n !== picked));
    }, delay);
    timers.current.push(finalId);
  };

  const card = darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const source = noRepeat ? pool : all;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        dir={direction}
        className={`glass-card w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(245,158,11,0.3)] ${darkMode ? 'text-white' : 'text-gray-900'}`}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl border border-white/30">🎲</div>
            <div className="min-w-0">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 border border-white/30 uppercase tracking-wider">{S.badge}</span>
              <h2 className="text-xl font-black mt-1 truncate">{S.title}</h2>
              <p className="text-[11px] text-white/80 truncate">{S.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 shrink-0">
            <ListenButton label={S.title} darkMode={darkMode} />
            <button onClick={onClose} aria-label="✕" className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* شاشة النتيجة */}
          <div className={`rounded-2xl border p-6 text-center ${card}`}>
            {spinning ? (
              <>
                <div className={`text-[11px] font-bold ${muted}`}>{S.drawing}</div>
                <div className="mt-2 text-2xl font-black text-amber-500 truncate">{flash || '…'}</div>
              </>
            ) : winner ? (
              <>
                <div className={`text-[11px] font-bold ${muted}`}>🏆 {S.winner}</div>
                <div className="mt-2 text-3xl font-black text-amber-500 break-words">{winner}</div>
              </>
            ) : (
              <div className={`text-sm ${muted}`}>{all.length < 2 ? S.empty : '🎲'}</div>
            )}
          </div>

          <button
            onClick={draw}
            disabled={spinning || source.length < 2}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-3.5 text-base font-black text-white transition hover:scale-[1.01] disabled:opacity-40"
          >
            {spinning ? S.drawing : S.draw}
          </button>
          {warn && <div className="text-center text-xs font-bold text-amber-500">{warn}</div>}

          <label className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs font-bold ${card}`}>
            <span>{S.noRepeat}</span>
            <input type="checkbox" checked={noRepeat} onChange={e => { setNoRepeat(e.target.checked); setPool(all); }} className="h-4 w-4 accent-amber-500" />
          </label>

          {noRepeat && pool.length < all.length && (
            <button onClick={() => { setPool(all); setWinner(''); }} className="w-full rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-500">
              {S.restore} ({all.length - pool.length})
            </button>
          )}

          {/* الإدخال */}
          <div className="space-y-2">
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); if (warn) setWarn(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(input); } }}
              placeholder={`${S.placeholder}\n${S.paste}`}
              rows={2}
              className={`w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-500' : 'border-gray-200 bg-white placeholder-gray-400'}`}
            />
            <button onClick={() => add(input)} disabled={!input.trim()} className={`w-full rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-40 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
              + {S.add}
            </button>
          </div>

          {/* القائمة */}
          {all.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-black">{S.list} · <span className={muted}>{S.count(all.length)}</span></span>
                <button onClick={clearAll} className="text-[11px] font-bold text-rose-500 hover:underline">{S.clear}</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {all.map(n => {
                  const out = noRepeat && !pool.includes(n);
                  return (
                    <span key={n} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${out ? 'opacity-40 line-through' : ''} ${card}`}>
                      {n}
                      <button onClick={() => removeOne(n)} aria-label="✕" className="opacity-50 hover:opacity-100">✕</button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div className="mb-1.5 text-sm font-black">{S.history}</div>
              <div className={`rounded-xl border p-2.5 text-xs ${card} ${muted}`}>
                {history.map((h, i) => <div key={`${h}-${i}`} className="truncate">{i + 1}. {h}</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
