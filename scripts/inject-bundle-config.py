#!/usr/bin/env python3
"""
inject-bundle-config.py — تعطيل تقسيم حزمة AAB (splits)

المشكلة التي يعالجها
────────────────────
نافذة "Something went wrong — Check that Google Play is enabled on your
device…" تظهر عند الإقلاع فيمنع التطبيق من الفتح.

عند بناء AAB، تُقسّم Google Play التطبيق إلى حزمة أساس + حزم مرافقة
(لغة / كثافة شاشة / معمارية المعالج). إن وصل الجهاز حزمةُ الأساس وحدها
— استعادة نسخة احتياطية، نقل بين جهازين، تنزيل ناقص، أو مدير تطبيقات
صارم — يعتبر النظام التثبيت ناقصاً ويمنع الفتح بهذه النافذة.

الحل المطبَّق هنا: لا نُنتج حزماً مرافقة أصلاً. بلا حزم مرافقة لا يمكن
أن تنقص واحدة، فالشرط الذي يُطلق النافذة لا يتحقق أبداً.

الثمن (بصراحة)
──────────────
حجم التنزيل يزيد: كل مستخدم يحمّل كل اللغات وكل كثافات الشاشة وكل
معماريات المعالج بدل ما يخصّه فقط. الزيادة المعتادة لتطبيق Capacitor
تتراوح بين 30% و60%. هذه مقايضة مقصودة: تطبيق أكبر يفتح دائماً، أفضل
من تطبيق أصغر يرفض الفتح عند بعض المستخدمين.

للتراجع لاحقاً: احذف استدعاء هذا السكربت من الـ workflow فقط.
"""
import re
import sys
from pathlib import Path

GRADLE = Path("android/app/build.gradle")

BUNDLE_BLOCK = """
    // ── تعطيل تقسيم AAB (يمنع نافذة "Something went wrong") ──
    // بلا حزم مرافقة لا يمكن أن تنقص واحدة، فلا يُعتبر التثبيت ناقصاً.
    // الثمن: حجم تنزيل أكبر. انظر scripts/inject-bundle-config.py
    bundle {
        language { enableSplit = false }
        density  { enableSplit = false }
        abi      { enableSplit = false }
    }
"""


def main() -> int:
    if not GRADLE.exists():
        print(f"❌ لم يُعثر على {GRADLE}", file=sys.stderr)
        return 1

    src = GRADLE.read_text(encoding="utf-8")

    # غير متكرر: إن كانت الكتلة مطبّقة من بناء سابق، لا نضفها مرة أخرى.
    if "enableSplit" in src:
        print("✅ تعطيل التقسيم مطبّق مسبقاً — تخطّي")
        return 0

    # ندرج داخل كتلة android { } الرئيسية، مباشرة بعد سطر فتحها.
    match = re.search(r"^android\s*\{[^\n]*\n", src, flags=re.MULTILINE)
    if not match:
        print("❌ لم يُعثر على كتلة android { } في build.gradle", file=sys.stderr)
        return 1

    out = src[: match.end()] + BUNDLE_BLOCK + src[match.end() :]

    # فحص سلامة: توازن الأقواس يجب أن يبقى كما كان.
    if out.count("{") - out.count("}") != src.count("{") - src.count("}"):
        print("❌ الإدراج أخلّ بتوازن الأقواس — أُلغي التعديل", file=sys.stderr)
        return 1

    GRADLE.write_text(out, encoding="utf-8")
    print("✅ أُضيفت كتلة bundle{} — لن تُنتَج حزم مرافقة")
    print("   ℹ️ حجم التنزيل سيزيد (كل اللغات/الكثافات/المعماريات معاً)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
