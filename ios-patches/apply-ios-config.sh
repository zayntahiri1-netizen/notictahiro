#!/bin/bash
# ============================================================
# apply-ios-config.sh — حقن إعدادات Info.plist بعد cap add ios
#
# لماذا هذا السكربت حرج:
#   1) إضافة AdMob مثبتة عبر CocoaPods، وغياب GADApplicationIdentifier
#      من Info.plist = انهيار التطبيق فور الإقلاع على iOS
#      (GADInvalidInitializationException).
#   2) admob.ts يستدعي requestTrackingAuthorization — بدون
#      NSUserTrackingUsageDescription ترفض Apple التطبيق.
#   3) الإدخال الصوتي يحتاج NSMicrophoneUsageDescription
#      وNSSpeechRecognitionUsageDescription وإلا انهيار عند أول استخدام.
#
# معرّف AdMob لـ iOS:
#   AdMob App ID مختلف لكل منصة! ضع معرّف تطبيق iOS الحقيقي في
#   GitHub Secret باسم IOS_ADMOB_APP_ID (أنشئ تطبيق iOS في لوحة AdMob).
#   إن لم يُضبط: يُستخدم معرّف الاختبار الرسمي من Google (آمن سياسياً،
#   لا أرباح) مع تحذير واضح في سجل البناء.
#
# الاستخدام: bash ios-patches/apply-ios-config.sh   (بعد npx cap add ios)
# idempotent — تشغيله مرتين آمن.
# ============================================================
set -e

PLIST="ios/App/App/Info.plist"
PB="/usr/libexec/PlistBuddy"

if [ ! -f "$PLIST" ]; then
  echo "❌ $PLIST غير موجود. شغّل أولاً: npx cap add ios"
  exit 1
fi

# معرّف اختبار Google الرسمي لـ iOS — بديل آمن حتى يُنشأ تطبيق iOS في AdMob
GOOGLE_TEST_IOS_APP_ID="ca-app-pub-3940256099942544~1458002511"
ADMOB_ID="${IOS_ADMOB_APP_ID:-$GOOGLE_TEST_IOS_APP_ID}"

if [ "$ADMOB_ID" = "$GOOGLE_TEST_IOS_APP_ID" ]; then
  echo "⚠️  IOS_ADMOB_APP_ID غير مضبوط — سيُستخدم معرّف اختبار Google."
  echo "⚠️  لا أرباح إعلانات على iOS حتى تنشئ تطبيق iOS في لوحة AdMob"
  echo "⚠️  وتضع معرّفه (ca-app-pub-...~...) في GitHub Secrets باسم IOS_ADMOB_APP_ID."
fi

# دالة مساعدة: أضف المفتاح إن غاب، حدّثه إن وُجد (idempotent)
set_plist_string() {
  local key="$1" value="$2"
  if $PB -c "Print :${key}" "$PLIST" >/dev/null 2>&1; then
    $PB -c "Set :${key} ${value}" "$PLIST"
  else
    $PB -c "Add :${key} string ${value}" "$PLIST"
  fi
  echo "  ✅ ${key}"
}

echo "🍎 حقن إعدادات Info.plist..."

# 1) معرّف تطبيق AdMob — بدونه انهيار فوري عند الإقلاع
set_plist_string "GADApplicationIdentifier" "$ADMOB_ID"

# 2) وصف التتبع — مطلوب لأن AdMob.initialize يستدعي requestTrackingAuthorization
set_plist_string "NSUserTrackingUsageDescription" \
  "يُستخدم هذا الإذن لعرض إعلانات أكثر ملاءمة لك. يمكنك الرفض وستظل الإعلانات تعمل بشكل عام."

# 3) أذونات الإدخال الصوتي (الدارجة المغربية) — بدونها انهيار عند أول تسجيل
set_plist_string "NSMicrophoneUsageDescription" \
  "يحتاج Notic Tahiro للميكروفون لتحويل صوتك إلى نص في الملاحظات."
set_plist_string "NSSpeechRecognitionUsageDescription" \
  "يُستخدم التعرف على الكلام لتحويل التسجيل الصوتي إلى نص داخل ملاحظاتك."

# 4) SKAdNetworkItems — معرّف شبكة Google الرسمي (الحد الأدنى المطلوب لقياس الإعلانات)
if ! $PB -c "Print :SKAdNetworkItems" "$PLIST" >/dev/null 2>&1; then
  $PB -c "Add :SKAdNetworkItems array" "$PLIST"
  $PB -c "Add :SKAdNetworkItems:0 dict" "$PLIST"
  $PB -c "Add :SKAdNetworkItems:0:SKAdNetworkIdentifier string cstr6suwn9.skadnetwork" "$PLIST"
  echo "  ✅ SKAdNetworkItems (cstr6suwn9.skadnetwork)"
else
  echo "  ✅ SKAdNetworkItems موجود مسبقاً"
fi

echo "🍎 اكتمل حقن Info.plist بنجاح"
