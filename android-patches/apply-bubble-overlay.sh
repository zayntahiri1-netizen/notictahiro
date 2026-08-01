#!/bin/bash
# ============================================================
# apply-bubble-overlay.sh
# ------------------------------------------------------------
# ميزة "الفقعة العائمة" — أيقونة تطفو فوق كل التطبيقات المفتوحة،
# تُفتح بالضغط عليها قائمة صغيرة: ملاحظة سريعة / محادثة AI / تذكير.
#
# القرار التصميمي الأهم (أمان البيانات):
#   لا تتم كتابة أي بيانات من Kotlin/Java مباشرة إلى قاعدة بيانات
#   WebView (localStorage) — هذا خطر حقيقي على سلامة الملاحظات.
#   بدلاً من ذلك: الضغط على أي خيار في القائمة يفتح التطبيق نفسه
#   فوراً على الشاشة المطلوبة، فتتم الكتابة عبر نظام الحفظ
#   الموجود والمُختبَر بالفعل (مع كل ميزاته: AI، تنبيهات، قفل).
#
# يتطلب: SYSTEM_ALERT_WINDOW (إذن خاص يُمنح يدوياً من إعدادات
# النظام) + Foreground Service (شرط أندرويد لأي عرض مستمر فوق
# التطبيقات الأخرى — إشعار دائم غير اختياري).
#
# يُشغَّل بعد: android-patches/apply-mic-permission.sh
# (يُعيد كتابة MainActivity.java بنسخة شاملة تضم إصلاح الميكروفون
#  + تسجيل Plugin الفقعة معاً، لتفادي تعارض الكتابة بين السكريبتين)
# ============================================================

if [ ! -d "android" ]; then
  echo "❌ android/ غير موجود. شغّل: npx cap add android"
  exit 1
fi

APP_ID=$(grep -oP "appId:\s*'([^']+)'" capacitor.config.ts | head -1 | sed -E "s/appId:\s*'([^']+)'/\1/")
if [ -z "$APP_ID" ]; then
  echo "❌ تعذّر استخراج appId من capacitor.config.ts"
  exit 1
fi

PKG_PATH=$(echo "$APP_ID" | tr '.' '/')
PKG_DIR="android/app/src/main/java/$PKG_PATH"
mkdir -p "$PKG_DIR"

# ─────────────────────────────────────────────────────────────
# 1) BubbleOverlayPlugin.java — جسر Capacitor بين JS والخدمة الأصلية
# ─────────────────────────────────────────────────────────────
cat > "$PKG_DIR/BubbleOverlayPlugin.java" << JAVAEOF
package $APP_ID;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * BubbleOverlayPlugin — جسر JS↔Native للفقعة العائمة.
 * كل التخزين الفعلي (الملاحظات/التذكيرات) يبقى داخل JS — هذا الجسر
 * يتولّى فقط دورة حياة الخدمة (تشغيل/إيقاف) وإذن العرض فوق التطبيقات،
 * وتمرير "الإجراء المُؤجَّل" (bubble_action) الذي وصل عبر Intent.
 */
@CapacitorPlugin(name = "BubbleOverlay")
public class BubbleOverlayPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || Settings.canDrawOverlays(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("OVERLAY_PERMISSION_DENIED");
            return;
        }
        // نحفظ أن الفقعة "مُفعَّلة" ليُعيد BubbleBootReceiver تشغيلها تلقائياً
        // بعد إعادة تشغيل الهاتف أو تحديث التطبيق.
        getContext().getSharedPreferences("notic_bubble_prefs", 0)
            .edit().putBoolean("bubble_enabled", true).apply();
        Intent serviceIntent = new Intent(getContext(), BubbleService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        // إيقاف صريح من المستخدم → لا نُعيد التشغيل بعد reboot
        getContext().getSharedPreferences("notic_bubble_prefs", 0)
            .edit().putBoolean("bubble_enabled", false).apply();
        getContext().stopService(new Intent(getContext(), BubbleService.class));
        call.resolve();
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", BubbleService.isRunning);
        call.resolve(ret);
    }

    /** يُرجع ما إذا كانت الفقعة "مُفعَّلة" (الحالة المحفوظة التي اختارها
     *  المستخدم)، بغضّ النظر عمّا إذا كانت الخدمة تعمل حالياً في الذاكرة.
     *  هذا هو المصدر الصحيح لعرض حالة المفتاح في الواجهة، لأن النظام قد
     *  يقتل الخدمة مؤقتاً ثم تُعيد START_STICKY تشغيلها. */
    @PluginMethod
    public void isEnabled(PluginCall call) {
        boolean enabled = getContext()
            .getSharedPreferences("notic_bubble_prefs", 0)
            .getBoolean("bubble_enabled", false);
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /** يضمن أن الفقعة تعمل إن كانت مُفعَّلة وإذن العرض ممنوح. يُستدعى
     *  عند فتح التطبيق ليُعيد تشغيل الخدمة تلقائياً إن قتلها النظام. */
    @PluginMethod
    public void ensureRunning(PluginCall call) {
        boolean enabled = getContext()
            .getSharedPreferences("notic_bubble_prefs", 0)
            .getBoolean("bubble_enabled", false);
        JSObject ret = new JSObject();
        if (enabled && !BubbleService.isRunning
                && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext()))) {
            Intent serviceIntent = new Intent(getContext(), BubbleService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            ret.put("restarted", true);
        } else {
            ret.put("restarted", false);
        }
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /** يُزامِن لغة قائمة الفقعة مع لغة التطبيق الحالية (ar/en/es/zh) —
     *  تُحفَظ في SharedPreferences ليقرأها BubbleService عند بناء القائمة. */
    @PluginMethod
    public void setLanguage(PluginCall call) {
        String lang = call.getString("lang", "ar");
        getContext().getSharedPreferences("notic_bubble_prefs", 0)
            .edit().putString("lang", lang).apply();
        call.resolve();
    }

    /** يُستدعى من JS عند إقلاع التطبيق/استئنافه — يُعيد آخر إجراء
     *  مُؤجَّل من الفقعة (إن وُجد) ثم يُفرغه فوراً (استهلاك لمرة واحدة). */
    @PluginMethod
    public void getPendingAction(PluginCall call) {
        String action = MainActivity.pendingBubbleAction;
        MainActivity.pendingBubbleAction = null;
        JSObject ret = new JSObject();
        ret.put("action", action != null ? action : "");
        call.resolve(ret);
    }
}
JAVAEOF
echo "✅ BubbleOverlayPlugin.java"


# ─────────────────────────────────────────────────────────────
# 2) BubbleService.java — الخدمة الأصلية (الفقعة + القائمة)
# ─────────────────────────────────────────────────────────────
cat > "$PKG_DIR/BubbleService.java" << JAVAEOF
package $APP_ID;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;

/**
 * BubbleService — أيقونة عائمة فوق كل التطبيقات (WindowManager overlay)
 * مع خدمة Foreground إلزامية (شرط أندرويد، إشعار دائم غير اختياري).
 *
 * كل عناصر الواجهة (الدائرة + القائمة) تُبنى برمجياً بالكامل (بدون أي
 * ملفات XML/drawable إضافية) لتفادي أي تعقيد في دمج موارد أندرويد.
 *
 * عند اختيار أي بند من القائمة: يُسجَّل الإجراء في
 * MainActivity.pendingBubbleAction ثم يُفتح التطبيق — لا كتابة بيانات
 * من هنا أبداً، فقط JS يكتب عبر نظام الحفظ الموجود والمُختبَر.
 */
public class BubbleService extends Service {

    public static volatile boolean isRunning = false;

    private static final String CHANNEL_ID = "notic_bubble_channel";
    private static final int NOTIF_ID = 5050;

    private WindowManager windowManager;
    private View bubbleView;
    private android.animation.ValueAnimator bubblePulse;
    private View menuView;
    private WindowManager.LayoutParams bubbleParams;
    private boolean menuShown = false;

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
        startForegroundCompat();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        showBubble();
    }

    // START_STICKY: يُعيد النظام تشغيل الخدمة تلقائياً إن أُوقفت بسبب
    // ضغط الذاكرة — فتبقى الفقعة حيّة حتى لو أُغلق التطبيق نهائياً.
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        isRunning = true;
        return START_STICKY;
    }

    // onTaskRemoved: يُستدعى عند إزالة التطبيق من قائمة المهام الأخيرة
    // (swipe away). لا نُوقف الخدمة — نُبقي الفقعة عائمة فوق كل شيء.
    // هذا هو جوهر "الفقعة تبقى بعد الخروج من التطبيق".
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // الفقعة يجب أن تبقى حتى بعد إزالة التطبيق من المهام الأخيرة.
        // لا نستدعي stopSelf() — لكن بعض الشركات المصنّعة (Xiaomi/Huawei/
        // Oppo) تقتل الخدمة بقوة عند swipe-away رغم START_STICKY. لذا نُعيد
        // جدولة تشغيل الخدمة بعد ثانية واحدة عبر AlarmManager كضمان إضافي.
        boolean enabled = getSharedPreferences("notic_bubble_prefs", 0)
            .getBoolean("bubble_enabled", true);
        if (enabled) {
            try {
                Intent restart = new Intent(getApplicationContext(), BubbleService.class);
                restart.setPackage(getPackageName());
                android.app.PendingIntent pi = android.app.PendingIntent.getService(
                    this, 1, restart,
                    android.app.PendingIntent.FLAG_ONE_SHOT | android.app.PendingIntent.FLAG_IMMUTABLE);
                android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
                if (am != null) {
                    am.set(android.app.AlarmManager.RTC, System.currentTimeMillis() + 1000, pi);
                }
            } catch (Exception ignored) { /* أفضل جهد ممكن */ }
        }
        super.onTaskRemoved(rootIntent);
    }

    private void startForegroundCompat() {
        createNotificationChannel();
        String lang = getSharedPreferences("notic_bubble_prefs", 0).getString("lang", "ar");
        String notifText;
        switch (lang) {
            case "en": notifText = "Floating bubble is active"; break;
            case "es": notifText = "La burbuja flotante está activa"; break;
            case "zh": notifText = "悬浮气泡已启用"; break;
            default:   notifText = "الفقعة العائمة نشطة";
        }
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Notic Tahiro")
            .setContentText(notifText)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setOngoing(true)
            .build();

        if (Build.VERSION.SDK_INT >= 34) { // Android 14 — UPSIDE_DOWN_CAKE
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "الفقعة العائمة", NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void showBubble() {
        TextView bubble = new TextView(this);
        bubble.setText("🧠");
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(24);
        bubble.setGravity(Gravity.CENTER);
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.OVAL);
        // تدرّج لوني جذّاب (بنفسجي → وردي) عبر GradientDrawable
        shape.setColors(new int[]{
            Color.parseColor("#7C3AED"),
            Color.parseColor("#EC4899")
        });
        shape.setGradientType(GradientDrawable.LINEAR_GRADIENT);
        shape.setOrientation(GradientDrawable.Orientation.TL_BR);
        shape.setStroke(dp(2), Color.parseColor("#F0ABFC"));
        bubble.setBackground(shape);
        bubble.setElevation(dp(10));
        bubbleView = bubble;

        int size = dp(58);
        bubbleParams = new WindowManager.LayoutParams(
            size, size,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = 0;
        bubbleParams.y = dp(300);

        windowManager.addView(bubbleView, bubbleParams);
        attachTouchListener();
        startBubbleAnimation();
    }

    /**
     * أنيميشن "نبض" حيّ للفقعة: تكبير/تصغير دوري ناعم + دوران خفيف
     * يجعلها تبدو حيّة وفريدة (لا فقعة جامدة). يعمل باستمرار بلطف
     * دون استهلاك معالج يُذكر (ValueAnimator خفيف).
     */
    private void startBubbleAnimation() {
        if (bubbleView == null) return;
        android.animation.ValueAnimator pulse = android.animation.ValueAnimator.ofFloat(1f, 1.12f, 1f);
        pulse.setDuration(2200);
        pulse.setRepeatCount(android.animation.ValueAnimator.INFINITE);
        pulse.setInterpolator(new android.view.animation.AccelerateDecelerateInterpolator());
        pulse.addUpdateListener(a -> {
            if (bubbleView == null) return;
            float s = (float) a.getAnimatedValue();
            bubbleView.setScaleX(s);
            bubbleView.setScaleY(s);
        });
        pulse.start();
        bubblePulse = pulse;
    }

    private void attachTouchListener() {
        bubbleView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isDragging = false;
            private static final int CLICK_THRESHOLD = 12;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = bubbleParams.x;
                        initialY = bubbleParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        isDragging = false;
                        return true;
                    case MotionEvent.ACTION_MOVE: {
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (event.getRawY() - initialTouchY);
                        if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
                            isDragging = true;
                            hideMenu();
                        }
                        bubbleParams.x = initialX + dx;
                        bubbleParams.y = initialY + dy;
                        try { windowManager.updateViewLayout(bubbleView, bubbleParams); } catch (Exception ignored) {}
                        return true;
                    }
                    case MotionEvent.ACTION_UP:
                        if (!isDragging) toggleMenu();
                        return true;
                }
                return false;
            }
        });
    }

    private void toggleMenu() {
        if (menuShown) hideMenu(); else showMenu();
    }

    private void showMenu() {
        LinearLayout menu = new LinearLayout(this);
        menu.setOrientation(LinearLayout.VERTICAL);
        menu.setPadding(dp(4), dp(6), dp(4), dp(6));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#1F0E3D"));
        bg.setCornerRadius(dp(16));
        menu.setBackground(bg);
        menu.setElevation(dp(8));

        String[] labels = getMenuLabels();
        menu.addView(menuButton(labels[0], "quick_note"));
        menu.addView(menuButton(labels[1], "voice_note"));
        menu.addView(menuButton(labels[2], "ai_chat"));
        menu.addView(menuButton(labels[3], "paste_clip"));
        menu.addView(menuButton(labels[4], "quick_idea"));
        menu.addView(menuButton(labels[5], "stop_bubble"));

        menuView = menu;
        WindowManager.LayoutParams menuParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        menuParams.gravity = Gravity.TOP | Gravity.START;
        menuParams.x = bubbleParams.x;
        menuParams.y = bubbleParams.y + dp(64);

        try {
            windowManager.addView(menuView, menuParams);
            menuShown = true;
        } catch (Exception ignored) {}
    }

    private TextView menuButton(String label, final String action) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(14);
        tv.setPadding(dp(18), dp(12), dp(18), dp(12));
        tv.setOnClickListener(v -> {
            handleAction(action);
            hideMenu();
        });
        return tv;
    }

    private void handleAction(String action) {
        if ("stop_bubble".equals(action)) {
            stopSelf();
            return;
        }
        // الحقل الثابت يعمل دائماً (الخدمة Foreground تُبقي العملية حيّة)،
        // ونُضيف أيضاً Intent extra صريحاً ليكون الآلية واضحة ومتينة ولا
        // تعتمد على افتراض ضمني غير موثَّق لو تغيّر سلوك العملية مستقبلاً.
        MainActivity.pendingBubbleAction = action;
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            launch.putExtra("bubble_action", action);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(launch);
        }
    }

    private void hideMenu() {
        if (menuView != null && menuShown) {
            try { windowManager.removeView(menuView); } catch (Exception ignored) {}
            menuShown = false;
        }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    /** يُعيد تسميات القائمة بلغة التطبيق الحالية (مُزامَنة من JS عبر
     *  BubbleOverlayPlugin.setLanguage إلى SharedPreferences). الترتيب
     *  ثابت دائماً: [ملاحظة سريعة, محادثة AI, تذكير, إيقاف الفقعة]. */
    private String[] getMenuLabels() {
        String lang = getSharedPreferences("notic_bubble_prefs", 0).getString("lang", "ar");
        switch (lang) {
            case "en":
                return new String[]{"📝  Quick note", "🎤  Voice note", "💬  Ask AI", "📋  Paste clipboard", "💡  Quick idea", "✕  Stop bubble"};
            case "es":
                return new String[]{"📝  Nota rápida", "🎤  Nota de voz", "💬  Preguntar a IA", "📋  Pegar portapapeles", "💡  Idea rápida", "✕  Detener burbuja"};
            case "zh":
                return new String[]{"📝  快速笔记", "🎤  语音笔记", "💬  问AI", "📋  粘贴剪贴板", "💡  快速想法", "✕  停止悬浮气泡"};
            default: // ar
                return new String[]{"📝  ملاحظة سريعة", "🎤  تدوين صوتي", "💬  محادثة AI", "📋  لصق المنسوخ", "💡  فكرة سريعة", "✕  إيقاف الفقعة"};
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        if (bubblePulse != null) {
            try { bubblePulse.cancel(); } catch (Exception ignored) {}
            bubblePulse = null;
        }
        hideMenu();
        if (bubbleView != null) {
            try { windowManager.removeView(bubbleView); } catch (Exception ignored) {}
        }
    }
}
JAVAEOF
echo "✅ BubbleService.java"


# ─────────────────────────────────────────────────────────────
# 2.5) BubbleBootReceiver.java — يُعيد تشغيل الفقعة بعد reboot
#      أو تحديث التطبيق، إن كانت مُفعَّلة (bubble_enabled=true).
#      هذا يضمن أن الفقعة "تبقى" فعلاً عبر إعادة تشغيل الهاتف.
# ─────────────────────────────────────────────────────────────
cat > "$PKG_DIR/BubbleBootReceiver.java" << JAVAEOF
package $APP_ID;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

/**
 * يُعيد تشغيل فقعة Notic Tahiro العائمة تلقائياً بعد:
 *  - إعادة تشغيل الهاتف (BOOT_COMPLETED / QUICKBOOT_POWERON)
 *  - تحديث التطبيق (MY_PACKAGE_REPLACED)
 * بشرطين: أن تكون الفقعة مُفعَّلة سابقاً (bubble_enabled=true)،
 * وأن يكون إذن العرض فوق التطبيقات ما زال ممنوحاً.
 */
public class BubbleBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        boolean enabled = context
            .getSharedPreferences("notic_bubble_prefs", 0)
            .getBoolean("bubble_enabled", false);
        if (!enabled) return;

        // تأكّد أن إذن العرض فوق التطبيقات ما زال ممنوحاً
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && !Settings.canDrawOverlays(context)) {
            return;
        }

        Intent serviceIntent = new Intent(context, BubbleService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
JAVAEOF
echo "✅ BubbleBootReceiver.java"


# ─────────────────────────────────────────────────────────────
# 3) MainActivity.java — نسخة شاملة (إصلاح الميكروفون + تسجيل
#    BubbleOverlayPlugin + حقل pendingBubbleAction + onNewIntent)
#    يَستبدل النسخة السابقة من apply-mic-permission.sh بنسخة أكمل
#    تحتوي على نفس منطق الميكروفون بالضبط + إضافات الفقعة.
# ─────────────────────────────────────────────────────────────
MAIN_ACTIVITY_FILE="$PKG_DIR/MainActivity.java"

cat > "$MAIN_ACTIVITY_FILE" << JAVAEOF
package $APP_ID;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — تضم إصلاحين أساسيين:
 *
 * أولاً: إذن الميكروفون داخل WebView (WebChromeClient.onPermissionRequest):
 *    WebView له طبقة إذن داخلية منفصلة عن إذن النظام RECORD_AUDIO —
 *    بدون هذا الـ override تفشل getUserMedia/SpeechRecognition بصمت.
 *
 * ثانياً: تسجيل BubbleOverlayPlugin وتتبّع "الإجراء المُؤجَّل" القادم من
 *    الفقعة العائمة (BubbleService) عبر Intent، يُستهلَك مرة واحدة
 *    من JS عبر BubbleOverlay.getPendingAction().
 */
public class MainActivity extends BridgeActivity {

    private static final int MIC_PERMISSION_REQUEST_CODE = 9001;
    private PermissionRequest pendingWebViewPermissionRequest;

    /** يُضبَط من BubbleService عند اختيار بند من قائمة الفقعة، ويُفرَّغ
     *  بعد قراءته من JS مرة واحدة فقط (استهلاك لمرة واحدة). */
    public static volatile String pendingBubbleAction = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // يجب تسجيل الإضافات قبل super.onCreate() — هذا ترتيب Capacitor المطلوب
        registerPlugin(BubbleOverlayPlugin.class);
        super.onCreate(savedInstanceState);

        captureBubbleAction(getIntent());

        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(@NonNull final PermissionRequest request) {
                for (String resource : request.getResources()) {
                    if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                        } else {
                            pendingWebViewPermissionRequest = request;
                            ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.RECORD_AUDIO},
                                MIC_PERMISSION_REQUEST_CODE
                            );
                        }
                        return;
                    }
                }
                request.deny();
            }
        });
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureBubbleAction(intent);
    }

    private void captureBubbleAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("bubble_action");
        if (action != null) {
            pendingBubbleAction = action;
            intent.removeExtra("bubble_action"); // تفادي إعادة الالتقاط عند دورات أخرى
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MIC_PERMISSION_REQUEST_CODE && pendingWebViewPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingWebViewPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                pendingWebViewPermissionRequest.deny();
            }
            pendingWebViewPermissionRequest = null;
        }
    }
}
JAVAEOF
echo "✅ MainActivity.java (شاملة: ميكروفون + فقعة)"


# ─────────────────────────────────────────────────────────────
# 4) AndroidManifest.xml — أذونات SYSTEM_ALERT_WINDOW + Foreground
#    Service + تعريف <service> لـ BubbleService
# ─────────────────────────────────────────────────────────────
MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ AndroidManifest.xml غير موجود"
  exit 1
fi

python3 - "$MANIFEST" << 'PYEOF'
import re, sys

manifest_path = sys.argv[1]
with open(manifest_path, 'r', encoding='utf-8') as f:
    content = f.read()

changed = False

# ── 1) أذونات الفقعة (إن لم تكن موجودة) ──────────────────────────
perms_needed = [
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.POST_NOTIFICATIONS',
]
missing_perms = [p for p in perms_needed if p not in content]
if missing_perms:
    perm_lines = ''.join(f'    <uses-permission android:name="{p}"/>\n' for p in missing_perms)
    content = re.sub(r'(\s*<application)', '\n' + perm_lines + r'\1', content, count=1)
    changed = True
    print(f'✅ أُضيفت {len(missing_perms)} إذن/أذونات جديدة للفقعة')
else:
    print('✅ أذونات الفقعة موجودة مسبقاً')

# ── 2) تعريف <service> لـ BubbleService (إن لم يكن موجوداً) ──────
if 'BubbleService' not in content:
    service_xml = '''        <service
            android:name=".BubbleService"
            android:exported="false"
            android:stopWithTask="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="floating_bubble_overlay_for_quick_note_capture" />
        </service>
        <receiver
            android:name=".BubbleBootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
'''
    # أدرجها قبل إغلاق </application>
    content = re.sub(r'(\s*</application>)', '\n' + service_xml + r'\1', content, count=1)
    changed = True
    print('✅ أُضيف تعريف <service> (stopWithTask=false) + BootReceiver')
else:
    print('✅ تعريف BubbleService موجود مسبقاً')

if changed:
    with open(manifest_path, 'w', encoding='utf-8') as f:
        f.write(content)

print('✅ AndroidManifest.xml محدَّث للفقعة العائمة')
PYEOF

echo ""
echo "✅ إعداد الفقعة العائمة اكتمل بالكامل!"
