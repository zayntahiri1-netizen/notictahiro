#!/bin/bash
# ============================================================
# apply-backup-rules.sh
# ------------------------------------------------------------
# يحدّد ما يُسمح لـAndroid Auto Backup برفعه إلى Google Drive.
# ------------------------------------------------------------
# الخلفية:
#   قالب Capacitor يضع android:allowBackup="true" ولا يضع أي قواعد.
#   ومعنى ذلك أن النظام يرفع **كل** ما في مجلدات التطبيق إلى Drive —
#   بما فيه مجلد النسخ الاحتياطية (لقطة JSON كاملة من الملاحظات والديون
#   والمعاملات والميزانية) والمقاطع الصوتية الخام.
#
# ماذا نستبعد ولماذا:
#   files/backups     — مستبعَد. لقطة كاملة مكرّرة: بيانات المستخدم
#                       مرفوعة أصلاً من localStorage، فإدراج النسخ يضاعف
#                       مدى الانكشاف بلا أي فائدة للمستخدم.
#   files/voice-notes — مستبعَد. تسجيلات صوتية خام، وهي أحسّ ما يملكه
#                       التطبيق، وتُضخّم حجم النسخة بلا مقابل.
#
# ⚠️ وما لا نستبعده — قرارٌ متعمَّد لا سهو:
#   بيانات WebView (localStorage) تبقى مشمولة. فAuto Backup يرفع إلى
#   حساب Google الخاص بالمستخدم نفسه، مشفَّراً، ومقيَّداً برمز الجهاز
#   على أندرويد 9+ — فهو ليس انكشافاً لطرف ثالث. واستبعادها يعني أن
#   المستخدم الذي يُبدّل هاتفه يفقد كل شيء، وهذه خسارةٌ حقيقية مقابل
#   ربحٍ أمني وهمي. وallowBackup يبقى true لهذا السبب عينه.
#
# ملف لكل عصر — والنظام يختار:
#   fullBackupContent     → أندرويد 11 وما قبله
#   dataExtractionRules   → أندرويد 12 وما بعده (نسخ سحابي + نقل جهاز)
# وجود واحد دون الآخر يترك نصف الأجهزة بلا قواعد.
# ============================================================
set -u

MANIFEST="android/app/src/main/AndroidManifest.xml"
XMLDIR="android/app/src/main/res/xml"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ $MANIFEST غير موجود — هل جرى npx cap add android؟"
  exit 1
fi

mkdir -p "$XMLDIR"

# ── 1) أندرويد 11 وما قبله ────────────────────────────────────────
cat > "$XMLDIR/backup_rules.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- أُنشئ بواسطة android-patches/apply-backup-rules.sh — لا تُحرّره يدوياً -->
<full-backup-content>
    <exclude domain="file" path="backups" />
    <exclude domain="file" path="voice-notes" />
</full-backup-content>
XML

# ── 2) أندرويد 12 وما بعده ────────────────────────────────────────
# قسمان منفصلان: cloud-backup (إلى Drive) وdevice-transfer (نقل مباشر
# بين جهازين). القواعد لا تُورَّث بينهما، فالإغفال في أحدهما يُبطل الحماية.
cat > "$XMLDIR/data_extraction_rules.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- أُنشئ بواسطة android-patches/apply-backup-rules.sh — لا تُحرّره يدوياً -->
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="file" path="backups" />
        <exclude domain="file" path="voice-notes" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="file" path="backups" />
        <exclude domain="file" path="voice-notes" />
    </device-transfer>
</data-extraction-rules>
XML

echo "✅ ملفَّا القواعد كُتبا في $XMLDIR/"

# ── 3) ربطهما في وسم <application> ────────────────────────────────
python3 - "$MANIFEST" <<'PY'
import re, sys

path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    content = f.read()

needed = {
    'android:fullBackupContent':   '@xml/backup_rules',
    'android:dataExtractionRules': '@xml/data_extraction_rules',
}

missing = {k: v for k, v in needed.items() if k not in content}
if not missing:
    print('ℹ️  السمتان مربوطتان مسبقاً — لا تغيير')
    sys.exit(0)

m = re.search(r'<application\b', content)
if not m:
    print('❌ لم أجد وسم <application> في المانيفست')
    sys.exit(1)

attrs = ''.join(f'\n        {k}="{v}"' for k, v in missing.items())
content = content[:m.end()] + attrs + content[m.end():]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('✅ أُضيفت: ' + ', '.join(missing))
PY
RC=$?
[ "$RC" -ne 0 ] && exit "$RC"

# ── 4) تحقّق — لا نكتفي بأن السكربت "جرى" ─────────────────────────
FAIL=0
for f in "$XMLDIR/backup_rules.xml" "$XMLDIR/data_extraction_rules.xml"; do
  if [ ! -s "$f" ]; then echo "❌ $f فارغ أو مفقود"; FAIL=1; fi
done
for attr in "android:fullBackupContent" "android:dataExtractionRules"; do
  if ! grep -q "$attr" "$MANIFEST"; then echo "❌ $attr غير مربوطة في المانيفست"; FAIL=1; fi
done
# المسارات المستبعَدة يجب أن تطابق ما يكتبه الكود فعلاً:
#   Directory.Data في Capacitor = getFilesDir() = domain="file"
#   autoBackup.ts يكتب في DIR='backups'، وVoiceRecorder.tsx في 'voice-notes'
for p in backups voice-notes; do
  N=$(grep -c "path=\"$p\"" "$XMLDIR/data_extraction_rules.xml")
  if [ "$N" -ne 2 ]; then echo "❌ '$p' مستبعَد في $N قسماً من قسمين"; FAIL=1; fi
done
[ "$FAIL" -ne 0 ] && exit 1

echo "✅ قواعد النسخ الاحتياطي مطبَّقة ومُتحقَّق منها (backups + voice-notes مستبعَدان)"
