# نشر Notic Tahiro على Firebase Hosting من Termux

هذا المشروع أصبح يحتوي على ملفات Firebase Hosting الأساسية:

- `firebase.json`
- `.firebaserc`
- `public/app-ads.txt`
- `package.json`
- `vite.config.ts`
- `index.html`
- `public/manifest.webmanifest`
- `public/icons/icon.svg`

## 1. تجهيز Termux

```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```

## 2. الدخول إلى مجلد المشروع

إذا كان المشروع على GitHub:

```bash
git clone YOUR_REPOSITORY_URL
cd YOUR_REPOSITORY_FOLDER
```

أو إذا كان موجوداً مسبقاً:

```bash
cd path/to/project
```

## 3. تثبيت الحزم

```bash
npm install
```

## 4. تثبيت Firebase CLI

```bash
npm install -g firebase-tools
```

إذا ظهرت مشاكل صلاحيات في Termux، استخدم:

```bash
npm config set prefix ~/.npm-global
echo 'export PATH=$HOME/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g firebase-tools
```

## 5. تسجيل الدخول إلى Firebase

```bash
firebase login --no-localhost
```

سيعطيك رابطاً، افتحه في المتصفح، ثم انسخ كود التحقق وألصقه في Termux.

## 6. التأكد من اسم المشروع

الملف `.firebaserc` مضبوط حالياً على:

```json
{
  "projects": {
    "default": "notictahiro"
  }
}
```

إذا كان مشروع Firebase لديك مختلفاً:

```bash
firebase use --add
```

أو عدل `.firebaserc` باسم مشروعك.

## 7. بناء الموقع

```bash
npm run build
```

سيتم إنشاء مجلد:

```text
dist/
```

## 8. النشر على Firebase Hosting

```bash
firebase deploy --only hosting
```

## 8.1 التحقق من صفحات Google Play المطلوبة

بعد النشر افتح هذه الروابط وتأكد أنها تعمل بدون تسجيل دخول:

```text
https://notictahiro.web.app/privacy
https://notictahiro.web.app/delete-data
https://notictahiro.web.app/about
https://notictahiro.web.app/contact
https://notictahiro.web.app/app-ads.txt
```

إذا ظهر لك 404، تأكد أن `firebase.json` يحتوي على rewrites إلى `/index.html`.

## 9. روابط الصفحات المستقلة

بفضل إعداد `rewrites` في `firebase.json`، ستعمل الروابط التالية مباشرة:

```text
/privacy
/delete-data
/about
/contact
```

## ملاحظات مهمة

- لا ترفع ملفات المفاتيح السرية إلى GitHub.
- لا تضع مفاتيح Gemini أو Firebase Admin داخل الواجهة.
- صفحات الخصوصية وحذف البيانات يجب أن تكون منشورة برابط HTTPS لاستخدامها في Google Play و AdMob و AdSense.
- إذا استخدمت AdMob لاحقاً، أضف `app-ads.txt` في نطاق موقعك الرسمي.
- ملف `app-ads.txt` موجود حالياً في `public/app-ads.txt` ويجب أن يظهر بعد النشر على رابط الجذر: `/app-ads.txt`.
- لا تنس استخدام رابط سياسة الخصوصية العام داخل Google Play Console.
- راجع مجلد `play-store/` قبل إرسال التطبيق للمراجعة.
- راجع `STORE_COMPLIANCE_AUDIT.md` و `APP_PRIVACY_DETAILS.md` قبل إرسال التطبيق إلى Google Play أو App Store.