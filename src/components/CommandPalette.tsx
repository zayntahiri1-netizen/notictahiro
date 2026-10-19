import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CaretSafeInput } from './CaretSafe';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewNote: () => void;
  onNewIdea: () => void;
  onEditNote: (noteId: string) => void;
  onOpenAICopilot: () => void;
  onOpenNotesChat: () => void;
  onOpenFinance: () => void;
  onOpenDebtCredit: () => void;
  onOpenKnowledgeGraph: () => void;
  onOpenClipboard: () => void;
  onOpenDecisionMatrix: () => void;
  onOpenStats: () => void;
  onOpenBrainDump: () => void;
  onOpenMorningBrief: () => void;
}

type CommandItem = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  group: string;
  run: () => void;
  keywords: string;
};

export default function CommandPalette({
  isOpen,
  onClose,
  onNewNote,
  onNewIdea,
  onEditNote,
  onOpenAICopilot,
  onOpenNotesChat,
  onOpenFinance,
  onOpenDebtCredit,
  onOpenKnowledgeGraph,
  onOpenClipboard,
  onOpenDecisionMatrix,
  onOpenStats,
  onOpenBrainDump,
  onOpenMorningBrief,
}: CommandPaletteProps) {
  const { darkMode, notes, projects, setSearchQuery, t, direction, language } = useApp();
  const CP_ALL = {
    ar: {
      aiSub: 'تحليل شامل، خطة اليوم، تنظيم ذكي', chatSub: 'اسأل ملاحظاتك بذكاء دلالي',
      brainSub: 'تفريغ الأفكار وتحويلها لأولويات', briefSub: 'موجز ذكي لليوم',
      newNoteSub: 'فتح محرر ملاحظة جديدة', newIdeaSub: 'التقاط فكرة سريعة',
      financeSub: 'مصاريف واستثمارات بعبارات بسيطة', debtSub: 'إدارة الدائن والمدين والمنبهات',
      decisionTitle: 'مصفوفة القرار', decisionSub: 'تحليل قرارات مهنية ومالية',
      graphSub: 'شبكة مرئية للملاحظات والوسوم', clipboardSub: 'حفظ وتحليل الحافظة',
      statsTitle: 'إحصائيات الإنتاجية', statsSub: 'مؤشرات ومهام وإنجاز',
      header: 'مركز الأوامر الاحترافي', searchPh: 'ابحث عن أمر، صفحة، ملاحظة، مشروع...',
      cmds: 'الأوامر', notesS: 'الملاحظات', projectsS: 'المشاريع', noteFallback: 'ملاحظة',
      noResults: 'لا توجد نتائج مطابقة', tryHint: 'جرب: خطة، دين، تقرير، خصوصية، فكرة',
      enter: 'Enter للتنفيذ', esc: 'Esc للإغلاق', open: 'Ctrl/⌘ + K للفتح',
    },
    en: {
      aiSub: 'Full analysis, daily plan, smart organizing', chatSub: 'Ask your notes semantically',
      brainSub: 'Dump ideas and turn them into priorities', briefSub: 'Smart daily brief',
      newNoteSub: 'Open a new note editor', newIdeaSub: 'Capture a quick idea',
      financeSub: 'Expenses and investments in simple words', debtSub: 'Manage debts, credits and alarms',
      decisionTitle: 'Decision matrix', decisionSub: 'Analyze professional and financial decisions',
      graphSub: 'Visual network of notes and tags', clipboardSub: 'Save and analyze clipboard',
      statsTitle: 'Productivity stats', statsSub: 'Metrics, tasks and progress',
      header: 'Pro Command Center', searchPh: 'Search for a command, page, note, project...',
      cmds: 'Commands', notesS: 'Notes', projectsS: 'Projects', noteFallback: 'Note',
      noResults: 'No matching results', tryHint: 'Try: plan, debt, report, privacy, idea',
      enter: 'Enter to run', esc: 'Esc to close', open: 'Ctrl/⌘ + K to open',
    },
    es: {
      aiSub: 'Análisis completo, plan del día, organización', chatSub: 'Pregunta a tus notas semánticamente',
      brainSub: 'Vuelca ideas y conviértelas en prioridades', briefSub: 'Resumen diario inteligente',
      newNoteSub: 'Abrir un nuevo editor de notas', newIdeaSub: 'Captura una idea rápida',
      financeSub: 'Gastos e inversiones en palabras simples', debtSub: 'Gestiona deudas, créditos y alarmas',
      decisionTitle: 'Matriz de decisión', decisionSub: 'Analiza decisiones profesionales y financieras',
      graphSub: 'Red visual de notas y etiquetas', clipboardSub: 'Guardar y analizar el portapapeles',
      statsTitle: 'Estadísticas de productividad', statsSub: 'Métricas, tareas y progreso',
      header: 'Centro de comandos Pro', searchPh: 'Busca un comando, página, nota, proyecto...',
      cmds: 'Comandos', notesS: 'Notas', projectsS: 'Proyectos', noteFallback: 'Nota',
      noResults: 'No hay resultados', tryHint: 'Prueba: plan, deuda, informe, privacidad, idea',
      enter: 'Enter para ejecutar', esc: 'Esc para cerrar', open: 'Ctrl/⌘ + K para abrir',
    },
    zh: {
      aiSub: '全面分析、今日计划、智能整理', chatSub: '语义化询问您的笔记',
      brainSub: '清空想法并转化为优先事项', briefSub: '智能每日简报',
      newNoteSub: '打开新的笔记编辑器', newIdeaSub: '快速捕捉灵感',
      financeSub: '用简单的话记录支出和投资', debtSub: '管理债务、应收款和提醒',
      decisionTitle: '决策矩阵', decisionSub: '分析职业和财务决策',
      graphSub: '笔记和标签的可视化网络', clipboardSub: '保存并分析剪贴板',
      statsTitle: '生产力统计', statsSub: '指标、任务和进度',
      header: '专业命令中心', searchPh: '搜索命令、页面、笔记、项目...',
      cmds: '命令', notesS: '笔记', projectsS: '项目', noteFallback: '笔记',
      noResults: '没有匹配的结果', tryHint: '试试：计划、债务、报告、隐私、想法',
      enter: 'Enter 执行', esc: 'Esc 关闭', open: 'Ctrl/⌘ + K 打开',
    },
  } as const;
  const CP = CP_ALL[(language as keyof typeof CP_ALL)] ?? CP_ALL.en;
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSearchQuery(''); // ← تصفير فلتر قائمة الملاحظات عند الإغلاق
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const runAndClose = (run: () => void) => {
    run();
    onClose();
  };

  const commands: CommandItem[] = useMemo(() => [
    { id: 'ai', icon: '🧠', title: 'Tahiro AI Command Center', subtitle: CP.aiSub, group: 'AI', keywords: 'ai tahiro ذكاء تحليل خطة', run: onOpenAICopilot },
    { id: 'chat', icon: '💬', title: t('askNotebook'), subtitle: CP.chatSub, group: 'AI', keywords: 'chat notes ask دردشة اسأل', run: onOpenNotesChat },
    { id: 'brain', icon: '🧘', title: t('brainDump'), subtitle: CP.brainSub, group: 'AI', keywords: 'brain dump تفريغ افكار', run: onOpenBrainDump },
    { id: 'brief', icon: '☀️', title: t('morningBrief'), subtitle: CP.briefSub, group: 'AI', keywords: 'morning brief موجز صباح', run: onOpenMorningBrief },
    { id: 'new-note', icon: '📝', title: t('newNote'), subtitle: CP.newNoteSub, group: 'Create', keywords: 'new note ملاحظة', run: onNewNote },
    { id: 'new-idea', icon: '💡', title: t('quickIdea'), subtitle: CP.newIdeaSub, group: 'Create', keywords: 'idea فكرة quick', run: onNewIdea },
    { id: 'finance', icon: '💰', title: t('finance'), subtitle: CP.financeSub, group: 'Finance', keywords: 'finance money مصاريف مالية', run: onOpenFinance },
    { id: 'debt', icon: '💳', title: t('debtCredit'), subtitle: CP.debtSub, group: 'Finance', keywords: 'debt credit دين دائن مدين', run: onOpenDebtCredit },
    { id: 'decision', icon: '🧩', title: CP.decisionTitle, subtitle: CP.decisionSub, group: 'Tools', keywords: 'decision compare قرار مقارنة', run: onOpenDecisionMatrix },
    { id: 'graph', icon: '🕸️', title: t('mindMap'), subtitle: CP.graphSub, group: 'Tools', keywords: 'graph map خريطة عقل', run: onOpenKnowledgeGraph },
    { id: 'clipboard', icon: '📋', title: t('clipboard'), subtitle: CP.clipboardSub, group: 'Tools', keywords: 'clipboard حافظة نسخ', run: onOpenClipboard },
    { id: 'stats', icon: '📊', title: CP.statsTitle, subtitle: CP.statsSub, group: 'Tools', keywords: 'stats analytics احصائيات', run: onOpenStats },
    { id: 'privacy', icon: '🔒', title: t('privacy'), subtitle: '/privacy', group: 'Pages', keywords: 'privacy سياسة خصوصية', run: () => { window.location.href = '/privacy'; } },
    { id: 'delete-data', icon: '🧹', title: t('deleteData'), subtitle: '/delete-data', group: 'Pages', keywords: 'delete data حذف البيانات', run: () => { window.location.href = '/delete-data'; } },
    { id: 'about', icon: '✨', title: t('about'), subtitle: '/about', group: 'Pages', keywords: 'about من نحن', run: () => { window.location.href = '/about'; } },
    { id: 'contact', icon: '💌', title: t('contact'), subtitle: '/contact', group: 'Pages', keywords: 'contact اتصل تواصل', run: () => { window.location.href = '/contact'; } },
  ], [onNewIdea, onNewNote, onOpenAICopilot, onOpenBrainDump, onOpenClipboard, onOpenDebtCredit, onOpenDecisionMatrix, onOpenFinance, onOpenKnowledgeGraph, onOpenMorningBrief, onOpenNotesChat, onOpenStats, t, CP]);

  const q = query.toLowerCase().trim();
  const filteredCommands = commands.filter(item => {
    const haystack = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
    return !q || haystack.includes(q);
  }).slice(0, 10);

  const filteredNotes = notes.filter(note => {
    if (!q) return false;
    // الملاحظات المقفلة: البحث في العنوان والوسوم فقط — المحتوى مُشفَّر
    return note.title.toLowerCase().includes(q)
      || (!note.isLocked && note.content.toLowerCase().includes(q))
      || note.tags.some(tag => tag.toLowerCase().includes(q));
  }).slice(0, 6);

  const filteredProjects = projects.filter(project => q && project.name.toLowerCase().includes(q)).slice(0, 4);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-start justify-center p-3 pt-20 sm:p-6 sm:pt-24" onClick={onClose} dir={direction}>
      <div onClick={(event) => event.stopPropagation()} className={`glass-card w-full max-w-3xl overflow-hidden rounded-[2rem] animate-scale-in ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <div className="relative border-b border-white/10 bg-gradient-to-r from-violet-700 via-purple-600 to-cyan-600 p-4 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_48%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-2xl shadow-inner">⌘</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase tracking-widest text-white/70">Command Palette</div>
              <h2 className="text-xl font-black">{CP.header}</h2>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:rotate-90 hover:bg-white/25">✕</button>
          </div>
        </div>

        <div className="p-4">
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg">🔎</span>
            <CaretSafeInput
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchQuery(event.target.value);
              }}
              placeholder={CP.searchPh}
              className={`w-full rounded-2xl border py-4 pl-4 pr-12 text-base font-semibold outline-none ${darkMode ? 'border-gray-700 bg-gray-900 text-white placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'} focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10`}
            />
          </div>

          <div className="mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {filteredCommands.length > 0 && (
              <Section title={CP.cmds}>
                {filteredCommands.map(item => (
                  <CommandButton key={item.id} icon={item.icon} title={item.title} subtitle={`${item.group} • ${item.subtitle}`} onClick={() => runAndClose(item.run)} darkMode={darkMode} />
                ))}
              </Section>
            )}

            {filteredNotes.length > 0 && (
              <Section title={CP.notesS}>
                {filteredNotes.map(note => (
                  <CommandButton key={note.id} icon={note.type === 'idea' ? '💡' : '📝'} title={note.title} subtitle={note.tags.map(tag => `#${tag}`).join(' ') || CP.noteFallback} onClick={() => runAndClose(() => onEditNote(note.id))} darkMode={darkMode} />
                ))}
              </Section>
            )}

            {filteredProjects.length > 0 && (
              <Section title={CP.projectsS}>
                {filteredProjects.map(project => (
                  <CommandButton key={project.id} icon="📁" title={project.name} subtitle={project.description || CP.projectsS} onClick={() => runAndClose(() => setSearchQuery(project.name))} darkMode={darkMode} />
                ))}
              </Section>
            )}

            {!filteredCommands.length && !filteredNotes.length && !filteredProjects.length && (
              <div className={`py-10 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-4xl">🧭</div>
                <div className="mt-2 text-sm font-bold">{CP.noResults}</div>
                <div className="text-xs">{CP.tryHint}</div>
              </div>
            )}
          </div>

          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2 text-[11px] ${darkMode ? 'bg-gray-900 text-gray-500' : 'bg-gray-50 text-gray-500'}`}>
            <span>{CP.enter}</span>
            <span>{CP.esc}</span>
            <span>{CP.open}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 px-2 text-[11px] font-black uppercase tracking-wider text-violet-500">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CommandButton({ icon, title, subtitle, onClick, darkMode }: { icon: string; title: string; subtitle: string; onClick: () => void; darkMode: boolean }) {
  return (
    <button onClick={onClick} className={`w-full rounded-2xl border p-3 text-start transition hover:scale-[1.005] ${darkMode ? 'border-gray-800 bg-gray-900/70 hover:bg-gray-800' : 'border-gray-100 bg-white hover:bg-gray-50 hover:shadow-sm'}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black">{title}</div>
          <div className={`truncate text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</div>
        </div>
      </div>
    </button>
  );
}