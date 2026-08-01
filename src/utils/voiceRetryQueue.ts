/**
 * voiceRetryQueue.ts — إعادة محاولة تحويل الصوت لنص تلقائياً عند رجوع الإنترنت
 * ─────────────────────────────────────────────────────────────────────
 * يُستخدَم من AppContext.tsx (مرة واحدة عند تشغيل التطبيق + عند كل حدث
 * 'online'). يبحث عن كل التسجيلات الصوتية المُعلَّمة pendingTranscription
 * في الملاحظات غير المقفلة، يقرأها من القرص عبر @capacitor/filesystem
 * (وليس من الذاكرة — فالتطبيق قد يكون أُعيد تشغيله منذ التسجيل)، ويحوّلها
 * عبر Gemini، ثم يُلحِق النص بالملاحظة ويُزيل علامة الانتظار.
 *
 * ملاحظات تصميم مهمة:
 *  - الملاحظات المقفلة (isLocked) تُستثنى تماماً: لا يمكن الوصول لمحتواها
 *    الصريح بدون الرقم السري، ولا نملكه في الخلفية — يبقى التسجيل بانتظار
 *    فتح الملاحظة يدوياً من المستخدم لاحقاً.
 *  - على الويب (بدون Capacitor Filesystem) لا يمكن إعادة قراءة الصوت بعد
 *    إعادة تحميل الصفحة (الرابط المؤقت blob: يفنى) — تُستثنى تلقائياً
 *    لعدم وجود `path`.
 *  - حماية من التشغيل المتزامن المتكرر عبر قفل بسيط (_isRunning).
 */

import { Capacitor } from '@capacitor/core';
import { geminiTranscribeAudio } from './geminiService';

export interface RetryableNote {
  id: string;
  content: string;
  isLocked?: boolean;
  voiceNotes?: {
    id: string;
    path?: string;
    mimeType: string;
    pendingTranscription?: boolean;
  }[];
}

let _isRunning = false;

/**
 * يفحص كل الملاحظات الممرَّرة، ويحاول تحويل أي تسجيل صوتي معلَّق إلى نص.
 * `onNoteUpdated` يُستدعى بمعرّف الملاحظة والمحتوى الجديد + voiceNotes
 * المُحدَّثة، ليقوم المستدعي (AppContext) بحفظها فعلياً عبر updateNote.
 */
export async function retryPendingVoiceTranscriptions(
  notes: RetryableNote[],
  onNoteUpdated: (noteId: string, patch: { content: string; voiceNotes: RetryableNote['voiceNotes'] }) => void
): Promise<void> {
  if (_isRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!Capacitor.isNativePlatform()) return; // الويب: لا path صالح لإعادة القراءة

  const candidates = notes.filter(
    n => !n.isLocked && n.voiceNotes?.some(v => v.pendingTranscription && v.path)
  );
  if (candidates.length === 0) return;

  _isRunning = true;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    for (const note of candidates) {
      let contentChanged = false;
      let newContent = note.content;
      const updatedVoiceNotes = [...(note.voiceNotes ?? [])];

      for (let i = 0; i < updatedVoiceNotes.length; i++) {
        const vn = updatedVoiceNotes[i];
        if (!vn.pendingTranscription || !vn.path) continue;

        try {
          const fileResult = await Filesystem.readFile({ path: vn.path, directory: Directory.Data });
          const base64 = typeof fileResult.data === 'string' ? fileResult.data : '';
          if (!base64) continue;

          const text = await geminiTranscribeAudio(base64, vn.mimeType);
          if (text.trim()) {
            newContent += `\n\n## 🎙️ ${text.trim()}\n\n> 🤖 تم التحويل تلقائياً بعد رجوع الاتصال`;
            updatedVoiceNotes[i] = { ...vn, pendingTranscription: false };
            contentChanged = true;
          }
          // نص فارغ أو فشل: نُبقي pendingTranscription=true لمحاولة لاحقة
        } catch (e) {
          console.warn('[voiceRetryQueue] retry failed for', vn.id, e);
          // لا نُعطّل بقية القائمة بسبب فشل تسجيل واحد (قد تكون الحصة نفدت
          // مؤقتاً) — نكسر الحلقة الداخلية هنا فقط لتفادي محاولات فاشلة
          // متكررة سريعة على نفس الملاحظة، وتُحاوَل الباقي في الدورة القادمة.
          break;
        }
      }

      if (contentChanged) {
        onNoteUpdated(note.id, { content: newContent, voiceNotes: updatedVoiceNotes });
      }
    }
  } finally {
    _isRunning = false;
  }
}
