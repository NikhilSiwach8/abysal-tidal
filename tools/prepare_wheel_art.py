"""Cut the delivered Depth Wheel art: python3 tools/prepare_wheel_art.py <dir with 75-79.webp> art/generated/ui/wheel
75 hub, 76 2x2 wash sheet, 77 pointer (painted light background, keyed), 78 2x2 emblem sheet, 79 rim."""
import sys
from PIL import Image
import numpy as np
from PIL import ImageDraw, ImageFilter
src, out = sys.argv[1], sys.argv[2]
I = lambda n: Image.open(f"{src}/{n}.webp")
def trim(im, pad=8):
    a = np.array(im)[..., 3]; ys, xs = np.where(a > 8)
    return im.crop((max(0, xs.min()-pad), max(0, ys.min()-pad), min(im.width, xs.max()+pad+1), min(im.height, ys.max()+pad+1)))
# hub, rim: already transparent
I(75).save(f"{out}/wheel_hub_source.webp"); trim(I(75).convert("RGBA"), 0).save(f"{out}/wheel_hub.png")
I(79).save(f"{out}/wheel_rim_source.webp"); I(79).convert("RGBA").save(f"{out}/wheel_rim.png")
# washes: 2x2 sheet, cut each quadrant with an inset to drop the seams
w = I(76).convert("RGB"); I(76).save(f"{out}/washes_sheet_source.webp"); h = w.width // 2
for (i, name) in enumerate(["still", "undertow", "maelstrom", "abyssal"]):
    x, y = (i % 2) * h, (i // 2) * h
    w.crop((x + 10, y + 10, x + h - 10, y + h - 10)).save(f"{out}/wash_{name}.png")
# emblems: 2x2 sheet with alpha
e = I(78).convert("RGBA"); I(78).save(f"{out}/emblems_sheet_source.webp")
for (i, name) in enumerate(["still", "undertow", "maelstrom", "abyssal"]):
    x, y = (i % 2) * h, (i // 2) * h
    trim(e.crop((x, y, x + h, y + h))).save(f"{out}/emblem_{name}.png")
# pointer: light painted background -> flood fill from the border
p = I(77).convert("RGB"); I(77).save(f"{out}/wheel_pointer_source_CHECKERBOARD.webp")
a = np.array(p).astype(float); mx, mn = a.max(2), a.min(2)
bg = (mn > 205) & (mx - mn < 18)
mask = np.zeros_like(bg); mask[0] = bg[0]; mask[-1] = bg[-1]; mask[:, 0] = bg[:, 0]; mask[:, -1] = bg[:, -1]
while True:  # grow the border region through background pixels until stable
    g = mask.copy()
    g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
    g &= bg
    if (g == mask).all(): break
    mask = g
am = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
alpha = np.array(am)
rgba = np.dstack([np.array(p), alpha]); trim(Image.fromarray(rgba, "RGBA")).save(f"{out}/wheel_pointer.png")
print("ok")
