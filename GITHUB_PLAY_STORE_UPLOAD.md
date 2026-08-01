# رفع Notic Tahiro إلى Google Play عبر GitHub

هذا الملف يشرح طريقة تجهيز GitHub حتى يبني التطبيق كملف Android App Bundle بصيغة `.aab`، ثم يرفعه اختيارياً إلى Google Play Internal Testing.

## 1. ارفع المشروع إلى GitHub

```bash
git init
git add .
git commit -m "Prepare Notic Tahiro for Google Play"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 2. ما الذي سيحدث في GitHub Actions؟

ملف workflow موجود هنا:

```text
.github/workflows/google-play-android.yml
```

عند الدفع إلى `main` أو تشغيل workflow يدوياً، سيقوم GitHub بـ:

1. تثبيت Node.js 22.
2. تثبيت الحزم عبر `npm ci`.
3. بناء الموقع عبر `npm run build`.
4. إضافة Android platform عبر Capacitor إذا لم يكن موجوداً.
5. مزامنة Capacitor مع Android.
6. بناء ملف `.aab`.
7. رفع ملف `.aab` كـ Artifact داخل GitHub Actions.
8. رفعه اختيارياً إلى Google Play Internal Testing إذا أضفت أسرار Google Play.

## 3. بناء AAB بدون رفع تلقائي

إذا لم تضف أسرار التوقيع، سيحاول GitHub بناء AAB غير موقّع أو يفشل حسب إعداد Gradle. الأفضل إضافة أسرار التوقيع قبل الاعتماد على workflow.

## 4. أسرار التوقيع المطلوبة

اذهب إلى:

```text
GitHub Repository > Settings > Secrets and variables > Actions > New repository secret
```

أضف:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

## 5. إنشاء keystore من Termux أو الكمبيوتر

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias notic-tahiro \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

ثم حوّله إلى base64:

```bash
base64 -w 0 release.keystore
```

انسخ الناتج إلى Secret باسم:

```text
ANDROID_KEYSTORE_BASE64
```

## 6. رفع تلقائي إلى Google Play

لرفع AAB تلقائياً إلى Google Play Internal Testing، أضف Secret:

```text
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

يجب أن يكون محتوى JSON لحساب خدمة من Google Play Console لديه صلاحية رفع الإصدارات.

## 7. مكان ملف AAB بعد البناء

بعد اكتمال workflow، ستجد Artifact باسم:

```text
notictahiro-release-aab
```

والملف يكون من المسار:

```text
android/app/build/outputs/bundle/release/*.aab
```

## 8. الملفات المهمة الموجودة في المشروع

```text
capacitor.config.ts
.github/workflows/google-play-android.yml
GOOGLE_PLAY_RELEASE_GUIDE.md
STORE_COMPLIANCE_AUDIT.md
APP_PRIVACY_DETAILS.md
play-store/release-checklist.md
play-store/data-safety.md
play-store/store-listing-ar.md
play-store/store-listing-en.md
public/app-ads.txt
firebase.json
.firebaserc
```

## 9. مهم قبل إرسال التطبيق للمراجعة

- انشر الموقع على Firebase Hosting.
- تأكد أن هذه الروابط تعمل:
  - `/privacy`
  - `/delete-data`
  - `/about`
  - `/contact`
  - `/app-ads.txt`
- استخدم رابط الخصوصية العام في Play Console.
- املأ Data Safety بصدق حسب السلوك الفعلي للتطبيق.
- لا تضع مفاتيح Gemini أو Firebase Admin داخل الواجهة.
- إذا أضفت إعلانات، جهز consent و app-ads.txt.