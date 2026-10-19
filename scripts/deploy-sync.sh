#!/bin/bash
# ==========================================
#  نشر المزامنة السحابية (device-sync)
#  المشروع: oispxxmxltkmkcmoqxmy
# ==========================================
#
# خطوتان، والأولى تُنفَّذ مرة واحدة فقط:
#   1. إنشاء الجدول  → supabase/migrations/002_device_sync.sql
#   2. نشر الدالة     → supabase/functions/device-sync
#
# ⚠️ الدالة بلا الجدول تُعيد DB_INSERT_FAILED عند أول مزامنة. لذلك
# يسألك السكربت عن الجدول قبل النشر بدل أن يتركك تكتشف ذلك من الهاتف.

set -e

echo ""
echo "☁️  نشر المزامنة السحابية — Notic Tahiro"
echo "========================================"
echo ""
echo "الخطوة 1/2 — جدول قاعدة البيانات"
echo "────────────────────────────────"
echo "افتح: https://supabase.com/dashboard/project/oispxxmxltkmkcmoqxmy/sql/new"
echo "والصق محتوى هذا الملف ثم شغّله:"
echo ""
echo "    supabase/migrations/002_device_sync.sql"
echo ""
echo "(آمن لإعادة التشغيل أي عدد من المرات)"
echo ""
read -p "هل شغّلت الـ SQL؟ [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "⏸️  توقّفنا. شغّل الـ SQL أولاً ثم أعد تشغيل هذا السكربت."
  exit 0
fi

echo ""
echo "الخطوة 2/2 — نشر الدالة"
echo "───────────────────────"
supabase link --project-ref oispxxmxltkmkcmoqxmy
supabase functions deploy device-sync --no-verify-jwt

echo ""
echo "✅ تم النشر!"
echo ""
echo "🧪 اختبار سريع (يجب أن يرجع BAD_DEVICE_ID — أي أن الدالة حيّة وتتحقّق):"
echo "curl -s -X POST https://oispxxmxltkmkcmoqxmy.supabase.co/functions/v1/device-sync \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"action\":\"pull\",\"deviceId\":\"not-a-uuid\",\"secret\":\"0000000000000000000000000000000000\"}'"
echo ""
echo "ثم من التطبيق: القائمة الجانبية ← ☁️ المزامنة السحابية ← فعّلها."
