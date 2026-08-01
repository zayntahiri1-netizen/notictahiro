#!/bin/bash
# ============================================================
# create-keystore.sh
# أنشئ مفتاح توقيع Android (افعل هذا مرة واحدة فقط!)
# ============================================================

set -e

KEYSTORE="release.keystore"
ALIAS="notic-tahiro"
VALIDITY=10000  # ~27 سنة

# ⚠️ حماية حرجة: لا تُنشئ keystore جديداً إن كان موجوداً!
# إنشاء مفتاح جديد فوق القديم = توقيع مختلف = استحالة تحديث التطبيق
# على Play Store إلى الأبد. هذا أخطر خطأ ممكن.
if [ -f "$KEYSTORE" ]; then
  echo "🛑 توقّف! الملف $KEYSTORE موجود بالفعل."
  echo ""
  echo "⚠️  إنشاء keystore جديد سيُنتج توقيعاً مختلفاً ويكسر تحديثات"
  echo "    التطبيق على Play Store نهائياً."
  echo ""
  echo "إن كنت متأكداً 100% أنك تريد إنشاء مفتاح جديد (تطبيق جديد فقط!):"
  echo "   1. احفظ نسخة احتياطية من $KEYSTORE أولاً"
  echo "   2. احذفه يدوياً: rm $KEYSTORE"
  echo "   3. ثم أعد تشغيل هذا السكريبت"
  echo ""
  exit 1
fi

echo "🔑 إنشاء Android Keystore..."
echo ""
echo "⚠️  احتفظ بهذا الملف في مكان آمن — لا يمكن استبداله!"
echo ""

keytool -genkey -v \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity "$VALIDITY" \
  -dname "CN=Notic Tahiro, OU=Mobile, O=Notic, L=Casablanca, ST=MA, C=MA"

echo ""
echo "✅ تم إنشاء: $KEYSTORE"
echo ""
echo "📋 الخطوة التالية — حوّل الملف إلى Base64 للـ GitHub Secrets:"
echo ""
echo "   base64 -w 0 $KEYSTORE"
echo ""
echo "ثم أضف هذه الـ Secrets إلى GitHub:"
echo "   ANDROID_KEYSTORE_BASE64     ← ناتج الأمر أعلاه"
echo "   ANDROID_KEYSTORE_PASSWORD   ← كلمة مرور الـ keystore"
echo "   ANDROID_KEY_ALIAS           ← $ALIAS"
echo "   ANDROID_KEY_PASSWORD        ← كلمة مرور المفتاح"
