import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { callGemini } from '../utils/geminiService';
import { CaretSafeTextarea } from './CaretSafe';

import ListenButton from './ListenButton';
interface ComparisonItem {
  name: string;
  emoji: string;
  pros: string[];
  cons: string[];
  cost: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  timeToImplement: string;
  score: number;
}

interface DecisionMatrixProps {
  onClose: () => void;
}

// قاموس التحليلات الجاهزة
const ANALYSIS_DB: Record<string, { title: string; items: ComparisonItem[]; recommendation: string; reasoning: string }> = {
  'firebase-node': {
    title: 'مقارنة: Firebase Cloud Functions مقابل سيرفر Node.js مستقل',
    items: [
      { name: 'Firebase Cloud Functions', emoji: '☁️', pros: ['سهولة الإعداد والنشر بنقرة', 'تكامل مباشر مع Firestore/Auth', 'قابلية توسع تلقائية', 'لا حاجة لإدارة الخادم', 'مجاني لحد استخدام معين'], cons: ['محدودية في التخصيص', 'Cold Start يؤثر على الأداء', 'تكاليف مرتفعة عند scale كبير', 'محدودية وقت التنفيذ (9 دقائق)'], cost: 'low', risk: 'low', timeToImplement: 'سريع (ساعات)', score: 82 },
      { name: 'سيرفر Node.js مستقل', emoji: '🖥️', pros: ['تحكم كامل في البيئة', 'مرونة مطلقة في التخصيص', 'أداء ثابت بدون Cold Start', 'تكاليف ثابتة مع VPS', 'مناسب للمشاريع المعقدة'], cons: ['يحتاج DevOps للإدارة', 'إعداد الأمان معقد', 'تكلفة استضافة إضافية', 'وقت أطول للـ setup الأولي'], cost: 'medium', risk: 'medium', timeToImplement: 'متوسط (أيام)', score: 78 }
    ],
    recommendation: 'Firebase Cloud Functions',
    reasoning: 'لمشروع Notic الحالي، Firebase هو الخيار الأمثل: سرعة في التطوير، تكامل مباشر مع Firestore وAuth، وأمان مُدار. يمكن الانتقال لسيرفر مستقل عند الحاجة لتخصيص أعلى.'
  },
  'sol-link': {
    title: 'مقارنة: Solana (SOL) مقابل Chainlink (LINK)',
    items: [
      { name: 'Solana (SOL)', emoji: '☀️', pros: ['سرعة معاملات فائقة (65K TPS)', 'رسوم شبه معدومة', 'نظام DeFi و NFT مزدهر', 'دعم مؤسسي متزايد', 'تكنولوجيا Proof of History'], cons: ['تاريخ انقطاعات الشبكة', 'مركزية نسبية في التحقق', 'منافسة شرسة من L2 Ethereum', 'تقلبات سعرية عالية'], cost: 'medium', risk: 'high', timeToImplement: 'متوسط', score: 72 },
      { name: 'Chainlink (LINK)', emoji: '🔗', pros: ['خدمة أساسية لـ 90% من DeFi', 'شراكات مع كبرى المؤسسات', 'CCIP للربط بين السلاسل', 'طلب متزايد على Oracle', 'فريق تطوير قوي ومستمر'], cons: ['منافسة من Pyth و API3', 'تأثر بسعر ETH', 'تعقيد تقني للمستثمر العادي', 'نمو بطيء نسبياً في السعر'], cost: 'medium', risk: 'medium', timeToImplement: 'متوسط', score: 85 }
    ],
    recommendation: 'تنويع المخاطر بعد بحث مستقل',
    reasoning: 'هذا التحليل تنظيمي وتعليمي فقط وليس نصيحة مالية أو دعوة للاستثمار. قبل أي قرار، راجع مصادر مستقلة، قيّم قدرتك على تحمل المخاطر، ولا تستثمر أكثر مما تستطيع خسارته.'
  },
  'react-vue': {
    title: 'مقارنة: React مقابل Vue.js مقابل Angular',
    items: [
      { name: 'React', emoji: '⚛️', pros: ['أكبر مجتمع ومكتبات', 'مرونة عالية جداً', 'React Native للتطبيقات', 'الأكثر طلباً في سوق العمل', 'Next.js للسيرفر'], cons: ['قرارات تصميمية كثيرة', 'تحديثات متواترة', 'JSX قد يزعج البعض', 'يحتاج مكتبات إضافية'], cost: 'low', risk: 'low', timeToImplement: 'سريع', score: 92 },
      { name: 'Vue.js', emoji: '💚', pros: ['سهل التعلم جداً', 'توثيق ممتاز بالعربية', 'أداء ممتاز', 'SFC منظم', 'Nuxt.js قوي'], cons: ['مجتمع أصغر', 'فرص عمل أقل', 'مكتبات أقل', 'تبني مؤسسي محدود'], cost: 'low', risk: 'low', timeToImplement: 'سريع جداً', score: 80 },
      { name: 'Angular', emoji: '🅰️', pros: ['إطار متكامل', 'TypeScript مدمج', 'مناسب للمشاريع الضخمة', 'دعم Google الرسمي', 'هيكلية واضحة'], cons: ['منحنى تعلم حاد', 'معقد للمشاريع الصغيرة', 'حجم bundle كبير', 'أداء أبطأ نسبياً'], cost: 'high', risk: 'medium', timeToImplement: 'بطيء', score: 65 }
    ],
    recommendation: 'React',
    reasoning: 'React هو الخيار الأفضل: المرونة، المجتمع الضخم، وفرص العمل. مع Vite و Tailwind، سرعة التطوير ممتازة. Vue خيار جيد للمبتدئين. Angular للمشاريع المؤسسية الكبيرة فقط.'
  }
};

export default function DecisionMatrix({ onClose }: DecisionMatrixProps) {
  const { darkMode, addNote, language } = useApp();
  const DM = {
    ar: { noteTitle: (t: string) => `📊 قرار: ${t}`, tags: ['قرار', 'تحليل', 'AI'],
          low: '🟢 منخفضة', medium: '🟡 متوسطة', high: '🔴 عالية',
          header: 'مصفوفة اتخاذ القرار', subtitle: 'تحويل التفكير العشوائي والحيرة إلى قرار واضح بمقارنة منهجية',
          inputTitle: 'اكتب حيرتك أو قرارك المحير', inputPh: 'مثال: محتار هل أستخدم Firebase Cloud Functions أم سيرفر Node.js منفصل لمشروعي؟',
          detected: 'تم اكتشاف', detTech: 'مقارنة تقنية للخوادم', detInvest: 'مقارنة استثمارية', detFramework: 'مقارنة أطر عمل',
          pickExample: 'اختر مثالاً لتجربته:', ex1: 'محتار هل أستخدم Firebase Cloud Functions أم سيرفر Node.js',
          ex2: 'أقارن بين الاستثمار في SOL أو LINK', ex3: 'أي إطار أفضل: React أم Vue أم Angular',
          analyzing: true, solve: 'حل الحيرة واتخاذ القرار', criterion: 'المعيار', cost: '💰 التكلفة', risk: '⚠️ المخاطر',
          implTime: '⏱️ وقت التنفيذ', score: '📊 التقييم', recommendation: '⭐ التوصية', pros: '✅ المميزات:', cons: '❌ العيوب:',
          finalRec: 'التوصية النهائية', newAnalysis: '{M.newAnalysis}', hideTable: '👁️ إخفاء الجدول', showTable: '📋 جدول Markdown',
          saveNote: '{M.saveNote}' },
    en: { noteTitle: (t: string) => `📊 Decision: ${t}`, tags: ['decision', 'analysis', 'AI'],
          low: '🟢 Low', medium: '🟡 Medium', high: '🔴 High',
          header: 'Decision matrix', subtitle: 'Turn scattered thinking and hesitation into a clear decision with a systematic comparison',
          inputTitle: 'Write your dilemma or tough decision', inputPh: 'Example: Should I use Firebase Cloud Functions or a separate Node.js server for my project?',
          detected: 'Detected', detTech: 'technical server comparison', detInvest: 'investment comparison', detFramework: 'framework comparison',
          pickExample: 'Pick an example to try:', ex1: 'Should I use Firebase Cloud Functions or a Node.js server',
          ex2: 'Comparing investing in SOL or LINK', ex3: 'Which framework is best: React, Vue or Angular',
          analyzing: true, solve: 'Resolve and decide', criterion: 'Criterion', cost: '💰 Cost', risk: '⚠️ Risk',
          implTime: '⏱️ Time to implement', score: '📊 Score', recommendation: '⭐ Recommendation', pros: '✅ Pros:', cons: '❌ Cons:',
          finalRec: 'Final recommendation', newAnalysis: '🔄 New analysis', hideTable: '👁️ Hide table', showTable: '📋 Markdown table',
          saveNote: '💾 Save as organized note', genTitle: 'Comparative analysis', analyzingDeep: 'Deep analysis in progress...', genPro: (n: number) => `Strength ${n}`, genCon: (n: number) => `Weakness ${n}`, undefined_: 'Unspecified', genReason: 'Based on the available data, this option seems the most balanced. Reviewing the details is recommended.', byNotic: 'Made by Notic AI Decision Matrix' },
    es: { noteTitle: (t: string) => `📊 Decisión: ${t}`, tags: ['decisión', 'análisis', 'AI'],
          low: '🟢 Bajo', medium: '🟡 Medio', high: '🔴 Alto',
          header: 'Matriz de decisión', subtitle: 'Convierte el pensamiento disperso y la duda en una decisión clara con una comparación sistemática',
          inputTitle: 'Escribe tu dilema o decisión difícil', inputPh: 'Ejemplo: ¿Debería usar Firebase Cloud Functions o un servidor Node.js separado para mi proyecto?',
          detected: 'Detectado', detTech: 'comparación técnica de servidores', detInvest: 'comparación de inversión', detFramework: 'comparación de frameworks',
          pickExample: 'Elige un ejemplo para probar:', ex1: '¿Debería usar Firebase Cloud Functions o un servidor Node.js',
          ex2: 'Comparando invertir en SOL o LINK', ex3: '¿Qué framework es mejor: React, Vue o Angular',
          analyzing: true, solve: 'Resolver y decidir', criterion: 'Criterio', cost: '💰 Costo', risk: '⚠️ Riesgo',
          implTime: '⏱️ Tiempo de implementación', score: '📊 Puntuación', recommendation: '⭐ Recomendación', pros: '✅ Ventajas:', cons: '❌ Desventajas:',
          finalRec: 'Recomendación final', newAnalysis: '🔄 Nuevo análisis', hideTable: '👁️ Ocultar tabla', showTable: '📋 Tabla Markdown',
          saveNote: '💾 Guardar como nota organizada', genTitle: 'Análisis comparativo', analyzingDeep: 'Análisis profundo en curso...', genPro: (n: number) => `Fortaleza ${n}`, genCon: (n: number) => `Debilidad ${n}`, undefined_: 'No especificado', genReason: 'Según los datos disponibles, esta opción parece la más equilibrada. Se recomienda revisar los detalles.', byNotic: 'Hecho por Notic AI Decision Matrix' },
    zh: { noteTitle: (t: string) => `📊 决策：${t}`, tags: ['决策', '分析', 'AI'],
          low: '🟢 低', medium: '🟡 中', high: '🔴 高',
          header: '决策矩阵', subtitle: '通过系统比较，将零散的思考和犹豫转化为清晰的决策',
          inputTitle: '写下你的困境或艰难决定', inputPh: '例如：我应该为项目使用 Firebase Cloud Functions 还是独立的 Node.js 服务器？',
          detected: '已检测到', detTech: '技术服务器比较', detInvest: '投资比较', detFramework: '框架比较',
          pickExample: '选择一个示例尝试：', ex1: '我应该使用 Firebase Cloud Functions 还是 Node.js 服务器',
          ex2: '比较投资 SOL 或 LINK', ex3: '哪个框架最好：React、Vue 还是 Angular',
          analyzing: true, solve: '解决困惑并决策', criterion: '标准', cost: '💰 成本', risk: '⚠️ 风险',
          implTime: '⏱️ 实施时间', score: '📊 评分', recommendation: '⭐ 推荐', pros: '✅ 优点：', cons: '❌ 缺点：',
          finalRec: '最终推荐', newAnalysis: '🔄 新分析', hideTable: '👁️ 隐藏表格', showTable: '📋 Markdown 表格',
          saveNote: '💾 保存为有条理的笔记', genTitle: '比较分析', analyzingDeep: '深度分析中...', genPro: (n: number) => `优势 ${n}`, genCon: (n: number) => `劣势 ${n}`, undefined_: '未指定', genReason: '根据可用数据，此选项似乎最均衡。建议查看详细信息。', byNotic: '由 Notic AI 决策矩阵生成' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? null;
  const M = DM ?? {
    noteTitle: (t: string) => `📊 Decision: ${t}`, tags: ['decision', 'analysis', 'AI'],
    low: '🟢 Low', medium: '🟡 Medium', high: '🔴 High',
    header: 'Decision matrix', subtitle: 'Turn scattered thinking into a clear decision with a systematic comparison',
    inputTitle: 'Write your dilemma or tough decision', inputPh: 'Example: Should I use Firebase Cloud Functions or a separate Node.js server?',
    detected: 'Detected', detTech: 'technical server comparison', detInvest: 'investment comparison', detFramework: 'framework comparison',
    pickExample: 'Pick an example to try:', ex1: 'Should I use Firebase Cloud Functions or a Node.js server',
    ex2: 'Comparing investing in SOL or LINK', ex3: 'Which framework is best: React, Vue or Angular',
    analyzing: true, solve: 'Resolve and decide', criterion: 'Criterion', cost: '💰 Cost', risk: '⚠️ Risk',
    implTime: '⏱️ Time to implement', score: '📊 Score', recommendation: '⭐ Recommendation', pros: '✅ Pros:', cons: '❌ Cons:',
    finalRec: 'Final recommendation', newAnalysis: '🔄 New analysis', hideTable: '👁️ Hide table', showTable: '📋 Markdown table',
    saveNote: '💾 Save as organized note', genTitle: 'Comparative analysis', analyzingDeep: 'Deep analysis in progress...', genPro: (n: number) => `Strength ${n}`, genCon: (n: number) => `Weakness ${n}`, undefined_: 'Unspecified', genReason: 'Based on the available data, this option seems the most balanced. Reviewing the details is recommended.', byNotic: 'Made by Notic AI Decision Matrix' };
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ title: string; items: ComparisonItem[]; recommendation: string; reasoning: string } | null>(null);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  // كشف نوع التحليل
  const detectedAnalysis = useMemo(() => {
    const t = inputText.toLowerCase();
    if (t.includes('firebase') || t.includes('node') || t.includes('سيرفر') || t.includes('cloud')) return 'firebase-node';
    if (t.includes('sol') || t.includes('link') || t.includes('عملة') || t.includes('كربتو') || t.includes('استثمار')) return 'sol-link';
    if (t.includes('react') || t.includes('vue') || t.includes('angular') || t.includes('إطار')) return 'react-vue';
    return null;
  }, [inputText]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);

    const analysisKey = detectedAnalysis;
    // المقارنات المحفوظة مسبقاً (3 أمثلة جاهزة) تظهر فوراً بلا استدعاء AI
    if (analysisKey && ANALYSIS_DB[analysisKey]) {
      setTimeout(() => {
        setResult(ANALYSIS_DB[analysisKey]);
        setIsAnalyzing(false);
      }, 600);
      return;
    }

    // ── أي مقارنة جديدة → تحليل حقيقي عبر Gemini ──────────────────────
    try {
      const lang = language === 'ar' ? 'Arabic' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Chinese' : 'English';
      const raw = await callGemini(
        `You are a decision analysis expert. The user is deciding between options. Analyze them objectively and respond ONLY with valid JSON (no markdown, no backticks) in this exact schema:
{"title":"short comparison title","items":[{"name":"option name","emoji":"single relevant emoji","pros":["pro1","pro2","pro3"],"cons":["con1","con2"],"cost":"low|medium|high","risk":"low|medium|high","timeToImplement":"short phrase","score":0-100}],"recommendation":"the best option name","reasoning":"2-3 sentence justification"}

Rules: 2-4 items max. Scores must differ and reflect real tradeoffs. Write all text in ${lang}.

User's dilemma: ${inputText.trim()}`,
        { maxTokens: 1500, temperature: 0.6, jsonMode: true, model: 'gemini-3.5-flash', functionName: 'decision-matrix' }
      );

      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      // تحقق دفاعي من البنية قبل العرض
      if (parsed?.items?.length >= 2) {
        setResult({
          title: parsed.title || M.genTitle,
          items: parsed.items.slice(0, 4).map((it: Record<string, unknown>) => ({
            name: String(it.name || '—'),
            emoji: String(it.emoji || '📌'),
            pros: Array.isArray(it.pros) ? it.pros.map(String) : [],
            cons: Array.isArray(it.cons) ? it.cons.map(String) : [],
            cost: (['low', 'medium', 'high'].includes(it.cost as string) ? it.cost : 'medium') as 'low' | 'medium' | 'high',
            risk: (['low', 'medium', 'high'].includes(it.risk as string) ? it.risk : 'medium') as 'low' | 'medium' | 'high',
            timeToImplement: String(it.timeToImplement || M.undefined_),
            score: typeof it.score === 'number' ? it.score : 75,
          })),
          recommendation: String(parsed.recommendation || parsed.items[0]?.name || ''),
          reasoning: String(parsed.reasoning || M.genReason),
        });
      } else {
        throw new Error('invalid structure');
      }
    } catch (err) {
      console.warn('[DecisionMatrix] AI analysis failed, using local fallback:', err);
      // فشل AI (لا إنترنت/حصة) → التحليل المحلي البسيط كملاذ أخير
      const items = inputText.split(/[,\nأو]|مقابل|ضد/).filter(s => s.trim().length > 2).slice(0, 4);
      if (items.length >= 2) {
        setResult({
          title: M.genTitle,
          items: items.map((item, idx) => ({
            name: item.trim(), emoji: ['⭐', '🔷', '🔶', '💎'][idx] || '📌',
            pros: [M.genPro(1), M.genPro(2)], cons: [M.genCon(1), M.genCon(2)],
            cost: (['low', 'medium', 'high'] as const)[idx % 3], risk: (['low', 'medium'] as const)[idx % 2],
            timeToImplement: M.undefined_, score: 75 - idx * 5
          })),
          recommendation: items[0].trim(),
          reasoning: M.genReason
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAsNote = () => {
    if (!result) return;

    // توليد جدول Markdown حقيقي
    const tableHeader = `| ${M.criterion} | ` + result.items.map(i => i.name).join(' | ') + ' |';
    const tableSeparator = '|---------|' + result.items.map(() => ':------:|').join('');
    const costRow = `| ${M.cost} | ` + result.items.map(i => i.cost === 'low' ? M.low : i.cost === 'medium' ? M.medium : M.high).join(' | ') + ' |';
    const riskRow = `| ${M.risk} | ` + result.items.map(i => i.risk === 'low' ? M.low : i.risk === 'medium' ? M.medium : M.high).join(' | ') + ' |';
    const timeRow = `| ${M.implTime} | ` + result.items.map(i => i.timeToImplement).join(' | ') + ' |';
    const scoreRow = `| ${M.score} | ` + result.items.map(i => `${i.score}/100`).join(' | ') + ' |';

    const markdownTable = `## 📊 ${result.title}\n\n${tableHeader}\n${tableSeparator}\n${costRow}\n${riskRow}\n${timeRow}\n${scoreRow}\n\n`;

    const detailsBreakdown = result.items.map(i => `
### ${i.emoji} ${i.name}

**${M.pros}**
${i.pros.map(p => `- ${p}`).join('\n')}

**${M.cons}**
${i.cons.map(c => `- ${c}`).join('\n')}
`).join('\n---\n');

    const recommendation = `\n## 🎯 ${M.finalRec}\n\n> **${result.recommendation}**\n>\n> ${result.reasoning}\n\n---\n*${M.byNotic}*`;

    addNote({
      title: M.noteTitle(result.title),
      content: markdownTable + detailsBreakdown + recommendation,
      type: 'note',
      projectId: null,
      tags: ['قرار', 'تحليل', 'AI'],
      isPinned: true
    });

    onClose();
  };

  const costLabels: Record<string, string> = { low: M.low, medium: M.medium, high: M.high };
  const riskLabels: Record<string, string> = { low: M.low, medium: M.medium, high: M.high };

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in shadow-[0_20px_60px_-15px_rgba(168,85,247,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              🧩
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  AI Dilemma Solver
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{M.header}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">{M.subtitle}</p>
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
          {!result ? (
            <div className="space-y-6">
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>🤔</span><span>{M.inputTitle}</span>
                </h3>
                <CaretSafeTextarea value={inputText} onChange={(e) => setInputText(e.target.value)}
                  placeholder={M.inputPh}
                  className={`w-full h-36 p-4 rounded-xl border resize-none ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 placeholder-gray-500'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
                {detectedAnalysis && (
                  <div className="mt-2 text-xs text-purple-400 flex items-center gap-1">
                    <span>✨</span> {M.detected}: {detectedAnalysis === 'firebase-node' ? M.detTech : detectedAnalysis === 'sol-link' ? M.detInvest : M.detFramework}
                  </div>
                )}
              </div>

              {/* أمثلة سريعة */}
              <div>
                <div className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{M.pickExample}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: '⚡ Firebase vs Node.js', text: M.ex1 },
                    { label: '📈 SOL vs LINK', text: M.ex2 },
                    { label: '⚛️ React vs Vue vs Angular', text: M.ex3 }
                  ].map((ex, idx) => (
                    <button key={idx} onClick={() => setInputText(ex.text)}
                      className={`p-4 rounded-xl border text-right transition-all hover:scale-105 ${
                        darkMode ? 'border-purple-500/30 hover:bg-purple-500/10' : 'border-purple-200 hover:bg-purple-50'
                      }`}>
                      <span className="block font-semibold">{ex.label}</span>
                      <span className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{ex.text}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleAnalyze} disabled={!inputText.trim() || isAnalyzing}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                {isAnalyzing ? (
                  <><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{M.analyzingDeep}</span></>
                ) : (
                  <><span>🧩</span><span>{M.solve}</span></>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-up">
              <h3 className={`text-2xl font-bold text-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {result.title}
              </h3>

              {/* جدول المقارنة */}
              <div className="overflow-x-auto">
                <table className={`w-full border-collapse rounded-xl overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <thead>
                    <tr className={darkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                      <th className="p-3 text-right text-sm">{M.criterion}</th>
                      {result.items.map((item, i) => (
                        <th key={i} className="p-3 text-center">
                          <div className="text-lg mb-1">{item.emoji}</div>
                          <div className="text-sm font-bold">{item.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
                      <td className="p-3 text-sm font-medium">{M.cost}</td>
                      {result.items.map((item, i) => (
                        <td key={i} className="p-3 text-center">{costLabels[item.cost]}</td>
                      ))}
                    </tr>
                    <tr className={darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
                      <td className="p-3 text-sm font-medium">{M.risk}</td>
                      {result.items.map((item, i) => (
                        <td key={i} className="p-3 text-center">{riskLabels[item.risk]}</td>
                      ))}
                    </tr>
                    <tr className={darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
                      <td className="p-3 text-sm font-medium">{M.implTime}</td>
                      {result.items.map((item, i) => (
                        <td key={i} className="p-3 text-center text-xs">{item.timeToImplement}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 text-sm font-medium">{M.score}</td>
                      {result.items.map((item, i) => (
                        <td key={i} className="p-3 text-center">
                          <span className={`text-lg font-bold ${
                            item.score >= 85 ? 'text-emerald-500' : item.score >= 70 ? 'text-amber-500' : 'text-red-500'
                          }`}>{item.score}/100</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* التفاصيل */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.items.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${
                    item.name === result.recommendation
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  }`}>
                    {item.name === result.recommendation && (
                      <div className="text-xs font-semibold text-purple-500 mb-2">{M.recommendation}</div>
                    )}
                    <h4 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <span>{item.emoji}</span> {item.name}
                    </h4>
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-emerald-500 mb-1">{M.pros}</div>
                      {item.pros.map((p, i) => (
                        <div key={i} className="text-xs flex items-start gap-1 mb-1">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{p}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-red-500 mb-1">{M.cons}</div>
                      {item.cons.map((c, i) => (
                        <div key={i} className="text-xs flex items-start gap-1 mb-1">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* التوصية */}
              <div className={`p-5 rounded-xl border-2 border-purple-500 ${
                darkMode ? 'bg-purple-900/20' : 'bg-purple-50'
              }`}>
                <h4 className="font-bold text-purple-500 mb-3 flex items-center gap-2 text-lg">
                  <span>🎯</span><span>{M.finalRec}</span>
                </h4>
                <div className={`text-2xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {result.recommendation}
                </div>
                <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {result.reasoning}
                </p>
              </div>

              {/* معاينة Markdown */}
              {showMarkdownPreview && (
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <pre className={`text-xs overflow-x-auto ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {`| المعيار | ${result.items.map(i => i.name).join(' | ')} |
|---------|${result.items.map(() => ':------:|').join('')}
| 💰 التكلفة | ${result.items.map(i => i.cost === 'low' ? '🟢 منخفضة' : i.cost === 'medium' ? '🟡 متوسطة' : '🔴 عالية').join(' | ')} |
| ⚠️ المخاطر | ${result.items.map(i => i.risk === 'low' ? '🟢 منخفضة' : i.risk === 'medium' ? '🟡 متوسطة' : '🔴 عالية').join(' | ')} |
| 📊 التقييم | ${result.items.map(i => `${i.score}/100`).join(' | ')} |`}
                  </pre>
                </div>
              )}

              {/* أزرار التحكم */}
              <div className="flex gap-3 pt-4">
                <button onClick={() => setResult(null)} className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  🔄 تحليل جديد
                </button>
                <button onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                  className={`px-4 py-3 rounded-xl text-sm ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {showMarkdownPreview ? M.hideTable : M.showTable}
                </button>
                <button onClick={handleSaveAsNote}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
                  💾 حفظ كملاحظة منظمة
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
