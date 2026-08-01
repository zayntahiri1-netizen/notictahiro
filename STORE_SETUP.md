# 🚀 دليل رفع Notic Tahiro للمتاجر

## نظرة سريعة

| الخطوة | Android (Play Store) | iOS (App Store) |
|--------|---------------------|-----------------|
| الحساب | Google Play Console | Apple Developer |
| الرسوم | $25 مرة واحدة | $99 / سنة |
| الملف | `.aab` | `.ipa` |
| وقت المراجعة | ساعات–يوم | 1–3 أيام |

---

## 🤖 Android — Google Play Store

### الخطوة 1: إنشاء Android Keystore (مرة واحدة!)

```bash
bash scripts/create-keystore.sh
```

> ⚠️ **احتفظ بـ keystore.release في مكان آمن للأبد** — إذا ضاع لا يمكنك تحديث التطبيق.

### الخطوة 2: أضف GitHub Secrets

في GitHub → Settings → Secrets → Actions، أضف:

| Secret | القيمة |
|--------|---------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w 0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور الـ keystore |
| `ANDROID_KEY_ALIAS` | `notic-tahiro` |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | محتوى ملف JSON من Google Play |

### الخطوة 3: إعداد Google Play Console

1. افتح [play.google.com/console](https://play.google.com/console)
2. Create app → **App name**: Notic Tahiro
3. **Package name**: `com.notictahiro.app`
4. أكمل:
   - Store listing (وصف + screenshots)
   - Content rating (questionnaire)
   - Data safety (من ملف `play-store/data-safety.md`)
   - App signing → opt-in to Play App Signing

### الخطوة 4: Service Account لرفع تلقائي

1. Google Play Console → Setup → API access
2. Link to Google Cloud project
3. Create service account → Download JSON
4. Grant **Release manager** role
5. أضف JSON محتواه كـ `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

### الخطوة 5: الرفع

```bash
git push origin main
# أو من GitHub Actions → Run workflow يدوياً
```

الـ AAB سيُرفع تلقائياً إلى Internal Testing → بعدها ترفعه يدوياً لـ Production.

---

## 🍎 iOS — Apple App Store

### الخطوة 1: حسابات مطلوبة

- [developer.apple.com](https://developer.apple.com) (اشتراك $99/سنة)
- App Store Connect account

### الخطوة 2: إنشاء App ID

1. developer.apple.com → Certificates, IDs & Profiles
2. Identifiers → + → App IDs
3. **Bundle ID**: `com.notictahiro.app`
4. Capabilities: تفعيل **Push Notifications** إذا لزم

### الخطوة 3: توليد الشهادات

```
Certificates → + → Apple Distribution
```
- حمّل CSR من Keychain Access
- حمّل الشهادة → أضفها لـ keychain
- صدّر `.p12` بكلمة مرور

### الخطوة 4: Provisioning Profile

```
Profiles → + → App Store Distribution
```
- اختر App ID: `com.notictahiro.app`
- اختر الشهادة
- حمّل `.mobileprovision`

### الخطوة 5: App Store Connect API Key

1. App Store Connect → Users & Access → Integrations → App Store Connect API
2. Generate API Key → حمّل `.p8`
3. سجّل الـ Key ID و Issuer ID

### الخطوة 6: GitHub Secrets لـ iOS

| Secret | القيمة |
|--------|---------|
| `IOS_CERTIFICATE_BASE64` | `base64 -w 0 certificate.p12` |
| `IOS_CERTIFICATE_PASSWORD` | كلمة مرور .p12 |
| `IOS_KEYCHAIN_PASSWORD` | أي كلمة مرور (للـ keychain المؤقت) |
| `IOS_PROVISIONING_PROFILE_BASE64` | `base64 -w 0 profile.mobileprovision` |
| `IOS_PROVISIONING_PROFILE_NAME` | اسم الـ profile من Xcode |
| `IOS_TEAM_ID` | Team ID من developer.apple.com |
| `APP_STORE_CONNECT_API_KEY` | محتوى ملف .p8 |
| `APP_STORE_CONNECT_KEY_ID` | Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |

### الخطوة 7: إنشاء التطبيق في App Store Connect

1. My Apps → + → New App
2. **Bundle ID**: `com.notictahiro.app`
3. **Name**: Notic Tahiro
4. **Primary Language**: Arabic
5. أضف screenshots وأكمل metadata

### الخطوة 8: الرفع

```bash
# من GitHub Actions → app-store-ios → Run workflow
```

الـ IPA سيُرفع لـ TestFlight → أضف testers → بعد الاختبار ارفعه لـ Review.

---

## 🎨 توليد الأيقونات

بعد `npx cap add android` و `npx cap add ios`:

```bash
npm run icons:generate
```

سيولّد الأيقونات لجميع densities في `android/` و `ios/`.

---

## 🔄 سير العمل اليومي

```bash
# تطوير محلي
npm run dev

# اختبار Android محلياً
npm run cap:android    # يفتح Android Studio

# اختبار iOS محلياً (Mac فقط)
npm run cap:ios        # يفتح Xcode

# رفع للمتاجر
git push origin main   # يشغّل CI تلقائياً
```

---

## 📋 قائمة مراجعة قبل الرفع الأول

### مشترك
- [ ] `capacitor.config.ts` → `appId` صحيح: `com.notictahiro.app`
- [ ] `package.json` → `version` محدّث
- [ ] الأيقونات موجودة لجميع أحجام
- [ ] اختبرت على جهاز حقيقي (ليس simulator فقط)
- [ ] Privacy Policy URL موجود (مطلوب للمتجرين)
- [ ] صفحة Data Deletion معدّة

### Android
- [ ] Keystore محفوظ في مكان آمن (خارج Git!)
- [ ] `.gitignore` يستثني `*.keystore`
- [ ] `versionCode` يبدأ من 1
- [ ] Content Rating مكتمل في Play Console
- [ ] Data Safety Form مكتملة

### iOS
- [ ] Bundle ID مطابق في Xcode وApp Store Connect
- [ ] NSUserTrackingUsageDescription في Info.plist إذا استخدمت Analytics
- [ ] Privacy manifest (PrivacyInfo.xcprivacy) معدّ
- [ ] Screenshots بأحجام iPhone 6.5" و iPad 12.9" (إذا دعمت iPad)

---

## 🆘 مشاكل شائعة

**Build fails: SDK location not found**
```bash
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

**iOS: No signing certificate**  
تأكد أن الـ `IOS_CERTIFICATE_BASE64` يحتوي شهادة Distribution (ليس Development)

**Google Play: Version code already used**  
ارفع `versionCode` في `android/app/build.gradle`

**capacitor sync fails**  
```bash
rm -rf node_modules && npm ci && npx cap sync
```
