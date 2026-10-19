#!/bin/bash
# ==========================================
#  نشر دالة gemini-proxy على Supabase
#  المشروع: oispxxmxltkmkcmoqxmy
# ==========================================

echo ""
echo "🧠 نشر دالة Gemini AI على Supabase"
echo "====================================="

# 1) ربط المشروع
echo "🔗 ربط المشروع..."
supabase link --project-ref oispxxmxltkmkcmoqxmy

# 2) ضبط المفتاح
read -s -p "🔑 أدخل مفتاح Gemini API (من ai.google.dev): " GEMINI_KEY
echo ""
if [ -z "$GEMINI_KEY" ]; then
  echo "❌ مفتاح Gemini مطلوب"
  exit 1
fi

supabase secrets set GEMINI_API_KEY="$GEMINI_KEY"
echo "✅ GEMINI_API_KEY مضبوط"

# 3) نشر الدالة
echo ""
echo "🚀 جاري نشر gemini-proxy..."
supabase functions deploy gemini-proxy --no-verify-jwt

echo ""
echo "✅ تم النشر!"
echo ""
echo "🧪 اختبار الدالة:"
echo "curl -X POST https://oispxxmxltkmkcmoqxmy.supabase.co/functions/v1/gemini-proxy \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"prompt\":\"قل مرحبا بكلمة واحدة\",\"maxTokens\":20}'"
