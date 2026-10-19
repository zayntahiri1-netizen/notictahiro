/**
 * MarkdownView.tsx — عارض Markdown احترافي، آمن وخفيف (بلا مكتبات خارجية)
 *
 * المدعوم:
 *   • العناوين #..######
 *   • الغامق **، المائل *، الكود `inline`
 *   • القوائم المرتّبة وغير المرتّبة (- *)
 *   • مهام تفاعلية - [ ] و - [x] (قابلة للنقر)
 *   • الاقتباس >
 *   • كتل الكود ```
 *   • الروابط [text](url)
 *   • الروابط الثنائية [[note title]] قابلة للنقر
 *   • الأسطر الفارغة كفقرات
 *   • الإبراز للنصوص (==text==)
 *
 * الأمان: كل العناصر تُنشأ كـ React nodes — لا توجد عمليّة innerHTML على الإطلاق،
 * فلا مخاطر XSS مهما كان محتوى المستخدم.
 */

import React from 'react';
import { extractLinks, findNoteByTitle } from '../utils/backlinks';
import type { Note } from '../context/AppContext';

interface MarkdownViewProps {
  source: string;
  notes?: Note[];
  /** يُستدعى عند نقر مهمة لتبديل حالتها (يُعيد النصّ المُحدَّث) */
  onTaskToggle?: (newSource: string) => void;
  /** يُستدعى عند النقر على رابط ثنائي [[X]] (يُمرَّر معرّف الملاحظة أو العنوان للشبح) */
  onOpenLink?: (noteId: string | null, title: string) => void;
  darkMode?: boolean;
  className?: string;
}

/** يُحوّل النصّ المُسطَّر إلى React nodes مع تنسيق inline (غامق، مائل، كود، روابط) */
function renderInline(
  text: string,
  notes: Note[] | undefined,
  onOpenLink: MarkdownViewProps['onOpenLink'],
  keyPrefix: string,
  darkMode?: boolean
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // نمط مُركَّب: نلتقط كل التراكيب inline في مرور واحد
  const pattern = /\[\[([^\]\n]+?)\]\]|`([^`\n]+?)`|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|==([^=\n]+?)==|\[([^\]\n]+?)\]\(([^)\s]+?)\)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(text.slice(lastIndex, m.index));
    }
    const k = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      // [[backlink]]
      const linkName = m[1].trim();
      const target = notes ? findNoteByTitle(notes, linkName) : undefined;
      nodes.push(
        <button
          key={k}
          onClick={(e) => { e.stopPropagation(); onOpenLink?.(target?.id || null, linkName); }}
          className={`inline-flex items-center gap-0.5 rounded-md px-1 py-0 font-bold transition active:scale-95 ${
            target
              ? darkMode ? 'bg-violet-600/30 text-violet-200 hover:bg-violet-600/50' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
              : darkMode ? 'border border-dashed border-gray-700 text-gray-500 hover:text-gray-300' : 'border border-dashed border-gray-300 text-gray-500 hover:text-gray-700'
          }`}
          title={target ? 'Open note' : 'Create note'}
        >
          {target ? '🔗' : '✨'} {linkName}
        </button>
      );
    } else if (m[2] !== undefined) {
      // `code`
      nodes.push(
        <code key={k} className={`rounded px-1.5 py-0.5 font-mono text-[0.9em] ${darkMode ? 'bg-gray-800 text-pink-300' : 'bg-pink-50 text-pink-700'}`}>
          {m[2]}
        </code>
      );
    } else if (m[3] !== undefined) {
      // **bold**
      nodes.push(<strong key={k} className="font-black">{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      // *italic*
      nodes.push(<em key={k} className="italic">{m[4]}</em>);
    } else if (m[5] !== undefined) {
      // ==highlight==
      nodes.push(
        <mark key={k} className="rounded bg-yellow-200/70 px-0.5 text-gray-900 dark:bg-yellow-400/30 dark:text-yellow-50">
          {m[5]}
        </mark>
      );
    } else if (m[6] !== undefined && m[7] !== undefined) {
      // [text](url)
      const url = m[7];
      const safe = /^(https?:|mailto:|tel:)/i.test(url) ? url : '#';
      nodes.push(
        <a key={k} href={safe} target="_blank" rel="noopener noreferrer"
           className={`underline decoration-dotted underline-offset-2 transition ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}>
          {m[6]}
        </a>
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function MarkdownView({
  source,
  notes,
  onTaskToggle,
  onOpenLink,
  darkMode,
  className = '',
}: MarkdownViewProps) {
  const lines = source.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let listBuf: { ordered: boolean; items: { text: string; lineIdx: number }[] } | null = null;
  let codeBuf: { lang: string; lines: string[] } | null = null;

  const flushList = (key: string) => {
    if (!listBuf) return;
    const Tag = listBuf.ordered ? 'ol' : 'ul';
    const items = listBuf.items;
    blocks.push(
      <Tag key={key} className={`my-2 space-y-1 ${listBuf.ordered ? 'list-decimal' : 'list-disc'} ms-6`}>
        {items.map((it, idx) => {
          // كشف المهام: - [ ] أو - [x]
          const taskMatch = it.text.match(/^\[([ xX])\]\s+(.*)$/);
          if (taskMatch && onTaskToggle) {
            const checked = taskMatch[1].toLowerCase() === 'x';
            const label = taskMatch[2];
            return (
              <li key={idx} className="list-none -ms-6 flex items-start gap-2">
                <button
                  onClick={() => {
                    const newLines = source.split('\n');
                    const ln = newLines[it.lineIdx];
                    const replaced = ln.replace(/^(\s*[-*]\s*)\[([ xX])\]/, (_m, p1) => `${p1}[${checked ? ' ' : 'x'}]`);
                    newLines[it.lineIdx] = replaced;
                    onTaskToggle(newLines.join('\n'));
                  }}
                  aria-label={checked ? 'Mark task as not done' : 'Mark task as done'}
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition active:scale-90 ${
                    checked
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : darkMode ? 'border-gray-600 hover:border-violet-400' : 'border-gray-300 hover:border-violet-500'
                  }`}
                >
                  {checked && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={checked ? `line-through ${darkMode ? 'text-gray-500' : 'text-gray-400'}` : ''}>
                  {renderInline(label, notes, onOpenLink, `t${idx}`, darkMode)}
                </span>
              </li>
            );
          }
          return (
            <li key={idx}>{renderInline(it.text, notes, onOpenLink, `i${idx}`, darkMode)}</li>
          );
        })}
      </Tag>
    );
    listBuf = null;
  };

  while (i < lines.length) {
    const raw = lines[i];

    // كتلة كود ```
    if (codeBuf) {
      if (raw.trim().startsWith('```')) {
        blocks.push(
          <pre key={`code-${i}`} className={`my-3 overflow-x-auto rounded-xl p-3 text-[13px] font-mono leading-relaxed ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'}`} dir="ltr">
            <code>{codeBuf.lines.join('\n')}</code>
          </pre>
        );
        codeBuf = null;
        i++;
        continue;
      }
      codeBuf.lines.push(raw);
      i++;
      continue;
    }
    const codeStart = raw.match(/^```(\w*)\s*$/);
    if (codeStart) {
      flushList(`l-${i}`);
      codeBuf = { lang: codeStart[1], lines: [] };
      i++;
      continue;
    }

    // عنوان
    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList(`l-${i}`);
      const level = heading[1].length;
      const text = heading[2];
      const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      blocks.push(
        React.createElement(
          Tag,
          { key: `h-${i}`, className: `${sizes[level - 1]} font-black mt-4 mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}` },
          renderInline(text, notes, onOpenLink, `h${i}`, darkMode)
        )
      );
      i++;
      continue;
    }

    // اقتباس
    if (raw.startsWith('> ')) {
      flushList(`l-${i}`);
      blocks.push(
        <blockquote key={`q-${i}`} className={`my-2 border-s-4 ps-3 italic ${darkMode ? 'border-violet-700 text-gray-400' : 'border-violet-300 text-gray-600'}`}>
          {renderInline(raw.slice(2), notes, onOpenLink, `q${i}`, darkMode)}
        </blockquote>
      );
      i++;
      continue;
    }

    // قائمة
    const ulMatch = raw.match(/^[-*]\s+(.*)$/);
    const olMatch = raw.match(/^\d+\.\s+(.*)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const text = (ulMatch?.[1] ?? olMatch?.[1] ?? '');
      if (!listBuf || listBuf.ordered !== ordered) {
        flushList(`l-${i}`);
        listBuf = { ordered, items: [] };
      }
      listBuf.items.push({ text, lineIdx: i });
      i++;
      continue;
    }

    // سطر فارغ
    if (raw.trim() === '') {
      flushList(`l-${i}`);
      blocks.push(<div key={`s-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // فقرة عادية
    flushList(`l-${i}`);
    blocks.push(
      <p key={`p-${i}`} className="my-1 leading-relaxed">
        {renderInline(raw, notes, onOpenLink, `p${i}`, darkMode)}
      </p>
    );
    i++;
  }
  flushList('l-end');

  // معالجة كتلة كود لم تُغلق (نصّ ينتهي بـ ``` مفتوحة بدون إغلاق)
  if (codeBuf) {
    blocks.push(
      <pre key="code-unclosed" className={`my-3 overflow-x-auto rounded-xl p-3 text-[13px] font-mono leading-relaxed ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'}`} dir="ltr">
        <code>{codeBuf.lines.join('\n')}</code>
      </pre>
    );
  }

  return (
    <div className={`text-[15px] leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-800'} ${className}`}>
      {blocks.length === 0 ? (
        <p className={`italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Nothing to preview yet…</p>
      ) : blocks}
    </div>
  );
}
