import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ConfirmModal, AlertModal } from './PromptModal';
import Logo from './Logo';
import LanguageSelector from './LanguageSelector';
import * as haptics from '../utils/haptics';
import { showPrivacyOptions, getAdDiagnostics } from '../utils/admob';
import { getStorageUsage, formatBytes } from '../utils/storageHealth';
import { getLastBackupTime, isBackupDurable, runAutoBackupIfDue } from '../utils/autoBackup';
import ErrorLogModal from './ErrorLogModal';
import VoicePicker from './VoicePicker';
import RestoreBackupModal from './RestoreBackupModal';
import CloudSyncModal from './CloudSyncModal';
import { isSyncConfigured } from '../utils/cloudSync';
import { isProactiveNotifyEnabled, setProactiveNotifyEnabled } from '../utils/proactiveNotify';
import { getEntries } from '../utils/errorLog';
import { CaretSafeInput } from './CaretSafe';
import {
  isBubbleSupported, checkBubblePermission, requestBubblePermission,
  startBubble, stopBubble, ensureBubbleRunning,
} from '../utils/bubbleOverlay';

interface SidebarProps {
  onNewNote: () => void;
  onNewIdea: () => void;
}

export default function Sidebar({ onNewNote, onNewIdea }: SidebarProps) {
  const {
    projects,
    notes,
    darkMode,
    selectedProject,
    setSelectedProject,
    setDarkMode,
    addProject,
    deleteProject,
    exportData,
    importData,
    t,
    language,
    // ⚠️ تُؤخذ من السياق لا تُشتقّ هنا: قائمة لغات RTL معرَّفة في مكان
    // واحد (AppContext)، وإعادة اشتقاقها محلياً تعني أن إضافة لغة RTL
    // جديدة لاحقاً تُصلح التطبيق كلّه وتترك هذا الملف خلفها بصمت.
    direction
  } = useApp();

  const SB = {
    ar: { projectsHub: 'المركز الرئيسي لتنظيم Notic Tahiro', searchProjects: 'بحث في المشاريع...',
          notesCount: 'ملاحظات', ofContent: 'من المحتوى', noMatch: 'لا توجد مشاريع مطابقة',
          delProject: 'حذف المشروع', projectName: 'اسم المشروع', cancel: 'إلغاء', add: 'إضافة',
          export: 'تصدير', import: 'استيراد', exportLabel: 'تصدير البيانات', exportTip: 'تصدير ملاحظاتك ومشاريعك كملفّ JSON',
          importLabel: 'استيراد البيانات', importTip: 'استيراد بيانات من ملفّ JSON',
          delTitle: 'حذف المشروع', delMsg: 'هل تريد حذف هذا المشروع؟ ستبقى الملاحظات لكنها ستفقد الارتباط بالمشروع.',
          delConfirm: '🗑️ نعم، احذف', delCancel: 'تراجع', importOk: 'تمّ الاستيراد', importFail: 'تعذّر الاستيراد', ok: 'حسناً',
          bubbleTitle: 'الفقعة العائمة', bubbleDesc: 'تطفو فوق التطبيقات الأخرى — ملاحظة سريعة/AI/تذكير من أي مكان',
          bubblePermTitle: 'إذن مطلوب', bubblePermMsg: 'يجب منح إذن "العرض فوق التطبيقات الأخرى" من إعدادات النظام لتشغيل الفقعة. سيتم تحويلك للإعدادات الآن.',
          bubbleAndroidOnly: 'متاحة فقط على أندرويد',
          storage: 'التخزين', errLog: 'سجل الأخطاء',
          backup: 'نسخة احتياطية', backupNever: 'لم تُنشأ بعد', backupTapNow: 'اضغط لإنشاء نسخة الآن',
          backupDurable: 'محفوظة في المستندات — تبقى بعد حذف التطبيق', backupFragile: 'داخل التطبيق فقط — تُمحى مع حذفه. صدّر نسخة يدوياً' },
    en: { projectsHub: 'The main hub for organizing Notic Tahiro', searchProjects: 'Search projects...',
          notesCount: 'notes', ofContent: 'of content', noMatch: 'No matching projects',
          delProject: 'Delete project', projectName: 'Project name', cancel: 'Cancel', add: 'Add',
          export: 'Export', import: 'Import', exportLabel: 'Export data', exportTip: 'Export your notes and projects as a JSON file',
          importLabel: 'Import data', importTip: 'Import data from a JSON file',
          delTitle: 'Delete project', delMsg: 'Delete this project? Notes will remain but lose their project link.',
          delConfirm: '🗑️ Yes, delete', delCancel: 'Undo', importOk: 'Import complete', importFail: 'Import failed', ok: 'OK',
          bubbleTitle: 'Floating bubble', bubbleDesc: 'Floats over other apps — quick note/AI/reminder from anywhere',
          bubblePermTitle: 'Permission required', bubblePermMsg: 'You must grant "Display over other apps" from system settings to enable the bubble. Redirecting you now.',
          bubbleAndroidOnly: 'Android only',
          storage: 'Storage', errLog: 'Error log',
          backup: 'Backup', backupNever: 'never', backupTapNow: 'Tap to back up now',
          backupDurable: 'Saved in Documents — survives app deletion', backupFragile: 'Inside the app only — lost on uninstall. Export manually' },
    es: { projectsHub: 'El centro principal para organizar Notic Tahiro', searchProjects: 'Buscar proyectos...',
          notesCount: 'notas', ofContent: 'del contenido', noMatch: 'No hay proyectos coincidentes',
          delProject: 'Eliminar proyecto', projectName: 'Nombre del proyecto', cancel: 'Cancelar', add: 'Añadir',
          export: 'Exportar', import: 'Importar', exportLabel: 'Exportar datos', exportTip: 'Exporta tus notas y proyectos como archivo JSON',
          importLabel: 'Importar datos', importTip: 'Importar datos desde un archivo JSON',
          delTitle: 'Eliminar proyecto', delMsg: '¿Eliminar este proyecto? Las notas permanecerán pero perderán el vínculo.',
          delConfirm: '🗑️ Sí, eliminar', delCancel: 'Deshacer', importOk: 'Importación completa', importFail: 'Error al importar', ok: 'OK',
          bubbleTitle: 'Burbuja flotante', bubbleDesc: 'Flota sobre otras apps — nota rápida/IA/recordatorio desde cualquier lugar',
          bubblePermTitle: 'Permiso requerido', bubblePermMsg: 'Debes conceder "Mostrar sobre otras apps" desde los ajustes del sistema. Te redirigimos ahora.',
          bubbleAndroidOnly: 'Solo Android',
          storage: 'Almacenamiento', errLog: 'Registro de errores',
          backup: 'Copia de seguridad', backupNever: 'nunca', backupTapNow: 'Toca para crear una ahora',
          backupDurable: 'En Documentos — sobrevive a la desinstalación', backupFragile: 'Solo dentro de la app — se pierde al desinstalar. Exporta manualmente' },
    zh: { projectsHub: '整理 Notic Tahiro 的主中心', searchProjects: '搜索项目...',
          notesCount: '条笔记', ofContent: '的内容', noMatch: '没有匹配的项目',
          delProject: '删除项目', projectName: '项目名称', cancel: '取消', add: '添加',
          export: '导出', import: '导入', exportLabel: '导出数据', exportTip: '将您的笔记和项目导出为 JSON 文件',
          importLabel: '导入数据', importTip: '从 JSON 文件导入数据',
          delTitle: '删除项目', delMsg: '删除此项目？笔记将保留但会失去项目关联。',
          delConfirm: '🗑️ 是，删除', delCancel: '撤销', importOk: '导入完成', importFail: '导入失败', ok: '好的',
          bubbleTitle: '悬浮气泡', bubbleDesc: '悬浮在其他应用上方 — 随时随地快速记录/AI/提醒',
          bubblePermTitle: '需要权限', bubblePermMsg: '需要在系统设置中授予"显示在其他应用上层"权限才能启用气泡。现在为您跳转。',
          bubbleAndroidOnly: '仅支持安卓',
          storage: '存储空间', errLog: '错误日志',
          backup: '备份', backupNever: '尚未创建', backupTapNow: '点击立即备份',
          backupDurable: '保存在「文档」中 —— 卸载应用后仍然保留', backupFragile: '仅在应用内 —— 卸载即丢失。请手动导出' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? {
    projectsHub: 'The main hub for organizing Notic Tahiro', searchProjects: 'Search projects...',
    notesCount: 'notes', ofContent: 'of content', noMatch: 'No matching projects',
    delProject: 'Delete project', projectName: 'Project name', cancel: 'Cancel', add: 'Add',
    export: 'Export', import: 'Import', exportLabel: 'Export data', exportTip: 'Export your notes and projects as a JSON file',
    importLabel: 'Import data', importTip: 'Import data from a JSON file',
    delTitle: 'Delete project', delMsg: 'Delete this project? Notes will remain but lose their project link.',
    delConfirm: '🗑️ Yes, delete', delCancel: 'Undo', importOk: 'Import complete', importFail: 'Import failed', ok: 'OK',
    bubbleTitle: 'Floating bubble', bubbleDesc: 'Floats over other apps — quick note/AI/reminder from anywhere',
    bubblePermTitle: 'Permission required', bubblePermMsg: 'You must grant "Display over other apps" from system settings to enable the bubble. Redirecting you now.',
    bubbleAndroidOnly: 'Android only' };

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#8B5CF6');
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [bubbleOn, setBubbleOn] = useState(false);
  const [bubbleAlert, setBubbleAlert] = useState<{ title: string; message: string } | null>(null);
  const [adDiag, setAdDiag] = useState<string | null>(null);
  // مؤشر السعة: شريط دائم يُري المستخدم أين يقف قبل أن يصطدم بالحد.
  // التحذير الحرج (StorageAlert) لا يظهر إلا عند الخطر؛ هذا يجعل الوضع
  // مرئياً دائماً فيُصبح الامتلاء مفاجأة مستحيلة لا كارثة صامتة.
  const [storage, setStorage] = useState(() => getStorageUsage());
  const [backupAt, setBackupAt] = useState<Date | null>(() => getLastBackupTime());
  const [backupBusy, setBackupBusy] = useState(false);
  const [showErrLog, setShowErrLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [proactiveOn, setProactiveOn] = useState(() => isProactiveNotifyEnabled());
  useEffect(() => {
    const id = setInterval(() => setStorage(getStorageUsage()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── مزامنة حالة الفقعة الفعلية عند تركيب الشريط الجانبي ──────────
  // وأيضاً عند العودة من الخلفية (المستخدم قد يكون منح الإذن من
  // إعدادات النظام ثم رجع للتطبيق).
  useEffect(() => {
    if (!isBubbleSupported()) return;
    // نقرأ "الحالة المحفوظة" (bubble_enabled) لا حالة الخدمة اللحظية،
    // ونُعيد تشغيل الفقعة تلقائياً إن كانت مُفعَّلة وقتلها النظام. هكذا
    // تبقى الفقعة مُفعَّلة عبر إغلاق/فتح التطبيق دون تدخّل المستخدم.
    void ensureBubbleRunning().then(setBubbleOn);

    let removeListener: (() => void) | null = null;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const handle = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void ensureBubbleRunning().then(setBubbleOn);
        });
        removeListener = () => { void handle.remove(); };
      } catch { /* الإضافة غير متوفرة */ }
    })();
    return () => { removeListener?.(); };
  }, []);

  const handleToggleBubble = async () => {
    if (!isBubbleSupported()) {
      setBubbleAlert({ title: SB.bubbleTitle, message: SB.bubbleAndroidOnly });
      return;
    }
    haptics.tap('light');
    if (bubbleOn) {
      await stopBubble();
      setBubbleOn(false);
      return;
    }
    const granted = await checkBubblePermission();
    if (!granted) {
      setBubbleAlert({ title: SB.bubblePermTitle, message: SB.bubblePermMsg });
      await requestBubblePermission();
      return; // المستخدم سيُعيد الضغط على الزر بعد العودة من الإعدادات
    }
    const started = await startBubble();
    setBubbleOn(started);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    haptics.tap('light');
    exportData();
  };

  const handleImportClick = () => {
    haptics.tap('light');
    fileInputRef.current?.click();
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // اسمح بإعادة اختيار نفس الملفّ
    if (!file) return;
    const result = await importData(file);
    setShowSettings(false); // ⚠️ انظر openOver أدناه — نافذة النتيجة تُرسَم تحتها وإلا
    setImportResult(result);
    if (result.ok) haptics.success();
    else haptics.error();
  };

  /**
   * ⚠️ يفتح نافذة فرعية بعد إغلاق نافذة الإعدادات — والترتيب ليس ذوقاً.
   *
   * نافذة الإعدادات تُرسَم عبر portal إلى document.body، أي أنها تلي
   * #root في الـDOM فتعلو كل ما بداخله. أما النوافذ الفرعية (سجل
   * الأخطاء، الاسترجاع، المزامنة، تشخيص الإعلانات) فتُرسَم داخل الشريط.
   * فلو بقيت الإعدادات مفتوحة، لفُتحت النافذة الفرعية **تحتها** ولظنّ
   * المستخدم أن الزرّ لا يعمل.
   *
   * و z-index لا يُنقذ هنا: درج الهاتف نفسه `z-[80]` وهو stacking
   * context، فأي z-[100] بداخله يبقى محبوساً في طبقة الـ80 مهما علا.
   */
  const openOver = (open: () => void) => {
    haptics.tap('light');
    setShowSettings(false);
    open();
  };

  const colors = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', 
    '#EF4444', '#EC4899', '#6366F1', '#14B8A6'
  ];

  const allNotesCount = notes.length;
  const getProjectCount = (projectId: string) => notes.filter(note => note.projectId === projectId).length;
  const noProjectCount = notes.filter(note => !note.projectId).length;
  const noProjectPercent = allNotesCount > 0 ? Math.min(100, Math.round((noProjectCount / allNotesCount) * 100)) : 0;
  const showNoProjectTile = !projectSearch.trim() || t('noProject').toLowerCase().includes(projectSearch.trim().toLowerCase());
  const filteredProjects = projects.filter(project => {
    const query = projectSearch.trim().toLowerCase();
    return !query || project.name.toLowerCase().includes(query) || project.description.toLowerCase().includes(query);
  });

  const handleAddProject = () => {
    if (newProjectName.trim()) {
      addProject({
        name: newProjectName.trim(),
        description: '',
        color: newProjectColor
      });
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  /**
   * ⚠️ مؤشّر الإنذار على زرّ الإعدادات.
   *
   * مؤشّر التخزين وحالة النسخة الاحتياطية وعدّاد الأخطاء وُجدت كلها
   * لسبب واحد: أن **تُرى بلا بحث**. تخزينٌ ممتلئ لا يعلم به أحد يُضيّع
   * ملاحظة، ونسخة لم تُنشأ لا تطمئن أحداً. فدفنها خلف زرّ يُلغي الغرض
   * منها أصلاً.
   *
   * لذلك يبقى من كلٍّ منها أثرٌ واحد في الشريط: نقطة ملوّنة على الزرّ.
   * حمراء = خطأ فعلي في السجل، كهرمانية = تخزين يقارب الامتلاء أو لا
   * نسخة بعد. فيُختصر المكان بلا أن يُفقد الإنذار.
   */
  const errEntries = getEntries();
  const settingsAlert: 'error' | 'warn' | null =
    errEntries.some((e) => e.level === 'error') ? 'error'
    : (storage.nearFull || !backupAt) ? 'warn'
    : null;

  return (
    <aside className={`w-72 h-full flex flex-col border-l ${
      darkMode 
        ? 'bg-gray-950 border-gray-800' 
        : 'bg-slate-50 border-gray-200'
    }`}>
      {/* هوية المنتج */}
      <div className={`relative overflow-hidden border-b p-4 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="pointer-events-none absolute -right-16 -top-14 h-36 w-36 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-16 h-36 w-36 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="relative space-y-3">
          <Logo size="sm" animated darkMode={darkMode} />
          <div className={`flex items-center justify-between rounded-2xl px-3 py-2 ${
            darkMode ? 'bg-gray-900/80 border border-gray-800' : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className={`text-[10px] font-black ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>ONLINE</span>
            </div>
            <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-[10px] font-black tracking-widest text-transparent">PRO</span>
            <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>v2.0</span>
          </div>
        </div>
      </div>

      {/* إنشاء سريع مضغوط */}
      <div className="p-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onNewNote}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-500 to-indigo-600 px-3 py-3 text-xs font-black text-white shadow-lg shadow-violet-500/25 transition hover:scale-[1.01] active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t('newNote')}
          </button>
          <button
            onClick={onNewIdea}
            className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-3 py-3 text-xs font-black transition hover:scale-[1.01] active:scale-95 ${
              darkMode 
                ? 'border-amber-500/40 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10' 
                : 'border-amber-300 bg-amber-50/70 text-amber-700 hover:bg-amber-100/70'
            }`}
          >
            <span className="text-base">💡</span>
            {t('ideas')}
          </button>
        </div>
      </div>

      {/* المشاريع - القسم الأساسي */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <div className={`mb-3 rounded-3xl border p-3 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-100 bg-violet-50/70'}`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-black ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>📁 {t('projects')}</h3>
              <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{SB.projectsHub}</p>
            </div>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/20 transition hover:scale-105"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="relative">
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>🔎</span>
            <CaretSafeInput
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder={SB.searchProjects}
              className={`w-full rounded-2xl border py-2 pl-3 pr-8 text-xs font-bold outline-none transition ${
                darkMode ? 'border-gray-800 bg-gray-950/70 text-white placeholder-gray-600 focus:border-violet-500' : 'border-violet-100 bg-white text-gray-900 placeholder-gray-400 focus:border-violet-400'
              }`}
            />
          </div>
        </div>

        <div className="space-y-2">
          {/* مشروع افتراضي: بدون مشروع — يجمع الملاحظات والأفكار غير المصنّفة */}
          {showNoProjectTile && (
            <button
              onClick={() => setSelectedProject('__none__')}
              className={`relative flex w-full items-center gap-3 overflow-hidden rounded-3xl border px-3 py-3 text-sm transition ${
                selectedProject === '__none__'
                  ? darkMode ? 'border-gray-500/40 bg-gray-800 text-white shadow-lg' : 'border-gray-300 bg-white text-gray-900 shadow-md'
                  : darkMode ? 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700 hover:bg-gray-900 hover:text-gray-200' : 'border-gray-200 bg-white/80 text-gray-600 hover:border-gray-300 hover:bg-white hover:text-gray-900'
              }`}
            >
              <span className="absolute inset-y-0 right-0 w-1.5 bg-gray-400" />
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-400/15 text-lg text-gray-400">
                🗂️
              </span>
              <span className="min-w-0 flex-1 text-right">
                <span className="block truncate font-black">{t('noProject')}</span>
                <span className={`block truncate text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{noProjectCount} {SB.notesCount} • {noProjectPercent}% {SB.ofContent}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${selectedProject === '__none__' ? 'bg-gray-500 text-white' : darkMode ? 'bg-gray-950 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>{noProjectCount}</span>
            </button>
          )}

          {filteredProjects.length === 0 && (
            <div className={`rounded-2xl border p-4 text-center text-xs ${darkMode ? 'border-gray-800 bg-gray-900 text-gray-500' : 'border-gray-200 bg-white text-gray-400'}`}>
              {SB.noMatch}
            </div>
          )}
          {filteredProjects.map(project => {
            const count = getProjectCount(project.id);
            const percent = allNotesCount > 0 ? Math.min(100, Math.round((count / allNotesCount) * 100)) : 0;
            return (
            <div key={project.id} className="group relative">
              <button
                onClick={() => setSelectedProject(project.id)}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-3xl border py-3 pr-3 pl-12 text-sm transition ${
                  selectedProject === project.id
                    ? darkMode ? 'border-violet-500/40 bg-gray-800 text-white shadow-lg shadow-violet-500/10' : 'border-violet-200 bg-white text-gray-900 shadow-md'
                    : darkMode ? 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700 hover:bg-gray-900 hover:text-gray-200' : 'border-gray-200 bg-white/80 text-gray-600 hover:border-violet-100 hover:bg-white hover:text-gray-900'
                }`}
              >
                <span className="absolute inset-y-0 right-0 w-1.5" style={{ backgroundColor: project.color }} />
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-lg" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
                  📁
                </span>
                <span className="min-w-0 flex-1 text-right">
                  <span className="block truncate font-black">{project.name}</span>
                  <span className={`block truncate text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{count} {SB.notesCount} • {percent}% {SB.ofContent}</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${selectedProject === project.id ? 'bg-violet-500 text-white' : darkMode ? 'bg-gray-950 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>{count}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteProjectId(project.id);
                }}
                aria-label={SB.delProject}
                title={SB.delProject}
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl bg-red-500/10 text-red-500 opacity-100 transition hover:bg-red-500/20 active:scale-90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          );
          })}
        </div>

        {/* نموذج مشروع جديد */}
        {showNewProject && (
          <div className={`mt-3 rounded-2xl border p-3 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white shadow-lg'}`}>
            <CaretSafeInput
              type="text"
              placeholder={SB.projectName}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
              className={`mb-2 w-full rounded-xl px-3 py-2 text-sm outline-none ${
                darkMode 
                  ? 'bg-gray-800 text-white placeholder-gray-500' 
                  : 'bg-gray-100 text-gray-900 placeholder-gray-500'
              }`}
              autoFocus
            />
            <div className="mb-2 flex gap-1.5">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  className={`h-6 w-6 rounded-full transition-transform ${newProjectColor === color ? 'scale-125 ring-2 ring-offset-2 ring-violet-400' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewProject(false)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{SB.cancel}</button>
              <button onClick={handleAddProject} className="flex-1 rounded-xl bg-violet-500 px-3 py-2 text-xs font-bold text-white">{SB.add}</button>
            </div>
          </div>
        )}
      </div>

      {/* النظام والروابط */}
      <div className={`border-t p-4 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={`text-xs font-black ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{t('language')}</span>
          <LanguageSelector placement="mini" />
        </div>

        {/* ⚙️ زرّ واحد يفتح كل الإعدادات — ليبقى مكان المشاريع واضحاً */}
        <button
          onClick={() => { haptics.tap('light'); setShowSettings(true); }}
          className={`mb-3 flex w-full items-center justify-between rounded-2xl px-4 py-3 transition active:scale-95 ${
            darkMode ? 'bg-gray-900 text-gray-300 hover:bg-gray-800' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center gap-2 font-bold">
            <span>⚙️</span>
            {t('settings')}
          </span>
          <span className="flex items-center gap-2">
            {settingsAlert && (
              <span
                className={`h-2 w-2 rounded-full ${settingsAlert === 'error' ? 'bg-red-500' : 'bg-amber-500'}`}
                aria-hidden="true"
              />
            )}
            <span className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} aria-hidden="true">
              {direction === 'rtl' ? '‹' : '›'}
            </span>
          </span>
        </button>

        {/* ⚠️ حقل الملف يبقى هنا — خارج النافذة — عمداً.
            handleImportClick يستدعي fileInputRef.current?.click()، ولو كان
            الحقل داخل النافذة لصار وجوده مشروطاً بفتحها: أي استدعاء من أي
            مكان آخر لاحقاً يجد الـref فارغاً ويفشل بصمت. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFilePicked}
        />

        {/* ═══ نافذة الإعدادات ═══════════════════════════════════════
            ⚠️ عبر portal إلى document.body، وهذا شرط صحّة لا تنظيم:
            الشريط في الهاتف يسكن داخل <div class="animate-scale-in">،
            وتلك الحركة تنتهي بـ`forwards` فيبقى transform مطبَّقاً أبداً.
            وأي transform غير none يُنشئ containing block، فينقلب
            position:fixed من «بالنسبة للشاشة» إلى «بالنسبة للدرج» —
            فتُحبس النافذة داخل 86vw بدل أن تغطّي الشاشة. */}
        {showSettings && createPortal(
          <div
            className="modal-backdrop fixed inset-0 pb-banner z-[100] flex items-end justify-center p-3 sm:items-center"
            onClick={() => setShowSettings(false)}
            role="dialog"
            aria-modal="true"
            aria-label={t('settings')}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              dir={direction}
              className={`flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border animate-scale-in ${
                darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-100'
              }`}
            >
              <div className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
                darkMode ? 'border-gray-800' : 'border-gray-200'
              }`}>
                <span className={`flex items-center gap-2 text-sm font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <span>⚙️</span> {t('settings')}
                </span>
                <button
                  onClick={() => setShowSettings(false)}
                  aria-label={SB.cancel}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition ${
                    darkMode ? 'bg-gray-900 text-gray-400 hover:bg-gray-800' : 'bg-white text-gray-500 hover:bg-gray-200'
                  }`}
                >✕</button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">

                {/* اختيار الصوت — هنا لأنه الموضع الوحيد الذي يُبلَغ من
                    كل نافذة في التطبيق. والاختيار واحد مشترك، فتغييره
                    هنا يسري على كل أزرار الاستماع فوراً. */}
                <div className={`mb-3 flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 ${
                  darkMode ? 'bg-gray-900' : 'bg-white shadow-sm'
                }`}>
                  <span className="min-w-0">
                    <span className={`block text-[11px] font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      🎙️ صوت القارئ
                    </span>
                    <span className={`block truncate text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      يسري على كل نوافذ التطبيق
                    </span>
                  </span>
                  <VoicePicker variant="plain" darkMode={darkMode} />
                </div>


              <div className={`mb-2 rounded-2xl border p-2 ${darkMode ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div>
                    <div className={`text-[10px] font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>✨ {t('legalPages')}</div>
                  </div>
                  <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-black text-violet-500">LINKS</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <a href="/privacy" className={`rounded-xl px-1.5 py-1.5 text-center text-[10px] font-black transition ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🔒 {t('privacy')}</a>
                  <a href="/delete-data" className="rounded-xl bg-red-500/10 px-1.5 py-1.5 text-center text-[10px] font-black text-red-500 transition hover:bg-red-500/20">🧹 {t('deleteData')}</a>
                  <a href="/about" className={`rounded-xl px-1.5 py-1.5 text-center text-[10px] font-black transition ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>✨ {t('about')}</a>
                  <a href="/contact" className={`rounded-xl px-1.5 py-1.5 text-center text-[10px] font-black transition ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>💌 {t('contact')}</a>
                  <button onClick={() => { void showPrivacyOptions(); }} className={`col-span-2 rounded-xl px-1.5 py-1.5 text-center text-[10px] font-black transition ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>⚙️ {t('privacyOptions')}</button>
                  <button
                    onClick={() => openOver(() => setShowErrLog(true))}
                    className={`col-span-2 rounded-xl px-1.5 py-1.5 text-center text-[10px] font-black transition ${
                      getEntries().some(e => e.level === 'error')
                        ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                        : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >🩺 {SB.errLog ?? 'سجل الأخطاء'}{getEntries().length > 0 ? ` (${getEntries().length})` : ''}</button>
                </div>
                {/* علامة الإصدار — للتأكد أن التحديث وصل فعلاً للجهاز */}
                <button
                  onClick={() => {
                    const d = getAdDiagnostics();
                    setShowSettings(false); // نافذة التشخيص تُرسَم تحت الإعدادات وإلا
                    setAdDiag(
                      `جهاز حقيقي: ${d.native ? 'نعم ✅' : 'لا (متصفح) ❌'}\n` +
                      `وضع الاختبار: ${d.testing ? 'مُفعَّل (إعلانات تجريبية)' : 'مُطفأ (إعلانات حقيقية) ✅'}\n` +
                      `تهيئة AdMob: ${d.initialized ? 'نجحت ✅' : 'لم تكتمل ❌'}\n` +
                      (d.initTimedOut ? '⏱️ التهيئة تجاوزت المهلة — تابعنا بدونها\n' : '') +
                      (d.consentTimedOut ? '⏱️ الموافقة تجاوزت المهلة\n' : '') +
                      `مسموح بالإعلانات (GDPR): ${d.canRequestAds ? 'نعم ✅' : 'لا — رُفضت الموافقة ❌'}\n` +
                      `البانر معروض: ${d.bannerShown ? (d.bannerHidden ? 'محمَّل لكن مُخفى' : 'نعم ✅') : 'لا ❌'}\n` +
                      `ارتفاع البانر: ${d.bannerHeight}px\n` +
                      `محاولات إعادة التحميل: ${d.retries}\n` +
                      `إعلانات بينية اليوم: ${d.dailyShown}/${d.dailyMax}\n` +
                      `وحدة البانر: ${d.bannerUnit}\n` +
                      (d.trace ? `\n━━ سجل التتبّع ━━\n${d.trace}\n` : '') +
                      (d.bannerError ? `\n⚠️ خطأ تحميل البانر:\n${d.bannerError}` : '') +
                      (d.lastError ? `\n⚠️ آخر خطأ:\n${d.lastError}` : '') +
                      ((!d.bannerError && !d.lastError && !d.bannerShown)
                        ? '\nℹ️ لا يوجد خطأ — غالباً «لا يوجد إعلان متاح» (No Fill). الوحدات الجديدة تحتاج 24–48 ساعة.'
                        : '')
                    );
                  }}
                  onContextMenu={(e) => { e.preventDefault(); openOver(() => setShowErrLog(true)); }}
                  title="اضغط: حالة الإعلانات · ضغطة مطوّلة: سجل الأخطاء"
                  className={`mt-1.5 w-full text-center text-[9px] font-bold ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}
                >v1.9.22 · DIAG</button>

                {/* مؤشر سعة التخزين — أخضر/كهرماني/أحمر حسب الامتلاء */}
                <div className="mt-2">
                  <div className={`flex items-center justify-between text-[10px] font-bold ${
                    storage.ratio >= 0.9 ? 'text-red-500'
                    : storage.nearFull ? 'text-amber-500'
                    : darkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    <span>💾 {SB.storage ?? 'التخزين'}</span>
                    <span>{formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)}</span>
                  </div>
                  <div className={`mt-1 h-1.5 w-full overflow-hidden rounded-full ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        storage.ratio >= 0.9 ? 'bg-red-500'
                        : storage.nearFull ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(2, Math.min(100, Math.round(storage.ratio * 100)))}%` }}
                    />
                  </div>

                  {/* حالة النسخة الاحتياطية — نسخة لا يعرف بها المستخدم لا تطمئنه */}
                  <button
                    onClick={async () => {
                      if (backupBusy) return;
                      setBackupBusy(true);
                      haptics.tap('light');
                      await runAutoBackupIfDue(true);   // force: تجاهل فاصل الـ24 ساعة
                      setBackupAt(getLastBackupTime());
                      setBackupBusy(false);
                    }}
                    className={`mt-2 w-full rounded-xl px-2 py-1.5 text-start transition ${
                      darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold ${
                        !backupAt ? 'text-red-500'
                        : isBackupDurable() ? 'text-emerald-500'
                        : 'text-amber-500'
                      }`}>
                        {backupBusy ? '⏳' : !backupAt ? '🔴' : isBackupDurable() ? '🛡️' : '⚠️'} {SB.backup ?? 'نسخة احتياطية'}
                      </span>
                      <span className={`text-[9px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {backupBusy ? '…' : backupAt
                          ? backupAt.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
                          : (SB.backupNever ?? 'لم تُنشأ بعد')}
                      </span>
                    </div>
                    <div className={`mt-0.5 text-[9px] leading-tight ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {!backupAt
                        ? (SB.backupTapNow ?? 'اضغط لإنشاء نسخة الآن')
                        : isBackupDurable()
                        ? (SB.backupDurable ?? 'محفوظة في المستندات — تبقى بعد حذف التطبيق')
                        : (SB.backupFragile ?? 'داخل التطبيق فقط — تُمحى مع حذفه. صدّر نسخة يدوياً')}
                    </div>
                  </button>

                  {/* الاسترجاع — نصف الميزة الذي كان ناقصاً: النسخ كانت تُكتب
                      ولا تُقرأ أبداً، فكان المستخدم يملك ملفاتها ولا يستطيع
                      استعمالها بعد إعادة التثبيت. */}
                  <button
                    onClick={() => openOver(() => setShowRestore(true))}
                    className={`mt-1.5 w-full rounded-xl px-2 py-1.5 text-start text-[10px] font-bold transition ${
                      darkMode ? 'bg-gray-800 text-emerald-400 hover:bg-gray-700'
                               : 'bg-gray-100 text-emerald-600 hover:bg-gray-200'
                    }`}
                  >
                    🛟 {t('restoreOpen')}
                  </button>

                  {isSyncConfigured() && (
                    <button
                      onClick={() => openOver(() => setShowSync(true))}
                      className={`mt-1.5 w-full rounded-xl px-2 py-1.5 text-start text-[10px] font-bold transition ${
                        darkMode ? 'bg-gray-800 text-sky-400 hover:bg-gray-700'
                                 : 'bg-gray-100 text-sky-600 hover:bg-gray-200'
                      }`}
                    >
                      ☁️ {t('syncOpen')}
                    </button>
                  )}

                  {/* التنبيه الاستباقي — الرؤية تصل بلا فتح التطبيق */}
                  <button
                    onClick={() => {
                      haptics.tap('light');
                      const next = !proactiveOn;
                      setProactiveOn(next);
                      setProactiveNotifyEnabled(next);
                    }}
                    className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-start transition ${
                      darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-[10px] font-bold ${proactiveOn ? 'text-violet-400' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        💡 {t('proactiveNotify')}
                      </span>
                      <span className={`block truncate text-[9px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {proactiveOn ? t('proactiveNotifyOn') : t('proactiveNotifyOff')}
                      </span>
                    </span>
                    <span className={`h-4 w-8 shrink-0 rounded-full p-0.5 transition ${
                      proactiveOn ? 'bg-violet-500' : darkMode ? 'bg-gray-700' : 'bg-gray-300'
                    }`}>
                      <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                        proactiveOn ? 'translate-x-4 rtl:-translate-x-4' : ''
                      }`} />
                    </span>
                  </button>
                </div>
              </div>

              {/* تصدير / استيراد البيانات — ملكية كاملة للمستخدم */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  onClick={handleExport}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition active:scale-95 ${
                    darkMode ? 'bg-gray-900 text-violet-300 hover:bg-gray-800' : 'bg-white text-violet-700 shadow-sm hover:bg-violet-50'
                  }`}
                  aria-label={SB.exportLabel}
                  title={SB.exportTip}
                >
                  <span>⬇️</span> {SB.export}
                </button>
                <button
                  onClick={handleImportClick}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition active:scale-95 ${
                    darkMode ? 'bg-gray-900 text-pink-300 hover:bg-gray-800' : 'bg-white text-pink-700 shadow-sm hover:bg-pink-50'
                  }`}
                  aria-label={SB.importLabel}
                  title={SB.importTip}
                >
                  <span>⬆️</span> {SB.import}
                </button>
              </div>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`mb-3 flex w-full items-center justify-between rounded-2xl px-4 py-3 transition ${
                  darkMode ? 'bg-gray-900 text-gray-300 hover:bg-gray-800' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2 font-bold">
                  <span>{darkMode ? '☀️' : '🌙'}</span>
                  {darkMode ? t('lightMode') : t('darkMode')}
                </span>
                <span className={`h-5 w-9 rounded-full p-0.5 ${darkMode ? 'bg-violet-500' : 'bg-gray-300'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${darkMode ? 'translate-x-4' : ''}`} />
                </span>
              </button>

              </div>
            </div>
          </div>,
          document.body,
        )}
        {/* ═══ نهاية نافذة الإعدادات ═══════════════════════════════ */}

        {/* 🔵 الفقّاعة تبقى في الشريط بطلبٍ صريح — لا تُدفن في النافذة */}
        <button
          onClick={handleToggleBubble}
          className={`mb-3 flex w-full items-center justify-between rounded-2xl px-4 py-3 transition ${
            darkMode ? 'bg-gray-900 text-gray-300 hover:bg-gray-800' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
          }`}
        >
          <span className="flex flex-col items-start gap-0.5 text-start min-w-0">
            <span className="flex items-center gap-2 font-bold">
              <span>🔵</span>
              {SB.bubbleTitle}
            </span>
            <span className={`text-xs font-normal line-clamp-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {SB.bubbleDesc}
            </span>
          </span>
          <span className={`shrink-0 h-5 w-9 rounded-full p-0.5 ${bubbleOn ? 'bg-violet-500' : 'bg-gray-300'}`}>
            <span className={`block h-4 w-4 rounded-full bg-white transition ${bubbleOn ? 'translate-x-4' : ''}`} />
          </span>
        </button>

        <div className={`rounded-2xl px-3 py-2 text-center ${darkMode ? 'bg-gray-900/60' : 'bg-white/70'}`}>
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className="text-[10px]">🌟</span>
            <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-[10px] font-black tracking-widest text-transparent">NOTIC TAHIRO</span>
            <span className="text-[10px]">🌟</span>
          </div>
          <div className={`text-[9px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            {(() => {
              const lang = (typeof window !== 'undefined' && localStorage.getItem('notic-language')) || 'en';
              if (lang === 'ar') return 'صُنع بشغف في تطوان 🇲🇦';
              if (lang === 'es') return 'Hecho con pasión en Tetuán 🇲🇦';
              if (lang === 'zh') return '在得土安用心打造 🇲🇦';
              return 'Crafted with care in Tetouan 🇲🇦';
            })()}
          </div>
        </div>
      </div>

      {/* نافذة تأكيد حذف المشروع الفاخرة */}
      <ConfirmModal
        isOpen={!!deleteProjectId}
        onClose={() => setDeleteProjectId(null)}
        onConfirm={() => {
          if (deleteProjectId) deleteProject(deleteProjectId);
        }}
        title={SB.delTitle}
        message={SB.delMsg}
        variant="danger"
        confirmLabel={SB.delConfirm}
        cancelLabel={SB.delCancel}
      />

      {/* نافذة نتيجة الاستيراد */}
      <AlertModal
        isOpen={!!importResult}
        onClose={() => setImportResult(null)}
        title={importResult?.ok ? SB.importOk : SB.importFail}
        message={importResult?.message || ''}
        variant={importResult?.ok ? 'success' : 'warning'}
        icon={importResult?.ok ? '✅' : '⚠️'}
        buttonLabel={SB.ok}
      />

      <CloudSyncModal
        isOpen={showSync}
        onClose={() => setShowSync(false)}
        darkMode={darkMode}
      />

      <RestoreBackupModal
        isOpen={showRestore}
        onClose={() => setShowRestore(false)}
        darkMode={darkMode}
      />

      <ErrorLogModal
        isOpen={showErrLog}
        onClose={() => setShowErrLog(false)}
        darkMode={darkMode}
        appVersion="1.9.11"
      />

      {/* تشخيص AdMob — يُفتح بالضغط على علامة الإصدار */}
      <AlertModal
        isOpen={!!adDiag}
        onClose={() => setAdDiag(null)}
        title="حالة الإعلانات (AdMob)"
        message={adDiag || ''}
        variant="warning"
        icon="📊"
        buttonLabel={SB.ok}
      />

      {/* نافذة تنبيه إذن/توافق الفقعة العائمة */}
      <AlertModal
        isOpen={!!bubbleAlert}
        onClose={() => setBubbleAlert(null)}
        title={bubbleAlert?.title || ''}
        message={bubbleAlert?.message || ''}
        variant="warning"
        icon="🔵"
        buttonLabel={SB.ok}
      />

    </aside>
  );
}
