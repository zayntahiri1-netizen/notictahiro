#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# check-permissions.sh — حارس الأذونات في البيان المدمج
# ═══════════════════════════════════════════════════════════════════════
# لماذا:
#   البيان الذي يصل إلى المستخدم ليس ما نكتبه في android-patches، بل
#   دمجٌ له مع بيان كل إضافة من إضافات npm الستّ عشرة ومع بيانات
#   مكتباتها (Google Mobile Ads، Firebase، AndroidX…). فإضافةٌ تُحدَّث
#   اليوم قد تُدخل إذناً مقيَّداً غداً بلا سطر واحد يتغيّر في مستودعك.
#
#   وسياسات Play لعام 2027 كلّها مبنيّة على الأذونات: الموقع الجغرافي
#   (إلزامي 27 يناير 2027)، وجهات الاتصال، وكل الملفات، وسجلّ المكالمات،
#   والرسائل القصيرة، والشبكة المحلية. فإذنٌ يدخل بصمت يعني نموذج بيانٍ
#   ناقصاً في Play Console — ورفضاً عند المراجعة لا تعرف سببه.
#
#   ولهذا يقرأ هذا الحارس الأذونات من الحزمة المبنيّة لا من المصدر.
#
# الاستعمال:
#   bash android-patches/check-permissions.sh <app.apk>
#   bash android-patches/check-permissions.sh --from-dump <ملف نصّي>   (للاختبار)
set -u

# ─── الأذونات التي نعرفها ونقبلها ────────────────────────────────────
# كلٌّ منها مبرَّر بوظيفة قائمة في التطبيق. ما خرج عنها يستحق نظرة.
EXPECTED="
android.permission.INTERNET
android.permission.ACCESS_NETWORK_STATE
android.permission.ACCESS_WIFI_STATE
android.permission.FOREGROUND_SERVICE
android.permission.FOREGROUND_SERVICE_SPECIAL_USE
android.permission.MODIFY_AUDIO_SETTINGS
android.permission.POST_NOTIFICATIONS
android.permission.RECEIVE_BOOT_COMPLETED
android.permission.RECORD_AUDIO
android.permission.SCHEDULE_EXACT_ALARM
android.permission.USE_EXACT_ALARM
android.permission.SYSTEM_ALERT_WINDOW
android.permission.VIBRATE
android.permission.WAKE_LOCK
com.google.android.gms.permission.AD_ID
android.permission.READ_MEDIA_IMAGES
android.permission.READ_MEDIA_VIDEO
android.permission.READ_MEDIA_AUDIO
android.permission.READ_MEDIA_VISUAL_USER_SELECTED
"

# ─── أذونات تُفشل البناء: كلٌّ منها يستدعي نموذج بيان في Play ─────────
# الرقم بعد الاسم هو السياسة والموعد، ليظهرا في رسالة الخطأ مباشرة.
RESTRICTED="
android.permission.ACCESS_FINE_LOCATION|الموقع الجغرافي الدقيق — نموذج بيان إلزامي من 27 يناير 2027
android.permission.ACCESS_COARSE_LOCATION|الموقع الجغرافي التقريبي — سياسة الحد الأدنى من النطاق
android.permission.ACCESS_BACKGROUND_LOCATION|الموقع في الخلفية — من أشد الأذونات تقييداً
android.permission.READ_CONTACTS|جهات الاتصال — نموذج بيان إلزامي
android.permission.WRITE_CONTACTS|كتابة جهات الاتصال — نموذج بيان إلزامي
android.permission.MANAGE_EXTERNAL_STORAGE|الوصول إلى كل الملفات — نموذج بيان ومبرر قوي
android.permission.READ_CALL_LOG|سجل المكالمات — يضيق نطاقه في 27 يناير 2027
android.permission.WRITE_CALL_LOG|كتابة سجل المكالمات — مقيد
android.permission.READ_SMS|الرسائل القصيرة — مقيد
android.permission.RECEIVE_SMS|استقبال الرسائل القصيرة — مقيد
android.permission.SEND_SMS|إرسال الرسائل القصيرة — مقيد
android.permission.ACCESS_LOCAL_NETWORK|الشبكة المحلية — نموذج بيان على targetSdk 37+
android.permission.QUERY_ALL_PACKAGES|استعلام كل التطبيقات — مقيد ويستدعي مبرراً
android.permission.BIND_ACCESSIBILITY_SERVICE|خدمة إمكانية الوصول — إفصاح وتصنيف خاص
android.permission.REQUEST_INSTALL_PACKAGES|تثبيت حزم — مقيد
"

# ─── استخراج الأذونات ─────────────────────────────────────────────────
if [ "${1:-}" = "--from-dump" ]; then
  DUMP=$(cat "${2:-/dev/null}")
else
  APK="${1:-}"
  if [ -z "$APK" ] || [ ! -f "$APK" ]; then
    echo "::warning::حزمة غير موجودة لفحص الأذونات: ${APK:-<فارغ>}"
    exit 0
  fi
  AAPT2=$(command -v aapt2 || ls "$ANDROID_HOME"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1)
  if [ -z "${AAPT2:-}" ]; then
    echo "::warning::aapt2 غير متاح — تعذّر فحص الأذونات"
    exit 0
  fi
  DUMP=$("$AAPT2" dump permissions "$APK" 2>/dev/null)
fi

PERMS=$(printf '%s\n' "$DUMP" \
  | grep -oE "(uses-permission:? *name=')[^']+" \
  | sed "s/.*name='//" | sort -u)

echo "══════════════════════════════════════════════════════════"
echo "  أذونات البيان المدمج — ما يصل إلى المستخدم فعلاً"
echo "══════════════════════════════════════════════════════════"
if [ -z "$PERMS" ]; then
  echo "  ⚠️ لم تُستخرج أي أذونات — تحقّق من صيغة المُخرَج"
  exit 0
fi
printf '%s\n' "$PERMS" | sed 's/^/  · /'
echo "  ─── المجموع: $(printf '%s\n' "$PERMS" | grep -c .) إذناً ───"

# ─── المقارنة ─────────────────────────────────────────────────────────
FAIL=0
echo
echo "── أذونات مقيَّدة بسياسات Play ──"
HITS=0
while IFS='|' read -r perm why; do
  [ -z "$perm" ] && continue
  if printf '%s\n' "$PERMS" | grep -qx "$perm"; then
    echo "::error::إذن مقيَّد في البيان المدمج: $perm — $why"
    HITS=$((HITS+1)); FAIL=1
  fi
done <<< "$RESTRICTED"
[ "$HITS" -eq 0 ] && echo "  ✅ لا إذن مقيَّد — لا نموذج بيان مطلوب"

echo
echo "── أذونات خارج القائمة المعروفة ──"
NEW=0
while read -r p; do
  [ -z "$p" ] && continue
  if ! printf '%s\n' "$EXPECTED" | grep -qx "$p"; then
    # المقيَّدة أُبلغ عنها أعلاه، فلا نكرّرها هنا
    printf '%s\n' "$RESTRICTED" | grep -q "^$p|" || {
      echo "  ⚠️ جديد: $p"
      echo "     ظهر دون أن يُكتب في مستودعك — غالباً من تحديث إضافة."
      NEW=$((NEW+1))
    }
  fi
done <<< "$PERMS"
[ "$NEW" -eq 0 ] && echo "  ✅ لا إذن غير متوقَّع"

echo
if [ "$FAIL" -eq 1 ]; then
  echo "❌ البناء متوقّف: إذن مقيَّد يحتاج نموذج بيان في Play Console."
  echo "   إمّا أن تُزيل الإضافة التي أدخلته، أو تملأ النموذج وتضيفه"
  echo "   إلى EXPECTED في هذا الملف بعد أن تقرّ بأنه مقصود."
  exit 1
fi
echo "✅ الأذونات سليمة"
exit 0
