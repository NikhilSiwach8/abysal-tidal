#!/usr/bin/env python3
"""Generate the stacked reel strips for Abyssal Tide.

    python3 tools/make_reels.py            # writes math-sdk/games/abyssal_tide/reels/*.csv

Strips:
  BR0   base game. Scatters (S) present, at most one in any 6-row window per reel.
  FR0   free spins. No scatters (no retriggers), more Wilds.
  WCAP  win-cap path. Wild- and high-heavy, used only by the wincap criterion.

"Stacked" means each paying symbol is laid down in short runs (1-4) so clusters form
naturally on a 6x6 board. Deterministic: a fixed seed per strip.
"""
from __future__ import annotations

import os
import random
import sys

REELS = 6
ROWS = 6
OUT = os.path.join(os.path.dirname(__file__), "..", "math-sdk", "games", "abyssal_tide", "reels")

# relative weights of paying symbols; stack lengths are drawn from STACKS
STRIPS = {
    "BR0": {
        "length": 260,
        "seed": 11,
        "weights": {"L1": 15, "L2": 15, "L3": 14, "L4": 13, "L5": 12,
                    "H1": 9, "H2": 8, "H3": 7, "H4": 6, "H5": 4, "W": 3},
        "stacks": {1: 50, 2: 30, 3: 15, 4: 5},
        "scatters": 4,
    },
    "FR0": {
        "length": 260,
        "seed": 23,
        "weights": {"L1": 13, "L2": 13, "L3": 12, "L4": 12, "L5": 12,
                    "H1": 10, "H2": 10, "H3": 9, "H4": 8, "H5": 7, "W": 1},
        "stacks": {1: 55, 2: 28, 3: 13, 4: 4},
        "scatters": 0,
    },
    "WCAP": {
        "length": 180,
        "seed": 37,
        "weights": {"L1": 6, "L2": 6, "L3": 6, "L4": 6, "L5": 6,
                    "H1": 10, "H2": 10, "H3": 12, "H4": 12, "H5": 14, "W": 12},
        "stacks": {1: 30, 2: 30, 3: 25, 4: 15},
        "scatters": 0,
    },
}


def pick(rng: random.Random, weights: dict) -> str:
    keys = list(weights)
    return rng.choices(keys, [weights[k] for k in keys])[0]


def make_strip(rng: random.Random, spec: dict) -> list[str]:
    strip: list[str] = []
    while len(strip) < spec["length"]:
        sym = pick(rng, spec["weights"])
        if strip and strip[-1] == sym:
            continue  # stacks come only from the stack draw, keeps runs short
        run = pick(rng, {str(k): v for k, v in spec["stacks"].items()})
        strip += [sym] * int(run)
    strip = strip[: spec["length"]]
    # Place scatters spread evenly, never two inside one visible window (6 rows), wrap-safe.
    n = spec["scatters"]
    if n:
        gap = spec["length"] // n
        assert gap > ROWS, "scatters too dense for one-per-window"
        for i in range(n):
            strip[i * gap + rng.randrange(0, gap - ROWS)] = "S"
    return strip


def check(strips: list[list[str]], name: str) -> None:
    for r, strip in enumerate(strips):
        L = len(strip)
        for start in range(L):
            window = [strip[(start + k) % L] for k in range(ROWS)]
            assert window.count("S") <= 1, f"{name} reel {r}: two scatters visible at {start}"


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for name, spec in STRIPS.items():
        strips = []
        for reel in range(REELS):
            rng = random.Random(spec["seed"] * 100 + reel)
            strips.append(make_strip(rng, spec))
        check(strips, name)
        path = os.path.join(OUT, f"{name}.csv")
        with open(path, "w", encoding="utf-8") as f:
            for row in range(spec["length"]):
                f.write(",".join(strips[r][row] for r in range(REELS)) + "\n")
        counts = {}
        for s in strips:
            for x in s:
                counts[x] = counts.get(x, 0) + 1
        print(f"{name}: {spec['length']} stops x {REELS} reels  {dict(sorted(counts.items()))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
