import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CAPACITOR_BUILD=1 → بناء للأندرويد/iOS (chunks سريعة للـ WebView)
// الافتراضي         → بناء ويب/PWA
// ملاحظة مهمة: مكتبات Capacitor تُدمج في الحالتين — هي آمنة على الويب
// (isNativePlatform() يرجع false وتتلاشى بصمت). وضعها external يكسر المتصفح!
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    cssTarget: "safari14",
    sourcemap: false,   // لا تُرسل خرائط المصدر للإنتاج — حماية الكود وتقليل حجم الحزمة
    minify: "esbuild",
    rollupOptions: {
      output: isCapacitor
        ? {
            manualChunks: {
              vendor: ["react", "react-dom"],
            },
          }
        : {},
    },
  },
  esbuild: {
    drop: ["debugger"],
    pure: ["console.log", "console.debug", "console.info"],
  },
});
