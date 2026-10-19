/**
 * aiEngine.ts
 * ─────────────────────────────────────────────────────────────────────
 * طبقة وسيطة بين المكوّنات وخدمة Gemini
 * تُطبّق نمط Fallback: تجرّب الذكاء الاصطناعي السحابي أولاً،
 * وتعود للمعالجة المحلية إذا فشل الاتصال.
 *
 * FIX: دعم كامل للغات المتعددة في رسائل الـ fallback والتقارير المحلية
 * ─────────────────────────────────────────────────────────────────────
 */

import type { AppLanguage } from '../i18n';
import { DebtCredit, Note, Transaction } from '../context/AppContext';
import {
  geminiSummarize,
  geminiExtractTags,
  geminiExtractTasks,
  geminiGenerateDraft,
  geminiInterpretCommand,
  geminiGenerateReport,
  geminiAnalyzeBrainDump,
  geminiSuggestTitle,
  geminiExpandIdea,
  geminiSpellCheck,
  geminiAskAboutNote,
  geminiGenerateMeetingNotes,
  geminiTranslate,
  geminiGenerateDebtMessage,
} from './geminiService';

export interface AiInsight {
  id         : string;
  type       : 'focus' | 'finance' | 'risk' | 'organize' | 'growth';
  title      : string;
  description: string;
  priority   : 'low' | 'medium' | 'high';
  actionLabel: string;
}

export interface AiContextReport {
  productivityScore: number;
  insights         : AiInsight[];
  todayPlan        : string;
  suggestedTags    : string[];
}

// ─── قراءة اللغة الحالية بأمان ────────────────────────────────────────
function getLang(): AppLanguage {
  try {
    const stored = localStorage.getItem('notic-language') as AppLanguage | null;
    if (stored && ['ar', 'en', 'es', 'zh'].includes(stored)) return stored;
  } catch { /* fallback */ }
  return 'en';
}

// ─── نصوص واجهة متعددة اللغات للـ fallback ─────────────────────────────
const UI: Record<AppLanguage, {
  focusTitle: string; focusDesc: (n: number) => string; focusAction: string;
  riskTitle: string; riskDesc: (n: number) => string; riskAction: string;
  organizeTitle: string; organizeDesc: (n: number) => string; organizeAction: string;
  financeTitle: string; financeDesc: (c: string) => string; financeAction: string;
  growthTitle: string; growthDesc: string; growthAction: string;
  reportHeader: string; scoreLabel: string; insightsLabel: string;
  planLabel: string; tagsLabel: string;
  noDebts: string; creditReminder: (n: string, a: number, c: string, d: string) => string;
  debtReminder: (n: string, a: number, c: string, d: string) => string;
  unknownCommand: string; planReply: string; debtReply: string;
  organizeReply: string; reportReply: string;
  geminiUnavailable: string;
  todayPlaceholder: string;
  meetingTemplate: (raw: string) => string;
  expandTemplate: (idea: string) => string;
}> = {
  ar: {
    focusTitle: 'تركيز اليوم يحتاج مهام صغيرة',
    focusDesc: n => `وجد Tahiro ${n} مهمة غير مكتملة. الأفضل تحويلها إلى خطة تنفيذ قصيرة.`,
    focusAction: 'إنشاء خطة اليوم',
    riskTitle: 'تنبيهات مالية قريبة',
    riskDesc: n => `هناك ${n} سجل دائن/مدين يقترب من تاريخ الاستحقاق.`,
    riskAction: 'توليد رسائل التذكير',
    organizeTitle: 'تنظيم تلقائي للملاحظات',
    organizeDesc: n => `${n} ملاحظات تحتاج ملخصاً أو وسوماً ذكية.`,
    organizeAction: 'تنظيم ذكي',
    financeTitle: 'نمط مالي قابل للتحليل',
    financeDesc: c => `أكثر عملة مستخدمة: ${c}. يمكن إنشاء ملخص مصاريف.`,
    financeAction: 'إنشاء ملخص مالي',
    growthTitle: 'ذاكرة Tahiro تتحسن مع الاستخدام',
    growthDesc: 'كلما زادت الملاحظات والوسوم، أصبحت الإجابات أدق.',
    growthAction: 'إنشاء تقرير ذكي',
    reportHeader: '## تقرير Tahiro AI الذكي',
    scoreLabel: '### درجة الإنتاجية',
    insightsLabel: '### أهم الإشارات',
    planLabel: '### خطة اليوم المقترحة',
    tagsLabel: '### وسوم مقترحة',
    noDebts: 'لا توجد ديون أو مستحقات معلقة حالياً.',
    creditReminder: (n, a, c, d) => `- إلى ${n}: تذكير لطيف، تبقى مبلغ ${a} ${c}. موعد السداد: ${d}.`,
    debtReminder: (n, a, c, d) => `- تذكير ذاتي: يجب سداد ${a} ${c} إلى ${n} قبل ${d}.`,
    unknownCommand: 'حفظت الأمر كملاحظة ذكية.',
    planReply: 'سأنشئ خطة اليوم.',
    debtReply: 'سأولّد رسائل التذكير.',
    organizeReply: 'سأنظم ملاحظاتك.',
    reportReply: 'سأنشئ تقريراً.',
    geminiUnavailable: 'تعذّر الاتصال بـ Gemini. تحقق من إعداد Supabase في ملف .env.',
    todayPlaceholder: '- [ ] اكتب فكرة واحدة مهمة اليوم\n- [ ] راجع الملاحظات المثبتة\n- [ ] نظّف وسماً غير مستخدم',
    meetingTemplate: raw => `## اجتماع\n\n### النقاط المناقشة\n${raw}\n\n### المهام القادمة\n- [ ] متابعة`,
    expandTemplate: idea => `## ${idea}\n\n*أضف تفاصيل لهذه الفكرة...*\n\n- النقطة الأولى\n- النقطة الثانية\n- الخطوة التالية`,
  },
  en: {
    focusTitle: "Today's focus needs small tasks",
    focusDesc: n => `Tahiro found ${n} incomplete tasks. Best to turn them into a short action plan.`,
    focusAction: "Create today's plan",
    riskTitle: 'Upcoming financial alerts',
    riskDesc: n => `${n} debt/credit records are approaching their due date.`,
    riskAction: 'Generate reminder messages',
    organizeTitle: 'Auto-organize notes',
    organizeDesc: n => `${n} notes need a summary or smart tags.`,
    organizeAction: 'Smart organize',
    financeTitle: 'Analyzable financial pattern',
    financeDesc: c => `Most-used currency: ${c}. A spending summary can be generated.`,
    financeAction: 'Generate finance summary',
    growthTitle: "Tahiro's memory improves with use",
    growthDesc: 'More notes and tags make semantic answers and mind maps more accurate.',
    growthAction: 'Generate smart report',
    reportHeader: '## Tahiro AI Smart Report',
    scoreLabel: '### Productivity Score',
    insightsLabel: '### Key Insights',
    planLabel: "### Today's Suggested Plan",
    tagsLabel: '### Suggested Tags',
    noDebts: 'No pending debts or receivables.',
    creditReminder: (n, a, c, d) => `- To ${n}: gentle reminder, ${a} ${c} remaining. Due: ${d}.`,
    debtReminder: (n, a, c, d) => `- Self reminder: pay ${a} ${c} to ${n} before ${d}.`,
    unknownCommand: 'Saved command as a smart note.',
    planReply: "I'll create today's plan.",
    debtReply: "I'll generate reminder messages.",
    organizeReply: "I'll organize your notes.",
    reportReply: "I'll generate a report.",
    geminiUnavailable: "Couldn't connect to Gemini. Check your Supabase setup in .env.",
    todayPlaceholder: "- [ ] Write one important idea today\n- [ ] Review pinned notes\n- [ ] Clean unused tags",
    meetingTemplate: raw => `## Meeting\n\n### Discussion Points\n${raw}\n\n### Action Items\n- [ ] Follow up`,
    expandTemplate: idea => `## ${idea}\n\n*Add details to this idea...*\n\n- First point\n- Second point\n- Next step`,
  },
  es: {
    focusTitle: 'El foco de hoy necesita tareas pequeñas',
    focusDesc: n => `Tahiro encontró ${n} tareas incompletas. Lo mejor es convertirlas en un plan corto.`,
    focusAction: 'Crear plan del día',
    riskTitle: 'Alertas financieras próximas',
    riskDesc: n => `Hay ${n} registros de deuda/crédito próximos a su fecha límite.`,
    riskAction: 'Generar mensajes de recordatorio',
    organizeTitle: 'Auto-organizar notas',
    organizeDesc: n => `${n} notas necesitan un resumen o etiquetas inteligentes.`,
    organizeAction: 'Organización inteligente',
    financeTitle: 'Patrón financiero analizable',
    financeDesc: c => `Moneda más usada: ${c}. Se puede generar un resumen de gastos.`,
    financeAction: 'Generar resumen financiero',
    growthTitle: 'La memoria de Tahiro mejora con el uso',
    growthDesc: 'Más notas y etiquetas hacen las respuestas y el mapa mental más precisos.',
    growthAction: 'Generar informe inteligente',
    reportHeader: '## Informe Inteligente de Tahiro AI',
    scoreLabel: '### Puntuación de Productividad',
    insightsLabel: '### Perspectivas Clave',
    planLabel: '### Plan Sugerido para Hoy',
    tagsLabel: '### Etiquetas Sugeridas',
    noDebts: 'No hay deudas o créditos pendientes.',
    creditReminder: (n, a, c, d) => `- A ${n}: recordatorio amable, quedan ${a} ${c}. Vence: ${d}.`,
    debtReminder: (n, a, c, d) => `- Recordatorio: pagar ${a} ${c} a ${n} antes del ${d}.`,
    unknownCommand: 'Comando guardado como nota inteligente.',
    planReply: 'Crearé el plan del día.',
    debtReply: 'Generaré mensajes de recordatorio.',
    organizeReply: 'Organizaré tus notas.',
    reportReply: 'Generaré un informe.',
    geminiUnavailable: 'No se pudo conectar con Gemini. Revisa la configuración de Supabase en .env.',
    todayPlaceholder: '- [ ] Escribe una idea importante hoy\n- [ ] Revisa las notas fijadas\n- [ ] Limpia etiquetas sin uso',
    meetingTemplate: raw => `## Reunión\n\n### Puntos Discutidos\n${raw}\n\n### Tareas\n- [ ] Seguimiento`,
    expandTemplate: idea => `## ${idea}\n\n*Añade detalles a esta idea...*\n\n- Primer punto\n- Segundo punto\n- Siguiente paso`,
  },
  zh: {
    focusTitle: '今日专注需要小任务',
    focusDesc: n => `Tahiro 发现 ${n} 个未完成任务，最好将其转化为简短执行计划。`,
    focusAction: '创建今日计划',
    riskTitle: '即将到期的财务提醒',
    riskDesc: n => `有 ${n} 条债务/信用记录即将到期。`,
    riskAction: '生成提醒消息',
    organizeTitle: '自动整理笔记',
    organizeDesc: n => `${n} 条笔记需要摘要或智能标签。`,
    organizeAction: '智能整理',
    financeTitle: '可分析的财务模式',
    financeDesc: c => `最常用货币：${c}，可生成支出摘要。`,
    financeAction: '生成财务摘要',
    growthTitle: 'Tahiro 的记忆随使用而增长',
    growthDesc: '笔记和标签越多，语义回答和思维导图越精准。',
    growthAction: '生成智能报告',
    reportHeader: '## Tahiro AI 智能报告',
    scoreLabel: '### 生产力评分',
    insightsLabel: '### 关键洞察',
    planLabel: '### 今日建议计划',
    tagsLabel: '### 建议标签',
    noDebts: '目前没有待处理的债务或应收款项。',
    creditReminder: (n, a, c, d) => `- 给 ${n}：温馨提醒，剩余 ${a} ${c}。到期日：${d}。`,
    debtReminder: (n, a, c, d) => `- 自我提醒：在 ${d} 之前向 ${n} 支付 ${a} ${c}。`,
    unknownCommand: '命令已保存为智能笔记。',
    planReply: '我将创建今日计划。',
    debtReply: '我将生成提醒消息。',
    organizeReply: '我将整理您的笔记。',
    reportReply: '我将生成报告。',
    geminiUnavailable: '无法连接 Gemini。请检查 .env 中的 Supabase 设置。',
    todayPlaceholder: '- [ ] 今天写一个重要想法\n- [ ] 查看置顶笔记\n- [ ] 清理未使用的标签',
    meetingTemplate: raw => `## 会议\n\n### 讨论要点\n${raw}\n\n### 行动项\n- [ ] 跟进`,
    expandTemplate: idea => `## ${idea}\n\n*为这个想法添加细节...*\n\n- 第一点\n- 第二点\n- 下一步`,
  },
};

// ─── كلمات مهمة للعربية (للـ inferTags المحلي) ──────────────────────
const importantWords = ['هام', 'ضروري', 'اجتماع', 'موعد', 'مشروع', 'تطوير', 'اختبار', 'مراجعة'];

// ═══════════════════════════════════════════════════════════════════════
// دوال محلية (تعمل بدون إنترنت — Fallback)
// ═══════════════════════════════════════════════════════════════════════

export function buildAiContextReport(
  notes       : Note[],
  debts       : DebtCredit[],
  transactions: Transaction[]
): AiContextReport {
  const lang = getLang();
  const ui   = UI[lang];

  const unfinishedTasks = notes.flatMap(note =>
    note.aiData?.extractedTasks
      ?.filter(task => !task.done)
      .map(task => ({ ...task, note })) ?? []
  );
  const urgentDebts   = debts.filter(item => item.status !== 'paid' && daysUntil(item.dueDate) <= 7);
  const untaggedNotes = notes.filter(note => note.tags.length === 0 || !note.aiData?.summary);
  const pinnedRatio   = notes.length ? notes.filter(n => n.isPinned).length / notes.length : 0;
  const taskCompletion = getTaskCompletion(notes);
  const financeLoad   = transactions.length + debts.length;

  const score = Math.max(35, Math.min(98,
    Math.round(45 + taskCompletion * 35 + pinnedRatio * 10 + Math.min(financeLoad, 10))
  ));

  const insights: AiInsight[] = [];

  if (unfinishedTasks.length > 0) {
    insights.push({
      id         : 'focus-tasks',
      type       : 'focus',
      title      : ui.focusTitle,
      description: ui.focusDesc(unfinishedTasks.length),
      priority   : unfinishedTasks.length > 5 ? 'high' : 'medium',
      actionLabel: ui.focusAction,
    });
  }

  if (urgentDebts.length > 0) {
    insights.push({
      id         : 'urgent-debts',
      type       : 'risk',
      title      : ui.riskTitle,
      description: ui.riskDesc(urgentDebts.length),
      priority   : 'high',
      actionLabel: ui.riskAction,
    });
  }

  if (untaggedNotes.length > 0) {
    insights.push({
      id         : 'auto-organize',
      type       : 'organize',
      title      : ui.organizeTitle,
      description: ui.organizeDesc(untaggedNotes.length),
      priority   : 'medium',
      actionLabel: ui.organizeAction,
    });
  }

  if (transactions.length > 0) {
    const topCurrency = getTopCurrency(transactions);
    insights.push({
      id         : 'finance-pattern',
      type       : 'finance',
      title      : ui.financeTitle,
      description: ui.financeDesc(topCurrency),
      priority   : 'low',
      actionLabel: ui.financeAction,
    });
  }

  insights.push({
    id         : 'growth-loop',
    type       : 'growth',
    title      : ui.growthTitle,
    description: ui.growthDesc,
    priority   : 'low',
    actionLabel: ui.growthAction,
  });

  return {
    productivityScore: score,
    insights,
    todayPlan        : buildTodayPlan(notes, debts, ui),
    suggestedTags    : suggestGlobalTags(notes),
  };
}

export function generateSmartSummary(
  notes       : Note[],
  debts       : DebtCredit[],
  transactions: Transaction[]
): string {
  const lang   = getLang();
  const ui     = UI[lang];
  const report = buildAiContextReport(notes, debts, transactions);
  return [
    ui.reportHeader,
    '',
    `${ui.scoreLabel}\n${report.productivityScore}/100`,
    '',
    `${ui.insightsLabel}\n${report.insights.map(i => `- **${i.title}:** ${i.description}`).join('\n')}`,
    '',
    `${ui.planLabel}\n${report.todayPlan}`,
    '',
    `${ui.tagsLabel}\n${report.suggestedTags.map(t => `#${t}`).join(' ')}`,
  ].join('\n');
}

export function generateDebtReminderPack(debts: DebtCredit[]): string {
  const lang   = getLang();
  const ui     = UI[lang];
  const active = debts.filter(d => d.status !== 'paid');
  if (!active.length) return ui.noDebts;
  return active.map(item => {
    const remaining = item.amount - item.paidAmount;
    const due = new Date(item.dueDate).toLocaleDateString(lang === 'ar' ? 'ar-MA' : lang);
    return item.type === 'credit'
      ? ui.creditReminder(item.personName, remaining, item.currency, due)
      : ui.debtReminder(item.personName, remaining, item.currency, due);
  }).join('\n');
}

export function inferTags(text: string): string[] {
  const tags = new Set<string>();
  if (/مال|درهم|دولار|فاتورة|دين|قرض|استثمار|عملة/i.test(text))    tags.add('مالية');
  if (/مشروع|تطبيق|برمجة|تصميم|تطوير|كود/i.test(text))              tags.add('تطوير');
  if (/اجتماع|فريق|عميل|عمل/i.test(text))                           tags.add('عمل');
  if (/فكرة|ابتكار|اقتراح|ميزة/i.test(text))                        tags.add('أفكار');
  if (/شراء|تسوق|قائمة|بيت/i.test(text))                            tags.add('شخصي');
  // English tags
  if (/money|finance|invoice|debt|loan|investment/i.test(text))       tags.add('finance');
  if (/project|app|code|design|develop/i.test(text))                  tags.add('development');
  if (/meeting|team|client|work/i.test(text))                         tags.add('work');
  if (/idea|innovation|feature|proposal/i.test(text))                 tags.add('ideas');
  importantWords.forEach(word => { if (text.includes(word)) tags.add('مهم'); });
  return Array.from(tags).slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════
// دوال Gemini مع Fallback
// ═══════════════════════════════════════════════════════════════════════

export async function aiSummarize(title: string, content: string): Promise<string> {
  try {
    return await geminiSummarize(title, content);
  } catch (err) {
    console.warn('[aiEngine] summarize fallback:', err);
    return content.split(/[.؟!\n]/).filter(Boolean).slice(0, 3).join('. ').trim() + '.';
  }
}

export async function aiExtractTags(title: string, content: string): Promise<string[]> {
  try {
    return await geminiExtractTags(title, content);
  } catch (err) {
    console.warn('[aiEngine] tags fallback:', err);
    return inferTags(`${title} ${content}`);
  }
}

export async function aiExtractTasks(
  title: string,
  content: string
): Promise<{ task: string; done: boolean }[]> {
  try {
    return await geminiExtractTasks(title, content);
  } catch (err) {
    console.warn('[aiEngine] tasks fallback:', err);
    return (content.match(/[-*]\s*(.+)/g) ?? []).map(t => ({
      task: t.replace(/^[-*]\s*/, ''),
      done: false,
    }));
  }
}

export async function aiGenerateDraft(
  rawText: string,
  style: 'professional' | 'friendly' | 'task' | 'message'
): Promise<string> {
  try {
    return await geminiGenerateDraft(rawText, style);
  } catch (err) {
    console.warn('[aiEngine] draft fallback:', err);
    return `## ${style}\n\n${rawText}\n\n> Generated locally (Gemini unavailable).`;
  }
}

export async function aiInterpretCommand(
  command: string,
  context: { noteCount: number; debtCount: number; taskCount: number }
): Promise<{ action: 'plan' | 'organize' | 'debt' | 'report' | 'draft' | 'unknown'; response: string }> {
  try {
    return await geminiInterpretCommand(command, context);
  } catch (err) {
    console.warn('[aiEngine] command fallback:', err);
    const ui = UI[getLang()];
    const n  = command.toLowerCase();
    if (/خطة|plan|اليوم|today|plan/i.test(n))      return { action: 'plan',     response: ui.planReply };
    if (/دين|ديون|debt|deuda/i.test(n))             return { action: 'debt',     response: ui.debtReply };
    if (/نظم|وسوم|organize|organiz/i.test(n))       return { action: 'organize', response: ui.organizeReply };
    if (/تقرير|report|informe|报告/i.test(n))        return { action: 'report',   response: ui.reportReply };
    return { action: 'unknown', response: ui.unknownCommand };
  }
}

export async function aiGenerateReport(
  notes       : Note[],
  debts       : DebtCredit[],
  transactions: Transaction[]
): Promise<string> {
  const tasks     = notes.flatMap(n => n.aiData?.extractedTasks ?? []);
  const tasksDone = tasks.filter(t => t.done).length;
  const topTags   = suggestGlobalTags(notes).slice(0, 5);
  const recentTitles = notes.slice(0, 5).map(n => n.title);
  try {
    return await geminiGenerateReport({
      noteCount: notes.length, tasksDone,
      tasksTotal: tasks.length,
      debtCount: debts.filter(d => d.status !== 'paid').length,
      topTags, recentTitles,
    });
  } catch (err) {
    console.warn('[aiEngine] report fallback:', err);
    return generateSmartSummary(notes, debts, transactions);
  }
}

export async function aiAnalyzeBrainDump(text: string) {
  try {
    return await geminiAnalyzeBrainDump(text);
  } catch (err) {
    console.warn('[aiEngine] brain dump fallback:', err);
    const lines = text.split('\n').filter(l => l.trim());
    return {
      urgentPriorities: lines.slice(0, 3).map(l => l.trim()),
      futureIdeas     : lines.slice(3, 5).map(l => l.trim()),
      anxietyRelief   : UI[getLang()].growthDesc,
    };
  }
}

export async function aiSuggestTitle(content: string): Promise<string> {
  try {
    return await geminiSuggestTitle(content);
  } catch (err) {
    console.warn('[aiEngine] suggest title fallback:', err);
    return content.replace(/[#*`>\n]/g, ' ').trim().split(' ').slice(0, 5).join(' ');
  }
}

export async function aiExpandIdea(idea: string): Promise<string> {
  try {
    return await geminiExpandIdea(idea);
  } catch (err) {
    console.warn('[aiEngine] expand idea fallback:', err);
    return UI[getLang()].expandTemplate(idea);
  }
}

export async function aiSpellCheck(text: string) {
  try {
    return await geminiSpellCheck(text);
  } catch (err) {
    console.warn('[aiEngine] spell check fallback:', err);
    return { corrected: text, changes: [] as string[] };
  }
}

export async function aiAskAboutNote(
  question   : string,
  noteContent: string,
  noteTitle  : string
): Promise<string> {
  try {
    return await geminiAskAboutNote(question, noteContent, noteTitle);
  } catch (err) {
    console.warn('[aiEngine] ask fallback:', err);
    return UI[getLang()].geminiUnavailable;
  }
}

export async function aiGenerateMeetingNotes(rawText: string): Promise<string> {
  try {
    return await geminiGenerateMeetingNotes(rawText);
  } catch (err) {
    console.warn('[aiEngine] meeting notes fallback:', err);
    return UI[getLang()].meetingTemplate(rawText);
  }
}

export async function aiTranslate(
  text      : string,
  targetLang: 'en' | 'fr' | 'es' | 'ar' | 'zh'
): Promise<string> {
  try {
    return await geminiTranslate(text, targetLang);
  } catch (err) {
    console.warn('[aiEngine] translate fallback:', err);
    throw err;
  }
}

export async function aiGenerateDebtMessage(
  personName: string,
  amount    : number,
  currency  : string,
  dueDate   : string,
  type      : 'credit' | 'debt'
): Promise<string> {
  try {
    return await geminiGenerateDebtMessage(personName, amount, currency, dueDate, type);
  } catch (err) {
    console.warn('[aiEngine] debt message fallback:', err);
    const remaining = `${amount} ${currency}`;
    const ui        = UI[getLang()];
    return type === 'credit'
      ? ui.creditReminder(personName, amount, currency, dueDate)
      : ui.debtReminder(personName, amount, currency, dueDate);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// دوال مساعدة
// ═══════════════════════════════════════════════════════════════════════

function getTaskCompletion(notes: Note[]) {
  const tasks = notes.flatMap(n => n.aiData?.extractedTasks ?? []);
  if (!tasks.length) return 0.35;
  return tasks.filter(t => t.done).length / tasks.length;
}

function daysUntil(date: string) {
  const due = new Date(date);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function getTopCurrency(transactions: Transaction[]) {
  const totals = transactions.reduce<Record<string, number>>((acc, item) => {
    acc[item.currency] = (acc[item.currency] ?? 0) + item.amount;
    return acc;
  }, {});
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'MAD';
}

function buildTodayPlan(
  notes  : Note[],
  debts  : DebtCredit[],
  ui     : typeof UI[AppLanguage]
) {
  const tasks  = notes
    .flatMap(n => n.aiData?.extractedTasks?.filter(t => !t.done).map(t => t.task) ?? [])
    .slice(0, 4);
  const urgent = debts
    .filter(d => d.status !== 'paid' && daysUntil(d.dueDate) <= 7)
    .slice(0, 2);
  const lines = [
    ...tasks.map(t => `- [ ] ${t}`),
    ...urgent.map(d => `- [ ] ${d.personName}: ${d.amount - d.paidAmount} ${d.currency}`),
  ];
  return lines.length ? lines.join('\n') : ui.todayPlaceholder;
}

function suggestGlobalTags(notes: Note[]) {
  const tags  = notes.flatMap(n => [...n.tags, ...inferTags(`${n.title} ${n.content}`)]);
  const count = tags.reduce<Record<string, number>>((acc, tag) => {
    acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 8);
}
