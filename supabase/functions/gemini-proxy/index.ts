/**
 * supabase/functions/gemini-proxy/index.ts
 * ─────────────────────────────────────────────────────────────────────
 * Supabase Edge Function — بروكسي آمن لـ Gemini API (النسخة المحسّنة)
 *
 * الجديد في هذه النسخة (يونيو 2026):
 *  - تحديث النماذج: gemini-2.0-flash أُغلق في 1 يونيو 2026 ← تم الإصلاح
 *  - سلسلة fallback ذكية من 4 نماذج مجانية مرتّبة من الأفضل للاحتياطي:
 *      1. gemini-3.1-flash-lite  ← الأحدث (Gemini 3)، مجاني، أسرع
 *      2. gemini-2.5-flash       ← الجيل الثاني، مجاني، متوازن
 *      3. gemini-2.5-flash-lite  ← احتياطي مجاني أول
 *      4. gemini-3-flash-preview ← احتياطي مجاني ثانٍ
 *  - دعم systemInstruction (نظام التعليمات)
 *  - تحديد معدل الطلبات (60 طلب/ساعة/IP)
 *  - تسجيل الطلبات في جدول ai_requests
 *  - دعم وضع JSON المنظّم
 *  - معالجة QUOTA_EXCEEDED برسالة واضحة + Retry-After
 *
 * النشر في Termux:
 *   supabase functions deploy gemini-proxy --no-verify-jwt
 *
 * المتغيرات البيئية (Supabase Dashboard > Settings > Edge Functions):
 *   GEMINI_API_KEY           = مفتاح Gemini من ai.google.dev
 *   SUPABASE_URL             = تلقائي من Supabase
 *   SUPABASE_SERVICE_ROLE_KEY = تلقائي من Supabase
 * ─────────────────────────────────────────────────────────────────────
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // إضافة apikey — مطلوب لأن Supabase يرسل هذا الـ header مع كل طلب
  // بدونه يفشل الـ CORS preflight ويُحجب كل طلب AI من المتصفح
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-app-token',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// ⚠️ gemini-2.0-* و gemini-1.5-* أُغلقت نهائياً (يونيو 2026) — كل طلب لها يرجع 404
// سلسلة fallback: إذا فشل نموذج نجرب التالي تلقائياً (حماية من دورات إغلاق Google)
// ─── النماذج المدعومة (يونيو 2026) ────────────────────────────────────
//
//  ✅ مجاني بالكامل (مع حدود معدّل):
//     gemini-3.1-flash-lite   ← الأحدث من جيل 3، أسرع، حدود مجانية أعلى
//     gemini-2.5-flash         ← جيل 2.5، متوازن، موثوق
//     gemini-2.5-flash-lite    ← جيل 2.5، الأخف
//     gemini-3-flash-preview   ← جيل 3 Flash (معاينة، مجاني)
//
//  ❌ أُغلق نهائياً (1 يونيو 2026):
//     gemini-2.0-flash / gemini-2.0-flash-lite ← لا تستخدم (404)
//
//  💰 مدفوع فقط (لا طبقة مجانية في API):
//     gemini-3.1-pro-preview
//
// ─── نماذج الجيل 3 النشطة الحالية (كما تظهر في تطبيق Gemini — يونيو 2026) ─
//
//  ✅ مجاني مع حدود:
//     gemini-3.1-flash-lite   ← "3.1 Flash-Lite" في التطبيق — الأسرع والأرخص
//     gemini-3.5-flash        ← "3.5 Flash" في التطبيق — متوازن وقوي
//
//  ❌ مدفوع فقط (لا طبقة مجانية):
//     gemini-3.1-pro-preview  ← "3.1 Pro" في التطبيق — لا نستخدمه
//
//  ❌ موقوف / قديم — لا تستخدم:
//     gemini-2.5-flash / gemini-2.5-flash-lite (جيل سابق)
//     gemini-2.0-flash* (أُغلق 1 يونيو 2026 — يُعطي 404)
//
const ALLOWED_MODELS = [
  'gemini-3.1-flash-lite',  // "3.1 Flash-Lite" — الافتراضي، الأسرع مجاناً
  'gemini-3.5-flash',       // "3.5 Flash"       — للمهام الثقيلة والإبداعية
] as const;
type GeminiModel = (typeof ALLOWED_MODELS)[number];

// الافتراضي: 3.1 Flash-Lite — أسرع وأرخص للمهام اليومية الخفيفة
const DEFAULT_MODEL: GeminiModel = 'gemini-3.1-flash-lite';

// سلسلة fallback: إن نفدت حصة 3.1-flash-lite يتحوّل لـ 3.5-flash تلقائياً
const FALLBACK_CHAIN: GeminiModel[] = [
  'gemini-3.1-flash-lite',  // أولاً: الأسرع
  'gemini-3.5-flash',       // ثانياً: الأقوى
];
const RATE_LIMIT_PER_HOUR = 60;

interface RequestBody {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  systemInstruction?: string;
  model?: GeminiModel;
  jsonMode?: boolean; // إذا true يطلب رد JSON فقط
  functionName?: string; // اسم الدالة للتتبع في السجلات
  enableSearch?: boolean; // إذا true يُفعّل Google Search Grounding للبحث الفعلي في الإنترنت
  enableThinking?: boolean; // إذا true يُفعّل التفكير المتسلسل (ردود أعمق، حصة أعلى)
  // ─── دعم تحويل الصوت إلى نص (تدوين صوتي) ───────────────────────
  audioBase64?: string;  // الصوت المُرمَّز base64 (بدون رأس data: ...)
  ttsMode?: boolean;     // طلب تحويل نص → صوت (Gemini TTS)
  voiceName?: string;    // اسم الصوت (Puck, Kore...)
  audioMimeType?: string; // مثال: audio/webm, audio/mp4, audio/wav
}

// تشفير IP لحماية الخصوصية
async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + 'notic-tahiro-salt-2025');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  // ─── Preflight CORS ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── التحقق من مفتاح Gemini ──────────────────────────────────────
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.error('[gemini-proxy] GEMINI_API_KEY is not set');
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── حماية اختيارية بسرّ مشترك ────────────────────────────────────
  // إذا ضُبط APP_SHARED_SECRET في أسرار الدالة، يُرفض أي طلب لا يحمله في
  // الترويسة x-app-token. إن لم يُضبط: السلوك الحالي بلا أي تغيير.
  // (ملاحظة: السر داخل تطبيق الواجهة قابل للاستخراج نظرياً، لكنه يرفع
  //  العتبة كثيراً ضد الاستهلاك العشوائي لحصة Gemini عبر الرابط المباشر.)
  const APP_SHARED_SECRET = Deno.env.get('APP_SHARED_SECRET');
  if (APP_SHARED_SECRET && req.headers.get('x-app-token') !== APP_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── قراءة الجسم ──────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
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
    voiceName = 'Puck',
    enableSearch = false,
    enableThinking = false,
  } = body;

  // الطلب الصوتي لا يحتاج prompt نصياً (قد يكون فارغاً أو تعليمات قصيرة)
  if (!prompt?.trim() && !audioBase64) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // حد أقصى لحجم الصوت — حماية من تجاوز حد 20MB لطلبات Gemini inline
  if (audioBase64 && audioBase64.length > 18_000_000) {
    return new Response(JSON.stringify({ error: 'Audio file too large (max ~13MB)' }), {
      status: 413,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── فرع تحويل النص إلى صوت (Gemini TTS) ──────────────────────────
  // يستخدم نموذج TTS المخصص ويُرجع صوت PCM (base64). التطبيق يحوّله لـ WAV.
  if (ttsMode) {
    const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
    const ttsUrl = `${GEMINI_API_BASE}/${TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const ttsRes = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
          },
        }),
      });
      if (!ttsRes.ok) {
        const errText = await ttsRes.text().catch(() => '');
        console.error('[gemini-proxy] TTS error:', ttsRes.status, errText.slice(0, 200));
        return new Response(JSON.stringify({ error: `TTS error ${ttsRes.status}` }), {
          status: ttsRes.status, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const ttsData = await ttsRes.json();
      const part = ttsData?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType ?? 'audio/L16;rate=24000';
      if (!audioData) {
        return new Response(JSON.stringify({ error: 'No audio returned from TTS' }), {
          status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ audioBase64: audioData, mimeType }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('[gemini-proxy] TTS exception:', e);
      return new Response(JSON.stringify({ error: 'TTS request failed' }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ─── تحديد النموذج الآمن ──────────────────────────────────────────
  // طلبات الصوت تُفرَض دائماً على gemini-3.5-flash (الأقوى) لضمان دقة
  // التحويل، بصرف النظر عن النموذج المطلوب من العميل.
  const selectedModel: GeminiModel = audioBase64
    ? 'gemini-3.5-flash'
    : (model && ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL);

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
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      // لا نوقف الطلب إذا فشل الفحص
      console.warn('[gemini-proxy] rate limit check failed:', e);
    }
  }

  // ─── بناء محتوى Gemini ────────────────────────────────────────────
  // تنظيف التاريخ: يجب أن تبدأ contents بدور user (سلسلة تبدأ بـ model ترجع 400)
  const cleanHistory = (() => {
    const h = history.filter(m => m?.content?.trim());
    while (h.length && h[0].role !== 'user') h.shift();
    return h;
  })();

  const contents = [
    ...cleanHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [
        ...(prompt?.trim() ? [{ text: prompt }] : []),
        // إن وُجد صوت، يُرفق كـ inlineData — Gemini يفهم ويُترجم الكلام مباشرة
        ...(audioBase64 && audioMimeType
          ? [{ inlineData: { mimeType: audioMimeType, data: audioBase64 } }]
          : []),
      ],
    },
  ];

  const geminiPayload: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(maxTokens, 2048),
      temperature: Math.max(0, Math.min(temperature, 1)),
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      // التفكير المتسلسل: للمحادثة الذكية (enableThinking) نمنح ميزانية
      // تفكير حقيقية فتكون الردود أعمق وأكثر منطقية. للمهام الصغيرة
      // (عنوان/وسوم/استخراج) نُبقيه 0 لتفادي ردود فارغة وهدر الحصة.
      thinkingConfig: { thinkingBudget: enableThinking ? 2048 : 0 },
    },
  };

  // نظام التعليمات — يجعل الردود أكثر دقة وتخصصاً
  if (systemInstruction) {
    geminiPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // ─── Google Search Grounding (بحث في الإنترنت) ──────────────────────
  // يُفعَّل فقط عند enableSearch=true من العميل — لا نُفعّله دائماً لأنه
  // يستهلك حصة أعلى ويُبطئ الرد، ويجب أن يكون النموذج gemini-3.5-flash
  // أو أحدث (gemini-3.1-flash-lite لا يدعم grounding بالمجان).
  if (enableSearch && !audioBase64) {
    geminiPayload.tools = [{ googleSearch: {} }];
  }

  // ─── استدعاء Gemini مع fallback تلقائي بين النماذج ─────────────────
  // النموذج المطلوب أولاً، ثم بقية السلسلة عند 404/400 (نموذج مُغلق أو غير متاح)
  const tryOrder: GeminiModel[] = [
    selectedModel,
    ...FALLBACK_CHAIN.filter(m => m !== selectedModel),
  ];

  let geminiRes: Response | null = null;
  let usedModel: GeminiModel = selectedModel;
  let lastStatus = 0;
  let lastErrText = '';

  for (const candidateModel of tryOrder) {
    const url = `${GEMINI_API_BASE}/${candidateModel}:generateContent?key=${GEMINI_API_KEY}`;
    // FIX منطقي: grounding (googleSearch) مدعوم فقط في gemini-3.5-flash.
    // عند fallback لنموذج خفيف (3.1-flash-lite) نُزيل tools من الحمولة
    // وإلا يفشل النموذج الخفيف بـ 400 ويُفقَد الرد كلياً.
    let payloadForModel = geminiPayload;
    if (geminiPayload.tools && candidateModel !== 'gemini-3.5-flash') {
      const { tools, ...rest } = geminiPayload;
      void tools;
      payloadForModel = rest;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForModel),
      });
      if (res.ok) {
        geminiRes = res;
        usedModel = candidateModel;
        break;
      }
      lastStatus = res.status;
      lastErrText = await res.text().catch(() => '');
      console.warn(`[gemini-proxy] ${candidateModel} → ${res.status}, trying next...`);
      // 404/400 = نموذج مُغلق → جرّب التالي. 429/5xx = مشكلة مؤقتة → جرّب التالي أيضاً
      if (res.status === 401 || res.status === 403) break; // مفتاح خاطئ — لا فائدة من المحاولة
    } catch (fetchErr) {
      console.error(`[gemini-proxy] ${candidateModel} fetch error:`, fetchErr);
      lastStatus = 502;
    }
  }

  if (!geminiRes) {
    console.error('[gemini-proxy] all models failed:', lastStatus, lastErrText.slice(0, 200));
    // 429 من Gemini = تجاوز الحصة المجانية (RESOURCE_EXHAUSTED) — رسالة واضحة
    // للمستخدم بدلاً من خطأ عام، مع Retry-After ليعرف التطبيق متى يعيد المحاولة.
    const isQuota =
      lastStatus === 429 || /RESOURCE_EXHAUSTED|quota/i.test(lastErrText);
    const errBody = isQuota
      ? { error: 'AI quota reached. Please try again in a minute.', code: 'QUOTA_EXCEEDED' }
      : { error: `Gemini API error: ${lastStatus || 502}`, code: 'UPSTREAM_ERROR' };
    return new Response(JSON.stringify(errBody), {
      status: isQuota ? 429 : (lastStatus || 502),
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        ...(isQuota ? { 'Retry-After': '60' } : {}),
      },
    });
  }

  const geminiData = await geminiRes.json();
  // دمج كل أجزاء النص (وليس الجزء الأول فقط) مع استبعاد أجزاء "التفكير"
  const parts: Array<{ text?: string; thought?: boolean }> =
    geminiData?.candidates?.[0]?.content?.parts ?? [];
  const text: string = parts
    .filter(p => !p.thought)
    .map(p => p.text ?? '')
    .join('');
  const inputTokens: number =
    geminiData?.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens: number =
    geminiData?.usageMetadata?.candidatesTokenCount ?? 0;

  // ─── تسجيل الطلب في قاعدة البيانات (await آمن) ───────────────────
  if (supabase) {
    try {
      await supabase.from('ai_requests').insert({
        model: usedModel,
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        ip_hash: ipHash,
        function_name: functionName,
      });
    } catch (e) {
      console.warn('[gemini-proxy] log insert failed:', e);
    }
  }

  return new Response(
    JSON.stringify({ text, inputTokens, outputTokens, model: usedModel }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
