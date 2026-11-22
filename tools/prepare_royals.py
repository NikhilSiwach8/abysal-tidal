#!/usr/bin/env python3
"""Cut the delivered 10/J/Q/K/A low symbols into art/generated/symbols/.

    python3 tools/prepare_royals.py <dir with 90-94.webp>

90 = A (painted checkerboard: background flattened to white, white divided out so the soft
watercolour edges keep their falloff); 91 K, 92 Q, 93 J, 94 10 already have real alpha.
Every symbol is trimmed and re-centred on a square canvas with a 6% margin.
"""
import os
import sys
import numpy as np
from PIL import Image

src = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "art", "generated", "symbols")
JOBS = {90: "L5_ace", 91: "L4_king", 92: "L3_queen", 93: "L2_jack", 94: "L1_ten"}


def grow(bg, seeds):
    mask = seeds & bg
    while True:
        g = mask.copy()
        g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
        g &= bg
        if (g == mask).all():
            return mask
        mask = g


def key_checker(img):
    a = np.array(img.convert("RGB")).astype(float)
    mx, mn = a.max(2), a.min(2)
    light = (mx - mn < 12) & (mn > 205)
    seeds = np.zeros_like(light); seeds[0] = seeds[-1] = True; seeds[:, 0] = seeds[:, -1] = True
    bg = grow(light, seeds)
    a[bg] = 255
    alpha = np.clip((255 - a.min(2)) / 255 * 1.25, 0, 1)
    rgb = np.where(alpha[..., None] > 0.004, (a - (1 - alpha[..., None]) * 255) / np.maximum(alpha[..., None], 0.004), 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")


def square(im, margin=0.06):
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bb)
    side = int(max(im.size) / (1 - 2 * margin))
    out = Image.new("RGBA", (side, side))
    out.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return out


for n, name in JOBS.items():
    im = Image.open(os.path.join(src, f"{n}.webp"))
    im.save(os.path.join(OUT, f"{name}_source.webp"))
    im = key_checker(im) if n == 90 else im.convert("RGBA")
    square(im).save(os.path.join(OUT, f"{name}.png"))
    print(name, square(im).size)
