import { useEffect } from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  /** زر إجراء اختياري (مثل: تراجع، إعادة) */
  action?: ToastAction;
  /** مدّة العرض بالميلي ثانية (افتراضي 3000، 6000 للأفعال القابلة للتراجع) */
  duration?: number;
}

export default function Toast({ message, type, onClose, action, duration }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration ?? (action ? 6000 : 3000));
    return () => clearTimeout(t);
  }, [onClose, duration, action]);

  const icons = { success: '✓', error: '✕', info: 'ℹ' } as const;
  const colors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  } as const;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 animate-fade-in-up"
    >
      <div className={`${colors[type]} flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-2xl`}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">
          {icons[type]}
        </span>
        <span className="text-sm font-medium">{message}</span>
        {action && (
          <button
            onClick={() => { action.onClick(); onClose(); }}
            className="ml-2 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold transition hover:bg-white/30 active:scale-95"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
