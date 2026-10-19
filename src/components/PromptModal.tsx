import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CaretSafeInput, CaretSafeTextarea } from './CaretSafe';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  subtitle?: string;
  placeholder?: string;
  defaultValue?: string;
  icon?: string;
  iconBg?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  inputType?: 'text' | 'number' | 'email' | 'tel';
  gradient?: string;
  shadowColor?: string;
}

export default function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  placeholder = '',
  defaultValue = '',
  icon = '✨',
  confirmLabel = 'حسناً',
  cancelLabel = 'إلغاء',
  multiline = false,
  inputType = 'text',
  gradient = 'from-violet-600 via-purple-600 to-indigo-600',
  shadowColor = 'rgba(139, 92, 246, 0.25)',
}: PromptModalProps) {
  const { darkMode, language } = useApp();
  const _close = language === 'ar' ? 'إغلاق (Esc)' : language === 'es' ? 'Cerrar (Esc)' : language === 'zh' ? '关闭 (Esc)' : 'Close (Esc)';
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // التركيز التلقائي على الحقل
      setTimeout(() => {
        inputRef.current?.focus();
        if (inputRef.current && 'select' in inputRef.current) {
          (inputRef.current as HTMLInputElement).select();
        }
      }, 100);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      setValue('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === 'Enter' && multiline && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-card w-full max-w-md rounded-3xl overflow-hidden animate-scale-in ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
        style={{
          boxShadow: `0 25px 70px -15px ${shadowColor}, 0 8px 25px -10px rgba(0,0,0,0.3)`,
        }}
      >
        {/* الرأس الفاخر */}
        <div
          className={`relative overflow-hidden bg-gradient-to-r ${gradient} p-5 text-white border-b border-white/10`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-extrabold tracking-tight text-white drop-shadow-sm leading-tight">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-white/85 font-medium mt-0.5 line-clamp-2">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md border border-white/20 hover:rotate-90 transition-all duration-300 shadow-lg"
              title={_close}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* المحتوى */}
        <div className="p-5 space-y-4">
          {multiline ? (
            <CaretSafeTextarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={5}
              className={`w-full px-4 py-3 rounded-2xl border-2 outline-none resize-none text-base leading-relaxed transition-all ${
                darkMode
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500 focus:bg-gray-800'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:bg-white'
              } focus:ring-4 focus:ring-violet-500/10`}
            />
          ) : (
            <CaretSafeInput
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full px-4 py-3.5 rounded-2xl border-2 outline-none text-base transition-all ${
                darkMode
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500 focus:bg-gray-800'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:bg-white'
              } focus:ring-4 focus:ring-violet-500/10`}
            />
          )}

          {multiline && (
            <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              💡 اضغط Ctrl+Enter للحفظ السريع
            </p>
          )}

          {/* أزرار التحكم */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-2xl font-semibold transition-all hover:scale-[1.02] active:scale-95 ${
                darkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
              }`}
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!value.trim()}
              className={`flex-1 py-3 rounded-2xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-gradient-to-r ${gradient} shadow-lg`}
              style={{ boxShadow: `0 10px 25px -8px ${shadowColor}` }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// نافذة التأكيد الفاخرة (بديل عن confirm)
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  icon,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'info',
}: ConfirmModalProps) {
  const { darkMode } = useApp();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variants = {
    danger: {
      gradient: 'from-red-600 via-rose-600 to-pink-600',
      shadow: 'rgba(239, 68, 68, 0.3)',
      icon: icon || '⚠️',
    },
    warning: {
      gradient: 'from-amber-500 via-orange-500 to-red-500',
      shadow: 'rgba(245, 158, 11, 0.3)',
      icon: icon || '⚡',
    },
    info: {
      gradient: 'from-blue-600 via-indigo-600 to-violet-600',
      shadow: 'rgba(59, 130, 246, 0.3)',
      icon: icon || 'ℹ️',
    },
    success: {
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      shadow: 'rgba(16, 185, 129, 0.3)',
      icon: icon || '✅',
    },
  };

  const v = variants[variant];

  return (
    <div
      className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-card w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
        style={{
          boxShadow: `0 25px 70px -15px ${v.shadow}, 0 8px 25px -10px rgba(0,0,0,0.3)`,
        }}
      >
        {/* أيقونة مركزية بتصميم فاخر */}
        <div className="pt-7 pb-2 flex justify-center">
          <div
            className={`w-20 h-20 rounded-full bg-gradient-to-br ${v.gradient} flex items-center justify-center text-4xl shadow-2xl relative`}
            style={{ boxShadow: `0 15px 35px -10px ${v.shadow}` }}
          >
            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-md animate-pulse" />
            <span className="relative z-10 drop-shadow-lg">{v.icon}</span>
          </div>
        </div>

        {/* المحتوى */}
        <div className="px-6 pb-6 text-center space-y-3">
          <h3 className={`text-xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {message}
          </p>

          {/* أزرار التحكم */}
          <div className="flex gap-2.5 pt-4">
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-2xl font-semibold transition-all hover:scale-[1.02] active:scale-95 ${
                darkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
              }`}
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-3 rounded-2xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${v.gradient}`}
              style={{ boxShadow: `0 10px 25px -8px ${v.shadow}` }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// نافذة التنبيه الفاخرة (بديل عن alert)
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  variant?: 'success' | 'error' | 'info' | 'warning';
  buttonLabel?: string;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  icon,
  variant = 'info',
  buttonLabel = 'تم',
}: AlertModalProps) {
  const { darkMode } = useApp();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variants = {
    success: { gradient: 'from-emerald-500 to-teal-600', shadow: 'rgba(16, 185, 129, 0.3)', icon: icon || '✅' },
    error: { gradient: 'from-red-500 to-rose-600', shadow: 'rgba(239, 68, 68, 0.3)', icon: icon || '❌' },
    info: { gradient: 'from-blue-500 to-indigo-600', shadow: 'rgba(59, 130, 246, 0.3)', icon: icon || 'ℹ️' },
    warning: { gradient: 'from-amber-500 to-orange-600', shadow: 'rgba(245, 158, 11, 0.3)', icon: icon || '⚠️' },
  };
  const v = variants[variant];

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-card w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in ${darkMode ? 'text-white' : 'text-gray-900'}`}
        style={{ boxShadow: `0 25px 70px -15px ${v.shadow}, 0 8px 25px -10px rgba(0,0,0,0.3)` }}
      >
        <div className="pt-7 pb-2 flex justify-center">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${v.gradient} flex items-center justify-center text-4xl shadow-2xl relative`}
            style={{ boxShadow: `0 15px 35px -10px ${v.shadow}` }}>
            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-md" />
            <span className="relative z-10 drop-shadow-lg">{v.icon}</span>
          </div>
        </div>
        <div className="px-6 pb-6 text-center space-y-3">
          <h3 className={`text-xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{message}</p>
          <button
            onClick={onClose}
            className={`w-full mt-4 py-3 rounded-2xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${v.gradient}`}
            style={{ boxShadow: `0 10px 25px -8px ${v.shadow}` }}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
