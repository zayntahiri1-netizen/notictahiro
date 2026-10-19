import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ملاحظة مهمة: مكتبات Capacitor تُدمج في بناء الويب أيضاً — هي آمنة هناك
// (isNativePlatform() يرجع false وتتلاشى بصمت). وضعها external يكسر المتصفح!
//
// متغيّر CAPACITOR_BUILD لم يعد يُغيّر شيئاً في هذا الملف: كان يُفعّل
// تقسيم vendor الذي أسقط التطبيق (انظر rollupOptions أدناه). يبقى في
// package.json لأن سكربتات البناء تمرّره، لكن البناءين صارا متطابقين —
// وهذا مقصود: اختلافهما هو ما جعل عطباً يظهر في النسخة المشحونة وحدها.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    // ⚠️ كان "es2020" — وهذا سقفٌ أعلى مما يحتمله جزء من أجهزة أندرويد.
    //
    // صياغة ES2020 (?. و ??) تحتاج Chrome 80+. و WebView الأصلي يأتي:
    //   أندرويد 7.0 → 51 · 7.1 → 55 · 8.0 → 58 · 8.1 → 63
    // و minSdk هنا 24 (أندرويد 7). على أي جهاز لم يُحدَّث WebView فيه،
    // لا تُحلَّل الحزمة أصلاً: لا تعطّل، لا رسالة، شاشة فارغة فقط —
    // وهو وصف "يُثبَّت ويُفتح ولا يعمل" حرفياً. ولا يظهر على هاتف المطوّر
    // لأن WebView لديه محدَّث، بينما مصفوفات اختبار Play تعمل على صور
    // نظام أصلية.
    //
    // chrome61 هو الحدّ الصحيح لا أقلّ: <script type="module"> نفسه لا
    // يعمل قبل Chrome 61، فاستهداف أدنى من ذلك وهمٌ لا يزيد توافقاً.
    // esbuild يُترجم ?. و ?? و async/await نزولاً — الكلفة بضعة كيلوبايت.
    // ⚠️ safari14 هنا يكسر البناء، وليس لنقص دعم: esbuild يعلم أن
    // Safari ≤14 فيه عطب في الـdestructuring فيحاول ترجمته نزولاً، وهو
    // تحويل غير مُنفَّذ عنده — فيفشل البناء كله بـ"Transforming
    // destructuring ... is not supported yet". safari15 أدنى قيمة سليمة.
    // (cssTarget أدناه يبقى safari14 — هو مسار مستقل ولا علاقة له بهذا.)
    target: ["chrome61", "safari15"],
    cssTarget: "safari14",
    sourcemap: false,   // لا تُرسل خرائط المصدر للإنتاج — حماية الكود وتقليل حجم الحزمة
    minify: "esbuild",
    // ⚠️ أُزيلت manualChunks: { vendor: ["react", "react-dom"] }
    //
    // كانت تُفعَّل في بناء أندرويد وحده، وتُنتج عند الإقلاع:
    //     Cannot access 'g' before initialization
    // فيُقلع التطبيق ثم يسقط فوراً على شاشة الخطأ — وهو بالضبط ما وصفته
    // Google بـ"يُثبَّت ويُفتح ولا يعمل".
    //
    // السبب: حصر react و react-dom في جزء مستقلّ لا ينقل معهما ما يتفرّع
    // عنهما (react/jsx-runtime مثلاً، وهو ما يستورده كل مكوّن مع JSX
    // التلقائي). فيبقى في الجزء الرئيسي، ويصير الجزءان يعتمد كلٌّ منهما
    // على الآخر: دورة بين الأجزاء لا بين الملفات — ولهذا لم يكشفها فحص
    // الاستيراد الدائري في src/. وعند التشغيل يُقرأ رمزٌ من جزء لم
    // يُهيَّأ بعد، فيُرمى خطأ المنطقة الميتة (TDZ).
    //
    // ولماذا لم يظهر في التطوير؟ لأن vite dev لا يحزّم أصلاً، وبناء
    // الويب كان يستثني هذه الكتلة. فكان العطب حصراً في النسخة المشحونة.
    //
    // الحلّ: نترك التقسيم لـRollup — فهو يحسب التبعيات ويتجنّب هذه
    // الدورة. والكلفة معدومة هنا: الأصول محلّية داخل التطبيق، فلا فائدة
    // من تقسيمٍ وُضع أصلاً لتخزين CDN مؤقّت لا وجود له.
    rollupOptions: {},
  },
  esbuild: {
    drop: ["debugger"],
    pure: ["console.log", "console.debug", "console.info"],
  },
});
