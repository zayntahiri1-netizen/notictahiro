import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { callGemini } from '../utils/geminiService';
import { speak, stopSpeaking } from '../utils/tts';

interface MorningBriefingProps {
  onClose: () => void;
}

export default function MorningBriefing({ onClose }: MorningBriefingProps) {
  const { notes, darkMode, language } = useApp();

  // ─── نصوص واجهة الموجز — متعددة اللغات (ar/en/es/zh) ───────────────
  const UI_ALL = {
    ar: {
      title: 'الموجز الصباحي الذكي',
      subtitle: 'ابدأ يومك بنظرة شاملة ومحفزة دون تشتيت أو فوضى في 30 ثانية',
      readyTitle: 'جاهز لتوليد موجز يومك؟',
      readyDesc: 'سنقوم بجمع التنبيهات والمهام والطقس مع حكمة تحفيزية لتبسيط ذهنك في 30 ثانية.',
      generating: 'جاري تحضير القهوة والموجز...', generate: 'توليد الموجز الذكي ✨',
      stopAudio: 'إيقاف القراءة', playAudio: 'استمع للموجز بصوت AI', close: 'إغلاق', audioFail: 'الصوت غير متوفّر على هذا الجهاز (لا يوجد محرّك نطق عربي). يمكنك قراءة الموجز نصياً.',
    },
    en: {
      title: 'Smart Morning Briefing',
      subtitle: 'Start your day with a clear, motivating overview in 30 seconds',
      readyTitle: 'Ready to generate your daily brief?',
      readyDesc: 'We will gather alarms, tasks, and a motivational quote to clear your mind in 30 seconds.',
      generating: 'Brewing the coffee and the brief...', generate: 'Generate smart brief ✨',
      stopAudio: 'Stop reading', playAudio: 'Listen with AI voice', close: 'Close', audioFail: 'Voice not available on this device (no speech engine). You can read the brief above.',
    },
    es: {
      title: 'Resumen matutino inteligente',
      subtitle: 'Empieza tu día con una visión clara y motivadora en 30 segundos',
      readyTitle: '¿Listo para generar tu resumen del día?',
      readyDesc: 'Reuniremos alarmas, tareas y una cita motivadora para despejar tu mente en 30 segundos.',
      generating: 'Preparando el café y el resumen...', generate: 'Generar resumen inteligente ✨',
      stopAudio: 'Detener lectura', playAudio: 'Escuchar con voz de IA', close: 'Cerrar', audioFail: 'Voz no disponible en este dispositivo. Puedes leer el resumen arriba.',
    },
    zh: {
      title: '智能晨间简报',
      subtitle: '用 30 秒清晰而充满动力地开启您的一天',
      readyTitle: '准备生成今日简报了吗？',
      readyDesc: '我们将汇总提醒、任务和一句激励语，在 30 秒内理清您的思绪。',
      generating: '正在准备咖啡和简报...', generate: '生成智能简报 ✨',
      stopAudio: '停止朗读', playAudio: '用 AI 语音收听', close: '关闭', audioFail: '此设备不支持语音。您可以阅读上面的摘要。',
    },
  } as const;
  const MB = UI_ALL[(language as keyof typeof UI_ALL)] ?? UI_ALL.en;

  const [isGenerating, setIsGenerating] = useState(false);
  const [briefText, setBriefText] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  // إيقاف القراءة الصوتية عند إغلاق النافذة (وإلا تستمر بالكلام!)
  useEffect(() => {
    return () => {
      void stopSpeaking();
    };
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);

    // ─── 1) موجز Gemini شخصي حقيقي ───
    try {
      const withAlarmsCount = notes.filter(n => n.alarm?.hasAlarm).length;
      const pending = notes
        .flatMap(n => (n.aiData?.extractedTasks?.filter(t => !t.done) || []).map(t => t.task))
        .slice(0, 5);
      const recentTitles = notes.slice(0, 5).map(n => n.title).join(' | ');
      const hour = new Date().getHours();

      const LANG_NAMES: Record<string, string> = { ar: 'Arabic (العربية)', en: 'English', es: 'Spanish (español)', zh: 'Simplified Chinese (中文)' };
      const aiBrief = await callGemini(
        `You are Tahiro. Write a short morning briefing (5-7 lines) in ${LANG_NAMES[language] ?? 'English'}, warm and motivating, without Markdown headers.
Current hour: ${hour}.
Scheduled alarms: ${withAlarmsCount}.
Pending tasks: ${pending.join(', ') || 'none'}.
Recent notes: ${recentTitles || 'no notes yet'}.
End with a short inspiring quote.`,
        { maxTokens: 350, temperature: 0.8, functionName: 'morning-briefing' }
      );

      if (aiBrief?.trim()) {
        setBriefText(aiBrief.trim());
        setIsGenerating(false);
        return;
      }
    } catch (err) {
      console.warn('[MorningBriefing] Gemini unavailable, using local brief:', err);
    }

    // ─── 2) Fallback: الموجز المحلي ───
    setTimeout(() => {
      const withAlarms = notes.filter(n => n.alarm?.hasAlarm);
      const incompleteTasks = notes.reduce((acc, n) => {
        const tasks = n.aiData?.extractedTasks?.filter(t => !t.done) || [];
        return acc.concat(tasks.map(t => ({ task: t.task, noteTitle: n.title })));
      }, [] as { task: string; noteTitle: string }[]);

      const currentHour = new Date().getHours();
      // نصوص الموجز المحلي — متعددة اللغات
      const FB: Record<string, {
        morning: string; day: string; evening: string; intro: string;
        alarms: (n: number, t: string) => string; calm: string;
        tasks: (task: string, note: string) => string;
        quoteLabel: string; quotes: string[];
      }> = {
        ar: {
          morning: 'صباح الخير', day: 'مرحباً بك', evening: 'مساء الخير',
          intro: 'أنا Tahiro، مساعدك الذكي. إليك موجز يومك:',
          alarms: (n, t) => `⏰ لديك اليوم ${n} تنبيهات مجدولة، أهمها: "${t}".`,
          calm: '⏰ جدول تنبيهاتك هادئ اليوم، مما يمنحك وقتاً إضافياً للتركيز.',
          tasks: (task, note) => `📋 هناك مهام معلقة تتطلب انتباهك، مثل: "${task}" من ملاحظة (${note}).`,
          quoteLabel: 'حكمة اليوم',
          quotes: ['الخطوات الصغيرة اليومية تقود إلى نجاحات عظيمة.', 'ابدأ بالمهام الصعبة أولاً، وسيتكفل يومك بالباقي.', 'التركيز هو سر الإنتاجية، قلل من المشتتات وحافظ على هدوئك.'],
        },
        en: {
          morning: 'Good morning', day: 'Welcome', evening: 'Good evening',
          intro: 'I am Tahiro, your smart assistant. Here is your daily brief:',
          alarms: (n, t) => `⏰ You have ${n} scheduled alarms today, most importantly: "${t}".`,
          calm: '⏰ Your alarm schedule is calm today, giving you extra time to focus.',
          tasks: (task, note) => `📋 Some pending tasks need your attention, such as: "${task}" from note (${note}).`,
          quoteLabel: 'Quote of the day',
          quotes: ['Small daily steps lead to great achievements.', 'Start with the hard tasks first; the rest of your day will follow.', 'Focus is the secret of productivity — reduce distractions and stay calm.'],
        },
        es: {
          morning: 'Buenos días', day: 'Bienvenido', evening: 'Buenas tardes',
          intro: 'Soy Tahiro, tu asistente inteligente. Aquí está tu resumen del día:',
          alarms: (n, t) => `⏰ Hoy tienes ${n} alarmas programadas, la más importante: "${t}".`,
          calm: '⏰ Tu agenda de alarmas está tranquila hoy, dándote tiempo extra para concentrarte.',
          tasks: (task, note) => `📋 Algunas tareas pendientes necesitan tu atención, como: "${task}" de la nota (${note}).`,
          quoteLabel: 'Frase del día',
          quotes: ['Los pequeños pasos diarios conducen a grandes logros.', 'Empieza por las tareas difíciles; el resto del día seguirá.', 'La concentración es el secreto de la productividad.'],
        },
        zh: {
          morning: '早上好', day: '你好', evening: '晚上好',
          intro: '我是 Tahiro，你的智能助手。这是你的每日简报：',
          alarms: (n, t) => `⏰ 你今天有 ${n} 个已安排的提醒，最重要的是："${t}"。`,
          calm: '⏰ 今天的提醒日程很轻松，让你有更多时间专注。',
          tasks: (task, note) => `📋 一些待办任务需要你关注，例如："${task}"（来自笔记：${note}）。`,
          quoteLabel: '每日一语',
          quotes: ['每天的小步骤会带来巨大的成就。', '先从困难的任务开始，剩下的会水到渠成。', '专注是生产力的秘诀——减少干扰，保持冷静。'],
        },
      };
      const fb = FB[language] ?? FB.en;
      const greeting = currentHour < 12 ? fb.morning : currentHour < 17 ? fb.day : fb.evening;

      let brief = `${greeting}! ☀️\n\n`;
      brief += `${fb.intro}\n\n`;

      if (withAlarms.length > 0) {
        brief += fb.alarms(withAlarms.length, withAlarms[0].title) + '\n';
      } else {
        brief += fb.calm + '\n';
      }

      if (incompleteTasks.length > 0) {
        brief += fb.tasks(incompleteTasks[0].task, incompleteTasks[0].noteTitle) + '\n';
      }

      const randomQuote = fb.quotes[Math.floor(Math.random() * fb.quotes.length)];
      brief += `\n💡 ${fb.quoteLabel}: "${randomQuote}"`;

      setBriefText(brief);
      setIsGenerating(false);
    }, 400);
  };

  const handlePlayAudio = async () => {
    if (!briefText) return;
    setAudioUnavailable(false);
    setIsAudioPlaying(true);

    // إزالة الإيموجي ورموز ماركداون قبل النطق (نطاق Unicode آمن)
    const cleanText = briefText.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}!*#_]/gu, '').trim();
    const ttsMap: Record<string, string> = { ar: 'ar-SA', en: 'en-US', es: 'es-ES', zh: 'zh-CN' };

    // الأداة الموحّدة: Gemini الحماسي أولاً، محرك الجهاز عند انقطاع الإنترنت
    const ok = await speak({
      text: cleanText,
      lang: ttsMap[language] ?? 'en-US',
      rate: 0.95,
      preferGemini: true,
      onEnd: () => setIsAudioPlaying(false),
      onError: () => { setIsAudioPlaying(false); setAudioUnavailable(true); },
    });

    if (!ok) {
      setIsAudioPlaying(false);
      setAudioUnavailable(true);
    }
  };

  const handleStopAudio = () => {
    void stopSpeaking();
    setIsAudioPlaying(false);
  };

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" onClick={() => { handleStopAudio(); onClose(); }}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-lg rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(245,158,11,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              ☀️
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  AI Morning Brief
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{MB.title}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">{MB.subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => { handleStopAudio(); onClose(); }}
            className="relative z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md border border-white/20 hover:rotate-90 transition-all duration-300 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* المحتوى */}
        <div className="p-6 space-y-6">
          {!briefText ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-3xl animate-pulse">
                ☕
              </div>
              <h3 className="text-lg font-semibold">{MB.readyTitle}</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} max-w-xs mx-auto`}>
                {MB.readyDesc}
              </p>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-amber-500/20"
              >
                {isGenerating ? MB.generating : MB.generate}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in-up">
              <div className={`p-4 rounded-xl border leading-relaxed ${
                darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}>
                {briefText.split('\n').map((line, index) => (
                  <p key={index} className="mb-2 last:mb-0">{line}</p>
                ))}
              </div>

              {/* تنبيه عند تعذّر الصوت على الجهاز */}
              {audioUnavailable && (
                <div className={`mb-3 text-xs leading-relaxed p-3 rounded-xl ${darkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                  ⚠️ {MB.audioFail}
                </div>
              )}

              {/* أزرار التشغيل */}
              <div className="flex gap-3">
                {isAudioPlaying ? (
                  <button
                    onClick={handleStopAudio}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>⏹️</span>
                    <span>{MB.stopAudio}</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePlayAudio}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <span>🔊</span>
                    <span>{MB.playAudio}</span>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    handleStopAudio();
                    onClose();
                  }}
                  className={`px-6 py-3 rounded-xl font-semibold ${
                    darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {MB.close}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
