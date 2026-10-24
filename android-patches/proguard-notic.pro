# ═══════════════════════════════════════════════════════════════════════
#  proguard-notic.pro — قواعد الإبقاء عند تفعيل R8
# ═══════════════════════════════════════════════════════════════════════
#
#  لماذا هذا الملف موجود، وما الذي يحميه بالضبط
#  ─────────────────────────────────────────────
#  R8 يحذف ما لا يراه مُستعمَلاً، ويُعيد تسمية ما يُبقيه. وهو يرى
#  الاستدعاءات المباشرة في الكود فقط — ولا يرى شيئاً يُستدعى بالاسم وقت
#  التشغيل.
#
#  و Capacitor مبنيّ كلّه على ذلك: ملف الأصول capacitor.plugins.json
#  يحمل أسماء أصناف الإضافات نصّاً، ويُحمّلها Capacitor بـ Class.forName.
#  فإن أعاد R8 تسمية صنف إضافة، يبحث Capacitor عن اسم لم يعد موجوداً،
#  ويفشل التحميل.
#
#  والعطب الناتج هو أسوأ أنواع الأعطاب:
#    • البناء ينجح بلا تحذير
#    • نسخة التطوير (npm run dev) تعمل — لأن R8 لا يعمل فيها أصلاً
#    • نسخة debug تعمل — للسبب نفسه
#    • **نسخة الإصدار وحدها تسقط**، عند المستخدم، بعد النشر
#  أي: الإعلانات تختفي، والصوت يصمت، والإشعارات لا تصل، والملفات لا
#  تُحفظ — بلا رسالة خطأ واحدة تدلّ على السبب.
#
#  ولهذا القواعد هنا سخيّة عمداً. الهدف من تفعيل R8 هو اجتياز مقياس
#  Google لتعتيم الكود، لا انتزاع كل كيلوبايت ممكن. وإبقاء أصناف
#  الإضافات كاملةً يكلّف حجماً يسيراً ويمنع فئة الأعطاب هذه كلّها.
# ═══════════════════════════════════════════════════════════════════════


# ─── 1. نواة Capacitor ────────────────────────────────────────────────
# الجسر بين JS والأصل. أسماؤه تُستعمل في الانعكاس من الطرفين.
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }


# ─── 2. أصناف الإضافات — أخطر قاعدة في الملف ──────────────────────────
# كل إضافة ترث Plugin وتحمل التوصيف @CapacitorPlugin. وهي تُحمَّل بالاسم
# من capacitor.plugins.json، فإعادة تسميتها تعني اختفاءها.
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# دوال الإضافات تُستدعى من JS بالاسم أيضاً، لا من كود جافا.
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}


# ─── 3. حزام أمان ثانٍ: حِزَم الإضافات المثبَّتة صراحةً ────────────────
# القواعد أعلاه تكفي نظرياً. وهذه تحتاط لإضافة لا تتبع النمط المتوقَّع،
# أو لتغيير في آلية التسجيل في إصدار لاحق من Capacitor.
#   @capacitor/*            → com.capacitorjs.plugins.**
#   @capacitor-community/*  → com.getcapacitor.community.**
#   @capawesome/*           → io.capawesome.capacitorjs.**
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.getcapacitor.community.** { *; }
-keep class io.capawesome.capacitorjs.** { *; }


# ─── 4. واجهة JavaScript في WebView ───────────────────────────────────
# @JavascriptInterface تُستدعى من JS بالاسم؛ لا مرجع لها في كود جافا.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}


# ─── 5. التوصيفات والبيانات الوصفية ───────────────────────────────────
# بلا *Annotation* لا يرى R8 نفسه @CapacitorPlugin، فتسقط القاعدة (2).
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod


# ─── 6. آثار الانهيار تبقى مقروءة ─────────────────────────────────────
# بلا هذين السطرين تصير كل آثار الانهيار في Play Console بلا أسماء ملفات
# ولا أرقام أسطر — فيُعمي التعتيمُ المطوِّرَ عن أعطاب مستخدميه، وهذا
# ثمن لا داعي لدفعه.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile


# ─── 7. أصناف التطبيق الأصلية ─────────────────────────────────────────
#
# BubbleOverlayPlugin إضافة Capacitor مكتوبة داخل هذا التطبيق، لا من
# npm — فهي **ليست** في capacitor.plugins.json، ولا يراها الفحص الذي
# يقرأ ذلك الملف. القاعدتان (2) تغطّيانها نظرياً (@CapacitorPlugin
# و extends Plugin)، لكن اسمها يُذكر صراحةً هنا لأن اعتماد ميزةٍ كاملة
# على استنتاجٍ غير مرئي ليس أماناً.
#
# والثلاثة الأخرى (خدمة الفقاعة، مستقبِل الإقلاع، مزوّد الأداة) معلَنة
# في AndroidManifest، و R8 يُبقي ما في البيان تلقائياً. نُثبّتها هنا
# أيضاً: التكلفة بضعة كيلوبايت، والبديل خدمةٌ تختفي بصمت عند التحديث.
-keep class com.notictahiro.app.BubbleOverlayPlugin { *; }
-keep class com.notictahiro.app.BubbleService { *; }
-keep class com.notictahiro.app.BubbleBootReceiver { *; }
-keep class com.notictahiro.app.NoticWidgetProvider { *; }
-keep class com.notictahiro.app.MainActivity { *; }


# ─── 8. تحذيرات غير مؤذية ─────────────────────────────────────────────
# مكتبات تشير إلى أصناف اختيارية غير موجودة. تجاهلها لا يُضعف شيئاً،
# وتركها يُفشل البناء بلا سبب حقيقي.
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
