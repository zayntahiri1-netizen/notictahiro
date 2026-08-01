import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import NotesList from './components/NotesList';
import NoteEditor from './components/NoteEditor';
import { AlertModal } from './components/PromptModal';
import WelcomeSplash from './components/WelcomeSplash';
import LanguageSelector from './components/LanguageSelector';
import StaticPage, { StaticPageKind } from './components/StaticPage';
import CommandPalette from './components/CommandPalette';
import AdBanner, { useBannerHeight } from './components/AdBanner';
import Toast from './components/Toast';
import NetworkStatus from './components/NetworkStatus';
import { initAdMob, showAppOpenAd, onScreenTransition } from './utils/admob';
import { initFirebase } from './utils/firebase';
import { consumePendingBubbleAction, ensureBubbleRunning } from './utils/bubbleOverlay';
import { CaretSafeInput } from './components/CaretSafe';

// ─── أدوات ثقيلة تُفتح عند الطلب فقط — تحميل تكاسلي لتقليل حجم الحزمة الأولى
const ProductivityStats = lazy(() => import('./components/ProductivityStats'));
const BrainDumpMode     = lazy(() => import('./components/BrainDumpMode'));
const FinancialTracker  = lazy(() => import('./components/FinancialTracker'));
const MorningBriefing   = lazy(() => import('./components/MorningBriefing'));
const NotesChat         = lazy(() => import('./components/NotesChat'));
const KnowledgeGraph    = lazy(() => import('./components/KnowledgeGraph'));
const SmartClipboard    = lazy(() => import('./components/SmartClipboard'));
const DecisionMatrix    = lazy(() => import('./components/DecisionMatrix'));
const FocusSprint       = lazy(() => import('./components/FocusSprint'));
const HabitTracker      = lazy(() => import('./components/HabitTracker'));
const DebtCreditManager = lazy(() => import('./components/DebtCreditManager'));
const AICopilot         = lazy(() => import('./components/AICopilot'));
const FloatingAIChat    = lazy(() => import('./components/FloatingAIChat'));

// مؤشّر تحميل بسيط للأدوات المفتوحة كنوافذ
const LazyToolFallback = () => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
    <div className="rounded-2xl bg-white/90 px-6 py-4 shadow-2xl dark:bg-gray-900/90">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
    </div>
  </div>
);

const staticRoutes: StaticPageKind[] = ['privacy', 'delete-data', 'about', 'contact'];

function getStaticRoute(): StaticPageKind | null {
  const pathRoute = window.location.pathname.replace(/^\//, '') as StaticPageKind;
  if (staticRoutes.includes(pathRoute)) return pathRoute;

  const hashRoute = window.location.hash.replace(/^#\/?/, '') as StaticPageKind;
  return staticRoutes.includes(hashRoute) ? hashRoute : null;
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('notic-tahiro-seen');
  });
  const [staticPage, setStaticPage] = useState<StaticPageKind | null>(() => getStaticRoute());
  

  // ── تهيئة Firebase Analytics عند بدء التطبيق (غير حاجبة) ─────
  useEffect(() => {
    void initFirebase();
  }, []);

  // ── تهيئة AdMob عند بدء التطبيق ──────────────────────────
  useEffect(() => {
    initAdMob().then(() => showAppOpenAd());

    // النمط القياسي لإعلان App Open: العرض أيضاً عند العودة من الخلفية
    // (محمي بفاصل 4 ساعات داخل showAppOpenAd — لن يُزعج المستخدم)
    let removeListener: (() => void) | null = null;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App: CapApp } = await import('@capacitor/app');
        const handle = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void showAppOpenAd();
        });
        removeListener = () => { void handle.remove(); };
      } catch { /* الإضافة غير متوفرة */ }
    })();
    return () => { removeListener?.(); };
  }, []);

  // ── معالجة إجراء الفقعة العائمة (BubbleOverlay) ──────────────────
  // عند الضغط على بند في قائمة الفقعة، يُفتح التطبيق ويصل الإجراء عبر
  // Intent → MainActivity.pendingBubbleAction → نستهلكه هنا مرة واحدة
  // عند الإقلاع وعند كل عودة من الخلفية (قد يكون التطبيق يعمل بالفعل
  // والمستخدم ضغط على الفقعة من جديد).
  useEffect(() => {
    const handleBubbleAction = async () => {
      const action = await consumePendingBubbleAction();
      if (!action) return;
      if (action === 'quick_note') {
        handleNewNote();
      } else if (action === 'quick_idea') {
        // فكرة سريعة → محرر بنوع "فكرة"
        setEditingNoteId(null);
        setNewNoteType('idea');
        setShowEditor(true);
      } else if (action === 'voice_note') {
        // تدوين صوتي → محرر جديد مع إشارة لفتح المسجّل تلقائياً
        try { sessionStorage.setItem('notic-quick-voice', '1'); } catch { /* ignore */ }
        handleNewNote();
      } else if (action === 'paste_clip') {
        // لصق المنسوخ → محرر جديد يلصق محتوى الحافظة تلقائياً
        try { sessionStorage.setItem('notic-quick-paste', '1'); } catch { /* ignore */ }
        handleNewNote();
      } else if (action === 'reminder') {
        try { sessionStorage.setItem('notic-quick-reminder', '1'); } catch { /* ignore */ }
        handleNewNote();
      } else if (action === 'ai_chat') {
        // يفتح نافذة Tahiro AI العائمة المستقلة الجديدة (لا اللوحة القديمة)
        window.dispatchEvent(new CustomEvent('open-tahiro-ai'));
      }
    };

    void handleBubbleAction();

    let removeBubbleListener: (() => void) | null = null;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        // عند بدء التطبيق: إن كانت الفقعة مُفعَّلة سابقاً وقُتلت (نظام عدواني
        // مثل Huawei/Xiaomi)، أعِد تشغيلها تلقائياً. هذا يجعلها "تبقى مُفعَّلة"
        // فعلياً عبر الخروج والدخول دون أن يُعيد المستخدم تفعيلها يدوياً.
        void ensureBubbleRunning();
        const { App: CapApp } = await import('@capacitor/app');
        const handle = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void handleBubbleAction();
            void ensureBubbleRunning(); // أعِد تشغيلها عند كل عودة إن لزم
          }
        });
        removeBubbleListener = () => { void handle.remove(); };
      } catch { /* الإضافة غير متوفرة */ }
    })();
    return () => { removeBubbleListener?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSplash) {
      sessionStorage.setItem('notic-tahiro-seen', 'true');
    }
  }, [showSplash]);

  useEffect(() => {
    const handleRouteChange = () => setStaticPage(getStaticRoute());
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);
  
  const { darkMode, setSearchQuery, notes, updateNote, t, direction, lastDeletedNote, restoreLastDelete } = useApp();
  const [showEditor, setShowEditor] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [showHabits, setShowHabits] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showDebtCredit, setShowDebtCredit] = useState(false);
  const [showNoTasksAlert, setShowNoTasksAlert] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showFinancial, setShowFinancial] = useState(false);
  const [showMorningBrief, setShowMorningBrief] = useState(false);
  const [showNotesChat, setShowNotesChat] = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [showClipboard, setShowClipboard] = useState(false);
  const [showDecisionMatrix, setShowDecisionMatrix] = useState(false);
  const [showFocusSprint, setShowFocusSprint] = useState(false);

  // ─── كاشف انتقالات النوافذ (إعلان بيني احترافي) ───────────────────
  // بدل نثر استدعاءات الإعلان في كل نافذة (تكرار + سهولة النسيان)، نراقب
  // كل حالات النوافذ من مكان واحد ونُبلّغ النظام المركزي عند كل فتح/إغلاق.
  // النظام هناك يطبّق سياسة التكرار (3 دقائق + سقف يومي + فترة سماح).
  const _windowFlags = [
    showEditor, showStats, showBrainDump, showHabits, showAICopilot,
    showDebtCredit, showSearchModal, showCommandPalette, showFinancial,
    showMorningBrief, showNotesChat, showKnowledgeGraph, showClipboard,
    showDecisionMatrix, showFocusSprint,
  ];
  const _openCount = _windowFlags.filter(Boolean).length;
  const _prevOpenCount = useRef(_openCount);
  useEffect(() => {
    const prev = _prevOpenCount.current;
    if (_openCount !== prev) {
      _prevOpenCount.current = _openCount;
      void onScreenTransition(_openCount > prev ? 'open' : 'close');
    }
  }, [_openCount]);
  const [focusSprintNote, setFocusSprintNote] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteType, setNewNoteType] = useState<'note' | 'idea'>('note');
  const actionScrollerRef = useRef<HTMLDivElement | null>(null);
  const actionDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  // ارتفاع البانر الفعلي (0 على الويب، ديناميكي على الأجهزة الحقيقية)
  const bannerHeight = useBannerHeight();

  // تطبيق الوضع الداكن على العنصر الجذر
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const inEditable = (() => {
        const t = event.target as HTMLElement | null;
        if (!t) return false;
        const tag = t.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
      })();

      // Ctrl/⌘ + K → لوحة الأوامر (دائماً متاحة)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      // Ctrl/⌘ + N → ملاحظة جديدة (إلا أثناء الكتابة)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n' && !inEditable) {
        event.preventDefault();
        setEditingNoteId(null);
        setNewNoteType('note');
        setShowEditor(true);
        return;
      }
      // Esc → إغلاق النوافذ المفتوحة (الأهمّ أولاً)
      if (event.key === 'Escape') {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (showSearchModal)    { setShowSearchModal(false);    return; }
        if (mobileSidebarOpen)  { setMobileSidebarOpen(false);  return; }
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [showCommandPalette, showSearchModal, mobileSidebarOpen]);

  const handleEditNote = (noteId: string) => {
    setEditingNoteId(noteId);
    setShowEditor(true);
  };

  const handleNewNote = () => {
    setEditingNoteId(null);
    setNewNoteType('note');
    setShowEditor(true);
  };

  const handleNewIdea = () => {
    setEditingNoteId(null);
    setNewNoteType('idea');
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingNoteId(null);
  };

  const handleActionDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const scroller = actionScrollerRef.current;
    if (!scroller) return;
    actionDragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
    };
    scroller.setPointerCapture(event.pointerId);
  };

  const handleActionDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const scroller = actionScrollerRef.current;
    if (!scroller || !actionDragRef.current.active) return;
    const delta = event.clientX - actionDragRef.current.startX;
    scroller.scrollLeft = actionDragRef.current.scrollLeft - delta;
  };

  const handleActionDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const scroller = actionScrollerRef.current;
    actionDragRef.current.active = false;
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }
  };

  const scrollActionsBy = (amount: number) => {
    // في RTL تُعكس إشارة الـ delta لأن scrollLeft سالب في بعض المتصفحات
    const rtlFactor = direction === 'rtl' ? -1 : 1;
    actionScrollerRef.current?.scrollBy({ left: amount * rtlFactor, behavior: 'smooth' });
  };

  const handleActionWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scroller = actionScrollerRef.current;
    if (!scroller) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      scroller.scrollLeft += event.deltaY;
    }
  };

  if (staticPage) {
    return <StaticPage page={staticPage} />;
  }

  return (
    <div className={`h-full min-h-0 flex no-h-overflow ${darkMode ? 'bg-gray-950' : 'bg-gray-100'}`} dir={direction}>
      {/* الشريط الجانبي - يظهر فقط في وضع القائمة */}
      {!showEditor && (
        <div className="hidden h-full shrink-0 md:block">
          <Sidebar onNewNote={handleNewNote} onNewIdea={handleNewIdea} />
        </div>
      )}

      {!showEditor && mobileSidebarOpen && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <div className={`absolute inset-y-0 ${direction === 'rtl' ? 'right-0' : 'left-0'} w-[min(86vw,320px)] shadow-2xl animate-scale-in`}>
            <Sidebar
              onNewNote={() => {
                setMobileSidebarOpen(false);
                handleNewNote();
              }}
              onNewIdea={() => {
                setMobileSidebarOpen(false);
                handleNewIdea();
              }}
            />
          </div>
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {showEditor ? (
          <NoteEditor
            key={editingNoteId || 'new'}
            noteId={editingNoteId}
            isNewNote={!editingNoteId}
            newNoteType={newNoteType}
            onClose={handleCloseEditor}
            onOpenNote={(id) => {
              // الانتقال إلى ملاحظة أخرى دون إغلاق المحرّر
              setEditingNoteId(id);
              setNewNoteType('note');
            }}
            onCreateGhost={(title) => {
              // إنشاء ملاحظة جديدة بعنوان الرابط الشبح
              setEditingNoteId(null);
              setNewNoteType('note');
              // العنوان يُمرَّر عبر sessionStorage لاستهلاكه عند فتح المحرّر الجديد
              try { sessionStorage.setItem('notic-ghost-title', title); } catch {}
            }}
          />
        ) : (
          <>
            {/* شريط البحث والتحكم العلوي */}
            <header className={`compact-landscape relative px-3 py-3 sm:px-4 lg:px-6 lg:py-4 border-b ${
              darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              {/* زر اللغة في وسط اللوبي / الصفحة الرئيسية */}
              <div className="absolute left-1/2 top-3 -translate-x-1/2 z-20 hidden xl:block">
                <LanguageSelector placement="floating" />
              </div>
              <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-4 overflow-hidden">
                {!showEditor && (
                  <button
                    onClick={() => setMobileSidebarOpen(true)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition sm:h-11 sm:w-11 md:hidden ${
                      darkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-white text-gray-600 shadow-sm'
                    }`}
                    aria-label="Open menu"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
                {/* زر البحث الصغير */}
                <button aria-label={t('searchPlaceholder')}
                  onClick={() => setShowSearchModal(true)}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all hover:scale-105 active:scale-95 sm:h-11 sm:w-11 ${
                    searchInput
                      ? 'border-violet-400 bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                      : darkMode
                        ? 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                        : 'border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={t('searchPlaceholder')}
                >
                  <SearchIcon className="h-5 w-5" />
                  {searchInput && (
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </button>

                <button aria-label="Command Palette Ctrl+K"
                  onClick={() => setShowCommandPalette(true)}
                  className={`hidden h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-black transition sm:flex ${
                    darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50'
                  }`}
                  title="Command Palette Ctrl+K"
                >
                  <span>⌘</span>
                  <span>K</span>
                </button>

                {/* أزرار الإجراءات الذكية */}
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <button aria-label={t('scrollLeft')}
                    type="button"
                    onClick={() => scrollActionsBy(-220)}
                    className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all sm:flex ${
                      darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    title={t('scrollLeft')}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="relative min-w-0 flex-1">
                    <div
                      ref={actionScrollerRef}
                      onPointerDown={handleActionDragStart}
                      onPointerMove={handleActionDragMove}
                      onPointerUp={handleActionDragEnd}
                      onPointerCancel={handleActionDragEnd}
                      onPointerLeave={handleActionDragEnd}
                      onWheel={handleActionWheel}
                      className="action-scroller no-scrollbar w-full max-w-[calc(100vw-7.5rem)] cursor-grab touch-pan-x snap-x overflow-x-auto overscroll-x-contain scroll-smooth active:cursor-grabbing sm:max-w-[min(66vw,720px)] lg:max-w-[min(62vw,760px)]"
                      title={t('dragButtonsHint')}
                    >
                    <div className="flex w-max shrink-0 select-none items-center gap-2">
                  {/* اسأل مفكرتك - الدردشة الدلالية */}
                  <button aria-label={t('askNotebook')}
                    onClick={() => setShowNotesChat(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-400' 
                        : 'bg-violet-50 hover:bg-violet-100 text-violet-600'
                    }`}
                    title={t('askNotebook')}
                  >
                    <span>💬</span>
                    <span className="hidden lg:inline text-sm">{t('askNotebook')}</span>
                  </button>

                  {/* مركز Tahiro AI */}
                  <button aria-label={t('aiCenter')}
                    onClick={() => setShowAICopilot(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-400' 
                        : 'bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-600'
                    }`}
                    title={t('aiCenter')}
                  >
                    <span>🧠</span>
                    <span className="hidden lg:inline text-sm">Tahiro AI</span>
                  </button>

                  {/* الموجز الصباحي */}
                  <button aria-label={t('morningBrief')}
                    onClick={() => setShowMorningBrief(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' 
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                    }`}
                    title={t('morningBrief')}
                  >
                    <span>☀️</span>
                    <span className="hidden md:inline text-sm">{t('morningBrief')}</span>
                  </button>

                  {/* تفريغ الدماغ */}
                  <button aria-label={t('brainDump')}
                    onClick={() => setShowBrainDump(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400' 
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                    }`}
                    title={t('brainDump')}
                  >
                    <span>🧘</span>
                    <span className="hidden md:inline text-sm">{t('brainDump')}</span>
                  </button>

                  {/* متتبع العادات */}
                  <button aria-label={t('habits')}
                    onClick={() => setShowHabits(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode
                        ? 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-400'
                        : 'bg-teal-50 hover:bg-teal-100 text-teal-600'
                    }`}
                    title={t('habits')}
                  >
                    <span>🔥</span>
                    <span className="hidden md:inline text-sm">{t('habits')}</span>
                  </button>

                  {/* المالية الذكية */}
                  <button aria-label={t('finance')}
                    onClick={() => setShowFinancial(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                    }`}
                    title={t('finance')}
                  >
                    <span>💰</span>
                    <span className="hidden md:inline text-sm">{t('finance')}</span>
                  </button>

                  {/* الدائن والمدين */}
                  <button aria-label={t('debtCredit')}
                    onClick={() => setShowDebtCredit(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400' 
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                    }`}
                    title={t('debtCredit')}
                  >
                    <span>💳</span>
                    <span className="hidden lg:inline text-sm">{t('debtCredit')}</span>
                  </button>

                  {/* خريطة العقل */}
                  <button aria-label={t('mindMap')}
                    onClick={() => setShowKnowledgeGraph(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-400' 
                        : 'bg-pink-50 hover:bg-pink-100 text-pink-600'
                    }`}
                    title={t('mindMap')}
                  >
                    <span>🕸️</span>
                    <span className="hidden lg:inline text-sm">{t('mindMap')}</span>
                  </button>

                  {/* الحافظة السحرية */}
                  <button aria-label={t('clipboard')}
                    onClick={() => setShowClipboard(true)}
                    className={`p-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400' 
                        : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-600'
                    }`}
                    title={t('clipboard')}
                  >
                    <span>📋</span>
                    <span className="hidden lg:inline text-sm">{t('clipboard')}</span>
                  </button>

                  <button
                    onClick={handleNewNote}
                    className={`hidden sm:flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                      darkMode 
                        ? 'bg-violet-600 hover:bg-violet-700 text-white' 
                        : 'bg-violet-500 hover:bg-violet-600 text-white'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('newNote')}
                  </button>
                    </div>
                    </div>
                  </div>

                  <button aria-label={t('scrollRight')}
                    type="button"
                    onClick={() => scrollActionsBy(220)}
                    className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all sm:flex ${
                      darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    title={t('scrollRight')}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </header>

            {/* قائمة الملاحظات */}
            <NotesList 
              onEditNote={handleEditNote} 
              onNewNote={handleNewNote} 
            />
          </>
        )}
      </main>

      {/* البانر السفلي — يظهر فقط على الأجهزة الحقيقية، ويُخفى في المحرّر */}
      <AdBanner visible={!showEditor} />

      {/* أزرار عائمة متجاوبة */}
      {!showEditor && (
        <div
          className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/75 p-2 shadow-2xl backdrop-blur-xl dark:bg-gray-900/70 sm:gap-3"
          style={{ bottom: `calc(${bannerHeight > 0 ? `${bannerHeight + 16}px` : '1rem'} + env(safe-area-inset-bottom))` }}
        >
          <button aria-label={t('quickIdea')}
            onClick={handleNewIdea}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xl text-white shadow-lg shadow-amber-500/30 transition-all hover:scale-110 sm:h-14 sm:w-14 sm:text-2xl"
            title={t('quickIdea')}
          >
            💡
          </button>
          <button aria-label={t('productivityStats')}
            onClick={() => setShowStats(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-xl text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-110 sm:h-14 sm:w-14 sm:text-2xl"
            title={t('productivityStats')}
          >
            📊
          </button>
          <button aria-label={t('decisionMatrix')}
            onClick={() => setShowDecisionMatrix(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-xl text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-110 sm:h-14 sm:w-14 sm:text-2xl"
            title={t('decisionMatrix')}
          >
            🧩
          </button>
          <button aria-label={t('focusChallenge')}
            onClick={() => {
              const noteWithTasks = notes.find(n => n.aiData?.extractedTasks && n.aiData.extractedTasks.length > 0);
              if (noteWithTasks) {
                setFocusSprintNote(noteWithTasks.id);
                setShowFocusSprint(true);
              } else {
                setShowNoTasksAlert(true);
              }
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-xl text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-110 sm:h-14 sm:w-14 sm:text-2xl"
            title={t('focusChallenge')}
          >
            ⚡
          </button>
        </div>
      )}

      {/* نافذة الإحصائيات */}
      {showStats && <Suspense fallback={<LazyToolFallback />}><ProductivityStats onClose={() => setShowStats(false)} /></Suspense>}

      {/* نافذة تفريغ الدماغ */}
      {showBrainDump && <Suspense fallback={<LazyToolFallback />}><BrainDumpMode onClose={() => setShowBrainDump(false)} /></Suspense>}
      {showHabits && <Suspense fallback={<LazyToolFallback />}><HabitTracker onClose={() => setShowHabits(false)} /></Suspense>}

      {/* نافذة المالية الذكية */}
      {showFinancial && <Suspense fallback={<LazyToolFallback />}><FinancialTracker onClose={() => setShowFinancial(false)} /></Suspense>}

      {/* موجز الصباح الذكي */}
      {showMorningBrief && <Suspense fallback={<LazyToolFallback />}><MorningBriefing onClose={() => setShowMorningBrief(false)} /></Suspense>}

      {/* دردشة مع ملاحظاتك */}
      {showNotesChat && <Suspense fallback={<LazyToolFallback />}><NotesChat onClose={() => setShowNotesChat(false)} /></Suspense>}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNewNote={handleNewNote}
        onNewIdea={handleNewIdea}
        onEditNote={handleEditNote}
        onOpenAICopilot={() => setShowAICopilot(true)}
        onOpenNotesChat={() => setShowNotesChat(true)}
        onOpenFinance={() => setShowFinancial(true)}
        onOpenDebtCredit={() => setShowDebtCredit(true)}
        onOpenKnowledgeGraph={() => setShowKnowledgeGraph(true)}
        onOpenClipboard={() => setShowClipboard(true)}
        onOpenDecisionMatrix={() => setShowDecisionMatrix(true)}
        onOpenStats={() => setShowStats(true)}
        onOpenBrainDump={() => setShowBrainDump(true)}
        onOpenMorningBrief={() => setShowMorningBrief(true)}
      />

      {/* مركز الذكاء الاصطناعي المتقدم */}
      {showAICopilot && <Suspense fallback={<LazyToolFallback />}><AICopilot onClose={() => setShowAICopilot(false)} /></Suspense>}

      {/* نافذة البحث المنبثقة */}
      {showSearchModal && (
        <div
          className="modal-backdrop fixed inset-0 z-[90] flex items-start justify-center p-4 pt-24 sm:pt-28"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`glass-card w-full max-w-xl rounded-3xl p-4 animate-scale-in ${darkMode ? 'text-white' : 'text-gray-900'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/20">
                  <SearchIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">{t('searchPlaceholder')}</h3>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Notic Tahiro Smart Search
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <SearchIcon className={`absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <CaretSafeInput
                autoFocus
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowSearchModal(false);
                  if (e.key === 'Enter') setShowSearchModal(false);
                }}
                placeholder={t('searchPlaceholder')}
                className={`w-full rounded-2xl border py-4 pl-12 pr-12 text-lg font-medium outline-none transition-all ${
                  darkMode
                    ? 'border-gray-700 bg-gray-800/80 text-white placeholder-gray-500 focus:border-violet-500'
                    : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-violet-500'
                } focus:ring-4 focus:ring-violet-500/10`}
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-bold ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}
                >
                  {t('clearSearch')}
                </button>
              )}
            </div>

            <div className={`mt-3 rounded-2xl p-3 text-xs ${darkMode ? 'bg-gray-800/60 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
              💡 {t('searchHint')}
            </div>
          </div>
        </div>
      )}

      {/* خريطة العقل - شبكة الأفكار */}
      {showKnowledgeGraph && <Suspense fallback={<LazyToolFallback />}><KnowledgeGraph onClose={() => setShowKnowledgeGraph(false)} /></Suspense>}

      {/* الحافظة السحرية الواعية */}
      {showClipboard && <Suspense fallback={<LazyToolFallback />}><SmartClipboard onClose={() => setShowClipboard(false)} /></Suspense>}

      {/* مصفوفة اتخاذ القرار */}
      {showDecisionMatrix && <Suspense fallback={<LazyToolFallback />}><DecisionMatrix onClose={() => setShowDecisionMatrix(false)} /></Suspense>}

      {/* الدائن والمدين */}
      {showDebtCredit && <Suspense fallback={<LazyToolFallback />}><DebtCreditManager onClose={() => setShowDebtCredit(false)} /></Suspense>}

      {/* وضع تحدي الإنجاز */}
      {showFocusSprint && focusSprintNote && (() => {
        const sprintNote = notes.find(n => n.id === focusSprintNote);
        if (!sprintNote) return null; // الملاحظة حُذفت — لا نعرض النافذة
        return (
          <Suspense fallback={<LazyToolFallback />}><FocusSprint
            note={sprintNote}
            onClose={() => {
              setShowFocusSprint(false);
              setFocusSprintNote(null);
            }}
            onUpdateTasks={(tasks) => {
              updateNote(focusSprintNote, {
                aiData: {
                  ...notes.find(n => n.id === focusSprintNote)?.aiData,
                  extractedTasks: tasks
                }
              });
            }}
          /></Suspense>
        );
      })()}

      {/* تنبيه عدم وجود مهام */}
      <AlertModal
        isOpen={showNoTasksAlert}
        onClose={() => setShowNoTasksAlert(false)}
        title={t('noTasksTitle')}
        message={t('noTasksMessage')}
        variant="warning"
        icon="⚡"
        buttonLabel={t('noTasksOk')}
      />

      {/* شاشة الترحيب الفاخرة */}
      {showSplash && <WelcomeSplash onComplete={() => setShowSplash(false)} />}

      {/* بطاقة التراجع عن آخر حذف للملاحظة */}
      {lastDeletedNote && (
        <Toast
          key={lastDeletedNote.id}
          message={`${t('noteDeleted')}: "${lastDeletedNote.title || t('noTitle')}"`}
          type="info"
          action={{ label: t('undo'), onClick: restoreLastDelete }}
          onClose={() => { /* ينتهي تلقائياً عبر مهلة AppContext */ }}
        />
      )}

      {/* مؤشّر انقطاع الإنترنت — صامت إلا عند الانقطاع */}
      <NetworkStatus />

      {/* مساعد Tahiro AI العائم المستقل — أيقونة دائمة + نافذة منفصلة */}
      {!showSplash && (
        <Suspense fallback={null}>
          <FloatingAIChat />
        </Suspense>
      )}

    </div>
  );
}

// أيقونة البحث
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
