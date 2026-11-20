"""Key the Depth Wheel glow, flash sheet and titles (delivered on painted light backgrounds).

python3 tools/prepare_wheel_fx.py <dir with 80-83.webp> art/generated
80 glow ring, 81 landing flash 4x2 sheet, 82 "STILL WATER", 83 "THE DEPTH WHEEL".
Glows: the checkerboard is flattened to white, then white is divided out (alpha from
the distance to white), so soft edges keep their falloff. Titles: flood fill from the
border through light neutral pixels, which keeps the dark ink outline crisp.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]


def load(n):
    return np.array(Image.open(f"{src}/{n}.webp").convert("RGB")).astype(float)


def grow(bg, seeds):
    """Pixels of `bg` connected to the seed mask (4-neighbour region growing)."""
    mask = seeds & bg
    while True:
        g = mask.copy()
        g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
        g &= bg
        if (g == mask).all():
            return mask
        mask = g


def unwhite(a, centres=()):
    """Glow on a painted light background -> RGBA. Light neutral pixels connected to the
    border (or to a ring's empty centre) are background; enclosed white foam stays opaque;
    soft teal haze gets alpha from its distance to white."""
    mx, mn = a.max(2), a.min(2)
    light = (mx - mn < 14) & (mn > 222)
    seeds = np.zeros_like(light)
    seeds[0] = seeds[-1] = True
    seeds[:, 0] = seeds[:, -1] = True
    for (cx, cy) in centres:
        seeds[int(cy) - 3:int(cy) + 4, int(cx) - 3:int(cx) + 4] = True
    bg = grow(light, seeds)
    a = a.copy()
    a[bg] = 255
    alpha = np.clip((255 - a.min(2)) / 255 * 1.15, 0, 1)
    rgb = np.where(alpha[..., None] > 0.004, (a - (1 - alpha[..., None]) * 255) / np.maximum(alpha[..., None], 0.004), 0)
    foam = light & ~bg
    alpha[foam] = 0.95
    rgb[foam] = a[foam]
    am = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.6))
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.array(am)]), "RGBA")


def border_key(a):
    mx, mn = a.max(2), a.min(2)
    bg = (mn > 212) & (mx - mn < 16)
    mask = np.zeros_like(bg)
    mask[0], mask[-1], mask[:, 0], mask[:, -1] = bg[0], bg[-1], bg[:, 0], bg[:, -1]
    while True:
        g = mask.copy()
        g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
        g &= bg
        if (g == mask).all():
            break
        mask = g
    am = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    return Image.fromarray(np.dstack([a.astype(np.uint8), np.array(am)]), "RGBA")


def trim(im, pad=6):
    al = np.array(im)[..., 3]
    ys, xs = np.where(al > 6)
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad + 1), min(im.height, ys.max() + pad + 1)))


unwhite(load(80), [(627, 627)]).save(f"{out}/ui/wheel/wheel_glow.png")
sheet = unwhite(load(81), [((i % 4 + .5) * 1774 / 4, (i // 4 + .5) * 887 / 2) for i in range(2, 8)])
cw, ch = sheet.width / 4, sheet.height / 2
cell = 256
strip = Image.new("RGBA", (cell * 8, cell))
for i in range(8):
    x, y = (i % 4) * cw, (i // 4) * ch
    f = sheet.crop((round(x), round(y), round(x + cw), round(y + ch))).resize((cell, cell), Image.LANCZOS)
    strip.alpha_composite(f, (i * cell, 0))
strip.save(f"{out}/effects/wheel_flash_strip.png")
trim(border_key(load(82))).save(f"{out}/lettering/title_still_water.png")
trim(border_key(load(83))).save(f"{out}/lettering/title_depth_wheel.png")
for n, name in [(80, "ui/wheel/wheel_glow"), (81, "effects/wheel_flash_sheet"), (82, "lettering/title_still_water"), (83, "lettering/title_depth_wheel")]:
    Image.open(f"{src}/{n}.webp").save(f"{out}/{name}_source_CHECKERBOARD.webp")
print("ok")
