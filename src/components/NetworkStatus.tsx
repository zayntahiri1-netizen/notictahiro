/**
 * NetworkStatus.tsx — مؤشّر اتصال صامت يظهر فقط عند انقطاع الإنترنت.
 * يطمئن المستخدم أنّ التطبيق ما زال يعمل لأنّ بياناته محلّية.
 */
import { useEffect, useState } from 'react';


const OFFLINE_MSG = {
  ar: 'أنت غير متصل بالإنترنت — ملاحظاتك تعمل دون اتصال',
  en: "You're offline — your notes still work without a connection",
  es: 'Estás sin conexión — tus notas siguen funcionando',
  zh: '您处于离线状态 — 您的笔记在离线时也可使用',
} as const;
type Lang = keyof typeof OFFLINE_MSG;
function getLang(): Lang {
  try {
    const v = localStorage.getItem('notic-language') as Lang | null;
    if (v && v in OFFLINE_MSG) return v;
  } catch {}
  return 'en';
}

export default function NetworkStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-[95] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-md animate-fade-in-up"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}
    >
      <span>📡</span>
      <span>{OFFLINE_MSG[getLang()]}</span>
    </div>
  );
}
