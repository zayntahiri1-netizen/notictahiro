/**
 * CaretSafe.tsx — حقول كتابة محمية من قفز المؤشر (جميع اللغات والكيبورات)
 * ─────────────────────────────────────────────────────────────────────
 * المشكلة: على أندرويد (WebView)، الحقول «المربوطة» (controlled) في React
 * تُعاد كتابتها مع كل حرف. هذا يكسر المؤشر بطريقتين:
 *   1) إعادة الرسم تُرجع المؤشر لنهاية النص.
 *   2) الكيبورات التركيبية (العربية التنبؤية، الصينية، اليابانية، الكورية،
 *      الهندية…) تكون في وسط «تركيب» الكلمة (IME composition) — وأي كتابة
 *      برمجية للحقل تقطع التركيب وترمي الحروف في الآخر.
 *
 * الحل الجذري هنا: الحقل «شبه مربوط» (semi-controlled):
 *   • أثناء كتابة المستخدم لا نلمس DOM إطلاقاً — الكيبورد يكتب مباشرة
 *     والمؤشر والتركيب لا يُمسّان أبداً، بأي لغة كانت.
 *   • نزامن الحالة من الحقل (DOM → state) عبر onChange كالمعتاد.
 *   • نكتب في الحقل (state → DOM) فقط عندما تتغير القيمة من خارج الحقل
 *     (ذكاء اصطناعي، قوالب، صوت، مسح) — مع الحفاظ على موضع المؤشر إن كان
 *     المستخدم مركّزاً على الحقل، وتأجيل ذلك إن كان في وسط تركيب كلمة.
 *
 * إضافةً لذلك (إصلاح العربية/RTL): بعض الكيبورات على أندرويد تحسب موضع
 * «تركيب الكلمة» بمنطق يسار-يمين حتى داخل النص العربي، فتلتصق الحروف في
 * الآخر عند التصحيح وسط النص. نعطّل التدقيق/التصحيح التلقائي للمتصفح
 * (spellcheck/autocorrect) الذي يوسّع منطقة التركيب، ونستعمل
 * unicode-bidi: plaintext ليحسب المتصفح اتجاه كل سطر من محتواه — وهذا
 * يصحّح خريطة المواضع التي يعتمدها الكيبورد في النص ثنائي الاتجاه.
 *
 * الاستخدام: بدّل <input> بـ <CaretSafeInput> و <textarea> بـ <CaretSafeTextarea>
 * — نفس الخصائص تماماً (drop-in replacement)، مع دعم ref.
 */
import React, { forwardRef, useLayoutEffect, useRef } from 'react';

/** يدمج ref داخلي مع ref مُمرَّر من الأب (function أو object) */
function assignRef<T>(fwd: React.ForwardedRef<T>, el: T | null) {
  if (typeof fwd === 'function') fwd(el);
  else if (fwd) (fwd as React.MutableRefObject<T | null>).current = el;
}

type El = HTMLInputElement | HTMLTextAreaElement;

/** مزامنة القيمة الخارجية إلى الحقل دون إزعاج الكتابة الجارية */
function useExternalSync(
  innerRef: React.MutableRefObject<El | null>,
  composing: React.MutableRefObject<boolean>,
  value: unknown,
) {
  const pendingExternal = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const v = value == null ? '' : String(value);

    // القيمة مطابقة لما في الحقل → المستخدم هو من كتبها، لا نلمس شيئاً.
    if (el.value === v) { pendingExternal.current = null; return; }

    // تغيير خارجي أثناء تركيب كلمة → نؤجله حتى ينتهي التركيب.
    if (composing.current) { pendingExternal.current = v; return; }

    applyExternal(el, v);
    pendingExternal.current = null;
  }, [value]);

  /** يطبّق تغييراً خارجياً مع الحفاظ على المؤشر إن كان الحقل نشطاً */
  function applyExternal(el: El, v: string) {
    const focused = document.activeElement === el;
    let caret: number | null = null;
    if (focused) { try { caret = el.selectionStart; } catch { caret = null; } }
    el.value = v;
    if (focused && caret !== null) {
      try {
        const pos = Math.min(caret, v.length);
        el.setSelectionRange(pos, pos);
      } catch { /* بعض الأنواع لا تدعم setSelectionRange */ }
    }
  }

  /** يُستدعى عند نهاية تركيب الكلمة لتطبيق أي تغيير خارجي مؤجل */
  function flushPending() {
    const el = innerRef.current;
    if (el && pendingExternal.current !== null) {
      applyExternal(el, pendingExternal.current);
      pendingExternal.current = null;
    }
  }

  return flushPending;
}

export const CaretSafeInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function CaretSafeInput({ onChange, onCompositionStart, onCompositionEnd, value, defaultValue: _dv, ...rest }, fwd) {
    const inner = useRef<HTMLInputElement | null>(null);
    const composing = useRef(false);
    const flushPending = useExternalSync(inner as React.MutableRefObject<El | null>, composing, value);

    return (
      <input
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        {...rest}
        style={{ unicodeBidi: 'plaintext', ...rest.style }}
        defaultValue={value == null ? '' : String(value as string)}
        ref={(el) => { inner.current = el; assignRef(fwd, el); }}
        onCompositionStart={(e) => { composing.current = true; onCompositionStart?.(e); }}
        onCompositionEnd={(e) => { composing.current = false; flushPending(); onCompositionEnd?.(e); }}
        onChange={(e) => { onChange?.(e); }}
      />
    );
  }
);

export const CaretSafeTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function CaretSafeTextarea({ onChange, onCompositionStart, onCompositionEnd, onBlur, value, defaultValue: _dv, ...rest }, fwd) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    const composing = useRef(false);
    const flushPending = useExternalSync(inner as React.MutableRefObject<El | null>, composing, value);

    // ── صفر إعادة رسم أثناء الكتابة ──────────────────────────────
    // على بعض الأجهزة، أي إعادة رسم/تدفّق (reflow) مع كل حرف — حتى دون لمس
    // الحقل — تقطع «تركيب الكلمة» في الكيبورد وترمي المؤشر للآخر. لذلك
    // نؤجل إبلاغ التطبيق (onChange → setState → إعادة رسم) حتى يتوقف
    // المستخدم عن الكتابة لحظة (200ms) أو يغادر الحقل. الكيبورد يكتب في
    // الحقل مباشرة دون أي تدخّل أو إعادة رسم إطلاقاً أثناء الكتابة.
    const timer = useRef<number | undefined>(undefined);
    const lastEv = useRef<React.ChangeEvent<HTMLTextAreaElement> | null>(null);
    const fireNow = () => {
      window.clearTimeout(timer.current);
      const ev = lastEv.current;
      lastEv.current = null;
      if (ev) onChange?.(ev); // e.target حي — يقرأ القيمة الحالية للحقل
    };
    // عند الإزالة: بلّغ بآخر قيمة كي لا تضيع
    React.useEffect(() => () => { if (lastEv.current) fireNow(); }, []);

    return (
      <textarea
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        {...rest}
        style={{ unicodeBidi: 'plaintext', ...rest.style }}
        defaultValue={value == null ? '' : String(value as string)}
        ref={(el) => { inner.current = el; assignRef(fwd, el); }}
        onCompositionStart={(e) => { composing.current = true; onCompositionStart?.(e); }}
        onCompositionEnd={(e) => { composing.current = false; flushPending(); onCompositionEnd?.(e); }}
        onBlur={(e) => { fireNow(); onBlur?.(e); }}
        onChange={(e) => {
          lastEv.current = e;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(fireNow, 200);
        }}
      />
    );
  }
);
