import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  buildAiContextReport,
  generateDebtReminderPack,
  inferTags,
  aiInterpretCommand,
  aiGenerateDraft,
  aiGenerateReport,
  aiSummarize,
  aiExtractTags,
} from '../utils/aiEngine';
import { geminiChat, GeminiMessage } from '../utils/geminiService';
import { CaretSafeInput, CaretSafeTextarea } from './CaretSafe';

import ListenButton from './ListenButton';
interface AICopilotProps {
  onClose: () => void;
}

export default function AICopilot({ onClose }: AICopilotProps) {
  const { darkMode, notes, debtsCredits, transactions, addNote, updateNote, language } = useApp();
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [completedAction, setCompletedAction] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [commandResult, setCommandResult] = useState('');
  const [autopilotEnabled, setAutopilotEnabled] = useState(() => {
    try { return localStorage.getItem('notic-ai-autopilot') === 'true'; } catch { return false; }
  });
  const [chatMessages, setChatMessages] = useState<GeminiMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ─── رسائل خطأ الدردشة — متعددة اللغات ──────────────────────────────
  const CHAT_ERRORS: Record<string, Record<string, string>> = {
    default:       { ar: 'عذراً، تعذّر الاتصال بـ Gemini.',              en: 'Sorry, could not connect to Gemini.',                  es: 'Error al conectar con Gemini.',            zh: '无法连接到 Gemini，请稍后再试。'     },
    rateLimit:     { ar: 'وصلت للحد الأقصى من الطلبات. حاول بعد ساعة.', en: 'Rate limit reached. Try again in an hour.',            es: 'Límite de solicitudes alcanzado. Intenta en una hora.', zh: '已达到请求上限，请一小时后再试。'    },
    notConfigured: { ar: 'مفتاح Gemini غير مُعدّ في الخادم.',             en: 'Gemini API key is not configured on the server.',      es: 'La clave de Gemini no está configurada.', zh: '服务器未配置 Gemini API 密钥。'       },
    modelNotFound: { ar: 'النموذج غير موجود — يحتمل أن نسخة الخادم قديمة. أعد نشر gemini-proxy.', en: 'Model not found — the server may be running an outdated version. Redeploy gemini-proxy.', es: 'Modelo no encontrado — el servidor puede estar desactualizado. Vuelve a desplegar gemini-proxy.', zh: '未找到模型 — 服务器版本可能过旧，请重新部署 gemini-proxy。' },
    timeout:       { ar: 'انتهت المهلة — الشبكة بطيئة، حاول مجدداً.',    en: 'Request timed out — slow network, please try again.',  es: 'Tiempo agotado — red lenta, inténtalo de nuevo.', zh: '请求超时，网络较慢，请重试。'         },
    noNetwork:     { ar: 'لا يوجد اتصال بالإنترنت.',                      en: 'No internet connection.',                              es: 'Sin conexión a internet.',                zh: '没有网络连接。'                        },
  };
  const _chatErr = (key: string) => CHAT_ERRORS[key]?.[language] ?? CHAT_ERRORS[key]?.['en'] ?? CHAT_ERRORS['default'][language];

  // ─── نصوص الواجهة — متعددة اللغات (ar/en/es/zh) ─────────────────────
  const DATE_LOCALES: Record<string, string> = { ar: 'ar-MA', en: 'en-US', es: 'es-ES', zh: 'zh-CN' };
  const dateLocale = DATE_LOCALES[language] ?? 'en-US';
  const STR_ALL = {
    ar: {
      amountMine: 'مبلغ لي', amountOnMe: 'مبلغ علي', alarmLinked: 'تنبيه مرتبط بملاحظة',
      planTitle: 'خطة اليوم بواسطة Tahiro AI', planHeading: '## خطة اليوم الذكية',
      planFooter: '> تم توليد هذه الخطة بناءً على ملاحظاتك، مهامك، والتنبيهات المالية القريبة.',
      planSummary: 'خطة يومية مولدة بالذكاء الاصطناعي من سياق التطبيق.',
      planTags: ['TahiroAI', 'خطة_اليوم', 'إنتاجية'], planAiTags: ['TahiroAI', 'إنتاجية'],
      localSummaryFallback: 'ملخص ذكي مختصر للملاحظة.',
      debtNoteTitle: 'رسائل تذكير الدائن والمدين', debtNoteHeading: '## رسائل جاهزة للإرسال',
      debtNoteFooter: '> يمكنك نسخ أي رسالة وإرسالها مباشرة.', debtTags: ['ديون', 'تذكير', 'TahiroAI'],
      reportTitle: 'تقرير Tahiro AI الشامل', reportTags: ['تقرير', 'TahiroAI', 'تحليل'],
      styleNames: { professional: 'احترافي', friendly: 'ودي', task: 'خطة مهام', message: 'رسالة' },
      draftSummaryPrefix: 'مسودة مولدة بنمط', commandNotePrefix: 'أمر AI', commandNoteHeading: '## أمر ذكي',
      commandTag: 'أمر_AI', commandFailed: 'تعذّر تنفيذ الأمر — حاول مجدداً.',
      actionPlanTitle: 'إنشاء خطة اليوم', actionPlanDesc: 'يحول مهامك وديونك القريبة إلى خطة تنفيذ قابلة للتشطيب.',
      actionOrganizeTitle: 'تنظيم ذكي للملاحظات', actionOrganizeDesc: 'يضيف وسوماً وملخصات تلقائية لتحسين البحث وخريطة العقل.',
      actionDebtTitle: 'رسائل تذكير مالية', actionDebtDesc: 'ينشئ رسائل احترافية للديون والمستحقات القريبة.',
      actionReportTitle: 'تقرير AI شامل', actionReportDesc: 'يلخص إنتاجيتك، مخاطرك المالية، والوسوم المقترحة في ملاحظة واحدة.',
      headerTitle: 'مركز الذكاء الاصطناعي المتقدم',
      headerSubtitle: 'طبقة تحليل ذكية فوق كل بيانات التطبيق: ملاحظاتك، مهامك، الديون، المصاريف، والمنبهات.',
      commandPlaceholder: 'اكتب أمراً: أنشئ خطة اليوم، نظم ملاحظاتي، حضر رسائل الديون، حلل أسبوعي...',
      thinking: 'يفكر...', runCommand: 'تنفيذ الأمر',
      autopilotTitle: 'وضع Tahiro Autopilot', autopilotDesc: 'طبقة متابعة ذكية تقترح التنظيم والتذكير كلما فتحت المركز.',
      enabled: 'مفعل', enable: 'تفعيل',
      rulesTitle: 'قواعد الذكاء التلقائي', rulesDesc: 'اختر كيف يساعدك Tahiro بدون إزعاج.',
      ruleAutoTags: 'وسوم تلقائية للملاحظات الجديدة', ruleDailyPlan: 'اقتراح خطة يوم عند فتح التطبيق',
      ruleFinance: 'تحذير مبكر للديون والمصاريف', ruleBrainDump: 'توجيه نفسي بعد تفريغ الدماغ',
      scoreTitle: 'درجة Tahiro للإنتاجية', scoreDesc: 'تحليل مباشر من سياق التطبيق',
      tagsTitle: 'وسوم ذكية مقترحة', timelineTitle: 'التوقعات القادمة', noEvents: 'لا توجد أحداث قريبة حالياً.',
      draftDesc: 'اكتب فكرة خام وسيحوّلها Tahiro إلى ملاحظة منظمة.',
      draftPlaceholder: 'مثال: أريد إرسال رسالة للعميل عن تأخير التسليم مع اعتذار محترم...',
      generateDraft: '{S.generateDraft}', draftDone: 'تم إنشاء المسودة كملاحظة ✅',
      upgradeTitle: 'تطوير ذكي شامل بنقرة واحدة',
      upgradeDesc: 'ينظم الملاحظات، ينشئ خطة اليوم، يحضر رسائل الديون، ويولد تقريراً شاملاً.',
      upgradeRunning: 'جاري تنفيذ الحزمة...', upgradeDone: 'تم التطوير الشامل ✅', upgradeRun: 'تشغيل الحزمة الكاملة →',
      actionDone: 'تم التنفيذ ✅', actionRun: 'تشغيل الذكاء الاصطناعي →',
      chatTitle: '💬 محادثة مع Tahiro AI', chatEmpty: 'اسألني عن ملاحظاتك، مهامك، أو أي شيء تريده...',
      chatThinking: 'يفكر... ⏳', chatPlaceholder: 'اسأل Tahiro...', send: 'إرسال',
      insightsTitle: 'إشارات Tahiro الذكية',
    },
    en: {
      amountMine: 'Owed to me', amountOnMe: 'I owe', alarmLinked: 'Alarm linked to a note',
      planTitle: "Today's plan by Tahiro AI", planHeading: '## Smart Daily Plan',
      planFooter: '> This plan was generated from your notes, tasks, and upcoming financial reminders.',
      planSummary: 'AI-generated daily plan from your app context.',
      planTags: ['TahiroAI', 'daily_plan', 'productivity'], planAiTags: ['TahiroAI', 'productivity'],
      localSummaryFallback: 'A short smart summary of the note.',
      debtNoteTitle: 'Debt & credit reminder messages', debtNoteHeading: '## Ready-to-send messages',
      debtNoteFooter: '> Copy any message and send it directly.', debtTags: ['debts', 'reminder', 'TahiroAI'],
      reportTitle: 'Tahiro AI full report', reportTags: ['report', 'TahiroAI', 'analysis'],
      styleNames: { professional: 'Professional', friendly: 'Friendly', task: 'Task plan', message: 'Message' },
      draftSummaryPrefix: 'Draft generated in style', commandNotePrefix: 'AI command', commandNoteHeading: '## Smart command',
      commandTag: 'AI_command', commandFailed: 'Could not run the command — please try again.',
      actionPlanTitle: "Create today's plan", actionPlanDesc: 'Turns your tasks and upcoming debts into an actionable checklist.',
      actionOrganizeTitle: 'Smart note organizing', actionOrganizeDesc: 'Adds automatic tags and summaries to improve search and the mind map.',
      actionDebtTitle: 'Financial reminder messages', actionDebtDesc: 'Creates professional messages for upcoming debts and dues.',
      actionReportTitle: 'Full AI report', actionReportDesc: 'Summarizes your productivity, financial risks, and suggested tags in one note.',
      headerTitle: 'Advanced AI Center',
      headerSubtitle: 'A smart analysis layer over all your app data: notes, tasks, debts, expenses, and alarms.',
      commandPlaceholder: "Type a command: create today's plan, organize my notes, prepare debt messages, analyze my week...",
      thinking: 'Thinking...', runCommand: 'Run command',
      autopilotTitle: 'Tahiro Autopilot mode', autopilotDesc: 'A smart follow-up layer that suggests organizing and reminders whenever you open the center.',
      enabled: 'On', enable: 'Enable',
      rulesTitle: 'Automation rules', rulesDesc: 'Choose how Tahiro helps you without being intrusive.',
      ruleAutoTags: 'Automatic tags for new notes', ruleDailyPlan: 'Suggest a daily plan on app open',
      ruleFinance: 'Early warnings for debts and expenses', ruleBrainDump: 'Coaching after a brain dump',
      scoreTitle: 'Tahiro productivity score', scoreDesc: 'Live analysis from your app context',
      tagsTitle: 'Suggested smart tags', timelineTitle: 'Upcoming events', noEvents: 'No upcoming events right now.',
      draftDesc: 'Write a raw idea and Tahiro will turn it into an organized note.',
      draftPlaceholder: 'Example: I want to send a client message about a delivery delay with a polite apology...',
      generateDraft: '✨ Generate smart note', draftDone: 'Draft created as a note ✅',
      upgradeTitle: 'One-click full smart upgrade',
      upgradeDesc: "Organizes notes, creates today's plan, prepares debt messages, and generates a full report.",
      upgradeRunning: 'Running the bundle...', upgradeDone: 'Full upgrade done ✅', upgradeRun: 'Run the full bundle →',
      actionDone: 'Done ✅', actionRun: 'Run AI →',
      chatTitle: '💬 Chat with Tahiro AI', chatEmpty: 'Ask me about your notes, tasks, or anything else...',
      chatThinking: 'Thinking... ⏳', chatPlaceholder: 'Ask Tahiro...', send: 'Send',
      insightsTitle: 'Tahiro smart insights',
    },
    es: {
      amountMine: 'Me deben', amountOnMe: 'Debo', alarmLinked: 'Alarma vinculada a una nota',
      planTitle: 'Plan del día por Tahiro AI', planHeading: '## Plan diario inteligente',
      planFooter: '> Este plan se generó a partir de tus notas, tareas y recordatorios financieros próximos.',
      planSummary: 'Plan diario generado por IA desde el contexto de la app.',
      planTags: ['TahiroAI', 'plan_diario', 'productividad'], planAiTags: ['TahiroAI', 'productividad'],
      localSummaryFallback: 'Un resumen inteligente y breve de la nota.',
      debtNoteTitle: 'Mensajes de recordatorio de deudas', debtNoteHeading: '## Mensajes listos para enviar',
      debtNoteFooter: '> Copia cualquier mensaje y envíalo directamente.', debtTags: ['deudas', 'recordatorio', 'TahiroAI'],
      reportTitle: 'Informe completo de Tahiro AI', reportTags: ['informe', 'TahiroAI', 'análisis'],
      styleNames: { professional: 'Profesional', friendly: 'Amistoso', task: 'Plan de tareas', message: 'Mensaje' },
      draftSummaryPrefix: 'Borrador generado en estilo', commandNotePrefix: 'Comando IA', commandNoteHeading: '## Comando inteligente',
      commandTag: 'comando_IA', commandFailed: 'No se pudo ejecutar el comando — inténtalo de nuevo.',
      actionPlanTitle: 'Crear plan del día', actionPlanDesc: 'Convierte tus tareas y deudas próximas en una lista accionable.',
      actionOrganizeTitle: 'Organización inteligente', actionOrganizeDesc: 'Añade etiquetas y resúmenes automáticos para mejorar la búsqueda y el mapa mental.',
      actionDebtTitle: 'Mensajes de recordatorio financiero', actionDebtDesc: 'Crea mensajes profesionales para deudas y vencimientos próximos.',
      actionReportTitle: 'Informe IA completo', actionReportDesc: 'Resume tu productividad, riesgos financieros y etiquetas sugeridas en una nota.',
      headerTitle: 'Centro avanzado de IA',
      headerSubtitle: 'Una capa de análisis inteligente sobre todos tus datos: notas, tareas, deudas, gastos y alarmas.',
      commandPlaceholder: 'Escribe un comando: crea el plan del día, organiza mis notas, prepara mensajes de deudas...',
      thinking: 'Pensando...', runCommand: 'Ejecutar',
      autopilotTitle: 'Modo Tahiro Autopilot', autopilotDesc: 'Una capa de seguimiento que sugiere organización y recordatorios al abrir el centro.',
      enabled: 'Activado', enable: 'Activar',
      rulesTitle: 'Reglas de automatización', rulesDesc: 'Elige cómo te ayuda Tahiro sin molestar.',
      ruleAutoTags: 'Etiquetas automáticas para notas nuevas', ruleDailyPlan: 'Sugerir plan diario al abrir la app',
      ruleFinance: 'Avisos tempranos de deudas y gastos', ruleBrainDump: 'Acompañamiento tras un volcado mental',
      scoreTitle: 'Puntuación de productividad', scoreDesc: 'Análisis en vivo del contexto de la app',
      tagsTitle: 'Etiquetas inteligentes sugeridas', timelineTitle: 'Próximos eventos', noEvents: 'No hay eventos próximos.',
      draftDesc: 'Escribe una idea en bruto y Tahiro la convertirá en una nota organizada.',
      draftPlaceholder: 'Ejemplo: quiero enviar un mensaje al cliente sobre un retraso con una disculpa cortés...',
      generateDraft: '✨ Generar nota inteligente', draftDone: 'Borrador creado como nota ✅',
      upgradeTitle: 'Mejora inteligente con un clic',
      upgradeDesc: 'Organiza notas, crea el plan del día, prepara mensajes de deudas y genera un informe completo.',
      upgradeRunning: 'Ejecutando el paquete...', upgradeDone: 'Mejora completa lista ✅', upgradeRun: 'Ejecutar paquete completo →',
      actionDone: 'Hecho ✅', actionRun: 'Ejecutar IA →',
      chatTitle: '💬 Chat con Tahiro AI', chatEmpty: 'Pregúntame sobre tus notas, tareas o lo que quieras...',
      chatThinking: 'Pensando... ⏳', chatPlaceholder: 'Pregunta a Tahiro...', send: 'Enviar',
      insightsTitle: 'Señales inteligentes de Tahiro',
    },
    zh: {
      amountMine: '应收款', amountOnMe: '应付款', alarmLinked: '与笔记关联的提醒',
      planTitle: 'Tahiro AI 今日计划', planHeading: '## 智能每日计划',
      planFooter: '> 此计划基于您的笔记、任务和临近的财务提醒生成。',
      planSummary: '由 AI 根据应用上下文生成的每日计划。',
      planTags: ['TahiroAI', '每日计划', '生产力'], planAiTags: ['TahiroAI', '生产力'],
      localSummaryFallback: '笔记的简短智能摘要。',
      debtNoteTitle: '债务提醒消息', debtNoteHeading: '## 可直接发送的消息',
      debtNoteFooter: '> 复制任意消息即可直接发送。', debtTags: ['债务', '提醒', 'TahiroAI'],
      reportTitle: 'Tahiro AI 完整报告', reportTags: ['报告', 'TahiroAI', '分析'],
      styleNames: { professional: '专业', friendly: '友好', task: '任务计划', message: '消息' },
      draftSummaryPrefix: '生成的草稿风格', commandNotePrefix: 'AI 命令', commandNoteHeading: '## 智能命令',
      commandTag: 'AI命令', commandFailed: '命令执行失败，请重试。',
      actionPlanTitle: '创建今日计划', actionPlanDesc: '将您的任务和临近债务转换为可执行清单。',
      actionOrganizeTitle: '智能整理笔记', actionOrganizeDesc: '自动添加标签和摘要，改善搜索和思维导图。',
      actionDebtTitle: '财务提醒消息', actionDebtDesc: '为临近的债务和应付款生成专业消息。',
      actionReportTitle: '完整 AI 报告', actionReportDesc: '在一条笔记中总结您的生产力、财务风险和推荐标签。',
      headerTitle: '高级 AI 中心',
      headerSubtitle: '覆盖所有应用数据的智能分析层：笔记、任务、债务、支出和提醒。',
      commandPlaceholder: '输入命令：创建今日计划、整理我的笔记、准备债务消息、分析我的一周...',
      thinking: '思考中...', runCommand: '执行命令',
      autopilotTitle: 'Tahiro 自动驾驶模式', autopilotDesc: '智能跟进层，每次打开中心时建议整理和提醒。',
      enabled: '已启用', enable: '启用',
      rulesTitle: '智能自动化规则', rulesDesc: '选择 Tahiro 如何在不打扰的情况下帮助您。',
      ruleAutoTags: '为新笔记自动添加标签', ruleDailyPlan: '打开应用时建议每日计划',
      ruleFinance: '债务和支出的早期预警', ruleBrainDump: '头脑清空后的心理引导',
      scoreTitle: 'Tahiro 生产力评分', scoreDesc: '来自应用上下文的实时分析',
      tagsTitle: '推荐的智能标签', timelineTitle: '即将发生的事件', noEvents: '当前没有临近事件。',
      draftDesc: '写下原始想法，Tahiro 会将其转换为有条理的笔记。',
      draftPlaceholder: '例如：我想给客户发送一条关于交付延迟的消息，并礼貌道歉...',
      generateDraft: '✨ 生成智能笔记', draftDone: '草稿已创建为笔记 ✅',
      upgradeTitle: '一键全面智能升级',
      upgradeDesc: '整理笔记、创建今日计划、准备债务消息并生成完整报告。',
      upgradeRunning: '正在执行套餐...', upgradeDone: '全面升级完成 ✅', upgradeRun: '运行完整套餐 →',
      actionDone: '已完成 ✅', actionRun: '运行 AI →',
      chatTitle: '💬 与 Tahiro AI 对话', chatEmpty: '问我关于您的笔记、任务或任何事情...',
      chatThinking: '思考中... ⏳', chatPlaceholder: '询问 Tahiro...', send: '发送',
      insightsTitle: 'Tahiro 智能信号',
    },
  } as const;
  const S = STR_ALL[(language as keyof typeof STR_ALL)] ?? STR_ALL.en;

  // ─── بناء سياق غني وشامل للذكاء الاصطناعي ───────────────────────────
  // كلما عرف الـ AI أكثر عن بيانات المستخدم، كانت ردوده أذكى وأكثر تحديداً.
  // الملاحظات المقفلة مُستثناة (محتواها مُشفَّر).
  const buildRichContext = (): string => {
    const parts: string[] = [];

    const openNotes = notes.filter(n => !n.isLocked);
    if (openNotes.length > 0) {
      parts.push('## NOTES & IDEAS (' + openNotes.length + ' total)');
      openNotes.slice(0, 25).forEach(n => {
        const type = n.type === 'idea' ? '💡 Idea' : '📝 Note';
        const tags = n.tags.length ? ` [tags: ${n.tags.join(', ')}]` : '';
        parts.push(`- ${type}: "${n.title}"${tags}\n  ${n.content.slice(0, 220).replace(/\n/g, ' ')}`);
      });
      if (openNotes.length > 25) parts.push(`...and ${openNotes.length - 25} more notes`);
    }

    if (debtsCredits && debtsCredits.length > 0) {
      parts.push('\n## DEBTS & CREDITS');
      debtsCredits.forEach(d => {
        const dir = d.type === 'debt' ? 'I OWE' : 'OWED TO ME';
        const remaining = d.amount - (d.paidAmount || 0);
        parts.push(`- ${dir}: ${d.personName} — ${remaining} ${d.currency} (status: ${d.status}, due: ${d.dueDate})${d.description ? ' — ' + d.description : ''}`);
      });
    }

    if (transactions && transactions.length > 0) {
      parts.push('\n## RECENT TRANSACTIONS');
      transactions.slice(0, 15).forEach(t => {
        parts.push(`- ${t.date}: ${t.amount} ${t.currency} (${t.category})${t.description ? ' — ' + t.description : ''}`);
      });
    }

    return parts.join('\n') || 'No data yet — the user has not created notes, debts, or transactions.';
  };

  // ─── إرسال موحّد للدردشة (يستعمله Enter وزر الإرسال معاً) ───
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    const newHistory: GeminiMessage[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newHistory);
    const notesCtx = buildRichContext();
    try {
      const reply = await geminiChat(userMsg, chatMessages, notesCtx);
      setChatMessages([...newHistory, { role: 'model', content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      let friendly: string;
      if      (msg.includes('429') || msg.includes('Rate limit') || msg.includes('QUOTA_EXCEEDED')) friendly = _chatErr('rateLimit');
      else if (msg.includes('503') || msg.includes('not configured'))       friendly = _chatErr('notConfigured');
      else if (msg.includes('404'))                                         friendly = _chatErr('modelNotFound');
      else if (msg.includes('مهلة') || msg.includes('abort') || msg.includes('Abort') || msg.includes('timed out')) friendly = _chatErr('timeout');
      else if (msg.includes('Failed to fetch') || msg.includes('Network')) friendly = _chatErr('noNetwork');
      else                                                                   friendly = _chatErr('default');
      setChatMessages([...newHistory, { role: 'model', content: friendly }]);
    } finally {
      setChatLoading(false);
    }
  };
  const [draftInput, setDraftInput] = useState('');
  const [draftStyle, setDraftStyle] = useState<'professional' | 'friendly' | 'task' | 'message'>('professional');
  const [automationRules, setAutomationRules] = useState(() => {
    const defaults = {
      autoTags: true,
      dailyPlan: false,
      financeWarnings: true,
      brainDumpCoaching: true,
    };
    try {
      const saved = localStorage.getItem('notic-ai-rules');
      return saved ? { ...defaults, ...(JSON.parse(saved) as Record<string, boolean>) } : defaults;
    } catch {
      try { localStorage.removeItem('notic-ai-rules'); } catch { /* ignore */ }
      return defaults;
    }
  });
  const report = useMemo(() => buildAiContextReport(notes, debtsCredits, transactions), [debtsCredits, notes, transactions]);

  const upcomingTimeline = useMemo(() => {
    const debtEvents = debtsCredits
      .filter(item => item.status !== 'paid')
      .map(item => ({
        id: `debt-${item.id}`,
        icon: item.type === 'credit' ? '🟢' : '🔴',
        title: item.personName,
        subtitle: `${item.amount - item.paidAmount} ${item.currency} • ${item.type === 'credit' ? S.amountMine : S.amountOnMe}`,
        date: item.dueDate,
      }));

    const alarmEvents = notes
      .filter(note => note.alarm?.hasAlarm && note.alarm.alarmTime)
      .map(note => ({
        id: `alarm-${note.id}`,
        icon: '⏰',
        title: note.title,
        subtitle: S.alarmLinked,
        date: note.alarm?.alarmTime || new Date().toISOString(),
      }));

    return [...debtEvents, ...alarmEvents]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [debtsCredits, notes]);

  const runAction = (id: string, action: () => void | Promise<void>) => {
    setWorkingAction(id);
    setCompletedAction(null);
    setTimeout(async () => {
      try {
        await action();
        setCompletedAction(id);
      } catch (err) {
        console.warn('[AICopilot] action failed:', id, err);
      } finally {
        setWorkingAction(null);
      }
    }, 400);
  };

  const updateRule = (rule: string, enabled: boolean) => {
    const next = { ...automationRules, [rule]: enabled };
    setAutomationRules(next);
    localStorage.setItem('notic-ai-rules', JSON.stringify(next));
  };

  const createTodayPlan = () => {
    addNote({
      title: S.planTitle,
      content: `${S.planHeading}\n\n${report.todayPlan}\n\n${S.planFooter}`,
      type: 'note',
      projectId: null,
      tags: [...S.planTags],
      isPinned: true,
      aiData: {
        summary: S.planSummary,
        tags: [...S.planAiTags],
        extractedTasks: report.todayPlan.split('\n').filter(line => line.includes('[ ]')).map(line => ({
          task: line.replace('- [ ]', '').trim(),
          done: false,
        })),
      },
    });
  };

  const organizeNotes = async () => {
    // الملاحظات المقفلة مُستثناة بالكامل: محتواها مُشفَّر، وتوليد ملخص/وسوم
    // منه عبثي (نص عشوائي) ويُهدر الحصة المجانية + يُخالف منطق الحماية.
    const unlockedNotes = notes.filter(n => !n.isLocked);
    // الملاحظات بلا ملخص أولاً — أهم 5 تحصل على Gemini حقيقي
    const needsAI = unlockedNotes.filter(n => !n.aiData?.summary).slice(0, 5);
    const rest = unlockedNotes.filter(n => !needsAI.includes(n)).slice(0, 12);

    // Gemini للملاحظات المهمة (تسلسلياً لاحترام rate limit)
    for (const note of needsAI) {
      try {
        const [summary, aiTags] = await Promise.all([
          aiSummarize(note.title, note.content),
          aiExtractTags(note.title, note.content),
        ]);
        const tags = Array.from(new Set([...note.tags, ...aiTags])).slice(0, 6);
        updateNote(note.id, {
          tags,
          aiData: { ...note.aiData, summary, tags },
        });
      } catch {
        // فشل Gemini لهذه الملاحظة — التنظيم المحلي يغطيها أدناه
        rest.push(note);
      }
    }

    // تنظيم محلي فوري للباقي
    rest.forEach(note => {
      const tags = Array.from(new Set([...note.tags, ...inferTags(`${note.title} ${note.content}`)]));
      const summary = note.aiData?.summary || note.content.replace(/[#*\u0060>-]/g, '').split(/[.؟!\n]/).filter(Boolean).slice(0, 2).join('. ');
      updateNote(note.id, {
        tags: tags.slice(0, 6),
        aiData: {
          ...note.aiData,
          summary: summary || S.localSummaryFallback,
          tags: tags.slice(0, 6),
        },
      });
    });
  };

  const createDebtReminders = () => {
    addNote({
      title: S.debtNoteTitle,
      content: `${S.debtNoteHeading}\n\n${generateDebtReminderPack(debtsCredits)}\n\n${S.debtNoteFooter}`,
      type: 'note',
      projectId: null,
      tags: [...S.debtTags],
      isPinned: false,
    });
  };

  const createFullReport = async () => {
    const content = await aiGenerateReport(notes, debtsCredits, transactions);
    addNote({
      title: S.reportTitle,
      content,
      type: 'note',
      projectId: null,
      tags: [...S.reportTags],
      isPinned: true,
    });
  };

  const runOneClickUpgrade = () => {
    runAction('upgrade-all', async () => {
      await organizeNotes();
      createTodayPlan();
      if (debtsCredits.some(item => item.status !== 'paid')) createDebtReminders();
      await createFullReport();
    });
  };

  const generateSmartDraft = async (rawText?: string) => {
    const raw = (rawText ?? draftInput).trim();
    if (!raw) return;

    setWorkingAction('draft');
    try {
      const content = await aiGenerateDraft(raw, draftStyle);
      const styleTitle = S.styleNames[draftStyle];
      const tags = Array.from(new Set(['TahiroAI', ...inferTags(raw), styleTitle]));
      addNote({
        title: `AI Draft - ${styleTitle}`,
        content,
        type: draftStyle === 'task' ? 'note' : 'idea',
        projectId: null,
        tags: tags.slice(0, 6),
        isPinned: false,
        aiData: {
          summary: `${S.draftSummaryPrefix}: ${styleTitle}`,
          tags: tags.slice(0, 6),
        },
      });
      setDraftInput('');
      setCompletedAction('draft');
    } finally {
      setWorkingAction(null);
    }
  };


  const setAutopilot = (enabled: boolean) => {
    setAutopilotEnabled(enabled);
    localStorage.setItem('notic-ai-autopilot', String(enabled));
  };

  const runNaturalCommand = async () => {
    const command = commandInput.trim();
    if (!command) return;
    setWorkingAction('command');
    setCommandResult('');

    try {
      const context = {
        noteCount: notes.length,
        debtCount: debtsCredits.filter(d => d.status !== 'paid').length,
        taskCount: notes.flatMap(n => n.aiData?.extractedTasks?.filter(t => !t.done) ?? []).length,
      };

      const { action, response } = await aiInterpretCommand(command, context);
      setCommandResult(response);

      if (action === 'plan') createTodayPlan();
      else if (action === 'debt') createDebtReminders();
      else if (action === 'organize') organizeNotes();
      else if (action === 'report') { await createFullReport(); }
      else if (action === 'draft') {
        setDraftInput(command);
        await generateSmartDraft(command);
      } else {
        const tags = inferTags(command);
        addNote({
          title: `${S.commandNotePrefix}: ${command.slice(0, 40)}`,
          content: `${S.commandNoteHeading}\n\n${command}\n\n> Tahiro AI: ${response}`,
          type: 'idea',
          projectId: null,
          tags: [S.commandTag, ...tags],
          isPinned: false,
        });
      }
      setCommandInput('');
    } catch (err) {
      console.warn('[AICopilot] command failed:', err);
      setCommandResult(S.commandFailed);
    } finally {
      // الزر لا يعلق أبداً حتى لو فشل أي شيء
      setWorkingAction(null);
    }
  };



  const actions = [
    { id: 'plan', icon: '🎯', title: S.actionPlanTitle, desc: S.actionPlanDesc, run: createTodayPlan, color: 'from-violet-500 to-indigo-500' },
    { id: 'organize', icon: '🏷️', title: S.actionOrganizeTitle, desc: S.actionOrganizeDesc, run: organizeNotes, color: 'from-emerald-500 to-teal-500' },
    { id: 'debt', icon: '💳', title: S.actionDebtTitle, desc: S.actionDebtDesc, run: createDebtReminders, color: 'from-rose-500 to-orange-500' },
    { id: 'report', icon: '📊', title: S.actionReportTitle, desc: S.actionReportDesc, run: createFullReport, color: 'from-fuchsia-500 to-pink-500' },
  ];

  const insightIcon = {
    focus: '🎯',
    finance: '💰',
    risk: '⚠️',
    organize: '🧩',
    growth: '🚀',
  };

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-[90] flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`glass-card flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl animate-scale-in ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-violet-700 via-purple-600 to-cyan-600 p-4 sm:p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_48%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-2xl sm:text-3xl shadow-inner backdrop-blur-md">🧠</div>
              <div className="min-w-0">
                <div className="mb-1 inline-flex rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest text-white">Tahiro AI Command Center</div>
                <h2 className="text-lg sm:text-2xl font-black leading-tight">{S.headerTitle}</h2>
                <p className="mt-0.5 sm:mt-1 max-w-xl text-[11px] sm:text-xs text-white/80 line-clamp-2">{S.headerSubtitle}</p>
              </div>
            </div>
            <ListenButton style="exciting" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
            <button onClick={onClose} className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:rotate-90 hover:bg-white/25">✕</button>
          </div>
        </div>

        {/* شريط أوامر الذكاء الاصطناعي */}
        <div className={`shrink-0 border-b p-4 ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg">✨</span>
              <CaretSafeInput
                value={commandInput}
                onChange={(event) => setCommandInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && runNaturalCommand()}
                placeholder={S.commandPlaceholder}
                className={`w-full rounded-2xl border py-3 pl-4 pr-12 text-sm font-semibold outline-none transition ${
                  darkMode ? 'border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:border-violet-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-violet-500'
                }`}
              />
            </div>
            <button
              onClick={runNaturalCommand}
              disabled={workingAction === 'command' || !commandInput.trim()}
              className="rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.01] disabled:opacity-50"
            >
              {workingAction === 'command' ? S.thinking : S.runCommand}
            </button>
          </div>
          {commandResult && (
            <div className="mt-3 rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-500">
              ✅ {commandResult}
            </div>
          )}
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-4">
            <div className={`rounded-3xl border p-5 ${autopilotEnabled ? 'border-emerald-500/40 bg-emerald-500/10' : darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">{S.autopilotTitle}</div>
                  <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{S.autopilotDesc}</p>
                </div>
                <button
                  onClick={() => setAutopilot(!autopilotEnabled)}
                  className={`rounded-full px-4 py-2 text-xs font-black text-white ${autopilotEnabled ? 'bg-emerald-500' : 'bg-gray-500'}`}
                >
                  {autopilotEnabled ? S.enabled : S.enable}
                </button>
              </div>
            </div>

            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-black">{S.rulesTitle}</div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{S.rulesDesc}</p>
                </div>
                <span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black text-fuchsia-500">RULES</span>
              </div>
              <div className="space-y-2">
                {[
                  ['autoTags', S.ruleAutoTags],
                  ['dailyPlan', S.ruleDailyPlan],
                  ['financeWarnings', S.ruleFinance],
                  ['brainDumpCoaching', S.ruleBrainDump],
                ].map(([key, label]) => (
                  <label key={key} className={`flex cursor-pointer items-center justify-between rounded-2xl p-3 ${darkMode ? 'bg-gray-950/60' : 'bg-gray-50'}`}>
                    <span className="text-sm font-bold">{label}</span>
                    <input
                      type="checkbox"
                      checked={!!automationRules[key]}
                      onChange={(event) => updateRule(key, event.target.checked)}
                      className="h-5 w-5 rounded text-violet-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black">{S.scoreTitle}</div>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{S.scoreDesc}</div>
                </div>
                <div className="text-4xl font-black text-violet-500">{report.productivityScore}</div>
              </div>
              <div className={`h-3 overflow-hidden rounded-full ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 transition-all" style={{ width: `${report.productivityScore}%` }} />
              </div>
            </div>

            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3 font-black">{S.tagsTitle}</div>
              <div className="flex flex-wrap gap-2">
                {report.suggestedTags.map(tag => (
                  <span key={tag} className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-500">#{tag}</span>
                ))}
              </div>
            </div>

            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="font-black">{S.timelineTitle}</div>
                <span className="rounded-full bg-violet-500/10 px-3 py-1 text-[10px] font-black text-violet-500">AI TIMELINE</span>
              </div>
              <div className="space-y-2">
                {upcomingTimeline.length ? upcomingTimeline.map(item => (
                  <div key={item.id} className={`rounded-2xl p-3 ${darkMode ? 'bg-gray-950/70' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black">{item.title}</div>
                        <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{item.subtitle}</div>
                      </div>
                      <div className="text-[10px] font-bold text-violet-500">{new Date(item.date).toLocaleDateString(dateLocale)}</div>
                    </div>
                  </div>
                )) : (
                  <div className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{S.noEvents}</div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">AI Draft Studio</div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{S.draftDesc}</p>
                </div>
                <select
                  value={draftStyle}
                  onChange={(event) => setDraftStyle(event.target.value as typeof draftStyle)}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white' : 'border-gray-200 bg-gray-50'}`}
                >
                  <option value="professional">{S.styleNames.professional}</option>
                  <option value="friendly">{S.styleNames.friendly}</option>
                  <option value="task">{S.styleNames.task}</option>
                  <option value="message">{S.styleNames.message}</option>
                </select>
              </div>
              <CaretSafeTextarea
                value={draftInput}
                onChange={(event) => setDraftInput(event.target.value)}
                placeholder={S.draftPlaceholder}
                rows={3}
                className={`mb-3 w-full resize-none rounded-2xl border p-3 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-500' : 'border-gray-200 bg-gray-50 placeholder-gray-400'}`}
              />
              <button
                onClick={() => generateSmartDraft()}
                disabled={!draftInput.trim() || workingAction === 'draft'}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] disabled:opacity-50"
              >
                ✨ توليد ملاحظة ذكية
              </button>
              {completedAction === 'draft' && <div className="mt-2 text-xs font-bold text-emerald-500">{S.draftDone}</div>}
            </div>

            <button
              onClick={runOneClickUpgrade}
              disabled={!!workingAction}
              className="w-full rounded-3xl bg-gradient-to-r from-yellow-500 via-orange-500 to-rose-500 p-5 text-start text-white shadow-2xl shadow-orange-500/20 transition hover:scale-[1.01] disabled:opacity-60"
            >
              <div className="text-2xl">⚡</div>
              <div className="mt-2 text-lg font-black">{S.upgradeTitle}</div>
              <p className="mt-1 text-xs text-white/80">{S.upgradeDesc}</p>
              <div className="mt-3 text-xs font-black">{workingAction === 'upgrade-all' ? S.upgradeRunning : completedAction === 'upgrade-all' ? S.upgradeDone : S.upgradeRun}</div>
            </button>

            <div className="grid gap-3 sm:grid-cols-2">
              {actions.map(action => (
                <button
                  key={action.id}
                  onClick={() => runAction(action.id, action.run)}
                  disabled={!!workingAction}
                  className={`group rounded-3xl border p-4 text-start transition hover:scale-[1.01] disabled:opacity-60 ${darkMode ? 'border-gray-700 bg-gray-900/70 hover:bg-gray-800' : 'border-gray-200 bg-white hover:shadow-xl'}`}
                >
                  <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r ${action.color} text-xl text-white shadow-lg`}>{workingAction === action.id ? '⏳' : action.icon}</div>
                  <div className="font-black">{action.title}</div>
                  <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{action.desc}</p>
                  <div className="mt-3 text-xs font-black text-violet-500">{completedAction === action.id ? S.actionDone : S.actionRun}</div>
                </button>
              ))}
            </div>

            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="font-black">{S.chatTitle}</div>
                <span className="rounded-full bg-violet-500/10 px-3 py-1 text-[10px] font-black text-violet-500">GEMINI LIVE</span>
              </div>
              <div className={`mb-3 h-40 overflow-y-auto rounded-2xl p-3 space-y-2 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
                {chatMessages.length === 0 && (
                  <p className={`text-xs text-center pt-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{S.chatEmpty}</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-medium ${
                      msg.role === 'user'
                        ? 'bg-violet-500 text-white'
                        : darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className={`rounded-2xl px-3 py-2 text-xs ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-400'}`}>
                      {S.chatThinking}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <CaretSafeInput
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return;
                    void sendChat();
                  }}
                  placeholder={S.chatPlaceholder}
                  className={`flex-1 rounded-2xl border px-3 py-2 text-xs outline-none ${darkMode ? 'border-gray-700 bg-gray-900 text-white placeholder-gray-500' : 'border-gray-200 bg-white'}`}
                />
                <button
                  onClick={() => { void sendChat(); }}
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-2xl bg-violet-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {S.send}
                </button>
              </div>
            </div>

            <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="font-black">{S.insightsTitle}</div>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-black text-cyan-500">LIVE CONTEXT</span>
              </div>
              <div className="space-y-3">
                {report.insights.map(insight => (
                  <div key={insight.id} className={`rounded-2xl border p-3 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{insightIcon[insight.type]}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black">{insight.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${insight.priority === 'high' ? 'bg-red-500/10 text-red-500' : insight.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{insight.priority}</span>
                        </div>
                        <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}