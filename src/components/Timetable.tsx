/**
 * Timetable.tsx — الجدول الزمني (جدول الحصص)
 * ───────────────────────────────────────────────────────────────────────
 * جدولٌ أسبوعي متكرّر مثل جدول الحصص في المدرسة: يوم × وقت × نشاط. ثم
 * ثلاثة عروض — يومي وأسبوعي وشهري.
 *
 * يُستعمل داخل نافذة «استعمال الزمن» كلسانٍ ثانٍ. والفرق بينه وبين سجلّ
 * الزمن جوهري: السجلّ يقيس ما **حدث**، وهذا يرسم ما **خُطِّط**.
 *
 * ⚠️ الأسبوع يبدأ بالأحد في المغرب والعالم العربي، وبالاثنين في أوروبا
 *    والصين. فبداية الأسبوع تتبع اللغة لا ثابتاً واحداً — وإلّا بدا
 *    الجدول مزاحاً يوماً كاملاً لنصف المستخدمين.
 */
import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as haptics from '../utils/haptics';

export interface Slot {
  id: string;
  /** 0=الأحد … 6=السبت — ثابت بصرف النظر عن يوم بداية العرض */
  day: number;
  start: string;   // "HH:MM"
  end: string;     // "HH:MM"
  label: string;
  color: number;   // فهرس في COLORS
}

export const COLORS = [
  'from-sky-500 to-cyan-500', 'from-violet-500 to-fuchsia-500',
  'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500', 'from-indigo-500 to-blue-500',
];

const UI = {
  ar: {
    day: 'اليوم', week: 'الأسبوع', month: 'الشهر',
    days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    short: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
    add: '+ أضف حصّة', edit: 'تعديل الحصّة', labelPh: 'اسم الحصّة أو النشاط',
    from: 'من', to: 'إلى', dayLabel: 'اليوم', color: 'اللون',
    save: 'حفظ', del: 'حذف', cancel: 'إلغاء',
    empty: 'لا حصص بعد. اضغط «أضف حصّة» لبناء جدولك.',
    emptyDay: 'لا حصص في هذا اليوم.',
    total: 'المجموع', perWeek: 'في الأسبوع', perMonth: 'في الشهر (تقديري)',
    needLabel: 'اكتب اسم الحصّة', badTime: 'وقت النهاية يجب أن يلي البداية',
    h: 'س', m: 'د', slots: 'حصّة',
    monthNote: 'الشهري تقديرٌ من الجدول الأسبوعي × 4.35 أسبوع',
  },
  en: {
    day: 'Day', week: 'Week', month: 'Month',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    add: '+ Add slot', edit: 'Edit slot', labelPh: 'Slot or activity name',
    from: 'From', to: 'To', dayLabel: 'Day', color: 'Colour',
    save: 'Save', del: 'Delete', cancel: 'Cancel',
    empty: 'No slots yet. Press “Add slot” to build your timetable.',
    emptyDay: 'Nothing scheduled on this day.',
    total: 'Total', perWeek: 'per week', perMonth: 'per month (estimate)',
    needLabel: 'Enter a slot name', badTime: 'End time must be after the start',
    h: 'h', m: 'm', slots: 'slots',
    monthNote: 'Monthly is estimated from the weekly timetable × 4.35 weeks',
  },
  es: {
    day: 'Día', week: 'Semana', month: 'Mes',
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    short: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    add: '+ Añadir franja', edit: 'Editar franja', labelPh: 'Nombre de la franja o actividad',
    from: 'De', to: 'A', dayLabel: 'Día', color: 'Color',
    save: 'Guardar', del: 'Eliminar', cancel: 'Cancelar',
    empty: 'Aún no hay franjas. Pulsa «Añadir franja» para crear tu horario.',
    emptyDay: 'Nada programado este día.',
    total: 'Total', perWeek: 'por semana', perMonth: 'al mes (estimado)',
    needLabel: 'Escribe un nombre', badTime: 'La hora final debe ser posterior al inicio',
    h: 'h', m: 'min', slots: 'franjas',
    monthNote: 'El mes se estima a partir del horario semanal × 4,35 semanas',
  },
  zh: {
    day: '日', week: '周', month: '月',
    days: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    short: ['日', '一', '二', '三', '四', '五', '六'],
    add: '+ 添加时段', edit: '编辑时段', labelPh: '时段或活动名称',
    from: '从', to: '到', dayLabel: '星期', color: '颜色',
    save: '保存', del: '删除', cancel: '取消',
    empty: '还没有时段。点击「添加时段」来建立你的课表。',
    emptyDay: '这一天没有安排。',
    total: '合计', perWeek: '每周', perMonth: '每月（估算）',
    needLabel: '请输入名称', badTime: '结束时间必须晚于开始时间',
    h: '小时', m: '分', slots: '个时段',
    monthNote: '每月由每周课表 × 4.35 周估算',
  },
} as const;

/** الأحد في العربية، الاثنين في غيرها. */
const weekStartFor = (lang: string): number => (lang === 'ar' ? 0 : 1);

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

function fmtDur(min: number, S: typeof UI['ar']): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h && m) return `${h}${S.h} ${m}${S.m}`;
  if (h) return `${h}${S.h}`;
  return `${m}${S.m}`;
}

interface Props {
  slots: Slot[];
  onChange: (next: Slot[]) => void;
}

export default function Timetable({ slots, onChange }: Props) {
  const { darkMode, language } = useApp();
  const S = UI[language] ?? UI.en;
  const ws = weekStartFor(language);
  const order = useMemo(() => Array.from({ length: 7 }, (_, i) => (i + ws) % 7), [ws]);

  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [editing, setEditing] = useState<Slot | null>(null);
  const [warn, setWarn] = useState('');
  const today = new Date().getDay();

  const byDay = useMemo(() => {
    const m = new Map<number, Slot[]>();
    for (const s of slots) {
      const arr = m.get(s.day) ?? [];
      arr.push(s);
      m.set(s.day, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => toMin(a.start) - toMin(b.start));
    return m;
  }, [slots]);

  const weekMin = useMemo(
    () => slots.reduce((sum, s) => sum + Math.max(0, toMin(s.end) - toMin(s.start)), 0),
    [slots],
  );

  const blank = (): Slot => ({
    id: `s${Date.now()}`, day: today, start: '08:00', end: '09:00', label: '', color: slots.length % COLORS.length,
  });

  const commit = () => {
    if (!editing) return;
    if (!editing.label.trim()) { setWarn(S.needLabel); return; }
    if (toMin(editing.end) <= toMin(editing.start)) { setWarn(S.badTime); return; }
    setWarn('');
    haptics.tap('medium');
    onChange(slots.some(s => s.id === editing.id)
      ? slots.map(s => (s.id === editing.id ? editing : s))
      : [...slots, editing]);
    setEditing(null);
  };

  const remove = (id: string) => { haptics.tap('light'); onChange(slots.filter(s => s.id !== id)); setEditing(null); };

  const card = darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const field = `w-full rounded-xl border px-3 py-2 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white' : 'border-gray-200 bg-white'}`;

  const Chip = ({ s }: { s: Slot }) => (
    <button onClick={() => { setEditing(s); setWarn(''); }}
      className={`w-full rounded-lg bg-gradient-to-r ${COLORS[s.color % COLORS.length]} px-2 py-1.5 text-start text-white transition hover:brightness-110`}>
      <div className="truncate text-[11px] font-black leading-tight">{s.label}</div>
      <div className="text-[9px] opacity-90" dir="ltr">{s.start}–{s.end}</div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(['day', 'week', 'month'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition ${view === v ? 'bg-sky-500 text-white' : darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            {S[v]}
          </button>
        ))}
      </div>

      {slots.length === 0 && (
        <div className={`rounded-2xl border p-4 text-center text-xs ${card} ${muted}`}>{S.empty}</div>
      )}

      {/* يومي */}
      {view === 'day' && (
        <div>
          <div className="mb-2 text-sm font-black">{S.days[today]}</div>
          {(byDay.get(today) ?? []).length === 0 ? (
            <div className={`rounded-2xl border p-4 text-center text-xs ${card} ${muted}`}>{S.emptyDay}</div>
          ) : (
            <div className="space-y-1.5">{(byDay.get(today) ?? []).map(s => <Chip key={s.id} s={s} />)}</div>
          )}
        </div>
      )}

      {/* أسبوعي — شبكة الأيام */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-1">
          {order.map(d => (
            <div key={d} className="min-w-0">
              <div className={`mb-1 truncate rounded-md py-1 text-center text-[10px] font-black ${d === today ? 'bg-sky-500 text-white' : darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                {S.short[d]}
              </div>
              <div className="space-y-1">
                {(byDay.get(d) ?? []).map(s => <Chip key={s.id} s={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* شهري — مجموع كل نشاط */}
      {view === 'month' && (
        <div className="space-y-2">
          {(() => {
            const per = new Map<string, number>();
            for (const s of slots) {
              const d = Math.max(0, toMin(s.end) - toMin(s.start));
              per.set(s.label, (per.get(s.label) ?? 0) + d);
            }
            const rows = [...per.entries()].sort((a, b) => b[1] - a[1]);
            const max = rows.length ? rows[0][1] : 1;
            return rows.map(([name, min]) => (
              <div key={name} className={`rounded-xl border p-2.5 ${card}`}>
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 text-sky-500">{fmtDur(Math.round(min * 4.35), S)}</span>
                </div>
                <div className={`mt-1.5 h-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-sky-500 to-teal-500" style={{ width: `${Math.max(4, (min / max) * 100)}%` }} />
                </div>
              </div>
            ));
          })()}
          {slots.length > 0 && <p className={`text-[10px] ${muted}`}>{S.monthNote}</p>}
        </div>
      )}

      {slots.length > 0 && (
        <div className={`rounded-2xl border p-3 text-center ${card}`}>
          <span className={`text-[11px] font-bold ${muted}`}>{S.total}: </span>
          <span className="text-sm font-black text-sky-500">{fmtDur(weekMin, S)} {S.perWeek}</span>
          <span className={`text-[11px] ${muted}`}> · {fmtDur(Math.round(weekMin * 4.35), S)} {S.perMonth}</span>
        </div>
      )}

      <button onClick={() => { setEditing(blank()); setWarn(''); }}
        className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-2.5 text-sm font-black text-white transition hover:scale-[1.01]">
        {S.add}
      </button>

      {/* محرّر الحصّة */}
      {editing && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm space-y-3 rounded-3xl p-5 shadow-2xl ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <h3 className="text-base font-black">{S.edit}</h3>
            <input value={editing.label} onChange={e => { setEditing({ ...editing, label: e.target.value }); setWarn(''); }}
              placeholder={S.labelPh} className={field} />
            <div>
              <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.dayLabel}</label>
              <select value={editing.day} onChange={e => setEditing({ ...editing, day: Number(e.target.value) })} className={field}>
                {order.map(d => <option key={d} value={d}>{S.days[d]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.from}</label>
                <input type="time" value={editing.start} onChange={e => { setEditing({ ...editing, start: e.target.value }); setWarn(''); }} className={field} dir="ltr" />
              </div>
              <div>
                <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.to}</label>
                <input type="time" value={editing.end} onChange={e => { setEditing({ ...editing, end: e.target.value }); setWarn(''); }} className={field} dir="ltr" />
              </div>
            </div>
            <div>
              <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.color}</label>
              <div className="flex gap-1.5">
                {COLORS.map((c, i) => (
                  <button key={c} onClick={() => setEditing({ ...editing, color: i })} aria-label={`${S.color} ${i + 1}`}
                    className={`h-7 flex-1 rounded-lg bg-gradient-to-r ${c} ${editing.color === i ? 'ring-2 ring-offset-2 ring-sky-500 ring-offset-transparent' : 'opacity-60'}`} />
                ))}
              </div>
            </div>
            {warn && <div className="text-xs font-bold text-amber-500">{warn}</div>}
            <div className="flex gap-2">
              <button onClick={commit} className="flex-1 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-black text-white">{S.save}</button>
              {slots.some(s => s.id === editing.id) && (
                <button onClick={() => remove(editing.id)} className="rounded-xl bg-rose-500/15 px-3 py-2.5 text-xs font-black text-rose-500">{S.del}</button>
              )}
              <button onClick={() => setEditing(null)} className={`rounded-xl px-3 py-2.5 text-xs font-black ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>{S.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
