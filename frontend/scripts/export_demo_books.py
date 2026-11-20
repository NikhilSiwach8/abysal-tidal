#!/usr/bin/env python3
"""Export a weighted sample of published books to public/demo/<mode>.json.

    npm run demo-books          (uses math-sdk/env/bin/python)

For each mode, books are drawn by their lookup-table weight (so the demo plays like the
real math) and stored with weight 1. A few showcase books are added with weight 0 so
they never come up in demo play but can be opened with a local replay
(?replay=true&mode=<mode>&event=<id>) or forced with ?demoBook=<id>:
a loss, a max win, a Leviathan rise, and one of each free-spin tier.
"""
from __future__ import annotations

import io
import json
import os
import random
import sys

import zstandard as zst

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "..", "math-sdk", "games", "abyssal_tide", "library", "publish_files")
OUT = os.path.join(HERE, "..", "public", "demo")
SAMPLE = {"base": 240, "hunt": 160, "deep_hunt": 80}
DEFAULT_SAMPLE = 40
SEED = 20261120


def read_lut(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                i, w, p = line.strip().split(",")
                rows.append((int(i), int(float(w)), int(float(p))))
    return rows


def iter_books(path):
    with open(path, "rb") as f:
        for line in io.TextIOWrapper(zst.ZstdDecompressor().stream_reader(f), encoding="utf-8"):
            if line.strip():
                yield json.loads(line)


def showcase_ids(path, want):
    """Scan books once for showcase ids."""
    found = {}
    for b in iter_books(path):
        ev = b["events"]
        types = {e["type"] for e in ev}
        if "loss" not in found and b["payoutMultiplier"] == 0:
            found["loss"] = b["id"]
        if "maxwin" not in found and "wincap" in types:
            found["maxwin"] = b["id"]
        if "leviathan" not in found and any(e.get("featureType") == "bossFeature" and e["info"][0]["feature"] == "bossSlain" for e in ev):
            found["leviathan"] = b["id"]
        for e in ev:
            if e["type"] == "selectedMode" and f"tier_{e['mode']}" not in found:
                found[f"tier_{e['mode']}"] = b["id"]
        if len(found) >= want:
            break
    return found


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    index = json.load(open(os.path.join(PUB, "index.json"), encoding="utf-8"))
    rng = random.Random(SEED)
    manifest = {}
    for m in index["modes"]:
        name = m["name"]
        lut = read_lut(os.path.join(PUB, m["weights"]))
        ids = [r[0] for r in lut]
        weights = [r[1] for r in lut]
        n = SAMPLE.get(name, DEFAULT_SAMPLE)
        picked = rng.choices(ids, weights=weights, k=n)
        counts: dict[int, int] = {}
        for i in picked:
            counts[i] = counts.get(i, 0) + 1
        books_path = os.path.join(PUB, m["events"])
        show = showcase_ids(books_path, 7)
        need = set(counts) | set(show.values())
        books = {}
        for b in iter_books(books_path):
            if b["id"] in need:
                books[b["id"]] = b
            if len(books) == len(need):
                break
        out = []
        for i in sorted(need):
            b = books[i]
            out.append({"id": i, "weight": counts.get(i, 0), "payoutMultiplier": b["payoutMultiplier"], "events": b["events"]})
        path = os.path.join(OUT, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"))
        manifest[name] = show
        print(f"{name:<13} {len(out):>4} books  {os.path.getsize(path) / 1024:8.0f} KB  showcase={show}")
    with open(os.path.join(OUT, "showcase.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
