# 🏆 Notic Tahiro — النسخة الاحترافية النهائية (13 جولة تدقيق)

## الجولة 13 — أيقونة التطبيق الاحترافية + تحسينات شاملة (يونيو 2026)

### 🎨 الأيقونة الاحترافية (إصلاح حرج)
19. **أيقونة واحدة تناسب جميع الأجهزة** — تم استبدال الأيقونة القديمة بالشعار
    الاحترافي الجديد (Notic Tahiro بتصميم الدفتر ثلاثي الأبعاد مع التوهج الأرجواني).
    الأيقونة الآن متوافقة مع:
    - **Android**: مipmap-mdpi حتى mipmap-xxxhdpi (48→192px) + adaptive foreground + round
    - **iOS**: جميع أحجام App Store (20px → 1024px) + Contents.json لـ Xcode
    - **PWA/Web**: icon-192.png + icon-512.png + icon-maskable-512.png (safe zone 80%)
    - **SVG**: أيقونة متجهية قابلة للتوسع لأي حجم بلا تشويه
    - **apple-touch-icon**: أحجام متعددة (120/152/167/180px) لجميع أجهزة Apple

20. **index.html محسّن لجميع المنصات** — إضافة:
    - `apple-touch-icon` متعدد الأحجام (120/152/167/180px)
    - `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style`
    - `apple-mobile-web-app-title` للاسم الصحيح على الشاشة الرئيسية
    - `og:image` للمشاركة الاجتماعية
    - ثيم `#7c3aed` الأرجواني يطابق الشعار

21. **manifest.webmanifest محدّث** — background_color أصبح `#0f0320` (يطابق الأيقونة)
    + `purpose: maskable` صريح للأيقونة المناسبة لجميع قواطع Android

22. **generate-icons.js معاد كتابته** — توليد آلي كامل عند `node scripts/generate-icons.js`:
    - Adaptive icon مع foreground شفاف (125% من الحجم)
    - Round icon بمنحنيات دائرية (50% radius)
    - Maskable PWA icon مع safe zone صحيح (80% inner / 10% pad جانبياً)
    - أيقونة إشعار Android (`ic_stat_notification`) — ظل أبيض للـ status bar
    - iOS Contents.json تلقائي لـ Xcode

23. **AdBanner.tsx مُعاد هيكلته** — hook `useBannerHeight()` مُصدَّر للاستخدام
    في الشاشات التي تحتاج padding-bottom ديناميكي حسب ارتفاع البانر الحقيقي

---

## الجولة 12 — اتساق إقرارات Google Play + تحصين التخزين (يونيو 2026)
17. **🔴 إقرارات المتجر تناقض التطبيق المشحون** — data-safety.md أُعيدت كتابته
    لتطابق الواقع. content-rating.md يصرّح بـ Contains ads: YES.
18. **JSON.parse بلا حماية في AICopilot** — try/catch مع دمج الافتراضيات وتنظيف
    المفتاح التالف عند فتح المكوّن.

## الجولة 11 — تدقيق منصة iOS والإشعارات (يونيو 2026)
14. **🔴 انهيار iOS فور الإقلاع** — سكربت `ios-patches/apply-ios-config.sh`
    يحقن الخمسة مفاتيح الضرورية في Info.plist + SKAdNetworkItems.
15. **وحدات إعلانات واعية بالمنصة** — iOS يستخدم وحدات اختبار حتى إنشاء وحدات حقيقية.
16. **إعادة جدولة الإشعارات** — يُعاد فقط عند تغيّر المنبه فعلياً.

## الجولة 10 — AdMob + ذكاء اصطناعي + بنية (يونيو 2026)
1. **ترقية admob 6→8** — @capacitor-community/admob@^8.0.0 متوافق مع Capacitor 8.
2. **إيقاف Native Advanced كبانر** — Banner الرسمية فقط مع إعادة محاولة واحدة.
3. **ترتيب صارم: تهيئة → موافقة UMP → تحميل** — initAdMob idempotent.
4. **تعطيل التفكير في Gemini 2.5** — `thinkingConfig: { thinkingBudget: 0 }`.
5. **دمج كل أجزاء الرد** بدل `parts[0]` مع استبعاد أجزاء التفكير.
6. **تنظيف history في البروكسي** — سلسلة تبدأ بـ user دائماً.
7. **إصلاح تسرب مؤقت المهلة** في callGemini + رفع سقف العنوان 64 رمزاً.
8. **package-lock.json fallback** — `npm ci || npm install` في workflows.
9. **حماية بروكسي بسر مشترك اختياري** APP_SHARED_SECRET.
10. **ارتفاع بانر ديناميكي** — onBannerHeight يبث الارتفاع الحقيقي.
11. **Permissions-Policy كترويسة HTTP** في firebase.json.
12. **كود ميت خطير في push-to-github.sh** — VITE_SUPABASE_URL وANON_KEY يُرفعان الآن.
13. **توحيد منطق دردشة AICopilot** — دالة sendChat واحدة.

## 📊 ملخص الإصلاحات الحرجة الكاملة (13 جولة)

| # | الخطأ | الأثر |
|---|---|---|
| 1 | نموذج gemini-2.0-flash ميت (أُغلق 1 يونيو 2026) | كل طلبات AI ترجع 404 |
| 2 | set_secret: تشفير مكسور | Secrets لم تصل GitHub أبداً |
| 3 | .env لا يُرفع والـ workflow لا يحقن البدائل | كل APK من GitHub أعمى عن Supabase |
| 4 | external Capacitor في بناء الويب | صفحة بيضاء كاملة على المتصفح |
| 5 | versionCode=1 ثابت | ثاني رفعة لـ Play Store تُرفض |
| 6 | إذن POST_NOTIFICATIONS مفقود | كل الإشعارات ميتة على Android 13+ |
| 7 | SW يخزّن ردود Gemini في الكاش | ردود AI قديمة تُعاد للمستخدم |
| 8 | GADApplicationIdentifier مفقود من iOS | انهيار فوري عند إقلاع iOS |
| 9 | إقرارات المتجر تناقض التطبيق | رفض/تعليق من Google Play |
| 10 | أيقونة غير محسّنة لجميع الأجهزة | ظهور ضبابي على بعض الأجهزة |

## 🚀 التشغيل النهائي (3 خطوات)
### 1) أعد نشر Edge Function
```bash
supabase functions deploy gemini-proxy --no-verify-jwt
```
### 2) شغّل SQL
```
SQL Editor → الصق supabase/migrations/001_ai_requests.sql → Run
```
### 3) توليد الأيقونات وبناء التطبيق
```bash
npm install --ignore-scripts
node scripts/generate-icons.js   # يتطلب android/ و ios/ موجودَين
./scripts/push-to-github.sh
```

---
— Crafted with care in Tetouan 🇲🇦
