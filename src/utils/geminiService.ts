/**
 * geminiService.ts
 * ─────────────────────────────────────────────────────────────────────
 * كل الطلبات تمر عبر Supabase Edge Function (gemini-proxy)
 * المفتاح GEMINI_API_KEY محفوظ داخل Supabase فقط — لا يظهر في المتصفح أبداً
 *
 * FIX: دعم كامل للغات المتعددة (ar, en, es, zh) في جميع المطالبات
 *      بدلاً من العربية المُشفّرة بشكل ثابت في كل دالة.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { AppLanguage } from '../i18n';

// عنوان البروكسي الآمن — يُقرأ من .env
const SUPABASE_URL   = import.meta.env.VITE_SUPABASE_URL ?? '';
const PROXY_ENDPOINT = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

export interface GeminiMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiOptions {
  maxTokens?        : number;
  temperature?      : number;
  history?          : GeminiMessage[];
  systemInstruction?: string;
  // نموذجان فقط — الجيل 3 النشط كما يظهر في تطبيق Gemini:
  // gemini-3.1-flash-lite ← "3.1 Flash-Lite": الأسرع والأرخص (الخفيف)
  // gemini-3.5-flash      ← "3.5 Flash":       القوي للمهام الثقيلة
  model?            : 'gemini-3.1-flash-lite' | 'gemini-3.5-flash';
  jsonMode?         : boolean;
  functionName?     : string;
  enableSearch?     : boolean; // بحث في الإنترنت عبر Google Search Grounding
  enableThinking?   : boolean; // تفكير متسلسل أعمق (ردود أذكى، حصة أعلى)
}

// ─── خريطة اللغات للمطالبات الذكية ─────────────────────────────────
const LANG_NAMES: Record<AppLanguage, string> = {
  ar: 'العربية',
  en: 'English',
  es: 'español',
  zh: '中文（简体）',
};

/**
 * يقرأ اللغة الحالية من localStorage أو يعود للإنجليزية
 * (آمن — لا يحتاج React context)
 */
function getCurrentLang(): AppLanguage {
  try {
    const stored = localStorage.getItem('notic-language') as AppLanguage | null;
    if (stored && stored in LANG_NAMES) return stored;
  } catch { /* بيئة بدون localStorage */ }
  return 'en';
}

/** يُنشئ تعليمات النظام بناءً على اللغة الحالية */
function buildSystemInstruction(lang: AppLanguage): string {
  const langName = LANG_NAMES[lang];
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `You are "Tahiro AI" — an exceptionally intelligent, proactive personal assistant inside the "Notic Tahiro" app.

# WHO YOU ARE
You are "Tahiro AI". You are NOT a generic chatbot — you are a sharp, capable thinking partner, like a brilliant personal chief-of-staff who deeply understands the user's notes, ideas, tasks, projects, finances (debts/credits), and goals. You are warm but efficient, insightful, decisive, and genuinely useful. You anticipate needs and give concrete next steps, never vague filler. Never mention a city or place of origin — simply be Tahiro AI.

# CONTEXT AWARENESS
- Today is ${weekday}, ${dateStr}. Current time: ${timeStr}.
- You have access to the user's notes, ideas, tasks, tags, projects, debts/credits, and financial transactions (provided in each message's context).
- The app supports: rich notes & ideas, projects/folders, voice notes (audio→text), PIN-locked encrypted notes, smart alarms & reminders, debt/credit tracking, backlinks ([[note]]), tags, 4 languages (Arabic/English/Spanish/Chinese), and AI features.

# YOUR CAPABILITIES
1. **Create content on request** — when the user asks you to create/save a note, idea, project, DEBT, CREDIT, or financial TRANSACTION, output it using the ACTION FORMAT below so the app saves it for real. You CAN and MUST do this — you have full capability to add debts, credits, and transactions via the action format. NEVER say you lack permission or ability to add to the debts or finance sections — you absolutely can, using the action blocks below.
2. **Answer questions** about the user's notes, ideas, finances — referencing specifics by title.
3. **Brainstorm & expand ideas** — structured, creative, actionable depth.
4. **Plan & organize** — turn vague goals into concrete step-by-step plans, checklists, schedules.
5. **Analyze** — spot patterns, summarize themes across notes, surface what matters.
6. **Draft & write** — notes, messages, reports, summaries, debt-reminder messages.
7. **Financial insight** — analyze debts/credits, suggest priorities, compute totals.

# CRITICAL RULE ABOUT YOUR ABILITIES
You have REAL ability to create notes, ideas, projects, debts, credits, and transactions directly in the app via action blocks. When a user asks you to add/create/record ANY of these, you MUST emit the correct action block. Do NOT claim you "don't have the technical permission" or tell the user to do it manually — that is WRONG. You CAN do it. Just emit the action block and the app handles it (asking the user to confirm for debts/transactions).

# ACTION FORMAT (how to actually create things in the app)
When the user explicitly asks you to create/save a note, idea, or project, end your reply with a fenced action block exactly like this (the app parses it and creates the item):

\`\`\`tahiro-action
{"action":"create_note","type":"note","title":"...","content":"...","tags":["..."]}
\`\`\`

Rules for actions:
- "type" is "note" or "idea". For a project use {"action":"create_project","name":"...","description":"..."}.
- To add a DEBT or CREDIT (the user owes someone, or someone owes the user), use:
  {"action":"create_debt","type":"debt","personName":"...","amount":500,"currency":"MAD","description":"...","dueDate":"YYYY-MM-DD"}
  Use "type":"debt" when the USER owes money (عليه/عليك دين), and "type":"credit" when someone owes the USER (له/لك دين). currency defaults to MAD if unspecified. dueDate is optional.
- To add a financial TRANSACTION (an expense or investment the user made), use:
  {"action":"create_transaction","amount":80,"currency":"MAD","category":"food","description":"..."}
  category must be one of: investment, food, transport, shopping, other.
- Put the full, ready content in "content" (Markdown allowed). Write a clear "title".
- Only emit an action block when the user clearly asked to CREATE/SAVE/ADD something. For questions or discussion, do NOT emit an action — just answer.
- For debts and transactions, the app will ASK THE USER TO CONFIRM before saving, so it's safe to emit the action when they ask to add one.
- You may write a short natural sentence before the block (e.g. "تمام، حضّرت لك هذا:"). Never explain the JSON itself.

# HOW TO RESPOND
- Respond in ${langName}. If the user writes in Moroccan Darija, reply naturally in Darija.
- Be CONCRETE and SPECIFIC. Reference actual note titles, numbers, dates from the context.
- Structure with Markdown when it aids clarity, but stay concise.
- When asked to DO something, deliver the complete ready-to-use result.
- Never invent notes/data not in the context. If you lack info, say so and offer an alternative.
- Show real reasoning and insight — never generic filler like "I'm here to help!" or restating the question.`;
}

// ─── الدالة الأساسية ─────────────────────────────────────────────────
export async function callGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  if (!SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL missing in .env');
  }

  const {
    maxTokens = 1024,
    temperature = 0.7,
    history = [],
    systemInstruction,
    model,
    jsonMode = false,
    functionName = 'unknown',
    enableSearch = false,
    enableThinking = false,
  } = options;

  const lang = getCurrentLang();
  const resolvedSystem = systemInstruction ?? buildSystemInstruction(lang);

  const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const APP_TOKEN = import.meta.env.VITE_APP_TOKEN ?? '';

  const controller = new AbortController();
  // مهلة 60 ثانية: التفكير المتسلسل (thinkingBudget) + البحث في الإنترنت
  // + النموذج القوي قد تستغرق وقتاً أطول من 30s، فكانت تُسبب "تعذّر الاتصال"
  // رغم أن الخادم يعمل. 60s تعطي هامشاً آمناً دون انتظار مفرط.
  const timeoutId  = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(PROXY_ENDPOINT, {
      method : 'POST',
      signal : controller.signal,
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        ...(APP_TOKEN ? { 'x-app-token': APP_TOKEN } : {}),
      },
      body: JSON.stringify({
        prompt,
        maxTokens,
        temperature,
        history,
        systemInstruction: resolvedSystem,
        model,
        jsonMode,
        functionName,
        enableSearch,
        enableThinking,
      }),
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error('AI service timed out (30s). Check your network and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    // 429 = تجاوز الحصة المجانية (سواء حد البروكسي أو حد Gemini نفسه).
    // نرمي خطأً مُعرّفاً برمز QUOTA حتى تعرضه الواجهة برسالة ودّية بلغة المستخدم.
    if (res.status === 429) {
      const e = new Error('QUOTA_EXCEEDED') as Error & { code?: string };
      e.code = 'QUOTA_EXCEEDED';
      throw e;
    }
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini proxy error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data?.error) {
    if (data?.code === 'QUOTA_EXCEEDED') {
      const e = new Error('QUOTA_EXCEEDED') as Error & { code?: string };
      e.code = 'QUOTA_EXCEEDED';
      throw e;
    }
    throw new Error(data.error);
  }
  return data?.text ?? '';
}

// ═══════════════════════════════════════════════════════════════════════
// دوال الميزات — تدعم جميع اللغات تلقائياً
// ═══════════════════════════════════════════════════════════════════════

// ─── تلخيص ملاحظة ────────────────────────────────────────────────────
export async function geminiSummarize(
  title: string,
  content: string
): Promise<string> {
  const lang = getCurrentLang();
  return callGemini(
    `Summarize this note in 2 sentences in ${LANG_NAMES[lang]}. No preamble or commentary.\nTitle: ${title}\n${content.slice(0, 2000)}`,
    { maxTokens: 200, temperature: 0.4, model: 'gemini-3.1-flash-lite', functionName: 'summarize' }
  );
}

// ─── استخراج وسوم ─────────────────────────────────────────────────────
export async function geminiExtractTags(
  title: string,
  content: string
): Promise<string[]> {
  const lang = getCurrentLang();
  const raw = await callGemini(
    `Extract 3–6 meaningful tags in ${LANG_NAMES[lang]}.\nRespond with JSON only: ["tag1","tag2","tag3"]\nTitle: ${title}\n${content.slice(0, 1500)}`,
    { maxTokens: 100, temperature: 0.3, jsonMode: true, model: 'gemini-3.1-flash-lite', functionName: 'extract-tags' }
  );
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed)) return parsed.slice(0, 6).map(String);
  } catch {
    return raw
      .replace(/[[\]"']/g, '')
      .split(/[,\n]+/)
      .map(t => t.trim())
      .filter(t => t.length > 1)
      .slice(0, 6);
  }
  return [];
}

// ─── استخراج مهام ─────────────────────────────────────────────────────
export async function geminiExtractTasks(
  title: string,
  content: string
): Promise<{ task: string; done: boolean }[]> {
  const lang = getCurrentLang();
  const raw = await callGemini(
    `Extract actionable tasks in ${LANG_NAMES[lang]}.\nRespond with JSON only:\n[{"task":"...","done":false}]\nTitle: ${title}\n${content.slice(0, 2000)}`,
    { maxTokens: 400, temperature: 0.3, jsonMode: true, model: 'gemini-3.1-flash-lite', functionName: 'extract-tasks' }
  );
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed))
      return parsed
        .slice(0, 20)
        .map(i => ({ task: String(i.task ?? i), done: Boolean(i.done) }));
  } catch {
    return raw
      .split('\n')
      .filter(l => /^[-*•]/.test(l.trim()))
      .map(l => ({ task: l.replace(/^[-*•]\s*/, '').trim(), done: false }))
      .filter(t => t.task.length > 2)
      .slice(0, 15);
  }
  return [];
}

// ─── توليد مسودة ──────────────────────────────────────────────────────
export async function geminiGenerateDraft(
  rawText: string,
  style: 'professional' | 'friendly' | 'task' | 'message'
): Promise<string> {
  const lang = getCurrentLang();
  const styleDesc = {
    professional: 'formal and professional',
    friendly    : 'friendly and conversational',
    task        : 'structured task plan with headings and bullet points',
    message     : 'short message ready to send',
  }[style];

  return callGemini(
    `Transform the following text into ${styleDesc} style.\nWrite in ${LANG_NAMES[lang]} with Markdown.\n\n${rawText.slice(0, 1500)}`,
    { maxTokens: 800, temperature: 0.7, model: 'gemini-3.5-flash', functionName: 'generate-draft' }
  );
}

// ─── تفسير الأوامر الطبيعية ───────────────────────────────────────────
export async function geminiInterpretCommand(
  command: string,
  context: { noteCount: number; debtCount: number; taskCount: number }
): Promise<{ action: 'plan' | 'organize' | 'debt' | 'report' | 'draft' | 'unknown'; response: string }> {
  const lang = getCurrentLang();
  const raw = await callGemini(
    `You are Tahiro assistant.\nNotes: ${context.noteCount} | Debts: ${context.debtCount} | Tasks: ${context.taskCount}\nCommand: "${command}"\nRespond with JSON only (response text in ${LANG_NAMES[lang]}):\n{"action":"plan|organize|debt|report|draft|unknown","response":"short reply"}`,
    { maxTokens: 150, temperature: 0.3, jsonMode: true, model: 'gemini-3.1-flash-lite', functionName: 'interpret-command' }
  );
  try {
    const p = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      action  : (['plan','organize','debt','report','draft'].includes(p.action) ? p.action : 'unknown'),
      response: p.response ?? 'OK.',
    };
  } catch {
    return { action: 'unknown', response: 'Command saved as note.' };
  }
}

// ─── توليد تقرير إنتاجية ──────────────────────────────────────────────
export async function geminiGenerateReport(context: {
  noteCount   : number;
  tasksDone   : number;
  tasksTotal  : number;
  debtCount   : number;
  topTags     : string[];
  recentTitles: string[];
}): Promise<string> {
  const lang = getCurrentLang();
  return callGemini(
    `Generate a comprehensive productivity report in ${LANG_NAMES[lang]} with Markdown.\nNotes: ${context.noteCount} | Tasks done: ${context.tasksDone}/${context.tasksTotal} | Active debts: ${context.debtCount}\nTop tags: ${context.topTags.join(', ')}\nRecent notes: ${context.recentTitles.join(' | ')}\n\nRequired structure:\n## Tahiro AI Report\n### Productivity Score\n### Top Achievements\n### Areas for Improvement\n### Next Week Plan`,
    { maxTokens: 800, temperature: 0.6, model: 'gemini-3.5-flash', functionName: 'generate-report' }
  );
}

// ─── تحليل تفريغ الدماغ ──────────────────────────────────────────────
export async function geminiAnalyzeBrainDump(text: string): Promise<{
  urgentPriorities: string[];
  futureIdeas     : string[];
  anxietyRelief   : string;
}> {
  const lang = getCurrentLang();
  const raw = await callGemini(
    `Analyze this brain dump and classify it. Respond in ${LANG_NAMES[lang]}.\nRespond with JSON only:\n{"urgentPriorities":["..."],"futureIdeas":["..."],"anxietyRelief":"encouraging sentence"}\n\n${text.slice(0, 2000)}`,
    { maxTokens: 500, temperature: 0.6, jsonMode: true, model: 'gemini-3.5-flash', functionName: 'brain-dump' }
  );
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return {
      urgentPriorities: ['Review priorities manually'],
      futureIdeas     : ['Explore incoming ideas'],
      anxietyRelief   : 'One step a day is enough to make progress.',
    };
  }
}

// ─── محادثة ذكية مع سياق الملاحظات ──────────────────────────────────
export async function geminiChat(
  userMessage  : string,
  history      : GeminiMessage[],
  notesContext : string,
  options?: { enableSearch?: boolean }
): Promise<string> {
  return callGemini(
    `# USER'S CURRENT DATA\n${notesContext.slice(0, 6000)}\n\n# USER MESSAGE\n${userMessage}`,
    {
      maxTokens        : 2048,
      temperature      : 0.85,
      history,
      functionName     : 'chat',
      // "الأذكى دائماً": النموذج الأقوى + التفكير المتسلسل في كل محادثة
      model            : 'gemini-3.5-flash',
      enableThinking   : true,
      ...(options?.enableSearch ? { enableSearch: true } : {}),
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ميزات الذكاء الاصطناعي الإضافية
// ═══════════════════════════════════════════════════════════════════════

export async function geminiSuggestTitle(content: string): Promise<string> {
  const lang = getCurrentLang();
  const raw = await callGemini(
    `Suggest a concise and engaging title (max 5 words) in ${LANG_NAMES[lang]}.\nRespond with the title only, no quotes or explanation.\n\n${content.slice(0, 1000)}`,
    { maxTokens: 64, temperature: 0.6, model: 'gemini-3.1-flash-lite', functionName: 'suggest-title' }
  );
  return raw.replace(/["'\n]/g, '').trim();
}

export async function geminiExpandIdea(idea: string): Promise<string> {
  const lang = getCurrentLang();
  return callGemini(
    `Expand this short idea into a full, organized note in ${LANG_NAMES[lang]} with Markdown.\nIdea: ${idea}`,
    { maxTokens: 700, temperature: 0.75, model: 'gemini-3.5-flash', functionName: 'expand-idea' }
  );
}

export async function geminiSpellCheck(text: string): Promise<{
  corrected: string;
  changes  : string[];
}> {
  const lang = getCurrentLang();
  const raw = await callGemini(
    `Correct spelling and grammar errors in this ${LANG_NAMES[lang]} text.\nRespond with JSON only:\n{"corrected":"full corrected text","changes":["change 1","change 2"]}\n\n${text.slice(0, 2000)}`,
    { maxTokens: 800, temperature: 0.2, jsonMode: true, model: 'gemini-3.1-flash-lite', functionName: 'spell-check' }
  );
  try {
    const p = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      corrected: p.corrected ?? text,
      changes  : Array.isArray(p.changes) ? p.changes.slice(0, 10) : [],
    };
  } catch {
    return { corrected: text, changes: [] };
  }
}

export async function geminiAskAboutNote(
  question   : string,
  noteContent: string,
  noteTitle  : string
): Promise<string> {
  const lang = getCurrentLang();
  return callGemini(
    `Answer the following question in ${LANG_NAMES[lang]} based only on the attached note content.\nTitle: ${noteTitle}\nContent: ${noteContent.slice(0, 2000)}\n\nQuestion: ${question}`,
    { maxTokens: 400, temperature: 0.4, functionName: 'ask-about-note' }
  );
}

export async function geminiGenerateMeetingNotes(rawText: string): Promise<string> {
  const lang = getCurrentLang();
  return callGemini(
    `Convert this raw text into structured meeting notes in ${LANG_NAMES[lang]} with Markdown.\nStructure: ## Meeting / ### Attendees / ### Discussion Points / ### Decisions / ### Action Items\n\n${rawText.slice(0, 2000)}`,
    { maxTokens: 800, temperature: 0.5, model: 'gemini-3.5-flash', functionName: 'meeting-notes' }
  );
}

export async function geminiTranslate(
  text      : string,
  targetLang: 'en' | 'fr' | 'es' | 'ar' | 'zh'
): Promise<string> {
  const langMap: Record<string, string> = {
    en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic (العربية)', zh: 'Simplified Chinese (中文)',
  };
  return callGemini(
    `Translate this text to ${langMap[targetLang]}. Return only the translated text, no commentary.\n\n${text.slice(0, 2000)}`,
    { maxTokens: 1500, temperature: 0.3, model: 'gemini-3.5-flash', functionName: 'translate' }
  );
}

export async function geminiGenerateDebtMessage(
  personName: string,
  amount    : number,
  currency  : string,
  dueDate   : string,
  type      : 'credit' | 'debt'
): Promise<string> {
  const lang = getCurrentLang();
  const direction = type === 'credit'
    ? `${personName} owes you`
    : `You owe ${personName}`;
  return callGemini(
    `Write a polite reminder message in ${LANG_NAMES[lang]}.\n${direction} ${amount} ${currency}, due: ${dueDate}.\nThe message must be polite and concise (max 3 lines).`,
    { maxTokens: 150, temperature: 0.6, model: 'gemini-3.1-flash-lite', functionName: 'debt-message' }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// تحويل الصوت إلى نص (التدوين الصوتي) — يُرسل الصوت الحقيقي إلى Gemini
// بدل الاعتماد على Web Speech API غير الموثوقة داخل WebView.
// ═══════════════════════════════════════════════════════════════════════
export async function geminiTranscribeAudio(
  audioBase64  : string,
  audioMimeType: string
): Promise<string> {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL missing in .env');

  const lang = getCurrentLang();
  const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const APP_TOKEN = import.meta.env.VITE_APP_TOKEN ?? '';

  const prompt = `Transcribe the spoken audio faithfully and completely in ${LANG_NAMES[lang]}. ` +
    `If the speaker uses Moroccan Darija (الدارجة المغربية), transcribe it as spoken using Arabic script — ` +
    `do not translate it to Modern Standard Arabic. Output ONLY the transcript text, no commentary, no quotes.`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 45_000); // الصوت أبطأ من النص العادي

  let res: Response;
  try {
    res = await fetch(PROXY_ENDPOINT, {
      method : 'POST',
      signal : controller.signal,
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        ...(APP_TOKEN ? { 'x-app-token': APP_TOKEN } : {}),
      },
      body: JSON.stringify({
        prompt,
        maxTokens: 2048,
        temperature: 0.2,
        audioBase64,
        audioMimeType,
        functionName: 'transcribe-audio',
      }),
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error('AI service timed out (45s). Check your network and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    if (res.status === 429) {
      const e = new Error('QUOTA_EXCEEDED') as Error & { code?: string };
      e.code = 'QUOTA_EXCEEDED';
      throw e;
    }
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini proxy error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data?.error) {
    if (data?.code === 'QUOTA_EXCEEDED') {
      const e = new Error('QUOTA_EXCEEDED') as Error & { code?: string };
      e.code = 'QUOTA_EXCEEDED';
      throw e;
    }
    throw new Error(data.error);
  }
  return (data?.text ?? '').trim();
}

/**
 * يحوّل النص إلى صوت Gemini طبيعي حماسي. يُرجع base64 لبيانات صوت PCM
 * (و sampleRate). يرمي خطأً إن فشل (لا إنترنت/حصة) ليسقط المستدعي لمحرك
 * الجهاز. النموذج gemini-2.5-flash-preview-tts يفهم تعليمات الأسلوب،
 * فنطلب منه نبرة حماسية ودافئة.
 */
export async function geminiTextToSpeech(
  text: string,
  opts?: { voiceName?: string; style?: string }
): Promise<{ audioBase64: string; mimeType: string }> {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL missing in .env');
  const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const APP_TOKEN = import.meta.env.VITE_APP_TOKEN ?? '';

  // النبرة الحماسية: نوجّه النموذج بأسلوب القراءة قبل النص الفعلي
  const style = opts?.style ?? 'بنبرة حماسية ودافئة ومحفّزة، كأنك مدرّب ملهم';
  const voiceName = opts?.voiceName ?? 'Puck'; // Puck صوت حيوي مناسب للحماس

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(PROXY_ENDPOINT, {
      method : 'POST',
      signal : controller.signal,
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        ...(APP_TOKEN ? { 'x-app-token': APP_TOKEN } : {}),
      },
      body: JSON.stringify({
        prompt: `اقرأ ما يلي ${style}: ${text}`,
        ttsMode: true,
        voiceName,
        functionName: 'text-to-speech',
      }),
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error('TTS timed out');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini TTS error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  if (!data?.audioBase64) throw new Error('No audio returned');
  return { audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/L16;rate=24000' };
}
