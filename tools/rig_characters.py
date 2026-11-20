#!/usr/bin/env python3
"""Split the character art into animation layers (a lightweight 2D rig).

    python3 tools/rig_characters.py

Every layer keeps the full source canvas, so layers stack pixel-exactly and only the
CSS transform differs. Moving parts are animated with skewY() whose transform-origin
sits on the cut line: points on the seam never move, so the cut never opens, and the
free end swings in proportion to its distance from the seam.

Hero (art/generated/hero/hero_idle.webp, 1024x1536)
  hero_scarf   free scarf tails, x < 235, y 195..800      (seam x = 235)
  hero_coat    torn coat tail,   x < 150, y 880..1360     (seam x = 150)
  hero_eyes    glowing eye pixels (pulse)
  hero_body    everything else
Leviathan (art/generated/leviathan/leviathan_idle.webp, 971x1619)
  lev_head     head, jaws and crest, x < 430, y < 600     (seam x = 430, soft bottom)
  lev_gills    glowing gill pixels (pulse)
  lev_body     everything else
"""
from __future__ import annotations

import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "art", "generated")
DST = os.path.join(ROOT, "frontend", "src", "assets", "chars")
FEATHER = 14  # px of soft blend along each seam


def region_mask(size, box, bottom_fade=0):
    """Opaque inside `box`, fading out over FEATHER px before the seam (right edge) and
    over `bottom_fade` px above the bottom edge."""
    x0, y0, x1, y1 = box
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for y in range(y0, y1 + 1):
        fy = 1.0 if bottom_fade == 0 or y < y1 - bottom_fade else (y1 - y) / bottom_fade
        for i in range(FEATHER):
            v = int(255 * fy * (1 - (i + 1) / (FEATHER + 1)))
            d.point((x1 - FEATHER + i, y), fill=v)
        d.line((x0, y, x1 - FEATHER, y), fill=int(255 * fy))
    return m.filter(ImageFilter.GaussianBlur(2))


def glow_pixels(im, box, test):
    """Layer holding only pixels inside box that pass `test` (the glowing parts)."""
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    px, po = im.load(), out.load()
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a > 0 and test(r, g, b):
                po[x, y] = (r, g, b, a)
    return out


def split(im, masks):
    """Return [part layers..., body] where body keeps what no part took."""
    parts = []
    taken = Image.new("L", im.size, 0)
    a = im.getchannel("A")
    for m in masks:
        layer = im.copy()
        layer.putalpha(ImageChops.multiply(a, m))
        parts.append(layer)
        taken = ImageChops.lighter(taken, m)
    body = im.copy()
    body.putalpha(ImageChops.multiply(a, ImageChops.invert(taken)))
    return parts, body


def save(img, name):
    os.makedirs(DST, exist_ok=True)
    img.save(os.path.join(DST, name + ".webp"), "WEBP", quality=90, method=6)


def main():
    hero = Image.open(os.path.join(SRC, "hero", "hero_idle.webp")).convert("RGBA")
    (scarf, coat), hero_body = split(hero, [
        region_mask(hero.size, (0, 195, 235, 800)),
        region_mask(hero.size, (0, 880, 150, 1360)),
    ])
    eyes = glow_pixels(hero, (455, 185, 585, 230), lambda r, g, b: g > 150 and b > 150 and r < 170)
    for img, n in [(hero_body, "hero_body"), (scarf, "hero_scarf"), (coat, "hero_coat"), (eyes, "hero_eyes")]:
        save(img, n)

    lev = Image.open(os.path.join(SRC, "leviathan", "leviathan_idle.webp")).convert("RGBA")
    (head,), lev_body = split(lev, [region_mask(lev.size, (0, 0, 430, 600), bottom_fade=60)])
    gills = glow_pixels(lev, (420, 230, 575, 395), lambda r, g, b: g > 150 and b > 140 and r < 150)
    for img, n in [(lev_body, "lev_body"), (head, "lev_head"), (gills, "lev_gills")]:
        save(img, n)
    print("rig layers written to", os.path.relpath(DST, ROOT))


if __name__ == "__main__":
    main()
