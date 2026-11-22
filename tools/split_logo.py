#!/usr/bin/env python3
"""Split the logo into its two painted layers for animation (video/ LogoReveal, LogoIdle):
the teal brush swash (behind) and the white lettering with its ink outline (front).
Stacked, the two reproduce the original exactly.

    python3 tools/split_logo.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = os.path.join(ROOT, "art", "generated", "lettering", "logo_abyssal_tide.png")
a = np.array(Image.open(src).convert("RGBA")).astype(np.float32)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
# "tealness": green/blue clearly above red; soft ramp keeps antialiased edges
k = np.clip(((g + b) / 2 - r - 35) / 45, 0, 1)
swash = a.copy(); swash[..., 3] = al * k
letters = a.copy(); letters[..., 3] = al * (1 - k)
out = os.path.join(ROOT, "art", "generated", "lettering")
Image.fromarray(swash.astype(np.uint8), "RGBA").save(os.path.join(out, "logo_layer_swash.png"))
Image.fromarray(letters.astype(np.uint8), "RGBA").save(os.path.join(out, "logo_layer_letters.png"))
print("swash share of logo alpha: %.1f%%" % (100 * (al * k).sum() / al.sum()))
