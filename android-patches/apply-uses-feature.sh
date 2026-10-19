#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# apply-uses-feature.sh — منع حجب التطبيق عن أجهزة لا تحتاج عتادها
# ═══════════════════════════════════════════════════════════════════════
# المشكلة — وهي غير بديهية ولا تُنتج أي خطأ في البناء:
#
# أندرويد يستنتج متطلبات عتاد من الأذونات وحدها. إعلان RECORD_AUDIO
# يُضيف ضمنياً:
#     <uses-feature android:name="android.hardware.microphone"
#                   android:required="true" />
# والقيمة الافتراضية لـ required هي true. ومتى كان متطلَّباً، **يحجب
# Google Play التطبيق عن كل جهاز لا يملك ميكروفوناً**: لا يظهر في البحث،
# ولا يمكن تنزيله. وهذا بالضبط شطر "أو تحميله" في مخالفة الوظائف
# المعطّلة — المستخدم لا يرى عطباً، يرى تطبيقاً لا يستطيع تثبيته.
#
# كذلك android.hardware.touchscreen متطلَّب افتراضياً لكل تطبيق، فيحجبه
# عن Chromebook والأجهزة التي تُستعمل بمؤشّر.
#
# التدوين الصوتي هنا ميزة مساعدة لا جوهر التطبيق: مفكّرة بلا ميكروفون
# تظل مفكّرة كاملة. فلا معنى لحرمان صاحب جهاز بلا ميكروفون منها.
#
# ⚠️ required="false" لا يُلغي طلب الإذن وقت التشغيل — المستخدم يُسأل
# كالمعتاد عند أول تدوين صوتي. يُلغي فقط الحجب عند التنزيل.
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"
[ -f "$MANIFEST" ] || { echo "❌ AndroidManifest.xml غير موجود"; exit 1; }

if grep -q "android.hardware.microphone" "$MANIFEST"; then
  echo "✅ تصريحات uses-feature موجودة مسبقاً"
  exit 0
fi

python3 -I - "$MANIFEST" <<'PYEOF'
import sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    content = f.read()

features = '''
    <!-- ══════════════════════════════════════════════════════════════
         متطلبات العتاد — صريحة عمداً

         أندرويد يستنتجها من الأذونات ويجعلها required="true" افتراضياً،
         فيحجب Play التطبيق عن الأجهزة التي تفتقدها. كل ميزة هنا مساعدة
         لا جوهرية: التطبيق مفكّرة كاملة بدونها.
         ═══════════════════════════════════════════════════════════════ -->
    <!-- يأتي ضمنياً من RECORD_AUDIO. التدوين الصوتي ميزة مساعدة. -->
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    <!-- متطلَّب افتراضياً لكل تطبيق — إعلانه false يُتيحه على Chromebook -->
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
'''

idx = content.find('<application')
if idx == -1:
    print("❌ لم يُعثر على <application>"); sys.exit(1)

# تُدرَج قبل <application> — الموضع المعتاد لتصريحات المستوى الأعلى
content = content[:idx] + features.lstrip('\n') + '\n    ' + content[idx:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ أُضيفت تصريحات uses-feature (microphone + touchscreen = اختيارية)")
PYEOF

echo ""
echo "✅ لن يُحجب التطبيق عن الأجهزة بلا ميكروفون أو بلا شاشة لمس"
