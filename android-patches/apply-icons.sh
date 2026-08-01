#!/bin/bash
# نسخ الأيقونات المُولَّدة مسبقاً إلى مجلد أندرويد
# يُستدعى من GitHub Actions بعد: npx cap sync android

ANDROID_RES="android/app/src/main/res"
PATCHES_RES="android-patches/res"

if [ ! -d "android" ]; then
  echo "❌ مجلد android/ غير موجود — شغّل: npx cap add android أولاً"
  exit 1
fi

echo "📦 نسخ الأيقونات إلى $ANDROID_RES ..."

for density in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi mipmap-anydpi-v26 drawable drawable-night; do
  src="$PATCHES_RES/$density"
  dst="$ANDROID_RES/$density"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    cp -f "$src"/* "$dst"/
    echo "  ✅ $density"
  fi
done

echo ""
echo "✅ الأيقونات والـ Splash جاهزة في android/"
