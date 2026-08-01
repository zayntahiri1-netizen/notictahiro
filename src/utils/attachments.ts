/**
 * attachments.ts — إدارة مرفقات الملاحظات (صور، فيديو، PDF، صوت، أي ملف)
 * ─────────────────────────────────────────────────────────────────────
 * التخزين على الجهاز (مجاني، يعمل بلا إنترنت):
 *  - الجوال: ملف فعلي في Directory.Data/attachments/ عبر @capacitor/filesystem،
 *            ونحتفظ بمسار + رابط عرض (convertFileSrc).
 *  - الويب: dataURL مضمّن (للمعاينة في المتصفح).
 *
 * الفيديوهات الكبيرة تُخزَّن كملفات حقيقية لا في localStorage (الذي يمتلئ سريعاً).
 */

import { Capacitor } from '@capacitor/core';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'word' | 'excel' | 'powerpoint' | 'text' | 'file';

export interface Attachment {
  id: string;
  name: string;
  path?: string;
  uri: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  createdAt: number;
}

/** يصنّف الملف حسب نوعه MIME أو امتداده لاختيار طريقة العرض والأيقونة */
export function classifyFile(mimeType: string, fileName = ''): AttachmentKind {
  const mt = mimeType.toLowerCase();
  const ext = fileName.toLowerCase().split('.').pop() || '';

  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt === 'application/pdf' || ext === 'pdf') return 'pdf';

  // الملفات المضغوطة
  if (/zip|rar|7z|tar|gz|compressed/.test(mt) || /^(zip|rar|7z|tar|gz|bz2)$/.test(ext)) return 'archive';

  // مستندات Word
  if (/word|msword|officedocument\.wordprocessing/.test(mt) || /^(doc|docx|odt|rtf)$/.test(ext)) return 'word';

  // جداول Excel
  if (/excel|spreadsheet|officedocument\.spreadsheet/.test(mt) || /^(xls|xlsx|ods|csv)$/.test(ext)) return 'excel';

  // عروض PowerPoint
  if (/powerpoint|presentation|officedocument\.presentation/.test(mt) || /^(ppt|pptx|odp)$/.test(ext)) return 'powerpoint';

  // نصوص وأكواد
  if (mt.startsWith('text/') || /^(txt|md|json|xml|html|js|ts|css|py|java)$/.test(ext)) return 'text';

  return 'file';
}

/** أيقونة تعبيرية لكل نوع ملف (للعرض في القائمة) */
export function kindIcon(kind: AttachmentKind): string {
  switch (kind) {
    case 'image': return '🖼️';
    case 'video': return '🎥';
    case 'audio': return '🎵';
    case 'pdf': return '📄';
    case 'archive': return '🗜️';
    case 'word': return '📘';
    case 'excel': return '📗';
    case 'powerpoint': return '📙';
    case 'text': return '📝';
    default: return '📎';
  }
}

/** حجم مقروء (KB / MB) */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** يحوّل File إلى base64 (بدون بادئة dataURL) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** يحوّل File إلى dataURL كامل (للعرض على الويب) */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_SIZE = 100 * 1024 * 1024; // 100MB حد أقصى للملف الواحد

/**
 * يفتح منتقي الملفات الأصلي (موثوق على أندرويد، عكس <input type=file>).
 * يُرجع مصفوفة مرفقات محفوظة. على الويب يُرجع null ليستخدم المستدعي <input>.
 */
export async function pickAndSaveAttachments(): Promise<Attachment[] | null> {
  if (!Capacitor.isNativePlatform()) return null; // الويب → fallback لـ input

  try {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');
    const result = await FilePicker.pickFiles({ readData: true });
    const out: Attachment[] = [];

    for (const f of result.files) {
      if (!f.data) continue; // لا بيانات
      const size = f.size ?? 0;
      if (size > MAX_SIZE) continue; // تجاوز الحد

      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const mimeType = f.mimeType || 'application/octet-stream';
      const kind = classifyFile(mimeType, f.name);
      const ext = f.name.includes('.') ? f.name.split('.').pop() : '';
      const fileName = `${id}${ext ? '.' + ext : ''}`;

      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.mkdir({ path: 'attachments', directory: Directory.Data, recursive: true }).catch(() => {});
        const path = `attachments/${fileName}`;
        // f.data هو base64 (لأن readData:true)
        const writeRes = await Filesystem.writeFile({ path, data: f.data, directory: Directory.Data });
        out.push({
          id, name: f.name, path,
          uri: Capacitor.convertFileSrc(writeRes.uri),
          mimeType, size, kind, createdAt: Date.now(),
        });
      } catch (e) {
        console.warn('[attachments] native pick save failed:', e);
      }
    }
    return out;
  } catch (e) {
    console.warn('[attachments] FilePicker failed:', e);
    return []; // المستخدم ألغى أو خطأ → مصفوفة فارغة (لا fallback لـ input على الجوال)
  }
}


/**
 * يحفظ ملفاً مرفقاً ويُرجع بياناته. يرمي خطأً إن تجاوز الحد الأقصى.
 */
export async function saveAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_SIZE) {
    throw new Error('FILE_TOO_LARGE');
  }
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kind = classifyFile(file.type || 'application/octet-stream', file.name);
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const fileName = `${id}${ext ? '.' + ext : ''}`;

  // ─── الجوال: ملف فعلي في Directory.Data ──────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await fileToBase64(file);
      await Filesystem.mkdir({ path: 'attachments', directory: Directory.Data, recursive: true }).catch(() => {});
      const path = `attachments/${fileName}`;
      const result = await Filesystem.writeFile({ path, data: base64, directory: Directory.Data });
      return {
        id, name: file.name, path,
        uri: Capacitor.convertFileSrc(result.uri),
        mimeType: file.type || 'application/octet-stream',
        size: file.size, kind, createdAt: Date.now(),
      };
    } catch (e) {
      console.warn('[attachments] native save failed, falling back to dataURL:', e);
    }
  }

  // ─── الويب أو fallback: dataURL ───────────────────────────────────
  const dataUrl = await fileToDataURL(file);
  return {
    id, name: file.name, uri: dataUrl,
    mimeType: file.type || 'application/octet-stream',
    size: file.size, kind, createdAt: Date.now(),
  };
}

/** يحذف ملف مرفق من الجهاز (إن كان مخزّناً كملف فعلي) */
export async function deleteAttachment(att: Attachment): Promise<void> {
  if (Capacitor.isNativePlatform() && att.path) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.deleteFile({ path: att.path, directory: Directory.Data });
    } catch (e) {
      console.warn('[attachments] delete failed:', e);
    }
  }
}

/** نتيجة محاولة تنزيل/فتح مرفق — تُمكّن الواجهة من عرض تنبيه واضح للمستخدم */
export interface OpenResult {
  ok: boolean;            // هل نجحت العملية من منظور المستخدم؟
  savedToDocuments: boolean; // هل حُفظت نسخة في مجلد المستندات العام؟
  shared: boolean;        // هل ظهرت ورقة المشاركة (حفظ في الملفات / فتح بتطبيق)؟
  error?: string;
}

/**
 * ينزّل/يفتح مرفقاً:
 *  - الجوال (أندرويد/iOS): يحضّر نسخة قابلة للمشاركة في Cache (تعمل دائماً عبر
 *    FileProvider)، يحاول أيضاً حفظ نسخة في مجلد المستندات العام، ثم يفتح ورقة
 *    المشاركة ليختار المستخدم "حفظ في الملفات" أو الفتح بتطبيق آخر.
 *  - الويب: تنزيل مباشر عبر المتصفح.
 *
 * يعمل حتى لو كان المرفق قديماً ومخزَّناً كـ dataURL بلا مسار ملف (path).
 */
export async function openAttachment(att: Attachment): Promise<OpenResult> {
  // ─── الجوال (أندرويد/iOS) ─────────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      // 1) اجلب بايتات الملف (base64): من الملف المخزَّن إن وُجد path،
      //    وإلا من الـ dataURL المضمَّن (مرفقات قديمة بلا path).
      let base64 = '';
      if (att.path) {
        const f = await Filesystem.readFile({ path: att.path, directory: Directory.Data });
        base64 = typeof f.data === 'string' ? f.data : '';
      } else if (att.uri) {
        base64 = att.uri.includes(',') ? att.uri.split(',')[1] : att.uri;
      }
      if (!base64) {
        return { ok: false, savedToDocuments: false, shared: false, error: 'NO_DATA' };
      }

      // 2) اكتب نسخة في Cache — قابلة للمشاركة دائماً عبر FileProvider في Capacitor.
      await Filesystem.mkdir({ path: 'shared', directory: Directory.Cache, recursive: true }).catch(() => {});
      const cachePath = `shared/${att.name}`;
      await Filesystem.writeFile({ path: cachePath, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: cachePath, directory: Directory.Cache });

      // 3) جرّب أيضاً حفظ نسخة في مجلد المستندات العام (قد يفشل على أندرويد 11+).
      let savedToDocuments = false;
      try {
        await Filesystem.writeFile({ path: att.name, data: base64, directory: Directory.Documents, recursive: true });
        savedToDocuments = true;
      } catch {
        // Scoped Storage يمنع الكتابة المباشرة — لا بأس، المشاركة كافية.
      }

      // 4) افتح ورقة المشاركة.
      let shared = false;
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: att.name,
          text: savedToDocuments ? `تم حفظ ${att.name} في مجلد المستندات` : att.name,
          url: uri,
          dialogTitle: 'فتح أو حفظ الملف',
        });
        shared = true;
      } catch (shareErr) {
        // إلغاء المستخدم لورقة المشاركة ليس فشلاً.
        if (/cancel|dismiss|abort/i.test(String(shareErr))) shared = true;
        else console.warn('[attachments] share unavailable:', shareErr);
      }

      return { ok: savedToDocuments || shared, savedToDocuments, shared };
    } catch (e) {
      console.warn('[attachments] native open failed:', e);
      return { ok: false, savedToDocuments: false, shared: false, error: String(e) };
    }
  }

  // ─── الويب: تنزيل عبر المتصفح ───────────────────────────────────
  if (att.uri) {
    try {
      const a = document.createElement('a');
      a.href = att.uri;
      a.download = att.name; // اسم التنزيل
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { ok: true, savedToDocuments: false, shared: false };
    } catch {
      try {
        window.open(att.uri, '_blank');
        return { ok: true, savedToDocuments: false, shared: false };
      } catch (e) {
        return { ok: false, savedToDocuments: false, shared: false, error: String(e) };
      }
    }
  }
  return { ok: false, savedToDocuments: false, shared: false, error: 'NO_URI' };
}
