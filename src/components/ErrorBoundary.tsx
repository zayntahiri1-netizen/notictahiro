/**
 * ErrorBoundary.tsx — يلتقط الأخطاء غير الملتقطة ويعرض واجهة استعادة
 * بدلاً من الشاشة البيضاء التي يُسبّبها انهيار شجرة React.
 */
import React from 'react';

interface State {
  error: Error | null;
}


// رسائل بسيطة بلغات متعدّدة (ErrorBoundary لا يمكنه استخدام useApp)
const FALLBACK_MESSAGES = {
  ar: {
    errorOccurred: 'حدث خطأ غير متوقّع',
    errorReassure: 'ملاحظاتك ومشاريعك محفوظة بأمان. أعد المحاولة، وإن استمرّت المشكلة أعد تشغيل التطبيق.',
    retry: 'إعادة المحاولة',
    restart: 'إعادة التشغيل',
    technicalDetails: 'تفاصيل تقنية',
  },
  en: {
    errorOccurred: 'Something went wrong',
    errorReassure: 'Your notes and projects are safe. Try again, and if the issue persists please restart the app.',
    retry: 'Try again',
    restart: 'Restart',
    technicalDetails: 'Technical details',
  },
  es: {
    errorOccurred: 'Algo salió mal',
    errorReassure: 'Tus notas y proyectos están seguros. Inténtalo de nuevo, y si el problema persiste reinicia la aplicación.',
    retry: 'Reintentar',
    restart: 'Reiniciar',
    technicalDetails: 'Detalles técnicos',
  },
  zh: {
    errorOccurred: '出现了错误',
    errorReassure: '您的笔记和项目都很安全。请重试,如果问题持续,请重启应用。',
    retry: '重试',
    restart: '重启',
    technicalDetails: '技术详情',
  },
} as const;

function getMessages() {
  let lang: keyof typeof FALLBACK_MESSAGES = 'en';
  try {
    const stored = localStorage.getItem('notic-language') as keyof typeof FALLBACK_MESSAGES | null;
    if (stored && stored in FALLBACK_MESSAGES) lang = stored;
  } catch {}
  return FALLBACK_MESSAGES[lang];
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // لا نسجّل المعلومات إلى أيّ خدمة خارجية (احترام للخصوصية)
    console.error('[Notic Tahiro] uncaught error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleHardReset = () => {
    // ملاذ أخير: مسح حالة الجلسة فقط (دون لمس بيانات المستخدم)
    try { sessionStorage.clear(); } catch {}
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const messages = getMessages();
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-gradient-to-br from-violet-50 to-pink-50 p-6 text-center dark:from-gray-900 dark:to-gray-950"
      >
        <div className="text-5xl">😔</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">
          {messages.errorOccurred}
        </h1>
        <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
          {messages.errorReassure}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={this.handleReset}
            className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95"
          >
            {messages.retry}
          </button>
          <button
            onClick={this.handleHardReset}
            className="rounded-2xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {messages.restart}
          </button>
        </div>
        <details className="mt-4 max-w-md text-left">
          <summary className="cursor-pointer text-xs text-gray-400">
            {messages.technicalDetails}
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-100 p-2 text-[10px] text-red-600 dark:bg-gray-900 dark:text-red-300">
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </details>
      </div>
    );
  }
}
