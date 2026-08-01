import React, { useState, useEffect, useCallback, useRef } from 'react';
import { aiSummarize, aiExtractTags, aiExtractTasks, aiSuggestTitle, aiSpellCheck, aiAskAboutNote, aiExpandIdea, aiTranslate } from '../utils/aiEngine';

// تحويل لغة التطبيق إلى رمز BCP-47 لتنسيق التواريخ والأرقام
function toLocale(lang: string | undefined): string {
  switch (lang) {
    case 'ar': return 'ar';
    case 'es': return 'es-ES';
    case 'zh': return 'zh-CN';
    case 'en':
    default:   return 'en-US';
  }
}

import * as haptics from '../utils/haptics';
import { useApp, Note } from '../context/AppContext';
import PromptModal, { ConfirmModal } from './PromptModal';
import VoiceRecorder from './VoiceRecorder';
import NoteLockModal, { LockMode } from './NoteLockModal';
import { generateSalt, encryptNoteContent, decryptNoteContent } from '../utils/noteLock';
import { saveAttachment, deleteAttachment, openAttachment, pickAndSaveAttachments, kindIcon, formatSize, type Attachment } from '../utils/attachments';
import LinkAutocomplete from './LinkAutocomplete';
import MarkdownView from './MarkdownView';
import { detectLinkContext, applyLinkCompletion, extractLinks, findNoteByTitle, getBacklinks } from '../utils/backlinks';
import { geminiTranscribeAudio } from '../utils/geminiService';
import { CaretSafeInput } from './CaretSafe';
import { PlainEditable, type PlainEditableHandle } from './PlainEditable';

import ListenButton from './ListenButton';
interface NoteEditorProps {
  noteId: string | null;
  isNewNote?: boolean;
  newNoteType?: 'note' | 'idea';
  onClose: () => void;
  /** يُستدعى عند النقر على إشارة مرتدّة لفتح ملاحظة أخرى */
  onOpenNote?: (noteId: string) => void;
  /** يُستدعى عند النقر على رابط شبح (ملاحظة غير موجودة) */
  onCreateGhost?: (title: string) => void;
}

export default function NoteEditor({ noteId, isNewNote = false, newNoteType = 'note', onClose, onOpenNote, onCreateGhost }: NoteEditorProps) {
  const { notes, projects, darkMode, updateNote, addNote, deleteNote, language, t } = useApp();

  const NE = {
    ar: { alarm24: 'تذكير مسبق - 24 ساعة', alarm1: 'تذكير - ساعة واحدة', alarmNow: 'الموعد الآن',
          untitled: 'بدون عنوان', taskPlan: (p: string) => `التخطيط لـ "${p}"`, project: 'المشروع',
          taskSetup: 'إعداد الهيكل الأساسي', taskImpl: 'التنفيذ والاختبار', taskReview: 'المراجعة النهائية',
          checklistHeading: '\n\n## ✅ قائمة المهام المولدة بـ Gemini\n', headingAr: '## 🌐 العربية', headingEn: '## 🌐 English',
          errNoUrl: '⚠️ لم يُضبط VITE_SUPABASE_URL في .env — راجع إعداد Supabase.',
          errRate: '⚠️ تجاوزت الحد المسموح من الطلبات (60/ساعة). حاول بعد قليل.',
          errConn: '⚠️ تعذّر الاتصال بـ Gemini — تأكد من الإنترنت وإعداد Supabase.',
          genTasks: 'توليد قائمة مهام تلقائية ✨', voice: 'تسجيل صوتي 🎙️', vrDeleteRecording: 'حذف التسجيل', vrWrongPin: '❌ رقم سري خاطئ، حاول مجدداً', lockAdd: 'حماية برقم سري', lockChange: 'تغيير الرقم السري', lockRemove: 'إزالة الحماية', rmLockTitle: 'إزالة الحماية برقم سري', rmLockMsg: 'سيُحفَظ محتوى الملاحظة بدون تشفير بعد الآن. هل تريد المتابعة؟', rmLockConfirm: '🔓 نعم، أزل الحماية', rmLockCancel: 'تراجع', unsavedTitle: 'تغييرات غير محفوظة', unsavedMsg: 'لديك تغييرات لم تُحفَظ. هل تريد حفظها قبل الخروج؟', unsavedSave: '💾 حفظ والخروج', unsavedDiscard: 'خروج بدون حفظ', unpin: 'إلغاء التثبيت', pin: 'تثبيت الملاحظة',
          pinned: 'مثبّت', pinShort: 'تثبيت', delNote: 'حذف الملاحظة', del: 'حذف', saveNote: 'حفظ الملاحظة',
          saving: 'يحفظ...', saved: 'محفوظ', save: 'حفظ', unsaved: '● تغييرات غير محفوظة', savedDone: 'تم الحفظ',
          noProject: 'بدون مشروع', alarmOn: 'منبه مفعّل', addAlarm: 'إضافة منبه', aiAssist: 'AI مساعد',
          date: 'التاريخ', time: 'الوقت', recurring: 'متكرر', daily: 'يومياً', weekly: 'أسبوعياً', monthly: 'شهرياً',
          editMode: 'وضع التحرير', previewMode: 'وضع المعاينة', noPreview: 'لا يوجد محتوى لمعاينته بعد...',
          linksTo: 'يربط إلى', openNote: 'فتح الملاحظة', createGhost: 'إنشاء ملاحظة جديدة بهذا الاسم',
          backlinks: 'مذكورة في', openLinked: 'فتح الملاحظة المرتبطة', chars: 'حرف',
          aiHelper: 'مساعد الذكاء الاصطناعي', summarize: 'تلخيص الملاحظة', summarizeDesc: 'اختصار المحتوى إلى نقاط رئيسية',
          suggestTags: 'اقتراح وسوم', suggestTagsDesc: 'تصنيف تلقائي للملاحظة', extractTasks: 'استخراج المهام', extractTasksDesc: 'تحويل النص إلى قائمة مهام',
          decompose: 'مفكك المهام الذكي', decomposeDesc: 'تفكيك المهمة الكبيرة لـ 5 مهام فرعية صغيرة',
          suggestTitle: 'اقترح عنواناً', suggestTitleDesc: 'عنوان ذكي يناسب المحتوى', spellCheck: 'تصحيح الإملاء', spellCheckDesc: 'تصحيح الأخطاء الإملائية والنحوية',
          expand: 'وسّع الفكرة', expandDesc: 'تحويل سطر قصير إلى ملاحظة كاملة منظمة', translate: 'ترجم للإنجليزية', translateDesc: 'تُضاف الترجمة أسفل الملاحظة الأصلية',
          askNote: 'اسأل عن الملاحظة', connErr: 'تعذّر الاتصال.', question: 'سؤال', processing: 'جاري المعالجة...',
          summaryLabel: '📝 الملخص', summaryHeading: '\n\n## ملخص AI\n', addToNote: '+ إضافة للملاحظة',
          spellLabel: '🔤 التصحيح الإملائي', applyFixes: '✓ تطبيق التصحيحات', noErrors: '✨ النص سليم — لا أخطاء إملائية.',
          tagsLabel: '🏷️ الوسوم المقترحة', tasksLabel: '✅ المهام المستخرجة', tasksHeading: '\n\n## المهام\n',
          delTitle: 'حذف الملاحظة', delMsg: 'هل أنت متأكد من حذف هذه الملاحظة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
          delConfirm: '🗑️ نعم، احذف', delCancel: 'تراجع' },
    en: { alarm24: 'Early reminder - 24 hours', alarm1: 'Reminder - one hour', alarmNow: 'Now',
          untitled: 'Untitled', taskPlan: (p: string) => `Plan for "${p}"`, project: 'the project',
          taskSetup: 'Set up the basic structure', taskImpl: 'Implementation and testing', taskReview: 'Final review',
          checklistHeading: '\n\n## ✅ Checklist generated by Gemini\n', headingAr: '## 🌐 العربية', headingEn: '## 🌐 English',
          errNoUrl: '⚠️ VITE_SUPABASE_URL is not set in .env — check your Supabase setup.',
          errRate: '⚠️ Rate limit exceeded (60/hour). Please try again shortly.',
          errConn: '⚠️ Could not connect to Gemini — check your internet and Supabase setup.',
          genTasks: 'Generate auto task list ✨', voice: 'Voice recording 🎙️', vrDeleteRecording: 'Delete recording', vrWrongPin: '❌ Incorrect PIN, try again', lockAdd: 'Protect with PIN', lockChange: 'Change PIN', lockRemove: 'Remove protection', rmLockTitle: 'Remove PIN protection', rmLockMsg: 'The note content will be saved unencrypted from now on. Continue?', rmLockConfirm: '🔓 Yes, remove', rmLockCancel: 'Cancel', unsavedTitle: 'Unsaved changes', unsavedMsg: 'You have unsaved changes. Save before leaving?', unsavedSave: '💾 Save & exit', unsavedDiscard: 'Exit without saving', unpin: 'Unpin', pin: 'Pin note',
          pinned: 'Pinned', pinShort: 'Pin', delNote: 'Delete note', del: 'Delete', saveNote: 'Save note',
          saving: 'Saving...', saved: 'Saved', save: 'Save', unsaved: '● Unsaved changes', savedDone: 'Saved',
          noProject: 'No project', alarmOn: 'Alarm on', addAlarm: 'Add alarm', aiAssist: 'AI assist',
          date: 'Date', time: 'Time', recurring: 'Recurring', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
          editMode: 'Edit mode', previewMode: 'Preview mode', noPreview: 'No content to preview yet...',
          linksTo: 'Links to', openNote: 'Open note', createGhost: 'Create a new note with this name',
          backlinks: 'Mentioned in', openLinked: 'Open linked note', chars: 'chars',
          aiHelper: 'AI assistant', summarize: 'Summarize note', summarizeDesc: 'Condense content into key points',
          suggestTags: 'Suggest tags', suggestTagsDesc: 'Auto-classify the note', extractTasks: 'Extract tasks', extractTasksDesc: 'Turn text into a task list',
          decompose: 'Smart task decomposer', decomposeDesc: 'Break a big task into 5 small subtasks',
          suggestTitle: 'Suggest a title', suggestTitleDesc: 'A smart title matching the content', spellCheck: 'Spell check', spellCheckDesc: 'Fix spelling and grammar errors',
          expand: 'Expand idea', expandDesc: 'Turn a short line into a full organized note', translate: 'Translate to English', translateDesc: 'Translation is added below the original note',
          askNote: 'Ask about the note', connErr: 'Connection failed.', question: 'Question', processing: 'Processing...',
          summaryLabel: '📝 Summary', summaryHeading: '\n\n## AI Summary\n', addToNote: '+ Add to note',
          spellLabel: '🔤 Spelling correction', applyFixes: '✓ Apply corrections', noErrors: '✨ Text is clean — no spelling errors.',
          tagsLabel: '🏷️ Suggested tags', tasksLabel: '✅ Extracted tasks', tasksHeading: '\n\n## Tasks\n',
          delTitle: 'Delete note', delMsg: 'Are you sure you want to delete this note permanently? This cannot be undone.',
          delConfirm: '🗑️ Yes, delete', delCancel: 'Undo' },
    es: { alarm24: 'Recordatorio anticipado - 24 horas', alarm1: 'Recordatorio - una hora', alarmNow: 'Ahora',
          untitled: 'Sin título', taskPlan: (p: string) => `Planificar "${p}"`, project: 'el proyecto',
          taskSetup: 'Configurar la estructura básica', taskImpl: 'Implementación y pruebas', taskReview: 'Revisión final',
          checklistHeading: '\n\n## ✅ Lista de tareas generada por Gemini\n', headingAr: '## 🌐 العربية', headingEn: '## 🌐 English',
          errNoUrl: '⚠️ VITE_SUPABASE_URL no está configurado en .env — revisa tu configuración de Supabase.',
          errRate: '⚠️ Límite de solicitudes superado (60/hora). Inténtalo en breve.',
          errConn: '⚠️ No se pudo conectar con Gemini — revisa tu internet y configuración de Supabase.',
          genTasks: 'Generar lista de tareas ✨', voice: 'Grabación de voz 🎙️', vrDeleteRecording: 'Eliminar grabación', vrWrongPin: '❌ PIN incorrecto, inténtalo de nuevo', lockAdd: 'Proteger con PIN', lockChange: 'Cambiar PIN', lockRemove: 'Quitar protección', rmLockTitle: 'Quitar protección PIN', rmLockMsg: 'El contenido se guardará sin cifrar a partir de ahora. ¿Continuar?', rmLockConfirm: '🔓 Sí, quitar', rmLockCancel: 'Cancelar', unsavedTitle: 'Cambios sin guardar', unsavedMsg: 'Tienes cambios sin guardar. ¿Guardar antes de salir?', unsavedSave: '💾 Guardar y salir', unsavedDiscard: 'Salir sin guardar', unpin: 'Quitar fijado', pin: 'Fijar nota',
          pinned: 'Fijada', pinShort: 'Fijar', delNote: 'Eliminar nota', del: 'Eliminar', saveNote: 'Guardar nota',
          saving: 'Guardando...', saved: 'Guardado', save: 'Guardar', unsaved: '● Cambios sin guardar', savedDone: 'Guardado',
          noProject: 'Sin proyecto', alarmOn: 'Alarma activada', addAlarm: 'Añadir alarma', aiAssist: 'IA',
          date: 'Fecha', time: 'Hora', recurring: 'Recurrente', daily: 'Diariamente', weekly: 'Semanalmente', monthly: 'Mensualmente',
          editMode: 'Modo edición', previewMode: 'Modo vista previa', noPreview: 'Aún no hay contenido para previsualizar...',
          linksTo: 'Enlaza a', openNote: 'Abrir nota', createGhost: 'Crear una nueva nota con este nombre',
          backlinks: 'Mencionada en', openLinked: 'Abrir nota vinculada', chars: 'caracteres',
          aiHelper: 'Asistente de IA', summarize: 'Resumir nota', summarizeDesc: 'Condensar el contenido en puntos clave',
          suggestTags: 'Sugerir etiquetas', suggestTagsDesc: 'Clasificar la nota automáticamente', extractTasks: 'Extraer tareas', extractTasksDesc: 'Convertir texto en lista de tareas',
          decompose: 'Descomponedor de tareas', decomposeDesc: 'Dividir una tarea grande en 5 subtareas',
          suggestTitle: 'Sugerir un título', suggestTitleDesc: 'Un título inteligente acorde al contenido', spellCheck: 'Corrección ortográfica', spellCheckDesc: 'Corregir errores de ortografía y gramática',
          expand: 'Ampliar idea', expandDesc: 'Convertir una línea corta en una nota organizada', translate: 'Traducir al inglés', translateDesc: 'La traducción se añade bajo la nota original',
          askNote: 'Preguntar sobre la nota', connErr: 'Error de conexión.', question: 'Pregunta', processing: 'Procesando...',
          summaryLabel: '📝 Resumen', summaryHeading: '\n\n## Resumen IA\n', addToNote: '+ Añadir a la nota',
          spellLabel: '🔤 Corrección ortográfica', applyFixes: '✓ Aplicar correcciones', noErrors: '✨ El texto está limpio — sin errores.',
          tagsLabel: '🏷️ Etiquetas sugeridas', tasksLabel: '✅ Tareas extraídas', tasksHeading: '\n\n## Tareas\n',
          delTitle: 'Eliminar nota', delMsg: '¿Seguro que quieres eliminar esta nota permanentemente? No se puede deshacer.',
          delConfirm: '🗑️ Sí, eliminar', delCancel: 'Deshacer' },
    zh: { alarm24: '提前提醒 - 24 小时', alarm1: '提醒 - 一小时', alarmNow: '现在',
          untitled: '无标题', taskPlan: (p: string) => `规划"${p}"`, project: '项目',
          taskSetup: '搭建基础结构', taskImpl: '实现与测试', taskReview: '最终审查',
          checklistHeading: '\n\n## ✅ 由 Gemini 生成的任务清单\n', headingAr: '## 🌐 العربية', headingEn: '## 🌐 English',
          errNoUrl: '⚠️ .env 中未设置 VITE_SUPABASE_URL — 请检查 Supabase 配置。',
          errRate: '⚠️ 已超出请求限制（60/小时）。请稍后再试。',
          errConn: '⚠️ 无法连接 Gemini — 请检查网络和 Supabase 配置。',
          genTasks: '自动生成任务清单 ✨', voice: '语音录制 🎙️', vrDeleteRecording: '删除录音', vrWrongPin: '❌ 密码错误，请重试', lockAdd: '用密码保护', lockChange: '更改密码', lockRemove: '移除保护', rmLockTitle: '移除密码保护', rmLockMsg: '此后笔记内容将以未加密方式保存。是否继续？', rmLockConfirm: '🔓 是，移除', rmLockCancel: '取消', unsavedTitle: '未保存的更改', unsavedMsg: '您有未保存的更改。退出前保存吗？', unsavedSave: '💾 保存并退出', unsavedDiscard: '不保存退出', unpin: '取消置顶', pin: '置顶笔记',
          pinned: '已置顶', pinShort: '置顶', delNote: '删除笔记', del: '删除', saveNote: '保存笔记',
          saving: '保存中...', saved: '已保存', save: '保存', unsaved: '● 未保存的更改', savedDone: '已保存',
          noProject: '无项目', alarmOn: '提醒已开启', addAlarm: '添加提醒', aiAssist: 'AI 助手',
          date: '日期', time: '时间', recurring: '重复', daily: '每天', weekly: '每周', monthly: '每月',
          editMode: '编辑模式', previewMode: '预览模式', noPreview: '尚无可预览的内容...',
          linksTo: '链接到', openNote: '打开笔记', createGhost: '以此名称创建新笔记',
          backlinks: '被提及于', openLinked: '打开关联笔记', chars: '字符',
          aiHelper: 'AI 助手', summarize: '总结笔记', summarizeDesc: '将内容浓缩为要点',
          suggestTags: '建议标签', suggestTagsDesc: '自动分类笔记', extractTasks: '提取任务', extractTasksDesc: '将文本转换为任务清单',
          decompose: '智能任务分解', decomposeDesc: '将大任务分解为 5 个小子任务',
          suggestTitle: '建议标题', suggestTitleDesc: '匹配内容的智能标题', spellCheck: '拼写检查', spellCheckDesc: '修正拼写和语法错误',
          expand: '扩展想法', expandDesc: '将简短的一行扩展为完整有条理的笔记', translate: '翻译为英文', translateDesc: '翻译将添加在原笔记下方',
          askNote: '询问笔记', connErr: '连接失败。', question: '问题', processing: '处理中...',
          summaryLabel: '📝 摘要', summaryHeading: '\n\n## AI 摘要\n', addToNote: '+ 添加到笔记',
          spellLabel: '🔤 拼写更正', applyFixes: '✓ 应用更正', noErrors: '✨ 文本无误 — 没有拼写错误。',
          tagsLabel: '🏷️ 建议的标签', tasksLabel: '✅ 提取的任务', tasksHeading: '\n\n## 任务\n',
          delTitle: '删除笔记', delMsg: '确定要永久删除此笔记吗？此操作无法撤销。',
          delConfirm: '🗑️ 是，删除', delCancel: '撤销' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? null;
  const E = NE ?? {
    alarm24: 'Early reminder - 24 hours', alarm1: 'Reminder - one hour', alarmNow: 'Now', untitled: 'Untitled',
    taskPlan: (p: string) => `Plan for "${p}"`, project: 'the project', taskSetup: 'Set up the basic structure',
    taskImpl: 'Implementation and testing', taskReview: 'Final review', checklistHeading: '\n\n## ✅ Checklist generated by Gemini\n',
    headingAr: '## 🌐 العربية', headingEn: '## 🌐 English',
    errNoUrl: '⚠️ VITE_SUPABASE_URL is not set in .env.', errRate: '⚠️ Rate limit exceeded (60/hour).', errConn: '⚠️ Could not connect to Gemini.',
    genTasks: 'Generate auto task list ✨', voice: 'Voice recording 🎙️', vrDeleteRecording: 'Delete recording', vrWrongPin: '❌ Incorrect PIN, try again', lockAdd: 'Protect with PIN', lockChange: 'Change PIN', lockRemove: 'Remove protection', rmLockTitle: 'Remove PIN protection', rmLockMsg: 'The note content will be saved unencrypted from now on. Continue?', rmLockConfirm: '🔓 Yes, remove', rmLockCancel: 'Cancel', unpin: 'Unpin', pin: 'Pin note', pinned: 'Pinned', pinShort: 'Pin',
    delNote: 'Delete note', del: 'Delete', saveNote: 'Save note', saving: 'Saving...', saved: 'Saved', save: 'Save',
    unsaved: '● Unsaved changes', savedDone: 'Saved', noProject: 'No project', alarmOn: 'Alarm on', addAlarm: 'Add alarm', aiAssist: 'AI assist',
    date: 'Date', time: 'Time', recurring: 'Recurring', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
    editMode: 'Edit mode', previewMode: 'Preview mode', noPreview: 'No content to preview yet...',
    linksTo: 'Links to', openNote: 'Open note', createGhost: 'Create a new note with this name', backlinks: 'Mentioned in', openLinked: 'Open linked note', chars: 'chars',
    aiHelper: 'AI assistant', summarize: 'Summarize note', summarizeDesc: 'Condense content into key points',
    suggestTags: 'Suggest tags', suggestTagsDesc: 'Auto-classify the note', extractTasks: 'Extract tasks', extractTasksDesc: 'Turn text into a task list',
    decompose: 'Smart task decomposer', decomposeDesc: 'Break a big task into 5 small subtasks',
    suggestTitle: 'Suggest a title', suggestTitleDesc: 'A smart title matching the content', spellCheck: 'Spell check', spellCheckDesc: 'Fix spelling and grammar errors',
    expand: 'Expand idea', expandDesc: 'Turn a short line into a full organized note', translate: 'Translate to English', translateDesc: 'Translation is added below the original note',
    askNote: 'Ask about the note', connErr: 'Connection failed.', question: 'Question', processing: 'Processing...',
    summaryLabel: '📝 Summary', summaryHeading: '\n\n## AI Summary\n', addToNote: '+ Add to note',
    spellLabel: '🔤 Spelling correction', applyFixes: '✓ Apply corrections', noErrors: '✨ Text is clean — no spelling errors.',
    tagsLabel: '🏷️ Suggested tags', tasksLabel: '✅ Extracted tasks', tasksHeading: '\n\n## Tasks\n',
    delTitle: 'Delete note', delMsg: 'Are you sure you want to delete this note permanently? This cannot be undone.',
    delConfirm: '🗑️ Yes, delete', delCancel: 'Undo' };
  
  const existingNote = noteId ? notes.find(n => n.id === noteId) : null;
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<'note' | 'idea'>('note');
  const [isPinned, setIsPinned] = useState(false);

  // مرجع الحقل النصيّ + حالة الإكمال التلقائي للروابط [[...]]
  const textareaRef = useRef<PlainEditableHandle | null>(null);
  const [linkCtx, setLinkCtx] = useState<{ query: string; openAt: number; anchorTop: number; anchorLeft: number } | null>(null);
  const [previewMode, setPreviewMode] = useState(false); // عرض Markdown مُصيَّر

  // ─── حماية العربية: لا تقرأ موضع المؤشر أثناء «تركيب الكلمة» ─────────
  // قراءة selectionStart من JS أثناء تركيب الكيبورد للكلمة (IME composition)
  // تقطع التركيب على بعض كيبورات أندرويد وترمي الحرف التالي لآخر النص —
  // وهو ما يصيب العربية تحديداً لأن كتابتها تركيبية دائماً. لذلك نؤجل أي
  // قراءة 250ms ونمنعها كلياً أثناء التركيب.
  const composingRef = useRef(false);
  const linkTimerRef = useRef<number | undefined>(undefined);
  const scheduleLinkAutocomplete = useCallback(() => {
    window.clearTimeout(linkTimerRef.current);
    linkTimerRef.current = window.setTimeout(() => {
      if (!composingRef.current) updateLinkAutocompleteRef.current();
    }, 250);
  }, []);
  const updateLinkAutocompleteRef = useRef<() => void>(() => {});

  // كشف ما إذا كان المؤشّر داخل [[...]] غير مكتمل، وحدّث نافذة الاقتراحات
  const updateLinkAutocomplete = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const ctx = detectLinkContext(el.value, caret); // اقرأ من الحقل مباشرة (الحالة قد تتأخر 200ms)
    if (!ctx) { setLinkCtx(null); return; }
    // احسب الموقع التقريبي للمؤشّر بالنسبة للنافذة
    const rect = el.getBoundingClientRect();
    // تقدير بسيط: ضع النافذة قرب أسفل الحقل (دقّة بكسلية ليست ضرورية)
    const anchorTop = Math.min(rect.bottom + 4, window.innerHeight - 280);
    const anchorLeft = Math.max(12, Math.min(rect.left + 12, window.innerWidth - 270));
    setLinkCtx({ query: ctx.query, openAt: ctx.openAt, anchorTop, anchorLeft });
  }, []);
  updateLinkAutocompleteRef.current = updateLinkAutocomplete;

  // أدرج اسم الملاحظة المختارة وأغلق النافذة
  const handleLinkSelect = (noteTitle: string) => {
    const el = textareaRef.current;
    if (!el || !linkCtx) return;
    const caret = el.selectionStart ?? 0;
    const result = applyLinkCompletion(el.value, caret, { openAt: linkCtx.openAt }, noteTitle);
    setContent(result.text);
    setLinkCtx(null);
    haptics.tap('light');
    // أعِد التركيز على الحقل في الموقع الجديد
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.caret, result.caret);
    });
  };
  
  // حالة المنبه
  const [hasAlarm, setHasAlarm] = useState(false);
  const [alarmDate, setAlarmDate] = useState('');
  const [alarmTime, setAlarmTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // حالة الذكاء الاصطناعي
  const [aiSummary, setAiSummary] = useState('');
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [extractedTasks, setExtractedTasks] = useState<{ task: string; done: boolean }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [spellResult, setSpellResult] = useState<{ corrected: string; changes: string[] } | null>(null);
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  
  // النوافذ المنبثقة الفاخرة
  const [showVoicePrompt, setShowVoicePrompt] = useState(false);

  // ── القفل برقم سري (تشفير حقيقي — انظر utils/noteLock.ts) ──────────
  const [isLocked, setIsLocked] = useState(false);
  const [lockMeta, setLockMeta] = useState<{ salt: string; iv: string } | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false); // ملاحظة مقفلة لم تُفتح بعد هذه الجلسة
  const [lockModalMode, setLockModalMode] = useState<LockMode | null>(null);
  const [lockError, setLockError] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [showRemoveLockConfirm, setShowRemoveLockConfirm] = useState(false);
  // الرقم السري يُحفَظ في الذاكرة فقط طوال فتح المحرر — لا يُخزَّن أبداً
  const pinRef = useRef<string | null>(null);
  const [voiceNotes, setVoiceNotes] = useState<NonNullable<Note['voiceNotes']>>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachMsg, setAttachMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [retryingVoiceId, setRetryingVoiceId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // حالة الحفظ البصرية
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  // مرجع لتجاهل أول تحميل — يمنع الحفظ التلقائي عند مجرد فتح الملاحظة
  const _isInitialLoad = React.useRef(true);
  // يتتبّع مُعرّف الملاحظة المحمّلة فعلياً — يمنع إعادة القفل عند مجرد
  // تحديث محتوى نفس الملاحظة (الحفظ التلقائي يُغيّر مرجع existingNote).
  const _loadedNoteId = React.useRef<string | null>(null);

  // ملاحظة سياسة AdMob: تمت إزالة الإعلان البيني عند الفتح لتجنّب تراكم
  // إعلانَين على نفس دورة فتح/إغلاق (يخالف "حدّ أقصى إعلان واحد كل إجراءين"
  // وتوصية Google الصريحة بعدم وضع إعلان عند كل إجراء يقوم به المستخدم).
  // الإعلان البيني الوحيد الآن هو عند الخروج من المحرر (انظر زر الإغلاق أسفل).

  // تحميل بيانات الملاحظة
  useEffect(() => {
    // إعادة تعيين المرجع عند تحميل ملاحظة — يمنع الحفظ غير الضروري أول مرة
    _isInitialLoad.current = true;
    if (existingNote) {
      setTitle(existingNote.title);
      setTags(existingNote.tags);
      setProjectId(existingNote.projectId);
      setNoteType(existingNote.type);
      setIsPinned(existingNote.isPinned);
      setVoiceNotes(existingNote.voiceNotes ?? []);
      setAttachments(existingNote.attachments ?? []);

      // ── ملاحظة مقفلة: لا نضع النص المُشفَّر في الواجهة أبداً —
      // نطلب الرقم السري فوراً، ونملأ content فقط بعد فك التشفير بنجاح.
      // لكن: إن كانت نفس الملاحظة محمّلة سابقاً (الحفظ التلقائي غيّر المرجع
      // فقط)، لا نُعيد القفل — المستخدم فتحها بالفعل في هذه الجلسة.
      const isSameNote = _loadedNoteId.current === existingNote.id;
      if (existingNote.isLocked && !isSameNote) {
        pinRef.current = null;
        setIsLocked(true);
        setLockMeta(existingNote.lock ?? null);
        setContent('');
        setNeedsUnlock(true);
        setLockModalMode('unlock');
        setLockError('');
      } else if (existingNote.isLocked && isSameNote) {
        // نفس الملاحظة المقفلة وقد فُتحت سابقاً — أبقِها مفتوحة، حدّث lockMeta فقط
        setIsLocked(true);
        setLockMeta(existingNote.lock ?? null);
        // لا نلمس content (يحتوي النص المفكوك) ولا needsUnlock
      } else {
        setIsLocked(false);
        setLockMeta(null);
        setNeedsUnlock(false);
        setContent(existingNote.content);
      }
      _loadedNoteId.current = existingNote.id;
      
      if (existingNote.alarm) {
        setHasAlarm(existingNote.alarm.hasAlarm);
        if (existingNote.alarm.alarmTime) {
          const dt = new Date(existingNote.alarm.alarmTime);
          setAlarmDate(dt.toISOString().split('T')[0]);
          setAlarmTime(dt.toTimeString().slice(0, 5));
        }
        setIsRecurring(existingNote.alarm.isRecurring);
        if (existingNote.alarm.recurrenceType) {
          setRecurrenceType(existingNote.alarm.recurrenceType);
        }
      }
      
      if (existingNote.aiData) {
        setAiSummary(existingNote.aiData.summary || '');
        setAiTags(existingNote.aiData.tags || []);
        setExtractedTasks(existingNote.aiData.extractedTasks || []);
      }
      // مسح نتائج AI الخاصة بالملاحظة السابقة
      setSpellResult(null);
      setAskQuestion('');
      setAskAnswer('');
    } else {
      setNoteType(newNoteType);
      // ملاحظة جديدة دائماً غير مقفلة في البداية
      pinRef.current = null;
      _loadedNoteId.current = null;
      setIsLocked(false);
      setLockMeta(null);
      setNeedsUnlock(false);
      // التقاط عنوان رابط شبح (إن وُجد) لتعبئة الحقل تلقائياً
      try {
        const ghost = sessionStorage.getItem('notic-ghost-title');
        if (ghost) {
          setTitle(ghost);
          sessionStorage.removeItem('notic-ghost-title');
        }
        // التقاط قالب جاهز (إن وُجد)
        const tplRaw = sessionStorage.getItem('notic-template');
        if (tplRaw) {
          const tpl = JSON.parse(tplRaw) as { content?: string; tags?: string[] };
          if (tpl.content) setContent(tpl.content);
          if (tpl.tags) setTags(tpl.tags);
          sessionStorage.removeItem('notic-template');
        }
        // ── إجراء "تذكير" من قائمة الفقعة العائمة ──
        // نُفعِّل المنبه تلقائياً بموعد افتراضي (بعد ساعة) — المستخدم
        // يُعدِّل التاريخ/الوقت بنفسه إن أراد قبل الحفظ.
        if (sessionStorage.getItem('notic-quick-reminder')) {
          sessionStorage.removeItem('notic-quick-reminder');
          const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
          setHasAlarm(true);
          setAlarmDate(inOneHour.toISOString().split('T')[0]);
          setAlarmTime(inOneHour.toTimeString().slice(0, 5));
        }

        // ── تدوين صوتي سريع من الفقعة → افتح المسجّل تلقائياً ──
        if (sessionStorage.getItem('notic-quick-voice')) {
          sessionStorage.removeItem('notic-quick-voice');
          setShowVoicePrompt(true);
        }

        // ── لصق المنسوخ من الفقعة → الصق محتوى الحافظة في المحتوى ──
        if (sessionStorage.getItem('notic-quick-paste')) {
          sessionStorage.removeItem('notic-quick-paste');
          void (async () => {
            try {
              const { Clipboard } = await import('@capacitor/clipboard');
              const { value } = await Clipboard.read();
              if (value?.trim()) {
                setContent(prev => prev ? prev + '\n' + value : value);
              }
            } catch { /* الحافظة فارغة أو غير متاحة */ }
          })();
        }
      } catch {}
    }
  }, [existingNote, newNoteType]);

  // الحفظ التلقائي مع المنبهات المتسلسلة الذكية
  // ── معرّف الملاحظة بعد أول حفظ (لمنع التكرار) ──────────────
  const savedNoteIdRef = React.useRef<string | null>(noteId);
  // حالة تفاعلية لإظهار زر الحذف بعد الحفظ الأول للملاحظة الجديدة
  const [noteIsPersisted, setNoteIsPersisted] = useState<boolean>(!!noteId);

  const saveNote = useCallback(async () => {
    if (!title.trim() && !content.trim()) return;
    // حماية: لا تحفظ ملاحظة "مقفلة" بدون رقم سري معروف في الذاكرة
    // (يحدث فقط إذا كانت لا تزال بانتظار فتح القفل)
    if (isLocked && !pinRef.current) return;

    setSaveStatus('saving');
    
    let alarmData = undefined;
    
    if (hasAlarm && alarmDate && alarmTime) {
      const mainAlarmTime = new Date(`${alarmDate}T${alarmTime}`);
      
      const isImportantEvent = content.toLowerCase().includes('اجتماع') || 
                               content.toLowerCase().includes('موعد') ||
                               content.toLowerCase().includes('هام') ||
                               content.toLowerCase().includes('ضروري') ||
                               title.toLowerCase().includes('اجتماع');
      
      alarmData = {
        hasAlarm: true,
        alarmTime: mainAlarmTime.toISOString(),
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : undefined,
        chainedAlarms: isImportantEvent ? [
          {
            time: new Date(mainAlarmTime.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            label: E.alarm24
          },
          {
            time: new Date(mainAlarmTime.getTime() - 60 * 60 * 1000).toISOString(),
            label: E.alarm1
          },
          {
            time: mainAlarmTime.toISOString(),
            label: E.alarmNow
          }
        ] : undefined
      };
    }
    
    // ── تشفير المحتوى إن كانت الملاحظة مقفلة (انظر utils/noteLock.ts) ──
    let finalContent = content;
    let lockData: Note['lock'] | undefined = undefined;
    if (isLocked && pinRef.current) {
      try {
        const salt = lockMeta?.salt ?? generateSalt();
        const { cipher, iv } = await encryptNoteContent(content, pinRef.current, salt);
        finalContent = cipher;
        lockData = { salt, iv };
        if (!lockMeta) setLockMeta(lockData); // أول تفعيل للقفل: نتذكّر الـ salt
      } catch (e) {
        console.error('[NoteEditor] encryption failed:', e);
        setSaveStatus('idle');
        return; // لا تحفظ نصاً صريحاً عند فشل التشفير لأي سبب
      }
    }

    const noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim() || E.untitled,
      content: finalContent,
      type: noteType,
      projectId,
      tags,
      isPinned,
      alarm: alarmData,
      aiData: aiSummary || aiTags.length > 0 || extractedTasks.length > 0 ? {
        summary: aiSummary || undefined,
        tags: aiTags.length > 0 ? aiTags : undefined,
        extractedTasks: extractedTasks.length > 0 ? extractedTasks : undefined
      } : undefined,
      voiceNotes: voiceNotes.length > 0 ? voiceNotes : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      isLocked,
      lock: lockData,
    };

    // ── منع التكرار: إذا سبق الحفظ استخدم updateNote دائماً ──
    if (savedNoteIdRef.current) {
      updateNote(savedNoteIdRef.current, noteData);
    } else {
      const newId = addNote(noteData);
      // احفظ الـ ID لمنع إنشاء ملاحظة جديدة في الحفظ التالي
      if (newId) { savedNoteIdRef.current = newId; setNoteIsPersisted(true); }
    }

    setIsDirty(false);
    haptics.success();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [title, content, noteType, projectId, tags, isPinned, hasAlarm, alarmDate, alarmTime, isRecurring, recurrenceType, aiSummary, aiTags, extractedTasks, voiceNotes, attachments, updateNote, addNote, isLocked, lockMeta]);

  // ── معالجة نافذة القفل برقم سري (إعداد / فتح / تغيير) ───────────────
  // ── إعادة محاولة تحويل تسجيل صوتي معلَّق يدوياً (زر داخل الشريحة) ──
  // مكمِّل لآلية الخلفية التلقائية في AppContext (تعمل عند رجوع
  // 'online' لكل التطبيق) — هذا للمحاولة الفورية أثناء فتح الملاحظة.
  const retrySingleVoiceNote = useCallback(async (vn: NonNullable<Note['voiceNotes']>[number]) => {
    if (!vn.path || retryingVoiceId) return;
    setRetryingVoiceId(vn.id);
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const fileResult = await Filesystem.readFile({ path: vn.path, directory: Directory.Data });
      const base64 = typeof fileResult.data === 'string' ? fileResult.data : '';
      if (!base64) return;
      const text = await geminiTranscribeAudio(base64, vn.mimeType);
      if (text.trim()) {
        setContent(prev => `${prev}\n\n## 🎙️ ${E.voice}\n\n${text.trim()}\n\n> 🤖 ${E.vrAutoNote}`);
        setVoiceNotes(prev => prev.map(v => v.id === vn.id ? { ...v, pendingTranscription: false } : v));
      }
      // فشل ودّي (نص فارغ أو خطأ): تبقى العلامة pendingTranscription=true
      // وتُحاوَل تلقائياً مرة أخرى عند 'online' التالي من AppContext.
    } catch (e) {
      console.warn('[NoteEditor] manual voice retry failed:', e);
    } finally {
      setRetryingVoiceId(null);
    }
  }, [retryingVoiceId, E]);

  // ─── رفع مرفقات (صور، فيديو، PDF، أي ملف) ───────────────────────────
  // على الجوال نستخدم المنتقي الأصلي (موثوق)، وعلى الويب <input type=file>.
  const handleAttachClick = async () => {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      setUploadingFile(true);
      try {
        const newAtts = await pickAndSaveAttachments();
        if (newAtts && newAtts.length > 0) {
          setAttachments(prev => [...prev, ...newAtts]);
          haptics.tap('light');
        }
      } finally {
        setUploadingFile(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    try {
      const newAtts: Attachment[] = [];
      for (const file of Array.from(files)) {
        try {
          const att = await saveAttachment(file);
          newAtts.push(att);
        } catch (err) {
          console.warn('[NoteEditor] attachment save failed:', err);
        }
      }
      if (newAtts.length > 0) {
        setAttachments(prev => [...prev, ...newAtts]);
        haptics.tap('light');
      }
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = async (att: Attachment) => {
    await deleteAttachment(att);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    haptics.tap('light');
  };

  // فتح/تنزيل مرفق مع تنبيه واضح للمستخدم (بدل الصمت عند الفشل)
  const handleOpenAttachment = async (att: Attachment) => {
    setAttachMsg({ text: '⏳ جاري تحضير الملف…', type: 'info' });
    try {
      const res = await openAttachment(att);
      if (res.ok) {
        setAttachMsg({
          text: res.savedToDocuments
            ? '✅ تم الحفظ في مجلد المستندات — افتحه من مدير الملفات'
            : '✅ اختر «حفظ في الملفات» أو تطبيقاً من القائمة',
          type: 'success',
        });
      } else {
        setAttachMsg({ text: '❌ تعذّر فتح الملف، حاول مرة أخرى', type: 'error' });
      }
    } catch {
      setAttachMsg({ text: '❌ تعذّر فتح الملف، حاول مرة أخرى', type: 'error' });
    }
    haptics.tap('light');
    setTimeout(() => setAttachMsg(null), 3500);
  };

  const handleLockSubmit = useCallback(async (pin: string, newPin?: string) => {
    setLockError('');
    setLockBusy(true);
    try {
      if (lockModalMode === 'unlock') {
        if (!existingNote || !lockMeta) { setLockBusy(false); return; }
        try {
          const plain = await decryptNoteContent(existingNote.content, lockMeta.iv, pin, lockMeta.salt);
          pinRef.current = pin;
          setContent(plain);
          setNeedsUnlock(false);
          setLockModalMode(null);
        } catch {
          setLockError(E.vrWrongPin ?? '❌');
        }
      } else if (lockModalMode === 'setup') {
        // لا تشفير فوري هنا — يحدث تلقائياً عند الحفظ التالي (saveNote)
        pinRef.current = pin;
        setIsLocked(true);
        setLockModalMode(null);
      } else if (lockModalMode === 'change') {
        if (pin !== pinRef.current) {
          setLockError(E.vrWrongPin ?? '❌');
        } else {
          pinRef.current = newPin ?? pin;
          setLockModalMode(null);
          void saveNote(); // إعادة التشفير فوراً بالرقم الجديد
        }
      }
    } finally {
      setLockBusy(false);
    }
  }, [lockModalMode, existingNote, lockMeta, saveNote, E]);

  // إلغاء نافذة القفل: إن كانت "فتح" بلا بديل، أغلق المحرّر كاملاً
  const handleLockModalClose = useCallback(() => {
    if (lockModalMode === 'unlock' && needsUnlock) {
      setLockModalMode(null);
      onClose();
    } else {
      setLockModalMode(null);
      setLockError('');
    }
  }, [lockModalMode, needsUnlock, onClose]);

  // تتبع التغييرات — لمؤشر "تغييرات غير محفوظة" فقط
  // نتجاهل أول إطلاق (عند تحميل الملاحظة الموجودة) لتفادي الحفظ التلقائي غير الضروري
  useEffect(() => {
    if (_isInitialLoad.current) {
      _isInitialLoad.current = false;
      return;
    }
    setIsDirty(true);
    setSaveStatus('idle');
  }, [title, content, tags, projectId, isPinned, voiceNotes, isLocked]);

  // ─── الحفظ يدوي فقط ───────────────────────────────────────────
  // أُلغي الحفظ التلقائي بناءً على طلب المستخدم — تُحفظ الملاحظة فقط
  // عند الضغط على زر "حفظ". مؤشّر isDirty يُعلِم المستخدم بوجود تغييرات
  // غير محفوظة (انظر الـ effect أعلاه).

  // ملاحظة: الإعلان البيني عند الخروج صار يُدار مركزياً في App.tsx
  // (كاشف انتقالات النوافذ)، فيغطّي المحرّر وكل النوافذ الأخرى بسياسة
  // تكرار موحّدة. أُبقيت هذه الدالة فارغة لتفادي ازدواج عرض الإعلان.
  const fireExitInterstitial = useCallback(() => { /* يُدار مركزياً */ }, []);

  // الخروج من المحرّر: إن وُجدت تغييرات غير محفوظة، اسأل المستخدم أولاً
  const handleCloseEditor = useCallback(() => {
    if (isDirty && (title.trim() || content.trim())) {
      setShowUnsavedConfirm(true); // اعرض نافذة التأكيد بدل الحفظ الصامت
      return;
    }
    onClose();
    fireExitInterstitial();
  }, [isDirty, title, content, onClose, fireExitInterstitial]);

  // معالجة الذكاء الاصطناعي باستخدام Gemini API عبر Supabase
  const handleAiProcess = async (action: 'summarize' | 'tags' | 'tasks' | 'decompose' | 'checklist' | 'suggest-title' | 'spell-check' | 'expand' | 'translate-en') => {
    if (!content.trim() && action !== 'checklist') return;
    if (action === 'checklist' && !title.trim() && !content.trim()) return;

    setIsAiLoading(true);
    try {
      if (action === 'summarize') {
        const summary = await aiSummarize(title, content);
        setAiSummary(summary);
      } else if (action === 'tags') {
        const newTags = await aiExtractTags(title, content);
        setAiTags(newTags);
      } else if (action === 'tasks' || action === 'decompose') {
        const tasks = await aiExtractTasks(title, content);
        setExtractedTasks(tasks.length > 0 ? tasks : [
          { task: E.taskPlan(title || E.project), done: false },
          { task: E.taskSetup, done: false },
          { task: E.taskImpl, done: false },
          { task: E.taskReview, done: false },
        ]);
      } else if (action === 'checklist') {
        const tasks = await aiExtractTasks(title, content);
        if (tasks.length > 0) {
          setExtractedTasks(tasks);
          const checklistMarkdown = E.checklistHeading +
            tasks.map(t => `- [ ] ${t.task}`).join('\n');
          setContent(prev => prev + checklistMarkdown);
        }
      } else if (action === 'suggest-title') {
        const suggested = await aiSuggestTitle(content);
        if (suggested) setTitle(suggested);
      } else if (action === 'spell-check') {
        const result = await aiSpellCheck(content);
        setSpellResult(result);
      } else if (action === 'expand') {
        const expanded = await aiExpandIdea(content.trim() || title);
        if (expanded) setContent(prev => (prev.trim() ? prev + '\n\n' : '') + expanded);
      } else if (action === 'translate-en') {
        // ترجمة ذكية: إن كانت لغة التطبيق إنجليزية نترجم للعربية، وإلا فللإنجليزية
        const target = language === 'en' ? 'ar' : 'en';
        const heading = target === 'ar' ? E.headingAr : E.headingEn;
        const translated = await aiTranslate(content, target);
        if (translated) setContent(prev => prev + '\n\n---\n\n' + heading + '\n\n' + translated);
      }
      setShowAiPanel(true);
    } catch (err) {
      console.error('[NoteEditor] AI process failed:', err);
      // إشعار المستخدم بالخطأ بدلاً من الفشل الصامت
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('VITE_SUPABASE_URL')) {
        setAiSummary(E.errNoUrl);
      } else if (errMsg.includes('Rate limit') || errMsg.includes('QUOTA_EXCEEDED')) {
        setAiSummary(E.errRate);
      } else {
        setAiSummary(E.errConn);
      }
      setShowAiPanel(true);
    } finally {
      setIsAiLoading(false);
    }
  };


  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const toggleTask = (index: number) => {
    const newTasks = [...extractedTasks];
    newTasks[index].done = !newTasks[index].done;
    setExtractedTasks(newTasks);
  };

  return (
    <div className={`flex-1 flex flex-col h-full ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* شريط الأدوات العلوي */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        darkMode ? 'border-gray-800' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCloseEditor}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {noteType === 'idea' ? t('typeNewIdea') : t('typeNote')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* العصا السحرية */}
          <button aria-label={E.genTasks}
            onClick={() => handleAiProcess('checklist')}
            disabled={isAiLoading}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-amber-900/30 text-amber-400 hover:text-amber-300' 
                : 'hover:bg-amber-100 text-amber-600 hover:text-amber-700'
            } disabled:opacity-50`}
            title={E.genTasks}
          >
            <span className="text-lg">🪄</span>
          </button>

          {/* التسجيل الصوتي */}
          <button aria-label={E.voice}
            onClick={() => setShowVoicePrompt(true)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-red-900/30 text-red-400 hover:text-red-300' 
                : 'hover:bg-red-100 text-red-600 hover:text-red-700'
            }`}
            title={E.voice}
          >
            <span className="text-lg">🎙️</span>
          </button>

          {/* ── القفل برقم سري ── */}
          {!isLocked ? (
            <button aria-label={E.lockAdd}
              onClick={() => { setLockError(''); setLockModalMode('setup'); }}
              className={`p-2 rounded-lg transition-colors ${
                darkMode
                  ? 'hover:bg-purple-900/30 text-gray-400 hover:text-purple-300'
                  : 'hover:bg-purple-100 text-gray-500 hover:text-purple-600'
              }`}
              title={E.lockAdd}
            >
              <span className="text-lg">🔓</span>
            </button>
          ) : !needsUnlock && (
            <>
              <button aria-label={E.lockChange}
                onClick={() => { setLockError(''); setLockModalMode('change'); }}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode
                    ? 'hover:bg-purple-900/30 text-purple-400 hover:text-purple-300'
                    : 'hover:bg-purple-100 text-purple-600 hover:text-purple-700'
                }`}
                title={E.lockChange}
              >
                <span className="text-lg">🔁</span>
              </button>
              <button aria-label={E.lockRemove}
                onClick={() => setShowRemoveLockConfirm(true)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode
                    ? 'hover:bg-red-900/30 text-purple-400 hover:text-red-300'
                    : 'hover:bg-red-100 text-purple-600 hover:text-red-700'
                }`}
                title={E.lockRemove}
              >
                <span className="text-lg">🔒</span>
              </button>
            </>
          )}

          {/* ── زر التثبيت المحسّن ── */}
          <button aria-label={isPinned ? E.unpin : E.pin}
            onClick={() => { setIsPinned(!isPinned); }}
            title={isPinned ? E.unpin : E.pin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
              transition-all duration-200 active:scale-95
              ${isPinned
                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-700'
                : darkMode
                  ? 'bg-gray-800 text-gray-400 hover:bg-violet-900/30 hover:text-violet-400'
                  : 'bg-gray-100 text-gray-500 hover:bg-violet-100 hover:text-violet-600'
              }`}
          >
            <svg className="w-4 h-4 transition-transform duration-300"
              style={{ transform: isPinned ? 'rotate(-15deg)' : 'rotate(0deg)' }}
              fill={isPinned ? 'currentColor' : 'none'}
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="hidden sm:inline text-xs">
              {isPinned ? E.pinned : E.pinShort}
            </span>
          </button>

          {/* ── زر الحذف ── */}
          {noteIsPersisted && (
            <button aria-label={E.delNote}
              onClick={() => setShowDeleteConfirm(true)}
              title={E.delNote}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                transition-all duration-200 active:scale-95
                ${darkMode
                  ? 'bg-gray-800 text-gray-400 hover:bg-red-900/40 hover:text-red-400'
                  : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
                }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline text-xs">{E.del}</span>
            </button>
          )}

          {/* ── زر الحفظ اليدوي ── */}
          <button aria-label={E.saveNote}
            onClick={saveNote}
            disabled={saveStatus === 'saving'}
            title={E.saveNote}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
              transition-all duration-200 active:scale-95 min-w-[80px] justify-center
              ${saveStatus === 'saved'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : saveStatus === 'saving'
                  ? darkMode
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-gray-200 text-gray-400 cursor-wait'
                  : darkMode
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-900/40'
                    : 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/30'
              }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-xs">{E.saving}</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                <span className="text-xs">{E.saved}</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                <span className="text-xs">{E.save}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* المحرر الرئيسي */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
          {/* حقل العنوان */}
          <div className="px-6 pt-6">
            <CaretSafeInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('noteTitlePlaceholder')}
              autoFocus={!existingNote}
              aria-label={t('noteTitlePlaceholder')}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              className={`w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:${
                darkMode ? 'text-gray-600' : 'text-gray-300'
              } ${darkMode ? 'text-white' : 'text-gray-900'}`}
            />
            {/* مؤشر الحفظ التلقائي الصغير */}
            <div className={`flex items-center gap-1.5 mt-1 h-4 transition-opacity duration-300
              ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
              {saveStatus === 'saving' && (
                <>
                  <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-xs text-gray-400">{E.unsaved}</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="text-xs text-emerald-500">{E.savedDone}</span>
                </>
              )}
            </div>
          </div>

          {/* معلومات الملاحظة */}
          <div className="px-6 py-3 flex flex-wrap items-center gap-3">
            {/* اختيار المشروع */}
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                darkMode 
                  ? 'bg-gray-800 text-gray-300 border-gray-700' 
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              } border`}
            >
              <option value="">{E.noProject}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* نوع الملاحظة */}
            <button
              onClick={() => setNoteType(noteType === 'note' ? 'idea' : 'note')}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                noteType === 'idea'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {noteType === 'idea' ? t('typeIdea') : t('typeNote')}
            </button>

            {/* زر المنبه */}
            <button
              onClick={() => setHasAlarm(!hasAlarm)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                hasAlarm
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {hasAlarm ? E.alarmOn : E.addAlarm}
            </button>

            {/* زر الذكاء الاصطناعي */}
            <div className="relative">
              <button
                onClick={() => setShowAiPanel(!showAiPanel)}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                  showAiPanel
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <span>✨</span>
                {E.aiAssist}
              </button>
            </div>
          </div>

          {/* نموذج المنبه */}
          {hasAlarm && (
            <div className={`mx-6 mb-4 p-4 rounded-xl border ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div>
                  <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{E.date}</label>
                  <input
                    type="date"
                    value={alarmDate}
                    onChange={(e) => setAlarmDate(e.target.value)}
                    className={`block w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                    } border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{E.time}</label>
                  <input
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    className={`block w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                    } border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-500"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {E.recurring}
                  </span>
                </label>
                
                {isRecurring && (
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                    } border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  >
                    <option value="daily">{E.daily}</option>
                    <option value="weekly">{E.weekly}</option>
                    <option value="monthly">{E.monthly}</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {/* محتوى الملاحظة — تحرير أو معاينة Markdown */}
          <div className="flex-1 px-6 pb-2">
            <div className="mb-2 flex items-center justify-end">
              <div className={`inline-flex rounded-xl p-0.5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                {/* استماع لمحتوى الملاحظة بصوت حماسي */}
                <ListenButton size="sm" style="energetic" darkMode={darkMode}
                  label="استمع للملاحظة" text={() => `${title}. ${content}`} />
                <button
                  onClick={() => setPreviewMode(false)}
                  aria-label={E.editMode}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition ${
                    !previewMode
                      ? darkMode ? 'bg-gray-900 text-violet-300 shadow' : 'bg-white text-violet-600 shadow'
                      : darkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}
                >
                  <span>✏️</span> <span>{language === 'ar' ? 'تحرير' : language === 'es' ? 'Editar' : language === 'zh' ? '编辑' : 'Edit'}</span>
                </button>
                <button
                  onClick={() => { setPreviewMode(true); setLinkCtx(null); }}
                  aria-label={E.previewMode}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition ${
                    previewMode
                      ? darkMode ? 'bg-gray-900 text-emerald-300 shadow' : 'bg-white text-emerald-600 shadow'
                      : darkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}
                >
                  <span>👁</span> <span>{language === 'ar' ? 'معاينة' : language === 'es' ? 'Vista' : language === 'zh' ? '预览' : 'Preview'}</span>
                </button>
              </div>
            </div>
            {previewMode ? (
              <div
                className={`min-h-[400px] rounded-2xl border px-4 py-3 ${
                  darkMode ? 'border-gray-800 bg-gray-900/30' : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                {content.trim() ? (
                  <MarkdownView
                    source={content}
                    notes={notes}
                    darkMode={darkMode}
                    onTaskToggle={(newSource) => setContent(newSource)}
                    onOpenLink={(noteId, title) => {
                      if (noteId && onOpenNote) onOpenNote(noteId);
                      else if (!noteId && onCreateGhost) onCreateGhost(title);
                    }}
                  />
                ) : (
                  <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {language === 'ar' ? 'لا يوجد محتوى لمعاينته بعد...' : language === 'es' ? 'No hay contenido para previsualizar todavía...' : language === 'zh' ? '暂无内容可预览...' : 'Nothing to preview yet...'}
                  </p>
                )}
              </div>
            ) : (
              <PlainEditable
                ref={textareaRef}
                value={content}
                onChangeText={(text) => { setContent(text); scheduleLinkAutocomplete(); }}
                onKeyUp={scheduleLinkAutocomplete}
                onClick={scheduleLinkAutocomplete}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                onBlur={() => setTimeout(() => setLinkCtx(null), 150)}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                placeholder={t('contentPlaceholder')}
                aria-label={t('contentPlaceholder')}
                className={`w-full min-h-[400px] bg-transparent border-none outline-none text-lg leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}
              />
            )}
          </div>

          {/* إحصاء فوري — كلمات / حروف / زمن قراءة */}
          {(() => {
            const trimmed = content.trim();
            const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
            const chars = content.length;
            const minutes = Math.max(1, Math.ceil(words / 200));
            if (words === 0) return null;
            return (
              <div className={`px-6 pb-3 text-[11px] font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <span dir="ltr" className="inline-flex items-center gap-3">
                  <span>📝 {words.toLocaleString(toLocale(language))} {t('words')}</span>
                  <span>•</span>
                  <span>{chars.toLocaleString(toLocale(language))} {t('characters')}</span>
                  <span>•</span>
                  <span>⏱ {minutes} {t('minutesToRead')}</span>
                </span>
              </div>
            );
          })()}

          {/* لوحة الروابط — الصادرة والمرتدّة */}
          {(() => {
            const outgoing = extractLinks(content);
            const targetNote = existingNote;
            const backlinks = targetNote ? getBacklinks(notes, targetNote) : [];
            if (outgoing.length === 0 && backlinks.length === 0) return null;
            return (
              <div className={`mx-6 mb-3 rounded-2xl border p-3 ${darkMode ? 'border-gray-800 bg-gray-900/40' : 'border-gray-100 bg-violet-50/40'}`}>
                {outgoing.length > 0 && (
                  <div className="mb-2">
                    <div className={`mb-1.5 text-[10px] font-black uppercase tracking-wider ${darkMode ? 'text-violet-300' : 'text-violet-600'}`}>
                      🔗 {E.linksTo} ({outgoing.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {outgoing.map(name => {
                        const target = findNoteByTitle(notes, name);
                        return (
                          <button
                            key={name}
                            onClick={() => {
                              haptics.tap('light');
                              if (target && onOpenNote) onOpenNote(target.id);
                              else if (!target && onCreateGhost) onCreateGhost(name);
                            }}
                            title={target ? E.openNote : E.createGhost}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition active:scale-95 ${
                              target
                                ? darkMode ? 'bg-violet-600/30 text-violet-200 hover:bg-violet-600/50' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                : darkMode ? 'border border-dashed border-gray-700 bg-transparent text-gray-500 hover:text-gray-300' : 'border border-dashed border-gray-300 bg-transparent text-gray-400 hover:text-gray-700'
                            }`}
                          >
                            <span>{target ? '📝' : '✨'}</span>
                            <span>{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {backlinks.length > 0 && (
                  <div>
                    <div className={`mb-1.5 text-[10px] font-black uppercase tracking-wider ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>
                      ↩ {E.backlinks} ({backlinks.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {backlinks.map(n => (
                        <button
                          key={n.id}
                          onClick={() => { haptics.tap('light'); onOpenNote?.(n.id); }}
                          title={E.openLinked}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition active:scale-95 ${
                            darkMode ? 'bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/40' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          }`}
                        >
                          <span>📌</span>
                          <span className="max-w-[160px] truncate">{n.title || E.untitled}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* شريط التنسيق السفلي */}
          <div className={`px-6 py-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              {/* حقل الوسوم */}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                {tags.map((tag, idx) => (
                  <span 
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                      darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <CaretSafeInput
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder={t('addTagPlaceholder')}
                  className={`px-2 py-1 text-xs bg-transparent border-none outline-none ${
                    darkMode ? 'text-gray-400 placeholder-gray-600' : 'text-gray-500 placeholder-gray-400'
                  }`}
                />
              </div>

              {/* عدد الأحرف */}
              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {content.length} {E.chars}
              </span>
            </div>

            {/* ── مُشغِّلات التسجيلات الصوتية المرفقة (التدوين بالصوت) ── */}
            {voiceNotes.length > 0 && (
              <div className="px-4 pb-3 flex flex-col gap-2">
                {voiceNotes.map((vn, idx) => (
                  <div key={vn.id}
                    className={`flex flex-col gap-1.5 px-3 py-2 rounded-xl ${
                      darkMode ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎙️</span>
                      <audio
                        controls
                        src={vn.uri}
                        preload="none"
                        className="flex-1 h-8"
                        style={{ maxWidth: '100%' }}
                      />
                      <span className={`text-xs shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {String(Math.floor(vn.duration / 60)).padStart(2, '0')}:{String(vn.duration % 60).padStart(2, '0')}
                      </span>
                      <button
                        onClick={() => setVoiceNotes(prev => prev.filter((_, i) => i !== idx))}
                        className={`shrink-0 p-1 rounded-lg ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                        aria-label={E.vrDeleteRecording}
                      >
                        ✕
                      </button>
                    </div>
                    {/* شارة "بانتظار الإنترنت للتحويل" + زر إعادة محاولة فورية */}
                    {vn.pendingTranscription && (
                      <div className="flex items-center justify-between gap-2 ps-7">
                        <span className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                          {t('vrPendingBadge')}
                        </span>
                        <button
                          onClick={() => retrySingleVoiceNote(vn)}
                          disabled={retryingVoiceId === vn.id}
                          className={`text-xs px-2 py-1 rounded-lg font-medium shrink-0 disabled:opacity-50
                            ${darkMode ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-600'}`}
                        >
                          {retryingVoiceId === vn.id ? '⏳' : t('vrRetryTranscribe')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── المرفقات (صور، فيديو، PDF، ملفات) ── */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,application/pdf,*/*"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                onClick={() => void handleAttachClick()}
                disabled={uploadingFile}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 ${
                  darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {uploadingFile ? '⏳' : '📎'} {t('attachFile')}
              </button>

              {attachments.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className={`relative group rounded-xl overflow-hidden border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                      {/* معاينة حسب النوع */}
                      {att.kind === 'image' ? (
                        <img src={att.uri} alt={att.name} className="w-full h-24 object-cover cursor-pointer" onClick={() => void handleOpenAttachment(att)} />
                      ) : att.kind === 'video' ? (
                        <video src={att.uri} className="w-full h-24 object-cover bg-black cursor-pointer" controls preload="metadata" />
                      ) : att.kind === 'audio' ? (
                        <div className="p-2">
                          <div className="text-2xl text-center mb-1">🎵</div>
                          <audio src={att.uri} controls className="w-full h-8" />
                        </div>
                      ) : (
                        <button onClick={() => void handleOpenAttachment(att)} className="w-full h-24 flex flex-col items-center justify-center gap-1">
                          <span className="text-3xl">{kindIcon(att.kind)}</span>
                          <span className="text-[10px] text-gray-400">{t('tapToOpen')}</span>
                        </button>
                      )}
                      {/* اسم الملف وحجمه + زر تنزيل */}
                      <div className={`px-2 py-1.5 flex items-center justify-between gap-1 ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate" title={att.name}>{att.name}</div>
                          <div className="text-[10px] text-gray-400">{formatSize(att.size)}</div>
                        </div>
                        <button
                          onClick={() => void handleOpenAttachment(att)}
                          aria-label={t('tapToOpen')}
                          title={t('tapToOpen')}
                          className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-sm transition active:scale-90 ${
                            darkMode ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          ⬇️
                        </button>
                      </div>
                      {/* زر الحذف */}
                      <button
                        onClick={() => void handleRemoveAttachment(att)}
                        aria-label="حذف"
                        className="absolute top-1 left-1 h-6 w-6 flex items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-md active:scale-90"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* تنبيه حالة التنزيل/الفتح */}
              {attachMsg && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${
                    attachMsg.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : attachMsg.type === 'error'
                      ? 'bg-red-500/15 text-red-500'
                      : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {attachMsg.text}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* لوحة الذكاء الاصطناعي */}
        {showAiPanel && (
          <div className={`w-80 border-l overflow-y-auto ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="p-4">
              <h3 className={`font-semibold mb-4 flex items-center gap-2 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <span className="text-xl">✨</span>
                {E.aiHelper}
              </h3>

              {/* أزرار المعالجة */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => handleAiProcess('summarize')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <span>{E.summarize}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.summarizeDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('tags')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>🏷️</span>
                    <span>{E.suggestTags}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.suggestTagsDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('tasks')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span>{E.extractTasks}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.extractTasksDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('decompose')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>⚡</span>
                    <span>{E.decompose}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.decomposeDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('suggest-title')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>✍️</span>
                    <span>{E.suggestTitle}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.suggestTitleDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('spell-check')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>🔤</span>
                    <span>{E.spellCheck}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.spellCheckDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('expand')}
                  disabled={isAiLoading || (!content.trim() && !title.trim())}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>🪄</span>
                    <span>{E.expand}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.expandDesc}
                  </p>
                </button>

                <button
                  onClick={() => handleAiProcess('translate-en')}
                  disabled={isAiLoading || !content.trim()}
                  className={`w-full p-3 rounded-xl text-right transition-colors ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span>🌐</span>
                    <span>{E.translate}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {E.translateDesc}
                  </p>
                </button>

                {/* سؤال عن الملاحظة */}
                <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>💬</span>
                    <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{E.askNote}</span>
                  </div>
                  <div className="flex gap-2">
                    <CaretSafeInput
                      value={askQuestion}
                      onChange={e => setAskQuestion(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key !== 'Enter' || !askQuestion.trim() || isAiLoading) return;
                        setIsAiLoading(true);
                        try {
                          const ans = await aiAskAboutNote(askQuestion, content, title);
                          setAskAnswer(ans);
                          setShowAiPanel(true);
                        } catch { setAskAnswer(E.connErr); } finally { setIsAiLoading(false); }
                      }}
                      placeholder={t('askNotePlaceholder')}
                      className={`flex-1 rounded-xl border px-2 py-1.5 text-xs outline-none ${darkMode ? 'border-gray-600 bg-gray-900 text-white placeholder-gray-500' : 'border-gray-200 bg-gray-50'}`}
                    />
                    <button
                      onClick={async () => {
                        if (!askQuestion.trim() || isAiLoading) return;
                        setIsAiLoading(true);
                        try {
                          const ans = await aiAskAboutNote(askQuestion, content, title);
                          setAskAnswer(ans);
                          setShowAiPanel(true);
                        } catch { setAskAnswer(E.connErr); } finally { setIsAiLoading(false); }
                      }}
                      disabled={isAiLoading || !askQuestion.trim()}
                      className="rounded-xl bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      {E.question}
                    </button>
                  </div>
                  {askAnswer && (
                    <p className={`mt-2 text-xs leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{askAnswer}</p>
                  )}
                </div>

              </div>

              {/* حالة التحميل */}
              {isAiLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {E.processing}
                    </span>
                  </div>
                </div>
              )}

              {/* نتائج المعالجة */}
              {!isAiLoading && (aiSummary || aiTags.length > 0 || extractedTasks.length > 0 || spellResult) && (
                <div className="space-y-4">
                  {/* الملخص */}
                  {aiSummary && (
                    <div className={`p-3 rounded-xl ${
                      darkMode ? 'bg-gray-700' : 'bg-white'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {E.summaryLabel}
                      </h4>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {aiSummary}
                      </p>
                      <button
                        onClick={() => {
                          setContent(prev => prev + E.summaryHeading + aiSummary);
                        }}
                        className="mt-2 text-xs text-violet-500 hover:text-violet-600"
                      >
                        {E.addToNote}
                      </button>
                    </div>
                  )}

                  {/* نتيجة التصحيح الإملائي */}
                  {spellResult && (
                    <div className={`p-3 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                      <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {E.spellLabel}
                      </h4>
                      {spellResult.changes.length > 0 ? (
                        <>
                          <ul className={`text-xs space-y-1 mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {spellResult.changes.slice(0, 6).map((ch, i) => (
                              <li key={i}>• {ch}</li>
                            ))}
                          </ul>
                          <button
                            onClick={() => {
                              setContent(spellResult.corrected);
                              setSpellResult(null);
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-bold transition-colors"
                          >
                            {E.applyFixes}
                          </button>
                        </>
                      ) : (
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {E.noErrors}
                        </p>
                      )}
                    </div>
                  )}

                  {/* الوسوم المقترحة */}
                  {aiTags.length > 0 && (
                    <div className={`p-3 rounded-xl ${
                      darkMode ? 'bg-gray-700' : 'bg-white'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {E.tagsLabel}
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {aiTags.map((tag, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (!tags.includes(tag)) {
                                setTags([...tags, tag]);
                              }
                            }}
                            className={`px-2 py-1 rounded-full text-xs transition-colors ${
                              tags.includes(tag)
                                ? 'bg-violet-500 text-white'
                                : darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* المهام المستخرجة */}
                  {extractedTasks.length > 0 && (
                    <div className={`p-3 rounded-xl ${
                      darkMode ? 'bg-gray-700' : 'bg-white'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {E.tasksLabel}
                      </h4>
                      <div className="space-y-2">
                        {extractedTasks.map((task, idx) => (
                          <label key={idx} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => toggleTask(idx)}
                              className="mt-0.5 w-4 h-4 rounded text-violet-500"
                            />
                            <span className={`text-sm ${
                              task.done 
                                ? 'line-through text-gray-400' 
                                : darkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {task.task}
                            </span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const taskList = extractedTasks
                            .map(t => `- [${t.done ? 'x' : ' '}] ${t.task}`)
                            .join('\n');
                          setContent(prev => prev + E.tasksHeading + taskList);
                        }}
                        className="mt-2 text-xs text-violet-500 hover:text-violet-600"
                      >
                        {E.addToNote}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── تسجيل صوتي حقيقي بالميكروفون ── */}
      <VoiceRecorder
        isOpen={showVoicePrompt}
        onClose={() => setShowVoicePrompt(false)}
        darkMode={darkMode}
        onResult={(result) => {
          if (result.text) {
            setContent(prev => prev + result.text);
            // استخراج وسوم تلقائية من النص
            const words = result.text.replace(/[^أ-يa-zA-Z\s]/g, '').split(' ')
              .filter(w => w.length > 4).slice(0, 3);
            if (words.length) setTags(prev => Array.from(new Set([...prev, ...words])));
          }
          if (result.audio) {
            setVoiceNotes(prev => [...prev, {
              id: `vn_${Date.now()}`,
              uri: result.audio!.uri,
              duration: result.audio!.duration,
              createdAt: Date.now(),
              mimeType: result.audio!.mimeType,
            }]);
          }
        }}
      />

      {/* نافذة تأكيد الحذف الفاخرة */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          const idToDelete = savedNoteIdRef.current ?? noteId;
          if (idToDelete) {
            deleteNote(idToDelete);
            onClose();
          }
        }}
        title={E.delTitle}
        message={E.delMsg}
        variant="danger"
        confirmLabel={E.delConfirm}
        cancelLabel={E.delCancel}
      />

      {/* نافذة تأكيد إزالة الحماية برقم سري */}
      <ConfirmModal
        isOpen={showRemoveLockConfirm}
        onClose={() => setShowRemoveLockConfirm(false)}
        onConfirm={() => {
          pinRef.current = null;
          setIsLocked(false);
          setLockMeta(null);
          setShowRemoveLockConfirm(false);
        }}
        title={E.rmLockTitle}
        message={E.rmLockMsg}
        variant="danger"
        confirmLabel={E.rmLockConfirm}
        cancelLabel={E.rmLockCancel}
      />

      {/* نافذة تأكيد الخروج بتغييرات غير محفوظة */}
      <ConfirmModal
        isOpen={showUnsavedConfirm}
        onClose={() => {
          // "إلغاء" = الخروج بدون حفظ (المستخدم اختار عدم الحفظ)
          setShowUnsavedConfirm(false);
          onClose();
          fireExitInterstitial();
        }}
        onConfirm={() => {
          // "حفظ" = احفظ ثم اخرج
          setShowUnsavedConfirm(false);
          void saveNote();
          onClose();
          fireExitInterstitial();
        }}
        title={E.unsavedTitle}
        message={E.unsavedMsg}
        variant="warning"
        confirmLabel={E.unsavedSave}
        cancelLabel={E.unsavedDiscard}
      />

      {/* نافذة القفل برقم سري — إعداد / فتح / تغيير */}
      <NoteLockModal
        isOpen={lockModalMode !== null}
        mode={lockModalMode ?? 'setup'}
        darkMode={darkMode}
        error={lockError}
        busy={lockBusy}
        onClose={handleLockModalClose}
        onSubmit={handleLockSubmit}
      />

      {/* نافذة الإكمال التلقائي لروابط [[...]] */}
      {linkCtx && (
        <LinkAutocomplete
          query={linkCtx.query}
          notes={notes}
          darkMode={darkMode}
          language={language}
          anchorTop={linkCtx.anchorTop}
          anchorLeft={linkCtx.anchorLeft}
          onSelect={handleLinkSelect}
          onClose={() => setLinkCtx(null)}
        />
      )}
    </div>
  );
}
