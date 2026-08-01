/**
 * HabitTracker.tsx — متتبع العادات اليومية
 * نظام سلاسل (Streaks) + شبكة أسبوعية + اقتراحات Tahiro الذكية
 * البيانات محفوظة محلياً (localStorage) — تعمل بدون إنترنت
 */
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { scheduleHabitDailyReminder, cancelHabitDailyReminder, ensureNotificationPermission } from '../utils/notifications';
import { CaretSafeInput } from './CaretSafe';

import ListenButton from './ListenButton';
interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  /** التواريخ المنجزة بصيغة YYYY-MM-DD */
  doneDates: string[];
}

interface HabitTrackerProps {
  onClose: () => void;
}

const HABIT_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];
const HABIT_ICONS = ['💧', '📖', '🏃', '🧘', '💪', '🌅', '📿', '✍️', '🥗', '😴', '🚭', '💰'];

/** تاريخ محلي YYYY-MM-DD (وليس UTC — في المغرب UTC+1 منتصف الليل يعطي يوم الأمس!) */
function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return localDateKey();
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(localDateKey(d));
  }
  return days;
}

function computeStreak(doneDates: string[]): number {
  const set = new Set(doneDates);
  let streak = 0;
  const d = new Date();
  // إذا اليوم لم يُنجز بعد، نبدأ العد من الأمس
  if (!set.has(localDateKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(localDateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function HabitTracker({ onClose }: HabitTrackerProps) {
  const { darkMode, language } = useApp();
  const HT = {
    ar: { header: 'متتبع العادات', doneToday: (a: number, b: number, p: number) => `اليوم: ${a}/${b} عادة منجزة (${p}%)`,
          firstHabit: 'ابدأ عادتك الأولى', firstHabitHint: 'العادات الصغيرة المتكررة تبني حياة عظيمة',
          streak: (n: number) => `🔥 سلسلة ${n} ${n === 1 ? 'يوم' : n === 2 ? 'يومين' : 'أيام'}`,
          delHabit: 'حذف العادة', newHabitPh: 'اسم العادة الجديدة...', color: 'لون', add: 'إضافة', cancel: 'إلغاء', newHabit: '＋ عادة جديدة', startStreak: 'ابدأ سلسلتك اليوم',
          suggested: [
            { name: 'شرب 8 أكواب ماء', icon: '💧' }, { name: 'قراءة 10 صفحات', icon: '📖' },
            { name: 'صلاة الفجر في وقتها', icon: '🌅' }, { name: 'رياضة 20 دقيقة', icon: '🏃' },
            { name: 'كتابة ملاحظة يومية', icon: '✍️' }, { name: 'نوم قبل 11 مساءً', icon: '😴' } ] },
    en: { header: 'Habit tracker', doneToday: (a: number, b: number, p: number) => `Today: ${a}/${b} habits done (${p}%)`,
          firstHabit: 'Start your first habit', firstHabitHint: 'Small repeated habits build a great life',
          streak: (n: number) => `🔥 ${n}-day streak`,
          delHabit: 'Delete habit', newHabitPh: 'New habit name...', color: 'Color', add: 'Add', cancel: 'Cancel', newHabit: '＋ New habit', startStreak: 'Start your streak today',
          suggested: [
            { name: 'Drink 8 glasses of water', icon: '💧' }, { name: 'Read 10 pages', icon: '📖' },
            { name: 'Morning prayer on time', icon: '🌅' }, { name: '20 minutes of exercise', icon: '🏃' },
            { name: 'Write a daily note', icon: '✍️' }, { name: 'Sleep before 11 PM', icon: '😴' } ] },
    es: { header: 'Seguidor de hábitos', doneToday: (a: number, b: number, p: number) => `Hoy: ${a}/${b} hábitos hechos (${p}%)`,
          firstHabit: 'Empieza tu primer hábito', firstHabitHint: 'Los pequeños hábitos repetidos construyen una gran vida',
          streak: (n: number) => `🔥 racha de ${n} días`,
          delHabit: 'Eliminar hábito', newHabitPh: 'Nombre del nuevo hábito...', color: 'Color', add: 'Añadir', cancel: 'Cancelar', newHabit: '＋ Nuevo hábito', startStreak: 'Empieza tu racha hoy',
          suggested: [
            { name: 'Beber 8 vasos de agua', icon: '💧' }, { name: 'Leer 10 páginas', icon: '📖' },
            { name: 'Oración matutina a tiempo', icon: '🌅' }, { name: '20 minutos de ejercicio', icon: '🏃' },
            { name: 'Escribir una nota diaria', icon: '✍️' }, { name: 'Dormir antes de las 11 PM', icon: '😴' } ] },
    zh: { header: '习惯追踪器', doneToday: (a: number, b: number, p: number) => `今天：已完成 ${a}/${b} 个习惯 (${p}%)`,
          firstHabit: '开始你的第一个习惯', firstHabitHint: '微小重复的习惯成就伟大的人生',
          streak: (n: number) => `🔥 连续 ${n} 天`,
          delHabit: '删除习惯', newHabitPh: '新习惯名称...', color: '颜色', add: '添加', cancel: '取消', newHabit: '＋ 新习惯', startStreak: '今天开始你的连击',
          suggested: [
            { name: '喝 8 杯水', icon: '💧' }, { name: '阅读 10 页', icon: '📖' },
            { name: '按时晨间祈祷', icon: '🌅' }, { name: '运动 20 分钟', icon: '🏃' },
            { name: '写每日笔记', icon: '✍️' }, { name: '晚上 11 点前睡觉', icon: '😴' } ] },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? {
    header: 'Habit tracker', doneToday: (a: number, b: number, p: number) => `Today: ${a}/${b} habits done (${p}%)`,
    firstHabit: 'Start your first habit', firstHabitHint: 'Small repeated habits build a great life',
    streak: (n: number) => `🔥 ${n}-day streak`,
    delHabit: 'Delete habit', newHabitPh: 'New habit name...', color: 'Color', add: 'Add', cancel: 'Cancel', newHabit: '＋ New habit', startStreak: 'Start your streak today',
    suggested: [
      { name: 'Drink 8 glasses of water', icon: '💧' }, { name: 'Read 10 pages', icon: '📖' },
      { name: 'Morning prayer on time', icon: '🌅' }, { name: '20 minutes of exercise', icon: '🏃' },
      { name: 'Write a daily note', icon: '✍️' }, { name: 'Sleep before 11 PM', icon: '😴' } ] };
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const raw = localStorage.getItem('notic-habits');
      return raw ? (JSON.parse(raw) as Habit[]) : [];
    } catch {
      return [];
    }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💧');
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);

  useEffect(() => {
    try {
      localStorage.setItem('notic-habits', JSON.stringify(habits));
    } catch { /* مساحة ممتلئة — نتجاهل */ }
    // تذكير مسائي تلقائي عند وجود عادات نشطة
    if (habits.length > 0) {
      void ensureNotificationPermission().then(ok => { if (ok) void scheduleHabitDailyReminder(); });
    } else {
      void cancelHabitDailyReminder();
    }
  }, [habits]);

  const week = useMemo(() => lastNDays(7), []);
  const today = todayKey();

  const dayLabels = useMemo(
    () => week.map(d => new Date(d).toLocaleDateString('ar-MA', { weekday: 'narrow' })),
    [week]
  );

  const toggleDay = (habitId: string, date: string) => {
    setHabits(prev =>
      prev.map(h => {
        if (h.id !== habitId) return h;
        const has = h.doneDates.includes(date);
        return {
          ...h,
          doneDates: has ? h.doneDates.filter(d => d !== date) : [...h.doneDates, date],
        };
      })
    );
  };

  const addHabit = (name: string, icon: string, color: string) => {
    if (!name.trim()) return;
    setHabits(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: name.trim(),
        icon,
        color,
        createdAt: new Date().toISOString(),
        doneDates: [],
      },
    ]);
    setNewName('');
    setShowAdd(false);
  };

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const doneToday = habits.filter(h => h.doneDates.includes(today)).length;
  const completion = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`glass-card w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس */}
        <div className="bg-gradient-to-l from-emerald-500 to-teal-500 p-5 text-white">
          <div className="flex items-center justify-between">
            <ListenButton style="energetic" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" aria-label={HT.cancel}>✕</button>
            <div className="text-left">
              <span className="px-3 py-1 rounded-full bg-white/20 text-[10px] font-bold tracking-widest">HABIT STREAKS</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div>
              <h2 className="text-xl font-black">{HT.header}</h2>
              <p className="text-xs text-white/85 mt-0.5">
                {HT.doneToday(doneToday, habits.length, completion)}
              </p>
            </div>
          </div>
          {/* شريط التقدم اليومي */}
          <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${completion}%` }} />
          </div>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {habits.length === 0 && !showAdd && (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">🌱</div>
              <h3 className="font-bold mb-1">{HT.firstHabit}</h3>
              <p className={`text-xs mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {HT.firstHabitHint}
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                {HT.suggested.map(s => (
                  <button
                    key={s.name}
                    onClick={() => addHabit(s.name, s.icon, HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)])}
                    className={`p-2.5 rounded-xl text-right text-xs font-medium transition-colors flex items-center gap-2 ${
                      darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">{s.icon}</span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {habits.map(habit => {
            const streak = computeStreak(habit.doneDates);
            return (
              <div
                key={habit.id}
                className={`rounded-2xl p-3 border transition-colors ${
                  darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: habit.color + '22' }}>
                      {habit.icon}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold">{habit.name}</h4>
                      <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {streak > 0 ? HT.streak(streak) : HT.startStreak}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-600' : 'hover:bg-gray-100 text-gray-400'}`}
                    aria-label={HT.delHabit}
                  >
                    🗑️
                  </button>
                </div>

                {/* شبكة الأسبوع */}
                <div className="flex justify-between gap-1">
                  {week.map((date, i) => {
                    const done = habit.doneDates.includes(date);
                    const isToday = date === today;
                    return (
                      <button
                        key={date}
                        onClick={() => toggleDay(habit.id, date)}
                        className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all active:scale-95 ${
                          isToday ? (darkMode ? 'bg-gray-700/60' : 'bg-gray-100') : ''
                        }`}
                        aria-label={`${habit.name} — ${date}`}
                      >
                        <span className={`text-[9px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{dayLabels[i]}</span>
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                          style={{
                            backgroundColor: done ? habit.color : (darkMode ? '#37415155' : '#f3f4f6'),
                            color: done ? '#fff' : (darkMode ? '#6b7280' : '#9ca3af'),
                          }}
                        >
                          {done ? '✓' : new Date(date).getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* نموذج إضافة عادة */}
          {showAdd ? (
            <div className={`rounded-2xl p-4 border ${darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-100'}`}>
              <CaretSafeInput
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit(newName, newIcon, newColor)}
                placeholder={HT.newHabitPh}
                autoFocus
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none mb-3 ${
                  darkMode ? 'border-gray-600 bg-gray-900 text-white placeholder-gray-500' : 'border-gray-200 bg-gray-50'
                }`}
              />
              <div className="flex flex-wrap gap-1.5 mb-3">
                {HABIT_ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setNewIcon(ic)}
                    className={`w-9 h-9 rounded-xl text-base transition-all ${
                      newIcon === ic ? 'ring-2 ring-emerald-500 scale-110' : ''
                    } ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 mb-3">
                {HABIT_COLORS.map(cl => (
                  <button
                    key={cl}
                    onClick={() => setNewColor(cl)}
                    className={`w-7 h-7 rounded-full transition-all ${newColor === cl ? 'ring-2 ring-offset-2 scale-110' : ''}`}
                    style={{ backgroundColor: cl }}
                    aria-label={`${HT.color} ${cl}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addHabit(newName, newIcon, newColor)}
                  disabled={!newName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-40"
                >
                  {HT.add}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {HT.cancel}
                </button>
              </div>
            </div>
          ) : (
            habits.length > 0 && (
              <button
                onClick={() => setShowAdd(true)}
                className={`w-full py-3 rounded-2xl border-2 border-dashed text-sm font-bold transition-colors ${
                  darkMode
                    ? 'border-gray-700 text-gray-500 hover:border-emerald-600 hover:text-emerald-400'
                    : 'border-gray-200 text-gray-400 hover:border-emerald-400 hover:text-emerald-600'
                }`}
              >
                {HT.newHabit}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
