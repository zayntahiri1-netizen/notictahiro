#!/usr/bin/env python3
"""توليد أيقونات Android بدون sharp — GitHub Actions safe"""
import sys, os
try:
    from PIL import Image, ImageDraw
    import numpy as np
except ImportError:
    os.system('pip install Pillow numpy --quiet')
    from PIL import Image, ImageDraw
    import numpy as np

def radial_bg(size, inner=(31,16,66), outer=(6,4,20)):
    y,x = np.ogrid[:size,:size]; cx=cy=size/2
    d = np.clip(np.sqrt((x-cx)**2+(y-cy)**2)/(size*0.72),0,1)
    arr = np.zeros((size,size,3),np.float32)
    for i in range(3): arr[...,i] = inner[i]*(1-d)+outer[i]*d
    return Image.fromarray(arr.astype(np.uint8),'RGB')

def fit_on(canvas_rgba, logo_rgba, safe_ratio=0.72):
    s = canvas_rgba.size[0]
    inner = int(s * safe_ratio)
    lg = logo_rgba.copy(); lg.thumbnail((inner,inner), Image.LANCZOS)
    out = canvas_rgba.copy()
    out.alpha_composite(lg, ((s-lg.width)//2,(s-lg.height)//2))
    return out

def circle_mask(size):
    m = Image.new('L',(size,size),0)
    ImageDraw.Draw(m).ellipse((0,0,size-1,size-1),fill=255)
    return m

BG   = (4, 3, 16)  # #040310
RES  = 'android/app/src/main/res'

print('📦 Loading icons...')
icon_opaque = Image.open('assets/icon.png').convert('RGBA')
icon_fg     = Image.open('assets/icon-foreground.png').convert('RGBA')
print(f'  icon: {icon_opaque.size}  fg: {icon_fg.size}')

MIPMAPS = {'mipmap-mdpi':48,'mipmap-hdpi':72,'mipmap-xhdpi':96,
           'mipmap-xxhdpi':144,'mipmap-xxxhdpi':192}

print('\n🎨 Mipmap icons...')
for folder, sz in MIPMAPS.items():
    d = f'{RES}/{folder}'; os.makedirs(d, exist_ok=True)

    # ic_launcher — معتمة مربعة
    bg = radial_bg(sz).convert('RGBA')
    ic = fit_on(bg, icon_fg, 0.72)
    ic.convert('RGB').save(f'{d}/ic_launcher.png')

    # ic_launcher_round — دائري
    circ = Image.new('RGB',(sz,sz),BG)
    logo_r = icon_fg.copy(); logo_r.thumbnail((int(sz*0.72),int(sz*0.72)),Image.LANCZOS)
    tmp = Image.new('RGBA',(sz,sz),(0,0,0,0))
    tmp.alpha_composite(logo_r, ((sz-logo_r.width)//2,(sz-logo_r.height)//2))
    circ.paste(tmp.convert('RGB'), mask=circle_mask(sz))
    circ.save(f'{d}/ic_launcher_round.png')

    # ic_launcher_foreground (شفافة، منطقة أمان 66%)
    fg_out = Image.new('RGBA',(sz,sz),(0,0,0,0))
    safe = int(sz*0.66)
    lg = icon_fg.copy(); lg.thumbnail((safe,safe),Image.LANCZOS)
    fg_out.alpha_composite(lg, ((sz-lg.width)//2,(sz-lg.height)//2))
    fg_out.save(f'{d}/ic_launcher_foreground.png')

    # ic_launcher_background
    Image.new('RGB',(sz,sz),BG).save(f'{d}/ic_launcher_background.png')
    print(f'  ✅ {folder} ({sz}px)')

# Notification icon
print('\n🔔 Notification icon...')
nd = f'{RES}/drawable'; os.makedirs(nd, exist_ok=True)
ns = 96
n_logo = icon_fg.copy(); n_logo.thumbnail((ns,ns), Image.LANCZOS)
n_arr = np.array(n_logo.convert('RGBA'))
n_arr[:,:,:3] = 255  # أبيض
n_arr[:,:,3] = np.where(n_arr[:,:,3] > 60, 255, 0)  # alpha ثنائي
Image.fromarray(n_arr,'RGBA').save(f'{nd}/ic_stat_notification.png')
print('  ✅ ic_stat_notification.png')

# Splash screens
print('\n💦 Splash screens...')
for dd in [f'{RES}/drawable', f'{RES}/drawable-land',
           f'{RES}/drawable-night', f'{RES}/drawable-night-land']:
    os.makedirs(dd, exist_ok=True)
    sp = Image.new('RGBA',(2732,2732),(0,0,0,0))
    sp_logo = icon_fg.copy(); sp_logo.thumbnail((720,720),Image.LANCZOS)
    sp.alpha_composite(sp_logo,((2732-sp_logo.width)//2,(2732-sp_logo.height)//2))
    # حفظ على خلفية داكنة
    sp_out = Image.new('RGB',(2732,2732),BG)
    sp_out.paste(sp.convert('RGB'),mask=sp.getchannel('A'))
    sp_out.save(f'{dd}/splash.png')
print('  ✅ 4 splash screens')

# Play Store
print('\n🏪 Play Store 512...')
ps = radial_bg(512).convert('RGBA')
ps_logo = icon_fg.copy(); ps_logo.thumbnail((370,370),Image.LANCZOS)
ps.alpha_composite(ps_logo,((512-ps_logo.width)//2,(512-ps_logo.height)//2))
ps.convert('RGB').save('android/app/src/main/ic_launcher-playstore.png')
print('  ✅ ic_launcher-playstore.png')

print('\n✅ Done! All Android icons generated without sharp.')
