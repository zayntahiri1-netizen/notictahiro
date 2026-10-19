#!/bin/bash
# ==========================================
#  Notic Tahiro — رفع تلقائي لـ GitHub
# ==========================================

echo ""
echo "🚀 Notic Tahiro — رفع المشروع لـ GitHub"
echo "=========================================="
echo ""

read -p "👤 اسم المستخدم (username): " USERNAME
read -p "📦 اسم الـ Repository (مثل: notic-tahiro): " REPO_NAME
read -s -p "🔑 الـ Token (ghp_...): " TOKEN
echo ""
echo ""

if [ -z "$USERNAME" ] || [ -z "$REPO_NAME" ] || [ -z "$TOKEN" ]; then
  echo "❌ الرجاء إدخال جميع البيانات"
  exit 1
fi

REPO_URL="https://${TOKEN}@github.com/${USERNAME}/${REPO_NAME}.git"

echo "📁 إنشاء repository على GitHub..."
curl -s -X POST \
  -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"${REPO_NAME}\",\"private\":true,\"description\":\"Notic Tahiro — مفكرة ذكية مدعومة بالذكاء الاصطناعي\"}" \
  > /dev/null

echo "✅ github.com/${USERNAME}/${REPO_NAME}"
echo ""

git config --global user.name "${USERNAME}"
git config --global user.email "${USERNAME}@users.noreply.github.com"

[ ! -d ".git" ] && git init

git remote remove origin 2>/dev/null
git remote add origin "${REPO_URL}"
git branch -M main

# إضافة GitHub Secrets تلقائياً لـ AdMob
echo ""
echo "🔑 إضافة Secrets لـ GitHub Actions..."

# ═══════════════════════════════════════════════════════════════
# 🔑 إدارة keystore التوقيع — حماية صارمة ضد تغيّر التوقيع
# ═══════════════════════════════════════════════════════════════
echo ""
echo "🔑 فحص keystore التوقيع..."

# الأولوية القصوى: إن وُجدت نسخة احتياطية ثابتة، استخدمها دائماً.
# هذا يضمن نفس التوقيع في كل تحديث مهما حُذف مجلد المشروع.
KEYSTORE_BACKUP="$HOME/.notic-tahiro-keystore/release.keystore"

# استرجاع تلقائي من أي نسخة احتياطية متوفّرة (بالترتيب).
# هذا يجعل سير العمل (rm -rf ثم unzip) يُصلح نفسه دون توقّف،
# طالما توجد نسخة من الـ keystore الأصلي في أحد هذه المسارات.
if [ ! -f "release.keystore" ]; then
  for CAND in \
    "$KEYSTORE_BACKUP" \
    "/sdcard/Download/notic-upload-key-BACKUP.keystore" \
    "/sdcard/Download/release.keystore" \
    "$HOME/release.keystore"
  do
    if [ -f "$CAND" ]; then
      echo "♻️  استرجاع keystore من: $CAND"
      cp "$CAND" release.keystore
      echo "✅ تم الاسترجاع — التوقيع ثابت ومحفوظ"
      break
    fi
  done
fi

# فحص: هل توجد Secrets على GitHub بالفعل؟ (يعني التطبيق منشور بتوقيع معيّن)
EXISTING_SECRET=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token ${TOKEN}" \
  "https://api.github.com/repos/${USERNAME}/${REPO_NAME}/actions/secrets/ANDROID_KEYSTORE_BASE64" 2>/dev/null)

if [ ! -f "release.keystore" ]; then
  if [ "$EXISTING_SECRET" = "200" ]; then
    # ⚠️ خطر: Secrets موجودة لكن لا keystore محلي — لا تُنشئ جديداً!
    echo "🛑 توقّف! يوجد ANDROID_KEYSTORE_BASE64 على GitHub بالفعل،"
    echo "    لكن ملف release.keystore غير موجود محلياً."
    echo ""
    echo "⚠️  إنشاء keystore جديد سيُغيّر التوقيع ويكسر تحديثات Play Store!"
    echo ""
    echo "الحل: استرجع نسختك الاحتياطية من الـ keystore الأصلي:"
    echo "   cp /sdcard/Download/notic-upload-key-BACKUP.keystore release.keystore"
    echo "   أو من Google Drive حيث حفظته سابقاً."
    echo ""
    echo "إن فقدت الـ keystore الأصلي نهائياً، تواصل مع دعم Google Play"
    echo "لإعادة تعيين مفتاح الرفع (إن كان Play App Signing مفعّلاً)."
    exit 1
  else
    # أول مرة فعلاً (لا Secrets ولا keystore) → أنشئ مفتاحاً جديداً مرة واحدة
    echo "🆕 أول إعداد — إنشاء keystore جديد (مرة واحدة فقط)..."
    keytool -genkey -v \
      -keystore release.keystore \
      -alias notic-tahiro \
      -keyalg RSA -keysize 4096 -validity 10000 \
      -dname "CN=NoticTahiro,O=NoticTahiro,C=MA" \
      -storepass NoticTahiro2024 \
      -keypass NoticTahiro2024 2>/dev/null
    echo "✅ Keystore created"
  fi
fi

# احفظ نسخة احتياطية ثابتة دائماً (يحمي من الفقدان عند حذف المجلد)
mkdir -p "$HOME/.notic-tahiro-keystore"
cp release.keystore "$KEYSTORE_BACKUP" 2>/dev/null && \
  echo "💾 نسخة احتياطية محفوظة في: $KEYSTORE_BACKUP"

# طباعة بصمة التوقيع للتحقق
ACTUAL_SHA1=$(keytool -list -v -keystore release.keystore -alias notic-tahiro \
  -storepass NoticTahiro2024 2>/dev/null | grep -i "SHA1:" | head -1 | sed 's/.*SHA1: //')
echo "🔑 بصمة التوقيع SHA1: ${ACTUAL_SHA1}"

KEYSTORE_B64=$(base64 -w 0 release.keystore)

# قراءة إعدادات Supabase من .env المحلي (حرج لعمل الذكاء الاصطناعي في APK)
if [ -f ".env" ]; then
  SUPABASE_URL_VAL=$(grep "^VITE_SUPABASE_URL=" .env | cut -d= -f2-)
  SUPABASE_KEY_VAL=$(grep "^VITE_SUPABASE_ANON_KEY=" .env | cut -d= -f2-)
else
  SUPABASE_URL_VAL=""
  SUPABASE_KEY_VAL=""
fi
GH="https://api.github.com/repos/${USERNAME}/${REPO_NAME}/actions/secrets"

# التأكد من PyNaCl (مطلوب لتشفير الـ Secrets — GitHub يرفض القيم غير المشفرة)
python3 -c "import nacl" 2>/dev/null || {
  echo "📦 تثبيت pynacl لتشفير الـ Secrets..."
  pip install pynacl --quiet 2>/dev/null || pip install pynacl --break-system-packages --quiet
}

set_secret() {
  local name="$1" value="$2"
  local pubkey=$(curl -s -H "Authorization: token ${TOKEN}" \
    "https://api.github.com/repos/${USERNAME}/${REPO_NAME}/actions/secrets/public-key")
  local key_id=$(echo "$pubkey" | python3 -c "import sys,json; print(json.load(sys.stdin)['key_id'])")
  local key=$(echo "$pubkey" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")

  # التشفير عبر stdin (يتفادى مشاكل الاقتباس مع أي قيمة) — بدون fallback صامت
  local encrypted=$(printf '%s' "${value}" | python3 -c "
import sys
from base64 import b64decode, b64encode
from nacl import public
pk = public.PublicKey(b64decode('${key}'))
box = public.SealedBox(pk)
enc = box.encrypt(sys.stdin.buffer.read())
print(b64encode(enc).decode('utf-8'))
")
  if [ -z "$encrypted" ]; then
    echo "  ❌ ${name}: فشل التشفير — تأكد من تثبيت pynacl (pip install pynacl)"
    return 1
  fi

  # رفع الـ secret مع فحص رد GitHub الفعلي
  local http_code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    -H "Authorization: token ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${GH}/${name}" \
    -d "{\"encrypted_value\":\"${encrypted}\",\"key_id\":\"${key_id}\"}")
  if [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
    echo "  ✅ ${name}"
  else
    echo "  ❌ ${name}: GitHub رفض الرفع (HTTP ${http_code})"
    return 1
  fi
}

set_secret "ANDROID_KEYSTORE_BASE64"   "${KEYSTORE_B64}"
set_secret "ANDROID_KEYSTORE_PASSWORD" "NoticTahiro2024"
set_secret "ANDROID_KEY_ALIAS"         "notic-tahiro"
set_secret "ANDROID_KEY_PASSWORD"      "NoticTahiro2024"

# ── رفع إعدادات Supabase (كانت تُقرأ من .env ولا تُرفع — كود ميت!) ──
# بدونها workflow البناء ينتج APK بلا اتصال بالذكاء الاصطناعي.
if [ -n "$SUPABASE_URL_VAL" ] && [[ "$SUPABASE_URL_VAL" != *"YOUR_PROJECT_ID"* ]]; then
  set_secret "VITE_SUPABASE_URL" "${SUPABASE_URL_VAL}"
else
  echo "  ⚠️ VITE_SUPABASE_URL غير موجود في .env — الذكاء الاصطناعي لن يعمل في APK!"
fi
if [ -n "$SUPABASE_KEY_VAL" ] && [[ "$SUPABASE_KEY_VAL" != "REPLACE_"* ]]; then
  set_secret "VITE_SUPABASE_ANON_KEY" "${SUPABASE_KEY_VAL}"
else
  echo "  ⚠️ VITE_SUPABASE_ANON_KEY فارغ أو placeholder في .env — الصق المفتاح الحقيقي ثم أعد التشغيل"
fi
# سرّ حماية البروكسي (اختياري) — يُرفع فقط إن ضُبط
APP_TOKEN_VAL=$(grep "^VITE_APP_TOKEN=" .env 2>/dev/null | cut -d= -f2-)
if [ -n "$APP_TOKEN_VAL" ]; then
  set_secret "VITE_APP_TOKEN" "${APP_TOKEN_VAL}"
fi

echo ""
echo "📦 تجهيز الملفات..."
git add .
git diff --cached --quiet || git commit -m "🚀 Notic Tahiro — first release"

echo "⬆️  جاري الرفع..."
git push -u origin main --force

echo ""
echo "=========================================="
echo "✅ تم الرفع بنجاح!"
echo ""
echo "🔗 https://github.com/${USERNAME}/${REPO_NAME}"
echo "⚙️  https://github.com/${USERNAME}/${REPO_NAME}/actions"
echo ""
echo "⏳ بعد ~5 دقائق ستجد:"
echo "   📱 notic-tahiro-debug-apk   ← للتجربة الفورية"
echo "   📦 notic-tahiro-release-apk ← APK موقّع"
echo "   🏪 notic-tahiro-release-aab ← للـ Play Store"
echo "=========================================="
