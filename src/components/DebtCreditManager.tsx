import { useState, useMemo } from 'react';
import { useApp, DebtCredit } from '../context/AppContext';
import PromptModal, { ConfirmModal } from './PromptModal';
import { exportCSV } from '../utils/exportData';
import { aiGenerateDebtMessage } from '../utils/aiEngine';
import { CaretSafeInput, CaretSafeTextarea } from './CaretSafe';

import ListenButton from './ListenButton';
interface DebtCreditManagerProps {
  onClose: () => void;
}

type DebtCreditFilterType = 'all' | 'debt' | 'credit';
type DebtCreditStatus = 'all' | 'pending' | 'partial' | 'paid';
type DebtCreditRecordStatus = 'pending' | 'partial' | 'paid';

export default function DebtCreditManager({ onClose }: DebtCreditManagerProps) {
  const { debtsCredits, darkMode, addDebtCredit, updateDebtCredit, deleteDebtCredit, language } = useApp();

  const DC = {
    ar: { header: 'الدائن والمدين', subtitle: 'نظام ذكي لإدارة الديون والمستحقات مع تذكيرات استباقية',
          addRecord: 'إضافة سجل', editRecord: '✏️ تعديل السجل', newRecord: '➕ سجل جديد',
          quickAdd: 'إضافة سريعة بنص عامي', quickAddHint: 'اكتب المعاملة المالية بعبارة بسيطة (مثال: "علي 500 درهم لمحمد بعد أسبوع") وسيتكفل الذكاء الاصطناعي بالباقي',
          quickPh: 'مثال: لي 2500 درهم عند محمد بعد 15 يوم...', processing: 'جاري...', quickBtn: 'إضافة سريعة',
          examples: 'أمثلة: "لي 1000 درهم عند أحمد"، "علي 500 درهم لمحمد بعد أسبوع"، "سلفني خالد 2000 درهم"', or: 'أو',
          manualAdd: 'إضافة يدوية مفصلة', iOwe: 'عليّ (مدين)', owedToMe: 'لي (دائن)', fullName: 'الاسم الكامل', namePh: 'الاسم الكامل',
          descPh: 'مثال: قرض سيارة، فاتورة...', statusPending: 'معلق', statusPartial: 'مدفوع جزئياً', statusPaid: 'مسدد بالكامل',
          proactiveAlarms: '🔔 المنبهات الاستباقية (أيام قبل الاستحقاق)', dailyAlarm: '🔁 منبه يومي', dailyAlarmDesc: 'تذكير يومي حتى تاريخ الاستحقاق',
          addTagPh: 'إضافة وسم...', cancel: 'إلغاء', update: 'تحديث', save: 'حفظ', otherDetails: 'أي تفاصيل أخرى...', personLbl: 'اسم الشخص', amountLbl: 'المبلغ', currencyLbl: 'العملة', descLbl: 'الوصف / السبب', dueDateLbl: 'تاريخ الاستحقاق', statusLbl: 'الحالة', paidLbl: 'المبلغ المدفوع', tagsLbl: 'وسوم', notesLbl: 'ملاحظات إضافية',
          netOwe: '⬇️ عليّ (مدين)', netOwed: '⬆️ لي (دائن)', net: '📊 الصافي',
          all: 'الكل', creditF: '⬆️ دائن', debtF: '⬇️ مدين', pendingF: 'معلق', partialF: 'جزئي', paidF: 'مسدد', searchPh: '🔍 بحث...',
          noRecords: 'لا توجد سجلات', startAdd: 'ابدأ بإضافة أول سجل دين أو قرض', noMatch: 'لا توجد نتائج مطابقة',
          creditLabel: 'لي (دائن)', debtLabel: 'عليّ (مدين)', remaining: 'متبقي', paid: 'مدفوع',
          beforeDays: (a: number) => `🔔 قبل ${a} أيام`, dailyAt: (t: string) => `🔁 يومي ${t}`,
          recordPayment: 'تسجيل دفعة', edit: 'تعديل', delete: 'حذف', genMsg: 'توليد رسالة تذكير ذكية',
          reminderMsg: 'رسالة تذكير', copy: '{D.copy}', share: '{D.share}', exportBtn: 'تصدير', groupBtn: 'حسب الشخص',
          delTitle: 'حذف السجل', delMsg: 'هل تريد حذف هذا السجل المالي نهائياً؟ لن تتمكن من استعادته.', delConfirm: '🗑️ نعم، احذف', delCancel: 'تراجع',
          payTo: (n: string) => `دفعة لـ ${n}`, payTitle: 'تسجيل دفعة', payRemaining: (a: number, c: string) => `المبلغ المتبقي: ${a} ${c}`,
          payPh: 'أدخل المبلغ المدفوع...', payConfirm: '💵 تسجيل الدفعة',
          overdue: '⚠️ متأخر!', beforeN: (n: number) => `🔔 قبل ${n} أيام!`, daysLeft: (d: number) => `⏰ ${d} أيام متبقية`,
          daysSoon: (d: number) => `📅 ${d} أيام`, daysOk: (d: number) => `${d} يوم`,
          before30: 'قبل 30 يوم', before14: 'قبل 14 يوم', before7: 'قبل أسبوع', before3: 'قبل 3 أيام', before1: 'قبل يوم',
          unknownPerson: 'شخص غير محدد', autoCreated: (t: string) => `تم إنشاؤه تلقائياً من: "${t}"`,
          tagCredit: 'دائن', tagDebt: 'مدين', tagQuick: 'إضافة_سريعة', defaultDesc: (t: string, n: string) => `دين ${t === 'credit' ? 'لي' : 'علي'} ${n}` },
    en: { header: 'Debt & credit', subtitle: 'A smart system to manage debts and dues with proactive reminders',
          addRecord: 'Add record', editRecord: '✏️ Edit record', newRecord: '➕ New record',
          quickAdd: 'Quick add in plain text', quickAddHint: 'Write the transaction in simple words (e.g. "I owe 500 to Mohamed in a week") and the AI handles the rest',
          quickPh: 'e.g. Ahmed owes me 2500 in 15 days...', processing: 'Working...', quickBtn: 'Quick add',
          examples: 'Examples: "Ahmed owes me 1000", "I owe 500 to Mohamed in a week", "Khaled lent me 2000"', or: 'or',
          manualAdd: 'Detailed manual add', iOwe: 'I owe (debtor)', owedToMe: 'Owed to me (creditor)', fullName: 'Full name', namePh: 'Full name',
          descPh: 'e.g. car loan, invoice...', statusPending: 'Pending', statusPartial: 'Partially paid', statusPaid: 'Fully paid',
          proactiveAlarms: '🔔 Proactive alarms (days before due)', dailyAlarm: '🔁 Daily alarm', dailyAlarmDesc: 'Daily reminder until the due date',
          addTagPh: 'Add tag...', cancel: 'Cancel', update: 'Update', save: 'Save', otherDetails: 'Any other details...', personLbl: 'Person name', amountLbl: 'Amount', currencyLbl: 'Currency', descLbl: 'Description / reason', dueDateLbl: 'Due date', statusLbl: 'Status', paidLbl: 'Amount paid', tagsLbl: 'Tags', notesLbl: 'Additional notes',
          netOwe: '⬇️ I owe (debtor)', netOwed: '⬆️ Owed to me (creditor)', net: '📊 Net',
          all: 'All', creditF: '⬆️ Creditor', debtF: '⬇️ Debtor', pendingF: 'Pending', partialF: 'Partial', paidF: 'Paid', searchPh: '🔍 Search...',
          noRecords: 'No records', startAdd: 'Start by adding your first debt or loan', noMatch: 'No matching results',
          creditLabel: 'Owed to me (creditor)', debtLabel: 'I owe (debtor)', remaining: 'Remaining', paid: 'Paid',
          beforeDays: (a: number) => `🔔 ${a} days before`, dailyAt: (t: string) => `🔁 Daily ${t}`,
          recordPayment: 'Record payment', edit: 'Edit', delete: 'Delete', genMsg: 'Generate smart reminder message',
          reminderMsg: 'Reminder message', copy: '📋 Copy', share: '📤 Share', exportBtn: 'Export', groupBtn: 'By person',
          delTitle: 'Delete record', delMsg: 'Delete this financial record permanently? You will not be able to restore it.', delConfirm: '🗑️ Yes, delete', delCancel: 'Undo',
          payTo: (n: string) => `Payment to ${n}`, payTitle: 'Record payment', payRemaining: (a: number, c: string) => `Remaining amount: ${a} ${c}`,
          payPh: 'Enter the amount paid...', payConfirm: '💵 Record payment',
          overdue: '⚠️ Overdue!', beforeN: (n: number) => `🔔 ${n} days before!`, daysLeft: (d: number) => `⏰ ${d} days left`,
          daysSoon: (d: number) => `📅 ${d} days`, daysOk: (d: number) => `${d} days`,
          before30: '30 days before', before14: '14 days before', before7: 'a week before', before3: '3 days before', before1: 'a day before',
          unknownPerson: 'Unspecified person', autoCreated: (t: string) => `Auto-created from: "${t}"`,
          tagCredit: 'creditor', tagDebt: 'debtor', tagQuick: 'quick_add', defaultDesc: (t: string, n: string) => `${t === 'credit' ? 'Owed to me by' : 'I owe'} ${n}` },
    es: { header: 'Deudas y créditos', subtitle: 'Un sistema inteligente para gestionar deudas y cobros con recordatorios proactivos',
          addRecord: 'Añadir registro', editRecord: '✏️ Editar registro', newRecord: '➕ Nuevo registro',
          quickAdd: 'Añadir rápido en texto', quickAddHint: 'Escribe la transacción en palabras simples (ej. "debo 500 a Mohamed en una semana") y la IA hace el resto',
          quickPh: 'ej. Ahmed me debe 2500 en 15 días...', processing: 'Procesando...', quickBtn: 'Añadir rápido',
          examples: 'Ejemplos: "Ahmed me debe 1000", "debo 500 a Mohamed en una semana", "Khaled me prestó 2000"', or: 'o',
          manualAdd: 'Añadir manual detallado', iOwe: 'Debo (deudor)', owedToMe: 'Me deben (acreedor)', fullName: 'Nombre completo', namePh: 'Nombre completo',
          descPh: 'ej. préstamo de coche, factura...', statusPending: 'Pendiente', statusPartial: 'Pagado parcialmente', statusPaid: 'Totalmente pagado',
          proactiveAlarms: '🔔 Alarmas proactivas (días antes del vencimiento)', dailyAlarm: '🔁 Alarma diaria', dailyAlarmDesc: 'Recordatorio diario hasta la fecha de vencimiento',
          addTagPh: 'Añadir etiqueta...', cancel: 'Cancelar', update: 'Actualizar', save: 'Guardar', otherDetails: 'Cualquier otro detalle...', personLbl: 'Nombre de la persona', amountLbl: 'Monto', currencyLbl: 'Moneda', descLbl: 'Descripción / motivo', dueDateLbl: 'Fecha de vencimiento', statusLbl: 'Estado', paidLbl: 'Monto pagado', tagsLbl: 'Etiquetas', notesLbl: 'Notas adicionales',
          netOwe: '⬇️ Debo (deudor)', netOwed: '⬆️ Me deben (acreedor)', net: '📊 Neto',
          all: 'Todos', creditF: '⬆️ Acreedor', debtF: '⬇️ Deudor', pendingF: 'Pendiente', partialF: 'Parcial', paidF: 'Pagado', searchPh: '🔍 Buscar...',
          noRecords: 'Sin registros', startAdd: 'Empieza añadiendo tu primera deuda o préstamo', noMatch: 'No hay resultados',
          creditLabel: 'Me deben (acreedor)', debtLabel: 'Debo (deudor)', remaining: 'Restante', paid: 'Pagado',
          beforeDays: (a: number) => `🔔 ${a} días antes`, dailyAt: (t: string) => `🔁 Diario ${t}`,
          recordPayment: 'Registrar pago', edit: 'Editar', delete: 'Eliminar', genMsg: 'Generar mensaje de recordatorio',
          reminderMsg: 'Mensaje de recordatorio', copy: '📋 Copiar', share: '📤 Compartir', exportBtn: 'Exportar', groupBtn: 'Por persona',
          delTitle: 'Eliminar registro', delMsg: '¿Eliminar este registro financiero permanentemente? No podrás restaurarlo.', delConfirm: '🗑️ Sí, eliminar', delCancel: 'Deshacer',
          payTo: (n: string) => `Pago a ${n}`, payTitle: 'Registrar pago', payRemaining: (a: number, c: string) => `Monto restante: ${a} ${c}`,
          payPh: 'Ingresa el monto pagado...', payConfirm: '💵 Registrar pago',
          overdue: '⚠️ ¡Vencido!', beforeN: (n: number) => `🔔 ${n} días antes!`, daysLeft: (d: number) => `⏰ ${d} días restantes`,
          daysSoon: (d: number) => `📅 ${d} días`, daysOk: (d: number) => `${d} días`,
          before30: '30 días antes', before14: '14 días antes', before7: 'una semana antes', before3: '3 días antes', before1: 'un día antes',
          unknownPerson: 'Persona no especificada', autoCreated: (t: string) => `Creado automáticamente de: "${t}"`,
          tagCredit: 'acreedor', tagDebt: 'deudor', tagQuick: 'añadido_rápido', defaultDesc: (t: string, n: string) => `${t === 'credit' ? 'Me debe' : 'Debo a'} ${n}` },
    zh: { header: '应收与应付', subtitle: '智能管理债务和应收款，带有主动提醒',
          addRecord: '添加记录', editRecord: '✏️ 编辑记录', newRecord: '➕ 新记录',
          quickAdd: '用文字快速添加', quickAddHint: '用简单的话写下交易（例如"我一周后欠穆罕默德 500"），AI 会处理其余部分',
          quickPh: '例如：Ahmed 15 天后欠我 2500...', processing: '处理中...', quickBtn: '快速添加',
          examples: '例如："Ahmed 欠我 1000"、"我一周后欠穆罕默德 500"、"Khaled 借给我 2000"', or: '或',
          manualAdd: '详细手动添加', iOwe: '我欠（债务人）', owedToMe: '欠我（债权人）', fullName: '全名', namePh: '全名',
          descPh: '例如：车贷、账单...', statusPending: '待处理', statusPartial: '部分已付', statusPaid: '已全部付清',
          proactiveAlarms: '🔔 主动提醒（到期前几天）', dailyAlarm: '🔁 每日提醒', dailyAlarmDesc: '每日提醒直到到期日',
          addTagPh: '添加标签...', cancel: '取消', update: '更新', save: '保存', otherDetails: '任何其他细节...', personLbl: '人名', amountLbl: '金额', currencyLbl: '货币', descLbl: '描述 / 原因', dueDateLbl: '到期日', statusLbl: '状态', paidLbl: '已付金额', tagsLbl: '标签', notesLbl: '附加备注',
          netOwe: '⬇️ 我欠（债务人）', netOwed: '⬆️ 欠我（债权人）', net: '📊 净额',
          all: '全部', creditF: '⬆️ 债权人', debtF: '⬇️ 债务人', pendingF: '待处理', partialF: '部分', paidF: '已付', searchPh: '🔍 搜索...',
          noRecords: '没有记录', startAdd: '从添加第一笔债务或贷款开始', noMatch: '没有匹配的结果',
          creditLabel: '欠我（债权人）', debtLabel: '我欠（债务人）', remaining: '剩余', paid: '已付',
          beforeDays: (a: number) => `🔔 提前 ${a} 天`, dailyAt: (t: string) => `🔁 每日 ${t}`,
          recordPayment: '记录付款', edit: '编辑', delete: '删除', genMsg: '生成智能提醒消息',
          reminderMsg: '提醒消息', copy: '📋 复制', share: '📤 分享', exportBtn: '导出', groupBtn: '按人',
          delTitle: '删除记录', delMsg: '永久删除此财务记录？您将无法恢复。', delConfirm: '🗑️ 是，删除', delCancel: '撤销',
          payTo: (n: string) => `向 ${n} 付款`, payTitle: '记录付款', payRemaining: (a: number, c: string) => `剩余金额：${a} ${c}`,
          payPh: '输入已付金额...', payConfirm: '💵 记录付款',
          overdue: '⚠️ 已逾期！', beforeN: (n: number) => `🔔 提前 ${n} 天！`, daysLeft: (d: number) => `⏰ 剩余 ${d} 天`,
          daysSoon: (d: number) => `📅 ${d} 天`, daysOk: (d: number) => `${d} 天`,
          before30: '提前 30 天', before14: '提前 14 天', before7: '提前一周', before3: '提前 3 天', before1: '提前一天',
          unknownPerson: '未指定的人', autoCreated: (t: string) => `自动创建于："${t}"`,
          tagCredit: '债权人', tagDebt: '债务人', tagQuick: '快速添加', defaultDesc: (t: string, n: string) => `${t === 'credit' ? '欠我' : '我欠'} ${n}` },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? null;
  const D = DC ?? {
    header: 'Debt & credit', subtitle: 'A smart system to manage debts and dues with proactive reminders',
    addRecord: 'Add record', editRecord: '✏️ Edit record', newRecord: '➕ New record',
    quickAdd: 'Quick add in plain text', quickAddHint: 'Write the transaction in simple words and the AI handles the rest',
    quickPh: 'e.g. Ahmed owes me 2500 in 15 days...', processing: 'Working...', quickBtn: 'Quick add',
    examples: 'Examples: "Ahmed owes me 1000", "I owe 500 to Mohamed in a week"', or: 'or',
    manualAdd: 'Detailed manual add', iOwe: 'I owe (debtor)', owedToMe: 'Owed to me (creditor)', fullName: 'Full name', namePh: 'Full name',
    descPh: 'e.g. car loan, invoice...', statusPending: 'Pending', statusPartial: 'Partially paid', statusPaid: 'Fully paid',
    proactiveAlarms: '🔔 Proactive alarms (days before due)', dailyAlarm: '🔁 Daily alarm', dailyAlarmDesc: 'Daily reminder until the due date',
    addTagPh: 'Add tag...', cancel: 'Cancel', update: 'Update', save: 'Save', otherDetails: 'Any other details...', personLbl: 'Person name', amountLbl: 'Amount', currencyLbl: 'Currency', descLbl: 'Description / reason', dueDateLbl: 'Due date', statusLbl: 'Status', paidLbl: 'Amount paid', tagsLbl: 'Tags', notesLbl: 'Additional notes',
    netOwe: '⬇️ I owe (debtor)', netOwed: '⬆️ Owed to me (creditor)', net: '📊 Net',
    all: 'All', creditF: '⬆️ Creditor', debtF: '⬇️ Debtor', pendingF: 'Pending', partialF: 'Partial', paidF: 'Paid', searchPh: '🔍 Search...',
    noRecords: 'No records', startAdd: 'Start by adding your first debt or loan', noMatch: 'No matching results',
    creditLabel: 'Owed to me (creditor)', debtLabel: 'I owe (debtor)', remaining: 'Remaining', paid: 'Paid',
    beforeDays: (a: number) => `🔔 ${a} days before`, dailyAt: (t: string) => `🔁 Daily ${t}`,
    recordPayment: 'Record payment', edit: 'Edit', delete: 'Delete', genMsg: 'Generate smart reminder message',
    reminderMsg: 'Reminder message', copy: '📋 Copy', share: '📤 Share', exportBtn: 'Export', groupBtn: 'By person',
    delTitle: 'Delete record', delMsg: 'Delete this financial record permanently? You will not be able to restore it.', delConfirm: '🗑️ Yes, delete', delCancel: 'Undo',
    payTo: (n: string) => `Payment to ${n}`, payTitle: 'Record payment', payRemaining: (a: number, c: string) => `Remaining amount: ${a} ${c}`,
    payPh: 'Enter the amount paid...', payConfirm: '💵 Record payment',
    overdue: '⚠️ Overdue!', beforeN: (n: number) => `🔔 ${n} days before!`, daysLeft: (d: number) => `⏰ ${d} days left`,
    daysSoon: (d: number) => `📅 ${d} days`, daysOk: (d: number) => `${d} days`,
    before30: '30 days before', before14: '14 days before', before7: 'a week before', before3: '3 days before', before1: 'a day before',
    unknownPerson: 'Unspecified person', autoCreated: (t: string) => `Auto-created from: "${t}"`,
    tagCredit: 'creditor', tagDebt: 'debtor', tagQuick: 'quick_add', defaultDesc: (t: string, n: string) => `${t === 'credit' ? 'Owed to me by' : 'I owe'} ${n}` };
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiMsgFor, setAiMsgFor] = useState<string | null>(null); // id السجل الجاري توليد رسالته
  const [aiMsg, setAiMsg] = useState<{ id: string; text: string } | null>(null);
  const [filterType, setFilterType] = useState<DebtCreditFilterType>('all');
  const [groupByPerson, setGroupByPerson] = useState(false);
  const [filterStatus, setFilterStatus] = useState<DebtCreditStatus>('all');
  const [searchPerson, setSearchPerson] = useState('');

  // نموذج الإدخال
  const [personName, setPersonName] = useState('');
  const [dcType, setDcType] = useState<'debt' | 'credit'>('debt');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<DebtCreditRecordStatus>('pending');
  const [paidAmount, setPaidAmount] = useState('0');
  const [proactiveAlarms, setProactiveAlarms] = useState<number[]>([7, 3, 1]);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('09:00');
  const [dcTags, setDcTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dcNotes, setDcNotes] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [isQuickProcessing, setIsQuickProcessing] = useState(false);
  
  // النوافذ المنبثقة الفاخرة
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<DebtCredit | null>(null);

  // الفلترة والفرز
  const filteredList = useMemo(() => {
    let list = [...debtsCredits];
    
    if (filterType !== 'all') list = list.filter(d => d.type === filterType);
    if (filterStatus !== 'all') list = list.filter(d => d.status === filterStatus);
    if (searchPerson) {
      const q = searchPerson.toLowerCase();
      list = list.filter(d => 
        d.personName.toLowerCase().includes(q) || 
        d.description.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // فرز: الأقرب للاستحقاق أولاً
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return list;
  }, [debtsCredits, filterType, filterStatus, searchPerson]);

  // المجاميع
  const totals = useMemo(() => {
    const debtTotal = debtsCredits.filter(d => d.type === 'debt' && d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    const creditTotal = debtsCredits.filter(d => d.type === 'credit' && d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    return { debtTotal, creditTotal, net: creditTotal - debtTotal };
  }, [debtsCredits]);

  // ─── تصدير الديون كملف CSV ────────────────────────────────────────
  const handleExportDebts = async () => {
    if (debtsCredits.length === 0) return;
    const headers = [D.personLbl, 'النوع', D.amountLbl, 'العملة', D.paidLbl, 'المتبقي', D.statusLbl, D.dueDateLbl, D.descLbl];
    const rows = debtsCredits.map(d => [
      d.personName,
      d.type === 'debt' ? 'مدين (عليك)' : 'دائن (لك)',
      d.amount,
      d.currency,
      d.paidAmount,
      d.amount - d.paidAmount,
      d.status === 'paid' ? 'مسدد' : d.status === 'partial' ? 'جزئي' : 'معلق',
      new Date(d.dueDate).toLocaleDateString('ar-MA'),
      d.description,
    ]);
    await exportCSV(`Notic-Debts-${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  // تحرير تسجيل
  const startEdit = (dc: DebtCredit) => {
    setEditingId(dc.id);
    setPersonName(dc.personName);
    setDcType(dc.type);
    setAmount(dc.amount.toString());
    setCurrency(dc.currency);
    setDescription(dc.description);
    setDueDate(new Date(dc.dueDate).toISOString().split('T')[0]);
    setStatus(dc.status);
    setPaidAmount(dc.paidAmount.toString());
    setProactiveAlarms([...dc.proactiveAlarms]);
    setDailyReminder(dc.dailyReminder);
    setDailyReminderTime(dc.dailyReminderTime);
    setDcTags([...dc.tags]);
    setDcNotes(dc.notes);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setPersonName('');
    setDcType('debt');
    setAmount('');
    setCurrency('MAD');
    setDescription('');
    setDueDate('');
    setStatus('pending');
    setPaidAmount('0');
    setProactiveAlarms([7, 3, 1]);
    setDailyReminder(true);
    setDailyReminderTime('09:00');
    setDcTags([]);
    setTagInput('');
    setDcNotes('');
    setShowForm(false);
  };

  const handleSave = () => {
    if (!personName.trim() || !amount || !dueDate) return;
    const parsedAmount = parseFloat(amount);
    // حماية من NaN — مبلغ غير رقمي يفسد الإحصائيات والإشعارات
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const data = {
      personName: personName.trim(),
      type: dcType,
      amount: parsedAmount,
      currency,
      description: description.trim(),
      dueDate: new Date(dueDate).toISOString(),
      status,
      paidAmount: parseFloat(paidAmount) || 0,
      proactiveAlarms,
      dailyReminder,
      dailyReminderTime,
      tags: dcTags,
      notes: dcNotes.trim()
    };

    if (editingId) {
      updateDebtCredit(editingId, data);
    } else {
      addDebtCredit(data);
    }
    resetForm();
  };

  // الإضافة السريعة بالذكاء الاصطناعي
  const handleQuickAdd = () => {
    if (!quickInput.trim()) return;
    setIsQuickProcessing(true);

    setTimeout(() => {
      const text = quickInput.trim();
      
      // تحليل النص
      let personName = '';
      let type: 'debt' | 'credit' = 'debt';
      let amount = 0;
      let currency = 'MAD';
      let description = text;
      let dueDays = 30; // افتراضي 30 يوم

      // استخراج المبلغ
      const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:درهم|دولار|يورو|mad|usd|eur|\$|€)?/i);
      if (amountMatch) {
        amount = parseFloat(amountMatch[1]);
      }

      // استخراج العملة
      if (/دولار|usd|dollar|dolar|\$/i.test(text)) currency = 'USD';
      else if (/يورو|eur|euro|€/i.test(text)) currency = 'EUR';
      else currency = 'MAD';

      // تحديد النوع (لي أو عليّ)
      if (/لي|لـي|دائن|سلفت|أعطيت|سلف|دين لي|owes me|owe me|lent|me debe|prestó|欠我|借给我/i.test(text)) {
        type = 'credit';
      } else if (/علي|عليا|مدين|استلفت|أخذت|دين علي|i owe|borrowed|debo|我欠/i.test(text)) {
        type = 'debt';
      }

      // استخراج الاسم
      const namePatterns = [
        /(?:لي|لـي|علي|عليا)\s+(?:عند|من|لـ)\s+([^\s\d]+(?:\s+[^\s\d]+)?)/i,
        /([^\s\d]+(?:\s+[^\s\d]+)?)\s+(?:دين|سلف|قرض)/i,
        /(?:مع|من)\s+([^\s\d]+(?:\s+[^\s\d]+)?)/i,
      ];
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          personName = match[1].trim();
          break;
        }
      }
      if (!personName) personName = D.unknownPerson;

      // استخراج المدة
      const daysMatch = text.match(/(\d+)\s*(?:يوم|أيام|يوماً)/i);
      const weeksMatch = text.match(/(\d+)\s*(?:أسبوع|أسابيع|اسبوع)/i);
      const monthsMatch = text.match(/(\d+)\s*(?:شهر|أشهر|شهور)/i);
      
      if (daysMatch) dueDays = parseInt(daysMatch[1]);
      else if (weeksMatch) dueDays = parseInt(weeksMatch[1]) * 7;
      else if (monthsMatch) dueDays = parseInt(monthsMatch[1]) * 30;

      // تاريخ الاستحقاق
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      // تنظيف الوصف
      description = text
        .replace(/\d+(?:\.\d+)?\s*(?:درهم|دولار|يورو|mad|usd|eur|\$|€)/gi, '')
        .replace(/\d+\s*(?:يوم|أيام|أسبوع|أسابيع|شهر|أشهر)/gi, '')
        .replace(/(لي|لـي|علي|عليا|دائن|مدين|سلف|دين|قرض|من|عند|مع)/gi, '')
        .trim() || D.defaultDesc(type, personName);

      // حماية: لا نُضيف سجلاً بمبلغ صفر — معناه أن الـ regex لم يستخرج رقماً
      if (!Number.isFinite(amount) || amount <= 0) {
        setQuickInput('');
        setIsQuickProcessing(false);
        return;
      }

      // إضافة السجل
      addDebtCredit({
        personName,
        type,
        amount,
        currency,
        description,
        dueDate: dueDate.toISOString(),
        status: 'pending',
        paidAmount: 0,
        proactiveAlarms: [7, 3, 1],
        dailyReminder: true,
        dailyReminderTime: '09:00',
        tags: [type === 'credit' ? D.tagCredit : D.tagDebt, D.tagQuick],
        notes: D.autoCreated(text),
      });

      setQuickInput('');
      setIsQuickProcessing(false);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handlePay = (dc: DebtCredit) => {
    if (dc.status === 'paid') return;
    setPayTarget(dc);
  };

  const confirmPayment = (value: string) => {
    if (!payTarget) return;
    const paid = parseFloat(value);
    if (isNaN(paid) || paid <= 0) return;
    const newPaid = payTarget.paidAmount + paid;
    const newStatus: 'pending' | 'partial' | 'paid' = newPaid >= payTarget.amount ? 'paid' : 'partial';
    updateDebtCredit(payTarget.id, { paidAmount: newPaid, status: newStatus });
    setPayTarget(null);
  };

  // حساب الأيام المتبقية
  const daysRemaining = (dueDateStr: string) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - now.getTime()) / 86400000);
  };

  // فحص اقتراب استحقاق المنبهات الاستباقية
  const getAlarmStatus = (dc: DebtCredit) => {
    if (dc.status === 'paid') return null;
    const days = daysRemaining(dc.dueDate);
    
    // هل هناك منبه استباقي لليوم؟
    const activeAlarms = dc.proactiveAlarms.filter(a => a === days || a === days + 1);
    
    if (days <= 0) return { type: 'overdue' as const, label: D.overdue, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' };
    if (activeAlarms.length > 0) return { type: 'proactive' as const, label: D.beforeN(activeAlarms[0].daysBefore), color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' };
    if (days <= 3) return { type: 'urgent' as const, label: D.daysLeft(days), color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' };
    if (days <= 7) return { type: 'soon' as const, label: D.daysSoon(days), color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30' };
    return { type: 'ok' as const, label: D.daysOk(days), color: 'text-gray-400', bg: '' };
  };

  // تنسيق التاريخ
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-MA', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const alarmOptions = [
    { value: 30, label: D.before30 },
    { value: 14, label: D.before14 },
    { value: 7, label: D.before7 },
    { value: 3, label: D.before3 },
    { value: 1, label: D.before1 },
  ];

  // بطاقة سجل دين/مدين — دالة مشتركة (تُستخدم في العرض العادي والمُجمّع)
  const renderRecordCard = (dc: DebtCredit, alarm: ReturnType<typeof getAlarmStatus>, progress: number, remainingAmount: number) => (
                    <div key={dc.id}
                      className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                        alarm?.bg || (darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')
                      } ${dc.status === 'paid' ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-3">
                        {/* الأيقونة والنوع */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                          dc.type === 'credit' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {dc.type === 'credit' ? '💰' : '💸'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {dc.personName}
                            </h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              dc.type === 'credit' 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            }`}>
                              {dc.type === 'credit' ? D.creditLabel : D.debtLabel}
                            </span>
                            {alarm && alarm.type !== 'ok' && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alarm.bg} ${alarm.color}`}>
                                {alarm.label}
                              </span>
                            )}
                          </div>

                          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {dc.description}
                          </p>

                          {/* المبلغ والتاريخ */}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="font-bold">
                              <span className={dc.type === 'credit' ? 'text-emerald-500' : 'text-red-500'}>
                                {dc.amount} {dc.currency}
                              </span>
                            </span>
                            {dc.status !== 'paid' && (
                              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {D.remaining}: {remainingAmount} {dc.currency}
                              </span>
                            )}
                            {dc.paidAmount > 0 && (
                              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                                {D.paid}: {dc.paidAmount} {dc.currency}
                              </span>
                            )}
                            <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                              📅 {formatDate(dc.dueDate)}
                            </span>
                          </div>

                          {/* شريط التقدم */}
                          {progress > 0 && progress < 100 && (
                            <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div 
                                className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}

                          {/* منبهات استباقية */}
                          {dc.proactiveAlarms.length > 0 && dc.status !== 'paid' && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {dc.proactiveAlarms.map(a => (
                                <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {D.beforeDays(a)}
                                </span>
                              ))}
                              {dc.dailyReminder && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  darkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                                }`}>
                                  {D.dailyAt(dc.dailyReminderTime)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* الوسوم */}
                          {dc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {dc.tags.map((t, i) => (
                                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* أزرار التحكم */}
                        <div className="flex flex-col gap-1">
                          {dc.status !== 'paid' && (
                            <button onClick={() => handlePay(dc)}
                              className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs transition-colors"
                              title={D.recordPayment}>
                              💰
                            </button>
                          )}
                          <button onClick={() => startEdit(dc)}
                            className={`p-2 rounded-lg text-xs transition-colors ${
                              darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                            }`} title={D.edit}>
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(dc.id)}
                            className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-500 text-xs transition-colors"
                            title={D.delete}>
                            🗑️
                          </button>
                          {dc.status !== 'paid' && (
                            <button
                              onClick={async () => {
                                if (aiMsgFor) return;
                                setAiMsgFor(dc.id);
                                try {
                                  const localeMap: Record<string, string> = { ar: 'ar-MA', en: 'en-US', es: 'es-ES', zh: 'zh-CN' };
                                  const text = await aiGenerateDebtMessage(
                                    dc.personName,
                                    dc.amount - dc.paidAmount,
                                    dc.currency,
                                    new Date(dc.dueDate).toLocaleDateString(localeMap[language] ?? 'en-US'),
                                    dc.type
                                  );
                                  setAiMsg({ id: dc.id, text });
                                } finally {
                                  setAiMsgFor(null);
                                }
                              }}
                              disabled={aiMsgFor === dc.id}
                              className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-xs transition-colors disabled:opacity-50"
                              title={D.genMsg}>
                              {aiMsgFor === dc.id ? '⏳' : '✉️'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
  );

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-4xl max-h-[92vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(244,63,94,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              💳
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  Proactive Debt Tracker
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{D.header}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">{D.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl transition-all duration-300 font-bold flex items-center gap-2 text-white border border-white/30 shadow-lg hover:scale-105 active:scale-95">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {D.addRecord}
            </button>
            <ListenButton style="confident" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md border border-white/20 hover:rotate-90 transition-all duration-300 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* نموذج الإدخال */}
          {showForm && (
            <div className={`w-96 border-l overflow-y-auto p-5 space-y-4 ${
              darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {editingId ? D.editRecord : D.newRecord}
                </h3>
                <button onClick={resetForm} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  ✕
                </button>
              </div>

              {/* الإضافة السريعة بنص عامي */}
              {!editingId && (
                <div className={`p-4 rounded-2xl border-2 border-dashed ${
                  darkMode ? 'bg-rose-500/5 border-rose-500/30' : 'bg-rose-50 border-rose-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">✨</span>
                    <h4 className={`font-bold text-sm ${darkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                      {D.quickAdd}
                    </h4>
                  </div>
                  <p className={`text-[11px] mb-3 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {D.quickAddHint}
                  </p>
                  <div className="flex gap-2">
                    <CaretSafeInput
                      type="text"
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                      placeholder={D.quickPh}
                      disabled={isQuickProcessing}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                        darkMode
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-rose-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
                      }`}
                    />
                    <button
                      onClick={handleQuickAdd}
                      disabled={isQuickProcessing || !quickInput.trim()}
                      className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm whitespace-nowrap flex items-center gap-1.5"
                    >
                      {isQuickProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>{D.processing}</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>{D.quickBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className={`mt-2 text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {D.examples}
                  </div>
                </div>
              )}

              <div className={`flex items-center gap-2 ${!editingId ? 'my-2' : ''}`}>
                <div className={`h-px flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <span className={`text-[10px] px-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {editingId ? '' : D.or}
                </span>
                <div className={`h-px flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              </div>

              {!editingId && (
                <div className={`text-center -mt-1 mb-1`}>
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {D.manualAdd}
                  </span>
                </div>
              )}

              {/* النوع */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDcType('debt')}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    dcType === 'debt' 
                      ? 'border-red-500 bg-red-500/10 text-red-500 font-bold' 
                      : darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                  }`}>
                  <span className="block text-2xl mb-1">⬇️</span>
                  <span className="text-sm">{D.iOwe}</span>
                </button>
                <button onClick={() => setDcType('credit')}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    dcType === 'credit' 
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold' 
                      : darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                  }`}>
                  <span className="block text-2xl mb-1">⬆️</span>
                  <span className="text-sm">{D.owedToMe}</span>
                </button>
              </div>

              {/* اسم الشخص */}
              <div>
                <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.personLbl}</label>
                <CaretSafeInput type="text" value={personName} onChange={(e) => setPersonName(e.target.value)}
                  placeholder={D.namePh}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200'
                  }`} />
              </div>

              {/* المبلغ والعملة */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.amountLbl}</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                      darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                    }`} />
                </div>
                <div>
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.currencyLbl}</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                      darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                    }`}>
                    <option value="MAD">MAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* الوصف */}
              <div>
                <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.descLbl}</label>
                <CaretSafeInput type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={D.descPh}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                  }`} />
              </div>

              {/* تاريخ الاستحقاق */}
              <div>
                <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.dueDateLbl}</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                  }`} />
              </div>

              {/* الحالة والمبلغ المدفوع */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.statusLbl}</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as DebtCreditRecordStatus)}
                    className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                      darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                    }`}>
                    <option value="pending">{D.statusPending}</option>
                    <option value="partial">{D.statusPartial}</option>
                    <option value="paid">{D.statusPaid}</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.paidLbl}</label>
                  <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${
                      darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                    }`} />
                </div>
              </div>

              {/* المنبهات الاستباقية */}
              <div>
                <label className={`text-xs font-medium mb-2 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {D.proactiveAlarms}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {alarmOptions.map(opt => (
                    <button key={opt.value}
                      onClick={() => {
                        setProactiveAlarms(prev => 
                          prev.includes(opt.value) 
                            ? prev.filter(a => a !== opt.value) 
                            : [...prev, opt.value].sort((a, b) => b - a)
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        proactiveAlarms.includes(opt.value)
                          ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                          : darkMode ? 'border-gray-700 text-gray-500 hover:border-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* منبه يومي */}
              <div className={`p-3 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {D.dailyAlarm}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {D.dailyAlarmDesc}
                    </div>
                  </div>
                  <input type="checkbox" checked={dailyReminder} onChange={(e) => setDailyReminder(e.target.checked)}
                    className="w-5 h-5 rounded text-rose-500" />
                </label>
                {dailyReminder && (
                  <div className="mt-2">
                    <input type="time" value={dailyReminderTime} onChange={(e) => setDailyReminderTime(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'}`} />
                  </div>
                )}
              </div>

              {/* الوسوم */}
              <div>
                <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.tagsLbl}</label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {dcTags.map((t, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                      #{t}
                      <button onClick={() => setDcTags(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
                <CaretSafeInput type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      if (!dcTags.includes(tagInput.trim())) setDcTags([...dcTags, tagInput.trim()]);
                      setTagInput('');
                    }
                  }}
                  placeholder={D.addTagPh}
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200'
                  }`} />
              </div>

              {/* ملاحظات */}
              <div>
                <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{D.notesLbl}</label>
                <CaretSafeTextarea value={dcNotes} onChange={(e) => setDcNotes(e.target.value)}
                  placeholder={D.otherDetails}
                  rows={2}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none resize-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                  }`} />
              </div>

              {/* أزرار الحفظ */}
              <div className="flex gap-2 pt-2">
                <button onClick={resetForm}
                  className={`flex-1 py-2.5 rounded-xl font-medium ${
                    darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  }`}>
                  {D.cancel}
                </button>
                <button onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white transition-colors">
                  {editingId ? D.update : D.save}
                </button>
              </div>
            </div>
          )}

          {/* القائمة الرئيسية */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* المجاميع */}
            <div className={`p-4 grid grid-cols-3 gap-3 border-b ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
              <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <div className="text-lg font-bold text-red-500">{totals.debtTotal.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{D.netOwe}</div>
              </div>
              <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <div className="text-lg font-bold text-emerald-500">{totals.creditTotal.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{D.netOwed}</div>
              </div>
              <div className={`p-3 rounded-xl text-center ${
                totals.net >= 0 ? (darkMode ? 'bg-blue-500/10' : 'bg-blue-50') : (darkMode ? 'bg-red-500/10' : 'bg-red-50')
              }`}>
                <div className={`text-lg font-bold ${totals.net >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                  {totals.net >= 0 ? '+' : ''}{totals.net.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">{D.net}</div>
              </div>
            </div>

            {/* أزرار الفلترة */}
            <div className={`px-4 py-3 flex flex-wrap items-center gap-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex gap-1">
                {[
                  { value: 'all', label: D.all },
                  { value: 'credit', label: D.creditF },
                  { value: 'debt', label: D.debtF }
                ].map(opt => (
                  <button key={opt.value} onClick={() => setFilterType(opt.value as DebtCreditFilterType)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterType === opt.value
                        ? 'bg-rose-500 text-white'
                        : darkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[
                  { value: 'all', label: D.all },
                  { value: 'pending', label: D.pendingF },
                  { value: 'partial', label: D.partialF },
                  { value: 'paid', label: D.paidF }
                ].map(opt => (
                  <button key={opt.value} onClick={() => setFilterStatus(opt.value as DebtCreditStatus)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterStatus === opt.value
                        ? 'bg-rose-500 text-white'
                        : darkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <CaretSafeInput type="text" value={searchPerson} onChange={(e) => setSearchPerson(e.target.value)}
                placeholder={D.searchPh}
                className={`flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border text-xs outline-none ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200'
                }`} />
              {debtsCredits.length > 0 && (
                <button onClick={handleExportDebts}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-all active:scale-95">
                  📤 {D.exportBtn}
                </button>
              )}
              {debtsCredits.length > 0 && (
                <button onClick={() => setGroupByPerson(p => !p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all active:scale-95 ${
                    groupByPerson ? 'bg-rose-500 text-white' : darkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  👥 {D.groupBtn}
                </button>
              )}
            </div>

            {/* قائمة السجلات */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredList.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="text-5xl">💳</div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{D.noRecords}</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {debtsCredits.length === 0 ? D.startAdd : D.noMatch}
                  </p>
                </div>
              ) : groupByPerson ? (
                // ── عرض مُجمَّع حسب الشخص: رأس لكل شخص + ملخص صافي ──
                (() => {
                  const byPerson = filteredList.reduce((acc, dc) => {
                    const key = dc.personName || '—';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(dc);
                    return acc;
                  }, {} as Record<string, DebtCredit[]>);

                  return Object.entries(byPerson).map(([person, records]) => {
                    const personDebt = records.filter(r => r.type === 'debt' && r.status !== 'paid').reduce((s, r) => s + (r.amount - r.paidAmount), 0);
                    const personCredit = records.filter(r => r.type === 'credit' && r.status !== 'paid').reduce((s, r) => s + (r.amount - r.paidAmount), 0);
                    const personNet = personCredit - personDebt;
                    const curr = records[0]?.currency || '';
                    return (
                      <div key={person} className="mb-4">
                        <div className={`sticky top-0 z-10 flex items-center justify-between py-2.5 px-3 mb-2 rounded-xl backdrop-blur-md ${darkMode ? 'bg-gray-900/85' : 'bg-white/85'} border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                          <span className="font-bold text-sm flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white text-xs">{person.charAt(0)}</span>
                            {person}
                          </span>
                          <span className={`text-xs font-bold ${personNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {personNet >= 0 ? '+' : ''}{personNet.toFixed(0)} {curr}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {records.map(dc => {
                            const alarm = getAlarmStatus(dc);
                            const progress = dc.amount > 0 ? (dc.paidAmount / dc.amount) * 100 : 0;
                            const remainingAmount = dc.amount - dc.paidAmount;
                            return renderRecordCard(dc, alarm, progress, remainingAmount);
                          })}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                filteredList.map(dc => {
                  const alarm = getAlarmStatus(dc);
                  const progress = dc.amount > 0 ? (dc.paidAmount / dc.amount) * 100 : 0;
                  const remainingAmount = dc.amount - dc.paidAmount;
                  
                  return renderRecordCard(dc, alarm, progress, remainingAmount);
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة الرسالة الذكية المولّدة */}
      {aiMsg && (
        <div className="fixed inset-0 pb-banner z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setAiMsg(null)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl p-5 shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">✉️</span>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{D.reminderMsg} جاهزة</h3>
            </div>
            <p className={`text-sm leading-7 whitespace-pre-wrap rounded-xl p-3 mb-4 ${darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
              {aiMsg.text}
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(aiMsg.text);
                  } catch { /* ignore */ }
                  setAiMsg(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold transition-colors">
                {D.copy}
              </button>
              <button
                onClick={async () => {
                  try {
                    const { Capacitor } = await import('@capacitor/core');
                    if (Capacitor.isNativePlatform()) {
                      const { Share } = await import('@capacitor/share');
                      await Share.share({ text: aiMsg.text });
                    } else if (navigator.share) {
                      await navigator.share({ text: aiMsg.text });
                    }
                  } catch { /* ignore */ }
                  setAiMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                {D.share}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد الحذف الفاخرة */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) deleteDebtCredit(deleteTargetId);
        }}
        title={D.delTitle}
        message={D.delMsg}
        variant="danger"
        confirmLabel={D.delConfirm}
        cancelLabel={D.delCancel}
      />

      {/* نافذة تسجيل دفعة فاخرة */}
      <PromptModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={confirmPayment}
        title={payTarget ? D.payTo(payTarget.personName) : D.payTitle}
        subtitle={payTarget ? D.payRemaining(payTarget.amount - payTarget.paidAmount, payTarget.currency) : ''}
        defaultValue={payTarget ? (payTarget.amount - payTarget.paidAmount).toString() : ''}
        placeholder={D.payPh}
        icon="💰"
        inputType="number"
        confirmLabel={D.payConfirm}
        gradient="from-emerald-500 via-teal-500 to-cyan-500"
        shadowColor="rgba(16, 185, 129, 0.3)"
      />
    </div>
  );
}
