#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# apply-widget.sh — ويدجت الشاشة الرئيسية
# ═══════════════════════════════════════════════════════════════════════
# أربعة أزرار على شاشة الهاتف تفتح التطبيق مباشرةً على ما تريده:
# ملاحظة سريعة · فكرة · تدوين صوتي · Tahiro AI.
#
# القرار المعماري: لا نخترع آلية تمرير جديدة. الويدجت يُرسل نفس
# Intent extra المسمّى "bubble_action" الذي ترسله الفقعة العائمة، ويلتقطه
# captureBubbleAction في MainActivity ثم App.tsx — مسارٌ مبنيّ ومُختبَر
# بالفعل. مسار ثانٍ موازٍ كان سيعني عطبين محتملين بدل واحد.
#
# ⚠️ يُشغَّل بعد apply-bubble-overlay.sh: عقد bubble_action يأتي منه،
# وتشغيل هذا قبله يعني ويدجت يُرسل إلى مُستقبِل غير موجود بعد.
set -euo pipefail

if [ ! -d "android" ]; then
  echo "❌ android/ غير موجود"; exit 1
fi

APP_ID=$(grep -oP "appId:\s*'([^']+)'" capacitor.config.ts | head -1 | sed -E "s/appId:\s*'([^']+)'/\1/")
[ -n "$APP_ID" ] || { echo "❌ تعذّر استخراج appId"; exit 1; }
PKG_DIR="android/app/src/main/java/$(echo "$APP_ID" | tr '.' '/')"
RES="android/app/src/main/res"
MANIFEST="$RES/../AndroidManifest.xml"

mkdir -p "$PKG_DIR" "$RES/layout" "$RES/xml" "$RES/drawable" "$RES/values"

# ── 1. خلفيات ───────────────────────────────────────────────────────
cat > "$RES/drawable/widget_bg.xml" << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="24dp" />
    <gradient
        android:startColor="#1A1033"
        android:endColor="#040310"
        android:angle="135" />
</shape>
XMLEOF

cat > "$RES/drawable/widget_btn.xml" << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="16dp" />
    <solid android:color="#241A42" />
    <stroke android:width="1dp" android:color="#3B2D63" />
</shape>
XMLEOF

# ── 2. التخطيط ──────────────────────────────────────────────────────
# ⚠️ الويدجت يعمل في عملية المُشغِّل (launcher) عبر RemoteViews، وهي
# تدعم مجموعة محدودة من العناصر فقط: LinearLayout و TextView و
# ImageView وأمثالها. ConstraintLayout مثلاً يرمي استثناءً عند التضخيم.
cat > "$RES/layout/widget_notic.xml" << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_bg"
    android:padding="12dp">

    <TextView
        android:id="@+id/widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Notic Tahiro"
        android:textColor="#C4B5FD"
        android:textSize="12sp"
        android:textStyle="bold"
        android:maxLines="1"
        android:paddingBottom="8dp" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:orientation="horizontal"
        android:baselineAligned="false">

        <TextView
            android:id="@+id/widget_note"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginEnd="6dp"
            android:background="@drawable/widget_btn"
            android:gravity="center"
            android:text="✍️"
            android:textSize="22sp"
            android:contentDescription="New note" />

        <TextView
            android:id="@+id/widget_idea"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginEnd="6dp"
            android:background="@drawable/widget_btn"
            android:gravity="center"
            android:text="💡"
            android:textSize="22sp"
            android:contentDescription="New idea" />

        <TextView
            android:id="@+id/widget_voice"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginEnd="6dp"
            android:background="@drawable/widget_btn"
            android:gravity="center"
            android:text="🎤"
            android:textSize="22sp"
            android:contentDescription="Voice note" />

        <TextView
            android:id="@+id/widget_ai"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:background="@drawable/widget_btn"
            android:gravity="center"
            android:text="🤖"
            android:textSize="22sp"
            android:contentDescription="Tahiro AI" />
    </LinearLayout>
</LinearLayout>
XMLEOF

# ── 3. وصف الويدجت ──────────────────────────────────────────────────
cat > "$RES/xml/widget_notic_info.xml" << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="70dp"
    android:targetCellWidth="4"
    android:targetCellHeight="1"
    android:resizeMode="horizontal"
    android:widgetCategory="home_screen"
    android:previewImage="@mipmap/ic_launcher"
    android:initialLayout="@layout/widget_notic"
    android:updatePeriodMillis="0" />
XMLEOF

# ── 4. المزوّد ──────────────────────────────────────────────────────
cat > "$PKG_DIR/NoticWidgetProvider.java" << JAVAEOF
package $APP_ID;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * ويدجت الشاشة الرئيسية — أربعة أزرار تفتح التطبيق على الشاشة المطلوبة.
 *
 * يُعيد استعمال عقد "bubble_action" نفسه الذي تستعمله الفقعة العائمة،
 * فيلتقطه captureBubbleAction في MainActivity ثم App.tsx. لا مسار جديد.
 *
 * ⚠️ ملاحظتان تُسقطان أي ويدجت إن أُغفلتا:
 *  1. FLAG_IMMUTABLE إلزامي منذ أندرويد 12 — بدونه يرمي النظام
 *     IllegalArgumentException عند إنشاء PendingIntent.
 *  2. كل زرّ يحتاج requestCode مختلفاً **و** FLAG_UPDATE_CURRENT: بدونهما
 *     يُعيد النظام استعمال أوّل PendingIntent لكل الأزرار، فتفتح الأزرار
 *     الأربعة نفس الشاشة — عطبٌ صامت لا يُنتج أي خطأ.
 */
public class NoticWidgetProvider extends AppWidgetProvider {

    private PendingIntent actionIntent(Context context, String action, int requestCode) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) launch = new Intent(context, MainActivity.class);
        launch.putExtra("bubble_action", action);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(
            context, requestCode, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_notic);
            views.setOnClickPendingIntent(R.id.widget_note,  actionIntent(context, "quick_note", 1));
            views.setOnClickPendingIntent(R.id.widget_idea,  actionIntent(context, "quick_idea", 2));
            views.setOnClickPendingIntent(R.id.widget_voice, actionIntent(context, "voice_note", 3));
            views.setOnClickPendingIntent(R.id.widget_ai,    actionIntent(context, "ai_chat", 4));
            views.setOnClickPendingIntent(R.id.widget_title, actionIntent(context, "", 5));
            manager.updateAppWidget(id, views);
        }
    }
}
JAVAEOF

# ── 5. تسجيل المُستقبِل في Manifest ─────────────────────────────────
if grep -q "NoticWidgetProvider" "$MANIFEST"; then
  echo "✅ الويدجت مُسجَّل مسبقاً في Manifest"
else
  python3 -I - "$MANIFEST" <<'PYEOF'
import re, sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    content = f.read()

receiver = '''
        <!-- ويدجت الشاشة الرئيسية -->
        <receiver
            android:name=".NoticWidgetProvider"
            android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_notic_info" />
        </receiver>
'''

idx = content.rfind('</application>')
if idx == -1:
    print("❌ لم يُعثر على </application>"); sys.exit(1)
content = content[:idx] + receiver + content[idx:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ <receiver> الويدجت أُضيف لـ AndroidManifest")
PYEOF
fi

echo ""
echo "✅ الويدجت اكتمل — سيظهر في قائمة الأدوات بالضغط المطوّل على الشاشة"
