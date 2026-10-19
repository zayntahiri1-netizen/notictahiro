/**
 * AdBanner.tsx — مكوّن بانر AdMob
 *
 * FIX يونيو 2026:
 *  - resumeBanner() متوفّرة في v8 — نستخدمها عند الظهور (مع تراجع تلقائي)
 *  - removeBanner() عند الإخفاء (أكثر موثوقية من hideBanner على أندرويد)
 *  - نحفظ معرّف الوحدة لإعادة استخدامه عند الاستئناف
 */

import { useEffect, useRef, useState } from 'react';
import {
  showBanner,
  removeBanner,
  hideBanner,
  resumeBanner,
  onBannerHeight,
  isNative,
  HOME_BANNER,
  bannerReservedHeight,
} from '../utils/admob';

interface AdBannerProps {
  onHeightChange?: (height: number) => void;
  /** true = اعرض البانر | false = أخفه */
  visible?: boolean;
}

export default function AdBanner({ onHeightChange, visible = true }: AdBannerProps) {
  const [bannerHeight, setBannerHeight] = useState(0);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;

  // ─── تحميل البانر مرة واحدة عند Mount ──────────────────────────
  useEffect(() => {
    if (!isNative()) return;

    const unsub = onBannerHeight(h => {
      setBannerHeight(h);
      onHeightChangeRef.current?.(h);
    });

    // نعرض البانر مباشرة
    void showBanner(HOME_BANNER);

    return () => {
      unsub();
      void removeBanner();
    };
  }, []);

  // ─── إظهار/إخفاء عند تغيّر visible ────────────────────────────
  //   visible=true  → resumeBanner (إظهار المحمَّل، بلا طلب جديد)
  //   visible=false → hideBanner (يبقى محمّلاً → عودة فورية)
  const prevVisible = useRef(visible);
  useEffect(() => {
    if (!isNative()) return;
    if (prevVisible.current === visible) return;
    prevVisible.current = visible;

    if (visible) {
      // resumeBanner: تُعيد إظهار البانر المحمَّل بلا طلب إعلان جديد
      // (أسرع ولا يستهلك مرات عرض إضافية). كان هنا showBanner() التي
      // ترتدّ من حارس «معروض بالفعل» فلا يعود البانر أبداً.
      void resumeBanner();
    } else {
      // أخفِه (removeBanner أكثر موثوقية على بعض أجهزة أندرويد)
      void hideBanner();
    }
  }, [visible]);

  // ─── بثّ الارتفاع كمتغيّر CSS عام ─────────────────────────────
  // البانر طبقة أصلية (native) تطفو فوق الـ WebView، فلا «يدفع» المحتوى.
  // الفراغ أدناه يحمي التخطيط الرئيسي فقط؛ أما النوافذ المنبثقة ذات
  // الأشرطة السفلية (دردشة الذكاء الاصطناعي مثلاً) فهي position:fixed
  // ولا تراه — فكان البانر يغطّي حقل الكتابة وزر الإرسال.
  // ننشر الارتفاع في --banner-h ليستطيع أي مكوّن حجز مساحته عبر
  // الصنف .pb-banner دون الحاجة إلى تمرير خصائص.
  useEffect(() => {
    // ⚠️ كان: (bannerHeight > 0 ? bannerHeight : 0) — أي صفر ما دام حدث
    // SizeChanged لم يصل بعد، فلا تحجز النوافذ أي مساحة ويغطّي الإعلان
    // أزرارها في تلك الفترة. الآن نعتمد الارتفاع المحجوز الفعلي الذي
    // لا يعود صفراً ما دام البانر معروضاً.
    const h = visible ? (bannerHeight > 0 ? bannerHeight : bannerReservedHeight()) : 0;
    document.documentElement.style.setProperty('--banner-h', `${h}px`);
  }, [bannerHeight, visible]);

  if (!isNative()) return null;

  return (
    <div
      style={{ height: visible && bannerHeight > 0 ? bannerHeight : 0 }}
      aria-hidden="true"
    />
  );
}

/** Hook مساعد — يُعيد ارتفاع البانر الحالي */
export function useBannerHeight(): number {
  // القيمة الابتدائية من الحالة الفعلية (وليست 0): لو رُكّب المكوّن بعد
  // ظهور البانر، كان يبدأ بصفر فترتفع النافذة صفر بكسل ويغطّيها الإعلان
  // حتى وصول أول حدث تغيير حجم.
  const [height, setHeight] = useState(() => (isNative() ? bannerReservedHeight() : 0));
  useEffect(() => {
    if (!isNative()) return;
    setHeight(bannerReservedHeight());
    return onBannerHeight((h) => setHeight(h > 0 ? h : bannerReservedHeight()));
  }, []);
  return height;
}
