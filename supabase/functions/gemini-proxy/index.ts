/**
 * supabase/functions/gemini-proxy/index.ts
 * ─────────────────────────────────────────────────────────────────────
 * Supabase Edge Function — بروكسي آمن لـ Gemini API
 *
 * آخر مراجعة: 21 أكتوبر 2026
 *
 * ═══════════════════════════════════════════════════════════════════
 *  ما تغيّر في هذه المراجعة، ولماذا
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1) خريطة أسماء (MODEL_ALIASES) — وهي أهمّ ما في الملف.
 *
 *    النسخ المثبَّتة على هواتف المستخدمين تطلب أسماء نماذج مكتوبة داخل
 *    حزمتها، ولا تتغيّر إلا بتحديث من المتجر — وكثير منهم لا يُحدّث
 *    شهوراً. فلو اكتفينا بتعديل قائمة السماح، لصار كل طلب من نسخة قديمة
 *    اسماً غير معروف → يسقط إلى النموذج الافتراضي **بصمت**.
 *
 *    الخريطة تترجم الاسم القديم إلى الحالي قبل أي شيء. فالنسخ القديمة
 *    تُرقّى فور نشر هذه الدالة، بلا أن ينتظر أحد تحديثاً.
 *
 * 2) النماذج تُؤخذ مما ثبت عملُه بهذا المفتاح، لا من صفحة التوثيق.
 *    جرى عكس ذلك مرّة فتعطّل الذكاء الاصطناعي كلّه: أسماء من التوثيق
 *    (3.8/3.6/3.5-lite) ليست متاحة لهذا المفتاح المجاني، فصار كل طلب
 *    طابورَ محاولات فاشلة حتى تجاوز مهلة العميل. التوثيق يصف ما لدى
 *    Google، لا ما يسمح به مفتاحٌ بعينه.
 *
 * 3) السقوط إلى نموذج احتياطي صار **مرئياً**: يُعاد في الرد
 *    (`fallback` و `requestedModel`) ويُكتب في السجل. سقوطٌ صامت يستمرّ
 *    شهوراً هو بالضبط ما حدث هنا، ولا يجوز أن يتكرّر.
 *
 * 4) سلسلتان بحسب ثقل المهمة بدل سلسلة واحدة. ولكلّ نموذج حصّته
 *    المجانية المستقلّة، فالسلسلة لا تحمي فحسب — بل تضاعف مجموع ما
 *    يمكن إنجازه مجاناً قبل أن يُرَدّ المستخدم.
 *
 * 5) تصحيح عطب كامن: شرط تفعيل البحث في الإنترنت كان مربوطاً بالاسم
 *    `gemini-3.5-flash` حرفياً. ومع تغيير النماذج كان البحث سيُنزَع من
 *    كل طلب بلا خطأ ولا أثر. صار البحث يُجرَّب على كل نموذج، ويُعاد
 *    الطلب بلا أدوات عند الرفض — فلا يُفقَد جواب ولا يُفقَد بحث.
 *
 * 6) نموذج الصوت: `gemini-2.5-flash-preview-tts` خرج من قائمة المدعوم
 *    → `gemini-3.8-flash-tts` مع سلسلة احتياطية، والتحقّق من اسم الصوت
 *    قبل الإرسال (اسم غير موجود يُفشل الطلب بلا سبب ظاهر).
 *
 * ─── عقد الرد مع التطبيق (لا يُكسَر) ─────────────────────────────────
 *   نجاح نصّي : { text, inputTokens, outputTokens, model, ... }
 *   نجاح صوتي : { audioBase64, mimeType }
 *   خطأ       : { error, code? }   — code='QUOTA_EXCEEDED' عند نفاد الحصّة
 * الحقول الإضافية يتجاهلها العميل بأمان، فالنسخ القديمة تعمل كما هي.
 *
 * النشر:
 *   supabase functions deploy gemini-proxy --no-verify-jwt
 *   (أو من لوحة Supabase — محرّر الكود ثم Deploy updates)
 *
 * المتغيرات البيئية (Supabase > Edge Functions > Secrets):
 *   GEMINI_API_KEY            = مفتاح Gemini من ai.google.dev
 *   APP_SHARED_SECRET         = اختياري — سرّ مشترك مع التطبيق
 *   SUPABASE_URL              = تلقائي
 *   SUPABASE_SERVICE_ROLE_KEY = تلقائي
 * ─────────────────────────────────────────────────────────────────────
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // apikey مطلوب: Supabase يُرسله مع كل طلب، وبدونه يفشل الـpreflight
  // فيُحجب كل طلب AI قادم من المتصفح.
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-app-token',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
/** واجهة Interactions — الطريق الموثَّق الحالي لتحويل النص إلى صوت. */
const GEMINI_INTERACTIONS = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// ═══════════════════════════════════════════════════════════════════════
//  النماذج
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ المصدر هنا هو **ما ثبت عملُه بهذا المفتاح**، لا صفحة التوثيق.
//
// جرى غير ذلك مرّة فكان خطأً مكلفاً: أُخذت أسماء نماذج من التوثيق
// الرسمي (3.8-flash و 3.6-flash و 3.5-flash-lite) ووُضعت مكان الاسمين
// اللذين كانا يعملان أربعة أشهر. والتوثيق يصف ما لدى Google، لا ما هو
// متاح لمفتاح مجاني بعينه — فصار كل طلب يمرّ بطابور محاولات فاشلة قبل
// أن يصل إلى نموذج حيّ، حتى تجاوز مهلة العميل فتعطّل الذكاء كلّه.
//
// والدليل القاطع جاء من ردّ الخادم نفسه:
//     {"model":"gemini-3.1-flash-lite","requestedModel":null,"fallback":true}
// أي أن النموذج الافتراضي المأخوذ من التوثيق سقط، ونجا الطلب بالقديم.
//
// فالقائمة الآن اسمان فقط، كلاهما مُختبَر. وأي اسم أحدث يُضاف هنا بعد
// أن يُثبته `scripts/` لا بعد أن يَرِد في صفحة.
// نتيجة الاختبار الفعلي بهذا المفتاح (21 أكتوبر 2026، scripts/models.sh):
//     ✅ gemini-3.6-flash        يعمل
//     ✅ gemini-3.1-flash-lite   يعمل
//     ❌ gemini-3.5-flash-lite   يسقط
//     ❓ gemini-3.8-flash / gemini-3.5-flash   بلا ردّ
// فالقائمة هي المُثبَت وحده. و 3.6-flash أقوى من 3.1-flash-lite، فصار
// هو نموذج المهام الثقيلة — وهذه ترقية حقيقية مسنودة بقياس لا بصفحة.
const ALLOWED_MODELS = [
  'gemini-3.6-flash',       // الأقوى بين المُختبَرين
  'gemini-3.1-flash-lite',  // الأسرع، وخطّ الأمان الأخير
] as const;
type GeminiModel = (typeof ALLOWED_MODELS)[number];

/**
 * خريطة الأسماء القديمة → الحالية.
 *
 * ⚠️ هذه الخريطة هي ما يجعل تحديث الخادم آمناً وحده.
 *
 * النسخة المثبَّتة على هاتف المستخدم تحمل أسماء النماذج داخلها. وهي لا
 * تتغيّر إلا حين يُحدِّث من المتجر — وقد لا يفعل شهوراً. فبلا هذه
 * الخريطة، كل طلب من كل نسخة قديمة يصير اسماً مجهولاً يسقط إلى
 * الافتراضي بصمت.
 *
 * ومعها: تُرقّى كل النسخ المثبَّتة لحظة نشر هذه الدالة.
 *
 * أي اسم يُحذف من ALLOWED_MODELS مستقبلاً يجب أن يُضاف هنا — لا أن
 * يُحذف فحسب.
 */
const MODEL_ALIASES: Record<string, GeminiModel> = {
  // الاسم الذي يطلبه التطبيق في 8 مواضع — ثبت أنه بلا ردّ، فيُوجَّه
  // إلى 3.6-flash المُختبَر. وهذا وحده يرفع جودة كل ردود المحادثة.
  'gemini-3.5-flash': 'gemini-3.6-flash',
  // أسماء أحدث أو غير متاحة لهذا المفتاح
  'gemini-3.8-flash': 'gemini-3.6-flash',
  'gemini-3.5-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-3-flash-preview': 'gemini-3.1-flash-lite',
  'gemini-3.1-flash': 'gemini-3.6-flash',
  // جيل 2.5 — ما زال يُطلَب من نسخ بعيدة مثبَّتة على الهواتف
  'gemini-2.5-flash': 'gemini-3.6-flash',
  'gemini-2.5-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-2.5-pro': 'gemini-3.6-flash',
  // جيل 2.0 — أُغلق في 1 يونيو 2026
  'gemini-2.0-flash': 'gemini-3.1-flash-lite',
  'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
  // مدفوعة: نخفضها لأقوى مجاني بدل أن نردّ المستخدم خائباً
  'gemini-3.1-pro-preview': 'gemini-3.6-flash',
  'gemini-4-argon': 'gemini-3.6-flash',
};

/** الافتراضي: المُثبَت حيّاً بنداء مباشر. */
const DEFAULT_MODEL: GeminiModel = 'gemini-3.1-flash-lite';

/**
 * سلسلتان بحسب ثقل المهمة.
 *
 * لكلّ نموذج حصّة مجانية مستقلّة. فحين تنفد حصّة الأوّل، التالي يبدأ
 * بحصّة كاملة — أي أن السلسلة ترفع سقف ما يُنجَز مجاناً، لا أن تحمي
 * من العطل فحسب. ولذلك تُرتَّب نزولاً من الأقوى إلى الأخفّ: المستخدم
 * يحصل على أفضل ما يمكن، ثم على شيءٍ يعمل، بدل أن يُرَدّ خائباً.
 */
const CHAIN_HEAVY: GeminiModel[] = ['gemini-3.6-flash', 'gemini-3.1-flash-lite'];
const CHAIN_LIGHT: GeminiModel[] = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];

/** نماذج تحويل النص إلى صوت، مرتَّبة. */
const TTS_CHAIN = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.1-flash-tts-preview',
];

/**
 * أصوات Gemini المسبقة (30 صوتاً، التوثيق الرسمي).
 *
 * التحقّق ضروري: اسم صوت غير موجود يجعل Gemini يرفض الطلب، فيسقط
 * النطق إلى محرّك الجهاز بلا أن يفهم أحد السبب. واسمٌ مكتوب بحالة أحرف
 * مختلفة هو اسم غير موجود.
 */
const VALID_VOICES = new Set([
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
  'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
  'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
  'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
]);
const DEFAULT_VOICE = 'Gacrux'; // موصوف رسمياً بـ Mature — صوت راشد

const RATE_LIMIT_PER_HOUR = 60;

/**
 * يترجم ما طلبه العميل إلى نموذج صالح.
 * الترتيب مقصود: الخريطة أولاً (فالاسم القديم له مقابل محدَّد)، ثم
 * قائمة السماح، ثم الافتراضي.
 */
function resolveModel(requested?: string): GeminiModel {
  if (!requested) return DEFAULT_MODEL;
  const aliased = MODEL_ALIASES[requested];
  if (aliased) return aliased;
  if ((ALLOWED_MODELS as readonly string[]).includes(requested)) {
    return requested as GeminiModel;
  }
  return DEFAULT_MODEL;
}

/** المهام الثقيلة تستحقّ البدء من الأقوى. */
function isHeavyTask(model: GeminiModel, enableThinking: boolean, hasAudio: boolean): boolean {
  if (hasAudio) return true;             // التدوين الصوتي يحتاج دقّة
  if (enableThinking) return true;        // المحادثة العميقة
  return model === 'gemini-3.6-flash';
}

interface RequestBody {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  systemInstruction?: string;
  model?: string;         // نصّ حرّ عمداً: الأسماء القديمة تمرّ عبر الخريطة
  jsonMode?: boolean;
  functionName?: string;
  enableSearch?: boolean;
  enableThinking?: boolean;
  audioBase64?: string;
  ttsMode?: boolean;
  voiceName?: string;
  audioMimeType?: string;
  /**
   * أسلوب الإلقاء — عبارة قصيرة ("حماسي ودافئ").
   * ⚠️ حقل مستقلّ عمداً: كتابته داخل النصّ تجعل النموذج ينطقه بدل أن
   * يطبّقه، وهو عطب حقيقي وقع في هذا التطبيق.
   */
  style?: string;
}

/** تشفير IP لحماية الخصوصية — لا يُخزَّن عنوان حقيقي أبداً. */
async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + 'notic-tahiro-salt-2025');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });

serve(async (req: Request) => {
  // ─── Preflight CORS ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ─── التحقق من مفتاح Gemini ──────────────────────────────────────
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.error('[gemini-proxy] GEMINI_API_KEY is not set');
    return json({ error: 'AI service not configured' }, 503);
  }

  // ─── حماية اختيارية بسرّ مشترك ────────────────────────────────────
  // إن ضُبط APP_SHARED_SECRET يُرفض أي طلب لا يحمله في x-app-token.
  // السرّ داخل التطبيق قابل للاستخراج نظرياً، لكنه يرفع العتبة كثيراً
  // ضدّ استهلاك حصّة Gemini عبر الرابط المباشر.
  const APP_SHARED_SECRET = Deno.env.get('APP_SHARED_SECRET');
  if (APP_SHARED_SECRET && req.headers.get('x-app-token') !== APP_SHARED_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ─── قراءة الجسم ──────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    prompt,
    maxTokens = 1024,
    temperature = 0.7,
    history = [],
    systemInstruction,
    model,
    jsonMode = false,
    functionName = 'unknown',
    audioBase64,
    audioMimeType,
    ttsMode = false,
    voiceName,
    enableSearch = false,
    enableThinking = false,
  } = body;

  // الطلب الصوتي لا يحتاج prompt نصياً
  if (!prompt?.trim() && !audioBase64) {
    return json({ error: 'prompt is required' }, 400);
  }

  // حدّ حجم الصوت — حماية من تجاوز حدّ 20MB لطلبات Gemini inline
  if (audioBase64 && audioBase64.length > 18_000_000) {
    return json({ error: 'Audio file too large (max ~13MB)' }, 413);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  فرع تحويل النص إلى صوت (Gemini TTS)
  // ═══════════════════════════════════════════════════════════════════
  if (ttsMode) {
    // اسم صوت غير موجود يُفشل الطلب بلا سبب ظاهر للمستخدم — نتحقّق أولاً
    const voice = voiceName && VALID_VOICES.has(voiceName) ? voiceName : DEFAULT_VOICE;
    if (voiceName && !VALID_VOICES.has(voiceName)) {
      console.warn(`[gemini-proxy] voice "${voiceName}" unknown → using ${DEFAULT_VOICE}`);
    }

    /**
     * ⚠️ الأسلوب لا يُكتب داخل النصّ أبداً.
     *
     * هذا كان العطب: التطبيق كان يرسل
     *     `اقرأ ما يلي ${style}: ${text}`
     * ونموذج TTS — بنصّ التوثيق — «يعامل حقل text كنصّ حرفي». فكان
     * يقرأ التعليمة نفسها بصوتٍ عالٍ قبل الملاحظة: «اقرأ ما يلي بنبرة
     * حماسية…». التوجيه لم يكن يُطبَّق، كان يُنطَق.
     *
     * محلّه الصحيح: annotation من نوع speech_metadata بجانب النصّ.
     * والتوثيق يحذّر أيضاً من فقرات الأسلوب الطويلة ("Audio Profile")
     * لأنها تُحدث انحراف صوت — فالأسلوب هنا عبارة قصيرة لا فقرة.
     */
    const styleHint = (body.style ?? '').trim().slice(0, 120);

    /**
     * ⚠️ نطلب audio/l16 لا audio/wav عمداً.
     *
     * الواجهة الجديدة تُرجع WAV افتراضياً، بينما التطبيق المثبَّت يستقبل
     * PCM خاماً ويبنيه WAV بنفسه (pcmToWavDataUrl). فطلب WAV هنا يعني
     * أن التطبيق يلفّ ملفاً جاهزاً مرّة ثانية — فيخرج صوت تالف، ولا
     * يُصلحه إلا تحديثٌ من المتجر ينتظره المستخدمون شهوراً.
     * وبطلب l16 يبقى عقد الصوت كما هو، ويستفيد كلّ مَن ثبّت التطبيق
     * من الإصلاح فوراً.
     */
    const interactionsPayload = (ttsModel: string) => JSON.stringify({
      model: ttsModel,
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text: prompt,
          ...(styleHint
            ? { annotations: [{ type: 'speech_metadata', style: styleHint }] }
            : {}),
        }],
      }],
      response_format: { type: 'audio', mime_type: 'audio/l16' },
      generation_config: { speech_config: [{ voice }] },
    });

    /** الشكل القديم — يبقى كشبكة أمان إن رفضت الواجهة الجديدة النموذج. */
    const legacyPayload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    });

    /** يستخرج بيانات الصوت من ردّ Interactions: steps[] → content[] → data */
    const extractInteractionAudio = (d: unknown): string | null => {
      const steps = (d as { steps?: unknown[] })?.steps;
      if (!Array.isArray(steps)) return null;
      for (const step of steps) {
        const s = step as { type?: string; content?: unknown[] };
        if (s?.type !== 'model_output' || !Array.isArray(s.content)) continue;
        for (const c of s.content) {
          const item = c as { type?: string; data?: string };
          if (item?.type === 'audio' && typeof item.data === 'string') return item.data;
        }
      }
      return null;
    };

    let lastTtsStatus = 0;
    let lastTtsErr = '';

    // نموذج صوت واحد يُغلق لا يجب أن يُسكت الميزة كلّها — نفس منطق
    // السلسلة في الفرع النصّي.
    for (const ttsModel of TTS_CHAIN) {
      // ── المحاولة الأولى: الواجهة الموثَّقة الحالية (تدعم الأسلوب) ──
      try {
        const res = await fetch(GEMINI_INTERACTIONS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: interactionsPayload(ttsModel),
        });

        if (res.ok) {
          const audioData = extractInteractionAudio(await res.json());
          if (audioData) {
            return json({
              audioBase64: audioData,
              // ثابت عمداً: التطبيق يقرأ معدّل العيّنات من هنا.
              mimeType: 'audio/L16;rate=24000',
              model: ttsModel,
              voice,
              style: styleHint || null,
              api: 'interactions',
            });
          }
          lastTtsStatus = 502;
          lastTtsErr = 'interactions: no audio block in steps';
          console.warn(`[gemini-proxy] TTS ${ttsModel} interactions → ok but empty`);
        } else {
          lastTtsStatus = res.status;
          lastTtsErr = await res.text().catch(() => '');
          console.warn(`[gemini-proxy] TTS ${ttsModel} interactions → ${res.status}`);
          if (res.status === 401 || res.status === 403) break;
        }
      } catch (e) {
        lastTtsStatus = 502;
        lastTtsErr = String(e);
        console.error(`[gemini-proxy] TTS ${ttsModel} interactions error:`, e);
      }

      // ── شبكة الأمان: الشكل القديم (بلا أسلوب، لكن بصوت يعمل) ──
      try {
        const res = await fetch(
          `${GEMINI_API_BASE}/${ttsModel}:generateContent?key=${GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: legacyPayload },
        );

        if (res.ok) {
          const d = await res.json();
          const part = d?.candidates?.[0]?.content?.parts?.[0];
          const audioData = part?.inlineData?.data;
          if (audioData) {
            return json({
              audioBase64: audioData,
              mimeType: part?.inlineData?.mimeType ?? 'audio/L16;rate=24000',
              model: ttsModel,
              voice,
              style: null, // الشكل القديم لا يحمل الأسلوب
              api: 'generateContent',
            });
          }
          lastTtsStatus = 502;
          lastTtsErr = 'legacy: no inlineData';
        } else {
          lastTtsStatus = res.status;
          lastTtsErr = await res.text().catch(() => '');
          console.warn(`[gemini-proxy] TTS ${ttsModel} legacy → ${res.status}, trying next model...`);
          if (res.status === 401 || res.status === 403) break;
        }
      } catch (e) {
        lastTtsStatus = 502;
        lastTtsErr = String(e);
        console.error(`[gemini-proxy] TTS ${ttsModel} legacy error:`, e);
      }
    }

    const ttsQuota = lastTtsStatus === 429 || /RESOURCE_EXHAUSTED|quota/i.test(lastTtsErr);
    console.error('[gemini-proxy] all TTS models failed:', lastTtsStatus, lastTtsErr.slice(0, 200));
    return json(
      ttsQuota
        ? { error: 'AI quota reached. Please try again in a minute.', code: 'QUOTA_EXCEEDED' }
        : { error: `TTS error ${lastTtsStatus || 502}` },
      ttsQuota ? 429 : (lastTtsStatus || 502),
      ttsQuota ? { 'Retry-After': '60' } : {},
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  الفرع النصّي
  // ═══════════════════════════════════════════════════════════════════

  // الصوت يُفرَض على الأقوى: دقّة التدوين تفرق أكثر من سرعته.
  const requestedModel = audioBase64 ? 'gemini-3.6-flash' : model;
  const selectedModel = resolveModel(requestedModel);

  // ─── Supabase Admin Client ────────────────────────────────────────
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let supabase: ReturnType<typeof createClient> | null = null;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  // ─── فحص معدل الطلبات ────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await hashIP(ip);

  if (supabase) {
    try {
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count } = await supabase
        .from('ai_requests')
        .select('*', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', oneHourAgo);

      if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
        return json(
          { error: 'Rate limit exceeded. Please try again later.' },
          429,
          { 'Retry-After': '600' },
        );
      }
    } catch (e) {
      // فشل الفحص لا يوقف الطلب: حدّ معدّل معطّل خير من خدمة معطّلة
      console.warn('[gemini-proxy] rate limit check failed:', e);
    }
  }

  // ─── بناء محتوى Gemini ────────────────────────────────────────────
  // contents يجب أن تبدأ بدور user — سلسلة تبدأ بـ model ترجع 400
  const cleanHistory = (() => {
    const h = history.filter(m => m?.content?.trim());
    while (h.length && h[0].role !== 'user') h.shift();
    return h;
  })();

  const contents = [
    ...cleanHistory.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] })),
    {
      role: 'user',
      parts: [
        ...(prompt?.trim() ? [{ text: prompt }] : []),
        ...(audioBase64 && audioMimeType
          ? [{ inlineData: { mimeType: audioMimeType, data: audioBase64 } }]
          : []),
      ],
    },
  ];

  const geminiPayload: Record<string, unknown> = {
    contents,
    generationConfig: {
      // 8192: السقف الأقدم (2048) كان يكفي جواباً عن ملاحظة لكنه يبتر
      // أي شرح معمّق أو كود. والقصّ يقع هنا في الخادم، فرفعه في التطبيق
      // وحده لا يغيّر شيئاً.
      maxOutputTokens: Math.min(maxTokens, 8192),
      temperature: Math.max(0, Math.min(temperature, 1)),
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      // التفكير المتسلسل للمحادثة العميقة فقط. للمهام الصغيرة (عنوان،
      // وسوم، استخراج) نُبقيه صفراً: يُنتج ردوداً فارغة ويهدر الحصّة.
      thinkingConfig: { thinkingBudget: enableThinking ? 2048 : 0 },
    },
  };

  if (systemInstruction) {
    geminiPayload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  // البحث في الإنترنت — عند الطلب فقط: يستهلك حصّة أعلى ويُبطئ الرد.
  if (enableSearch && !audioBase64) {
    geminiPayload.tools = [{ googleSearch: {} }];
  }

  // ─── الاستدعاء مع سلسلة احتياطية ──────────────────────────────────
  const chain = isHeavyTask(selectedModel, enableThinking, Boolean(audioBase64))
    ? CHAIN_HEAVY
    : CHAIN_LIGHT;
  const tryOrder: GeminiModel[] = [
    selectedModel,
    ...chain.filter(m => m !== selectedModel),
  ];

  let geminiRes: Response | null = null;
  let usedModel: GeminiModel = selectedModel;
  let usedGrounding = false;
  let lastStatus = 0;
  let lastErrText = '';

  const { tools: _tools, ...payloadNoTools } = geminiPayload;
  const wantsTools = Boolean(_tools);

  /**
   * ⚠️ البحث يُجرَّب على كل نموذج، لا على قائمة أسماء مكتوبة سلفاً.
   *
   * كانت القائمة الثابتة عطباً حقيقياً: حين تغيّرت أسماء النماذج صار
   * النموذج الذي يخدم فعلاً خارجها، فتُنزَع أدوات البحث من كل طلب —
   * وينجح الطلب بلا بحث، بلا خطأ ولا أثر. أي أن زرّ البحث كان يبدو
   * مشتعلاً ولا يبحث.
   *
   * وهنا: نُجرّب مع الأدوات، فإن رفضها النموذج أعدنا الطلب نفسه بلا
   * أدوات فوراً. فلا نخسر الجواب أبداً، ولا نخسر البحث حيث يُدعَم —
   * وما يُدعَم يُكتشَف بالتجربة لا بقائمة تتقادم.
   */
  for (const candidateModel of tryOrder) {
    const url = `${GEMINI_API_BASE}/${candidateModel}:generateContent?key=${GEMINI_API_KEY}`;
    const attempts: Array<{ body: Record<string, unknown>; grounded: boolean }> = wantsTools
      ? [{ body: geminiPayload, grounded: true }, { body: payloadNoTools, grounded: false }]
      : [{ body: payloadNoTools, grounded: false }];

    let modelDone = false;

    for (const attempt of attempts) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt.body),
        });

        if (res.ok) {
          geminiRes = res;
          usedModel = candidateModel;
          usedGrounding = attempt.grounded;
          modelDone = true;
          break;
        }

        lastStatus = res.status;
        lastErrText = await res.text().catch(() => '');
        console.warn(
          `[gemini-proxy] ${candidateModel}${attempt.grounded ? ' +search' : ''} → ${res.status}`,
        );
        // مفتاح خاطئ: لا الأدوات ولا النموذج التالي سيُغيّران شيئاً
        if (res.status === 401 || res.status === 403) { modelDone = true; break; }
      } catch (fetchErr) {
        console.error(`[gemini-proxy] ${candidateModel} fetch error:`, fetchErr);
        lastStatus = 502;
      }
    }

    if (geminiRes || modelDone) break;
  }

  if (!geminiRes) {
    console.error('[gemini-proxy] all models failed:', lastStatus, lastErrText.slice(0, 200));
    const isQuota = lastStatus === 429 || /RESOURCE_EXHAUSTED|quota/i.test(lastErrText);
    return json(
      isQuota
        ? { error: 'AI quota reached. Please try again in a minute.', code: 'QUOTA_EXCEEDED' }
        : { error: `Gemini API error: ${lastStatus || 502}`, code: 'UPSTREAM_ERROR' },
      isQuota ? 429 : (lastStatus || 502),
      isQuota ? { 'Retry-After': '60' } : {},
    );
  }

  const geminiData = await geminiRes.json();
  // دمج كل الأجزاء مع استبعاد أجزاء "التفكير" — وإلا تسرّب تفكير النموذج
  // إلى نصّ الجواب.
  const parts: Array<{ text?: string; thought?: boolean }> =
    geminiData?.candidates?.[0]?.content?.parts ?? [];
  const text: string = parts.filter(p => !p.thought).map(p => p.text ?? '').join('');
  const inputTokens: number = geminiData?.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens: number = geminiData?.usageMetadata?.candidatesTokenCount ?? 0;

  // ⚠️ السقوط إلى نموذج آخر يُسجَّل صراحةً.
  // كان يقع بلا أثر، فظلّ التطبيق يعمل بأضعف نموذج شهوراً بلا أن يُكتشف.
  const didFallback = usedModel !== selectedModel;
  if (didFallback) {
    console.warn(
      `[gemini-proxy] FALLBACK: requested="${requestedModel ?? 'default'}" ` +
      `resolved="${selectedModel}" used="${usedModel}" fn="${functionName}"`,
    );
  }

  // ─── تسجيل الطلب ─────────────────────────────────────────────────
  // ⚠️ أعمدة الجدول كما هي بالضبط. عمود جديد غير موجود يُفشل الإدراج،
  // فنفقد كل سجلّ التشخيص — وهو تحديداً ما نحتاجه لتتبّع هذه المشكلة.
  if (supabase) {
    try {
      await supabase.from('ai_requests').insert({
        model: usedModel,
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        ip_hash: ipHash,
        function_name: didFallback ? `${functionName}:fallback` : functionName,
      });
    } catch (e) {
      console.warn('[gemini-proxy] log insert failed:', e);
    }
  }

  return json({
    text,
    inputTokens,
    outputTokens,
    model: usedModel,
    // حقول تشخيصية — يتجاهلها العميل القديم بأمان
    requestedModel: requestedModel ?? null,
    fallback: didFallback,
    // ⚠️ القيمة الحقيقية لا المرجوّة: إن رفض النموذج أدوات البحث وأُعيد
    // الطلب بلا أدوات، فالجواب بلا بحث — ويجب أن يُقال لا أن يُفترَض.
    grounded: usedGrounding,
  });
});
