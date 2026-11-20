#!/usr/bin/env python3
"""Audit Abyssal Tide publish files before upload.

    math-sdk/env/bin/python tools/audit_publish.py [--books] [--game-dir DIR]

Per mode (from library/publish_files/index.json):
  * RTP from the weighted lookup table; spread across modes <= 0.5%
  * base hit rate better than 1 in 20
  * max win reachable (a positive-weight book pays exactly the cap) and its frequency
  * every payout a multiple of 0.1x (10 in LUT units), weights positive, IDs unique
  * --books: every book's payoutMultiplier equals its LUT entry, no book has empty events
  * book file SHA-256 and LUT payout hash match configs/books_<mode>.verification.json
Exit code 1 if any check fails.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import pickle
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DEFAULT_GAME = os.path.join(ROOT, "math-sdk", "games", "abyssal_tide")
WINCAP = 100_000
RTP_TARGET = 0.967


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_lut(path: str):
    ids, weights, payouts = [], [], []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            i, w, p = line.strip().split(",")
            ids.append(int(i))
            weights.append(int(float(w)))
            payouts.append(int(float(p)))
    return ids, weights, payouts


def iter_books(path: str):
    import zstandard as zst

    with open(path, "rb") as f:
        reader = zst.ZstdDecompressor().stream_reader(f)
        for line in io.TextIOWrapper(reader, encoding="utf-8"):
            line = line.strip()
            if line:
                yield json.loads(line)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--books", action="store_true", help="also decompress and check every book")
    ap.add_argument("--game-dir", default=DEFAULT_GAME)
    args = ap.parse_args()

    pub = os.path.join(args.game_dir, "library", "publish_files")
    cfg = os.path.join(args.game_dir, "library", "configs")
    index = json.load(open(os.path.join(pub, "index.json"), encoding="utf-8"))
    failures: list[str] = []
    rtps = {}

    def check(ok: bool, mode: str, msg: str):
        if not ok:
            failures.append(f"[{mode}] {msg}")
        return ok

    print(f"{'mode':<13}{'cost':>7}{'RTP':>9}{'hit 1/N':>10}{'max win':>10}{'max 1/N':>14}{'books':>9}")
    for m in index["modes"]:
        name, cost = m["name"], float(m["cost"])
        ids, weights, payouts = read_lut(os.path.join(pub, m["weights"]))
        total = sum(weights)
        rtp = sum(w * p for w, p in zip(weights, payouts)) / total / 100 / cost
        rtps[name] = rtp
        hit = sum(w for w, p in zip(weights, payouts) if p > 0) / total
        top = max(p for w, p in zip(weights, payouts) if w > 0)
        cap_w = sum(w for w, p in zip(weights, payouts) if p == WINCAP * 100)
        cap_freq = total / cap_w if cap_w else float("inf")

        check(0.90 <= rtp <= 0.98, name, f"RTP {rtp:.4%} outside 90-98%")
        check(abs(rtp - RTP_TARGET) < 0.0005, name, f"RTP {rtp:.4%} not at target {RTP_TARGET:.2%}")
        if cost == 1:
            check(hit > 1 / 20, name, f"hit rate 1/{1/hit:.1f} not better than 1/20")
        check(top == WINCAP * 100, name, f"max win {top/100}x is not the {WINCAP}x cap")
        check(cap_w > 0, name, "max win has no positive weight (unreachable)")
        check(cap_freq < 1e7 * 1.5, name, f"max win too rare (1 in {cap_freq:,.0f})")
        check(all(p % 10 == 0 for p in payouts), name, "payout not a multiple of 0.1x")
        check(all(w > 0 for w in weights), name, f"{sum(1 for w in weights if w <= 0)} non-positive weights")
        check(len(set(ids)) == len(ids), name, "duplicate book IDs")
        check(ids == list(range(len(ids))) or sorted(ids) == ids, name, "IDs not ordered")

        book_path = os.path.join(pub, m["events"])
        ver = json.load(open(os.path.join(cfg, f"books_{name}.verification.json"), encoding="utf-8"))
        check(sha256(book_path) == ver["file_hash"], name, "book file hash != verification.json")
        check(hashlib.md5(pickle.dumps(payouts)).hexdigest() == ver["payout_hash"], name, "LUT payout hash != verification.json")
        check(ver["num_entries"] == len(payouts), name, "entry count != verification.json")

        nbooks = "-"
        if args.books:
            lut = dict(zip(ids, payouts))
            n = bad = empty = 0
            seen = set()
            for b in iter_books(book_path):
                n += 1
                if b["id"] in seen:
                    bad += 1
                seen.add(b["id"])
                if lut.get(b["id"]) != b["payoutMultiplier"]:
                    bad += 1
                if not b.get("events"):
                    empty += 1
            check(n == len(ids), name, f"{n} books vs {len(ids)} LUT rows")
            check(bad == 0, name, f"{bad} books disagree with the LUT")
            check(empty == 0, name, f"{empty} books have empty events")
            nbooks = str(n)

        print(f"{name:<13}{cost:>7g}{rtp:>9.4%}{1/hit:>10.2f}{top/100:>10,.0f}{cap_freq:>14,.0f}{nbooks:>9}")

    spread = max(rtps.values()) - min(rtps.values())
    check(spread <= 0.005, "all", f"RTP spread {spread:.4%} > 0.5%")
    print(f"\nRTP spread across modes: {spread:.4%}")
    if failures:
        print("\nFAIL")
        for f in failures:
            print("  " + f)
        return 1
    print("\nPASS: all checks in all modes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
