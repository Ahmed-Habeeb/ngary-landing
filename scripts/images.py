#!/usr/bin/env python3
"""Offline image pipeline (system Python + Pillow, not an npm dependency).

Crops each source photo in assets-src/photos/ around a focal point to its
slot's aspect ratio and writes AVIF + WebP at several widths into
public/img/. The page references them with <picture> + srcset + explicit
width/height (no layout shift) and lazy-loads everything below the fold.

    python3 scripts/images.py            # build all
    python3 scripts/images.py --preview  # also writes assets-src/preview.png
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'photos'
OUT = ROOT / 'public' / 'img'

# name: (aspect w/h, focal x, focal y, widths)
ROOM = (4 / 3, (640, 960, 1280))
PIECE = (1.0, (360, 560, 800))
WHY = (16 / 10, (480, 800, 1200))
MANIFEST = {
    'room-living': (*ROOM[:1], .5, .62, ROOM[1]),
    'room-bedroom': (*ROOM[:1], .5, .6, ROOM[1]),
    'room-dining': (*ROOM[:1], .55, .55, ROOM[1]),
    'room-office': (*ROOM[:1], .5, .5, ROOM[1]),
    'room-custom': (*ROOM[:1], .45, .5, ROOM[1]),
    'why-workshop': (*WHY[:1], .3, .5, WHY[1]),
    'why-measure': (*WHY[:1], .5, .45, WHY[1]),
    'why-showroom': (*WHY[:1], .5, .5, WHY[1]),
    'why-delivery': (*WHY[:1], .35, .5, WHY[1]),
    'visit-showroom': (4 / 3, .55, .5, (640, 960, 1280)),
    'piece-sofa': (*PIECE[:1], .5, .55, PIECE[1]),
    'piece-armchair': (*PIECE[:1], .52, .55, PIECE[1]),
    'piece-coffee': (*PIECE[:1], .5, .62, PIECE[1]),
    'piece-bed': (*PIECE[:1], .6, .6, PIECE[1]),
    'piece-wardrobe': (*PIECE[:1], .5, .5, PIECE[1]),
    'piece-dresser': (*PIECE[:1], .45, .55, PIECE[1]),
    'piece-dining': (*PIECE[:1], .5, .6, PIECE[1]),
    'piece-sideboard': (*PIECE[:1], .45, .55, PIECE[1]),
    'piece-desk': (*PIECE[:1], .5, .6, PIECE[1]),
    'piece-officechair': (*PIECE[:1], .55, .6, PIECE[1]),
    'piece-storage': (*PIECE[:1], .5, .5, PIECE[1]),
}


def crop(im, aspect, fx, fy):
    w, h = im.size
    if w / h > aspect:  # too wide: crop width
        cw, ch = round(h * aspect), h
    else:  # too tall: crop height
        cw, ch = w, round(w / aspect)
    x = min(max(round(fx * w - cw / 2), 0), w - cw)
    y = min(max(round(fy * h - ch / 2), 0), h - ch)
    return im.crop((x, y, x + cw, y + ch))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    previews = []
    manifest = {}
    for name, (aspect, fx, fy, widths) in MANIFEST.items():
        im = Image.open(SRC / f'{name}.jpg').convert('RGB')
        c = crop(im, aspect, fx, fy)
        for w in widths:
            if w > c.width:
                continue
            r = c.resize((w, round(w / aspect)), Image.LANCZOS)
            r.save(OUT / f'{name}-{w}.avif', quality=52, speed=6)
            r.save(OUT / f'{name}-{w}.webp', quality=78, method=6)
        done = [w for w in widths if w <= c.width]
        manifest[name] = {'widths': done, 'width': done[-1], 'height': round(done[-1] / aspect)}
        previews.append((name, c))
        print(f'{name}: {c.size} → {", ".join(map(str, widths))}')
    # read by the nagary-i18n plugin (vite.config.js) to write <picture> markup
    (ROOT / 'src' / 'img-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    if '--preview' in sys.argv:
        cols, cw, chh = 6, 300, 260
        rows = (len(previews) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cw, rows * chh), (40, 40, 40))
        d = ImageDraw.Draw(sheet)
        for i, (name, c) in enumerate(previews):
            t = c.copy()
            t.thumbnail((cw - 8, chh - 30))
            x, y = (i % cols) * cw, (i // cols) * chh
            sheet.paste(t, (x + 4, y + 4))
            d.text((x + 6, y + chh - 22), name, fill=(255, 255, 0))
        sheet.save(ROOT / 'assets-src' / 'preview.png')


if __name__ == '__main__':
    main()
