/**
 * TimeUsage.tsx — استعمال الزمن
 * ───────────────────────────────────────────────────────────────────────
 * مؤقّت يعمل على نشاطٍ واحد في كل مرة، ويسجّل كل جلسة. ثم يُظهر أين ذهب
 * يومُك وأسبوعُك بالدقائق.
 *
 * لا يكرّر FocusSprint: تلك جلسةُ تركيزٍ على ملاحظة بعينها، وهذه سجلّ
 * زمنٍ عامّ عبر الأيام.
 *
 * ⚠️ الوقت يُحسب من طابعٍ زمني مخزَّن لا من عدّادٍ في الذاكرة. فلو أُغلق
 *    التطبيق أو نام الهاتف والمؤقّت يعمل، يبقى الحساب صحيحاً عند العودة.
 *    عدّادٌ يعتمد على setInterval وحده يخسر كل ثانية يغيب فيها التطبيق.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../utils/dateLocale';
import * as haptics from '../utils/haptics';
import ListenButton from './ListenButton';
import Timetable, { type Slot } from './Timetable';

interface Props { onClose: () => void }

interface Session { id: string; label: string; start: number; end: number }
interface Running { label: string; start: number }

const KEY_LOG = 'notic-time-log';
const KEY_RUN = 'notic-time-running';
const KEY_TT  = 'notic-timetable';

const UI = {
  ar: {
    tabLog: 'السجل', tabTable: 'الجدول',
    badge: 'سجل الزمن', title: 'استعمال الزمن',
    desc: 'شغّل المؤقّت على نشاط، وسيُسجَّل تلقائياً لترى أين يذهب وقتك',
    placeholder: 'على ماذا تعمل الآن؟',
    start: '▶ ابدأ', stop: '⏹ أوقف', running: 'يعمل الآن',
    today: 'اليوم', week: 'آخر 7 أيام', all: 'الإجمالي',
    byActivity: 'حسب النشاط', recent: 'الجلسات الأخيرة',
    empty: 'لا جلسات بعد. اكتب نشاطاً واضغط «ابدأ».',
    emptyToday: 'لم تُسجَّل جلسات اليوم.',
    needLabel: 'اكتب اسم النشاط أوّلاً',
    del: 'حذف', clear: 'مسح السجل', confirmClear: 'سيُحذف السجل كاملاً. متأكد؟',
    h: 'س', m: 'د', sessions: 'جلسة',
  },
  en: {
    tabLog: 'Log', tabTable: 'Timetable',
    badge: 'Time log', title: 'Time usage',
    desc: 'Run a timer on an activity and it is logged, so you can see where your time goes',
    placeholder: 'What are you working on?',
    start: '▶ Start', stop: '⏹ Stop', running: 'Running',
    today: 'Today', week: 'Last 7 days', all: 'Total',
    byActivity: 'By activity', recent: 'Recent sessions',
    empty: 'No sessions yet. Type an activity and press Start.',
    emptyToday: 'No sessions logged today.',
    needLabel: 'Type an activity name first',
    del: 'Delete', clear: 'Clear log', confirmClear: 'This deletes the whole log. Sure?',
    h: 'h', m: 'm', sessions: 'sessions',
  },
  es: {
    tabLog: 'Registro', tabTable: 'Horario',
    badge: 'Registro', title: 'Uso del tiempo',
    desc: 'Pon en marcha un temporizador y queda registrado, para ver adónde va tu tiempo',
    placeholder: '¿En qué estás trabajando?',
    start: '▶ Iniciar', stop: '⏹ Parar', running: 'En marcha',
    today: 'Hoy', week: 'Últimos 7 días', all: 'Total',
    byActivity: 'Por actividad', recent: 'Sesiones recientes',
    empty: 'Aún no hay sesiones. Escribe una actividad y pulsa Iniciar.',
    emptyToday: 'Hoy no hay sesiones registradas.',
    needLabel: 'Escribe primero el nombre de la actividad',
    del: 'Eliminar', clear: 'Borrar registro', confirmClear: 'Se borrará todo el registro. ¿Seguro?',
    h: 'h', m: 'min', sessions: 'sesiones',
  },
  zh: {
    tabLog: '记录', tabTable: '课表',
    badge: '时间记录', title: '时间使用',
    desc: '为某项活动启动计时器，系统会自动记录，让你看清时间去了哪里',
    placeholder: '你正在做什么？',
    start: '▶ 开始', stop: '⏹ 停止', running: '进行中',
    today: '今天', week: '最近 7 天', all: '总计',
    byActivity: '按活动', recent: '最近的记录',
    empty: '还没有记录。输入活动名称并点击「开始」。',
    emptyToday: '今天还没有记录。',
    needLabel: '请先输入活动名称',
    del: '删除', clear: '清空记录', confirmClear: '这将删除全部记录。确定吗？',
    h: '小时', m: '分', sessions: '次',
  },
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* تخزين ممتلئ — لا نُسقط الواجهة */ }
}

/** مدة بالمللي ثانية → «2س 15د». تتجنّب «0س» و«0د» معاً. */
function fmtDur(ms: number, S: typeof UI['ar']): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}${S.h} ${m}${S.m}`;
  if (h) return `${h}${S.h}`;
  return `${m}${S.m}`;
}

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export default function TimeUsage({ onClose }: Props) {
  const { darkMode, language, direction } = useApp();
  const S = UI[language] ?? UI.en;

  const [sessions, setSessions] = useState<Session[]>(() => load<Session[]>(KEY_LOG, []));
  const [running, setRunning] = useState<Running | null>(() => load<Running | null>(KEY_RUN, null));
  const [label, setLabel] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [warn, setWarn] = useState('');
  const [tab, setTab] = useState<'log' | 'table'>('log');
  const [slots, setSlots] = useState<Slot[]>(() => load<Slot[]>(KEY_TT, []));
  const inputRef = useRef<HTMLInputElement>(null);

  // نبضة كل ثانية لعرض العدّاد فقط — الحساب نفسه من الطوابع الزمنية
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => { save(KEY_LOG, sessions); }, [sessions]);
  useEffect(() => { save(KEY_RUN, running); }, [running]);
  useEffect(() => { save(KEY_TT, slots); }, [slots]);

  const begin = () => {
    const name = label.trim();
    if (!name) { setWarn(S.needLabel); inputRef.current?.focus(); return; }
    setWarn('');
    haptics.tap('medium');
    setRunning({ label: name, start: Date.now() });
    setNow(Date.now());
  };

  const finish = () => {
    if (!running) return;
    haptics.tap('medium');
    const end = Date.now();
    // جلسة أقصر من 5 ثوانٍ غالباً ضغطة خاطئة — لا تُسجَّل
    if (end - running.start >= 5000) {
      setSessions(prev => [
        { id: `${running.start}-${Math.random().toString(36).slice(2, 7)}`, label: running.label, start: running.start, end },
        ...prev,
      ].slice(0, 500));
    }
    setRunning(null);
    setLabel('');
  };

  const removeOne = (id: string) => {
    haptics.tap('light');
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const clearAll = () => {
    if (!window.confirm(S.confirmClear)) return;
    haptics.tap('heavy');
    setSessions([]);
  };

  const stats = useMemo(() => {
    const todayStart = startOfDay(Date.now());
    const weekStart = todayStart - 6 * 86400000;
    let today = 0, week = 0, all = 0;
    const perActivity = new Map<string, number>();
    for (const s of sessions) {
      const d = s.end - s.start;
      all += d;
      if (s.start >= weekStart) week += d;
      if (s.start >= todayStart) {
        today += d;
        perActivity.set(s.label, (perActivity.get(s.label) ?? 0) + d);
      }
    }
    const top = [...perActivity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = top.length ? top[0][1] : 1;
    return { today, week, all, top, max };
  }, [sessions]);

  const elapsed = running ? now - running.start : 0;
  const card = darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        dir={direction}
        className={`glass-card w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(14,165,233,0.25)] ${darkMode ? 'text-white' : 'text-gray-900'}`}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 p-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl border border-white/30">⏱️</div>
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex gap-1.5">
            {([['log', S.tabLog], ['table', S.tabTable]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition ${tab === k ? 'bg-sky-500 text-white' : darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                {lbl}
              </button>
            ))}
          </div>

          {tab === 'table' && <Timetable slots={slots} onChange={setSlots} />}

          {tab === 'log' && <>
          {/* المؤقّت */}
          <div className={`rounded-2xl border p-4 ${card}`}>
            {running ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className={muted}>{S.running}</span>
                </div>
                <div className="text-2xl font-black truncate max-w-full">{running.label}</div>
                <div className="text-4xl font-black tabular-nums text-sky-500">
                  {String(Math.floor(elapsed / 3600000)).padStart(2, '0')}:
                  {String(Math.floor(elapsed / 60000) % 60).padStart(2, '0')}:
                  {String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}
                </div>
                <button onClick={finish} className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-3 text-sm font-black text-white transition hover:scale-[1.01]">
                  {S.stop}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  value={label}
                  onChange={e => { setLabel(e.target.value); if (warn) setWarn(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') begin(); }}
                  placeholder={S.placeholder}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-500' : 'border-gray-200 bg-white placeholder-gray-400'}`}
                />
                {warn && <div className="text-xs font-bold text-amber-500">{warn}</div>}
                <button onClick={begin} className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-5 py-3 text-sm font-black text-white transition hover:scale-[1.01]">
                  {S.start}
                </button>
              </div>
            )}
          </div>

          {/* الإجماليات */}
          <div className="grid grid-cols-3 gap-2">
            {([[S.today, stats.today], [S.week, stats.week], [S.all, stats.all]] as const).map(([k, v]) => (
              <div key={k} className={`rounded-2xl border p-3 text-center ${card}`}>
                <div className={`text-[11px] font-bold ${muted}`}>{k}</div>
                <div className="text-lg font-black text-sky-500">{fmtDur(v, S)}</div>
              </div>
            ))}
          </div>

          {/* حسب النشاط — اليوم */}
          <div>
            <div className="mb-2 text-sm font-black">{S.byActivity} · {S.today}</div>
            {stats.top.length === 0 ? (
              <div className={`rounded-2xl border p-4 text-center text-xs ${card} ${muted}`}>{S.emptyToday}</div>
            ) : (
              <div className="space-y-2">
                {stats.top.map(([name, ms]) => (
                  <div key={name} className={`rounded-xl border p-2.5 ${card}`}>
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="truncate">{name}</span>
                      <span className="shrink-0 text-sky-500">{fmtDur(ms, S)}</span>
                    </div>
                    <div className={`mt-1.5 h-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-sky-500 to-teal-500" style={{ width: `${Math.max(4, (ms / stats.max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* الجلسات الأخيرة */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-black">{S.recent}</span>
              {sessions.length > 0 && (
                <button onClick={clearAll} className="text-[11px] font-bold text-rose-500 hover:underline">{S.clear}</button>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className={`rounded-2xl border p-4 text-center text-xs ${card} ${muted}`}>{S.empty}</div>
            ) : (
              <div className="space-y-1.5">
                {sessions.slice(0, 20).map(s => (
                  <div key={s.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${card}`}>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold">{s.label}</div>
                      <div className={`text-[10px] ${muted}`}>{fmtDate(s.start, language, { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-black text-sky-500">{fmtDur(s.end - s.start, S)}</span>
                      <button onClick={() => removeOne(s.id)} aria-label={S.del} className="text-xs opacity-50 hover:opacity-100">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>}
        </div>
      </div>
    </div>
  );
}
