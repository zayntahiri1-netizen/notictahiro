#!/usr/bin/env bash
# قياس نتائج R8 من الحزمة النهائية — لا من الإعدادات التي طُلبت.
#
# لماذا هذه الخطوة موجودة:
#   وثيقة Google لمعالجة «تحسين رموز DEX منخفض» تطلب فتح الحزمة في
#   أداة تحليل APK داخل Android Studio. وهذا متعذّر هنا: البناء يجري
#   على GitHub Actions بلا واجهة، والمطوّر يعمل من Termux على هاتف.
#   فنُعيد التحليل نفسه في سجلّ البناء.
#
# والأهمّ: الملف r8.json يحمل — بنصّ الوثيقة — البيانات الوصفية
# الدقيقة التي تحتسب منها «مؤشرات Android الحيوية» نتيجتك. فطبعُه
# هنا يعني رؤية أرقام Play قبل الرفع لا بعده.
#
# ⚠️ خطوات GitHub تعمل بـbash -e، و grep يرجع 1 حين لا يجد شيئاً.
#    و pipefail ينقل ذلك إلى الإسناد نفسه فتُجهَض الخطوة على حزمة
#    سليمة. ولهذا pipefail مُستبعَد هنا عمداً، وكل أنبوب قد يخلو من
#    نتيجة محروسٌ بـ|| true صراحةً.
#
#    والقاعدة الحاكمة: هذه خطوة **قياس**. لا يجوز أن تُفشِل بناءً
#    ناجحاً مهما كان ما تجده — فهي تُبلِّغ ولا تحكم. ولهذا تنتهي
#    بـexit 0 دائماً، وموضعها في سير العمل بعد رفع الملفات.
set -u

AAB="${1:-}"
if [ -z "$AAB" ] || [ ! -f "$AAB" ]; then
  # تحذير لا خطأ: الرفع جرى قبل هذه الخطوة، فلا داعي لإسقاط بناء ناجح.
  echo "::warning::الحزمة غير موجودة للقياس: ${AAB:-<فارغ>}"
  exit 0
fi

echo "══════════════════════════════════════════════════════════"
echo "  قياس DEX و R8 — $(basename "$AAB")"
echo "══════════════════════════════════════════════════════════"

# ─── 1. حجم DEX غير المضغوط ───────────────────────────────────────────
# أمر Google حرفياً من الوثيقة، مع حرسٍ على الحالة الفارغة.
DEX_BYTES=$(unzip -l "$AAB" 2>/dev/null | { grep -E '\.dex$' || true; } | awk '{sum+=$1} END {print sum+0}')
DEX_LIST=$(unzip -l "$AAB" 2>/dev/null | grep -E '\.dex$' || true)
DEX_COUNT=$(printf '%s' "$DEX_LIST" | { grep -c . || true; })

echo
echo "── حجم رموز DEX (غير مضغوط) ──"
if [ "${DEX_BYTES:-0}" -eq 0 ]; then
  echo "  ⚠️ لم يُعثر على ملفات .dex داخل الحزمة"
else
  printf '  %s بايت  ≈  %s ميبيبايت  (%d ملف)\n' \
    "$DEX_BYTES" "$(awk -v b="$DEX_BYTES" 'BEGIN{printf "%.2f", b/1048576}')" "$DEX_COUNT"
  # العتبة من الوثيقة: التطبيقات 10 ميغابايت، الألعاب 50.
  if [ "$DEX_BYTES" -ge 10485760 ]; then
    echo "  ℹ️  فوق عتبة التنبيه للتطبيقات (10 ميبيبايت) — Play يقيس التحسين ويُنبّه"
  else
    echo "  ✅ تحت عتبة التنبيه للتطبيقات (10 ميبيبايت) — لا تنبيه حتى لو كان التحسين منخفضاً"
  fi
  printf '%s\n' "$DEX_LIST" | sed 's/^/     /'
fi

# ─── 2. r8.json — أرقام Play نفسها ────────────────────────────────────
# AGP 8.10+ يُضمّنه. و Capacitor 8 يستعمل AGP 8.13، فالمتوقَّع وجوده.
echo
echo "── r8.json (البيانات الوصفية التي تحتسب منها Play) ──"
R8JSON=$(unzip -p "$AAB" 'BUNDLE-METADATA/com.android.tools/r8.json' 2>/dev/null || true)
if [ -n "$R8JSON" ]; then
  echo "  ✅ موجود — هذه أرقامك الفعلية:"
  printf '%s' "$R8JSON" | python3 -c "
import json,sys
raw=sys.stdin.read()
try:
    print('\n'.join('     '+l for l in json.dumps(json.loads(raw), indent=2, ensure_ascii=False).splitlines()))
except Exception:
    print('\n'.join('     '+l for l in raw.splitlines()))
"
else
  echo "  ⚠️ غير موجود. فتحتسب Play من mapping.txt إن وُجد، وإلّا من إحصاءات DEX."
  echo "     (متوقَّع وجوده مع AGP 8.10+ — فغيابه يستحقّ النظر)"
fi

# ─── 3. mapping — مسار الاحتساب البديل، وفكّ آثار الانهيار ────────────
echo
echo "── ملف الربط (mapping) ──"
MAP_LINE=$(unzip -l "$AAB" 2>/dev/null | grep -iE 'proguard\.map|mapping\.txt|obfuscation' || true)
if [ -n "$MAP_LINE" ]; then
  echo "  ✅ مُضمَّن في الحزمة — Play سيفكّ تعتيم آثار الانهيار تلقائياً:"
  printf '%s\n' "$MAP_LINE" | sed 's/^/     /'
else
  echo "  ⚠️ غير مُضمَّن. أثرُه: آثار الانهيار في Play Console تبقى معتَّمة،"
  echo "     ويضيع مسار الاحتساب البديل إن غاب r8.json أيضاً."
fi

# ─── 4. توزّع الأصناف على الحزم ونسبة التعتيم ─────────────────────────
# ⚠️ هذا عدٌّ للأصناف لا قياسٌ لحجمها بالبايت — مؤشّر لا رقم نهائي.
#    الوثيقة تطلب البحث عن «حزم كبيرة لا تُعتَّم»، وعدد الأصناف أقرب
#    ما يُستخرج بلا Android Studio. والأرقام القاطعة في r8.json أعلاه.
echo
echo "── توزّع الأصناف على الحزم (مؤشّر بالعدد لا بالبايت) ──"
python3 - "$AAB" <<'PY'
import collections, re, sys, zipfile

aab = sys.argv[1]
blob = b''
with zipfile.ZipFile(aab) as z:
    dex = [n for n in z.namelist() if n.endswith('.dex')]
    for n in dex:
        blob += z.read(n)

if not blob:
    print('     (لا ملفات DEX)')
    raise SystemExit(0)

# واصفات الأصناف في DEX مخزَّنة نصّاً بصيغة Lcom/foo/Bar;
descs = set(re.findall(rb'L([a-zA-Z0-9_$/]{2,200});', blob))
if not descs:
    print('     (لم تُستخرج واصفات)')
    raise SystemExit(0)

# R8 يُعيد التسمية افتراضياً إلى a, b, … aa, ab — حروف صغيرة قصيرة.
# ⚠️ استدلال لا قياس: اسمٌ أصلي قصير وصغير الحروف يُحسب معتَّماً خطأً.
# والأرقام القاطعة في r8.json أعلاه، وهذا الجدول لتوجيه النظر فقط.
OBF = re.compile(r'^[a-z$]{1,3}[0-9]{0,2}$')

pkgs = collections.Counter()
obf  = collections.Counter()
for d in descs:
    s = d.decode('utf-8', 'replace')
    parts = s.split('/')
    if len(parts) < 2:
        continue
    # الحزمة = المسار كاملاً دون اسم الصنف — وهو ما تستهدفه قاعدة keep
    pkg = '.'.join(parts[:-1])
    pkgs[pkg] += 1
    if OBF.match(parts[-1]):
        obf[pkg] += 1

tot = sum(pkgs.values())
tot_obf = sum(obf.values())
print(f'     إجمالي الأصناف: {tot} · المعتَّمة: {tot_obf} '
      f'({100*tot_obf//tot if tot else 0}%)')
print()
print(f'     {"الحزمة":<52}{"أصناف":>7}{"معتَّمة":>9}')
print('     ' + '─'*68)
for pkg, n in pkgs.most_common(18):
    o = obf[pkg]
    print(f'     {pkg[:52]:<52}{n:>7}{(str(100*o//n)+"%"):>9}')

# الحزم الكبيرة غير المعتَّمة — ما تطلب الوثيقة البحث عنه بالضبط
print()
susp = [(p, n, obf[p]) for p, n in pkgs.most_common() if n >= 40 and obf[p]*100 < n*20]
if susp:
    print('     ⚠️ حزم كبيرة تعتيمها منخفض — راجع قواعد keep المطابقة لها:')
    for p, n, o in susp[:10]:
        print(f'        -keep …{p}.**   →  {n} صنفاً، {100*o//n}% معتَّم')
else:
    print('     ✅ لا حزمة كبيرة بتعتيم منخفض')
PY

echo
echo "══════════════════════════════════════════════════════════"
# خطوة قياس: تُبلِّغ ولا تحكم.
exit 0
