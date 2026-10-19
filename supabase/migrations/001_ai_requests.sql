-- ═══════════════════════════════════════════════════════════════════════
-- Notic Tahiro — SQL Migration 001
-- الغرض: تسجيل طلبات الذكاء الاصطناعي + إحصاءات الاستخدام
-- تشغيل في: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ─── جدول سجل طلبات الذكاء الاصطناعي ────────────────────────────────
create table if not exists public.ai_requests (
  id               uuid        default gen_random_uuid() primary key,
  created_at       timestamptz default now() not null,
  model            text        not null default 'gemini-3.1-flash-lite',
  prompt_tokens    int         not null default 0,
  completion_tokens int        not null default 0,
  ip_hash          text,
  function_name    text        default 'unknown'
);

-- ── FIX: إن كان الجدول منشأً مسبقاً من تشغيل سابق (بأعمدة ناقصة)،
-- "create table if not exists" يتجاهل الجدول كلياً ولا يُضيف أي عمود
-- جديد. كل سطر هنا دفاعي (idempotent) ويضمن وجود كل عمود مهما كانت
-- حالة الجدول السابقة — يمكن إعادة تشغيل هذا الملف بأمان أي عدد مرات.
alter table public.ai_requests add column if not exists model text not null default 'gemini-3.1-flash-lite';
alter table public.ai_requests add column if not exists prompt_tokens int not null default 0;
alter table public.ai_requests add column if not exists completion_tokens int not null default 0;
alter table public.ai_requests add column if not exists ip_hash text;
alter table public.ai_requests add column if not exists function_name text default 'unknown';
alter table public.ai_requests
  add column if not exists total_tokens int generated always as (prompt_tokens + completion_tokens) stored;

-- فهرس لتسريع فحص معدل الطلبات (يُستعمل كثيراً في Rate Limit)
create index if not exists idx_ai_requests_ip_created
  on public.ai_requests (ip_hash, created_at desc);

-- فهرس لتسريع الإحصاءات حسب التاريخ
create index if not exists idx_ai_requests_created_at
  on public.ai_requests (created_at desc);

-- ─── تفعيل Row Level Security ─────────────────────────────────────────
alter table public.ai_requests enable row level security;

-- فقط service_role (Edge Function) يكتب — لا يقرأ المستخدمون مباشرة
drop policy if exists "service_role_insert" on public.ai_requests;
create policy "service_role_insert" on public.ai_requests
  for insert
  with check (true);

-- ─── View: إحصاءات استخدام الذكاء الاصطناعي ─────────────────────────
create or replace view public.ai_usage_stats as
select
  date_trunc('day', created_at)::date                        as day,
  model,
  function_name,
  count(*)                                                   as request_count,
  sum(prompt_tokens)                                         as total_prompt_tokens,
  sum(completion_tokens)                                     as total_completion_tokens,
  sum(total_tokens)                                          as total_tokens_used
from public.ai_requests
group by 1, 2, 3
order by 1 desc, 3 desc;

-- ─── View: أكثر الـ IP طلباً في آخر ساعة (للمراقبة) ──────────────────
create or replace view public.ai_rate_monitor as
select
  ip_hash,
  count(*)     as requests_last_hour,
  max(created_at) as last_request_at
from public.ai_requests
where created_at > now() - interval '1 hour'
group by ip_hash
order by 2 desc;

-- ─── View: ملخص يومي سريع ─────────────────────────────────────────────
create or replace view public.ai_daily_summary as
select
  date_trunc('day', created_at)::date as day,
  count(*)                            as total_requests,
  sum(total_tokens)                   as tokens_consumed,
  count(distinct ip_hash)             as unique_ips,
  round(avg(total_tokens), 0)         as avg_tokens_per_req
from public.ai_requests
group by 1
order by 1 desc;

-- ─── دالة: عد طلبات IP في الساعة الأخيرة (تُستعمل في Rate Limit) ──────
create or replace function public.count_ip_requests_last_hour(p_ip_hash text)
returns bigint
language sql
stable
security definer
as $$
  select count(*)
  from public.ai_requests
  where ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';
$$;

-- ─── حذف السجلات الأقدم من 30 يوم (تنظيف تلقائي) ─────────────────────
-- يمكن تشغيل هذا يدوياً أو جدولته كـ cron job في Supabase
create or replace function public.cleanup_old_ai_requests()
returns void
language sql
security definer
as $$
  delete from public.ai_requests
  where created_at < now() - interval '30 days';
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- انتهى — تحقق بـ:
--   select * from public.ai_daily_summary;
--   select * from public.ai_usage_stats limit 20;
-- ═══════════════════════════════════════════════════════════════════════
