#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# apply-share-target.sh — "مشاركة إلى Notic Tahiro" من أي تطبيق
# ═══════════════════════════════════════════════════════════════════════
# يجعل التطبيق يظهر في قائمة المشاركة بأندرويد: تختار نصاً في المتصفح أو
# واتساب أو يوتيوب → "مشاركة" → Notic Tahiro → يُفتح محرّر ملاحظة جاهزاً
# بالنص. أقصر طريق من "رأيت شيئاً" إلى "حفظته".
#
# ⚠️ الترتيب حرج: apply-bubble-overlay.sh يعيد كتابة MainActivity.java
# و BubbleOverlayPlugin.java بالكامل. لذا يجب تشغيل هذا السكربت **بعده**،
# وإلا مُحيت إضافاتنا بلا أي رسالة خطأ.
#
# آلية التمرير: نتبع نمط المشروع القائم (pendingBubbleAction) — حقل ثابت
# يُملأ من الـ Intent ويُستهلك من JS مرة واحدة. لا نخترع آلية ثانية.
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"
MAIN=$(find android/app/src/main/java -name MainActivity.java | head -1)
PLUGIN=$(find android/app/src/main/java -name BubbleOverlayPlugin.java | head -1)

[ -f "$MANIFEST" ] || { echo "❌ AndroidManifest.xml غير موجود"; exit 1; }
[ -n "$MAIN" ]     || { echo "❌ MainActivity.java غير موجود"; exit 1; }

# ── 1. intent-filter في AndroidManifest ──────────────────────────────
if grep -q "android.intent.action.SEND" "$MANIFEST"; then
  echo "✅ intent-filter للمشاركة موجود مسبقاً"
else
  python3 -I - "$MANIFEST" <<'PYEOF'
import re, sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    content = f.read()

share_filter = '''
            <!-- استقبال النص المُشارَك من التطبيقات الأخرى -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
'''

# نُدرج داخل نشاط MainActivity، بعد intent-filter المُشغّل (LAUNCHER)
m = re.search(
    r'<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"[\s\S]*?</intent-filter>',
    content)
if not m:
    print("❌ لم يُعثر على intent-filter الرئيسي"); sys.exit(1)

content = content[:m.end()] + share_filter + content[m.end():]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ intent-filter للمشاركة أُضيف لـ AndroidManifest")
PYEOF
fi

# ── 2. التقاط النص في MainActivity ───────────────────────────────────
if grep -q "pendingSharedText" "$MAIN"; then
  echo "✅ التقاط النص المُشارَك موجود مسبقاً"
else
  python3 -I - "$MAIN" <<'PYEOF'
import re, sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    src = f.read()

# (أ) الحقلان الثابتان — بجوار نظيرهما الخاص بالفقعة
anchor = "public static volatile String pendingBubbleAction = null;"
if anchor not in src:
    print("❌ لم يُعثر على حقل pendingBubbleAction (تغيّرت بنية MainActivity؟)")
    sys.exit(1)
src = src.replace(anchor, anchor + """

    /** نصّ وارد من مشاركة تطبيق آخر. يُستهلك من JS مرة واحدة. */
    public static volatile String pendingSharedText = null;
    /** عنوان المشاركة إن أرسله التطبيق المصدر (EXTRA_SUBJECT). */
    public static volatile String pendingSharedSubject = null;""", 1)

# (ب) الالتقاط عند الإقلاع وعند استئناف نشاط قائم
before = src
src = src.replace("captureBubbleAction(getIntent());",
                  "captureBubbleAction(getIntent());\n        captureSharedText(getIntent());", 1)
if src == before:
    print("❌ لم يُعثر على نداء captureBubbleAction(getIntent())"); sys.exit(1)

before = src
src = src.replace("        captureBubbleAction(intent);\n    }",
                  "        captureBubbleAction(intent);\n        captureSharedText(intent);\n    }", 1)
if src == before:
    print("❌ لم يُعثر على نداء captureBubbleAction(intent) داخل onNewIntent"); sys.exit(1)

# (ج) الدالة نفسها — تُدرَج بعد captureBubbleAction
m = re.search(r"private void captureBubbleAction\(Intent intent\) \{[\s\S]*?\n    \}", src)
if not m:
    print("❌ لم يُعثر على تعريف captureBubbleAction"); sys.exit(1)

fn = '''

    /**
     * يلتقط النص الوارد من ACTION_SEND.
     *
     * ⚠️ نستعمل getCharSequenceExtra لا getStringExtra: تطبيقات كثيرة
     * (جيميل، متصفحات، محرّرات) تضع نصاً منسَّقاً من نوع Spanned، و
     * getStringExtra تُعيد null بصمت في تلك الحالة — فتصل المشاركة فارغة
     * بلا أي خطأ يدلّ على السبب.
     *
     * ونُزيل الـ extras بعد القراءة حتى لا يُعاد التقاط نفس النص عند كل
     * دوران للنشاط (تغيير الاتجاه مثلاً) فتتكرّر الملاحظة.
     */
    private void captureSharedText(Intent intent) {
        if (intent == null) return;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return;

        CharSequence body = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (body == null || body.toString().trim().isEmpty()) return;

        CharSequence subject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        pendingSharedText = body.toString();
        pendingSharedSubject = subject != null ? subject.toString() : null;

        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.removeExtra(Intent.EXTRA_SUBJECT);
    }'''
src = src[:m.end()] + fn + src[m.end():]

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print("✅ MainActivity: التقاط النص المُشارَك")
PYEOF
fi

# ── 3. تمريره إلى JS عبر الإضافة القائمة ─────────────────────────────
# نُضيفه إلى BubbleOverlayPlugin بدل إنشاء إضافة ثانية: كل إضافة جديدة
# تحتاج registerPlugin في MainActivity — أي نقطة أخرى يمحوها
# apply-bubble-overlay.sh عند إعادة كتابته للملف.
if [ -z "$PLUGIN" ]; then
  echo "⚠️ BubbleOverlayPlugin.java غير موجود — تخطّي جسر JS"
elif grep -q "getPendingShare" "$PLUGIN"; then
  echo "✅ جسر JS موجود مسبقاً"
else
  python3 -I - "$PLUGIN" <<'PYEOF'
import sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    src = f.read()

method = '''
    /** يُعيد النص المُشارَك من تطبيق آخر (إن وُجد) ثم يُفرِّغه — مرة واحدة. */
    @PluginMethod
    public void getPendingShare(PluginCall call) {
        String text = MainActivity.pendingSharedText;
        String subject = MainActivity.pendingSharedSubject;
        MainActivity.pendingSharedText = null;
        MainActivity.pendingSharedSubject = null;
        JSObject ret = new JSObject();
        ret.put("text", text != null ? text : "");
        ret.put("subject", subject != null ? subject : "");
        call.resolve(ret);
    }
}'''

idx = src.rstrip().rfind('}')
if idx == -1:
    print("❌ بنية الصنف غير متوقّعة"); sys.exit(1)
src = src[:idx] + method + src[idx + 1:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print("✅ BubbleOverlayPlugin: getPendingShare")
PYEOF
fi

echo ""
echo "✅ Share Target اكتمل — سيظهر التطبيق في قائمة المشاركة"
