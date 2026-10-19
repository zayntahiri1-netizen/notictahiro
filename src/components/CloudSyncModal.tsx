/**
 * CloudSyncModal — إعدادات المزامنة السحابية
 * ───────────────────────────────────────────────────────────────────────
 * ثلاثة مبادئ حكمت هذه الشاشة:
 *
 * 1. المزامنة مُطفأة افتراضياً، والتفعيل فعلٌ صريح من المستخدم. رفعُ
 *    ملاحظات شخصٍ إلى خادم بلا أن يطلب ذلك ليس ميزة.
 * 2. الحالة تُقال كما هي: آخر مزامنة، ونصّ الخطأ حين يقع. "تمت المزامنة"
 *    وهي لم تتم هو بالضبط الفشل الصامت الذي كلّف هذا المشروع نسخاً كاملة.
 * 3. رمز النقل محجوب حتى يطلبه المستخدم، ومعه تحذيرٌ صريح: من يحصل عليه
 *    يصل إلى البيانات. لا نعرضه وكأنه رقم إصدار.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  isSyncEnabled, setSyncEnabled, isSyncConfigured, syncNow, forgetCloudData,
  onSyncStatus, getSyncStatus, getLastSyncTime, type SyncStatus,
} from '../utils/cloudSync';
import { getTransferCode, applyTransferCode } from '../utils/deviceIdentity';
import { prettyCode } from '../utils/transferCode';
import * as haptics from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

export default function CloudSyncModal({ isOpen, onClose, darkMode = false }: Props) {
  const { t, language } = useApp();
  const [enabled, setEnabled] = useState(() => isSyncEnabled());
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [code, setCode] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [entryMsg, setEntryMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onSyncStatus(setStatus), []);
  useEffect(() => {
    if (!isOpen) { setCode(null); setEntry(''); setEntryMsg(null); setConfirmForget(false); }
  }, [isOpen]);

  if (!isOpen) return null;

  const configured = isSyncConfigured();
  const lastAt = status.lastAt ?? getLastSyncTime();

  const toggle = () => {
    haptics.tap('light');
    const next = !enabled;
    setEnabled(next);
    setSyncEnabled(next);
    if (next) void syncNow();
  };

  const copyCode = async () => {
    const c = code ?? (await getTransferCode());
    setCode(c);
    try {
      await navigator.clipboard.writeText(c);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      // الحافظة محجوبة في بعض الـ WebView — الرمز ظاهر على الشاشة بأي حال
    }
  };

  const applyCode = async () => {
    setEntryMsg(null);
    const id = await applyTransferCode(entry);
    if (!id) { setEntryMsg(t('syncCodeBad')); return; }
    setSyncEnabled(true);
    setEnabled(true);
    const out = await syncNow(true);
    setEntryMsg(out.ok ? t('syncCodeDone') : (out.error ?? t('syncError')));
  };

  const statusLine = !configured ? t('syncNotConfigured')
    : !enabled ? t('syncOff')
    : status.state === 'syncing' ? t('syncSyncing')
    : status.state === 'error' ? t('syncError')
    : t('syncIdle');

  const statusColor = !configured || !enabled ? 'text-gray-400'
    : status.state === 'error' ? 'text-red-500'
    : status.state === 'syncing' ? 'text-amber-500'
    : 'text-emerald-500';

  return (
    <div
      className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-no-listen
        className={`glass-card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-sky-600 to-indigo-700 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">☁️</span>
            <div className="font-bold leading-tight">{t('syncTitle')}</div>
          </div>
          <button onClick={onClose} aria-label="✕" className="h-8 w-8 rounded-full hover:bg-white/20">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('syncIntro')}
          </p>

          {/* المفتاح */}
          <button
            disabled={!configured}
            onClick={toggle}
            className={`mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border p-3 disabled:opacity-50 ${
              darkMode ? 'border-gray-800' : 'border-gray-200'
            }`}
          >
            <div className="text-start">
              <div className="text-sm font-bold">{t('syncEnable')}</div>
              <div className={`mt-0.5 text-[11px] ${statusColor}`}>{statusLine}</div>
            </div>
            <div className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
              enabled && configured ? 'bg-emerald-500' : darkMode ? 'bg-gray-700' : 'bg-gray-300'
            }`}>
              <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                enabled && configured ? 'translate-x-5 rtl:-translate-x-5' : ''
              }`} />
            </div>
          </button>

          {/* الخطأ — يُعرض كما هو، لا مُجمَّلاً */}
          {status.error && enabled && (
            <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2 font-mono text-[11px] break-words">
              {status.error}
            </div>
          )}

          {/* آخر مزامنة + زر يدوي */}
          {configured && enabled && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('syncLast')}: {lastAt
                  ? lastAt.toLocaleString(language === 'ar' ? 'ar-MA' : language,
                      { dateStyle: 'short', timeStyle: 'short' })
                  : t('syncNever')}
              </span>
              <button
                disabled={status.state === 'syncing'}
                onClick={() => { haptics.tap('light'); void syncNow(); }}
                className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
              >
                🔄 {t('syncNow')}
              </button>
            </div>
          )}

          {/* الانتقال لهاتف جديد */}
          {configured && (
            <div className={`mt-5 rounded-2xl border p-3 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="text-sm font-bold">📱 {t('syncTransferTitle')}</div>
              <p className={`mt-1 text-[11px] leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('syncTransferHint')}
              </p>

              {code ? (
                <>
                  <div className={`mt-2 rounded-xl p-2 text-center font-mono text-[13px] tracking-wide break-all ${
                    darkMode ? 'bg-gray-900' : 'bg-gray-100'
                  }`}>
                    {prettyCode(code)}
                  </div>
                  <p className="mt-1 text-[10px] text-amber-500">⚠️ {t('syncTransferWarn')}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => { void copyCode(); }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-700 px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      {copied ? `✅ ${t('syncCopied')}` : '📋'}
                    </button>
                    <button
                      onClick={() => setCode(null)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                        darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t('syncHideCode')}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { haptics.tap('light'); void getTransferCode().then(setCode); }}
                  className={`mt-2 w-full rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                    darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  👁️ {t('syncShowCode')}
                </button>
              )}

              {/* إدخال رمز من هاتف آخر */}
              <div className={`mt-3 border-t pt-3 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className="text-[11px] font-bold">{t('syncEnterCode')}</div>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder={t('syncCodePlaceholder')}
                    dir="ltr"
                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 font-mono text-[11px] ${
                      darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  />
                  <button
                    disabled={!entry.trim() || busy}
                    onClick={() => { setBusy(true); void applyCode().finally(() => setBusy(false)); }}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                  >
                    {t('syncCodeApply')}
                  </button>
                </div>
                {entryMsg && <div className="mt-1 text-[11px] text-amber-500">{entryMsg}</div>}
              </div>
            </div>
          )}

          {/* حذف البيانات من السحابة */}
          {configured && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirmForget) { setConfirmForget(true); haptics.tap('light'); return; }
                setBusy(true);
                void forgetCloudData().then((ok) => {
                  setConfirmForget(false);
                  if (ok) setEntryMsg(t('syncForgetDone'));
                }).finally(() => setBusy(false));
              }}
              className={`mt-4 w-full rounded-xl px-3 py-2 text-[11px] font-bold disabled:opacity-50 ${
                confirmForget ? 'bg-red-600 text-white'
                  : darkMode ? 'bg-gray-800 text-red-400' : 'bg-gray-100 text-red-600'
              }`}
            >
              {confirmForget ? `⚠️ ${t('syncForgetConfirm')}` : `🗑️ ${t('syncForget')}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
