import { memo, useState } from 'react';
import { useApp, Note } from '../context/AppContext';
import { ConfirmModal } from './PromptModal';
import * as haptics from '../utils/haptics';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  viewMode?: 'rectangle' | 'square';
}

function NoteCardImpl({ note, onClick, viewMode = 'rectangle' }: NoteCardProps) {
  const { darkMode, togglePin, deleteNote, projects, searchQuery, language } = useApp();

  // ─── نصوص البطاقة — متعددة اللغات (ar/en/es/zh) ────────────────────
  const NC_ALL = {
    ar: { untitled: 'بدون عنوان', startWriting: 'ابدأ بالكتابة...', tasks: 'المهام', protectedContent: 'محتوى محمي برقم سري',
          more: (n: number) => `+${n} أخرى`, pin: 'تثبيت', unpin: 'إلغاء التثبيت', pinned: 'مثبّت',
          del: 'حذف', delTitle: 'حذف الملاحظة',
          delMsg: (t: string) => `هل تريد حذف "${t}" نهائياً؟`,
          delConfirm: '🗑️ نعم، احذف', delCancel: 'تراجع' },
    en: { untitled: 'Untitled', startWriting: 'Start writing...', tasks: 'Tasks', protectedContent: 'PIN-protected content',
          more: (n: number) => `+${n} more`, pin: 'Pin', unpin: 'Unpin', pinned: 'Pinned',
          del: 'Delete', delTitle: 'Delete note',
          delMsg: (t: string) => `Delete "${t}" permanently?`,
          delConfirm: '🗑️ Yes, delete', delCancel: 'Cancel' },
    es: { untitled: 'Sin título', startWriting: 'Empieza a escribir...', tasks: 'Tareas', protectedContent: 'Contenido protegido con PIN',
          more: (n: number) => `+${n} más`, pin: 'Fijar', unpin: 'Quitar fijado', pinned: 'Fijada',
          del: 'Eliminar', delTitle: 'Eliminar nota',
          delMsg: (t: string) => `¿Eliminar "${t}" permanentemente?`,
          delConfirm: '🗑️ Sí, eliminar', delCancel: 'Cancelar' },
    zh: { untitled: '无标题', startWriting: '开始书写...', tasks: '任务', protectedContent: '密码保护的内容',
          more: (n: number) => `+${n} 项`, pin: '置顶', unpin: '取消置顶', pinned: '已置顶',
          del: '删除', delTitle: '删除笔记',
          delMsg: (t: string) => `永久删除“${t}”吗？`,
          delConfirm: '🗑️ 是，删除', delCancel: '取消' },
  } as const;
  const NC = NC_ALL[(language as keyof typeof NC_ALL)] ?? NC_ALL.en;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pinAnim, setPinAnim] = useState(false);

  const project = projects.find(p => p.id === note.projectId);

  // إبراز نص البحث داخل العنوان أو المعاينة (آمن من الحقن — لا innerHTML)
  const highlight = (text: string): React.ReactNode => {
    const q = searchQuery.trim();
    if (!q) return text;
    // تجزئة آمنة عبر split بدلاً من dangerouslySetInnerHTML
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${safe})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <mark key={i} className="rounded-md bg-yellow-200/80 px-0.5 text-gray-900 dark:bg-yellow-400/40 dark:text-yellow-50">{part}</mark>
        : <span key={i}>{part}</span>
    );
  };

  const getPreview = (content: string) => {
    const cleaned = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[`>]/g, '')
      .replace(/\- \[([ x])\]/g, (_m, c) => c === 'x' ? '✓ ' : '○ ')
      .replace(/\- /g, '• ')
      .replace(/\n+/g, ' ')
      .trim();
    return cleaned.length > 150 ? cleaned.substring(0, 150) + '...' : cleaned;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    const localeMap: Record<string, string> = { ar: 'ar-MA', en: 'en-US', es: 'es-ES', zh: 'zh-CN' };
    const locale = localeMap[language] || 'en-US';
    if (days === 0) {
      return language === 'ar' ? 'اليوم' : language === 'es' ? 'Hoy' : language === 'zh' ? '今天' : 'Today';
    }
    if (days === 1) {
      return language === 'ar' ? 'أمس' : language === 'es' ? 'Ayer' : language === 'zh' ? '昨天' : 'Yesterday';
    }
    if (days < 7) {
      if (language === 'ar') return `منذ ${days} أيام`;
      if (language === 'es') return `Hace ${days} días`;
      if (language === 'zh') return `${days}天前`;
      return `${days}d ago`;
    }
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPinAnim(true);
    haptics.tap('light'); togglePin(note.id);
    setTimeout(() => setPinAnim(false), 400);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.warning(); setShowDeleteConfirm(true);
  };

  const isSquare = viewMode === 'square';

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border cursor-pointer
        transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden
        ${isSquare ? 'aspect-square' : ''}
        ${note.type === 'idea'
          ? 'border-amber-300/60 dark:border-amber-600/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/15'
          : 'border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-800/90'
        }
        ${note.isPinned ? 'ring-2 ring-violet-400/40 dark:ring-violet-500/30' : ''}
        hover:border-violet-300/70 dark:hover:border-violet-600/50`}
      onClick={onClick}
    >
      {/* شريط التثبيت العلوي */}
      {note.isPinned && (
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 rounded-t-2xl" />
      )}

      {/* المحتوى الرئيسي */}
      <div className="flex-1 p-4 pb-2">
        {/* رأس البطاقة */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {note.type === 'idea' && <span className="text-lg shrink-0">💡</span>}
            {project && (
              <span
                className="px-2 py-0.5 rounded-full text-xs text-white font-medium truncate"
                style={{ backgroundColor: project.color }}
              >
                {project.name}
              </span>
            )}
          </div>

          {/* مؤشر التثبيت (دائماً مرئي إذا كانت مثبّتة) */}
          {note.isPinned && (
            <span className="shrink-0 text-violet-500 dark:text-violet-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </span>
          )}
        </div>

        {/* العنوان */}
        <h3 className={`font-semibold mb-1.5 line-clamp-1 text-base flex items-center gap-1.5
          ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {note.isLocked && <span title={NC.protectedContent} className="shrink-0">🔒</span>}
          {note.title ? highlight(note.title) : NC.untitled}
        </h3>

        {/* المحتوى */}
        <p className={`text-sm leading-relaxed
          ${isSquare ? 'line-clamp-4' : 'line-clamp-3'}
          ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {note.isLocked
            ? <span className="italic opacity-70">🔒 {NC.protectedContent}</span>
            : (note.content ? highlight(getPreview(note.content)) : NC.startWriting)}
        </p>

        {/* المهام */}
        {note.aiData?.extractedTasks && note.aiData.extractedTasks.length > 0 && !isSquare && (
          <div className={`mt-2.5 p-2 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{NC.tasks}</p>
            {note.aiData.extractedTasks.slice(0, 2).map((task, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={task.done ? 'text-emerald-500' : 'text-gray-400'}>
                  {task.done ? '✓' : '○'}
                </span>
                <span className={`line-clamp-1 ${task.done
                  ? 'line-through text-gray-400'
                  : darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {task.task}
                </span>
              </div>
            ))}
            {note.aiData.extractedTasks.length > 2 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {NC.more(note.aiData.extractedTasks.length - 2)}
              </p>
            )}
          </div>
        )}

        {/* الوسوم */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {note.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx}
                className={`px-2 py-0.5 rounded-full text-xs
                  ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                #{tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className={`px-2 py-0.5 rounded-full text-xs
                ${darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── شريط الإجراءات السفلي — دائماً مرئي ── */}
      <div className={`flex items-center justify-between px-3 py-2 mt-auto
        border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-100'}`}>

        {/* التاريخ + المنبه */}
        <div className="flex items-center gap-2">
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {formatDate(note.updatedAt)}
          </span>
          {note.alarm?.hasAlarm && (
            <span className="text-emerald-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          )}
          {note.aiData?.summary && (
            <span className="px-1.5 py-0.5 rounded-full text-xs
              bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
              AI
            </span>
          )}
        </div>

        {/* أزرار الإجراءات — دائماً مرئية على الموبايل */}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>

          {/* ── زر التثبيت ── */}
          <button aria-label={note.isPinned ? NC.unpin : NC.pin}
            onClick={handlePin}
            title={note.isPinned ? NC.unpin : NC.pin}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl
              text-xs font-medium transition-all duration-200 active:scale-95
              ${note.isPinned
                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
                : darkMode
                  ? 'bg-gray-700/60 text-gray-400 hover:bg-violet-900/30 hover:text-violet-400'
                  : 'bg-gray-100/80 text-gray-500 hover:bg-violet-100 hover:text-violet-600'
              } ${pinAnim ? 'scale-110' : ''}`}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${pinAnim ? 'rotate-12' : ''}`}
              fill={note.isPinned ? 'currentColor' : 'none'}
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="hidden sm:inline">
              {note.isPinned ? NC.pinned : NC.pin}
            </span>
          </button>

          {/* ── زر الحذف ── */}
          <button aria-label={NC.delTitle}
            onClick={handleDelete}
            title={NC.delTitle}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl
              text-xs font-medium transition-all duration-200 active:scale-95
              ${darkMode
                ? 'bg-gray-700/60 text-gray-400 hover:bg-red-900/40 hover:text-red-400'
                : 'bg-gray-100/80 text-gray-500 hover:bg-red-100 hover:text-red-600'
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="hidden sm:inline">{NC.del}</span>
          </button>
        </div>
      </div>

      {/* نافذة تأكيد الحذف */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteNote(note.id)}
        title={NC.delTitle}
        message={NC.delMsg(note.title || NC.untitled)}
        variant="danger"
        confirmLabel={NC.delConfirm}
        cancelLabel={NC.delCancel}
      />
    </div>
  );
}

// React.memo: لا يُعيد رسم البطاقة إلا إذا تغيّرت خصائصها فعلياً
// (مهم عند عرض قوائم كبيرة من الملاحظات حيث يجلب State تغييرات لا تخصّ كل بطاقة).
const NoteCard = memo(NoteCardImpl, (prev, next) =>
  prev.note === next.note &&
  prev.viewMode === next.viewMode &&
  prev.onClick === next.onClick
);

export default NoteCard;
