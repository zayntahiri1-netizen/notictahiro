/**
 * UnitConverter.tsx — محوّل الوحدات
 * ───────────────────────────────────────────────────────────────────────
 * طول ووزن وحرارة ومساحة وحجم وسرعة وبيانات. حسابٌ محلّي بحت: لا شبكة،
 * ولا مفاتيح، ولا شيء يُرسَل. فيعمل في الطائرة كما يعمل في البيت.
 *
 * اخترتُ الوحدات دون العملات عمداً: أسعار الصرف تحتاج اتصالاً، ورقمٌ
 * قديم في محوّل عملة أسوأ من غياب المحوّل — أما معاملات الوحدات فثابتة
 * لا تَقدُم.
 *
 * ⚠️ الحرارة ليست ضرباً في معامل (صفرها ليس صفراً مشتركاً)، فلها مسار
 *    حسابي خاص. خلطها مع الباقي خطأٌ شائع يُنتج أرقاماً معقولة المظهر
 *    وخاطئة تماماً.
 */
import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmtNumber } from '../utils/dateLocale';
import * as haptics from '../utils/haptics';
import ListenButton from './ListenButton';

interface Props { onClose: () => void }

type CatId = 'length' | 'mass' | 'temp' | 'area' | 'volume' | 'speed' | 'data';

/** معاملات التحويل إلى الوحدة الأساس لكل فئة. */
const FACTORS: Record<Exclude<CatId, 'temp'>, Record<string, number>> = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  mass:   { mg: 0.000001, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237 },
  area:   { 'cm²': 0.0001, 'm²': 1, ha: 10000, 'km²': 1000000, 'ft²': 0.09290304, ac: 4046.8564224 },
  volume: { ml: 0.001, l: 1, 'm³': 1000, tsp: 0.00492892159375, tbsp: 0.01478676478125, cup: 0.2365882365, gal: 3.785411784 },
  speed:  { 'm/s': 1, 'km/h': 0.2777777777777778, mph: 0.44704, kn: 0.5144444444444445 },
  data:   { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
};

const TEMP_UNITS = ['°C', '°F', 'K'];

/** الحرارة لها إزاحة، فلا تصحّ فيها قسمة المعاملات. */
function convertTemp(v: number, from: string, to: string): number {
  const c = from === '°C' ? v : from === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
  return to === '°C' ? c : to === '°F' ? c * 9 / 5 + 32 : c + 273.15;
}

export function convert(v: number, from: string, to: string, cat: CatId): number {
  if (cat === 'temp') return convertTemp(v, from, to);
  const f = FACTORS[cat];
  const a = f[from], b = f[to];
  if (!a || !b) return NaN;
  return (v * a) / b;
}

const UI = {
  ar: {
    badge: 'بلا إنترنت', title: 'محوّل الوحدات',
    desc: 'طول ووزن وحرارة ومساحة وحجم وسرعة وبيانات — حساب محلي بالكامل',
    from: 'من', to: 'إلى', swap: '⇅ بدّل', copy: '📋 نسخ', copied: 'نُسخ ✅',
    cats: { length: 'طول', mass: 'وزن', temp: 'حرارة', area: 'مساحة', volume: 'حجم', speed: 'سرعة', data: 'بيانات' },
  },
  en: {
    badge: 'Offline', title: 'Unit converter',
    desc: 'Length, mass, temperature, area, volume, speed and data — computed entirely on device',
    from: 'From', to: 'To', swap: '⇅ Swap', copy: '📋 Copy', copied: 'Copied ✅',
    cats: { length: 'Length', mass: 'Mass', temp: 'Temp', area: 'Area', volume: 'Volume', speed: 'Speed', data: 'Data' },
  },
  es: {
    badge: 'Sin conexión', title: 'Conversor de unidades',
    desc: 'Longitud, masa, temperatura, área, volumen, velocidad y datos — todo en el dispositivo',
    from: 'De', to: 'A', swap: '⇅ Invertir', copy: '📋 Copiar', copied: 'Copiado ✅',
    cats: { length: 'Longitud', mass: 'Masa', temp: 'Temp.', area: 'Área', volume: 'Volumen', speed: 'Velocidad', data: 'Datos' },
  },
  zh: {
    badge: '离线可用', title: '单位换算',
    desc: '长度、质量、温度、面积、体积、速度与数据 — 完全在本机计算',
    from: '从', to: '到', swap: '⇅ 互换', copy: '📋 复制', copied: '已复制 ✅',
    cats: { length: '长度', mass: '质量', temp: '温度', area: '面积', volume: '体积', speed: '速度', data: '数据' },
  },
} as const;

const CATS: CatId[] = ['length', 'mass', 'temp', 'area', 'volume', 'speed', 'data'];
const unitsOf = (c: CatId): string[] => (c === 'temp' ? TEMP_UNITS : Object.keys(FACTORS[c]));

export default function UnitConverter({ onClose }: Props) {
  const { darkMode, language, direction } = useApp();
  const S = UI[language] ?? UI.en;

  const [cat, setCat] = useState<CatId>('length');
  const [from, setFrom] = useState('m');
  const [to, setTo] = useState('ft');
  const [value, setValue] = useState('1');
  const [flash, setFlash] = useState('');

  const pickCat = (c: CatId) => {
    const u = unitsOf(c);
    setCat(c);
    setFrom(u[0]);
    setTo(u[1] ?? u[0]);
    setFlash('');
  };

  const out = useMemo(() => {
    const v = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(v)) return '';
    const r = convert(v, from, to, cat);
    if (!Number.isFinite(r)) return '';
    // أرقامٌ صغيرة جداً تحتاج خانات أكثر، والكبيرة تحتاج أقلّ
    const abs = Math.abs(r);
    const digits = abs !== 0 && abs < 0.01 ? 8 : abs < 1 ? 6 : abs < 1000 ? 4 : 2;
    return fmtNumber(r, language, { maximumFractionDigits: digits });
  }, [value, from, to, cat, language]);

  const swap = () => { haptics.tap('light'); setFrom(to); setTo(from); };

  const doCopy = async () => {
    if (!out) return;
    try { await navigator.clipboard.writeText(`${value} ${from} = ${out} ${to}`); setFlash(S.copied); void haptics.success(); }
    catch { setFlash('✕'); }
  };

  const card = darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const field = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white' : 'border-gray-200 bg-white'}`;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        dir={direction}
        className={`glass-card w-full max-w-xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(99,102,241,0.3)] ${darkMode ? 'text-white' : 'text-gray-900'}`}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 p-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl border border-white/30">📏</div>
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
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(c => (
              <button key={c} onClick={() => pickCat(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${cat === c ? 'bg-indigo-500 text-white' : darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
                {S.cats[c]}
              </button>
            ))}
          </div>

          <div>
            <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.from}</label>
            <div className="flex gap-2">
              <input inputMode="decimal" value={value} onChange={e => { setValue(e.target.value); setFlash(''); }} className={`${field} flex-1`} />
              <select value={from} onChange={e => setFrom(e.target.value)} className={`${field} w-28 shrink-0`}>
                {unitsOf(cat).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <button onClick={swap} className={`w-full rounded-xl px-3 py-2 text-xs font-black transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
            {S.swap}
          </button>

          <div>
            <label className={`mb-1 block text-[11px] font-bold ${muted}`}>{S.to}</label>
            <div className="flex gap-2">
              <div className={`flex-1 rounded-xl border px-3 py-2.5 text-lg font-black text-indigo-500 ${card} truncate`} dir="ltr">
                {out || '—'}
              </div>
              <select value={to} onChange={e => setTo(e.target.value)} className={`${field} w-28 shrink-0`}>
                {unitsOf(cat).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <button onClick={doCopy} disabled={!out} className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 py-2.5 text-xs font-black text-white transition hover:scale-[1.01] disabled:opacity-40">
            {S.copy}
          </button>
          {flash && <div className="text-center text-xs font-bold text-indigo-500">{flash}</div>}
        </div>
      </div>
    </div>
  );
}
