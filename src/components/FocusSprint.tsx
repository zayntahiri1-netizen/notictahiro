import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp, Note } from '../context/AppContext';
import ListenButton from './ListenButton';

interface FocusSprintProps {
  note: Note;
  onClose: () => void;
  onUpdateTasks: (tasks: { task: string; done: boolean }[]) => void;
}

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

// مؤثرات صوتية باستخدام Web Audio API
function useSoundEffects() {
  const audioCtx = useRef<AudioContext | null>(null);

  const getCtx = () => {
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    if (!audioCtx.current) audioCtx.current = new AudioContextClass();
    return audioCtx.current;
  };

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine') => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }, []);

  const playTaskComplete = useCallback(() => {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.2), i * 80);
    });
  }, [playTone]);

  const playLevelUp = useCallback(() => {
    [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.25, 'triangle'), i * 100);
    });
  }, [playTone]);

  const playComplete = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.4, 'triangle'), i * 150);
    });
  }, [playTone]);

  return { playTaskComplete, playLevelUp, playComplete };
}

export default function FocusSprint({ note, onClose, onUpdateTasks }: FocusSprintProps) {
  const { updateNote, language } = useApp();
  const FS = {
    ar: { noTasks: 'لا توجد مهام في هذه الملاحظة', noTasksHint: 'أضف قائمة مهام أولاً باستخدام زر 🪄 في محرر الملاحظة',
          backToEditor: 'العودة للمحرر', wellDone: 'أحسنت! أنجزت جميع المهام!', xpEarned: 'XP مكتسبة',
          tasksDone: 'مهام منجزة', topStreak: 'أعلى سلسلة', finalLevel: 'المستوى النهائي', finishSuccess: '🏆 إنهاء التحدي بنجاح',
          challengeMode: '⚡ وضع تحدي الإنجاز', level: 'المستوى', streak: 'سلسلة',
          timeUp: '⏰ الوقت أوشك على الانتهاء!', focus: '🎯 ركز على المهمة!', ready: '▶️ جاهز للبدء',
          pause: '⏸️ إيقاف', start: '▶️ ابدأ التحدي', min: 'د', taskProgress: '📋 تقدم المهام',
          tasks: 'المهام', xpNext: 'XP متبقية للمستوى التالي', done: '✓ منجز' },
    en: { noTasks: 'No tasks in this note', noTasksHint: 'Add a checklist first using the 🪄 button in the note editor',
          backToEditor: 'Back to editor', wellDone: 'Well done! All tasks completed!', xpEarned: 'XP earned',
          tasksDone: 'Tasks done', topStreak: 'Top streak', finalLevel: 'Final level', finishSuccess: '🏆 Challenge completed',
          challengeMode: '⚡ Focus sprint mode', level: 'Level', streak: 'Streak',
          timeUp: '⏰ Time is almost up!', focus: '🎯 Focus on the task!', ready: '▶️ Ready to start',
          pause: '⏸️ Pause', start: '▶️ Start challenge', min: 'm', taskProgress: '📋 Task progress',
          tasks: 'Tasks', xpNext: 'XP left for next level', done: '✓ Done' },
    es: { noTasks: 'No hay tareas en esta nota', noTasksHint: 'Añade una lista de tareas con el botón 🪄 en el editor',
          backToEditor: 'Volver al editor', wellDone: '¡Bien hecho! ¡Todas las tareas completadas!', xpEarned: 'XP ganado',
          tasksDone: 'Tareas hechas', topStreak: 'Mejor racha', finalLevel: 'Nivel final', finishSuccess: '🏆 Desafío completado',
          challengeMode: '⚡ Modo sprint de enfoque', level: 'Nivel', streak: 'Racha',
          timeUp: '⏰ ¡El tiempo casi se acaba!', focus: '🎯 ¡Concéntrate en la tarea!', ready: '▶️ Listo para empezar',
          pause: '⏸️ Pausa', start: '▶️ Empezar desafío', min: 'm', taskProgress: '📋 Progreso de tareas',
          tasks: 'Tareas', xpNext: 'XP restante para el siguiente nivel', done: '✓ Hecho' },
    zh: { noTasks: '此笔记中没有任务', noTasksHint: '先用笔记编辑器中的 🪄 按钮添加任务清单',
          backToEditor: '返回编辑器', wellDone: '做得好！所有任务已完成！', xpEarned: '获得 XP',
          tasksDone: '完成任务', topStreak: '最高连击', finalLevel: '最终等级', finishSuccess: '🏆 挑战成功完成',
          challengeMode: '⚡ 专注冲刺模式', level: '等级', streak: '连击',
          timeUp: '⏰ 时间快到了！', focus: '🎯 专注于任务！', ready: '▶️ 准备开始',
          pause: '⏸️ 暂停', start: '▶️ 开始挑战', min: '分', taskProgress: '📋 任务进度',
          tasks: '任务', xpNext: '距下一等级剩余 XP', done: '✓ 完成' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? {
    noTasks: 'No tasks in this note', noTasksHint: 'Add a checklist first using the 🪄 button in the note editor',
    backToEditor: 'Back to editor', wellDone: 'Well done! All tasks completed!', xpEarned: 'XP earned',
    tasksDone: 'Tasks done', topStreak: 'Top streak', finalLevel: 'Final level', finishSuccess: '🏆 Challenge completed',
    challengeMode: '⚡ Focus sprint mode', level: 'Level', streak: 'Streak',
    timeUp: '⏰ Time is almost up!', focus: '🎯 Focus on the task!', ready: '▶️ Ready to start',
    pause: '⏸️ Pause', start: '▶️ Start challenge', min: 'm', taskProgress: '📋 Task progress',
    tasks: 'Tasks', xpNext: 'XP left for next level', done: '✓ Done' };
  const [tasks, setTasks] = useState<{ task: string; done: boolean }[]>(
    note.aiData?.extractedTasks || []
  );
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [completedCount, setCompletedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [particles, setParticles] = useState<{ x: number; y: number; color: string }[]>([]);
  const [lastAction, setLastAction] = useState<string>('');
  const { playTaskComplete, playLevelUp, playComplete } = useSoundEffects();

  // المؤقت
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // إكمال مهمة
  const completeTask = (index: number) => {
    const newTasks = [...tasks];
    if (newTasks[index].done) return;

    newTasks[index].done = true;
    setTasks(newTasks);
    setCompletedCount(c => c + 1);
    
    const xpGain = 25 + (streak * 5);
    setXp(x => {
      const newXp = x + xpGain;
      if (Math.floor(newXp / 100) > Math.floor(x / 100)) {
        setLevel(l => l + 1);
        playLevelUp();
        setLastAction('⭐ LEVEL UP!');
        spawnParticles();
        setTimeout(() => setLastAction(''), 2000);
      }
      return newXp;
    });

    setStreak(s => s + 1);
    playTaskComplete();
    setLastAction(`+${xpGain} XP`);
    setTimeout(() => setLastAction(''), 1500);

    onUpdateTasks(newTasks);
    updateNote(note.id, {
      aiData: { ...note.aiData, extractedTasks: newTasks }
    });

    if (newTasks.every(t => t.done)) {
      playComplete();
      setTimeout(() => setShowCompletion(true), 800);
    }
  };

  const spawnParticles = () => {
    const newParticles = Array.from({ length: 12 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      color: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'][Math.floor(Math.random() * 5)]
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1500);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;
  const taskProgress = tasks.length > 0 ? (tasks.filter(t => t.done).length / tasks.length) * 100 : 0;
  const xpForNextLevel = (level * 100) - xp;

  if (tasks.length === 0) {
    return (
      <div className="fixed inset-0 pb-banner z-50 flex items-center justify-center bg-gradient-to-br from-gray-950 via-indigo-950 to-purple-950 safe-all">
        <div className="text-center text-white space-y-6 p-8">
          <div className="text-8xl animate-bounce">📋</div>
          <h2 className="text-2xl font-bold">{FS.noTasks}</h2>
          <p className="text-gray-400 max-w-md">{FS.noTasksHint}</p>
          <button onClick={onClose}
            className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-lg">
            {FS.backToEditor}
          </button>
        </div>
      </div>
    );
  }

  if (showCompletion) {
    return (
      <div className="fixed inset-0 pb-banner z-50 flex items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-950 safe-all">
        <div className="text-center text-white space-y-8 p-8 animate-fade-in-up max-w-lg">
          <div className="relative">
            <div className="text-9xl animate-bounce">🏆</div>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute animate-ping"
                style={{
                  top: `${30 + Math.random() * 40}%`, left: `${30 + Math.random() * 40}%`,
                  animationDelay: `${Math.random() * 2}s`, fontSize: '2rem'
                }}>
                {['✨','🌟','💫','⭐','🎉'][Math.floor(Math.random() * 5)]}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              {FS.wellDone}
            </h1>
            {/* استماع ملحمي: يعلن نتيجة الجلسة كإعلان انتصار */}
            <ListenButton
              darkMode
              style="epic"
              label={FS.wellDone}
              text={() =>
                `${FS.wellDone}! ${FS.xpEarned}: ${xp}. ` +
                `${FS.tasksDone}: ${completedCount}. ` +
                `${FS.topStreak}: ${streak}. ${FS.finalLevel} ${level}.`
              }
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon="⚡" label={FS.xpEarned} value={xp} color="yellow" />
            <StatCard icon="✅" label={FS.tasksDone} value={completedCount} color="emerald" />
            <StatCard icon="🔥" label={FS.topStreak} value={streak} color="orange" />
          </div>

          <div className="p-4 rounded-xl bg-white/10">
            <div className="text-sm opacity-70">{FS.finalLevel}</div>
            <div className="text-3xl font-bold mt-1">Lvl {level}</div>
          </div>

          <button onClick={onClose}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl text-xl hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/30">
            {FS.finishSuccess}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pb-banner z-50 bg-gradient-to-br from-gray-950 via-indigo-950 to-purple-950 flex flex-col overflow-hidden safe-all">
      {/* جزيئات المؤثرات */}
      {particles.map((p, i) => (
        <div key={i} className="absolute pointer-events-none animate-ping"
          style={{ left: p.x, top: p.y, fontSize: '1.5rem', animationDuration: '1s' }}>
          ✨
        </div>
      ))}

      {/* شريط الحالة العلوي */}
      <div className="bg-black/40 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-white">
            <div className="text-xs opacity-50">{FS.challengeMode}</div>
            <div className="font-bold text-sm">{note.title}</div>
          </div>
            {/* استماع حماسي: يقرأ المهام المتبقية لإشعال الهمّة أثناء الجلسة */}
            <ListenButton
              darkMode
              size="sm"
              style="energetic"
              label={note.title}
              text={() => {
                const left = tasks.filter((t) => !t.done);
                if (left.length === 0) return `${note.title}. ${FS.wellDone}!`;
                return `${note.title}. ${left.map((t, i) => `${i + 1}. ${t.task}`).join('. ')}`;
              }}
            />
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-xl font-bold text-yellow-400">{xp}</div>
            <div className="text-[10px] text-gray-500">XP</div>
          </div>
          <div className="text-center relative">
            <div className="text-xl font-bold text-violet-400">Lvl {level}</div>
            <div className="text-[10px] text-gray-500">{FS.level}</div>
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white/10 rounded-full">
              <div className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${((xp % 100) / 100) * 100}%` }} />
            </div>
          </div>
          {streak >= 3 && (
            <div className="text-center animate-pulse">
              <div className="text-xl font-bold text-orange-400">🔥 x{streak}</div>
              <div className="text-[10px] text-gray-500">{FS.streak}</div>
            </div>
          )}
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        {/* المؤقت الدائري */}
        <div className="relative">
          <svg className="w-56 h-56 sm:w-72 sm:h-72 transform -rotate-90 drop-shadow-2xl">
            <defs>
              <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#A855F7" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
              <filter id="timerGlow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="50%" cy="50%" r="45%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="50%" cy="50%" r="45%" fill="none" stroke="url(#timerGrad)" strokeWidth="6"
              strokeLinecap="round" filter="url(#timerGlow)"
              strokeDasharray={`${2 * Math.PI * 45}%`}
              strokeDashoffset={`${(2 * Math.PI * 45) * (1 - progress / 100)}%`}
              className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`font-mono font-bold text-white transition-all ${timeLeft < 60 ? 'text-red-400 animate-pulse scale-110' : ''}`}
              style={{ fontSize: 'clamp(2rem, 8vw, 4rem)' }}>
              {formatTime(timeLeft)}
            </div>
            <div className="text-gray-500 text-xs mt-2">
              {timeLeft < 60 ? FS.timeUp : isRunning ? FS.focus : FS.ready}
            </div>
          </div>
        </div>

        {/* رسالة XP */}
        {lastAction && (
          <div className={`text-lg font-bold animate-fade-in-up ${
            lastAction.includes('LEVEL') ? 'text-violet-400 text-2xl' : 'text-yellow-400'
          }`}>
            {lastAction}
          </div>
        )}

        {/* أزرار التحكم */}
        <div className="flex items-center gap-4">
          <button onClick={() => setIsRunning(!isRunning)}
            className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg ${
              isRunning
                ? 'bg-red-500/20 border-2 border-red-500/50 text-red-400 hover:bg-red-500/30'
                : 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-violet-500/30'
            }`}>
            {isRunning ? FS.pause : FS.start}
          </button>
          <div className="flex gap-2">
            {[25, 15, 5].map(min => (
              <button key={min} onClick={() => { setTimeLeft(min * 60); setIsRunning(false); }}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  timeLeft === min * 60 ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}>
                {min}{FS.min}
              </button>
            ))}
          </div>
        </div>

        {/* شريط تقدم المهام */}
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>{FS.taskProgress}</span>
            <span className="font-mono">{tasks.filter(t => t.done).length}/{tasks.length}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${taskProgress}%` }} />
          </div>
        </div>
      </div>

      {/* قائمة المهام */}
      <div className="bg-black/40 backdrop-blur-xl border-t border-white/10 p-6 max-h-[35vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span>📋</span> {FS.tasks} ({tasks.filter(t => t.done).length}/{tasks.length})
          </h3>
          <span className="text-xs text-gray-500">{FS.xpNext}: {xpForNextLevel}</span>
        </div>
        <div className="space-y-2">
          {tasks.map((task, idx) => (
            <div key={idx}
              onClick={() => !task.done && completeTask(idx)}
              className={`p-4 rounded-xl flex items-center gap-4 transition-all ${
                task.done
                  ? 'bg-emerald-500/10 border border-emerald-500/20 cursor-default'
                  : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 cursor-pointer hover:scale-[1.02] active:scale-95'
              }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                task.done
                  ? 'bg-emerald-500 text-white scale-90'
                  : 'bg-white/10 text-white/70 group-hover:bg-white/20'
              }`}>
                {task.done ? '✓' : idx + 1}
              </div>
              <span className={`flex-1 text-sm ${task.done ? 'line-through text-gray-500' : 'text-white'}`}>
                {task.task}
              </span>
              <div className="flex items-center gap-2">
                {!task.done && (
                  <span className="text-yellow-400 text-xs font-bold bg-yellow-400/10 px-2 py-1 rounded-full">
                    +{25 + streak * 5} XP
                  </span>
                )}
                {task.done && <span className="text-emerald-400 text-xs">{FS.done}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* شريط النار في الأسفل عند الستريك العالي */}
      {streak >= 5 && (
        <div className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 animate-pulse" />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    yellow: 'text-yellow-400',
    emerald: 'text-emerald-400',
    orange: 'text-orange-400'
  };
  return (
    <div className="p-4 rounded-xl bg-white/10">
      <div className={`text-3xl font-bold ${colorClasses[color] || 'text-white'}`}>{value}</div>
      <div className="text-sm text-gray-400">{icon} {label}</div>
    </div>
  );
}
