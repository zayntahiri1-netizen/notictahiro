/**
 * proactiveInsights.ts — محرك الرؤى الاستباقية لـ Tahiro AI
 * ─────────────────────────────────────────────────────────────────────
 * يحلّل بيانات المستخدم محلياً (بدون استدعاء AI — مجاني وفوري) ويُولّد
 * اقتراحات ذكية استباقية تظهر في نافذة المساعد. الهدف أن يبدو التطبيق
 * "عبقرياً واستباقياً": يلاحظ الأنماط ويقترح حلولاً قبل أن يطلبها المستخدم.
 *
 * كل رؤية تحتوي على:
 *  - عنوان قصير + وصف
 *  - أيقونة + لون أولوية
 *  - prompt جاهز يُرسَل للـ AI عند الضغط (يحوّل الرؤية لفعل حقيقي)
 */

import type { Note, DebtCredit, Transaction } from '../context/AppContext';
import type { AppLanguage } from '../i18n';

export interface ProactiveInsight {
  id: string;
  icon: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionPrompt: string; // يُرسَل للـ AI عند الضغط على الرؤية
}

interface InsightInput {
  notes: Note[];
  debtsCredits: DebtCredit[];
  transactions: Transaction[];
  language: AppLanguage;
}

const L = (lang: AppLanguage) => ({
  ar: {
    untaggedTitle: 'ملاحظات بلا تنظيم',
    untaggedDesc: (n: number) => `${n} ملاحظة تحتاج ملخصاً أو وسوماً ذكية.`,
    untaggedAction: 'نظّم ملاحظاتي غير المُصنّفة: اقترح وسوماً وملخصاً قصيراً لكل واحدة.',
    debtDueTitle: 'استحقاق مالي قريب',
    debtDueDesc: (n: number) => `${n} سجل دين/مدين يقترب من تاريخ الاستحقاق.`,
    debtDueAction: 'حلّل ديوني المستحقة قريباً ورتّبها حسب الأولوية، واقترح خطة سداد/تحصيل.',
    ideaTitle: 'أفكار تنتظر التطوير',
    ideaDesc: (n: number) => `لديك ${n} فكرة — حوّل إحداها لخطة عمل قابلة للتنفيذ.`,
    ideaAction: 'خذ أفكاري وطوّر أكثرها وعداً إلى خطة عمل مفصّلة بخطوات تنفيذية.',
    staleTitle: 'مهام معلّقة',
    staleDesc: (n: number) => `${n} ملاحظة فيها مهام غير مكتملة — لنحوّلها لخطة اليوم.`,
    staleAction: 'اجمع كل المهام غير المكتملة من ملاحظاتي ورتّبها في خطة عمل لهذا اليوم.',
    spendTitle: 'نمط إنفاق ملحوظ',
    spendDesc: 'لاحظت نمطاً في معاملاتك — دعني ألخّص مصاريفك.',
    spendAction: 'حلّل معاملاتي المالية الأخيرة: لخّص الإنفاق حسب الفئة واقترح أين يمكن التوفير.',
    planTitle: 'خطّط ليومك',
    planDesc: 'دعني أبني لك خطة منظّمة لليوم بناءً على ملاحظاتك.',
    planAction: 'بناءً على ملاحظاتي ومهامي وديوني، اقترح خطة منظّمة وواقعية لهذا اليوم.',
    summaryTitle: 'ملخص ذكي لملاحظاتك',
    summaryDesc: (n: number) => `لديك ${n} ملاحظة — دعني ألخّص أهم ما فيها.`,
    summaryAction: 'اقرأ كل ملاحظاتي وأعطني ملخصاً ذكياً لأهم المواضيع والأنماط والأولويات.',
  },
  en: {
    untaggedTitle: 'Unorganized notes',
    untaggedDesc: (n: number) => `${n} notes need a summary or smart tags.`,
    untaggedAction: 'Organize my untagged notes: suggest tags and a short summary for each.',
    debtDueTitle: 'Upcoming due date',
    debtDueDesc: (n: number) => `${n} debt/credit records nearing their due date.`,
    debtDueAction: 'Analyze my debts due soon, rank by priority, and suggest a payment/collection plan.',
    ideaTitle: 'Ideas awaiting development',
    ideaDesc: (n: number) => `You have ${n} ideas — turn the best one into an action plan.`,
    ideaAction: 'Take my ideas and develop the most promising one into a detailed actionable plan.',
    staleTitle: 'Pending tasks',
    staleDesc: (n: number) => `${n} notes have incomplete tasks — let's make a day plan.`,
    staleAction: 'Collect all incomplete tasks from my notes and arrange them into a plan for today.',
    spendTitle: 'Notable spending pattern',
    spendDesc: 'I noticed a pattern in your transactions — let me summarize your spending.',
    spendAction: 'Analyze my recent transactions: summarize spending by category and suggest savings.',
    planTitle: 'Plan your day',
    planDesc: 'Let me build you an organized plan for the day based on your notes.',
    planAction: 'Based on my notes, tasks, and debts, suggest an organized realistic plan for today.',
    summaryTitle: 'Smart summary of your notes',
    summaryDesc: (n: number) => `You have ${n} notes — let me summarize the key points.`,
    summaryAction: 'Read all my notes and give me a smart summary of the key topics, patterns, and priorities.',
  },
  es: {
    untaggedTitle: 'Notas sin organizar',
    untaggedDesc: (n: number) => `${n} notas necesitan resumen o etiquetas.`,
    untaggedAction: 'Organiza mis notas sin etiquetas: sugiere etiquetas y un resumen breve para cada una.',
    debtDueTitle: 'Vencimiento próximo',
    debtDueDesc: (n: number) => `${n} registros de deuda/crédito cerca de su vencimiento.`,
    debtDueAction: 'Analiza mis deudas próximas a vencer, ordénalas por prioridad y sugiere un plan.',
    ideaTitle: 'Ideas por desarrollar',
    ideaDesc: (n: number) => `Tienes ${n} ideas — convierte la mejor en un plan de acción.`,
    ideaAction: 'Toma mis ideas y desarrolla la más prometedora en un plan detallado y accionable.',
    staleTitle: 'Tareas pendientes',
    staleDesc: (n: number) => `${n} notas tienen tareas incompletas — hagamos un plan del día.`,
    staleAction: 'Reúne todas las tareas incompletas de mis notas y organízalas en un plan para hoy.',
    spendTitle: 'Patrón de gasto notable',
    spendDesc: 'Noté un patrón en tus transacciones — déjame resumir tus gastos.',
    spendAction: 'Analiza mis transacciones recientes: resume el gasto por categoría y sugiere ahorros.',
    planTitle: 'Planifica tu día',
    planDesc: 'Déjame crear un plan organizado para el día basado en tus notas.',
    planAction: 'Según mis notas, tareas y deudas, sugiere un plan organizado y realista para hoy.',
    summaryTitle: 'Resumen inteligente de tus notas',
    summaryDesc: (n: number) => `Tienes ${n} notas — déjame resumir los puntos clave.`,
    summaryAction: 'Lee todas mis notas y dame un resumen inteligente de los temas, patrones y prioridades.',
  },
  zh: {
    untaggedTitle: '未整理的笔记',
    untaggedDesc: (n: number) => `${n} 条笔记需要摘要或智能标签。`,
    untaggedAction: '整理我未加标签的笔记：为每条建议标签和简短摘要。',
    debtDueTitle: '即将到期',
    debtDueDesc: (n: number) => `${n} 条债务记录接近到期日。`,
    debtDueAction: '分析我即将到期的债务，按优先级排序，并建议还款/收款计划。',
    ideaTitle: '待开发的想法',
    ideaDesc: (n: number) => `你有 ${n} 个想法——把最好的变成行动计划。`,
    ideaAction: '从我的想法中，把最有前景的开发成详细可执行的计划。',
    staleTitle: '待办任务',
    staleDesc: (n: number) => `${n} 条笔记有未完成的任务——做个今日计划。`,
    staleAction: '收集我笔记中所有未完成的任务，整理成今天的计划。',
    spendTitle: '明显的消费模式',
    spendDesc: '我注意到你交易中的模式——让我总结你的支出。',
    spendAction: '分析我最近的交易：按类别总结支出并建议节省方法。',
    planTitle: '规划你的一天',
    planDesc: '让我根据你的笔记为你制定有条理的日程。',
    planAction: '根据我的笔记、任务和债务，为今天建议一个有条理、现实的计划。',
    summaryTitle: '笔记智能摘要',
    summaryDesc: (n: number) => `你有 ${n} 条笔记——让我总结要点。`,
    summaryAction: '阅读我所有的笔记，给我关于关键主题、模式和优先事项的智能摘要。',
  },
}[lang] ?? {} as never);

/** يحسب الأيام بين الآن وتاريخ معطى (موجب = مستقبل) */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return Infinity;
  return Math.ceil((target - Date.now()) / 86400000);
}

/** كاشف بسيط للمهام غير المكتملة في نص ماركداون (- [ ] أو • مع كلمات مهام) */
function hasIncompleteTasks(content: string): boolean {
  return /- \[ \]/.test(content) || /^\s*[-•*]\s+/m.test(content);
}

/**
 * يُولّد قائمة الرؤى الاستباقية مرتّبة حسب الأولوية. كلها محلية (لا AI).
 */
export function generateProactiveInsights(input: InsightInput): ProactiveInsight[] {
  const { notes, debtsCredits, transactions, language } = input;
  const t = L(language);
  const insights: ProactiveInsight[] = [];

  const openNotes = notes.filter(n => !n.isLocked);

  // 1) ديون مستحقة قريباً (أولوية عالية)
  const dueSoon = (debtsCredits ?? []).filter(
    d => d.status !== 'paid' && daysUntil(d.dueDate) <= 7 && daysUntil(d.dueDate) >= -3
  );
  if (dueSoon.length > 0) {
    insights.push({
      id: 'debt-due', icon: '⚠️', priority: 'high',
      title: t.debtDueTitle, description: t.debtDueDesc(dueSoon.length),
      actionPrompt: t.debtDueAction,
    });
  }

  // 2) مهام معلّقة (أولوية عالية)
  const withTasks = openNotes.filter(n => hasIncompleteTasks(n.content));
  if (withTasks.length >= 2) {
    insights.push({
      id: 'stale-tasks', icon: '🎯', priority: 'high',
      title: t.staleTitle, description: t.staleDesc(withTasks.length),
      actionPrompt: t.staleAction,
    });
  }

  // 3) ملاحظات بلا وسوم (أولوية متوسطة)
  const untagged = openNotes.filter(n => !n.tags || n.tags.length === 0);
  if (untagged.length >= 2) {
    insights.push({
      id: 'untagged', icon: '🏷️', priority: 'medium',
      title: t.untaggedTitle, description: t.untaggedDesc(untagged.length),
      actionPrompt: t.untaggedAction,
    });
  }

  // 4) أفكار تنتظر التطوير (أولوية متوسطة)
  const ideas = openNotes.filter(n => n.type === 'idea');
  if (ideas.length >= 1) {
    insights.push({
      id: 'develop-idea', icon: '💡', priority: 'medium',
      title: t.ideaTitle, description: t.ideaDesc(ideas.length),
      actionPrompt: t.ideaAction,
    });
  }

  // 5) تحليل الإنفاق (أولوية منخفضة)
  if ((transactions ?? []).length >= 3) {
    insights.push({
      id: 'spending', icon: '💰', priority: 'low',
      title: t.spendTitle, description: t.spendDesc,
      actionPrompt: t.spendAction,
    });
  }

  // 6) خطة اليوم (دائماً متاحة كاقتراح ودود إن كانت هناك بيانات)
  if (openNotes.length >= 2) {
    insights.push({
      id: 'plan-day', icon: '📅', priority: 'low',
      title: t.planTitle, description: t.planDesc,
      actionPrompt: t.planAction,
    });
  }

  // 7) ملخص ذكي (إن كان هناك عدد كافٍ من الملاحظات)
  if (openNotes.length >= 4) {
    insights.push({
      id: 'summary', icon: '📊', priority: 'low',
      title: t.summaryTitle, description: t.summaryDesc(openNotes.length),
      actionPrompt: t.summaryAction,
    });
  }

  // ترتيب: عالي ← متوسط ← منخفض، وحدّ أقصى 5 لتفادي الإغراق
  const order = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
}
