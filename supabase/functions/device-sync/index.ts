/**
 * supabase/functions/device-sync/index.ts
 * ─────────────────────────────────────────────────────────────────────
 * Edge Function — مزامنة مربوطة بالجهاز، بلا حساب
 *
 * لماذا تمرّ المزامنة من هنا ولا تضرب الجدول مباشرة:
 * لا توجد حسابات، فلا يوجد auth.uid() تبني عليه RLS. الجدول مُقفل تماماً
 * (RLS بلا سياسات) والمنفذ الوحيد هذه الدالة، تعمل بمفتاح service_role
 * وتتحقّق من "سرّ الجهاز" بنفسها. لو سمحنا للعميل بالوصول المباشر بالمفتاح
 * العام، لقرأ أي شخص ملاحظات أي جهاز — المفتاح العام منشور داخل التطبيق.
 *
 * الأفعال:
 *   register  — أول مرة: ينشئ صف الجهاز بـ hash السرّ
 *   pull      — يُعيد اللقطة الحالية ورقم نسختها
 *   push      — يكتب لقطة جديدة، ويرفض الكتابة إن تجاوزه جهاز آخر
 *   forget    — يحذف بيانات الجهاز من السحابة نهائياً
 *
 * السرّ نفسه لا يُخزَّن ولا يُسجَّل في أي مكان — hash فقط.
 *
 * النشر:
 *   supabase functions deploy device-sync --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

/** سقف حجم اللقطة. localStorage نفسه ~5MB، ونترك هامشاً للترميز. */
const MAX_BYTES = 4 * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * مقارنة بزمن ثابت.
 * السرّ 128 بت عشوائية فهجوم التوقيت غير عملي أصلاً، لكن المقارنة
 * القصيرة عادةٌ سيئة تنتقل إلى سياقات أخطر — فلنكتبها صحيحة من البداية.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'SERVER_MISCONFIGURED' }, 500);

  let body: {
    action?: string; deviceId?: string; secret?: string;
    payload?: unknown; rev?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BAD_JSON' }, 400);
  }

  const { action, deviceId, secret } = body;
  if (!action || !deviceId || !secret) return json({ error: 'MISSING_FIELDS' }, 400);
  if (!UUID_RE.test(deviceId)) return json({ error: 'BAD_DEVICE_ID' }, 400);
  // سرّ قصير = قابل للتخمين. نرفضه هنا لا في العميل فقط.
  if (typeof secret !== 'string' || secret.length < 32) return json({ error: 'WEAK_SECRET' }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const secretHash = await sha256Hex(secret);

  // ─── register ───────────────────────────────────────────────────────
  if (action === 'register') {
    const { data: existing } = await db
      .from('device_sync').select('device_id, secret_hash, rev').eq('device_id', deviceId).maybeSingle();

    if (existing) {
      // الجهاز مسجَّل: هذا ليس خطأً (إعادة تثبيت/رمز نقل) — لكن السرّ
      // يجب أن يطابق، وإلا فهو معرّف يخصّ شخصاً آخر.
      if (!safeEqual(existing.secret_hash ?? '', secretHash)) return json({ error: 'BAD_SECRET' }, 403);
      return json({ ok: true, existed: true, rev: existing.rev ?? 0 });
    }

    const { error } = await db.from('device_sync').insert({
      device_id: deviceId, secret_hash: secretHash, payload: {}, rev: 0, bytes: 0,
    });
    if (error) return json({ error: 'DB_INSERT_FAILED', detail: error.message }, 500);
    return json({ ok: true, existed: false, rev: 0 });
  }

  // بقية الأفعال تتطلب صفاً قائماً وسرّاً مطابقاً
  const { data: row, error: readErr } = await db
    .from('device_sync').select('secret_hash, payload, rev, updated_at').eq('device_id', deviceId).maybeSingle();

  if (readErr) return json({ error: 'DB_READ_FAILED', detail: readErr.message }, 500);
  if (!row) return json({ error: 'NOT_REGISTERED' }, 404);
  if (!safeEqual(row.secret_hash ?? '', secretHash)) return json({ error: 'BAD_SECRET' }, 403);

  // ─── pull ───────────────────────────────────────────────────────────
  if (action === 'pull') {
    return json({ ok: true, payload: row.payload ?? {}, rev: row.rev ?? 0, updatedAt: row.updated_at });
  }

  // ─── push ───────────────────────────────────────────────────────────
  if (action === 'push') {
    const { payload, rev } = body;
    if (payload === undefined || payload === null || typeof payload !== 'object') {
      return json({ error: 'BAD_PAYLOAD' }, 400);
    }
    // رقم النسخة إلزامي: بدونه لا يمكن كشف التعارض، والكتابة تصير
    // "آخر من وصل يمحو الباقي" بصمت. نرفض بدل أن نخمّن.
    if (typeof rev !== 'number' || !Number.isFinite(rev) || rev < 0) {
      return json({ error: 'MISSING_REV' }, 400);
    }
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_BYTES) return json({ error: 'TOO_LARGE', maxBytes: MAX_BYTES }, 413);

    const serverRev = row.rev ?? 0;
    // تعارض: جهاز آخر كتب بعد آخر سحب لنا. لا نكتب فوقه — نُعيد لقطته
    // ليدمجها العميل بمنطقه المُختبَر ثم يُعيد المحاولة برقم النسخة الجديد.
    if (rev < serverRev) {
      return json({ ok: false, conflict: true, payload: row.payload ?? {}, rev: serverRev });
    }

    const nextRev = serverRev + 1;
    // ⚠️ .eq('rev', serverRev) حارس تزامن ضد كتابة انسلّت بين القراءة
    // والكتابة. لكن عدم مطابقة أي صف **ليس خطأً** في Postgres: الاستعلام
    // ينجح ويُحدّث صفر صفوف. بلا select() كنا سنُعيد ok ورقم نسخة جديداً
    // بينما لم يُكتب شيء — ويظنّ المستخدم أن ملاحظاته رُفعت وهي لم تُرفع.
    // لذلك نطلب الصفوف المتأثّرة ونعامل الصفر منها كتعارض.
    const { data: updated, error } = await db.from('device_sync').update({
      payload, rev: nextRev, bytes: serialized.length, updated_at: new Date().toISOString(),
    }).eq('device_id', deviceId).eq('rev', serverRev).select('rev');

    if (error) return json({ error: 'DB_WRITE_FAILED', detail: error.message }, 500);

    if (!updated || updated.length === 0) {
      const { data: fresh } = await db
        .from('device_sync').select('payload, rev').eq('device_id', deviceId).maybeSingle();
      return json({ ok: false, conflict: true, payload: fresh?.payload ?? {}, rev: fresh?.rev ?? serverRev });
    }

    return json({ ok: true, rev: nextRev });
  }

  // ─── forget ─────────────────────────────────────────────────────────
  if (action === 'forget') {
    const { error } = await db.from('device_sync').delete().eq('device_id', deviceId);
    if (error) return json({ error: 'DB_DELETE_FAILED', detail: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'UNKNOWN_ACTION' }, 400);
});
