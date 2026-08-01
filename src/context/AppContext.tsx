import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppLanguage, TranslationKey, detectInitialLanguage, rtlLanguages, translate } from '../i18n';
import { scheduleNoteAlarm, cancelNoteAlarm, scheduleDebtReminders, cancelDebtReminders, ensureNotificationPermission } from '../utils/notifications';
import { retryPendingVoiceTranscriptions } from '../utils/voiceRetryQueue';
import { setBubbleLanguage } from '../utils/bubbleOverlay';

// ─── تخزين آمن ضد البيانات التالفة وامتلاء الحصّة ─────────────
function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    // بيانات تالفة → استرجاع القيمة الافتراضية بدل الانهيار
    console.warn('[storage] read failed for', key, '— using default');
    try { localStorage.removeItem(key); } catch {}
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // الذاكرة ممتلئة (QuotaExceeded) أو خطأ آخر — نتجنّب إسقاط التطبيق
    console.warn('[storage] write failed for', key, e);
  }
}

// ─── كتابة مؤجَّلة لتقليل عبء الكتابة أثناء الطباعة السريعة ───
// كلّ مفتاح له مؤقّت مستقل. مغادرة الصفحة أو إخفاؤها تُفرغ كلّ الكتابات العالقة.
const _writeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const _pendingValues = new Map<string, unknown>();
const WRITE_DEBOUNCE_MS = 400;

function debouncedWrite(key: string, value: unknown): void {
  _pendingValues.set(key, value);
  const existing = _writeTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    safeWrite(key, _pendingValues.get(key));
    _writeTimers.delete(key);
    _pendingValues.delete(key);
  }, WRITE_DEBOUNCE_MS);
  _writeTimers.set(key, timer);
}

function flushAllWrites(): void {
  _writeTimers.forEach((timer, key) => {
    clearTimeout(timer);
    if (_pendingValues.has(key)) {
      safeWrite(key, _pendingValues.get(key));
      _pendingValues.delete(key);
    }
  });
  _writeTimers.clear();
}

// إفراغ الكتابات العالقة قبل مغادرة التطبيق (مهم على الجوال)
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllWrites();
  });
  window.addEventListener('pagehide', flushAllWrites);
  window.addEventListener('beforeunload', flushAllWrites);
}

export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'idea';
  projectId: string | null;
  tags: string[];
  isPinned: boolean;
  alarm?: {
    hasAlarm: boolean;
    alarmTime?: string;
    isRecurring: boolean;
    recurrenceType?: 'daily' | 'weekly' | 'monthly';
    chainedAlarms?: { time: string; label: string }[]; // المنبهات المتسلسلة
  };
  aiData?: {
    summary?: string;
    tags?: string[];
    extractedTasks?: { task: string; done: boolean }[];
  };
  // ── مرفقات صوتية حقيقية (التدوين بالصوت) ────────────────────────
  // كل عنصر هو تسجيل صوتي حُفظ فعلياً على الجهاز + نُسخ نصه عبر Gemini
  voiceNotes?: {
    id: string;
    uri: string;        // رابط قابل للتشغيل (Capacitor convertFileSrc أو blob: على الويب)
    path?: string;       // المسار الخام داخل Directory.Data (لإعادة القراءة لاحقاً عبر Filesystem)
    duration: number;   // بالثواني
    createdAt: number;
    mimeType: string;
    pendingTranscription?: boolean; // true إن لم يُحوَّل الصوت لنص بعد (لا إنترنت وقت التسجيل)
  }[];
  // ── مرفقات عامة (صور، فيديو، PDF، صوت، أي ملف) محفوظة على الجهاز ──
  // تُخزَّن في Directory.Data عبر Filesystem؛ نحتفظ بالمسار + بيانات وصفية.
  attachments?: {
    id: string;
    name: string;       // اسم الملف الأصلي
    path?: string;       // المسار داخل Directory.Data (للجوال) — لإعادة القراءة
    uri: string;        // رابط قابل للعرض (convertFileSrc على الجوال أو dataURL على الويب)
    mimeType: string;   // نوع الملف (image/png, video/mp4, application/pdf...)
    size: number;       // الحجم بالبايت
    kind: 'image' | 'video' | 'audio' | 'pdf' | 'file'; // تصنيف للعرض
    createdAt: number;
  }[];
  // ── قفل برقم سري (تشفير حقيقي AES-GCM-256، انظر utils/noteLock.ts) ──
  // عند isLocked=true: حقل content يحتوي النص المُشفَّر (base64) لا النص الصريح
  isLocked?: boolean;
  lock?: {
    salt: string; // base64 — يُولَّد مرة واحدة فقط عند أول تفعيل للقفل
    iv: string;   // base64 — يتغيّر عند كل حفظ (لا يُعاد استخدامه أبداً)
  };
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  noteCount: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  category: 'investment' | 'food' | 'transport' | 'shopping' | 'other';
  description: string;
  date: string;
}

export interface BrainDump {
  id: string;
  originalText: string;
  urgentPriorities: string[];
  futureIdeas: string[];
  anxietyRelief: string;
  date: string;
}

export interface DebtCredit {
  id: string;
  personName: string;
  type: 'debt' | 'credit'; // debt = عليّ (مدين), credit = لي (دائن)
  amount: number;
  currency: string;
  description: string;
  dueDate: string; // تاريخ الاستحقاق
  status: 'pending' | 'partial' | 'paid';
  paidAmount: number;
  proactiveAlarms: number[]; // عدد الأيام قبل الاستحقاق (مثال: [7, 3, 1] قبلها بـ 7 أيام، 3 أيام، يوم)
  dailyReminder: boolean; // منبه يومي
  dailyReminderTime: string; // وقت المنبه اليومي (HH:MM)
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface AppContextType {
  notes: Note[];
  projects: Project[];
  transactions: Transaction[];
  brainDumps: BrainDump[];
  debtsCredits: DebtCredit[];
  language: AppLanguage;
  direction: 'rtl' | 'ltr';
  t: (key: TranslationKey) => string;
  darkMode: boolean;
  searchQuery: string;
  selectedProject: string | null;
  selectedNote: Note | null;
  sidebarOpen: boolean;
  
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'noteCount'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  deleteTransaction: (id: string) => void;
  
  addBrainDump: (dump: Omit<BrainDump, 'id' | 'date'>) => void;
  deleteBrainDump: (id: string) => void;
  
  addDebtCredit: (dc: Omit<DebtCredit, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDebtCredit: (id: string, updates: Partial<DebtCredit>) => void;
  deleteDebtCredit: (id: string) => void;
  
  setDarkMode: (value: boolean) => void;
  setLanguage: (value: AppLanguage) => void;
  setSearchQuery: (value: string) => void;
  setSelectedProject: (value: string | null) => void;
  setSelectedNote: (note: Note | null) => void;
  setSidebarOpen: (value: boolean) => void;

  // تصدير/استيراد بيانات المستخدم (JSON) — ملكية كاملة للبيانات
  exportData: () => void;
  importData: (file: File, mode?: 'replace' | 'merge') => Promise<{ ok: boolean; message: string }>;

  // تراجع عن آخر حذف للملاحظة (متاح خلال 6 ثوانٍ)
  lastDeletedNote: Note | null;
  restoreLastDelete: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ملاحظات تجريبية بالعربية
// (أُزيلت البيانات التجريبية — التطبيق يبدأ فارغاً للمستخدمين الجدد)

// ─── مولّد معرّفات فريد آمن من التصادم عند الإنشاء السريع ──────
let _idCounter = 0;
function uniqueId(): string {
  return `${Date.now()}-${(++_idCounter).toString(36)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(() => {
    return safeRead('notic-notes', []);
  });
  
  const [projects, setProjects] = useState<Project[]>(() => {
    return safeRead('notic-projects', []);
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return safeRead('notic-transactions', []);
  });

  const [brainDumps, setBrainDumps] = useState<BrainDump[]>(() => {
    return safeRead('notic-braindumps', []);
  });

  const [debtsCredits, setDebtsCredits] = useState<DebtCredit[]>(() => {
    return safeRead('notic-debtscredits', []);
  });
  
  const [darkMode, setDarkMode] = useState(() => {
    return safeRead<boolean>('notic-darkmode', window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [language, setLanguage] = useState<AppLanguage>(() => detectInitialLanguage());
  const direction: 'rtl' | 'ltr' = rtlLanguages.includes(language) ? 'rtl' : 'ltr';
  const t = (key: TranslationKey) => translate(language, key);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastDeletedNote, setLastDeletedNote] = useState<Note | null>(null);
  const _undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // حفظ البيانات تلقائياً
  useEffect(() => {
    debouncedWrite('notic-notes', notes);
  }, [notes]);

  useEffect(() => {
    debouncedWrite('notic-projects', projects);
  }, [projects]);

  useEffect(() => {
    debouncedWrite('notic-transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    debouncedWrite('notic-braindumps', brainDumps);
  }, [brainDumps]);

  useEffect(() => {
    debouncedWrite('notic-debtscredits', debtsCredits);
  }, [debtsCredits]);

  useEffect(() => {
    safeWrite('notic-darkmode', darkMode);
    // ملاحظة: تطبيق class على documentElement يتم في App.tsx مرة واحدة
    // لا نكرر ذلك هنا لتجنب double DOM mutation
  }, [darkMode]);

  useEffect(() => {
    try { localStorage.setItem('notic-language', language); } catch {}
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    document.documentElement.dir = direction;
    document.title = `${translate(language, 'appName')} — ${translate(language, 'appSubtitle')}`;
    // مزامنة لغة قائمة الفقعة العائمة الأصلية (Java) — بدون هذا تبقى
    // قائمة الفقعة بالعربية دائماً بصرف النظر عن لغة المستخدم الحالية.
    void setBubbleLanguage(language);
  }, [language, direction]);

  const addNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const newNote: Note = {
      ...noteData,
      id: uniqueId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setNotes(prev => [newNote, ...prev]);

    // جدولة إشعار حقيقي على الجهاز إن كان للملاحظة منبه
    if (newNote.alarm?.hasAlarm && newNote.alarm.alarmTime) {
      void ensureNotificationPermission().then(ok => { if (ok) void scheduleNoteAlarm(newNote); });
    }

    // تحديث عدد الملاحظات في المشروع
    if (noteData.projectId) {
      setProjects(prev => prev.map(p => 
        p.id === noteData.projectId 
          ? { ...p, noteCount: p.noteCount + 1 }
          : p
      ));
    }
    return newNote.id; // ← يُعيد الـ id لمنع التكرار
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note => {
      if (note.id !== id) return note;
      const updated = { ...note, ...updates, updatedAt: new Date().toISOString() };
      // مزامنة إشعار المنبه — فقط إن تغيّر المنبه فعلياً
      // (الحفظ التلقائي أثناء الكتابة كان يعيد الجدولة مع كل دفعة حفظ)
      const alarmChanged = JSON.stringify(note.alarm ?? null) !== JSON.stringify(updated.alarm ?? null);
      if (alarmChanged) {
        if (updated.alarm?.hasAlarm && updated.alarm.alarmTime) {
          void ensureNotificationPermission().then(ok => { if (ok) void scheduleNoteAlarm(updated); });
        } else {
          void cancelNoteAlarm(id);
        }
      }
      return updated;
    }));

    // تحديث عدد الملاحظات في المشاريع إذا تغيّر المشروع
    // نستخدم functional update لـ setNotes لقراءة آخر حالة حقيقية وتجنّب stale closure
    if ('projectId' in updates) {
      setNotes(latestNotes => {
        const oldNote = latestNotes.find(n => n.id === id);
        const oldProjectId = oldNote?.projectId ?? null;
        const newProjectId = (updates.projectId as string | null | undefined) ?? null;
        if (oldProjectId !== newProjectId) {
          setProjects(prev => prev.map(p => {
            if (p.id === oldProjectId) return { ...p, noteCount: Math.max(0, p.noteCount - 1) };
            if (p.id === newProjectId) return { ...p, noteCount: p.noteCount + 1 };
            return p;
          }));
        }
        return latestNotes; // لا نغيّر notes — القراءة فقط
      });
    }
  };

  // ── إعادة محاولة تحويل الصوت لنص تلقائياً عند توفر الإنترنت ─────────
  // نستخدم ref محدَّثاً دائماً بآخر notes لتفادي closure قديم داخل
  // مستمع 'online' (الذي يُسجَّل مرة واحدة فقط عند mount).
  const notesRefForRetry = useRef(notes);
  notesRefForRetry.current = notes;

  useEffect(() => {
    const runRetry = () => {
      void retryPendingVoiceTranscriptions(notesRefForRetry.current, (noteId, patch) => {
        updateNote(noteId, patch);
      });
    };
    // محاولة أولى عند تشغيل التطبيق (قد يكون متصلاً بالفعل)
    runRetry();
    // وكل مرة يرجع الاتصال بعد انقطاع
    window.addEventListener('online', runRetry);
    return () => window.removeEventListener('online', runRetry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    void cancelNoteAlarm(id);
    setNotes(prev => prev.filter(n => n.id !== id));

    // تحديث عدد الملاحظات في المشروع
    if (note.projectId) {
      setProjects(prev => prev.map(p =>
        p.id === note.projectId
          ? { ...p, noteCount: Math.max(0, p.noteCount - 1) }
          : p
      ));
    }

    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }

    // التقاط الملاحظة للسماح بالتراجع خلال 6 ثوانٍ
    setLastDeletedNote(note);
    if (_undoTimer.current) clearTimeout(_undoTimer.current);
    _undoTimer.current = setTimeout(() => setLastDeletedNote(null), 6000);
  };

  const restoreLastDelete = () => {
    if (!lastDeletedNote) return;
    if (_undoTimer.current) { clearTimeout(_undoTimer.current); _undoTimer.current = null; }
    const restored = lastDeletedNote;
    setNotes(prev => {
      // تجنّب التكرار في حال أُعيد الاستيراد أثناء العدّ التنازلي
      if (prev.some(n => n.id === restored.id)) return prev;
      return [restored, ...prev];
    });
    if (restored.projectId) {
      setProjects(prev => prev.map(p =>
        p.id === restored.projectId
          ? { ...p, noteCount: p.noteCount + 1 }
          : p
      ));
    }
    setLastDeletedNote(null);
  };

  const togglePin = (id: string) => {
    setNotes(prev => prev.map(note => 
      note.id === id 
        ? { ...note, isPinned: !note.isPinned, updatedAt: new Date().toISOString() }
        : note
    ));
  };

  const addProject = (projectData: Omit<Project, 'id' | 'createdAt' | 'noteCount'>) => {
    const newProject: Project = {
      ...projectData,
      id: uniqueId(),
      noteCount: 0,
      createdAt: new Date().toISOString()
    };
    setProjects(prev => [...prev, newProject]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(project => 
      project.id === id ? { ...project, ...updates } : project
    ));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(project => project.id !== id));
    // نقل الملاحظات إلى "بدون مشروع"
    setNotes(prev => prev.map(note => 
      note.projectId === id ? { ...note, projectId: null } : note
    ));
    if (selectedProject === id) {
      setSelectedProject(null);
    }
  };

  const addTransaction = (tData: Omit<Transaction, 'id' | 'date'>) => {
    const newT: Transaction = {
      ...tData,
      id: uniqueId(),
      date: new Date().toISOString()
    };
    setTransactions(prev => [newT, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const addBrainDump = (dData: Omit<BrainDump, 'id' | 'date'>) => {
    const newD: BrainDump = {
      ...dData,
      id: uniqueId(),
      date: new Date().toISOString()
    };
    setBrainDumps(prev => [newD, ...prev]);
  };

  const deleteBrainDump = (id: string) => {
    setBrainDumps(prev => prev.filter(d => d.id !== id));
  };

  const addDebtCredit = (dcData: Omit<DebtCredit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDC: DebtCredit = {
      ...dcData,
      id: uniqueId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDebtsCredits(prev => [newDC, ...prev]);
    // تذكيرات حقيقية: قبل الاستحقاق بيوم + يوم الاستحقاق
    void ensureNotificationPermission().then(ok => { if (ok) void scheduleDebtReminders(newDC); });
  };

  const updateDebtCredit = (id: string, updates: Partial<DebtCredit>) => {
    setDebtsCredits(prev => prev.map(dc => {
      if (dc.id !== id) return dc;
      const updated = { ...dc, ...updates, updatedAt: new Date().toISOString() };
      if (updated.status === 'paid') {
        void cancelDebtReminders(id);
      } else {
        void scheduleDebtReminders(updated);
      }
      return updated;
    }));
  };

  const deleteDebtCredit = (id: string) => {
    void cancelDebtReminders(id);
    setDebtsCredits(prev => prev.filter(dc => dc.id !== id));
  };

  // ─── تصدير بيانات المستخدم كملف JSON ──────────────────────────
  const exportData = () => {
    const payload = {
      _meta: {
        app: 'Notic Tahiro',
        version: 1,
        exportedAt: new Date().toISOString(),
      },
      notes,
      projects,
      transactions,
      brainDumps,
      debtsCredits,
      habits: (() => {
        try { return JSON.parse(localStorage.getItem('notic-habits') || '[]'); }
        catch { return []; }
      })(),
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `notic-tahiro-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.warn('[export] failed', e);
    }
  };

  // ─── استيراد البيانات من ملف JSON مع التحقّق من البنية ────────
  // mode: 'replace' → استبدال كامل (افتراضي) | 'merge' → دمج بدون حذف الموجود
  const importData = async (
    file: File,
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') {
        return { ok: false, message: 'الملفّ ليس بنية JSON صحيحة' };
      }
      // التحقّق من الحقول المتوقّعة (مرنة — نستورد ما هو متوفّر)
      const importedNotes = Array.isArray(data.notes) ? (data.notes as Note[]) : null;
      const importedProjects = Array.isArray(data.projects) ? (data.projects as Project[]) : null;
      const importedTransactions = Array.isArray(data.transactions) ? (data.transactions as Transaction[]) : null;
      const importedBrainDumps = Array.isArray(data.brainDumps) ? (data.brainDumps as BrainDump[]) : null;
      const importedDebtsCredits = Array.isArray(data.debtsCredits) ? (data.debtsCredits as DebtCredit[]) : null;
      if (!importedNotes && !importedProjects && !importedTransactions && !importedBrainDumps && !importedDebtsCredits) {
        return { ok: false, message: 'الملفّ لا يحوي أيّ بيانات قابلة للاستيراد' };
      }

      if (mode === 'merge') {
        // دمج: نضيف فقط السجلات ذات الـ id الجديد، ولا نحذف الموجود
        if (importedNotes) {
          setNotes(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            return [...prev, ...importedNotes.filter(n => !existingIds.has(n.id))];
          });
        }
        if (importedProjects) {
          setProjects(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...importedProjects.filter(p => !existingIds.has(p.id))];
          });
        }
        if (importedTransactions) {
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            return [...prev, ...importedTransactions.filter(t => !existingIds.has(t.id))];
          });
        }
        if (importedBrainDumps) {
          setBrainDumps(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            return [...prev, ...importedBrainDumps.filter(d => !existingIds.has(d.id))];
          });
        }
        if (importedDebtsCredits) {
          setDebtsCredits(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            return [...prev, ...importedDebtsCredits.filter(d => !existingIds.has(d.id))];
          });
        }
      } else {
        // استبدال كامل (replace)
        if (importedNotes) setNotes(importedNotes);
        if (importedProjects) setProjects(importedProjects);
        if (importedTransactions) setTransactions(importedTransactions);
        if (importedBrainDumps) setBrainDumps(importedBrainDumps);
        if (importedDebtsCredits) setDebtsCredits(importedDebtsCredits);
      }

      // استيراد العادات (تُحفظ مباشرة في localStorage — متتبع العادات يقرأها)
      if (Array.isArray(data.habits)) {
        try { localStorage.setItem('notic-habits', JSON.stringify(data.habits)); } catch { /* ignore */ }
      }
      const counts = [
        importedNotes && `${importedNotes.length} ملاحظة`,
        importedProjects && `${importedProjects.length} مشروع`,
        importedTransactions && `${importedTransactions.length} عملية مالية`,
        importedBrainDumps && `${importedBrainDumps.length} تفريغ`,
        importedDebtsCredits && `${importedDebtsCredits.length} دين/ائتمان`,
      ].filter(Boolean).join('، ');
      const modeLabel = mode === 'merge' ? 'دمج' : 'استبدال';
      return { ok: true, message: `تم الاستيراد (${modeLabel}) بنجاح: ${counts}` };
    } catch (e) {
      return { ok: false, message: 'فشل قراءة الملفّ — تحقّق أنّه ملفّ JSON صالح' };
    }
  };

  return (
    <AppContext.Provider value={{
      notes,
      projects,
      transactions,
      brainDumps,
      debtsCredits,
      language,
      direction,
      t,
      darkMode,
      searchQuery,
      selectedProject,
      selectedNote,
      sidebarOpen,
      addNote,
      updateNote,
      deleteNote,
      togglePin,
      addProject,
      updateProject,
      deleteProject,
      addTransaction,
      deleteTransaction,
      addBrainDump,
      deleteBrainDump,
      addDebtCredit,
      updateDebtCredit,
      deleteDebtCredit,
      setDarkMode,
      setLanguage,
      setSearchQuery,
      setSelectedProject,
      setSelectedNote,
      setSidebarOpen,
      exportData,
      importData,
      lastDeletedNote,
      restoreLastDelete
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
