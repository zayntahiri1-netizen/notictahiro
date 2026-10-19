/**
 * PlainEditable.tsx — محرر نص عادي بتقنية contenteditable
 * ─────────────────────────────────────────────────────────
 * لماذا؟ حقول <textarea> في Android System WebView تعاني في بعض الإصدارات
 * من عطب موثّق في تحرير العربية وسط النص (الحرف يُلصق في الآخر). عنصر
 * contenteditable يسلك مساراً مختلفاً كلياً داخل محرك العرض (مسار المحررات
 * الغنية) ولا يتأثر بذلك العطب — وهو ما تعتمده تطبيقات الملاحظات الكبرى.
 *
 * المبادئ (نفس فلسفة CaretSafe):
 *   • أثناء كتابة المستخدم لا نلمس DOM إطلاقاً ولا نعيد الرسم (مزامنة مؤجلة 200ms).
 *   • لا قراءة لموضع المؤشر أثناء «تركيب الكلمة».
 *   • الكتابة البرمجية (ذكاء اصطناعي/قوالب/صوت) تصل عبر تغيّر value من الخارج.
 *
 * يوفّر handle متوافقاً مع واجهة textarea: value / selectionStart /
 * setSelectionRange / focus / getBoundingClientRect — فيبقى كود المحرر كما هو.
 */
import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';

export interface PlainEditableHandle {
  focus(): void;
  readonly value: string;
  readonly selectionStart: number;
  setSelectionRange(start: number, end: number): void;
  getBoundingClientRect(): DOMRect;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  dir?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  onKeyUp?: React.KeyboardEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  onCompositionStart?: React.CompositionEventHandler<HTMLDivElement>;
  onCompositionEnd?: React.CompositionEventHandler<HTMLDivElement>;
}

/** قراءة النص الكامل (يطبّع <br> والفواصل الكتلية إلى \n) */
function readText(el: HTMLElement): string {
  // innerText يحترم فواصل الأسطر المرئية؛ نطبّع NBSP الذي قد يدرجه المحرك
  return el.innerText.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
}

/** موضع المؤشر كفهرس في النص (0 عند البداية) */
function getCaretIndex(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  // نحسب عبر استنساخ المحتوى لنحترم <br> كسطر جديد
  const frag = pre.cloneContents();
  const div = document.createElement('div');
  div.appendChild(frag);
  return readText(div).length;
}

/** وضع المؤشر عند فهرس نصي معيّن */
function setCaretIndex(root: HTMLElement, index: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let remaining = Math.max(0, index);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
  let node: Node | null = walker.nextNode();
  let target: Node = root;
  let offset = 0;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (remaining <= len) { target = node; offset = remaining; break; }
      remaining -= len;
    } else if ((node as HTMLElement).tagName === 'BR') {
      if (remaining === 0) { target = node; offset = 0; break; }
      remaining -= 1; // <br> = سطر جديد بطول 1
    }
    node = walker.nextNode();
    if (!node) { // تجاوزنا النهاية — ضع المؤشر في آخر النص
      target = root; offset = root.childNodes.length;
    }
  }
  const range = document.createRange();
  try {
    if (target.nodeType === Node.TEXT_NODE) range.setStart(target, Math.min(offset, (target.textContent || '').length));
    else if ((target as HTMLElement).tagName === 'BR') range.setStartBefore(target);
    else range.setStart(target, Math.min(offset, target.childNodes.length));
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch { /* تجاهل مواضع غير صالحة */ }
}

export const PlainEditable = forwardRef<PlainEditableHandle, Props>(function PlainEditable(
  { value, onChangeText, dir, placeholder, className, style, onKeyUp, onClick, onBlur, onCompositionStart, onCompositionEnd, ...rest }, fwd
) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const composing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);

  const fireNow = () => {
    window.clearTimeout(timer.current);
    if (dirty.current && divRef.current) {
      dirty.current = false;
      onChangeText(readText(divRef.current));
    }
  };

  // مزامنة خارجية: اكتب في الحقل فقط إذا تغيّرت القيمة من خارج الحقل
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const v = value ?? '';
    if (dirty.current) return;               // المستخدم يكتب — لا تلمس
    if (composing.current) return;           // وسط تركيب كلمة — لا تلمس
    if (readText(el) === v) return;          // مطابق — لا شيء يُفعل
    const focused = document.activeElement === el;
    const caret = focused ? getCaretIndex(el) : null;
    el.textContent = v;                      // نص عادي فقط (\n تُعرض عبر pre-wrap)
    if (focused && caret !== null) setCaretIndex(el, Math.min(caret, v.length));
  }, [value]);

  // عند الإزالة: بلّغ بآخر قيمة كي لا تضيع
  React.useEffect(() => () => fireNow(), []);

  useImperativeHandle(fwd, (): PlainEditableHandle => ({
    focus: () => divRef.current?.focus(),
    get value() { return divRef.current ? readText(divRef.current) : ''; },
    get selectionStart() { return divRef.current ? getCaretIndex(divRef.current) : 0; },
    setSelectionRange: (start: number) => { if (divRef.current) setCaretIndex(divRef.current, start); },
    getBoundingClientRect: () => (divRef.current as HTMLDivElement).getBoundingClientRect(),
  }), []);

  return (
    <div
      {...rest}
      ref={(el) => {
        divRef.current = el;
        if (el) {
          // plaintext-only: تحرير نص عادي بمسار المحررات (يتجاوز عطب textarea).
          // إن لم يدعمه المتصفح (نادر) نعود إلى true.
          el.setAttribute('contenteditable', 'plaintext-only');
          if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
          // أول تركيب: عبّئ النص الابتدائي
          if (el.textContent === '' && value) el.textContent = value;
        }
      }}
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder || ''}
      dir={dir}
      className={`plain-editable ${className || ''}`}
      style={style}
      onInput={() => {
        dirty.current = true;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(fireNow, 200);
      }}
      onPaste={(e) => {
        // plaintext-only يلصق نصاً عادياً أصلاً؛ هذا تأمين لمسار fallback
        // (contenteditable="true" على WebView قديمة) كي لا يدخل HTML منسّق.
        const el = divRef.current;
        if (el && el.getAttribute('contenteditable') === 'true') {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }
      }}
      onCompositionStart={(e) => { composing.current = true; onCompositionStart?.(e); }}
      onCompositionEnd={(e) => { composing.current = false; onCompositionEnd?.(e); }}
      onBlur={(e) => { fireNow(); onBlur?.(e); }}
      onKeyUp={onKeyUp}
      onClick={onClick}
    />
  );
});
