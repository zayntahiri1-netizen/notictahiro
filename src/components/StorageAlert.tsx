/**
 * StorageAlert — التحذير المرئي عند فشل الحفظ أو اقتراب امتلاء التخزين
 * ───────────────────────────────────────────────────────────────────────
 * لماذا بانر دائم وليس إشعاراً عابراً (toast)؟
 * لأن الرسالة هنا ليست "معلومة" بل "بياناتك في خطر الآن". الإشعار العابر
 * يختفي بعد ثوانٍ وقد لا يراه المستخدم أصلاً، بينما هذه الحالة تستوجب
 * فعلاً منه (تصدير/حذف) ويجب أن تبقى ظاهرة حتى يتصرّف.
 *
 * حالتان:
 *   🔴 فشل حفظ فعلي  — وقع فقدان بالفعل؛ أعلى درجات الإلحاح.
 *   🟠 اقتراب الامتلاء (≥80%) — تحذير وقائي قبل وقوع الضرر.
 */
import { useEffect, useState } from 'react';
import {
  onWriteFailure,
  clearWriteFailure,
  getStorageUsage,
  formatBytes,
  type WriteFailure,
  type StorageUsage,
} from '../utils/storageHealth';

interface Props {
  darkMode?: boolean;
  /** يفتح نافذة التصدير — الإجراء العلاجي الأول. */
  onExport?: () => void;
}

export default function StorageAlert({ darkMode = false, onExport }: Props) {
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [dismissedWarn, setDismissedWarn] = useState(false);

  useEffect(() => onWriteFailure(setFailure), []);

  // فحص دوري للسعة: كل دقيقة يكفي — القياس رخيص والامتلاء تدريجي.
  useEffect(() => {
    const check = () => setUsage(getStorageUsage());
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const critical = failure !== null;
  const warning = !critical && usage?.nearFull === true && !dismissedWarn;
  if (!critical && !warning) return null;

  const pct = usage ? Math.min(100, Math.round(usage.ratio * 100)) : 100;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-no-listen
      className={`fixed inset-x-0 top-0 z-[9999] px-3 pt-[env(safe-area-inset-top,0px)]`}
    >
      <div
        className={`mx-auto mt-2 max-w-xl rounded-2xl border p-3 shadow-2xl backdrop-blur ${
          critical
            ? 'border-red-500/60 bg-red-600/95 text-white'
            : darkMode
            ? 'border-amber-500/50 bg-amber-900/90 text-amber-50'
            : 'border-amber-400/70 bg-amber-50/95 text-amber-900'
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">{critical ? '🔴' : '⚠️'}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">
              {critical ? 'لم يُحفظ آخر تغيير!' : `مساحة التخزين شبه ممتلئة (${pct}%)`}
            </div>
            <div className="mt-0.5 text-xs leading-relaxed opacity-95">
              {critical
                ? 'امتلأت مساحة التخزين، فلم تُحفظ آخر تعديلاتك. صدّر نسخة الآن ثم احذف مرفقات أو ملاحظات قديمة — وإلا ستفقدها عند إغلاق التطبيق.'
                : `استُهلك ${usage ? formatBytes(usage.usedBytes) : ''} من ${usage ? formatBytes(usage.quotaBytes) : ''}. صدّر نسخة احتياطية قبل أن تمتلئ ويتوقّف الحفظ.`}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {onExport && (
                <button
                  onClick={onExport}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    critical ? 'bg-white text-red-700' : 'bg-amber-500 text-white'
                  }`}
                >
                  ⬇️ تصدير نسخة الآن
                </button>
              )}
              <button
                onClick={() => {
                  if (critical) { clearWriteFailure(); setFailure(null); }
                  else setDismissedWarn(true);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium opacity-80 transition hover:opacity-100 active:scale-95"
              >
                {critical ? 'فهمت' : 'لاحقاً'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
