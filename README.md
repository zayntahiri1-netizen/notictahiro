# Notic Tahiro 📝✨

مفكرة ذكية مدعومة بالذكاء الاصطناعي — ملاحظات، أفكار، مهام، ومالية في تطبيق واحد.

`com.notictahiro.app` · React + TypeScript + Capacitor 8

---

## طريقة البناء عبر GitHub (من هاتفك فقط) 🚀

### الخطوة 1 — أنشئ Repository على GitHub
اذهب لـ **github.com/new** وأنشئ repo باسم **notic-tahiro** (مجاني).

### الخطوة 2 — فك الضغط ورفع الكود
```bash
# في Termux:
cd ~
unzip "/sdcard/Download/Notic Tahiro.zip"
cd notictahiro-store-ready
chmod +x scripts/*.sh
./scripts/push-to-github.sh
```
سيطلب منك username و token وسيرفع كل شيء تلقائياً.

أدخل بيانات GitHub:
```
اسم المستخدم (username): zayntahiri1-netizen
اسم الـ Repository (مثل: notic-tahiro): notic-tahiro
الـ Token (ghp_...): ⟵ توكن جديد
```

### الخطوة 3 — GitHub يبني APK مجاناً ☁️
افتح: **github.com/zayntahiri1-netizen/notic-tahiro/actions**

بعد ~5–10 دقائق ستجد:

| الملف | الاستخدام |
|------|-----------|
| `notictahiro-debug-apk` | تثبيت مباشر للتجربة |
| `notictahiro-release-apk` | APK موقّع |
| `notictahiro-release-aab` | رفع على Play Store |

### لإنشاء Token على GitHub:
Settings → Developer settings → Personal access tokens → Generate new token → اختر **repo** و **workflow** → Copy

---

## ⚠️ ملاحظات مهمة قبل النشر

- **التوكن:** لا تشارك توكن GitHub علناً أبداً. إن سبق ونشرته، احذفه وأنشئ غيره.
- **اسم ملف الـ zip فيه مسافة** → ضع علامتي تنصيص حوله في أمر `unzip`.
- **إعلانات الاختبار:** نسخة الإنتاج تعرض إعلانات AdMob حقيقية. لا تنقر إعلاناتك بنفسك
  أثناء التجربة (قد يُحظر حسابك). لبناء نسخة تجريبية آمنة: افتح
  `src/utils/admob.ts` واجعل `FORCE_TEST = true` ثم أعد البناء — ستظهر إعلانات اختبار.
- **الـ keystore:** يُولّده السكربت تلقائياً بكلمة سر `NoticTahiro2024`. احتفظ بنسخة من
  `release.keystore` في مكان آمن — تحتاجه لكل تحديث مستقبلي على Play Store.
