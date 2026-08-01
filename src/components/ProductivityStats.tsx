import { useApp } from '../context/AppContext';

import ListenButton from './ListenButton';
interface ProductivityStatsProps {
  onClose: () => void;
}

export default function ProductivityStats({ onClose }: ProductivityStatsProps) {
  const { notes, darkMode, language } = useApp();

  const PS = {
    ar: { header: 'إحصائيات الإنتاجية', inCollection: 'ملاحظة وفكرة في مجموعتك',
          ideas: 'أفكار', pinned: 'مثبتة', activeAlarms: 'منبهات نشطة', today: 'اليوم',
          taskRate: '✅ نسبة إنجاز المهام', tasksDone: (a: number, b: number) => `${a} من ${b} مهام مكتملة`,
          thisWeek: '📆 هذا الأسبوع', mostActive: 'أكثر يوم نشاطاً',
          tier1: '🌱 ممتاز! واصل كتابة أفكارك لتنمو مجموعتك',
          tier2: '🚀 أداء رائع! أنت في طريقك للإنتاجية العالية',
          tier3: '🏆 إنتاجية استثنائية! مجموعتك أصبحت ثرية' },
    en: { header: 'Productivity Stats', inCollection: 'notes and ideas in your collection',
          ideas: 'Ideas', pinned: 'Pinned', activeAlarms: 'Active alarms', today: 'Today',
          taskRate: '✅ Task completion rate', tasksDone: (a: number, b: number) => `${a} of ${b} tasks completed`,
          thisWeek: '📆 This week', mostActive: 'Most active day',
          tier1: '🌱 Great! Keep writing your ideas to grow your collection',
          tier2: '🚀 Great work! You are on your way to high productivity',
          tier3: '🏆 Exceptional productivity! Your collection is rich' },
    es: { header: 'Estadísticas de productividad', inCollection: 'notas e ideas en tu colección',
          ideas: 'Ideas', pinned: 'Fijadas', activeAlarms: 'Alarmas activas', today: 'Hoy',
          taskRate: '✅ Tasa de tareas completadas', tasksDone: (a: number, b: number) => `${a} de ${b} tareas completadas`,
          thisWeek: '📆 Esta semana', mostActive: 'Día más activo',
          tier1: '🌱 ¡Genial! Sigue escribiendo tus ideas para crecer tu colección',
          tier2: '🚀 ¡Buen trabajo! Vas camino a una alta productividad',
          tier3: '🏆 ¡Productividad excepcional! Tu colección es rica' },
    zh: { header: '生产力统计', inCollection: '条笔记和想法在您的收藏中',
          ideas: '想法', pinned: '已置顶', activeAlarms: '活动提醒', today: '今天',
          taskRate: '✅ 任务完成率', tasksDone: (a: number, b: number) => `已完成 ${a} / ${b} 个任务`,
          thisWeek: '📆 本周', mostActive: '最活跃的一天',
          tier1: '🌱 很好！继续记录您的想法以丰富收藏',
          tier2: '🚀 干得好！您正迈向高生产力',
          tier3: '🏆 卓越的生产力！您的收藏已经很丰富' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? {
    header: 'Productivity Stats', inCollection: 'notes and ideas in your collection',
    ideas: 'Ideas', pinned: 'Pinned', activeAlarms: 'Active alarms', today: 'Today',
    taskRate: '✅ Task completion rate', tasksDone: (a: number, b: number) => `${a} of ${b} tasks completed`,
    thisWeek: '📆 This week', mostActive: 'Most active day',
    tier1: '🌱 Great! Keep writing your ideas to grow your collection',
    tier2: '🚀 Great work! You are on your way to high productivity',
    tier3: '🏆 Exceptional productivity! Your collection is rich' };
  
  // حساب الإحصائيات
  const totalNotes = notes.length;
  const totalIdeas = notes.filter(n => n.type === 'idea').length;
  const pinnedNotes = notes.filter(n => n.isPinned).length;
  const notesWithAlarms = notes.filter(n => n.alarm?.hasAlarm).length;
  
  // ملاحظات اليوم
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayNotes = notes.filter(n => new Date(n.createdAt) >= today).length;
  
  // ملاحظات الأسبوع
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekNotes = notes.filter(n => new Date(n.createdAt) >= weekAgo).length;
  
  // المهام المنجزة
  const allTasks = notes.reduce((acc, note) => {
    if (note.aiData?.extractedTasks) {
      return acc.concat(note.aiData.extractedTasks);
    }
    return acc;
  }, [] as { task: string; done: boolean }[]);
  
  const completedTasks = allTasks.filter(t => t.done).length;
  const totalTasks = allTasks.length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // أكثر يوم نشاطاً — يُحسب ديناميكياً من تواريخ إنشاء الملاحظات
  const dayLocale = ({ ar: 'ar-MA', en: 'en-US', es: 'es-ES', zh: 'zh-CN' } as Record<string, string>)[language] ?? 'en-US';
  const mostActiveDay = (() => {
    if (notes.length === 0) return '—';
    const counts = new Array(7).fill(0);
    notes.forEach(n => { const d = new Date(n.createdAt); if (!isNaN(d.getTime())) counts[d.getDay()]++; });
    const top = counts.indexOf(Math.max(...counts));
    // تاريخ مرجعي ليوم أحد معروف (2024-01-07 كان الأحد) + top
    const ref = new Date(2024, 0, 7 + top);
    return ref.toLocaleDateString(dayLocale, { weekday: 'long' });
  })();

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-lg rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(139,92,246,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  Productivity Analytics
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{PS.header}</h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-white">{totalNotes}</span>
                <span className="text-xs text-white/80 font-medium">{PS.inCollection}</span>
              </div>
            </div>
          </div>
          <ListenButton style="confident" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
          <button
            onClick={onClose}
            className="relative z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md border border-white/20 hover:rotate-90 transition-all duration-300 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* الإحصائيات */}
        <div className="p-6 space-y-4">
          {/* صف الإحصائيات الرئيسية */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon="💡"
              label={PS.ideas}
              value={totalIdeas}
              color="amber"
              darkMode={darkMode}
            />
            <StatCard
              icon="📌"
              label={PS.pinned}
              value={pinnedNotes}
              color="violet"
              darkMode={darkMode}
            />
            <StatCard
              icon="⏰"
              label={PS.activeAlarms}
              value={notesWithAlarms}
              color="emerald"
              darkMode={darkMode}
            />
            <StatCard
              icon="📅"
              label={PS.today}
              value={todayNotes}
              color="blue"
              darkMode={darkMode}
            />
          </div>

          {/* نسبة إنجاز المهام */}
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {PS.taskRate}
              </span>
              <span className="text-lg font-bold text-violet-500">
                {taskCompletionRate}%
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionRate}%` }}
              />
            </div>
            <div className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {PS.tasksDone(completedTasks, totalTasks)}
            </div>
          </div>

          {/* النشاط الأسبوعي */}
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {PS.thisWeek}
                </span>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {PS.mostActive}: {mostActiveDay}
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-500">
                {weekNotes}
              </div>
            </div>
          </div>

          {/* رسوم تحفيزية */}
          <div className="text-center py-2">
            {totalNotes < 10 ? (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {PS.tier1}
              </p>
            ) : totalNotes < 50 ? (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {PS.tier2}
              </p>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {PS.tier3}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, darkMode }: {
  icon: string;
  label: string;
  value: number;
  color: string;
  darkMode: boolean;
}) {
  const colorClasses = {
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
  };

  return (
    <div className={`p-3 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </span>
      </div>
      <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        {label}
      </div>
    </div>
  );
}
