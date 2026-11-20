#!/usr/bin/env python3
"""Convert approved art in art/generated/ into game-ready WebP assets.

    python3 tools/prepare_game_assets.py

Writes frontend/src/assets/{sym,chars,ui,fx,lettering}/*.webp, resized for the largest
on-screen size at 2x pixel density, with alpha preserved. Re-run after any art update.
"""
from __future__ import annotations

import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "art", "generated")
DST = os.path.join(ROOT, "frontend", "src", "assets")

# (source relative to art/generated, destination relative to assets, max edge px)
JOBS = [
    # symbols (cell <= ~150 css px -> 320 px)
    ("symbols/tile_parchment.png", "sym/tile.webp", 320),
    ("symbols/L1_seahorse.png", "sym/L1.webp", 320),
    ("symbols/L2_starfish.png", "sym/L2.webp", 320),
    ("symbols/L3_coral.png", "sym/L3.webp", 320),
    ("symbols/L4_shell.png", "sym/L4.webp", 320),
    ("symbols/L5_pearl.png", "sym/L5.webp", 320),
    ("symbols/H1_jellyfish.png", "sym/H1.webp", 320),
    ("symbols/H2_nautilus.png", "sym/H2.webp", 320),
    ("symbols/H3_anglerfish.png", "sym/H3.webp", 320),
    ("symbols/H4_kraken.png", "sym/H4.webp", 320),
    ("symbols/H5_trident.png", "sym/H5.webp", 320),
    ("symbols/W_wild.png", "sym/W.webp", 320),
    ("symbols/S_compass.png", "sym/S.webp", 320),
    ("symbols/S2_abyssal_compass.png", "sym/S2.webp", 320),
    ("symbols/H6_leviathan_mega.png", "sym/H6.webp", 1254),  # sliced up to 6x6
    # characters: rigged layers come from tools/rig_characters.py
    # UI
    ("ui/grid_frame.png", "ui/grid_frame.webp", 1100),
    ("ui/hp_bar_frame.png", "ui/hp_frame.webp", 1400),
    ("ui/hp_bar_fill.png", "ui/hp_fill.webp", 1400),
    ("ui/control_bar.png", "ui/control_bar.webp", 1600),
    ("ui/spin_button.png", "ui/spin.webp", 280),
    ("ui/buy_badge.png", "ui/buy_badge.webp", 200),
    ("ui/buy_menu/card.png", "ui/card.webp", 560),
    ("ui/buy_menu/hunt_compasses.png", "ui/illus_hunt.webp", 420),
    ("ui/buy_menu/trench_hunt_abyssal.png", "ui/illus_trench.webp", 420),
    ("ui/buy_menu/mystery_chest.png", "ui/illus_mystery.webp", 420),
    ("ui/buy_menu/free_spins_grid.png", "ui/illus_freespins.webp", 420),
    # lettering
    ("lettering/logo_abyssal_tide.png", "lettering/logo.webp", 640),
    # effects
    ("effects/win_glow_ring.png", "fx/glow_ring.webp", 360),
    ("effects/ink_splash.png", "fx/ink_splash.webp", 520),
    ("effects/water_slash.png", "fx/water_slash.webp", 900),
    ("effects/overlay_backdrop.png", "fx/overlay_backdrop.webp", 1500),
]
GLOBS = [
    ("ui/powerups/*.png", "ui/pu", 96),
    ("lettering/title_*.png", "lettering", 1000),
    ("effects/bubbles/bubble_*.png", "fx", 64),
    ("effects/flakes/flake_*.png", "fx", 72),
]


def convert(src: str, dst: str, edge: int) -> None:
    im = Image.open(src).convert("RGBA")
    if max(im.size) > edge:
        im.thumbnail((edge, edge), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "WEBP", quality=88, method=6)


def main() -> None:
    total = 0
    for rel, out, edge in JOBS:
        dst = os.path.join(DST, out)
        convert(os.path.join(SRC, rel), dst, edge)
        total += os.path.getsize(dst)
    for pattern, outdir, edge in GLOBS:
        for src in sorted(glob.glob(os.path.join(SRC, pattern))):
            name = os.path.splitext(os.path.basename(src))[0]
            dst = os.path.join(DST, outdir, name + ".webp")
            convert(src, dst, edge)
            total += os.path.getsize(dst)
    print(f"wrote game assets: {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
