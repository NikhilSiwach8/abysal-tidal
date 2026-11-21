#!/usr/bin/env python3
"""Convert approved art in art/generated/ into game-ready WebP assets.

    python3 tools/prepare_game_assets.py

Writes frontend/src/assets/{sym,chars,ui,fx,lettering}/*.webp, resized for the largest
on-screen size at 2x desktop / 3x phone pixel density (tools: scratchpad asset audit), with alpha preserved. Re-run after any art update.
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
    ("symbols/tile_parchment.png", "sym/tile.webp", 400),
    ("symbols/L1_seahorse.png", "sym/L1.webp", 400),
    ("symbols/L2_starfish.png", "sym/L2.webp", 400),
    ("symbols/L3_coral.png", "sym/L3.webp", 400),
    ("symbols/L4_shell.png", "sym/L4.webp", 400),
    ("symbols/L5_pearl.png", "sym/L5.webp", 400),
    ("symbols/H1_jellyfish.png", "sym/H1.webp", 400),
    ("symbols/H2_nautilus.png", "sym/H2.webp", 400),
    ("symbols/H3_anglerfish.png", "sym/H3.webp", 400),
    ("symbols/H4_kraken.png", "sym/H4.webp", 400),
    ("symbols/H5_trident.png", "sym/H5.webp", 400),
    ("symbols/W_wild.png", "sym/W.webp", 400),
    ("symbols/S_compass.png", "sym/S.webp", 400),
    ("symbols/S2_abyssal_compass.png", "sym/S2.webp", 400),
    ("symbols/H6_leviathan_mega.png", "sym/H6.webp", 1254),  # sliced up to 6x6
    # characters: rigged layers come from tools/rig_characters.py
    # UI
    ("ui/grid_frame.png", "ui/grid_frame.webp", 1254),
    ("ui/hp_bar_frame.png", "ui/hp_frame.webp", 1995),
    ("ui/hp_bar_fill.png", "ui/hp_fill.webp", 1923),
    ("ui/control_bar.png", "ui/control_bar.webp", 1989),
    ("ui/spin_button.png", "ui/spin.webp", 400),
    ("ui/buy_badge.png", "ui/buy_badge.webp", 300),
    ("ui/buy_menu/card.png", "ui/card.webp", 1000),
    ("ui/buy_menu/hunt_compasses.png", "ui/illus_hunt.webp", 724),
    ("ui/buy_menu/trench_hunt_abyssal.png", "ui/illus_trench.webp", 724),
    ("ui/buy_menu/mystery_chest.png", "ui/illus_mystery.webp", 724),
    ("ui/buy_menu/free_spins_grid.png", "ui/illus_freespins.webp", 724),
    # lettering
    ("lettering/logo_abyssal_tide.png", "lettering/logo.webp", 1100),
    # effects
    ("effects/win_glow_ring.png", "fx/glow_ring.webp", 700),
    ("effects/ink_splash.png", "fx/ink_splash.webp", 1000),
    ("effects/water_slash.png", "fx/water_slash.webp", 1400),
    ("effects/overlay_backdrop.png", "fx/overlay_backdrop.webp", 1500),
    # studio splash (letters-only cut of the Nyxhilx logo: art/generated/studio)
    ("studio/nyxhilx_logo.png", "ui/studio_logo.webp", 1100),
    # Depth Wheel (cut from the delivered sheets by tools/prepare_wheel_art.py)
    ("ui/wheel/wheel_rim.png", "ui/wheel/rim.webp", 1254),
    ("ui/wheel/wheel_hub.png", "ui/wheel/hub.webp", 400),
    ("ui/wheel/wheel_pointer.png", "ui/wheel/pointer.webp", 400),
    ("ui/wheel/wheel_glow.png", "ui/wheel/glow.webp", 1254),
    ("effects/wheel_flash_strip.png", "fx/wheel_flash.webp", 2048),
]
GLOBS = [
    ("ui/powerups/*.png", "ui/pu", 192),
    ("ui/wheel/wash_*.png", "ui/wheel", 607),
    ("ui/wheel/emblem_*.png", "ui/wheel", 220),
    ("lettering/title_*.png", "lettering", 1600),
    ("effects/bubbles/bubble_*.png", "fx", 128),
    ("effects/flakes/flake_*.png", "fx", 160),
]


def convert(src: str, dst: str, edge: int) -> None:
    im = Image.open(src).convert("RGBA")
    if max(im.size) > edge:
        im.thumbnail((edge, edge), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "WEBP", quality=90, method=6)


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
