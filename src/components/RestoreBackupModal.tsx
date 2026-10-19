/**
 * RestoreBackupModal — استرجاع البيانات من نسخة احتياطية
 * ───────────────────────────────────────────────────────────────────────
 * النصف الثاني من ميزة النسخ الاحتياطي: الملفات كانت تُكتب يومياً في
 * مجلد يبقى بعد حذف التطبيق، ولم يكن في التطبيق أي طريقة لقراءتها.
 *
 * قرارات الواجهة هنا كلها تخدم شيئاً واحداً: ألا يفقد المستخدم بياناته
 * بضغطة واحدة.
 *   • "دمج" هو الخيار البارز، و"استبدال" رمادي ويطلب تأكيداً ثانياً.
 *   • قبل الاستبدال تُحفظ لقطة تراجع، ونقول ذلك صراحةً.
 *   • نتيجة الاسترجاع تُعرض كما هي — بما فشل منها، لا "تم بنجاح" فقط.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  listBackups, readBackup, previewBackup, restoreBackup, markRestoreOffered,
  type BackupFile, type BackupEnvelope, type RestoreResult,
} from '../utils/backupRestore';
import { formatBytes } from '../utils/storageHealth';
import * as haptics from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

export default function RestoreBackupModal({ isOpen, onClose, darkMode = false }: Props) {
  const { t, language } = useApp();
  const [files, setFiles] = useState<BackupFile[] | null>(null);
  const [picked, setPicked] = useState<{ file: BackupFile; env: BackupEnvelope } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFiles(null); setPicked(null); setResult(null); setConfirmReplace(false);
    void (async () => { setFiles(await listBackups()); })();
    // فتح الشاشة يُعدّ عرضاً للاسترجاع — لا نُلاحق المستخدم به كل إقلاع
    markRestoreOffered();
  }, [isOpen]);

  if (!isOpen) return null;

  const pick = async (file: BackupFile) => {
    haptics.tap('light');
    setBusy(true);
    const env = await readBackup(file);
    setBusy(false);
    if (!env) { setFiles((prev) => prev?.filter((f) => f.name !== file.name) ?? null); return; }
    setPicked({ file, env });
    setConfirmReplace(false);
  };

  const run = async (mode: 'merge' | 'replace') => {
    if (!picked) return;
    haptics.tap('medium');
    setBusy(true);
    setResult(await restoreBackup(picked.env, mode));
    setBusy(false);
  };

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleString(language === 'ar' ? 'ar-MA' : language, {
      dateStyle: 'medium', timeStyle: 'short',
    }) : '—';

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
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛟</span>
            <div className="font-bold leading-tight">{t('restoreTitle')}</div>
          </div>
          <button onClick={onClose} aria-label="✕" className="h-8 w-8 rounded-full hover:bg-white/20">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {/* ── النتيجة بعد الاسترجاع ── */}
          {result ? (
            <div className="py-6 text-center">
              <div className="mb-2 text-4xl">{result.ok ? '✅' : '⚠️'}</div>
              <div className="font-bold">{result.ok ? t('restoreDone') : t('restoreSomeFailed')}</div>
              <div className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {result.restored.length} / {result.restored.length + result.failed.length}
              </div>
              {result.undoSaved && (
                <div className="mt-2 text-[11px] opacity-70">notic-prerestore.json</div>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-2.5 text-sm font-bold text-white"
              >
                🔄 {t('restoreReload')}
              </button>
            </div>
          ) : picked ? (
            /* ── معاينة النسخة المختارة ── */
            <div>
              <button
                onClick={() => setPicked(null)}
                className={`mb-3 text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                ‹ {t('restoreTitle')}
              </button>
              <div className={`rounded-2xl border p-3 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className="text-sm font-bold">{fmtDate(picked.file.createdAt)}</div>
                <div className={`mt-0.5 text-[11px] ${picked.file.survivesUninstall ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {picked.file.survivesUninstall ? `🛡️ ${t('restoreDurable')}` : `⚠️ ${t('restoreInternal')}`}
                </div>
                <div className="mt-2 space-y-0.5">
                  {Object.entries(previewBackup(picked.env).counts).map(([k, n]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="opacity-70">{k.replace('notic-', '')}</span>
                      <span className="font-bold">{n}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                disabled={busy}
                onClick={() => { void run('merge'); }}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                ➕ {t('restoreMerge')}
              </button>
              <p className={`mt-1 text-center text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('restoreMergeHint')}
              </p>

              <button
                disabled={busy}
                onClick={() => {
                  if (!confirmReplace) { setConfirmReplace(true); haptics.tap('light'); return; }
                  void run('replace');
                }}
                className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${
                  confirmReplace
                    ? 'bg-red-600 text-white'
                    : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {confirmReplace ? `⚠️ ${t('restoreConfirmReplace')}` : `♻️ ${t('restoreReplace')}`}
              </button>
              {!confirmReplace && (
                <p className={`mt-1 text-center text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('restoreReplaceHint')}
                </p>
              )}
            </div>
          ) : files === null ? (
            <div className="py-10 text-center text-sm opacity-60">…</div>
          ) : files.length === 0 ? (
            /* ── لا نسخ ── */
            <div className={`py-10 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="mb-2 text-4xl">📭</div>
              {t('restoreEmpty')}
              <div className="mt-1 text-xs opacity-70">{t('restoreEmptyHint')}</div>
            </div>
          ) : (
            /* ── قائمة النسخ ── */
            <div className="space-y-1.5">
              {files.map((f) => (
                <button
                  key={`${f.survivesUninstall ? 'd' : 'i'}-${f.name}`}
                  disabled={busy}
                  onClick={() => { void pick(f); }}
                  className={`w-full rounded-xl border p-3 text-start disabled:opacity-50 ${
                    darkMode ? 'border-gray-800 hover:bg-gray-900' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-bold">{fmtDate(f.createdAt)}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={`text-[11px] ${f.survivesUninstall ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {f.survivesUninstall ? `🛡️ ${t('restoreDurable')}` : `⚠️ ${t('restoreInternal')}`}
                    </span>
                    {f.bytes > 0 && (
                      <span className="text-[11px] opacity-50">{formatBytes(f.bytes)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
