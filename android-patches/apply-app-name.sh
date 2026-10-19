#!/bin/bash
# ============================================================
# apply-app-name.sh — ضبط اسم التطبيق الظاهر عند التثبيت
# ------------------------------------------------------------
# cap sync لا يُحدّث strings.xml الموجود دائماً (يولّده مرة واحدة
# عند cap add فقط). هذا السكريبت يضمن أن app_name = "Notic Tahiro Ai"
# في strings.xml بصرف النظر. يُشغَّل بعد: npx cap sync android
# ============================================================

set -e

APP_NAME="Notic Tahiro Ai"
STRINGS="android/app/src/main/res/values/strings.xml"

if [ ! -f "$STRINGS" ]; then
  echo "❌ strings.xml غير موجود — شغّل npx cap sync android أولاً"
  exit 1
fi

python3 - << PYEOF
import re

path = "$STRINGS"
app_name = "$APP_NAME"

with open(path, encoding="utf-8") as f:
    content = f.read()

# نُحدّث قيمتي app_name و title (كلاهما يظهران للمستخدم)
def set_string(c, name, value):
    pattern = r'(<string name="' + name + r'">)(.*?)(</string>)'
    if re.search(pattern, c):
        return re.sub(pattern, r'\g<1>' + value + r'\g<3>', c)
    return c

content = set_string(content, "app_name", app_name)
content = set_string(content, "title_activity_main", app_name)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"✅ اسم التطبيق = {app_name}")
PYEOF

echo "✅ ضبط اسم التطبيق اكتمل!"
