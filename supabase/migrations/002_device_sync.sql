-- ═══════════════════════════════════════════════════════════════════════
-- Notic Tahiro — SQL Migration 002
-- الغرض: مزامنة سحابية مربوطة بالجهاز، بلا حساب ولا تسجيل دخول
-- تشغيل في: Supabase Dashboard > SQL Editor  (آمن لإعادة التشغيل)
-- ═══════════════════════════════════════════════════════════════════════
--
-- نموذج الأمان — اقرأ هذا قبل أي تعديل:
--
-- لا يوجد auth.uid() هنا لأنه لا توجد حسابات. فالصلاحية مبنية على
-- "سرّ حامل" (bearer secret): 128 بت عشوائية يولّدها الجهاز ولا تُرسَل
-- إلى قاعدة البيانات أبداً — يُخزَّن منها hash فقط (SHA-256).
--
-- ولهذا السبب بالذات: **RLS مُفعَّل بلا أي سياسة**. أي عميل يحمل المفتاح
-- العام (anon) لا يستطيع قراءة صف واحد من هذا الجدول ولا كتابته. المنفذ
-- الوحيد هو edge function تعمل بمفتاح service_role وتتحقّق من السرّ بنفسها.
-- لو أضفت سياسة anon هنا يوماً، تصير كل ملاحظات كل المستخدمين مقروءة
-- لأي شخص يملك المفتاح العام — وهو منشور داخل التطبيق.

create table if not exists public.device_sync (
  device_id   uuid        primary key,
  -- SHA-256 للسرّ بصيغة hex. السرّ نفسه لا يُخزَّن ولا يُسجَّل.
  secret_hash text        not null,
  -- كل بيانات المستخدم كلقطة واحدة (نفس مفاتيح النسخة الاحتياطية)
  payload     jsonb       not null default '{}'::jsonb,
  -- عدّاد نسخة يتزايد مع كل كتابة — عليه يُبنى كشف التعارض
  rev         bigint      not null default 0,
  bytes       int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- دفاعي: إن كان الجدول منشأً من تشغيل سابق بأعمدة ناقصة، فإن
-- "create table if not exists" يتجاهله كلياً ولا يُضيف شيئاً.
alter table public.device_sync add column if not exists secret_hash text;
alter table public.device_sync add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.device_sync add column if not exists rev bigint not null default 0;
alter table public.device_sync add column if not exists bytes int not null default 0;
alter table public.device_sync add column if not exists created_at timestamptz not null default now();
alter table public.device_sync add column if not exists updated_at timestamptz not null default now();

-- لتنظيف الأجهزة المهجورة لاحقاً إن لزم
create index if not exists idx_device_sync_updated
  on public.device_sync (updated_at desc);

-- ─── RLS: مُفعَّل بلا سياسات (انظر الشرح أعلاه) ────────────────────────
alter table public.device_sync enable row level security;

-- إزالة أي سياسة قد تكون أُضيفت بالخطأ في تشغيل سابق — هذا الجدول
-- يجب ألا يكون مقروءاً للمفتاح العام تحت أي ظرف.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'device_sync'
  loop
    execute format('drop policy if exists %I on public.device_sync', p.policyname);
  end loop;
end $$;
