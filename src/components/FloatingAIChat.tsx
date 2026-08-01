/**
 * FloatingAIChat.tsx — مساعد Tahiro AI كنافذة عائمة مستقلة
 * ─────────────────────────────────────────────────────────────────────
 * - أيقونة عائمة دائمة أسفل يسار الشاشة (قابلة للسحب)
 * - الضغط عليها يفتح نافذة محادثة مستقلة (floating window) قابلة للسحب
 *   والتصغير/التكبير — منفصلة تماماً عن باقي صفحات التطبيق
 * - تستخدم نفس محرك geminiChat القوي مع سياق غني (ملاحظات/ديون/معاملات)
 *
 * يُستخدَم في App.tsx كطبقة عُليا دائمة (مستقلة عن التنقّل بين الصفحات).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { geminiChat, geminiTranscribeAudio, type GeminiMessage } from '../utils/geminiService';
import { generateProactiveInsights, type ProactiveInsight } from '../utils/proactiveInsights';
import { CaretSafeInput } from './CaretSafe';
import { useBannerHeight } from './AdBanner';
import ListenButton from './ListenButton';

interface ChatMsg {
  role: 'user' | 'model';
  content: string;
}

export default function FloatingAIChat() {
  const { darkMode, notes, debtsCredits, transactions, language, addNote, addProject, projects, addDebtCredit, addTransaction } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  // ارتفاع البانر كحالة React (وليس متغيّر CSS): يضمن إعادة الرسم فور
  // تغيّره، ولا يبقى صفراً إن تأخّر حدث SizeChanged.
  const bannerH = useBannerHeight();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeRef = useRef<string>('audio/webm');

  // الإجراءات المعلّقة التي تنتظر تأكيد المستخدم (إضافة دين/معاملة/ملاحظة…)
  interface PendingAction {
    id: string;
    label: string;       // وصف ودّي يظهر للمستخدم
    run: () => void;     // التنفيذ الفعلي عند التأكيد
  }
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  // موضع الأيقونة العائمة (أسفل يسار افتراضياً)
  const [fabPos, setFabPos] = useState({ x: 16, y: 0 });
  const fabDragging = useRef(false);
  const fabMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── النصوص متعددة اللغات ────────────────────────────────────────
  const T = {
    ar: {
      title: 'Tahiro AI',
      placeholder: 'اكتب رسالتك… أو "أنشئ ملاحظة عن…"',
      send: 'إرسال',
      greeting: 'مرحباً! أنا **Tahiro AI** — مساعدك الذكي الشامل.\n\nأستطيع:\n• 📝 إنشاء ملاحظات/أفكار/مشاريع بأمرك\n• 🌐 البحث في الإنترنت (فعّل 🔍)\n• 💰 تحليل ديونك ومعاملاتك\n• 🎯 التخطيط والتنظيم\n• ✍️ صياغة الرسائل والتقارير\n\nكيف أساعدك؟',
      thinking: '⏳ يفكّر…',
      searching: '🔍 يبحث في الإنترنت…',
      clear: 'محادثة جديدة',
      searchOff: '🔍 بحث الإنترنت: إيقاف',
      searchOn: '🌐 بحث الإنترنت: تشغيل',
      err: 'تعذّر الاتصال. حاول مرة أخرى.',
    },
    en: {
      title: 'Tahiro AI',
      placeholder: 'Type your message… or "Create a note about…"',
      send: 'Send',
      greeting: 'Hi! I\'m **Tahiro AI** — your comprehensive smart assistant.\n\nI can:\n• 📝 Create notes/ideas/projects on command\n• 🌐 Search the internet (enable 🔍)\n• 💰 Analyze your debts & transactions\n• 🎯 Plan and organize\n• ✍️ Draft messages and reports\n\nHow can I help?',
      thinking: '⏳ Thinking…',
      searching: '🔍 Searching the web…',
      clear: 'New chat',
      searchOff: '🔍 Web search: Off',
      searchOn: '🌐 Web search: On',
      err: 'Connection failed. Try again.',
    },
    es: {
      title: 'Tahiro AI',
      placeholder: 'Escribe tu mensaje… o "Crea una nota sobre…"',
      send: 'Enviar',
      greeting: '¡Hola! Soy **Tahiro AI** — tu asistente inteligente completo.\n\nPuedo:\n• 📝 Crear notas/ideas/proyectos\n• 🌐 Buscar en internet (activa 🔍)\n• 💰 Analizar tus deudas y transacciones\n• 🎯 Planificar y organizar\n• ✍️ Redactar mensajes e informes\n\n¿Cómo puedo ayudarte?',
      thinking: '⏳ Pensando…',
      searching: '🔍 Buscando en internet…',
      clear: 'Nuevo chat',
      searchOff: '🔍 Búsqueda web: Off',
      searchOn: '🌐 Búsqueda web: On',
      err: 'Error de conexión. Inténtalo de nuevo.',
    },
    zh: {
      title: 'Tahiro AI',
      placeholder: '输入消息…或"创建关于…的笔记"',
      send: '发送',
      greeting: '你好！我是 **Tahiro AI** — 你的全能智能助手。\n\n我能：\n• 📝 按命令创建笔记/想法/项目\n• 🌐 搜索互联网（启用🔍）\n• 💰 分析您的债务和交易\n• 🎯 计划和组织\n• ✍️ 起草消息和报告\n\n我能帮您什么？',
      thinking: '⏳ 思考中…',
      searching: '🔍 搜索网络中…',
      clear: '新对话',
      searchOff: '🔍 网络搜索：关闭',
      searchOn: '🌐 网络搜索：开启',
      err: '连接失败，请重试。',
    },
  }[(language as 'ar' | 'en' | 'es' | 'zh')] ?? null as never;
  const S = T ?? { title: 'Tahiro AI', placeholder: 'Type…', send: 'Send', greeting: "Hi! I'm Tahiro AI.", thinking: '⏳ Thinking…', searching: '🔍 Searching…', clear: 'New chat', searchOff: '🔍 Search: Off', searchOn: '🌐 Search: On', err: 'Connection failed.' };
  const isRTL = language === 'ar';

  // ضبط موضع الأيقونة الابتدائي أسفل الشاشة
  useEffect(() => {
    setFabPos({ x: 16, y: window.innerHeight - 150 });
  }, []);

  // التمرير للأسفل عند رسالة جديدة
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // فتح النافذة عند طلب خارجي (من الفقعة العائمة Android أو أي زر آخر)
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('open-tahiro-ai', open);
    return () => window.removeEventListener('open-tahiro-ai', open);
  }, []);

  // ─── سحب الأيقونة العائمة ─────────────────────────────────────────
  const onFabPointerDown = (e: React.PointerEvent) => {
    fabDragging.current = true;
    fabMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, px: fabPos.x, py: fabPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onFabPointerMove = (e: React.PointerEvent) => {
    if (!fabDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) fabMoved.current = true;
    const nx = Math.max(8, Math.min(window.innerWidth - 64, dragStart.current.px + dx));
    const ny = Math.max(60, Math.min(window.innerHeight - 80, dragStart.current.py + dy));
    setFabPos({ x: nx, y: ny });
  };
  const onFabPointerUp = () => {
    fabDragging.current = false;
    if (!fabMoved.current) setIsOpen(true); // نقرة بدون سحب = فتح
  };

  // ─── بناء السياق الغني ────────────────────────────────────────────
  const buildContext = useCallback((): string => {
    const parts: string[] = [];
    const openNotes = notes.filter(n => !n.isLocked);
    if (openNotes.length > 0) {
      parts.push(`## NOTES & IDEAS (${openNotes.length} total)`);
      openNotes.slice(0, 25).forEach(n => {
        const type = n.type === 'idea' ? '💡 Idea' : '📝 Note';
        const tags = n.tags.length ? ` [tags: ${n.tags.join(', ')}]` : '';
        parts.push(`- ${type}: "${n.title}"${tags}\n  ${n.content.slice(0, 220).replace(/\n/g, ' ')}`);
      });
      if (openNotes.length > 25) parts.push(`...and ${openNotes.length - 25} more`);
    }
    if (debtsCredits?.length) {
      parts.push('\n## DEBTS & CREDITS');
      debtsCredits.forEach(d => {
        const dir = d.type === 'debt' ? 'I OWE' : 'OWED TO ME';
        const remaining = d.amount - (d.paidAmount || 0);
        parts.push(`- ${dir}: ${d.personName} — ${remaining} ${d.currency} (${d.status}, due ${d.dueDate})`);
      });
    }
    if (transactions?.length) {
      parts.push('\n## RECENT TRANSACTIONS');
      transactions.slice(0, 15).forEach(t => {
        parts.push(`- ${t.date}: ${t.amount} ${t.currency} (${t.category})${t.description ? ' — ' + t.description : ''}`);
      });
    }
    return parts.join('\n') || 'No data yet.';
  }, [notes, debtsCredits, transactions]);

  // ─── تنفيذ الإجراءات التي يطلبها الـ AI (إنشاء ملاحظات/أفكار/مشاريع) ──
  // الـ AI يُرسل كتلة ```tahiro-action تحتوي JSON — نستخرجها وننفّذها فعلياً،
  // ثم نُزيلها من النص المعروض ونستبدلها بتأكيد ودّي للمستخدم.
  const ACTION_LABELS = {
    ar: { note: '📝 تم إنشاء الملاحظة', idea: '💡 تم إنشاء الفكرة', project: '📁 تم إنشاء المشروع',
          debt: '💸 دين (عليك)', credit: '💰 دين (لك)', txn: '🧾 معاملة مالية', confirmAsk: 'أؤكّد الإضافة؟', confirm: 'تأكيد', cancel: 'إلغاء', added: '✅ تمت الإضافة', cancelled: '❌ أُلغيت' },
    en: { note: '📝 Note created', idea: '💡 Idea created', project: '📁 Project created',
          debt: '💸 Debt (you owe)', credit: '💰 Credit (owed to you)', txn: '🧾 Transaction', confirmAsk: 'Confirm adding?', confirm: 'Confirm', cancel: 'Cancel', added: '✅ Added', cancelled: '❌ Cancelled' },
    es: { note: '📝 Nota creada', idea: '💡 Idea creada', project: '📁 Proyecto creado',
          debt: '💸 Deuda (debes)', credit: '💰 Crédito (te deben)', txn: '🧾 Transacción', confirmAsk: '¿Confirmar?', confirm: 'Confirmar', cancel: 'Cancelar', added: '✅ Añadido', cancelled: '❌ Cancelado' },
    zh: { note: '📝 已创建笔记', idea: '💡 已创建想法', project: '📁 已创建项目',
          debt: '💸 债务（你欠）', credit: '💰 债权（欠你）', txn: '🧾 交易', confirmAsk: '确认添加？', confirm: '确认', cancel: '取消', added: '✅ 已添加', cancelled: '❌ 已取消' },
  }[(language as 'ar' | 'en' | 'es' | 'zh')] ?? { note: 'Note created', idea: 'Idea created', project: 'Project created', debt: 'Debt', credit: 'Credit', txn: 'Transaction', confirmAsk: 'Confirm?', confirm: 'Confirm', cancel: 'Cancel', added: 'Added', cancelled: 'Cancelled' };

  const processActions = useCallback((rawReply: string): string => {
    const actionRegex = /```tahiro-action\s*([\s\S]*?)```/g;
    let cleaned = rawReply;
    let match: RegExpExecArray | null;
    const confirmations: string[] = [];
    const newPending: PendingAction[] = [];

    while ((match = actionRegex.exec(rawReply)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.action === 'create_note') {
          // الملاحظات/الأفكار تُنشأ فوراً (غير حسّاسة)
          const noteType = data.type === 'idea' ? 'idea' : 'note';
          addNote({
            title: data.title || (noteType === 'idea' ? 'فكرة' : 'ملاحظة'),
            content: data.content || '',
            type: noteType,
            tags: Array.isArray(data.tags) ? data.tags : [],
            projectId: data.projectId ?? null,
            isPinned: false,
          } as Parameters<typeof addNote>[0]);
          confirmations.push(`✅ ${noteType === 'idea' ? ACTION_LABELS.idea : ACTION_LABELS.note}: "${data.title}"`);
        } else if (data.action === 'create_project') {
          addProject({
            name: data.name || 'مشروع',
            description: data.description || '',
            color: data.color || '#7c3aed',
          } as Parameters<typeof addProject>[0]);
          confirmations.push(`✅ ${ACTION_LABELS.project}: "${data.name}"`);
        } else if (data.action === 'create_debt') {
          // ── دين/مدين: يحتاج تأكيد المستخدم قبل الإضافة ──
          const type = data.type === 'credit' ? 'credit' : 'debt';
          const amount = Number(data.amount) || 0;
          const currency = String(data.currency || 'MAD');
          const person = String(data.personName || data.person || '—');
          const label = `${type === 'debt' ? ACTION_LABELS.debt : ACTION_LABELS.credit}: ${person} — ${amount} ${currency}`;
          newPending.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label,
            run: () => addDebtCredit({
              personName: person,
              type,
              amount,
              currency,
              description: String(data.description || ''),
              dueDate: String(data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
              status: 'pending',
              paidAmount: 0,
              proactiveAlarms: [],
              dailyReminder: false,
              dailyReminderTime: '09:00',
              tags: [],
              notes: '',
            } as Parameters<typeof addDebtCredit>[0]),
          });
        } else if (data.action === 'create_transaction') {
          // ── معاملة مالية: تحتاج تأكيد المستخدم قبل الإضافة ──
          const amount = Number(data.amount) || 0;
          const currency = String(data.currency || 'MAD');
          const validCats = ['investment', 'food', 'transport', 'shopping', 'other'];
          const category = (validCats.includes(data.category) ? data.category : 'other') as 'investment' | 'food' | 'transport' | 'shopping' | 'other';
          const desc = String(data.description || '');
          const label = `${ACTION_LABELS.txn}: ${desc || category} — ${amount} ${currency}`;
          newPending.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label,
            run: () => addTransaction({
              amount,
              currency,
              category,
              description: desc,
            } as Parameters<typeof addTransaction>[0]),
          });
        }
      } catch { /* JSON غير صالح — نتجاهله بأمان */ }
    }

    // أزِل كتل الإجراءات من النص المعروض، وأضِف التأكيدات الفورية
    cleaned = cleaned.replace(actionRegex, '').trim();
    if (confirmations.length) cleaned += (cleaned ? '\n\n' : '') + confirmations.join('\n');
    // الإجراءات الحسّاسة (دين/معاملة) تُخزَّن لعرض أزرار التأكيد
    if (newPending.length) setPendingActions(prev => [...prev, ...newPending]);
    return cleaned;
  }, [addNote, addProject, addDebtCredit, addTransaction, ACTION_LABELS]);

  // تأكيد إجراء معلّق (دين/معاملة) → ينفّذه فعلياً ويزيله من القائمة
  const confirmAction = (id: string) => {
    const action = pendingActions.find(a => a.id === id);
    if (action) {
      action.run();
      setMessages(prev => [...prev, { role: 'model', content: `${ACTION_LABELS.added}: ${action.label}` }]);
    }
    setPendingActions(prev => prev.filter(a => a.id !== id));
  };

  const cancelAction = (id: string) => {
    const action = pendingActions.find(a => a.id === id);
    if (action) {
      setMessages(prev => [...prev, { role: 'model', content: `${ACTION_LABELS.cancelled}: ${action.label}` }]);
    }
    setPendingActions(prev => prev.filter(a => a.id !== id));
  };

  // ─── الإرسال ──────────────────────────────────────────────────────
  const pickMime = (): string => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return 'audio/webm';
  };

  const startRecording = async () => {
    if (isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      audioMimeRef.current = mimeType.split(';')[0];
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const blob = new Blob(audioChunksRef.current, { type: audioMimeRef.current });
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const text = await geminiTranscribeAudio(base64, audioMimeRef.current);
          if (text?.trim()) {
            setInput(prev => prev ? prev + ' ' + text.trim() : text.trim());
          }
        } catch (e) {
          console.warn('[FloatingAIChat] transcription failed:', e);
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.warn('[FloatingAIChat] mic permission/error:', e);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  // ─── الإرسال (يقبل نصاً اختيارياً للرؤى الاستباقية) ──────────────────
  const sendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setLoading(true);
    const newMsgs: ChatMsg[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMsgs);
    try {
      const history: GeminiMessage[] = messages.map(m => ({ role: m.role, content: m.content }));
      const reply = await geminiChat(userMsg, history, buildContext(), { enableSearch: searchEnabled });
      const finalReply = processActions(reply);
      setMessages([...newMsgs, { role: 'model', content: finalReply }]);
    } catch {
      setMessages([...newMsgs, { role: 'model', content: S.err }]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    await sendPrompt(userMsg);
  };

  // الرؤى الاستباقية — تُحسب محلياً (مجاناً) عند فتح النافذة الفارغة
  const insights: ProactiveInsight[] = (isOpen && messages.length === 0)
    ? generateProactiveInsights({ notes, debtsCredits, transactions, language })
    : [];

  // عرض ماركداون بسيط (عريض فقط) — آمن ضد XSS
  // نُهرّب كل أحرف HTML الخطرة أولاً، ثم نُطبّق **bold** فقط على النص
  // المُهرَّب. بدون هذا، رد AI (أو نص يحتوي وسوماً) قد يُنفّذ HTML خبيثاً
  // مثل <img onerror=...> عبر dangerouslySetInnerHTML.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const renderContent = (text: string) =>
    text.split('\n').map((line, i) => {
      const safe = escapeHtml(line);
      const bold = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return <div key={i} dangerouslySetInnerHTML={{ __html: bold || '&nbsp;' }} />;
    });

  return (
    <>
      {/* ─── الأيقونة العائمة ───────────────────────────────────── */}
      {!isOpen && (
        <button
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          style={{ left: fabPos.x, top: fabPos.y, touchAction: 'none' }}
          className="fixed z-[9998] h-14 w-14 rounded-full shadow-2xl flex items-center justify-center
            text-2xl active:scale-90 transition-transform select-none"
          aria-label="Tahiro AI"
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 animate-pulse opacity-30" />
          <span className="relative h-14 w-14 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg">
            🧠
          </span>
        </button>
      )}

      {/* ─── النافذة المستقلة ──────────────────────────────────── */}
      {isOpen && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed z-[9999] flex flex-col overflow-hidden rounded-3xl shadow-2xl border
            inset-x-3 top-20 sm:inset-auto sm:left-5 sm:w-[400px] sm:h-[600px]"
          style={{
            background: darkMode ? '#0f172a' : '#ffffff',
            borderColor: darkMode ? '#1e293b' : '#e2e8f0',
            // ارفع النافذة كاملة فوق البانر الإعلاني (طبقة أصلية تطفو فوق
            // الصفحة). بدون هذا كان الإعلان يغطّي حقل الكتابة وزر الإرسال.
            // ارفع النافذة فوق البانر: ارتفاعه + فجوة 12px حتى لا يلتصق،
            // مع احترام منطقة الأمان السفلية للجهاز.
            bottom: `calc(0.75rem + ${bannerH}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {/* الرأس */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <span className="font-bold">{S.title}</span>
            </div>
            <div className="flex items-center gap-1">
              {/* استماع لآخر رد من المساعد */}
              <ListenButton size="sm" style="exciting" darkMode label="استمع لآخر رد"
                text={() => [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''} />
              {/* زر تبديل بحث الإنترنت */}
              <button
                onClick={() => setSearchEnabled(p => !p)}
                title={searchEnabled ? S.searchOn : S.searchOff}
                className={`h-8 px-2 rounded-full flex items-center gap-1 text-xs font-medium transition-all
                  ${searchEnabled ? 'bg-white/30 ring-1 ring-white/60' : 'hover:bg-white/20'}`}
              >
                {searchEnabled ? '🌐' : '🔍'}
                <span className="hidden sm:inline">{searchEnabled ? 'ON' : 'OFF'}</span>
              </button>
              <button onClick={() => setMessages([])} title={S.clear}
                className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center text-sm">
                ✏️
              </button>
              <button onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center text-lg">
                ✕
              </button>
            </div>
          </div>

          {/* الرسائل */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <>
                <div className={`text-sm leading-relaxed p-3 rounded-2xl whitespace-pre-line ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  {renderContent(S.greeting)}
                </div>
                {/* الرؤى الاستباقية — اقتراحات ذكية يبادر بها المساعد */}
                {insights.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {insights.map(ins => (
                      <button
                        key={ins.id}
                        onClick={() => sendPrompt(ins.actionPrompt)}
                        disabled={loading}
                        className={`w-full text-start p-3 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-50
                          ${darkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'}
                          ${ins.priority === 'high' ? 'ring-1 ring-amber-400/40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg shrink-0">{ins.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                              {ins.title}
                            </div>
                            <div className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {ins.description}
                            </div>
                          </div>
                          <span className={`text-xs shrink-0 ${darkMode ? 'text-violet-400' : 'text-violet-500'}`}>←</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                  ${m.role === 'user'
                    ? 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white'
                    : darkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
                  {renderContent(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-3 py-2 rounded-2xl text-sm ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                  {searchEnabled ? S.searching : S.thinking}
                </div>
              </div>
            )}

            {/* بطاقات تأكيد الإجراءات المعلّقة (دين/معاملة) */}
            {pendingActions.map(action => (
              <div key={action.id} className={`rounded-2xl border p-3 ${darkMode ? 'bg-gray-800/60 border-violet-500/40' : 'bg-violet-50 border-violet-200'}`}>
                <div className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{action.label}</div>
                <div className={`text-xs mb-2.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{ACTION_LABELS.confirmAsk}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmAction(action.id)}
                    className="flex-1 py-2 rounded-xl text-white text-sm font-bold active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#d946ef)' }}
                  >
                    ✓ {ACTION_LABELS.confirm}
                  </button>
                  <button
                    onClick={() => cancelAction(action.id)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'}`}
                  >
                    ✕ {ACTION_LABELS.cancel}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* الإدخال */}
          <div
            className={`flex items-center gap-2 p-3 border-t shrink-0 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}
          >
            {/* زر الميكروفون — تسجيل صوتي → تحويل لنص */}
            <button
              onClick={toggleRecording}
              disabled={isTranscribing || loading}
              title="🎤"
              className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-lg transition-all disabled:opacity-40
                ${isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {isTranscribing ? '⏳' : isRecording ? '⏹️' : '🎤'}
            </button>
            <CaretSafeInput
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isRecording ? '🔴 ...' : isTranscribing ? '⏳ ...' : S.placeholder}
              disabled={isRecording || isTranscribing}
              className={`flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none disabled:opacity-60
                ${darkMode ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-900 placeholder-gray-400'}`}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-2xl text-white font-semibold text-sm shrink-0 disabled:opacity-40
                active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#d946ef)' }}
            >
              {S.send}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
