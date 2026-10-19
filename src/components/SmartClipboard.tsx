import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { aiSummarize } from '../utils/aiEngine';
import { CaretSafeTextarea } from './CaretSafe';

import ListenButton from './ListenButton';
interface ClipboardSuggestion {
  type: 'wallet' | 'link' | 'code' | 'text' | 'email' | 'phone';
  detectedContent: string;
  icon: string;
  suggestedProject: string | null;
  suggestedProjectName: string;
  action: 'save' | 'summarize' | 'extract';
  actionLabel: string;
}

interface SmartClipboardProps {
  onClose: () => void;
}

export default function SmartClipboard({ onClose }: SmartClipboardProps) {
  const { darkMode, projects, addNote, language } = useApp();
  const SC = {
    ar: { walletProj: 'المحفظة المالية', walletAction: 'تصنيفها وحفظها في مشروع',
          linksProj: 'روابط ومراجع', linksAction: 'تلخيصه وحفظه فوراً',
          codeProj: 'مقتطفات برمجية', codeAction: 'تنسيقها وحفظها في مشروع',
          contactsProj: 'جهات اتصال', emailAction: 'حفظها في', generalProj: 'ملاحظات عامة',
          textSumAction: 'تلخيصه وحفظه في', textSaveAction: 'حفظه في',
          walletTitle: '💼 عنوان محفظة رقمية', walletContent: (c: string) => `## 💼 عنوان محفظة\n\n\`\`\`\n${c}\n\`\`\`\n\n> تم الحفظ تلقائياً من الحافظة`,
          linkTitle: '🔗 رابط محفوظ', linkContent: (c: string) => `## 🔗 رابط محفوظ\n\n${c}\n\n> احفظ هذا الرابط للرجوع إليه لاحقاً`,
          codeTitle: '💻 مقتطف برمجي', codeContent: (c: string) => `## 💻 كود محفوظ من الحافظة\n\n\`\`\`\n${c}\n\`\`\`\n\n> تم الحفظ التلقائي`,
          emailContent: (c: string) => `## 📧 جهة اتصال\n\n${c}\n\n> محفوظ من الحافظة`,
          phoneContent: (c: string) => `## 📱 رقم هاتف\n\n${c}\n\n> محفوظ من الحافظة`,
          textContent: (c: string) => `## 📝 من الحافظة\n\n${c}`, noteTag: 'ملاحظة', clipTag: 'حافظة_سحرية',
          clipText: 'نص من الحافظة', sumTitle: '📄 ملخص: ', sumContent: (s: string, c: string) => `## 📄 ملخص ذكي\n\n${s}\n\n---\n\n### النص الأصلي\n${c}\n\n> تم التلخيص بواسطة AI`,
          sumTag: 'ملخص', saved: 'تم الحفظ بنجاح!', savedDesc: (sum: boolean) => `تم حفظ المحتوى ${sum ? 'وتلخيصه' : ''}`,
          another: 'نسخ آخر', done: 'تم', header: 'الحافظة الذكية',
          autoYes: 'تم اكتشاف نص منسوخ تلقائياً وتحليله بذكاء', autoNo: 'تحليل ذكي وتصنيف تلقائي للنصوص المنسوخة',
          noticed: 'لقد لاحظت أنك نسخت', want: 'هل تريد مني', pastePh: 'أو الصق أي نص هنا...',
          summarize: 'تلخيص وحفظ', saveToNotebook: 'حفظ في المفكرة', ignore: 'تجاهل',
          emptyHint: 'انسخ أي نص من أي تطبيق، ثم افتح هذه النافذة وسأقوم بتحليله تلقائياً', summarizing: 'جاري التلخيص...', saving: 'جاري الحفظ...' },
    en: { walletProj: 'Finance wallet', walletAction: 'classify and save it in a project',
          linksProj: 'Links & references', linksAction: 'summarize and save it now',
          codeProj: 'Code snippets', codeAction: 'format and save it in a project',
          contactsProj: 'Contacts', emailAction: 'save it in', generalProj: 'General notes',
          textSumAction: 'summarize and save it in', textSaveAction: 'save it in',
          walletTitle: '💼 Digital wallet address', walletContent: (c: string) => `## 💼 Wallet address\n\n\`\`\`\n${c}\n\`\`\`\n\n> Saved automatically from clipboard`,
          linkTitle: '🔗 Saved link', linkContent: (c: string) => `## 🔗 Saved link\n\n${c}\n\n> Save this link for later reference`,
          codeTitle: '💻 Code snippet', codeContent: (c: string) => `## 💻 Code saved from clipboard\n\n\`\`\`\n${c}\n\`\`\`\n\n> Saved automatically`,
          emailContent: (c: string) => `## 📧 Contact\n\n${c}\n\n> Saved from clipboard`,
          phoneContent: (c: string) => `## 📱 Phone number\n\n${c}\n\n> Saved from clipboard`,
          textContent: (c: string) => `## 📝 From clipboard\n\n${c}`, noteTag: 'note', clipTag: 'magic_clipboard',
          clipText: 'Text from clipboard', sumTitle: '📄 Summary: ', sumContent: (s: string, c: string) => `## 📄 Smart summary\n\n${s}\n\n---\n\n### Original text\n${c}\n\n> Summarized by AI`,
          sumTag: 'summary', saved: 'Saved successfully!', savedDesc: (sum: boolean) => `Content saved${sum ? ' and summarized' : ''}`,
          another: 'Copy another', done: 'Done', header: 'Smart clipboard',
          autoYes: 'Copied text detected and analyzed automatically', autoNo: 'Smart analysis and auto-classification of copied text',
          noticed: 'I noticed you copied', want: 'Would you like me to', pastePh: 'Or paste any text here...',
          summarize: 'Summarize & save', saveToNotebook: 'Save to notebook', ignore: 'Ignore',
          emptyHint: 'Copy any text from any app, then open this window and I will analyze it automatically', summarizing: 'Summarizing...', saving: 'Saving...' },
    es: { walletProj: 'Cartera financiera', walletAction: 'clasificarla y guardarla en un proyecto',
          linksProj: 'Enlaces y referencias', linksAction: 'resumirlo y guardarlo ahora',
          codeProj: 'Fragmentos de código', codeAction: 'formatearla y guardarla en un proyecto',
          contactsProj: 'Contactos', emailAction: 'guardarla en', generalProj: 'Notas generales',
          textSumAction: 'resumirlo y guardarlo en', textSaveAction: 'guardarlo en',
          walletTitle: '💼 Dirección de cartera digital', walletContent: (c: string) => `## 💼 Dirección de cartera\n\n\`\`\`\n${c}\n\`\`\`\n\n> Guardado automáticamente del portapapeles`,
          linkTitle: '🔗 Enlace guardado', linkContent: (c: string) => `## 🔗 Enlace guardado\n\n${c}\n\n> Guarda este enlace para más tarde`,
          codeTitle: '💻 Fragmento de código', codeContent: (c: string) => `## 💻 Código guardado del portapapeles\n\n\`\`\`\n${c}\n\`\`\`\n\n> Guardado automáticamente`,
          emailContent: (c: string) => `## 📧 Contacto\n\n${c}\n\n> Guardado del portapapeles`,
          phoneContent: (c: string) => `## 📱 Número de teléfono\n\n${c}\n\n> Guardado del portapapeles`,
          textContent: (c: string) => `## 📝 Del portapapeles\n\n${c}`, noteTag: 'nota', clipTag: 'portapapeles_mágico',
          clipText: 'Texto del portapapeles', sumTitle: '📄 Resumen: ', sumContent: (s: string, c: string) => `## 📄 Resumen inteligente\n\n${s}\n\n---\n\n### Texto original\n${c}\n\n> Resumido por IA`,
          sumTag: 'resumen', saved: '¡Guardado con éxito!', savedDesc: (sum: boolean) => `Contenido guardado${sum ? ' y resumido' : ''}`,
          another: 'Copiar otro', done: 'Hecho', header: 'Portapapeles inteligente',
          autoYes: 'Texto copiado detectado y analizado automáticamente', autoNo: 'Análisis inteligente y clasificación automática del texto copiado',
          noticed: 'Noté que copiaste', want: '¿Quieres que', pastePh: 'O pega cualquier texto aquí...',
          summarize: 'Resumir y guardar', saveToNotebook: 'Guardar en el cuaderno', ignore: 'Ignorar',
          emptyHint: 'Copia cualquier texto de cualquier app, luego abre esta ventana y lo analizaré automáticamente', summarizing: 'Resumiendo...', saving: 'Guardando...' },
    zh: { walletProj: '财务钱包', walletAction: '分类并保存到项目',
          linksProj: '链接与参考', linksAction: '立即总结并保存',
          codeProj: '代码片段', codeAction: '格式化并保存到项目',
          contactsProj: '联系人', emailAction: '保存到', generalProj: '通用笔记',
          textSumAction: '总结并保存到', textSaveAction: '保存到',
          walletTitle: '💼 数字钱包地址', walletContent: (c: string) => `## 💼 钱包地址\n\n\`\`\`\n${c}\n\`\`\`\n\n> 已从剪贴板自动保存`,
          linkTitle: '🔗 已保存的链接', linkContent: (c: string) => `## 🔗 已保存的链接\n\n${c}\n\n> 保存此链接以便日后参考`,
          codeTitle: '💻 代码片段', codeContent: (c: string) => `## 💻 从剪贴板保存的代码\n\n\`\`\`\n${c}\n\`\`\`\n\n> 已自动保存`,
          emailContent: (c: string) => `## 📧 联系人\n\n${c}\n\n> 已从剪贴板保存`,
          phoneContent: (c: string) => `## 📱 电话号码\n\n${c}\n\n> 已从剪贴板保存`,
          textContent: (c: string) => `## 📝 来自剪贴板\n\n${c}`, noteTag: '笔记', clipTag: '魔法剪贴板',
          clipText: '剪贴板中的文本', sumTitle: '📄 摘要：', sumContent: (s: string, c: string) => `## 📄 智能摘要\n\n${s}\n\n---\n\n### 原文\n${c}\n\n> 由 AI 总结`,
          sumTag: '摘要', saved: '保存成功！', savedDesc: (sum: boolean) => `内容已保存${sum ? '并总结' : ''}`,
          another: '复制另一个', done: '完成', header: '智能剪贴板',
          autoYes: '已自动检测并分析复制的文本', autoNo: '智能分析并自动分类复制的文本',
          noticed: '我注意到你复制了', want: '你想让我', pastePh: '或在此粘贴任何文本...',
          summarize: '总结并保存', saveToNotebook: '保存到笔记本', ignore: '忽略',
          emptyHint: '从任何应用复制任意文本，然后打开此窗口，我会自动分析', summarizing: '正在总结...', saving: '正在保存...' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? null;
  const C = SC ?? {
    walletProj: 'Finance wallet', walletAction: 'classify and save it in a project',
    linksProj: 'Links & references', linksAction: 'summarize and save it now',
    codeProj: 'Code snippets', codeAction: 'format and save it in a project',
    contactsProj: 'Contacts', emailAction: 'save it in', generalProj: 'General notes',
    textSumAction: 'summarize and save it in', textSaveAction: 'save it in',
    walletTitle: '💼 Digital wallet address', walletContent: (c: string) => `## 💼 Wallet address\n\n\`\`\`\n${c}\n\`\`\`\n\n> Saved automatically from clipboard`,
    linkTitle: '🔗 Saved link', linkContent: (c: string) => `## 🔗 Saved link\n\n${c}\n\n> Save this link for later`,
    codeTitle: '💻 Code snippet', codeContent: (c: string) => `## 💻 Code saved\n\n\`\`\`\n${c}\n\`\`\`\n\n> Saved`,
    emailContent: (c: string) => `## 📧 Contact\n\n${c}\n\n> Saved from clipboard`,
    phoneContent: (c: string) => `## 📱 Phone number\n\n${c}\n\n> Saved from clipboard`,
    textContent: (c: string) => `## 📝 From clipboard\n\n${c}`, noteTag: 'note', clipTag: 'magic_clipboard',
    clipText: 'Text from clipboard', sumTitle: '📄 Summary: ', sumContent: (s: string, c: string) => `## 📄 Smart summary\n\n${s}\n\n---\n\n### Original text\n${c}\n\n> Summarized by AI`,
    sumTag: 'summary', saved: 'Saved successfully!', savedDesc: (sum: boolean) => `Content saved${sum ? ' and summarized' : ''}`,
    another: 'Copy another', done: 'Done', header: 'Smart clipboard',
    autoYes: 'Copied text detected and analyzed automatically', autoNo: 'Smart analysis and auto-classification of copied text',
    noticed: 'I noticed you copied', want: 'Would you like me to', pastePh: 'Or paste any text here...',
    summarize: 'Summarize & save', saveToNotebook: 'Save to notebook', ignore: 'Ignore',
    emptyHint: 'Copy any text from any app, then open this window and I will analyze it automatically', summarizing: 'Summarizing...', saving: 'Saving...' };
  const [clipboardText, setClipboardText] = useState('');
  const [suggestion, setSuggestion] = useState<ClipboardSuggestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // الاتصال التلقائي بالحافظة عند فتح المكون
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim().length > 3) {
            setClipboardText(text);
            const analysis = analyzeClipboard(text);
            if (analysis) {
              setSuggestion(analysis);
              setAutoDetected(true);
            }
          }
        }
      } catch {
        // لا يمكن الوصول للحافظة - المستخدم سيلصق يدوياً
      }
    };
    checkClipboard();
  }, []);

  // تحليل النص المنسوخ
  const analyzeClipboard = useCallback((text: string): ClipboardSuggestion | null => {
    if (!text.trim() || text.trim().length < 3) return null;

    const projectWallet = projects.find(p => 
      ['محفظة','wallet','مالي','cartera','钱包','finance','财务'].some(w => p.name.toLowerCase().includes(w.toLowerCase()))
    );
    const projectLinks = projects.find(p => 
      ['روابط','links','مراجع','enlaces','链接','references'].some(w => p.name.toLowerCase().includes(w.toLowerCase()))
    );
    const projectCode = projects.find(p => 
      ['كود','برمجة','code','código','代码'].some(w => p.name.toLowerCase().includes(w.toLowerCase()))
    );

    // كشف عناوين المحافظ الرقمية
    const walletPatterns = [/0x[a-fA-F0-9]{40}/, /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/, /[A-Z0-9]{42,45}/, /addr1[a-z0-9]+/i];
    if (walletPatterns.some(p => p.test(text))) {
      return {
        type: 'wallet', detectedContent: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        icon: '💼', suggestedProject: projectWallet?.id || null,
        suggestedProjectName: projectWallet?.name || C.walletProj,
        action: 'save', actionLabel: C.walletAction
      };
    }

    // كشف الروابط
    if (/https?:\/\/[^\s]+/.test(text)) {
      return {
        type: 'link', detectedContent: text,
        icon: '🔗', suggestedProject: projectLinks?.id || null,
        suggestedProjectName: projectLinks?.name || C.linksProj,
        action: 'summarize', actionLabel: C.linksAction
      };
    }

    // كشف الأكواد البرمجية
    const codePatterns = [/function\s+\w+\s*\(/, /const\s+\w+\s*=\s*[\(\[\{]/, /import\s+.*\s+from/, /class\s+\w+/, /<\/?[a-z][\s\S]*>/i, /\{[\s\S]*=>[\s\S]*\}/];
    if (codePatterns.some(p => p.test(text))) {
      return {
        type: 'code', detectedContent: text.substring(0, 100) + '...',
        icon: '💻', suggestedProject: projectCode?.id || null,
        suggestedProjectName: projectCode?.name || C.codeProj,
        action: 'save', actionLabel: C.codeAction
      };
    }

    // كشف البريد الإلكتروني
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      return {
        type: 'email', detectedContent: emailMatch[0],
        icon: '📧', suggestedProject: null, suggestedProjectName: C.contactsProj,
        action: 'save', actionLabel: C.emailAction
      };
    }

    // كشف أرقام الهواتف
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    if (phoneMatch) {
      return {
        type: 'phone', detectedContent: phoneMatch[0],
        icon: '📱', suggestedProject: null, suggestedProjectName: C.contactsProj,
        action: 'save', actionLabel: C.emailAction
      };
    }

    // نص عادي طويل
    if (text.length > 100) {
      return {
        type: 'text', detectedContent: text.substring(0, 100) + '...',
        icon: '📝', suggestedProject: null, suggestedProjectName: C.generalProj,
        action: 'summarize', actionLabel: C.textSumAction
      };
    }

    return {
      type: 'text', detectedContent: text,
      icon: '📝', suggestedProject: null, suggestedProjectName: C.generalProj,
      action: 'save', actionLabel: C.textSaveAction
    };
  }, [projects, C]);

  // معالجة النص الملصوق يدوياً
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.trim()) {
      setTimeout(() => {
        setClipboardText(text);
        setSuggestion(analyzeClipboard(text));
      }, 50);
    }
  };

  const handleTextChange = (text: string) => {
    setClipboardText(text);
    if (text.trim()) {
      setSuggestion(analyzeClipboard(text));
    }
  };

  // حفظ الملاحظة
  const handleSave = () => {
    if (!clipboardText.trim()) return;
    setIsProcessing(true);

    setTimeout(() => {
      let content = clipboardText;
      let title = '';

      switch (suggestion?.type) {
        case 'wallet':
          title = C.walletTitle;
          content = C.walletContent(clipboardText);
          break;
        case 'link':
          title = C.linkTitle;
          content = C.linkContent(clipboardText);
          break;
        case 'code':
          title = C.codeTitle;
          content = C.codeContent(clipboardText);
          break;
        case 'email':
          title = `📧 ${clipboardText}`;
          content = C.emailContent(clipboardText);
          break;
        case 'phone':
          title = `📱 ${clipboardText}`;
          content = C.phoneContent(clipboardText);
          break;
        default:
          title = clipboardText.substring(0, 40) + (clipboardText.length > 40 ? '...' : '');
          content = C.textContent(clipboardText);
      }

      addNote({
        title, content, type: 'note',
        projectId: suggestion?.suggestedProject || null,
        tags: [suggestion?.type || C.noteTag, C.clipTag],
        isPinned: false
      });

      setIsProcessing(false);
      setSavedSuccessfully(true);
    }, 800);
  };

  const handleSummarize = async () => {
    if (!clipboardText.trim()) return;
    setIsProcessing(true);

    // تلخيص Gemini حقيقي (مع fallback محلي داخل aiSummarize)
    const summary = await aiSummarize(C.clipText, clipboardText);

    addNote({
      title: C.sumTitle + clipboardText.substring(0, 30) + '...',
      content: C.sumContent(summary, clipboardText),
      type: 'note',
      projectId: suggestion?.suggestedProject || null,
      tags: [C.sumTag, C.clipTag, 'AI'],
      isPinned: false
    });

    setIsProcessing(false);
    setSavedSuccessfully(true);
  };

  // شاشة النجاح
  if (savedSuccessfully) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
        <div className={`p-6 rounded-2xl shadow-2xl border backdrop-blur-xl ${
          darkMode ? 'bg-emerald-900/95 border-emerald-700/50 text-white' : 'bg-white/95 border-emerald-200 text-gray-900'
        } max-w-sm`}>
          <div className="text-center space-y-3">
            <div className="text-5xl animate-bounce">✅</div>
            <h3 className="font-bold text-lg">{C.saved}</h3>
            <p className="text-sm opacity-70">{C.savedDesc(suggestion?.type === 'link')}{' '} في مفكرتك</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setClipboardText(''); setSuggestion(null); setSavedSuccessfully(false); setAutoDetected(false); }}
                className={`flex-1 py-2 rounded-xl text-sm ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {C.another}
              </button>
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl text-sm bg-emerald-500 hover:bg-emerald-600 text-white">
                {C.done}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // البطاقة الرئيسية الفاخرة
  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-end sm:items-center justify-center p-4" data-listen-scope onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`glass-card w-full max-w-lg rounded-3xl overflow-hidden animate-scale-in shadow-[0_20px_60px_-15px_rgba(6,182,212,0.2)] ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        {/* الرأس الفاخر */}
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-teal-500 to-blue-600 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner border border-white/30">
              {suggestion ? suggestion.icon : '📋'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white uppercase tracking-wider">
                  AI Clipboard Interceptor
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{C.header}</h2>
              <p className="text-xs text-white/85 font-medium mt-0.5 max-w-md">
                {autoDetected ? C.autoYes : C.autoNo}
              </p>
            </div>
          </div>
          <ListenButton style="calm" darkMode={darkMode} className="me-1" label="استمع للمحتوى" />
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
        <div className="p-5 space-y-4">
          {/* الرسالة الذكية */}
          {suggestion && (
            <div className={`p-4 rounded-xl border ${
              darkMode ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{suggestion.icon}</span>
                <div>
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold text-cyan-500">{C.noticed}{' '} {suggestion.type === 'wallet' ? 'عنوان محفظة رقمية' : suggestion.type === 'link' ? 'رابطاً' : suggestion.type === 'code' ? 'كوداً برمجياً' : suggestion.type === 'email' ? 'بريداً إلكترونياً' : suggestion.type === 'phone' ? 'رقم هاتف' : 'نصاً'}،</span>
                    {' '}{C.want} {suggestion.actionLabel} <span className="font-semibold">[{suggestion.suggestedProjectName}]</span>{suggestion.action === 'summarize' ? '؟' : '؟'}
                  </p>
                  <div className={`mt-2 p-2 rounded-lg text-xs ${darkMode ? 'bg-gray-800' : 'bg-white'} line-clamp-2`}>
                    {suggestion.detectedContent}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* حقل النص */}
          <div>
            <CaretSafeTextarea
              value={clipboardText}
              onChange={(e) => handleTextChange(e.target.value)}
              onPaste={handlePaste}
              placeholder={C.pastePh}
              className={`w-full h-24 p-3 rounded-xl border resize-none text-sm ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 placeholder-gray-400'
              } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
            />
          </div>

          {/* أزرار التحكم */}
          {suggestion && (
            <div className="flex gap-2">
              {suggestion.action === 'summarize' ? (
                <button onClick={handleSummarize} disabled={isProcessing}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {isProcessing ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{C.summarizing}</span></>
                  ) : (
                    <><span>✨</span><span>{C.summarize}</span></>
                  )}
                </button>
              ) : (
                <button onClick={handleSave} disabled={isProcessing}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {isProcessing ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{C.saving}</span></>
                  ) : (
                    <><span>💾</span><span>{C.saveToNotebook}</span></>
                  )}
                </button>
              )}
              <button onClick={() => { setClipboardText(''); setSuggestion(null); setAutoDetected(false); }}
                className={`px-4 py-3 rounded-xl text-sm ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {C.ignore}
              </button>
            </div>
          )}

          {!suggestion && !clipboardText && (
            <div className="text-center py-4 space-y-2">
              <div className="text-4xl">📋</div>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {C.emptyHint}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
