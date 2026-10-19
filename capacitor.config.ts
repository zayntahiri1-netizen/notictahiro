import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.notictahiro.app',
  appName: 'Notic Tahiro Ai',
  webDir: 'dist',
  // bundledWebRuntime أُزيل من Capacitor 5+ — لا تضعه لتجنب تحذيرات البناء

  server: {
    androidScheme: 'https',
    // iosSchemeName: 'notic-tahiro',  // uncomment if needed
  },

  android: {
    allowMixedContent: false,
    // ⛔ captureInput يجب أن يبقى false دائماً!
    // عند تفعيله يستعمل Capacitor «اتصال إدخال بديل مبسّط» (alternative
    // InputConnection) موثّق رسمياً أنه «قد يحمل قيوداً» — وهو يكسر إدخال
    // الأحرف المركّبة/غير اللاتينية: كتابة العربية وسط النص كانت ترمي
    // الحرف لآخر النص (بينما Chrome على نفس الجهاز سليم). هذا كان السبب
    // الجذري لعطب المؤشر في العربية. لا تعد تفعيله أبداً.
    captureInput: false,
    webContentsDebuggingEnabled: false,   // false in production
  },

  ios: {
    contentInset: 'automatic',
    // scrollEnabled: false يُوصى به فقط إذا كان التطبيق يدير التمرير بنفسه
    // بالنسبة لـ Notic Tahiro الذي يحتوي على محرّر نصّي، يجب تركه true (الافتراضي)
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1600,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      // FIX: الـ splash الآن شعار شفاف متمركز — CENTER يضعه في المنتصف بحجمه
      //      الطبيعي فوق لون الخلفية دون قص أو تمدد على أي نسبة شاشة
      //      (من أصغر هاتف 320px إلى أكبر لوحة)، بعكس CENTER_CROP الذي يقص.
      androidScaleType: 'CENTER',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#8B5CF6',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#8B5CF6',
      sound: 'default',
    },
    Keyboard: {
      resize: 'body',
      style: 'default',
      resizeOnFullScreen: true,
    },
    Preferences: {
      group: 'NoticTahiroPrefs',
    },
    // ─── AdMob — حرج: بدون هذا لا تعمل الإعلانات على بعض أجهزة أندرويد ───
    // appId يجب أن يطابق APPLICATION_ID في AndroidManifest.xml
    AdMob: {
      appId: 'ca-app-pub-1725525147318224~8481725862',
      initializeForTesting: false,
    },
  },
};

export default config;
