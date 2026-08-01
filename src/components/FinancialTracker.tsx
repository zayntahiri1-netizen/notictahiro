import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { exportCSV } from '../utils/exportData';
import { CaretSafeInput } from './CaretSafe';

import ListenButton from './ListenButton';
interface FinancialTrackerProps {
  onClose: () => void;
}

type FinanceViewMode = 'recent' | 'history' | 'analytics';
type FinanceCategory = 'investment' | 'food' | 'transport' | 'shopping' | 'other';

export default function FinancialTracker({ onClose }: FinancialTrackerProps) {
  const { darkMode, transactions, addTransaction, deleteTransaction, language } = useApp();
  const FT = {
    ar: { header: 'مُدوّن المالية الذكي', subtitle: 'اكتب المعاملة المالية بعبارة بسيطة وسيتعرف Tahiro على المبلغ والعملة والتصنيف',
          quickAdd: 'إضافة سريعة بنص عامي', example: 'مثال: "سجل شراء LINK بـ 100 دولار اليوم" أو "تغديت برا بـ 80 درهم"',
          inputPh: 'اكتب تفاصيل المعاملة هنا...', analyzing: 'جاري التحليل...', record: 'سجل',
          recent: '📋 الأخيرة', history: '📜 السجل التاريخي', analytics: '📊 تحليلات', exportBtn: 'تصدير', budgetTitle: 'الميزانية الشهرية', budgetSet: 'تحديد', budgetSave: 'حفظ', budgetPh: 'مثلاً 3000', budgetOver: 'تجاوزت ميزانيتك الشهرية!', budgetHint: 'حدّد ميزانية شهرية لتتبّع إنفاقك وتنبيهك عند التجاوز.', totalLbl: 'الإجمالي', recurringTitle: 'معاملات متكررة', recurringHint: 'احفظ معاملاتك المتكررة (إيجار، اشتراكات) لإضافتها بضغطة.', recurringAdd: 'إضافة', recurringTip: 'لإنشاء معاملة متكررة: املأ النموذج أدناه ثم اضغط 🔁', saveRecurring: 'حفظ كمعاملة متكررة',
          recentTitle: 'سجل المعاملات الأخيرة', historyTitle: 'السجل التاريخي الكامل', txnCount: 'معاملة',
          noTxns: 'لا توجد معاملات مسجلة بعد', startAdd: 'ابدأ بإضافة معاملة جديدة', txnsPlural: 'معاملات',
          totalsTitle: '📊 إجمالي المصاريف والاستثمارات', noTotals: 'لا توجد إجماليات لعرضها', totalIn: 'إجمالي بالـ',
          manualAdd: '➕ إضافة معاملة يدوياً', amount: 'المبلغ', desc: 'الوصف', addTxn: 'إضافة المعاملة',
          catInvestment: 'استثمار', catFood: 'طعام', catTransport: 'نقل ومواصلات', catShopping: 'تسوق', catOther: 'أخرى' },
    en: { header: 'Smart finance logger', subtitle: 'Write a transaction in plain words and Tahiro will detect the amount, currency and category',
          quickAdd: 'Quick add in plain text', example: 'Example: "log buying LINK for 100 USD today" or "lunch out for 80 MAD"',
          inputPh: 'Write the transaction details here...', analyzing: 'Analyzing...', record: 'Log',
          recent: '📋 Recent', history: '📜 Full history', analytics: '📊 Analytics', exportBtn: 'Export', budgetTitle: 'Monthly budget', budgetSet: 'Set', budgetSave: 'Save', budgetPh: 'e.g. 3000', budgetOver: 'You exceeded your monthly budget!', budgetHint: 'Set a monthly budget to track spending and get alerted when over.', totalLbl: 'Total', recurringTitle: 'Recurring', recurringHint: 'Save recurring transactions (rent, subscriptions) to add with one tap.', recurringAdd: 'Add', recurringTip: 'To create a recurring item: fill the form below then tap 🔁', saveRecurring: 'Save as recurring',
          recentTitle: 'Recent transactions', historyTitle: 'Complete history', txnCount: 'transactions',
          noTxns: 'No transactions logged yet', startAdd: 'Start by adding a new transaction', txnsPlural: 'transactions',
          totalsTitle: '📊 Total expenses & investments', noTotals: 'No totals to show', totalIn: 'Total in',
          manualAdd: '➕ Add transaction manually', amount: 'Amount', desc: 'Description', addTxn: 'Add transaction',
          catInvestment: 'Investment', catFood: 'Food', catTransport: 'Transport', catShopping: 'Shopping', catOther: 'Other' },
    es: { header: 'Registro financiero inteligente', subtitle: 'Escribe una transacción en palabras simples y Tahiro detectará el monto, la moneda y la categoría',
          quickAdd: 'Añadir rápido en texto', example: 'Ejemplo: "registra comprar LINK por 100 USD hoy" o "almuerzo fuera por 80 MAD"',
          inputPh: 'Escribe los detalles de la transacción aquí...', analyzing: 'Analizando...', record: 'Registrar',
          recent: '📋 Recientes', history: '📜 Historial completo', analytics: '📊 Analíticas', exportBtn: 'Exportar', budgetTitle: 'Presupuesto mensual', budgetSet: 'Definir', budgetSave: 'Guardar', budgetPh: 'ej. 3000', budgetOver: '¡Superaste tu presupuesto mensual!', budgetHint: 'Define un presupuesto mensual para controlar tus gastos.', totalLbl: 'Total', recurringTitle: 'Recurrentes', recurringHint: 'Guarda transacciones recurrentes (alquiler, suscripciones).', recurringAdd: 'Añadir', recurringTip: 'Para crear una recurrente: llena el formulario y pulsa 🔁', saveRecurring: 'Guardar como recurrente',
          recentTitle: 'Transacciones recientes', historyTitle: 'Historial completo', txnCount: 'transacciones',
          noTxns: 'No hay transacciones registradas', startAdd: 'Empieza añadiendo una nueva transacción', txnsPlural: 'transacciones',
          totalsTitle: '📊 Total de gastos e inversiones', noTotals: 'No hay totales que mostrar', totalIn: 'Total en',
          manualAdd: '➕ Añadir transacción manualmente', amount: 'Monto', desc: 'Descripción', addTxn: 'Añadir transacción',
          catInvestment: 'Inversión', catFood: 'Comida', catTransport: 'Transporte', catShopping: 'Compras', catOther: 'Otros' },
    zh: { header: '智能财务记录', subtitle: '用简单的话写下一笔交易，Tahiro 会识别金额、货币和类别',
          quickAdd: '用文字快速添加', example: '例如：“记录今天用 100 USD 买 LINK”或“在外午餐 80 MAD”',
          inputPh: '在这里写下交易详情...', analyzing: '分析中...', record: '记录',
          recent: '📋 最近', history: '📜 完整历史', analytics: '📊 分析', exportBtn: '导出', budgetTitle: '月度预算', budgetSet: '设置', budgetSave: '保存', budgetPh: '例如 3000', budgetOver: '您已超出月度预算！', budgetHint: '设置月度预算以跟踪支出并在超支时提醒。', totalLbl: '总计', recurringTitle: '定期交易', recurringHint: '保存定期交易（房租、订阅）一键添加。', recurringAdd: '添加', recurringTip: '创建定期项：填写下面表单然后点击 🔁', saveRecurring: '保存为定期',
          recentTitle: '最近的交易', historyTitle: '完整历史记录', txnCount: '笔交易',
          noTxns: '尚未记录任何交易', startAdd: '从添加一笔新交易开始', txnsPlural: '笔交易',
          totalsTitle: '📊 支出与投资总额', noTotals: '没有可显示的总额', totalIn: '总额（',
          manualAdd: '➕ 手动添加交易', amount: '金额', desc: '描述', addTxn: '添加交易',
          catInvestment: '投资', catFood: '餐饮', catTransport: '交通', catShopping: '购物', catOther: '其他' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? {
    header: 'Smart finance logger', subtitle: 'Write a transaction in plain words and Tahiro will detect the amount, currency and category',
    quickAdd: 'Quick add in plain text', example: 'Example: "log buying LINK for 100 USD today"',
    inputPh: 'Write the transaction details here...', analyzing: 'Analyzing...', record: 'Log',
    recent: '📋 Recent', history: '📜 Full history', analytics: '📊 Analytics',
    recentTitle: 'Recent transactions', historyTitle: 'Complete history', txnCount: 'transactions',
    noTxns: 'No transactions logged yet', startAdd: 'Start by adding a new transaction', txnsPlural: 'transactions',
    totalsTitle: '📊 Total expenses & investments', noTotals: 'No totals to show', totalIn: 'Total in',
    manualAdd: '➕ Add transaction manually', amount: 'Amount', desc: 'Description', addTxn: 'Add transaction',
    catInvestment: 'Investment', catFood: 'Food', catTransport: 'Transport', catShopping: 'Shopping', catOther: 'Other' };
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<FinanceViewMode>('recent');

  // الميزانية الشهرية (محفوظة في localStorage) — تنبيه عند تجاوزها
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try { return Number(localStorage.getItem('notic-monthly-budget')) || 0; } catch { return 0; }
  });
  const [budgetInput, setBudgetInput] = useState('');
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);

  const saveBudget = () => {
    const val = parseFloat(budgetInput);
    const finalVal = Number.isFinite(val) && val >= 0 ? val : 0;
    setMonthlyBudget(finalVal);
    try { localStorage.setItem('notic-monthly-budget', String(finalVal)); } catch { /* ignore */ }
    setShowBudgetEdit(false);
    setBudgetInput('');
  };

  // إجمالي إنفاق الشهر الحالي (لمقارنته بالميزانية)
  const thisMonthSpend = (() => {
    const now = new Date();
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.category !== 'investment';
      })
      .reduce((s, t) => s + t.amount, 0);
  })();
  const budgetPct = monthlyBudget > 0 ? Math.min(100, (thisMonthSpend / monthlyBudget) * 100) : 0;
  const budgetOver = monthlyBudget > 0 && thisMonthSpend > monthlyBudget;

  // المعاملات المتكررة (قوالب محفوظة: إيجار، اشتراكات...) — إضافة بضغطة
  interface RecurringTpl { id: string; amount: number; currency: string; category: FinanceCategory; description: string; }
  const [recurring, setRecurring] = useState<RecurringTpl[]>(() => {
    try { return JSON.parse(localStorage.getItem('notic-recurring-txns') || '[]'); } catch { return []; }
  });
  const [showRecurring, setShowRecurring] = useState(false);

  const saveRecurring = (list: RecurringTpl[]) => {
    setRecurring(list);
    try { localStorage.setItem('notic-recurring-txns', JSON.stringify(list)); } catch { /* ignore */ }
  };
  const addRecurringFromCurrent = () => {
    const parsed = parseFloat(amount);
    if (!description || !Number.isFinite(parsed) || parsed <= 0) return;
    saveRecurring([...recurring, { id: `${Date.now()}`, amount: parsed, currency, category, description }]);
    setAmount(''); setDescription('');
  };
  const applyRecurring = (tpl: RecurringTpl) => {
    addTransaction({ amount: tpl.amount, currency: tpl.currency, category: tpl.category, description: tpl.description });
  };
  const removeRecurring = (id: string) => saveRecurring(recurring.filter(r => r.id !== id));

  // لإضافة يدوية إذا لزم الأمر
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState<FinanceCategory>('other');
  const [description, setDescription] = useState('');

  const handleQuickAdd = () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);

    // محاكاة تفكيك وفهم AI للمعاملة المالية
    setTimeout(() => {
      const text = inputText.trim();
      let extractedAmount = 0;
      let extractedCurrency = 'MAD';
      let extractedCategory: FinanceCategory = 'other';
      let extractedDesc = text;

      // محاولة استخراج المبالغ الرقمية
      const amountMatch = text.match(/\d+(\.\d+)?/);
      if (amountMatch) {
        extractedAmount = parseFloat(amountMatch[0]);
      }

      // استخراج العملة
      const low = text.toLowerCase();
      if (text.includes('دولار') || low.includes('usd') || low.includes('dolar') || low.includes('dollar') || text.includes('$')) {
        extractedCurrency = 'USD';
      } else if (text.includes('يورو') || low.includes('eur') || low.includes('euro') || text.includes('€')) {
        extractedCurrency = 'EUR';
      }

      // استخراج التصنيف
      if (['شراء','عملة','سهم','استثمار','buy','invest','stock','crypto','compra','inversión','acción','买','投资','股票'].some(w => low.includes(w.toLowerCase()))) {
        extractedCategory = 'investment';
      } else if (['أكل','غداء','عشاء','فطور','مطعم','تغديت','food','lunch','dinner','breakfast','restaurant','comida','almuerzo','cena','吃','午餐','晚餐','餐厅'].some(w => low.includes(w.toLowerCase()))) {
        extractedCategory = 'food';
      } else if (['طريق','تاكسي','سفر','بنزين','نقل','taxi','travel','fuel','transport','gas','transporte','viaje','gasolina','出租车','旅行','交通','汽油'].some(w => low.includes(w.toLowerCase()))) {
        extractedCategory = 'transport';
      } else if (['شوبينغ','ملابس','سوبرماركت','اقتناء','shopping','clothes','supermarket','compras','ropa','购物','衣服','超市'].some(w => low.includes(w.toLowerCase()))) {
        extractedCategory = 'shopping';
      }

      // تنظيف الوصف
      extractedDesc = text
        .replace(/\d+(\.\d+)?/g, '')
        .replace(/(دولار|درهم|يورو|اليوم|أمس|dollar|euro|today|yesterday|hoy|ayer|MAD|USD|EUR|بـ|ب)/gi, '')
        .trim();

      if (!extractedDesc) {
        extractedDesc = text;
      }

      addTransaction({
        amount: extractedAmount || 10,
        currency: extractedCurrency,
        category: extractedCategory,
        description: extractedDesc
      });

      setInputText('');
      setIsProcessing(false);
    }, 1000);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    const parsed = parseFloat(amount);
    // حماية من NaN والقيم السالبة/الصفرية — تفسد كل الإحصائيات المالية
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    addTransaction({
      amount: parsed,
      currency,
      category,
      description
    });

    setAmount('');
    setDescription('');
  };

  // ─── تصدير المعاملات كملف CSV (يفتح في Excel/Sheets) ──────────────
  const handleExport = async () => {
    if (transactions.length === 0) return;
    const headers = [FT.amount, 'العملة', FT.desc, 'التصنيف', 'التاريخ'];
    const rows = transactions.map(t => [
      t.amount,
      t.currency,
      t.description,
      categoryLabels[t.category] ?? t.category,
      new Date(t.date).toLocaleString('ar-MA'),
    ]);
    await exportCSV(`Notic-Finance-${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  // حساب المجاميع
  const totals = transactions.reduce((acc, t) => {
    const key = t.currency;
    if (!acc[key]) acc[key] = 0;
    acc[key] += t.amount;
    return acc;
  }, {} as Record<string, number>);

  const categoryIcons = {
    investment: '📈',
    food: '🍔',
    transport: '🚗',
    shopping: '🛍️',
    other: '💰'
  };

  const categoryLabels = {
    investment: FT.catInvestment,
    food: FT.catFood,
    transport: FT.catTransport,
    shopping: FT.catShopping,
    other: FT.catOther
  };

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in shadow-[0_20px_60px_-15px_rgba(16,185,129,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* رأس النافذة الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              💰
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  AI Finance Tracker
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{FT.header}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">{FT.subtitle}</p>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* إدخال سريع بالذكاء الاصطناعي */}
          <div className={`p-4 rounded-xl border ${
            darkMode ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
              darkMode ? 'text-emerald-400' : 'text-emerald-700'
            }`}>
              <span>✨</span>
              <span>{FT.quickAdd}</span>
            </h3>
            <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {FT.example}
            </p>
            <div className="flex gap-2">
              <CaretSafeInput
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={FT.inputPh}
                className={`flex-1 px-4 py-3 rounded-xl border outline-none transition-all ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-emerald-500' 
                    : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500'
                }`}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                disabled={isProcessing}
              />
              <button
                onClick={handleQuickAdd}
                disabled={isProcessing || !inputText.trim()}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {isProcessing ? FT.analyzing : FT.record}
              </button>
            </div>
          </div>

          {/* بطاقة المعاملات المتكررة */}
          <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <button onClick={() => setShowRecurring(!showRecurring)} className="w-full flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-1.5">🔁 {FT.recurringTitle} {recurring.length > 0 && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{recurring.length}</span>}</span>
              <span className="text-gray-400">{showRecurring ? '▲' : '▼'}</span>
            </button>
            {showRecurring && (
              <div className="mt-3 space-y-2">
                {recurring.length === 0 ? (
                  <p className="text-xs text-gray-400">{FT.recurringHint}</p>
                ) : (
                  recurring.map(tpl => (
                    <div key={tpl.id} className={`flex items-center justify-between p-2.5 rounded-xl ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{categoryIcons[tpl.category]}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{tpl.description}</div>
                          <div className="text-xs text-gray-400">{tpl.amount} {tpl.currency}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => applyRecurring(tpl)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white active:scale-95">
                          ＋ {FT.recurringAdd}
                        </button>
                        <button onClick={() => removeRecurring(tpl.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">🗑️</button>
                      </div>
                    </div>
                  ))
                )}
                <p className="text-[11px] text-gray-400 pt-1">{FT.recurringTip}</p>
              </div>
            )}
          </div>

          {/* بطاقة الميزانية الشهرية */}
          <div className={`p-4 rounded-2xl border ${budgetOver ? (darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200') : (darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200')}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold flex items-center gap-1.5">🎯 {FT.budgetTitle}</span>
              <button onClick={() => { setBudgetInput(monthlyBudget ? String(monthlyBudget) : ''); setShowBudgetEdit(!showBudgetEdit); }}
                className="text-xs px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                {monthlyBudget > 0 ? '✏️' : '➕'} {FT.budgetSet}
              </button>
            </div>
            {showBudgetEdit && (
              <div className="flex gap-2 mb-3">
                <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
                  placeholder={FT.budgetPh} autoFocus
                  className={`flex-1 px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`} />
                <button onClick={saveBudget} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium">{FT.budgetSave}</button>
              </div>
            )}
            {monthlyBudget > 0 ? (
              <>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className={budgetOver ? 'text-red-500 font-bold' : 'text-gray-500'}>
                    {thisMonthSpend.toFixed(0)} / {monthlyBudget.toFixed(0)}
                  </span>
                  <span className={budgetOver ? 'text-red-500 font-bold' : 'text-gray-500'}>{budgetPct.toFixed(0)}%</span>
                </div>
                <div className={`h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div className={`h-full rounded-full transition-all ${budgetOver ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${budgetPct}%` }} />
                </div>
                {budgetOver && <div className="mt-2 text-xs text-red-500 font-medium">⚠️ {FT.budgetOver}</div>}
              </>
            ) : (
              <p className="text-xs text-gray-400">{FT.budgetHint}</p>
            )}
          </div>

          {/* أزرار التبديل بين العروض + زر التصدير */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 w-fit">
              {[
                { id: 'recent', label: FT.recent, icon: '📋' },
                { id: 'history', label: FT.history, icon: '📜' },
                { id: 'analytics', label: FT.analytics, icon: '📊' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as FinanceViewMode)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === tab.id
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {transactions.length > 0 && (
              <button
                onClick={handleExport}
                className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 transition-all active:scale-95"
              >
                📤 {FT.exportBtn}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* المعاملات - عرض حسب الوضع */}
            <div>
              <h3 className={`font-semibold mb-3 flex items-center justify-between ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <span className="flex items-center gap-2">
                  {viewMode === 'recent' ? '📋' : viewMode === 'history' ? '📜' : '📊'}
                  {viewMode === 'recent' ? FT.recentTitle : viewMode === 'history' ? FT.historyTitle : 'التحليلات المتقدمة'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  {transactions.length} {FT.txnCount}
                </span>
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                {transactions.length === 0 ? (
                  <div className={`text-center py-12 space-y-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <div className="text-4xl">📭</div>
                    <div className="text-sm">{FT.noTxns}</div>
                    <div className="text-xs">{FT.startAdd}</div>
                  </div>
                ) : viewMode === 'recent' ? (
                  // عرض المعاملات الأخيرة
                  transactions.slice(0, 10).map(t => (
                    <div 
                      key={t.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between group transition-all hover:shadow-md ${
                        darkMode ? 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800' : 'bg-white border-gray-200 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          darkMode ? 'bg-gray-700' : 'bg-gray-100'
                        }`}>
                          <span className="text-xl">{categoryIcons[t.category]}</span>
                        </div>
                        <div>
                          <div className="font-medium text-sm">{t.description}</div>
                          <div className={`text-xs mt-0.5 flex items-center gap-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            <span>{categoryLabels[t.category]}</span>
                            <span>•</span>
                            <span>{new Date(t.date).toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' })}</span>
                            <span>•</span>
                            <span>{new Date(t.date).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-bold text-emerald-500">{Number.isFinite(t.amount) ? t.amount.toLocaleString('ar-MA', { maximumFractionDigits: 2 }) : '–'}</div>
                          <div className="text-[10px] text-gray-400">{t.currency}</div>
                        </div>
                        <button
                          onClick={() => deleteTransaction(t.id)}
                          aria-label="حذف"
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 transition-all active:scale-90"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                ) : viewMode === 'history' ? (
                  // السجل التاريخي الكامل - مجمع حسب التاريخ
                  (() => {
                    const grouped = transactions.reduce((acc, t) => {
                      const date = new Date(t.date).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
                      if (!acc[date]) acc[date] = [];
                      acc[date].push(t);
                      return acc;
                    }, {} as Record<string, typeof transactions>);

                    return Object.entries(grouped).map(([date, items]) => (
                      <div key={date} className="mb-4">
                        <div className={`sticky top-0 z-10 py-2 px-3 mb-2 rounded-lg text-xs font-bold backdrop-blur-md ${
                          darkMode ? 'bg-gray-900/80 text-gray-400' : 'bg-white/80 text-gray-600'
                        } border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                          📅 {date} • {items.length} {FT.txnsPlural} • {items.reduce((s, t) => s + t.amount, 0).toFixed(0)} {items[0]?.currency || ''}
                        </div>
                        <div className="space-y-1.5">
                          {items.map(t => (
                            <div 
                              key={t.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between group text-sm ${
                                darkMode ? 'bg-gray-800/30 border-gray-800 hover:bg-gray-800/50' : 'bg-gray-50/50 border-gray-100 hover:bg-gray-50'
                              } transition-all`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">{categoryIcons[t.category]}</span>
                                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t.description}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                                  {new Date(t.date).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="font-medium text-emerald-500 text-sm">{Number.isFinite(t.amount) ? t.amount.toLocaleString('ar-MA', { maximumFractionDigits: 2 }) : '–'} {t.currency}</span>
                                <button
                                  onClick={() => deleteTransaction(t.id)}
                                  aria-label="حذف"
                                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 transition-all active:scale-90"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  // عرض التحليلات — رسم دائري جميل + أشرطة ملوّنة
                  (() => {
                    const catTotals = transactions.reduce((acc, t) => {
                      if (!acc[t.category]) acc[t.category] = { count: 0, total: 0 };
                      acc[t.category].count++;
                      acc[t.category].total += t.amount;
                      return acc;
                    }, {} as Record<string, { count: number; total: number }>);
                    const entries = Object.entries(catTotals).sort((a, b) => b[1].total - a[1].total);
                    const grandTotal = entries.reduce((s, [, d]) => s + d.total, 0);
                    const catColors: Record<string, string> = {
                      investment: '#8b5cf6', food: '#f59e0b', transport: '#3b82f6', shopping: '#ec4899', other: '#6b7280',
                    };
                    // بناء conic-gradient للرسم الدائري
                    let acc = 0;
                    const segments = entries.map(([cat, d]) => {
                      const start = (acc / grandTotal) * 360;
                      acc += d.total;
                      const end = (acc / grandTotal) * 360;
                      return `${catColors[cat] || '#6b7280'} ${start}deg ${end}deg`;
                    }).join(', ');

                    if (entries.length === 0) {
                      return <div className="text-center py-10 text-gray-400 text-sm">{FT.noTotals}</div>;
                    }

                    return (
                      <div className="space-y-5">
                        {/* الرسم الدائري */}
                        <div className="flex items-center justify-center py-2">
                          <div className="relative" style={{ width: 180, height: 180 }}>
                            <div className="rounded-full" style={{ width: 180, height: 180, background: `conic-gradient(${segments})` }} />
                            <div className={`absolute inset-0 m-auto rounded-full flex flex-col items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-white'}`} style={{ width: 110, height: 110 }}>
                              <span className="text-xs text-gray-400">{FT.totalLbl}</span>
                              <span className="text-lg font-bold text-emerald-500">{grandTotal.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                        {/* القائمة الملوّنة */}
                        {entries.map(([cat, d]) => {
                          const pct = grandTotal > 0 ? (d.total / grandTotal) * 100 : 0;
                          const color = catColors[cat] || '#6b7280';
                          return (
                            <div key={cat} className={`p-3 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                                  <span className="text-lg">{categoryIcons[cat as keyof typeof categoryIcons]}</span>
                                  <span className="font-medium text-sm">{categoryLabels[cat as keyof typeof categoryLabels]}</span>
                                </div>
                                <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`h-2 flex-1 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <span className="font-bold text-sm" style={{ color }}>{d.total.toFixed(0)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* الملخص والمجاميع */}
            <div className="space-y-6">
              {/* إجمالي المحفظة */}
              <div>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {FT.totalsTitle}
                </h3>
                <div className={`p-4 rounded-xl border ${
                  darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                } space-y-2`}>
                  {Object.entries(totals).length === 0 ? (
                    <div className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {FT.noTotals}
                    </div>
                  ) : (
                    Object.entries(totals).map(([curr, total]) => (
                      <div key={curr} className="flex items-center justify-between py-1 border-b border-dashed dark:border-gray-700 last:border-0">
                        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{FT.totalIn} {curr}:</span>
                        <span className="font-bold text-lg text-emerald-500">{total} {curr}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* إضافة يدوية */}
              <div>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {FT.manualAdd}
                </h3>
                <form onSubmit={handleManualAdd} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={FT.amount}
                      className={`px-3 py-2 rounded-lg border text-sm outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                      }`}
                      required
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className={`px-3 py-2 rounded-lg border text-sm outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                      }`}
                    >
                      <option value="MAD">MAD</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as FinanceCategory)}
                      className={`px-3 py-2 rounded-lg border text-sm outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                      }`}
                    >
                      <option value="other">{FT.catOther}</option>
                      <option value="investment">{FT.catInvestment}</option>
                      <option value="food">{FT.catFood}</option>
                      <option value="transport">{FT.catTransport}</option>
                      <option value="shopping">{FT.catShopping}</option>
                    </select>
                    <CaretSafeInput
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={FT.desc}
                      className={`px-3 py-2 rounded-lg border text-sm outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                      }`}
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors"
                    >
                      {FT.addTxn}
                    </button>
                    <button
                      type="button"
                      onClick={addRecurringFromCurrent}
                      title={FT.saveRecurring}
                      className="px-4 py-2.5 rounded-lg font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors active:scale-95"
                    >
                      🔁
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
