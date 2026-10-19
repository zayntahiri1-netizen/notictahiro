#!/bin/bash
# ============================================================
# apply-tts.sh — إعداد محرك النطق الأصلي (Text-to-Speech)
# ------------------------------------------------------------
# مكتبة @capacitor-community/text-to-speech تحتاج إعلان
# <queries> في AndroidManifest للتطبيقات التي تستهدف Android 11+
# (لرؤية محرك TTS المُثبَّت على النظام). بدون هذا قد لا يجد
# المحرك على أندرويد 11 فأعلى.
# يُشغَّل بعد: npx cap sync android
# ============================================================

set -e

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ AndroidManifest.xml غير موجود — شغّل npx cap sync android أولاً"
  exit 1
fi

python3 - << 'PYEOF'
import re

path = "android/app/src/main/AndroidManifest.xml"
with open(path, encoding="utf-8") as f:
    content = f.read()

if "android.intent.action.TTS_SERVICE" in content:
    print("✅ <queries> الخاص بـ TTS موجود مسبقاً")
else:
    queries_block = '''    <queries>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>
'''
    # ندرج <queries> مباشرة بعد فتح <manifest ...>
    m = re.search(r'(<manifest[^>]*>)', content)
    if m:
        insert_at = m.end()
        content = content[:insert_at] + "\n" + queries_block + content[insert_at:]
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("✅ أُضيف <queries> الخاص بـ TTS للـ Manifest")
    else:
        print("❌ لم يُعثر على وسم <manifest> في الملف")
PYEOF

echo "✅ إعداد TTS الأصلي اكتمل!"
