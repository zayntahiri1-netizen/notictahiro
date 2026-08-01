#!/bin/bash
# ============================================================
# apply-mic-permission.sh
# ------------------------------------------------------------
# FIX حرج: الميكروفون لا يعمل في WebView حتى مع إذن RECORD_AUDIO
# ------------------------------------------------------------
# السبب الجذري المُوثَّق (مُؤكَّد من تقارير Capacitor الرسمية وعدة
# مصادر مستقلة منذ 2018 وحتى الآن):
#
#   WebView على أندرويد له نظام أذونات ذو طبقتين منفصلتين:
#   1) إذن النظام (RECORD_AUDIO في AndroidManifest + موافقة المستخدم)
#   2) إذن WebView الداخلي (WebChromeClient.onPermissionRequest)
#
#   كلاهما مطلوب بشكل مستقل — منح الطبقة الأولى لا يكفي أبداً!
#   بدون تجاوز onPermissionRequest، تفشل navigator.mediaDevices.
#   getUserMedia()/SpeechRecognition برسالة "NotAllowedError" أو
#   "not-allowed" حتى لو وافق المستخدم على إذن النظام بالكامل.
#
#   BridgeActivity الافتراضية في Capacitor (المُولَّدة تلقائياً عبر
#   npx cap add android) لا تتضمّن هذا الـ override أبداً.
#
# الحل: استبدال MainActivity.java بنسخة تُضيف WebChromeClient مخصصاً
# يمنح RESOURCE_AUDIO_CAPTURE صراحةً بعد التحقق من إذن النظام (وطلبه
# إن لم يكن قد مُنح بعد).
# ============================================================

if [ ! -d "android" ]; then
  echo "❌ android/ غير موجود. شغّل: npx cap add android"
  exit 1
fi

# استخراج appId من capacitor.config.ts (مثال: com.notictahiro.app)
APP_ID=$(grep -oP "appId:\s*'([^']+)'" capacitor.config.ts | head -1 | sed -E "s/appId:\s*'([^']+)'/\1/")

if [ -z "$APP_ID" ]; then
  echo "❌ تعذّر استخراج appId من capacitor.config.ts"
  exit 1
fi

PKG_PATH=$(echo "$APP_ID" | tr '.' '/')
MAIN_ACTIVITY_DIR="android/app/src/main/java/$PKG_PATH"
MAIN_ACTIVITY_FILE="$MAIN_ACTIVITY_DIR/MainActivity.java"

mkdir -p "$MAIN_ACTIVITY_DIR"

cat > "$MAIN_ACTIVITY_FILE" << JAVAEOF
package $APP_ID;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — مع إصلاح حرج لإذن الميكروفون داخل WebView.
 *
 * بدون هذا الـ WebChromeClient المخصّص، تفشل SpeechRecognition/
 * getUserMedia داخل WebView بصمت (NotAllowedError) حتى مع منح إذن
 * RECORD_AUDIO على مستوى النظام — هذا قيد معروف وموثّق في Capacitor.
 */
public class MainActivity extends BridgeActivity {

    private static final int MIC_PERMISSION_REQUEST_CODE = 9001;
    private PermissionRequest pendingWebViewPermissionRequest;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(@NonNull final PermissionRequest request) {
                for (String resource : request.getResources()) {
                    if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED) {
                            // إذن النظام موجود مسبقاً → منح الطبقة الثانية (WebView) فوراً
                            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                        } else {
                            // اطلب إذن النظام أولاً، ثم منح WebView في onRequestPermissionsResult
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

echo "✅ MainActivity.java أُنشئت مع إصلاح إذن الميكروفون: $MAIN_ACTIVITY_FILE"
