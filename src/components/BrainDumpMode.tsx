import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { aiAnalyzeBrainDump } from '../utils/aiEngine';
import MicButton from './MicButton';
import { CaretSafeTextarea } from './CaretSafe';

import ListenButton from './ListenButton';
interface BrainDumpModeProps {
  onClose: () => void;
}

export default function BrainDumpMode({ onClose }: BrainDumpModeProps) {
  const { darkMode, addBrainDump, addNote, language } = useApp();
  const BD = {
    ar: { header: 'وضع تفريغ الدماغ', subtitle: 'أفرغ كل ما يقلقك أو يشغل بالك من فوضى وأفكار ودع الذكاء الاصطناعي ينظمها لك',
          prompt: 'اكتب أو تحدث بحرية تامة دون توقف، لا تقلق بشأن الترتيب أو التنسيق. احكِ كل ما يقلقك أو يملأ رأسك الآن:',
          placeholder: 'اكتب فوضى أفكارك هنا... سأقوم بفرزها وتنظيمها لك', processing: 'جاري فرز وتنظيم الفوضى...',
          process: 'تفريغ وتنظيم ذكي بواسطة AI', reliefTitle: 'الموجز النفسي والتحفيز',
          urgentTitle: 'أولويات عاجلة (تحتاج تنفيذ فوري)', urgentBadge: 'عاجل',
          ideasTitle: 'أفكار ومشاريع للمستقبل', ideaBadge: 'فكرة', editMore: 'تعديل الفوضى وكتابة المزيد',
          saveNote: '💾 حفظ كملاحظة منظمة', noteTitle: 'تفريغ دماغ منظم ذكياً',
          noteHeading: '## تفريغ الدماغ - أولويات وتنظيم ذكي', urgentSection: '### 🚨 أولويات عاجلة للتنفيذ:',
          ideasSection: '### 💡 أفكار للمستقبل:', reliefSection: '### 🧘 نصيحة التهدئة والتحفيز:',
          noteTags: ['تفريغ_دماغ', 'تنظيم', 'إنتاجية'],
          localRelief: (p: string) => `تفريغ أفكارك هو الخطوة الأولى للسيطرة على يومك. لقد لاحظ Tahiro وجود ضغوط مرتبطة بالمهام الحالية. لا تقلق، الخطوات الصغيرة ستقودك للنجاح. ابدأ بـ: "${p}" وحافظ على هدوئك. Notic Tahiro معك دائماً لتخفيف هذا العبء الذهني. ✨`,
          defaultStart: 'تنظيم يومك',
          urgentWords: ['هام', 'عاجل', 'لازم', 'ضروري', 'اليوم', 'غدا', 'اجتماع', 'اتصال'],
          ideaWords: ['فكرة', 'مشروع', 'تطوير', 'تطبيق', 'جديد', 'مستقبلي', 'تصميم'] },
    en: { header: 'Brain dump mode', subtitle: 'Dump everything on your mind and let the AI organize it for you',
          prompt: 'Write or speak freely without stopping. Don\'t worry about order or formatting. Pour out everything on your mind now:',
          placeholder: 'Write your messy thoughts here... I will sort and organize them for you', processing: 'Sorting and organizing the chaos...',
          process: 'Smart dump & organize with AI', reliefTitle: 'Psychological brief & motivation',
          urgentTitle: 'Urgent priorities (need immediate action)', urgentBadge: 'Urgent',
          ideasTitle: 'Ideas & projects for the future', ideaBadge: 'Idea', editMore: 'Edit the chaos and write more',
          saveNote: '💾 Save as organized note', noteTitle: 'Smartly organized brain dump',
          noteHeading: '## Brain Dump — Smart Priorities & Organization', urgentSection: '### 🚨 Urgent priorities to do:',
          ideasSection: '### 💡 Future ideas:', reliefSection: '### 🧘 Calming & motivation tip:',
          noteTags: ['brain_dump', 'organize', 'productivity'],
          localRelief: (p: string) => `Dumping your thoughts is the first step to controlling your day. Tahiro noticed some pressure tied to your current tasks. Don't worry — small steps lead to success. Start with: "${p}" and stay calm. Notic Tahiro is always with you to ease this mental load. ✨`,
          defaultStart: 'organizing your day',
          urgentWords: ['urgent', 'important', 'must', 'today', 'tomorrow', 'meeting', 'call', 'asap'],
          ideaWords: ['idea', 'project', 'develop', 'app', 'new', 'future', 'design'] },
    es: { header: 'Modo volcado mental', subtitle: 'Vuelca todo lo que te preocupa y deja que la IA lo organice por ti',
          prompt: 'Escribe o habla con total libertad sin parar. No te preocupes por el orden o el formato. Vuelca todo lo que tienes en mente ahora:',
          placeholder: 'Escribe tus pensamientos desordenados aquí... los ordenaré por ti', processing: 'Ordenando y organizando el caos...',
          process: 'Volcar y organizar con IA', reliefTitle: 'Resumen psicológico y motivación',
          urgentTitle: 'Prioridades urgentes (acción inmediata)', urgentBadge: 'Urgente',
          ideasTitle: 'Ideas y proyectos para el futuro', ideaBadge: 'Idea', editMore: 'Editar el caos y escribir más',
          saveNote: '💾 Guardar como nota organizada', noteTitle: 'Volcado mental organizado',
          noteHeading: '## Volcado mental — Prioridades y organización', urgentSection: '### 🚨 Prioridades urgentes:',
          ideasSection: '### 💡 Ideas futuras:', reliefSection: '### 🧘 Consejo de calma y motivación:',
          noteTags: ['volcado_mental', 'organizar', 'productividad'],
          localRelief: (p: string) => `Volcar tus pensamientos es el primer paso para controlar tu día. Tahiro notó algo de presión ligada a tus tareas actuales. No te preocupes, los pequeños pasos llevan al éxito. Empieza con: "${p}" y mantén la calma. Notic Tahiro siempre está contigo para aliviar esta carga mental. ✨`,
          defaultStart: 'organizar tu día',
          urgentWords: ['urgente', 'importante', 'debo', 'hoy', 'mañana', 'reunión', 'llamada'],
          ideaWords: ['idea', 'proyecto', 'desarrollar', 'app', 'nuevo', 'futuro', 'diseño'] },
    zh: { header: '头脑清空模式', subtitle: '倾倒你脑中所有烦扰，让 AI 为你整理',
          prompt: '自由地不停书写或说话。不必担心顺序或格式。现在倾倒你脑中的一切：',
          placeholder: '在这里写下你纷乱的想法……我会为你梳理整理', processing: '正在整理纷乱的思绪...',
          process: '用 AI 清空并整理', reliefTitle: '心理简报与激励',
          urgentTitle: '紧急优先事项（需立即处理）', urgentBadge: '紧急',
          ideasTitle: '未来的想法和项目', ideaBadge: '想法', editMore: '编辑并写更多',
          saveNote: '💾 保存为有条理的笔记', noteTitle: '智能整理的头脑清空',
          noteHeading: '## 头脑清空 — 智能优先级与整理', urgentSection: '### 🚨 紧急优先事项：',
          ideasSection: '### 💡 未来想法：', reliefSection: '### 🧘 平静与激励建议：',
          noteTags: ['头脑清空', '整理', '生产力'],
          localRelief: (p: string) => `倾倒你的想法是掌控一天的第一步。Tahiro 注意到你当前任务带来的一些压力。别担心——小步骤会带来成功。从这里开始："${p}"，保持冷静。Notic Tahiro 始终陪伴你减轻这份心理负担。✨`,
          defaultStart: '整理你的一天',
          urgentWords: ['紧急', '重要', '必须', '今天', '明天', '会议', '电话'],
          ideaWords: ['想法', '项目', '开发', '应用', '新', '未来', '设计'] },
  }[(language as 'ar'|'en'|'es'|'zh')];
  const BDx = BD ?? {
    header: 'Brain dump mode', subtitle: 'Dump everything on your mind and let the AI organize it for you',
    prompt: 'Write freely. Pour out everything on your mind now:', placeholder: 'Write your messy thoughts here...',
    processing: 'Sorting...', process: 'Smart dump & organize with AI', reliefTitle: 'Psychological brief & motivation',
    urgentTitle: 'Urgent priorities', urgentBadge: 'Urgent', ideasTitle: 'Ideas for the future', ideaBadge: 'Idea',
    editMore: 'Edit and write more', saveNote: '💾 Save as note', noteTitle: 'Brain dump',
    noteHeading: '## Brain Dump', urgentSection: '### 🚨 Urgent:', ideasSection: '### 💡 Ideas:', reliefSection: '### 🧘 Tip:',
    noteTags: ['brain_dump', 'organize', 'productivity'],
    localRelief: (p: string) => `Start with: "${p}" and stay calm. ✨`, defaultStart: 'organizing your day',
    urgentWords: ['urgent', 'important', 'today', 'meeting'], ideaWords: ['idea', 'project', 'new'] };
  const B = BD ?? BDx;
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    urgentPriorities: string[];
    futureIdeas: string[];
    anxietyRelief: string;
  } | null>(null);

  const handleProcess = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);

    // ─── 1) Gemini الحقيقي (يصنّف بفهم دلالي كامل) ───
    try {
      const ai = await aiAnalyzeBrainDump(text);
      if (ai?.urgentPriorities?.length || ai?.futureIdeas?.length) {
        setResult(ai);
        setIsProcessing(false);
        addBrainDump({
          originalText: text,
          urgentPriorities: ai.urgentPriorities,
          futureIdeas: ai.futureIdeas,
          anxietyRelief: ai.anxietyRelief,
        });
        return;
      }
    } catch (err) {
      console.warn('[BrainDump] Gemini unavailable, using local analysis:', err);
    }

    // ─── 2) Fallback: التصنيف المحلي بالكلمات المفتاحية ───
    setTimeout(() => {
      // استخراج جمل عشوائية وتصنيفها كأولويات عاجلة أو أفكار مستقبلية
      const sentences = text.split(/[.؟!。\n]/).filter(s => s.trim().length > 5);
      
      const urgentWords = B.urgentWords;
      const ideaWords = B.ideaWords;

      const urgentPriorities = sentences.filter(s => 
        urgentWords.some(w => s.includes(w))
      ).slice(0, 4);

      const futureIdeas = sentences.filter(s => 
        ideaWords.some(w => s.includes(w)) && !urgentPriorities.includes(s)
      ).slice(0, 4);

      // في حال لم يتم العثور على تصنيفات، نوزع الجمل عشوائياً
      if (urgentPriorities.length === 0 && sentences.length > 0) {
        urgentPriorities.push(sentences[0]);
        if (sentences.length > 1) urgentPriorities.push(sentences[1]);
      }
      if (futureIdeas.length === 0 && sentences.length > 2) {
        futureIdeas.push(sentences[2]);
        if (sentences.length > 3) futureIdeas.push(sentences[3]);
      }

      const anxietyRelief = B.localRelief(urgentPriorities[0] || B.defaultStart);

      setResult({
        urgentPriorities,
        futureIdeas,
        anxietyRelief
      });
      
      setIsProcessing(false);
      
      // حفظ البيانات
      addBrainDump({
        originalText: text,
        urgentPriorities,
        futureIdeas,
        anxietyRelief
      });
    }, 500);
  };

  const handleSaveAsNote = () => {
    if (!result) return;
    
    const content = `${B.noteHeading}\n\n${B.urgentSection}\n${
      result.urgentPriorities.map(p => `- [ ] ${p}`).join('\n')
    }\n\n${B.ideasSection}\n${
      result.futureIdeas.map(i => `- [ ] ${i}`).join('\n')
    }\n\n${B.reliefSection}\n> ${result.anxietyRelief}`;
    
    addNote({
      title: B.noteTitle,
      content,
      type: 'note',
      projectId: null,
      tags: [...B.noteTags],
      isPinned: false
    });
    
    onClose();
  };

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in shadow-[0_20px_60px_-15px_rgba(244,63,94,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* رأس النافذة الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              🧘
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  AI Mindfulness
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{B.header}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">{B.subtitle}</p>
            </div>
          </div>
          <ListenButton style="energetic" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
          <button
            onClick={onClose}
            className="relative z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md border border-white/20 hover:rotate-90 transition-all duration-300 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!result ? (
            <div className="space-y-4 h-full flex flex-col">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {B.prompt}
              </p>
              <div className="relative flex-1 flex flex-col">
                <CaretSafeTextarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={B.placeholder}
                  className={`flex-1 w-full min-h-[300px] p-4 pb-16 rounded-xl border outline-none resize-none text-lg leading-relaxed ${
                    darkMode
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-600'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  } focus:border-rose-400`}
                  disabled={isProcessing}
                />
                {/* زر الميكروفون — تدوين صوتي يُضاف للنص الحالي */}
                <div className="absolute bottom-3 left-3">
                  <MicButton
                    darkMode={darkMode}
                    disabled={isProcessing}
                    onTranscribed={(t) => setText(prev => prev ? prev + ' ' + t : t)}
                  />
                </div>
              </div>
              
              {/* زر المعالجة */}
              <button
                onClick={handleProcess}
                disabled={isProcessing || !text.trim()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-lg shadow-rose-500/25"
              >
                {isProcessing ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{B.processing}</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{B.process}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-up">
              {/* مخاوف وضغوط */}
              <div className={`p-4 rounded-xl border ${
                darkMode ? 'bg-rose-950/20 border-rose-900/50 text-rose-200' : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span>🧘</span>
                  <span>{B.reliefTitle}</span>
                </h3>
                <p className="text-sm leading-relaxed italic">
                  "{result.anxietyRelief}"
                </p>
              </div>

              {/* أولويات عاجلة */}
              <div>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <span className="text-rose-500">🚨</span>
                  <span>{B.urgentTitle}</span>
                </h3>
                <div className="space-y-2">
                  {result.urgentPriorities.map((p, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-xl border flex items-center gap-3 ${
                        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-500 font-bold">{B.urgentBadge}</span>
                      <span className="text-sm">{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* أفكار للمستقبل */}
              <div>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <span className="text-amber-500">💡</span>
                  <span>{B.ideasTitle}</span>
                </h3>
                <div className="space-y-2">
                  {result.futureIdeas.map((i, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-xl border flex items-center gap-3 ${
                        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-500 font-bold">{B.ideaBadge}</span>
                      <span className="text-sm">{i}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setResult(null)}
                  className={`flex-1 py-3 rounded-xl font-medium ${
                    darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {B.editMore}
                </button>
                <button
                  onClick={handleSaveAsNote}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/25"
                >
                  {B.saveNote}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
