import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { useApp } from '../context/AppContext';
import NoteCard from './NoteCard';
import { getTemplates } from '../utils/templates';

interface NotesListProps {
  onEditNote: (noteId: string) => void;
  onNewNote: () => void;
}

export default function NotesList({ onEditNote, onNewNote }: NotesListProps) {
  const { notes, selectedProject, projects, searchQuery, t, language, darkMode } = useApp();
  const [viewMode, setViewMode] = useState<'rectangle' | 'square'>(() => {
    return (localStorage.getItem('notic-notes-view') as 'rectangle' | 'square') || 'rectangle';
  });

  // ─── خيار الترتيب: تاريخ التحديث، الإنشاء، العنوان، طول النصّ ───
  type SortMode = 'updated' | 'created' | 'title' | 'length';
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try { return (localStorage.getItem('notic-sort') as SortMode) || 'updated'; } catch { return 'updated'; }
  });
  useEffect(() => {
    try { localStorage.setItem('notic-sort', sortMode); } catch {}
  }, [sortMode]);

  const sortLabels: Record<SortMode, Record<string, string>> = {
    updated: { ar: 'الأحدث', en: 'Recent', es: 'Reciente', zh: '最近' },
    created: { ar: 'الإنشاء', en: 'Created', es: 'Creado', zh: '创建' },
    title:   { ar: 'العنوان', en: 'Title', es: 'Título', zh: '标题' },
    length:  { ar: 'الطول', en: 'Length', es: 'Longitud', zh: '长度' },
  };

  useEffect(() => {
    try { localStorage.setItem('notic-notes-view', viewMode); } catch {}
  }, [viewMode]);

  // تأجيل قيمة البحث لإبقاء حقل الإدخال سلساً مع قوائم كبيرة (مئات الملاحظات)
  const deferredQuery = useDeferredValue(searchQuery);

  // تصفية + ترتيب — مُذكَّرين بـ useMemo لتفادي الحساب المتكرّر
  const sortedNotes = useMemo(() => {
    let filtered = notes;

    if (selectedProject === '__none__') {
      filtered = notes.filter(note => !note.projectId);
    } else if (selectedProject) {
      filtered = notes.filter(note => note.projectId === selectedProject);
    }

    const q = deferredQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(q) ||
        // الملاحظات المقفلة: محتواها مُشفَّر — لا نبحث فيه (يطابق بالعنوان/الوسوم فقط)
        (!note.isLocked && note.content.toLowerCase().includes(q)) ||
        note.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      switch (sortMode) {
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'title':
          return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
        case 'length':
          return (b.content?.length || 0) - (a.content?.length || 0);
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [notes, selectedProject, deferredQuery, sortMode]);

  const pinnedNotes = sortedNotes.filter(n => n.isPinned);
  const unpinnedNotes = sortedNotes.filter(n => !n.isPinned);

  const currentProject = projects.find(p => p.id === selectedProject);
  const headerTitle = selectedProject === '__none__'
    ? t('noProject')
    : selectedProject
      ? (currentProject?.name || t('projects'))
      : t('allNotes');

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-32">
      {/* رأس الصفحة */}
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {headerTitle}
            </h2>
            {selectedProject && currentProject?.description && (
              <p className="text-gray-500 dark:text-gray-400">
                {currentProject.description}
              </p>
            )}
          </div>

          {/* أدوات الترتيب والعرض */}
          <div className="flex w-fit items-center gap-2">
            {/* قائمة الترتيب */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label={language === 'ar' ? 'الترتيب' : language === 'es' ? 'Ordenar' : language === 'zh' ? '排序' : 'Sort'}
              className="h-9 cursor-pointer rounded-2xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-violet-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {(['updated','created','title','length'] as SortMode[]).map(m => (
                <option key={m} value={m}>
                  {(language === 'ar' ? '⇅ ' : '↕ ') + (sortLabels[m][language] || sortLabels[m].en)}
                </option>
              ))}
            </select>

            {/* اختيار شكل مصفوفة الملاحظات والأفكار */}
            <div className="flex items-center gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setViewMode('rectangle')}
              className={`flex h-9 w-10 items-center justify-center rounded-xl transition-all ${
                viewMode === 'rectangle'
                  ? 'bg-white text-violet-600 shadow-sm dark:bg-gray-700 dark:text-violet-300'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title={language === 'ar' ? 'عرض مستطيلات' : language === 'es' ? 'Vista rectangular' : language === 'zh' ? '矩形视图' : 'Rectangle view'}
              aria-label={language === 'ar' ? 'عرض مستطيلات' : language === 'es' ? 'Vista rectangular' : language === 'zh' ? '矩形视图' : 'Rectangle view'}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="6" width="16" height="5" rx="2" />
                <rect x="4" y="14" width="16" height="4" rx="2" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('square')}
              className={`flex h-9 w-10 items-center justify-center rounded-xl transition-all ${
                viewMode === 'square'
                  ? 'bg-white text-violet-600 shadow-sm dark:bg-gray-700 dark:text-violet-300'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title={language === 'ar' ? 'عرض مربعات' : language === 'es' ? 'Vista cuadrada' : language === 'zh' ? '方形视图' : 'Square view'}
              aria-label={language === 'ar' ? 'عرض مربعات' : language === 'es' ? 'Vista cuadrada' : language === 'zh' ? '方形视图' : 'Square view'}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="7" height="7" rx="2" />
                <rect x="13" y="4" width="7" height="7" rx="2" />
                <rect x="4" y="13" width="7" height="7" rx="2" />
                <rect x="13" y="13" width="7" height="7" rx="2" />
              </svg>
            </button>
            </div>
          </div>
        </div>
      </div>

      {sortedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in-up">
          {searchQuery ? (
            <>
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                {t('noResults')}
              </h3>
              <p className="text-base text-gray-500 dark:text-gray-400 max-w-sm">
                {t('noResultsHint')}
              </p>
            </>
          ) : (
            <>
              <div className="text-7xl mb-5 animate-scale-in">📝</div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                {t('welcomeTitle2')}
              </h3>
              <p className="text-base text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                {t('welcomeSubtitle')}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={onNewNote}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-violet-500/30 transition active:scale-95"
                  aria-label={t('createFirstNote')}
                >
                  <span>✨</span>
                  <span>{t('createFirstNote')}</span>
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  {t('shortcutHint')} <kbd className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-mono dark:bg-gray-800">Ctrl + N</kbd>
                </p>
              </div>

              {/* مكتبة قوالب احترافية */}
              <div className="mt-10 w-full max-w-2xl">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'أو ابدأ من قالب' : language === 'es' ? 'O empieza con una plantilla' : language === 'zh' ? '或从模板开始' : 'Or start from a template'}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {getTemplates(language).map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        try {
                          sessionStorage.setItem('notic-template', JSON.stringify({
                            content: tpl.content[language] || tpl.content.en,
                            tags: tpl.tags || [],
                          }));
                        } catch {}
                        onNewNote();
                      }}
                      className={`group flex flex-col items-start gap-1 rounded-2xl border p-3 text-right transition hover:scale-[1.02] active:scale-95 ${
                        darkMode
                          ? 'border-gray-800 bg-gray-900/50 hover:border-violet-600/50'
                          : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-md'
                      }`}
                      aria-label={tpl.name[language] || tpl.name.en}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="text-2xl transition group-hover:scale-110">{tpl.icon}</span>
                        <span className="text-sm font-bold">{tpl.name[language] || tpl.name.en}</span>
                      </div>
                      <span className="line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {tpl.description[language] || tpl.description.en}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* الملاحظات المثبتة */}
          {pinnedNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                {t('pinned')}
              </h3>
              <div className={viewMode === 'square' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}>
                {pinnedNotes.map(note => (
                  <NoteCard 
                    key={note.id} 
                    note={note} 
                    viewMode={viewMode}
                    onClick={() => onEditNote(note.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* باقي الملاحظات */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  {language === 'ar' ? 'أخرى' : language === 'es' ? 'Otras' : language === 'zh' ? '其他' : 'Others'}
                </h3>
              )}
              <div className={viewMode === 'square' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}>
                {unpinnedNotes.map((note) => (
                  <div key={note.id}>
                    <NoteCard
                      note={note}
                      viewMode={viewMode}
                      onClick={() => onEditNote(note.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
