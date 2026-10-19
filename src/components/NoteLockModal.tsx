/**
 * NoteLockModal.tsx — مودال إعداد/فتح/تغيير الرقم السري لملاحظة أو فكرة
 */
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CaretSafeInput } from './CaretSafe';

export type LockMode = 'setup' | 'unlock' | 'change';

interface NoteLockModalProps {
  isOpen: boolean;
  mode: LockMode;
  darkMode: boolean;
  /** رسالة خطأ تُعرَض (مثال: رقم سري خاطئ) — يضبطها المكوّن الأب */
  error?: string;
  /** حالة انتظار (فك/تشفير قيد التنفيذ) */
  busy?: boolean;
  onClose: () => void;
  /** setup: pin فقط | unlock: pin فقط | change: pin=القديم, newPin=الجديد */
  onSubmit: (pin: string, newPin?: string) => void;
}

const TXT = {
  ar: {
    setupTitle: '🔒 إنشاء رقم سري', setupSubtitle: 'لحماية هذه الملاحظة/الفكرة بتشفير حقيقي',
    setupWarning: '⚠️ إن نسيت الرقم السري، لا يمكن استرجاع المحتوى نهائياً — لا يوجد استرجاع.',
    unlockTitle: '🔒 ملاحظة محمية', unlockSubtitle: 'أدخل الرقم السري لفتحها',
    changeTitle: '🔁 تغيير الرقم السري',
    pinPlaceholder: 'الرقم السري (4 أحرف على الأقل)',
    confirmPlaceholder: 'تأكيد الرقم السري',
    oldPinPlaceholder: 'الرقم السري الحالي',
    newPinPlaceholder: 'الرقم السري الجديد',
    mismatch: 'الرقمان غير متطابقين', tooShort: 'يجب 4 أحرف على الأقل', wrongPin: '❌ رقم سري خاطئ، حاول مجدداً',
    confirm: 'تأكيد', cancel: 'إلغاء', unlock: 'فتح', wait: 'جارٍ التحقق...',
  },
  en: {
    setupTitle: '🔒 Set a PIN', setupSubtitle: 'Protect this note/idea with real encryption',
    setupWarning: '⚠️ If you forget the PIN, the content cannot be recovered — there is no reset.',
    unlockTitle: '🔒 Protected note', unlockSubtitle: 'Enter the PIN to open it',
    changeTitle: '🔁 Change PIN',
    pinPlaceholder: 'PIN (4+ characters)',
    confirmPlaceholder: 'Confirm PIN',
    oldPinPlaceholder: 'Current PIN',
    newPinPlaceholder: 'New PIN',
    mismatch: "PINs don't match", tooShort: 'Must be at least 4 characters', wrongPin: '❌ Incorrect PIN, try again',
    confirm: 'Confirm', cancel: 'Cancel', unlock: 'Unlock', wait: 'Verifying...',
  },
  es: {
    setupTitle: '🔒 Crear PIN', setupSubtitle: 'Protege esta nota/idea con cifrado real',
    setupWarning: '⚠️ Si olvidas el PIN, el contenido no se puede recuperar — no hay restablecimiento.',
    unlockTitle: '🔒 Nota protegida', unlockSubtitle: 'Introduce el PIN para abrirla',
    changeTitle: '🔁 Cambiar PIN',
    pinPlaceholder: 'PIN (4+ caracteres)',
    confirmPlaceholder: 'Confirmar PIN',
    oldPinPlaceholder: 'PIN actual',
    newPinPlaceholder: 'PIN nuevo',
    mismatch: 'Los PIN no coinciden', tooShort: 'Debe tener al menos 4 caracteres', wrongPin: '❌ PIN incorrecto, inténtalo de nuevo',
    confirm: 'Confirmar', cancel: 'Cancelar', unlock: 'Abrir', wait: 'Verificando...',
  },
  zh: {
    setupTitle: '🔒 设置密码', setupSubtitle: '使用真实加密保护此笔记/想法',
    setupWarning: '⚠️ 如果忘记密码，内容将无法恢复 — 没有重置方式。',
    unlockTitle: '🔒 受保护的笔记', unlockSubtitle: '输入密码以打开',
    changeTitle: '🔁 更改密码',
    pinPlaceholder: '密码（至少4位）',
    confirmPlaceholder: '确认密码',
    oldPinPlaceholder: '当前密码',
    newPinPlaceholder: '新密码',
    mismatch: '密码不一致', tooShort: '至少需要4个字符', wrongPin: '❌ 密码错误，请重试',
    confirm: '确认', cancel: '取消', unlock: '打开', wait: '验证中...',
  },
} as const;

export default function NoteLockModal({ isOpen, mode, darkMode, error, busy, onClose, onSubmit }: NoteLockModalProps) {
  const { language } = useApp();
  const L = TXT[(language as keyof typeof TXT)] ?? TXT.en;

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [localError, setLocalError] = useState('');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin(''); setConfirmPin(''); setOldPin(''); setLocalError('');
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'unlock') {
      if (!pin) return;
      onSubmit(pin);
      return;
    }

    if (mode === 'setup') {
      if (pin.length < 4) { setLocalError(L.tooShort); return; }
      if (pin !== confirmPin) { setLocalError(L.mismatch); return; }
      onSubmit(pin);
      return;
    }

    // mode === 'change'
    if (pin.length < 4) { setLocalError(L.tooShort); return; }
    if (pin !== confirmPin) { setLocalError(L.mismatch); return; }
    onSubmit(oldPin, pin);
  };

  const title = mode === 'setup' ? L.setupTitle : mode === 'change' ? L.changeTitle : L.unlockTitle;
  const subtitle = mode === 'unlock' ? L.unlockSubtitle : mode === 'setup' ? L.setupSubtitle : undefined;

  return (
    <div className="modal-backdrop fixed inset-0 pb-banner z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>

        <div className="relative px-6 pt-6 pb-4 text-center"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
          <button onClick={onClose} type="button"
            className="absolute top-4 end-4 text-white/70 hover:text-white text-xl">✕</button>
          <p className="text-white font-semibold text-lg mb-1">{title}</p>
          {subtitle && <p className="text-white/80 text-sm">{subtitle}</p>}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {mode === 'setup' && (
            <div className="mb-3 p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
              {L.setupWarning}
            </div>
          )}

          {mode === 'change' && (
            <CaretSafeInput
              ref={firstInputRef}
              type="password"
              inputMode="numeric"
              value={oldPin}
              onChange={e => setOldPin(e.target.value)}
              placeholder={L.oldPinPlaceholder}
              className={`w-full mb-3 px-4 py-3 rounded-xl text-center text-lg tracking-widest outline-none
                ${darkMode ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-900 placeholder-gray-400'}`}
            />
          )}

          <CaretSafeInput
            ref={mode !== 'change' ? firstInputRef : undefined}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder={mode === 'unlock' ? L.pinPlaceholder : mode === 'change' ? L.newPinPlaceholder : L.pinPlaceholder}
            className={`w-full mb-3 px-4 py-3 rounded-xl text-center text-lg tracking-widest outline-none
              ${darkMode ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-900 placeholder-gray-400'}`}
          />

          {mode !== 'unlock' && (
            <CaretSafeInput
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder={L.confirmPlaceholder}
              className={`w-full mb-3 px-4 py-3 rounded-xl text-center text-lg tracking-widest outline-none
                ${darkMode ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-900 placeholder-gray-400'}`}
            />
          )}

          {(localError || error) && (
            <p className="mb-3 text-sm text-red-500 text-center">{localError || error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className={`px-4 py-3 rounded-2xl text-sm font-medium active:scale-95
                ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              {L.cancel}
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
              {busy ? L.wait : mode === 'unlock' ? L.unlock : L.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
