# 🚀 إعداد Notic Tahiro مع Gemini AI + Supabase + Termux

## الملخص السريع

```
المستخدم → التطبيق → Supabase Edge Function → Gemini API
                    (يخفي مفتاح API)
```

---

## 1️⃣ الحصول على مفتاح Gemini API

1. اذهب إلى: https://ai.google.dev
2. انقر **Get API Key** → **Create API Key**
3. احتفظ بالمفتاح: `AIzaSy...`

---

## 2️⃣ إنشاء مشروع Supabase

1. اذهب إلى: https://supabase.com
2. **New Project** → ضع اسم المشروع `notic-tahiro`
3. من **Settings → API** احتفظ بـ:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOi...`

---

## 3️⃣ جدول Supabase SQL (أضفه في Table Editor)

افتح **SQL Editor** في Supabase وشغّل:

```sql
-- جدول تسجيل طلبات الذكاء الاصطناعي
CREATE TABLE ai_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now() NOT NULL,
  device_id    text,
  action       text NOT NULL,
  model        text DEFAULT 'gemini-3.5-flash',
  prompt_tokens    integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  success      boolean DEFAULT true,
  error_msg    text
);

-- فهرس للبحث السريع حسب التاريخ
CREATE INDEX idx_ai_requests_created ON ai_requests(created_at DESC);

-- Row Level Security (اختياري لكن موصى به)
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- السماح للـ anon key بالإدراج فقط
CREATE POLICY "allow_insert" ON ai_requests
  FOR INSERT TO anon WITH CHECK (true);

-- السماح للـ service_role بالقراءة
CREATE POLICY "allow_read_service" ON ai_requests
  FOR SELECT TO service_role USING (true);
```

---

## 4️⃣ إضافة مفتاح Gemini في Supabase Secrets

في **Supabase Dashboard → Settings → Edge Functions → Secrets**:

```
Name:  GEMINI_API_KEY
Value: AIzaSy...  (مفتاحك من Google)
```

---

## 5️⃣ إعداد ملف `.env` في المشروع

انسخ `.env.example` إلى `.env`:

```bash
cp .env.example .env
```

وعدّل القيم:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 6️⃣ النشر من Termux

### تثبيت المتطلبات في Termux (مرة واحدة):

```bash
# تحديث الحزم
pkg update && pkg upgrade -y

# تثبيت Node.js و Git
pkg install nodejs git -y

# تثبيت Supabase CLI
npm install -g supabase

# تحقق من التثبيت
node --version    # يجب أن يكون v18+
supabase --version
```

### نشر Edge Function:

```bash
# انتقل إلى مجلد المشروع
cd notictahiro-store-ready

# تسجيل الدخول لـ Supabase
supabase login

# ربط المشروع (استخدم Project Reference ID من Dashboard)
supabase link --project-ref xxxxxxxxxxxx

# نشر الـ Edge Function
supabase functions deploy gemini-proxy --no-verify-jwt

# تحقق من النشر
supabase functions list
```

### بناء التطبيق ورفعه على Firebase:

```bash
# تثبيت المكتبات
npm install

# بناء التطبيق
npm run build

# تثبيت Firebase CLI
npm install -g firebase-tools

# تسجيل الدخول
firebase login --no-localhost

# نشر على Firebase Hosting
firebase deploy --only hosting
```

---

## 7️⃣ اختبار الـ Edge Function

```bash
# اختبار مباشر من Termux
curl -X POST https://xxxx.supabase.co/functions/v1/gemini-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"قل مرحبا","maxTokens":50}'

# يجب أن تحصل على رد مثل:
# {"text":"مرحبا! كيف يمكنني مساعدتك؟","inputTokens":5,"outputTokens":10,"model":"gemini-3.5-flash"}
```

---

## 🏗️ هيكل الملفات الجديدة

```
notictahiro-store-ready/
├── src/
│   └── utils/
│       ├── geminiService.ts      ← جديد: اتصال Gemini عبر Supabase
│       └── aiEngine.ts           ← محدّث: دوال async + Gemini
├── supabase/
│   ├── config.toml               ← إعداد Supabase
│   └── functions/
│       └── gemini-proxy/
│           └── index.ts          ← Edge Function الجديد
├── .env.example                  ← متغيرات البيئة
└── SUPABASE_GEMINI_SETUP.md      ← هذا الملف
```

---

## 🔄 كيف يعمل النظام؟

```
1. المستخدم يضغط "تلخيص بـ AI"
2. NoteEditor يستدعي aiSummarize(title, content)
3. aiEngine يستدعي geminiService.geminiSummarize()
4. geminiService يرسل طلب POST إلى:
   https://xxxx.supabase.co/functions/v1/gemini-proxy
5. Edge Function في Supabase تستدعي Gemini API باستخدام GEMINI_API_KEY المخفي
6. Gemini يعيد الرد → Edge Function ترسله للتطبيق
7. aiSummarize تعيد النص ← المستخدم يرى الملخص
```

---

## ⚡ الميزات الجديدة بعد الإعداد

| الميزة | وصف |
|--------|-----|
| **تلخيص Gemini** | ملخص حقيقي بالذكاء الاصطناعي لكل ملاحظة |
| **وسوم ذكية** | استخراج وسوم دقيقة من محتوى الملاحظة |
| **مهام ذكية** | استخراج مهام قابلة للتشطيب من النص |
| **مسودة AI** | توليد مسودات احترافية/ودية/مهام بـ Gemini |
| **محادثة AI** | دردشة مباشرة مع Tahiro بسياق ملاحظاتك |
| **تقرير ذكي** | تقرير إنتاجية شامل مولّد بـ Gemini |
| **تفسير أوامر** | أوامر طبيعية بالعربية يفسّرها Gemini |

---

## 🛡️ الأمان

- ✅ مفتاح Gemini **محفوظ في Supabase Secrets** — لا يظهر في الكود
- ✅ **CORS محكوم** في Edge Function
- ✅ **Rate limiting** يمكن إضافته عبر جدول `ai_requests`
- ✅ الواجهة تستخدم **anon key فقط** (صلاحيات محدودة)
