#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# apply-r8.sh — تفعيل R8 (تقليص وتحسين وتعتيم رمز DEX)
# ═══════════════════════════════════════════════════════════════════════
# لماذا:
#   لوحة Play تُظهر «تحسين رمز DEX: منخفضة» وكل الخانات فارغة أو 1%،
#   أي أن R8 مُطفأ بالكامل. وحجم DEX غير المضغوط 18.4 ميغابايت — فوق
#   عتبة التنبيه (10 ميغابايت للتطبيقات)، ولهذا وصل الإنذار.
#
# ما لا يفعله هذا السكربت عمداً:
#   لا يُفعّل shrinkResources. مقاييس Play الثلاثة (التحسين، الإخفاء،
#   تقليص الرموز) كلّها على **الكود** لا على الموارد. وتقليص الموارد
#   يكسر ما يُحمَّل بالاسم عبر getIdentifier — خطرٌ زائد بلا أي أثر على
#   التنبيه الذي نعالجه.
#
# ⚠️ التأثير يقع في نسخة الإصدار وحدها. نسخة debug و `npm run dev` لا
#    تمرّان بـR8 أصلاً، فنجاحهما لا يُثبت شيئاً عن سلامة هذا التغيير.
#    الاختبار الحقيقي الوحيد: تثبيت **release APK** على جهاز.
set -euo pipefail

# ─── مفتاح إطفاء ──────────────────────────────────────────────────────
# إن ظهر عطب في نسخة الإصدار بعد التفعيل، يُطفأ R8 فوراً بضبط متغيّر
# DISABLE_R8=1 في إعدادات المستودع (Settings → Variables) — بلا تعديل
# كود ولا دفعة جديدة. ثم يُعاد تشغيل البناء.
# الرجوع يجب أن يكون أسرع من التشخيص حين يكون 454 مستخدماً على الخطّ.
if [ "${DISABLE_R8:-0}" = "1" ]; then
  echo "⏭️  R8 مُعطَّل عبر DISABLE_R8=1 — البناء يمضي بلا تعتيم"
  exit 0
fi

GRADLE="android/app/build.gradle"
RULES_SRC="android-patches/proguard-notic.pro"
RULES_DST="android/app/proguard-notic.pro"

[ -f "$GRADLE" ]    || { echo "::error::$GRADLE غير موجود — هل جرى cap add android؟"; exit 1; }
[ -f "$RULES_SRC" ] || { echo "::error::$RULES_SRC غير موجود"; exit 1; }

cp "$RULES_SRC" "$RULES_DST"
echo "📄 نُسخت قواعد الإبقاء إلى $RULES_DST"

python3 - "$GRADLE" <<'PY'
import os, re, sys

path = sys.argv[1]
src  = open(path, encoding='utf-8').read()

# ── خروج مبكر: التعديل مطبَّق مسبقاً (السكربت يُعاد تشغيله في كل بناء)
# ⚠️ الشرط يفحص التعديلات الثلاثة لا الأول وحده. فحصٌ ناقص هنا كان
#    سيُخرج السكربت باكراً على ملفٍ فُعِّل فيه R8 وبقي -dontoptimize.
shrink_ok = (os.environ.get('DISABLE_SHRINK_RES', '0') == '1'
             or re.search(r'shrinkResources\s+true', src))
if ('proguard-notic.pro' in src
        and re.search(r'minifyEnabled\s+true', src)
        and 'proguard-android.txt' not in src
        and shrink_ok):
    print('✅ R8 مُفعَّل مسبقاً — لا تغيير')
    raise SystemExit(0)

# ── إيجاد كتلة buildTypes { release { ... } } بعدّ الأقواس.
# ⚠️ العدّ لا regex: محتوى الكتلة يحوي أقواساً متداخلة، وتعبيرٌ نمطي
# جشِع يبتلع ما بعدها فيُفسد الملف كلّه.
m = re.search(r'buildTypes\s*\{', src)
if not m:
    print('::error::لم أجد buildTypes في build.gradle — لم يُطبَّق شيء')
    raise SystemExit(1)

i, depth = m.end(), 1
while i < len(src) and depth:
    if src[i] == '{': depth += 1
    elif src[i] == '}': depth -= 1
    i += 1
bt_start, bt_end = m.start(), i
block = src[bt_start:bt_end]

rel = re.search(r'release\s*\{', block)
if not rel:
    print('::error::لا توجد كتلة release داخل buildTypes — لم يُطبَّق شيء')
    raise SystemExit(1)

j, depth = rel.end(), 1
while j < len(block) and depth:
    if block[j] == '{': depth += 1
    elif block[j] == '}': depth -= 1
    j += 1
rel_body = block[rel.end():j-1]

# ── داخل كتلة release وحدها: فعّل minify وأضِف ملف القواعد
if re.search(r'minifyEnabled\s+(true|false)', rel_body):
    new_body = re.sub(r'minifyEnabled\s+(true|false)', 'minifyEnabled true', rel_body)
else:
    new_body = '\n            minifyEnabled true' + rel_body

if 'proguard-notic.pro' not in new_body:
    if re.search(r'proguardFiles[^\n]*', new_body):
        new_body = re.sub(
            r'(proguardFiles[^\n]*)',
            r"\1, 'proguard-notic.pro'",
            new_body, count=1)
    else:
        new_body += ("\n            proguardFiles "
                     "getDefaultProguardFile('proguard-android-optimize.txt'), "
                     "'proguard-rules.pro', 'proguard-notic.pro'\n        ")

# ── أخطر سطر في هذا الملف: استبدال ملف القواعد الافتراضي ──────────────
#
# قالب Capacitor يولّد: getDefaultProguardFile('proguard-android.txt')
# وأوّل سطر داخل ذلك الملف هو -dontoptimize — فيُعطّل مرحلة التحسين في
# R8 كلّها، ويبقى التقليص والتعتيم وحدهما. ولهذا كانت Play تقول
# «ميزة التحسين غير مفعَّلة» رغم أن R8 يعمل.
#
# و proguard-android-optimize.txt هو الملف نفسه حرفاً بحرف، ناقصاً
# -dontoptimize. فالاستبدال لا يُضيف قاعدةً ولا يحذف حمايةً — يرفع
# المنع فحسب.
#
# ⚠️ -dontoptimize عامّ لا موضعي: وجوده في أيّ ملف قواعد مشمول —
#    بما فيها قواعد المكتبات المستهلَكة — يُعطّل التحسين كلّه. ولهذا
#    نفحص إعدادات R8 المدمجة بعد البناء لا هذا الملف وحده.
if "proguard-android.txt" in new_body:
    new_body = new_body.replace("proguard-android.txt", "proguard-android-optimize.txt")
    print("🔧 استُبدل proguard-android.txt بـproguard-android-optimize.txt "
          "(رفعُ -dontoptimize)")

# ── تقليص الموارد ─────────────────────────────────────────────────────
# Play تطلبه صراحةً ضمن تنبيه الذاكرة والأداء. وخطره المعروف أنه يحذف
# ما يُحمَّل بالاسم عبر getIdentifier — وقد فُحص هذا المشروع فلا أثر
# لها فيه، وكل موارده يُشار إليها بثوابت R.xxx التي يتتبّعها المُقلِّص.
# وأصول الويب في assets/ لا يمسّها التقليص أصلاً (هو على res/ وحدها).
#
# ومفتاح إطفائه مستقلّ عن DISABLE_R8 عمداً: إن ظهر عطب بعد هذا الإصدار
# يمكن إطفاء التقليص وحده وإبقاء R8 — فيُعزل السبب في خطوة واحدة بدل
# التراجع عن كل شيء.
if os.environ.get('DISABLE_SHRINK_RES', '0') == '1':
    print('⏭️  تقليص الموارد مُعطَّل عبر DISABLE_SHRINK_RES=1')
elif re.search(r'shrinkResources\s+(true|false)', new_body):
    new_body = re.sub(r'shrinkResources\s+(true|false)', 'shrinkResources true', new_body)
else:
    new_body = '\n            shrinkResources true' + new_body

new_block = block[:rel.end()] + new_body + block[j-1:]
open(path, 'w', encoding='utf-8').write(src[:bt_start] + new_block + src[bt_end:])
print('✅ عُدِّل build.gradle: minifyEnabled + proguard-notic.pro + التحسين')
PY

# ── تحقّق فعلي بعد التعديل ────────────────────────────────────────────
# ⚠️ لا نثق بأن السكربت نجح لأنه لم يرمِ خطأً. سكربتٌ يطبع ✅ بلا أن
# يتحقّق هو أسوأ من سكربت يفشل: يُخفي العطب بدل أن يُظهره.
if ! grep -qE 'minifyEnabled\s+true' "$GRADLE"; then
  echo "::error::minifyEnabled true غير موجود بعد التعديل — R8 ما زال مُطفأً"
  exit 1
fi
if ! grep -q 'proguard-notic.pro' "$GRADLE"; then
  echo "::error::ملف القواعد غير مُسجَّل في build.gradle — R8 سيعمل بلا حماية الإضافات"
  exit 1
fi
# ⚠️ ما تحت هذا يُفحص داخل كتلة release وحدها، لا في الملف كلّه.
#    فحصٌ على الملف كاملاً كان سيُفشل البناء بإنذار كاذب لو ورد الاسم
#    في كتلة debug — وهي كتلة لا يمسّها هذا السكربت ولا يعمل فيها R8.
python3 - "$GRADLE" "${DISABLE_SHRINK_RES:-0}" <<'PY'
import re, sys
path, shrink_off = sys.argv[1], sys.argv[2] == '1'
src = open(path, encoding='utf-8').read()

m = re.search(r'buildTypes\s*\{', src)
i, d = m.end(), 1
while i < len(src) and d:
    if src[i] == '{': d += 1
    elif src[i] == '}': d -= 1
    i += 1
block = src[m.start():i]
rel = re.search(r'release\s*\{', block)
j, d = rel.end(), 1
while j < len(block) and d:
    if block[j] == '{': d += 1
    elif block[j] == '}': d -= 1
    j += 1
body = block[rel.end():j-1]

errs = []
# proguard-android.txt يحمل -dontoptimize، وبقاؤه يعني R8 بلا تحسين —
# وهو عين ما تشكو منه Play.
if 'proguard-android.txt' in body:
    errs.append('proguard-android.txt ما زال في كتلة release — '
                '-dontoptimize فعّال والتحسين مُعطَّل')
if 'proguard-android-optimize.txt' not in body:
    errs.append('proguard-android-optimize.txt غير مُسجَّل في كتلة release')
if not shrink_off and not re.search(r'shrinkResources\s+true', body):
    errs.append('shrinkResources true غير موجود في كتلة release')

for e in errs:
    print(f'::error::{e}')
raise SystemExit(1 if errs else 0)
PY
[ -f "$RULES_DST" ] || { echo "::error::$RULES_DST غير موجود"; exit 1; }

echo "✅ R8 مُفعَّل، والتحسين مرفوع المنع، وقواعد الإبقاء في مكانها"
grep -nE 'minifyEnabled|shrinkResources|proguardFiles' "$GRADLE" | sed 's/^/   /'
