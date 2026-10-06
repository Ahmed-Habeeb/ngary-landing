#!/usr/bin/env python3
"""Cut the round logo badge out of assets-src/brand/logo-source.png.

The badge is found from its saturated purple/teal ring (so the grey
"AI-generated content" watermark in the source's corner is ignored), masked to
a clean anti-aliased circle with a transparent background, then written as
AVIF/WebP/PNG sizes for the header, footer, intro, favicons and OG cards.

    python3 scripts/logo.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'brand' / 'logo-source.png'
OUT = ROOT / 'public' / 'brand'


def main():
    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    hsv = im.convert('HSV')
    px = hsv.load()
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            _, s, v = px[x, y]
            if s > 90 and v > 60:  # the coloured ring, not white or grey
                xs.append(x)
                ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = min(x1 - x0, y1 - y0) / 2 + 1
    box = (round(cx - r), round(cy - r), round(cx + r), round(cy + r))
    badge = im.crop(box).convert('RGBA')
    size = badge.width
    # anti-aliased circular mask (4× supersampled)
    big = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(big).ellipse((2, 2, size * 4 - 3, size * 4 - 3), fill=255)
    badge.putalpha(big.resize((size, size), Image.LANCZOS))
    print(f'badge: centre ({cx:.0f},{cy:.0f}) radius {r:.0f} → {size}px')

    OUT.mkdir(parents=True, exist_ok=True)
    for s in (96, 192, 320, 640):
        b = badge.resize((s, s), Image.LANCZOS)
        b.save(OUT / f'logo-{s}.webp', quality=90, method=6)
        b.save(OUT / f'logo-{s}.avif', quality=70, speed=6)
    badge.resize((512, 512), Image.LANCZOS).save(OUT / 'logo-512.png', optimize=True)
    # favicons + home-screen icon
    badge.resize((48, 48), Image.LANCZOS).save(ROOT / 'public' / 'favicon-48.png', optimize=True)
    badge.resize((32, 32), Image.LANCZOS).save(ROOT / 'public' / 'favicon-32.png', optimize=True)
    touch = Image.new('RGBA', (180, 180), (250, 246, 240, 255))  # iOS ignores transparency
    touch.alpha_composite(badge.resize((168, 168), Image.LANCZOS), (6, 6))
    touch.convert('RGB').save(ROOT / 'public' / 'apple-touch-icon.png', optimize=True)


if __name__ == '__main__':
    main()
