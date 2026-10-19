#!/bin/bash
# ============================================================
# apply-firebase.sh — تفعيل Firebase الأصلي (SDK حقيقي) على أندرويد
# ------------------------------------------------------------
# يُشغَّل بعد: npx cap sync android
#
# ملاحظة مهمة (اكتشاف مؤكَّد من قالب Capacitor 8 الرسمي):
#   android/build.gradle (الجذر) يحتوي أصلاً على
#     classpath 'com.google.gms:google-services:4.4.4'
#   و android/app/build.gradle يحتوي أصلاً على كتلة تطبق الـ plugin
#   تلقائياً IF وُجد ملف google-services.json في app/ — لا حاجة
#   لإضافة أي من هذين يدوياً، Capacitor يفعلها افتراضياً منذ سنوات.
#
#   كل ما يلزم فعلياً: (1) نسخ google-services.json للمكان الصحيح،
#   و(2) إضافة Firebase BoM + firebase-analytics لقسم dependencies.
# ============================================================

if [ ! -d "android" ]; then
  echo "❌ android/ غير موجود. شغّل: npx cap add android"
  exit 1
fi

# ── 1) نسخ google-services.json للمكان الصحيح (app-level) ──────────
SRC_JSON="android-patches/google-services.json"
DST_JSON="android/app/google-services.json"

if [ ! -f "$SRC_JSON" ]; then
  echo "❌ android-patches/google-services.json غير موجود — حمّله من Firebase Console"
  exit 1
fi

cp "$SRC_JSON" "$DST_JSON"
echo "✅ google-services.json نُسخ إلى android/app/"

# تحقق سريع أن package_name يطابق appId الفعلي للمشروع
APP_ID=$(grep -oP "appId:\s*'([^']+)'" capacitor.config.ts | head -1 | sed -E "s/appId:\s*'([^']+)'/\1/")
JSON_PKG=$(grep -oP '"package_name":\s*"([^"]+)"' "$DST_JSON" | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
if [ "$APP_ID" != "$JSON_PKG" ]; then
  echo "⚠️  تحذير: appId ($APP_ID) لا يطابق package_name في google-services.json ($JSON_PKG)"
  echo "    Firebase سيفشل بصمت إن لم يتطابقا — تأكد من تحميل ملف JSON الصحيح من Firebase Console"
else
  echo "✅ appId يطابق package_name في google-services.json ($APP_ID)"
fi

# ── 2) إضافة Firebase BoM + Analytics SDK لـ app/build.gradle ──────
BUILD_GRADLE="android/app/build.gradle"

if grep -q "firebase-analytics" "$BUILD_GRADLE" 2>/dev/null; then
  echo "✅ firebase-analytics موجود مسبقاً في build.gradle"
else
  python3 - << 'PYEOF'
import re

with open("android/app/build.gradle", "r") as f:
    content = f.read()

firebase_deps = '''
    // ── Firebase (أُضيف عبر apply-firebase.sh) ──────────────────────
    implementation platform('com.google.firebase:firebase-bom:34.14.1')
    implementation 'com.google.firebase:firebase-analytics'
'''

if "dependencies {" in content:
    # أضف داخل أول كتلة dependencies { } نجدها (كتلة التبعيات الرئيسية)
    content = re.sub(r'(dependencies\s*\{)', r'\1' + firebase_deps, content, count=1)
    with open("android/app/build.gradle", "w") as f:
        f.write(content)
    print("✅ Firebase BoM + firebase-analytics أُضيفا لـ build.gradle")
else:
    print("❌ لم يُعثر على كتلة dependencies { } في build.gradle")
PYEOF
fi

echo ""
echo "✅ إعداد Firebase الأصلي اكتمل!"
echo "   (classpath الجذر + تطبيق الـ plugin التلقائي موجودان أصلاً في قالب Capacitor 8)"
