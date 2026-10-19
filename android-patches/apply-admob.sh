#!/bin/bash
# ============================================================
# apply-admob.sh — تهيئة AdMob كاملة في أندرويد
# يُشغَّل بعد: npx cap sync android
# ============================================================

MANIFEST="android/app/src/main/AndroidManifest.xml"
BUILD_GRADLE="android/app/build.gradle"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ android/ غير موجود. شغّل: npx cap add android"
  exit 1
fi

# ── 1. APPLICATION_ID في AndroidManifest ────────────────────
if grep -q "com.google.android.gms.ads.APPLICATION_ID" "$MANIFEST"; then
  echo "✅ AdMob APPLICATION_ID موجود مسبقاً"
else
  python3 - << 'PYEOF'
import re
with open("android/app/src/main/AndroidManifest.xml", "r") as f:
    content = f.read()

admob_meta = '''
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-1725525147318224~8481725862"/>'''

content = re.sub(
    r'(<application[^>]*>)',
    r'\1' + admob_meta,
    content,
    count=1
)
with open("android/app/src/main/AndroidManifest.xml", "w") as f:
    f.write(content)
print("✅ AdMob APPLICATION_ID أُضيف لـ AndroidManifest.xml")
PYEOF
fi

# ── 2. INTERNET + NETWORK permissions (حرج لـ AdMob) ────────
if grep -q "android.permission.INTERNET" "$MANIFEST"; then
  echo "✅ INTERNET permission موجودة"
else
  python3 - << 'PYEOF'
import re
with open("android/app/src/main/AndroidManifest.xml", "r") as f:
    content = f.read()

perms = '''    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
'''
content = re.sub(r'(\s*<application)', '\n' + perms + r'\1', content, count=1)
with open("android/app/src/main/AndroidManifest.xml", "w") as f:
    f.write(content)
print("✅ INTERNET + NETWORK permissions أُضيفت (مطلوبة لـ AdMob)")
PYEOF
fi

# ── 3. أذونات الميكروفون والإشعارات ─────────────────────────
if grep -q "android.permission.RECORD_AUDIO" "$MANIFEST"; then
  echo "✅ أذونات الميكروفون والإشعارات موجودة"
else
  python3 - << 'PYEOF2'
import re
with open("android/app/src/main/AndroidManifest.xml", "r") as f:
    content = f.read()

perms = """    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
"""
content = re.sub(r'(\s*<application)', '\n' + perms + r'\1', content, count=1)
with open("android/app/src/main/AndroidManifest.xml", "w") as f:
    f.write(content)
print("✅ أذونات الميكروفون والإشعارات أُضيفت")
PYEOF2
fi

# ── 4. نسخة مكتبة إعلانات Google (عبر المتغيّر الرسمي للإضافة) ──────
# @capacitor-community/admob يقرأ النسخة من المتغيّر playServicesAdsVersion
# في android/variables.gradle، وقيمته الافتراضية 23.0.0 — نسخة قديمة.
# Google تقلّص نسبة العرض (fill) للنسخ القديمة، لذا نفرض نسخة حديثة.
VARS="android/variables.gradle"
ADS_VER="24.0.0"
if [ -f "$VARS" ]; then
  if grep -q "playServicesAdsVersion" "$VARS"; then
    sed -i -E "s/(playServicesAdsVersion[[:space:]]*=[[:space:]]*).*/\1'$ADS_VER'/" "$VARS"
  else
    # أدرج داخل كتلة ext { }
    sed -i "0,/ext[[:space:]]*{/s//ext {\n    playServicesAdsVersion = '$ADS_VER'/" "$VARS"
  fi
  echo "✅ playServicesAdsVersion = $ADS_VER"
  grep -n "playServicesAdsVersion" "$VARS"
else
  echo "⚠️ variables.gradle غير موجود — تخطّي ضبط نسخة SDK"
fi

# نظّف أي تثبيت يدوي قديم في build.gradle (يتعارض مع المتغيّر أعلاه)
if grep -q 'play-services-ads:2' "$BUILD_GRADLE" 2>/dev/null; then
  sed -i '/play-services-ads:2/d' "$BUILD_GRADLE"
  echo "🧹 أُزيل تثبيت يدوي قديم لـ play-services-ads"
fi

# ── 5. إذن AD_ID — مطلوب من targetSdk 33+ لقراءة معرّف الإعلان ──────
# بدونه تصبح الإعلانات غير مُخصّصة وينخفض العائد/نسبة العرض بشدة.
# مكتبة الإعلانات تضيفه عادةً عبر دمج الـ manifest، لكن نصرّح به بوضوح
# ليطابق إقرار "معرّف الإعلان" في Play Console ولنتمكن من التحقق منه.
if grep -q "com.google.android.gms.permission.AD_ID" "$MANIFEST"; then
  echo "✅ إذن AD_ID موجود"
else
  python3 - << 'PYEOF4'
import re
path = "android/app/src/main/AndroidManifest.xml"
with open(path) as f:
    content = f.read()
perm = '    <uses-permission android:name="com.google.android.gms.permission.AD_ID"/>\n'
content = re.sub(r'(\s*<application)', '\n' + perm + r'\1', content, count=1)
with open(path, "w") as f:
    f.write(content)
print("✅ إذن AD_ID أُضيف (مطلوب للإعلانات المخصّصة على targetSdk 33+)")
PYEOF4
fi

echo ""
echo "✅ إعداد AdMob اكتمل!"
