/**
 * generate-icons.js
 * يولّد جميع أيقونات Android و iOS و PWA من ملف icon.svg
 * يتطلب: npm install sharp
 * التشغيل: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// FIX: المصدر الآن صور PNG النظيفة للشعار الرسمي (بدون نمط شطرنجي)
//  - icon-transparent.png : الشعار بخلفية شفافة (للأيقونات الشفافة + foreground)
//  - icon.png             : الشعار على خلفية داكنة معتمة (لـ iOS واللانشر)
const TRANSPARENT_SRC = join(ROOT, 'assets/icon-transparent.png');
const OPAQUE_SRC      = join(ROOT, 'assets/icon.png');

let svgBuffer;     // النسخة الشفافة (الاسم تاريخي — المحتوى PNG الآن)
let opaqueBuffer;  // النسخة المعتمة
try {
  svgBuffer    = readFileSync(TRANSPARENT_SRC);
  opaqueBuffer = readFileSync(OPAQUE_SRC);
} catch {
  console.error('❌  source logos not found:', TRANSPARENT_SRC, OPAQUE_SRC);
  process.exit(1);
}

// ──────────────────────────────────────────────
//  Android mipmap densities
// ──────────────────────────────────────────────
const ANDROID_ICONS = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// ──────────────────────────────────────────────
//  iOS AppIcon sizes (App Store requirements)
// ──────────────────────────────────────────────
const IOS_ICONS = [
  { name: 'Icon-20.png',      size: 20   },
  { name: 'Icon-20@2x.png',   size: 40   },
  { name: 'Icon-20@3x.png',   size: 60   },
  { name: 'Icon-29.png',      size: 29   },
  { name: 'Icon-29@2x.png',   size: 58   },
  { name: 'Icon-29@3x.png',   size: 87   },
  { name: 'Icon-40.png',      size: 40   },
  { name: 'Icon-40@2x.png',   size: 80   },
  { name: 'Icon-40@3x.png',   size: 120  },
  { name: 'Icon-60@2x.png',   size: 120  },
  { name: 'Icon-60@3x.png',   size: 180  },
  { name: 'Icon-76.png',      size: 76   },
  { name: 'Icon-76@2x.png',   size: 152  },
  { name: 'Icon-83.5@2x.png', size: 167  },
  { name: 'Icon-1024.png',    size: 1024 },  // App Store Connect
];

// ──────────────────────────────────────────────
//  Helper: create rounded-rect mask SVG overlay
// ──────────────────────────────────────────────
function roundedMask(size, radiusPct = 22) {
  const r = Math.round(size * radiusPct / 100);
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>
     </svg>`
  );
}

// Background color for icons that require a solid bg (iOS + Android launcher)
const BG_COLOR = { r: 15, g: 3, b: 48, alpha: 255 }; // deep purple #0f0330

async function run() {
  console.log('🎨 Generating icons from:', SVG);

  // ── Android ──────────────────────────────────
  const androidBase = join(ROOT, 'android/app/src/main/res');
  if (!existsSync(join(ROOT, 'android'))) {
    console.warn('⚠️  android/ folder not found – skipping Android icons');
    console.warn('   Run: npx cap add android   then try again');
  } else {
    for (const { dir, size } of ANDROID_ICONS) {
      const dest = join(androidBase, dir);
      mkdirSync(dest, { recursive: true });

      // Standard launcher (opaque art + rounded corners)
      await sharp(opaqueBuffer)
        .resize(size, size)
        .composite([{ input: roundedMask(size, 22), blend: 'dest-in' }])
        .png()
        .toFile(join(dest, 'ic_launcher.png'));

      // Round launcher (circle)
      await sharp(opaqueBuffer)
        .resize(size, size)
        .composite([{ input: roundedMask(size, 50), blend: 'dest-in' }])
        .png()
        .toFile(join(dest, 'ic_launcher_round.png'));

      // Adaptive foreground (transparent, 125% size)
      const fgSize = Math.round(size * 1.25);
      const padded = Math.round((fgSize - size) / 2);
      await sharp(svgBuffer)
        .resize(size, size)
        .extend({ top: padded, bottom: padded, left: padded, right: padded,
                  background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(join(dest, 'ic_launcher_foreground.png'));

      console.log(`  ✅ Android ${dir} (${size}px)`);
    }

    // Notification icon: white silhouette for status bar (xxxhdpi)
    const notifDest = join(androidBase, 'drawable');
    mkdirSync(notifDest, { recursive: true });
    await sharp(svgBuffer)
      .resize(96, 96)
      .greyscale()
      .threshold(128)
      .negate()
      .png()
      .toFile(join(notifDest, 'ic_stat_notification.png'));
    console.log('  ✅ Android notification icon');
  }

  // ── iOS ──────────────────────────────────────
  const iosBase = join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  if (!existsSync(join(ROOT, 'ios'))) {
    console.warn('⚠️  ios/ folder not found – skipping iOS icons');
    console.warn('   Run: npx cap add ios   then try again');
  } else {
    mkdirSync(iosBase, { recursive: true });
    for (const { name, size } of IOS_ICONS) {
      // iOS requires NO transparency — استخدم النسخة المعتمة مباشرة
      await sharp(opaqueBuffer)
        .resize(size, size)
        .png()
        .toFile(join(iosBase, name));
      if (size >= 120) console.log(`  ✅ iOS ${name} (${size}px)`);
    }

    // Xcode Contents.json
    const images = IOS_ICONS.map(({ name, size }) => {
      const base = parseInt(name.replace('Icon-', '').split('@')[0].replace('.png', ''));
      const scale = name.includes('@3x') ? '3x' : name.includes('@2x') ? '2x' : '1x';
      const isIpad = size >= 76;
      return {
        filename: name,
        idiom: isIpad ? 'ipad' : 'iphone',
        scale,
        size: `${base}x${base}`,
      };
    });
    writeFileSync(
      join(iosBase, 'Contents.json'),
      JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2)
    );
    console.log('  ✅ iOS Contents.json');
  }

  // ── PWA / Public icons ────────────────────────
  const pwaDest = join(ROOT, 'public/icons');
  mkdirSync(pwaDest, { recursive: true });

  // Regular icons (transparent bg, for browsers)
  // FIX: أضيف 144px للـ manifest وأجهزة iPad/Android القديمة
  for (const size of [72, 96, 128, 144, 192, 512]) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(pwaDest, `icon-${size}.png`));
    console.log(`  ✅ PWA icon-${size}.png`);
  }

  // ic_stat_notification — أيقونة الإشعار البيضاء للـ PWA (تُنسخ للـ public/icons)
  await sharp(svgBuffer)
    .resize(96, 96)
    .greyscale()
    .threshold(128)
    .negate()
    .png()
    .toFile(join(pwaDest, 'ic_stat_notification.png'));
  console.log('  ✅ PWA ic_stat_notification.png');

  // Maskable icon: subject at 80% with safe zone (20% padding around)
  {
    const size = 512;
    const inner = Math.round(size * 0.72); // منطقة الأمان للأقنعة الدائرية
    const pad   = Math.round((size - inner) / 2);
    await sharp(svgBuffer)
      .resize(inner, inner)
      .extend({
        top: pad, bottom: pad, left: pad, right: pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .flatten(BG_COLOR)
      .png()
      .toFile(join(pwaDest, 'icon-maskable-512.png'));
    console.log('  ✅ PWA icon-maskable-512.png');
  }

  console.log('\n🎉 All icons generated successfully!');
}

run().catch(e => { console.error('❌', e); process.exit(1); });
