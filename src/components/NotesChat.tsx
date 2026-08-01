import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { geminiChat } from '../utils/geminiService';
import type { GeminiMessage } from '../utils/geminiService';
import { CaretSafeInput } from './CaretSafe';

import ListenButton from './ListenButton';
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  relatedNotes?: string[];
}

interface NotesChatProps {
  onClose: () => void;
}

export default function NotesChat({ onClose }: NotesChatProps) {
  const { notes, darkMode, t, language } = useApp();

  // ─── نصوص محرك البحث المحلي — متعددة اللغات (ar/en/es/zh) ─────────
  const DATE_LOCALES: Record<string, string> = { ar: 'ar-MA', en: 'en-US', es: 'es-ES', zh: 'zh-CN' };
  const dateLocale = DATE_LOCALES[language] ?? 'en-US';
  const CHAT_STR_ALL = {
    ar: {
      foundIdeas: (n: number) => `وجدت ${n} فكرة في مفكرتك:\n\n`,
      noIdeas: 'لم أجد أي أفكار مسجلة حالياً. يمكنك إضافة فكرة جديدة باستخدام زر 💡',
      foundGames: 'نعم! وجدت ملاحظات عن الألعاب:\n\n',
      noGames: 'لم أجد ملاحظات عن الألعاب. هل تريد إضافة فكرة لعبة جديدة؟',
      pendingTasks: (n: number) => `لديك ${n} مهمة غير مكتملة:\n\n`,
      fromNote: 'من', allDone: 'رائع! 🎉 لا توجد مهام معلقة حالياً. جميع مهامك مكتملة.',
      foundProject: (n: number) => `وجدت ${n} ملاحظة عن مشروع Notic:\n\n`,
      summaryLabel: 'ملخص', recentSummary: (n: number) => `إليك ملخص آخر ${n} ملاحظات:\n\n`,
      activeAlarms: (n: number) => `لديك ${n} منبهات نشطة:\n\n`,
      recurring: (type: string) => `   (متكرر ${type === 'daily' ? 'يومياً' : type === 'weekly' ? 'أسبوعياً' : 'شهرياً'})\n`,
      noAlarms: 'لا توجد منبهات نشطة حالياً.',
      foundRelated: (n: number) => `وجدت ${n} ملاحظة ذات صلة بسؤالك:\n\n`,
      moreNotes: (n: number) => `_و${n} ملاحظات أخرى..._`,
      subtitle: 'دردشة دلالية ذكية مع جميع ملاحظاتك وأفكارك المخزنة',
      footer: (n: number) => `يبحث في ${n} ملاحظة • مدعوم بـ Gemini AI`,
      suggested: ['ما هي أفكاري الأخيرة؟', 'أظهر المهام غير المكتملة', 'لخص ملاحظات الأسبوع', 'أين كتبت عن المشاريع؟'],
    },
    en: {
      foundIdeas: (n: number) => `I found ${n} ideas in your notebook:\n\n`,
      noIdeas: 'No ideas recorded yet. You can add a new one using the 💡 button.',
      foundGames: 'Yes! I found notes about games:\n\n',
      noGames: 'No notes about games found. Would you like to add a new game idea?',
      pendingTasks: (n: number) => `You have ${n} pending tasks:\n\n`,
      fromNote: 'from', allDone: 'Great! 🎉 No pending tasks right now. Everything is done.',
      foundProject: (n: number) => `I found ${n} notes about the Notic project:\n\n`,
      summaryLabel: 'Summary', recentSummary: (n: number) => `Here is a summary of your last ${n} notes:\n\n`,
      activeAlarms: (n: number) => `You have ${n} active alarms:\n\n`,
      recurring: (type: string) => `   (repeats ${type === 'daily' ? 'daily' : type === 'weekly' ? 'weekly' : 'monthly'})\n`,
      noAlarms: 'No active alarms right now.',
      foundRelated: (n: number) => `I found ${n} notes related to your question:\n\n`,
      moreNotes: (n: number) => `_and ${n} more notes..._`,
      subtitle: 'Smart semantic chat with all your stored notes and ideas',
      footer: (n: number) => `Searching ${n} notes • Powered by Gemini AI`,
      suggested: ['What are my recent ideas?', 'Show pending tasks', "Summarize this week's notes", 'Where did I write about projects?'],
    },
    es: {
      foundIdeas: (n: number) => `Encontré ${n} ideas en tu cuaderno:\n\n`,
      noIdeas: 'Aún no hay ideas registradas. Puedes añadir una nueva con el botón 💡.',
      foundGames: '¡Sí! Encontré notas sobre juegos:\n\n',
      noGames: 'No encontré notas sobre juegos. ¿Quieres añadir una nueva idea de juego?',
      pendingTasks: (n: number) => `Tienes ${n} tareas pendientes:\n\n`,
      fromNote: 'de', allDone: '¡Genial! 🎉 No hay tareas pendientes. Todo está completado.',
      foundProject: (n: number) => `Encontré ${n} notas sobre el proyecto Notic:\n\n`,
      summaryLabel: 'Resumen', recentSummary: (n: number) => `Aquí tienes un resumen de tus últimas ${n} notas:\n\n`,
      activeAlarms: (n: number) => `Tienes ${n} alarmas activas:\n\n`,
      recurring: (type: string) => `   (se repite ${type === 'daily' ? 'a diario' : type === 'weekly' ? 'semanalmente' : 'mensualmente'})\n`,
      noAlarms: 'No hay alarmas activas ahora.',
      foundRelated: (n: number) => `Encontré ${n} notas relacionadas con tu pregunta:\n\n`,
      moreNotes: (n: number) => `_y ${n} notas más..._`,
      subtitle: 'Chat semántico inteligente con todas tus notas e ideas',
      footer: (n: number) => `Buscando en ${n} notas • Con tecnología de Gemini AI`,
      suggested: ['¿Cuáles son mis ideas recientes?', 'Mostrar tareas pendientes', 'Resumir las notas de la semana', '¿Dónde escribí sobre proyectos?'],
    },
    zh: {
      foundIdeas: (n: number) => `在您的笔记本中找到 ${n} 个想法：\n\n`,
      noIdeas: '目前没有记录的想法。您可以使用 💡 按钮添加新想法。',
      foundGames: '是的！找到了关于游戏的笔记：\n\n',
      noGames: '没有找到关于游戏的笔记。要添加新的游戏想法吗？',
      pendingTasks: (n: number) => `您有 ${n} 个未完成的任务：\n\n`,
      fromNote: '来自', allDone: '太棒了！🎉 当前没有待办任务，全部已完成。',
      foundProject: (n: number) => `找到 ${n} 条关于 Notic 项目的笔记：\n\n`,
      summaryLabel: '摘要', recentSummary: (n: number) => `这是您最近 ${n} 条笔记的摘要：\n\n`,
      activeAlarms: (n: number) => `您有 ${n} 个活动提醒：\n\n`,
      recurring: (type: string) => `   (重复：${type === 'daily' ? '每天' : type === 'weekly' ? '每周' : '每月'})\n`,
      noAlarms: '当前没有活动的提醒。',
      foundRelated: (n: number) => `找到 ${n} 条与您的问题相关的笔记：\n\n`,
      moreNotes: (n: number) => `_还有 ${n} 条笔记..._`,
      subtitle: '与您存储的所有笔记和想法进行智能语义对话',
      footer: (n: number) => `搜索 ${n} 条笔记 • 由 Gemini AI 提供支持`,
      suggested: ['我最近的想法有哪些？', '显示未完成的任务', '总结本周的笔记', '我在哪里写过项目？'],
    },
  } as const;
  const CS = CHAT_STR_ALL[(language as keyof typeof CHAT_STR_ALL)] ?? CHAT_STR_ALL.en;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      type: 'assistant',
      content: t('chatWelcome'),
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // ─── 1) محاولة Gemini الحقيقي مع سياق الملاحظات ───
    try {
      // الملاحظات المقفلة مُستثناة: محتواها مُشفَّر، إرساله عبثي ويُهدر الحصة
      const notesContext = notes
        .filter(n => !n.isLocked)
        .slice(0, 15)
        .map(n => `• ${n.title}: ${(n.aiData?.summary || n.content).slice(0, 120)}`)
        .join('\n');
      const history: GeminiMessage[] = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.type === 'user' ? 'user' as const : 'model' as const, content: m.content }));

      const aiText = await geminiChat(userMessage.content, history, notesContext);

      if (aiText?.trim()) {
        // ربط الملاحظات ذات الصلة بالرد
        const related = notes
          .filter(n => aiText.includes(n.title))
          .map(n => n.id);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: aiText,
          timestamp: new Date().toISOString(),
          relatedNotes: related,
        }]);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('[NotesChat] Gemini unavailable, using local search:', err);
    }

    // ─── 2) Fallback: البحث الدلالي المحلي (يعمل بدون إنترنت) ───
    setTimeout(() => {
      const query = userMessage.content.toLowerCase();
      let response = '';
      let relatedNotes: string[] = [];

      // تحليل السؤال والبحث في الملاحظات
      if (['فكرة', 'أفكار', 'idea', 'ideas', '想法', '点子'].some(k => query.includes(k))) {
        const ideaNotes = notes.filter(n => n.type === 'idea');
        relatedNotes = ideaNotes.map(n => n.id);
        if (ideaNotes.length > 0) {
          response = CS.foundIdeas(ideaNotes.length);
          ideaNotes.slice(0, 3).forEach((note, idx) => {
            // الملاحظات المقفلة: لا نعرض المحتوى المُشفَّر — إشارة قفل فقط
            const preview = note.isLocked ? '🔒' : `${note.content.substring(0, 100)}...`;
            response += `${idx + 1}. **${note.title}**\n${preview}\n\n`;
          });
        } else {
          response = CS.noIdeas;
        }
      } 
      else if (['لعبة', 'ronda', 'game', 'juego', '游戏'].some(k => query.includes(k))) {
        const gameNotes = notes.filter(n => 
          (!n.isLocked && (n.content.toLowerCase().includes('لعبة') || 
          n.content.toLowerCase().includes('ronda'))) ||
          n.title.toLowerCase().includes('لعبة')
        );
        relatedNotes = gameNotes.map(n => n.id);
        if (gameNotes.length > 0) {
          response = CS.foundGames;
          gameNotes.forEach(note => {
            const preview = note.isLocked ? '🔒' : `${note.content.substring(0, 150)}...`;
            response += `📌 **${note.title}**\n${preview}\n\n`;
          });
        } else {
          response = CS.noGames;
        }
      }
      else if (['مهام', 'task', 'غير مكتمل', 'pending', 'tarea', '任务'].some(k => query.includes(k))) {
        const tasks = notes.reduce<{ task: string; done: boolean; noteTitle: string }[]>((acc, note) => {
          const noteTasks = note.aiData?.extractedTasks?.filter(t => !t.done) || [];
          return acc.concat(noteTasks.map(t => ({ ...t, noteTitle: note.title })));
        }, []);
        
        if (tasks.length > 0) {
          response = CS.pendingTasks(tasks.length);
          tasks.slice(0, 5).forEach((task, idx) => {
            response += `${idx + 1}. ${task.task} _(${CS.fromNote}: ${task.noteTitle})_\n`;
          });
        } else {
          response = CS.allDone;
        }
      }
      else if (['notic', 'تطبيق', 'مشروع', 'project', 'app', 'proyecto', '项目'].some(k => query.includes(k))) {
        const projectNotes = notes.filter(n => 
          n.content.toLowerCase().includes('notic') ||
          n.title.toLowerCase().includes('notic') ||
          n.projectId === '1'
        );
        relatedNotes = projectNotes.map(n => n.id);
        if (projectNotes.length > 0) {
          response = CS.foundProject(projectNotes.length);
          projectNotes.forEach(note => {
            response += `📝 **${note.title}**\n`;
            if (note.aiData?.summary) {
              response += `${CS.summaryLabel}: ${note.aiData.summary}\n`;
            }
            response += '\n';
          });
        }
      }
      else if (['ملخص', 'لخص', 'أسبوع', 'summary', 'summarize', 'week', 'resumen', 'semana', '总结', '摘要'].some(k => query.includes(k))) {
        const recentNotes = notes.slice(0, 5);
        response = CS.recentSummary(recentNotes.length);
        recentNotes.forEach((note, idx) => {
          const date = new Date(note.createdAt).toLocaleDateString(dateLocale);
          response += `${idx + 1}. **${note.title}** (${date})\n`;
          if (note.aiData?.summary) {
            response += `   ${note.aiData.summary}\n`;
          }
          response += '\n';
        });
      }
      else if (['منبه', 'تذكير', 'alarm', 'reminder', 'alarma', '提醒', '闹钟'].some(k => query.includes(k))) {
        const alarmNotes = notes.filter(n => n.alarm?.hasAlarm && n.alarm.alarmTime);
        if (alarmNotes.length > 0) {
          response = CS.activeAlarms(alarmNotes.length);
          alarmNotes.forEach(note => {
            if (!note.alarm?.alarmTime) return;
            const alarmDate = new Date(note.alarm.alarmTime);
            response += `⏰ **${note.title}**\n   ${alarmDate.toLocaleString(dateLocale)}\n`;
            if (note.alarm?.isRecurring) {
              response += CS.recurring(note.alarm.recurrenceType ?? '');
            }
            response += '\n';
          });
        } else {
          response = CS.noAlarms;
        }
      }
      else {
        // بحث عام في جميع الملاحظات
        const searchTerms = query.split(' ').filter(t => t.length > 2);
        const matchingNotes = notes.filter(note => 
          searchTerms.some(term => 
            note.title.toLowerCase().includes(term) ||
            note.content.toLowerCase().includes(term) ||
            note.tags.some(tag => tag.toLowerCase().includes(term))
          )
        );
        
        relatedNotes = matchingNotes.map(n => n.id);
        
        if (matchingNotes.length > 0) {
          response = CS.foundRelated(matchingNotes.length);
          matchingNotes.slice(0, 3).forEach((note, idx) => {
            response += `${idx + 1}. **${note.title}**\n`;
            const preview = note.content.substring(0, 120).replace(/[#*]/g, '');
            response += `${preview}...\n\n`;
          });
          if (matchingNotes.length > 3) {
            response += CS.moreNotes(matchingNotes.length - 3);
          }
        } else {
          response = t('chatNoMatch');
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        relatedNotes
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 400);
  };

  const suggestedQuestions = [...CS.suggested];

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-3xl h-[85vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(139,92,246,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  Semantic AI Chat
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{t('askNotebook')}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">{CS.subtitle}</p>
            </div>
          </div>
          <ListenButton style="exciting" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
          <button
            onClick={onClose}
            className="relative z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md border border-white/20 hover:rotate-90 transition-all duration-300 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* منطقة الرسائل */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${
                message.type === 'user' 
                  ? 'order-2' 
                  : 'order-1'
              }`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  message.type === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : darkMode
                      ? 'bg-gray-800 text-gray-100 rounded-bl-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content.split('\n').map((line, idx) => {
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <strong key={idx} className="block mt-2 first:mt-0">{line.slice(2, -2)}</strong>;
                      }
                      if (line.startsWith('_') && line.endsWith('_')) {
                        return <em key={idx} className="text-xs opacity-75">{line.slice(1, -1)}</em>;
                      }
                      return <span key={idx}>{line}<br /></span>;
                    })}
                  </div>
                </div>
                <div className={`text-xs mt-1 px-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {new Date(message.timestamp).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${
                darkMode ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* أسئلة مقترحة */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputValue(q)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    darkMode 
                      ? 'border-gray-700 hover:bg-gray-800 text-gray-400' 
                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* حقل الإدخال */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex gap-2">
            <CaretSafeInput
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('chatPlaceholder')}
              className={`flex-1 px-4 py-3 rounded-xl border outline-none ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'
              }`}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <div className={`text-xs mt-2 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {CS.footer(notes.length)}
          </div>
        </div>
      </div>
    </div>
  );
}
