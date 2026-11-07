/**
 * BillSplit.tsx — تقسيم الفاتورة
 * ───────────────────────────────────────────────────────────────────────
 * يقسم مبلغاً على عدّة أشخاص: بالتساوي أو بحصصٍ متفاوتة، مع إكراميةٍ
 * اختيارية. ثم يُخرج النتيجة نصّاً جاهزاً للإرسال، أو يحفظها ملاحظة.
 *
 * اخترتُ هذه الميزة لأنها تلتقي بما في التطبيق أصلاً: من يقسم فاتورةً
 * بين أصدقاء يحتاج بعدها أن يتذكّر من يدين له — وذلك بالضبط ما يفعله
 * «الدائن والمدين» عندك. فالنصّ المُخرَج مرتَّب ليُنسخ إلى هناك مباشرة.
 *
 * ⚠️ حسابُ المال لا يُترك لقسمةٍ عشرية. نحسب بالسنتيمات (أعداد صحيحة)
 *    ثم نوزّع باقي القسمة سنتيماً سنتيماً على الأوائل — فمجموع الحصص
 *    يساوي المبلغ تماماً، ولا يضيع ولا يزيد سنتيم واحد.
 */
import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmtNumber } from '../utils/dateLocale';
import * as haptics from '../utils/haptics';
import ListenButton from './ListenButton';

interface Props { onClose: () => void }

interface Person { id: string; name: string; shares: number }

const UI = {
  ar: {
    badge: 'حساب دقيق', title: 'تقسيم الفاتورة',
    desc: 'اقسم المبلغ بالتساوي أو بحصص، بلا سنتيم ضائع',
    total: 'المبلغ الإجمالي', tip: 'الإكرامية', currency: 'العملة',
    people: 'المشاركون', addPerson: '+ إضافة شخص', person: 'شخص',
    equal: 'بالتساوي', shares: 'بحصص',
    sharesHint: 'عدد الحصص لكل شخص (من أكل ضعف غيره يأخذ حصّتين)',
    result: 'النتيجة', perPerson: 'لكل شخص', grand: 'المجموع مع الإكرامية',
    copy: '📋 نسخ النص', copied: 'نُسخ ✅', saveNote: '💾 حفظ كملاحظة', saved: 'حُفظت ✅',
    needAmount: 'أدخل مبلغاً أكبر من صفر', needPeople: 'أضف شخصاً واحداً على الأقل',
    noteTitle: '🧾 تقسيم فاتورة',
    remainder: 'وُزّع الباقي على الأوائل لضمان تطابق المجموع',
  },
  en: {
    badge: 'Exact maths', title: 'Bill split',
    desc: 'Split an amount evenly or by shares, with no cent lost',
    total: 'Total amount', tip: 'Tip', currency: 'Currency',
    people: 'People', addPerson: '+ Add person', person: 'Person',
    equal: 'Evenly', shares: 'By shares',
    sharesHint: 'Shares per person (someone who had twice as much takes two shares)',
    result: 'Result', perPerson: 'Per person', grand: 'Total with tip',
    copy: '📋 Copy text', copied: 'Copied ✅', saveNote: '💾 Save as note', saved: 'Saved ✅',
    needAmount: 'Enter an amount greater than zero', needPeople: 'Add at least one person',
    noteTitle: '🧾 Bill split',
    remainder: 'The remainder is spread over the first people so the total matches exactly',
  },
  es: {
    badge: 'Cálculo exacto', title: 'Dividir la cuenta',
    desc: 'Divide un importe a partes iguales o por partes, sin perder un céntimo',
    total: 'Importe total', tip: 'Propina', currency: 'Moneda',
    people: 'Personas', addPerson: '+ Añadir persona', person: 'Persona',
    equal: 'A partes iguales', shares: 'Por partes',
    sharesHint: 'Partes por persona (quien consumió el doble toma dos partes)',
    result: 'Resultado', perPerson: 'Por persona', grand: 'Total con propina',
    copy: '📋 Copiar texto', copied: 'Copiado ✅', saveNote: '💾 Guardar como nota', saved: 'Guardado ✅',
    needAmount: 'Introduce un importe mayor que cero', needPeople: 'Añade al menos una persona',
    noteTitle: '🧾 División de cuenta',
    remainder: 'El resto se reparte entre los primeros para que el total cuadre',
  },
  zh: {
    badge: '精确计算', title: '账单分摊',
    desc: '平均或按份数分摊金额，一分不差',
    total: '总金额', tip: '小费', currency: '货币',
    people: '参与者', addPerson: '+ 添加成员', person: '成员',
    equal: '平均分摊', shares: '按份数',
    sharesHint: '每人的份数（吃了两倍的人占两份）',
    result: '结果', perPerson: '每人', grand: '含小费总计',
    copy: '📋 复制文本', copied: '已复制 ✅', saveNote: '💾 保存为笔记', saved: '已保存 ✅',
    needAmount: '请输入大于零的金额', needPeople: '至少添加一位成员',
    noteTitle: '🧾 账单分摊',
    remainder: '余数分配给排在前面的人，确保总额完全吻合',
  },
} as const;

const CURRENCIES = ['MAD', 'EUR', 'USD', 'GBP', 'SAR', 'AED', 'EGP'];

/**
 * يقسم مبلغاً (بالسنتيمات) على حصص، ويوزّع الباقي سنتيماً سنتيماً.
 * مجموع المُخرَج = المبلغ المُدخَل دائماً.
 */
export function splitCents(totalCents: number, shares: number[]): number[] {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum <= 0) return shares.map(() => 0);
  const base = shares.map(s => Math.floor((totalCents * s) / sum));
  let rest = totalCents - base.reduce((a, b) => a + b, 0);
  // الباقي أصغر من عدد الأشخاص دائماً، فسنتيم واحد لكلٍّ من الأوائل
  for (let i = 0; rest > 0; i = (i + 1) % base.length) { base[i] += 1; rest -= 1; }
  return base;
}

export default function BillSplit({ onClose }: Props) {
  const { darkMode, language, direction, addNote } = useApp();
  const S = UI[language] ?? UI.en;

  const [amount, setAmount] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [currency, setCurrency] = useState('MAD');
  const [mode, setMode] = useState<'equal' | 'shares'>('equal');
  const [people, setPeople] = useState<Person[]>([
    { id: 'p1', name: '', shares: 1 },
    { id: 'p2', name: '', shares: 1 },
  ]);
  const [flash, setFlash] = useState('');

  const calc = useMemo(() => {
    const base = Math.round((parseFloat(amount.replace(',', '.')) || 0) * 100);
    const grand = Math.round(base * (1 + tipPct / 100));
    const shares = people.map(p => (mode === 'equal' ? 1 : Math.max(1, p.shares)));
    const parts = grand > 0 && people.length ? splitCents(grand, shares) : people.map(() => 0);
    return { base, grand, parts, uneven: new Set(parts).size > 1 };
  }, [amount, tipPct, people, mode]);

  const money = (cents: number) => `${fmtNumber(cents / 100, language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  const nameOf = (p: Person, i: number) => p.name.trim() || `${S.person} ${i + 1}`;

  const summary = () => {
    const lines = [
      `${S.noteTitle} — ${money(calc.grand)}`,
      tipPct > 0 ? `${S.tip}: ${tipPct}%` : '',
      '',
      ...people.map((p, i) => `• ${nameOf(p, i)}: ${money(calc.parts[i] ?? 0)}`),
    ];
    return lines.filter(l => l !== '').join('\n');
  };

  const guard = (): boolean => {
    if (calc.base <= 0) { setFlash(S.needAmount); return false; }
    if (!people.length) { setFlash(S.needPeople); return false; }
    return true;
  };

  const doCopy = async () => {
    if (!guard()) return;
    try { await navigator.clipboard.writeText(summary()); setFlash(S.copied); void haptics.success(); }
    catch { setFlash('✕'); }
  };

  const doSave = () => {
    if (!guard()) return;
    addNote({
      title: `${S.noteTitle} — ${money(calc.grand)}`,
      content: summary(),
      type: 'note',
      projectId: null,
      tags: ['#فاتورة'],
      isPinned: false,
    });
    setFlash(S.saved);
    void haptics.success();
  };

  const card = darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const field = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-500' : 'border-gray-200 bg-white placeholder-gray-400'}`;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        dir={direction}
        className={`glass-card w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(16,185,129,0.3)] ${darkMode ? 'text-white' : 'text-gray-900'}`}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 p-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl border border-white/30">🧾</div>
            <div className="min-w-0">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 border border-white/30 uppercase tracking-wider">{S.badge}</span>
              <h2 className="text-xl font-black mt-1 truncate">{S.title}</h2>
              <p className="text-[11px] text-white/80 truncate">{S.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 shrink-0">
            <ListenButton label={S.title} darkMode={darkMode} />
            <button onClick={onClose} aria-label="✕" className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.total}</label>
              <input inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setFlash(''); }} placeholder="0.00" className={field} />
            </div>
            <div>
              <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.currency}</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={field}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.tip}: {tipPct}%</label>
            <div className="flex gap-1.5">
              {[0, 5, 10, 15, 20].map(p => (
                <button key={p} onClick={() => setTipPct(p)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-black transition ${tipPct === p ? 'bg-emerald-500 text-white' : darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5">
            {(['equal', 'shares'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition ${mode === m ? 'bg-emerald-500 text-white' : darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                {m === 'equal' ? S.equal : S.shares}
              </button>
            ))}
          </div>
          {mode === 'shares' && <p className={`text-[11px] ${muted}`}>{S.sharesHint}</p>}

          <div>
            <div className="mb-2 text-sm font-black">{S.people}</div>
            <div className="space-y-1.5">
              {people.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${card}`}>
                  <input
                    value={p.name}
                    onChange={e => setPeople(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                    placeholder={`${S.person} ${i + 1}`}
                    className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${darkMode ? 'placeholder-gray-600' : 'placeholder-gray-400'}`}
                  />
                  {mode === 'shares' && (
                    <input
                      inputMode="numeric" value={p.shares}
                      onChange={e => setPeople(prev => prev.map(x => x.id === p.id ? { ...x, shares: Math.max(1, parseInt(e.target.value, 10) || 1) } : x))}
                      className={`w-12 shrink-0 rounded-lg border px-1.5 py-1 text-center text-xs font-bold ${darkMode ? 'border-gray-700 bg-gray-950' : 'border-gray-200 bg-white'}`}
                    />
                  )}
                  <span className="shrink-0 text-xs font-black text-emerald-500">{money(calc.parts[i] ?? 0)}</span>
                  {people.length > 1 && (
                    <button onClick={() => setPeople(prev => prev.filter(x => x.id !== p.id))} aria-label="✕" className="shrink-0 text-xs opacity-50 hover:opacity-100">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setPeople(prev => [...prev, { id: `p${Date.now()}`, name: '', shares: 1 }])}
              className={`mt-2 w-full rounded-xl px-3 py-2 text-xs font-black transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
              {S.addPerson}
            </button>
          </div>

          <div className={`rounded-2xl border p-4 ${card}`}>
            <div className="flex items-center justify-between text-sm">
              <span className={`font-bold ${muted}`}>{S.grand}</span>
              <span className="text-xl font-black text-emerald-500">{money(calc.grand)}</span>
            </div>
            {calc.uneven && mode === 'equal' && <p className={`mt-2 text-[10px] ${muted}`}>{S.remainder}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={doCopy} className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>{S.copy}</button>
            <button onClick={doSave} className="rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-3 py-2.5 text-xs font-black text-white transition hover:scale-[1.01]">{S.saveNote}</button>
          </div>
          {flash && <div className="text-center text-xs font-bold text-emerald-500">{flash}</div>}
        </div>
      </div>
    </div>
  );
}
