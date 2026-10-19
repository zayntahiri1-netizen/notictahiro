/**
 * LinkAutocomplete.tsx — نافذة اقتراحات لإكمال [[اسم الملاحظة]]
 * تظهر فوق المؤشّر عند كتابة [[ وتسمح بانتقاء الملاحظة بنقرة أو سهم لوحة المفاتيح.
 */
import { useEffect, useState, useRef } from 'react';
import type { Note } from '../context/AppContext';
import { suggestNotes } from '../utils/backlinks';

interface LinkAutocompleteProps {
  /** لغة لتنسيق التواريخ (BCP-47 أو لغة التطبيق) */
  language?: string;
  query: string;
  notes: Note[];
  darkMode: boolean;
  /** يُستدعى عند اختيار ملاحظة من القائمة */
  onSelect: (title: string) => void;
  /** يُستدعى عند الإلغاء (Esc أو فقدان السياق) */
  onClose: () => void;
  /** موقع النافذة (يُحدَّد بالبكسل من نقطة مرجعية في الواجهة) */
  anchorTop: number;
  anchorLeft: number;
}

export default function LinkAutocomplete({
  query,
  notes,
  darkMode,
  onSelect,
  onClose,
  anchorTop,
  anchorLeft,
  language = 'en',
}: LinkAutocompleteProps) {
  const locale = language === 'ar' ? 'ar' : language === 'es' ? 'es-ES' : language === 'zh' ? 'zh-CN' : 'en-US';

  const LABELS = (language === 'ar' ? {
    title: 'ربط ملاحظة', create: 'إنشاء', noteTitle: 'بدون عنوان',
    navHint: '↑↓ تنقّل', selectHint: '↵ اختيار', cancelHint: 'Esc إلغاء',
  } : language === 'es' ? {
    title: 'Vincular nota', create: 'Crear', noteTitle: 'Sin título',
    navHint: '↑↓ Navegar', selectHint: '↵ Seleccionar', cancelHint: 'Esc Cancelar',
  } : language === 'zh' ? {
    title: '链接笔记', create: '创建', noteTitle: '无标题',
    navHint: '↑↓ 导航', selectHint: '↵ 选择', cancelHint: 'Esc 取消',
  } : {
    title: 'Link a note', create: 'Create', noteTitle: 'Untitled',
    navHint: '↑↓ Navigate', selectHint: '↵ Select', cancelHint: 'Esc Cancel',
  });

  const suggestions = suggestNotes(notes, query, 6);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // أعِد الفهرس إلى 0 كلّما تغيّر الاستعلام
  useEffect(() => { setActiveIndex(0); }, [query]);

  // تفاعل لوحة المفاتيح — سهم، Enter، Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(suggestions.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (suggestions.length > 0) {
          e.preventDefault();
          const picked = suggestions[activeIndex];
          onSelect(picked.title || LABELS.noteTitle);
        } else if (query.trim()) {
          // لا اقتراح — اقبل الاستعلام كرابط شبح (سيُنشأ عند فتحه)
          e.preventDefault();
          onSelect(query.trim());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeIndex, suggestions, query, onSelect, onClose]);

  if (suggestions.length === 0 && !query.trim()) {
    return null; // لا شيء لاقتراحه
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={LABELS.title}
      className={`fixed z-[100] w-64 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl animate-fade-in-up ${
        darkMode ? 'border-gray-700 bg-gray-900/95 text-white' : 'border-gray-200 bg-white/95 text-gray-900'
      }`}
      style={{ top: anchorTop, left: anchorLeft }}
    >
      <div className={`flex items-center gap-2 border-b px-3 py-1.5 text-[11px] font-bold ${darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
        <span>🔗</span>
        <span>{LABELS.title}</span>
        {query && <span className={`mr-auto truncate ${darkMode ? 'text-violet-300' : 'text-violet-600'}`}>«{query}»</span>}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {suggestions.length > 0 ? (
          suggestions.map((n, i) => (
            <button
              key={n.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onSelect(n.title || LABELS.noteTitle)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition ${
                i === activeIndex
                  ? darkMode ? 'bg-violet-600/30' : 'bg-violet-100'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span className="shrink-0">📝</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {n.title || LABELS.noteTitle}
              </span>
              <span className={`shrink-0 text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {new Date(n.updatedAt).toLocaleDateString(locale)}
              </span>
            </button>
          ))
        ) : (
          <button
            onClick={() => onSelect(query.trim())}
            className={`flex w-full items-center gap-2 px-3 py-2 text-right text-sm hover:bg-black/5 dark:hover:bg-white/5`}
          >
            <span>✨</span>
            <span className="font-medium">
              {LABELS.create} «{query.trim()}»
            </span>
          </button>
        )}
      </div>
      <div className={`flex items-center justify-between gap-2 border-t px-3 py-1 text-[10px] ${darkMode ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
        <span>{LABELS.navHint}</span>
        <span>{LABELS.selectHint}</span>
        <span>{LABELS.cancelHint}</span>
      </div>
    </div>
  );
}
