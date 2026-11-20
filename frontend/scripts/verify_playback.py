#!/usr/bin/env python3
"""Replay every demo book's board logic exactly like the frontend does, and check it
against the math rules.

    python3 scripts/verify_playback.py

For each book (public/demo/<mode>.json) the board is tracked through reveal ->
winInfo -> tumbleBoard -> bossFeature/updateBoard -> updateGrid, and every step is
checked: winning positions hold the winning symbol (or a Wild), cluster sizes, the
cluster multiplier from the tracked spots, each cluster's pay from the paytable,
tumble totals, exploding positions, power-up board changes, damage, the spot grid
rules and the final win. Prints mismatches and exits 1 if there are any.
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(HERE, "..", "public", "demo")
N = 6
WINCAP = 100_000
TIERS = [(5, 7), (8, 10), (11, 13), (14, 36)]
PAYS = {
    "H5": (1, 2.5, 5, 50), "H4": (0.5, 1, 3.8, 35), "H3": (0.3, 0.8, 3, 30), "H2": (0.3, 0.6, 2.2, 20), "H1": (0.2, 0.5, 1.5, 10),
    "L5": (0.2, 0.4, 1.2, 7.5), "L4": (0.2, 0.3, 1, 6), "L3": (0.1, 0.3, 1, 6), "L2": (0.1, 0.2, 0.8, 5), "L1": (0.1, 0.2, 0.7, 5),
}
MEGA = [((5, 15), 100), ((16, 24), 1_000), ((25, 35), 10_000), ((36, 36), 100_000)]
TIER_START = {"B": 1, "S": 2, "U": 4, "H": 8}
LADDER = ["symbolsToWild", "wildBlock", "lowSymbolsToWild", "symbolBlock", "dualSymbolsToWild", "highSymbolBlock", "dualLowSymbolsToWild", "bossSlain"]


def pay(sym: str, size: int) -> float:
    table = MEGA if sym == "H6" else list(zip(TIERS, PAYS[sym]))
    for (lo, hi), v in table:
        if lo <= size <= hi:
            return v
    return 0.0


def names(board):
    return [[s["name"] for s in reel] for reel in board]


def verify_book(mode: str, book: dict) -> list[str]:
    errs: list[str] = []
    bid = book["id"]

    def err(i, msg):
        errs.append(f"{mode}#{bid} event {i}: {msg}")

    board = None
    spots = [[1] * N for _ in range(N)]
    damage = 0
    fired = 0
    slain = False
    spin_win = 0
    last_win_positions: set = set()
    total_round = 0  # sum of every winInfo totalWin (book units)
    last_total = 0
    pending_feature = None
    in_fs = False

    for i, e in enumerate(book["events"]):
        t = e["type"]
        if t == "reveal":
            board = names(e["board"])
            if len(board) != N or any(len(r) != N for r in board):
                err(i, "board is not 6x6")
            spin_win = 0
            if e["gameType"] == "basegame":
                spots = [[1] * N for _ in range(N)]
                damage, fired, slain = 0, 0, False
        elif t == "winInfo":
            last_win_positions = set()
            total = 0
            for w in e["wins"]:
                sym = w["symbol"]
                pos = [(p["reel"], p["row"]) for p in w["positions"]]
                for r, c in pos:
                    have = board[r][c]
                    if have != sym and not (have == "W" and sym != "H6"):
                        err(i, f"{sym} win at {r},{c} but board has {have}")
                size = sum(1 for r, c in pos if board[r][c] == "H6") if sym == "H6" else len(pos)
                if size != w["clusterSize"]:
                    err(i, f"cluster size {w['clusterSize']} != {size}")
                if size < 5:
                    err(i, f"cluster of {size} < 5")
                mult = 1 if sym == "H6" else max(1, sum(spots[r][c] for r, c in pos if spots[r][c] > 1))
                if mult != w["meta"]["clusterMult"]:
                    err(i, f"clusterMult {w['meta']['clusterMult']} != tracked {mult}")
                expect = int(round(min(pay(sym, size) * mult, WINCAP) * 100))
                if expect != w["win"]:
                    err(i, f"{sym}x{size} x{mult} pays {w['win']} != {expect}")
                if w["win"] % 10:
                    err(i, f"win {w['win']} not a multiple of 0.1x")
                total += w["win"]
                last_win_positions |= set(pos)
            if min(total, WINCAP * 100) != e["totalWin"]:  # the SDK clamps the event total at the cap
                err(i, f"totalWin {e['totalWin']} != sum {total}")
            spin_win += total
            total_round += total
        elif t == "updateTumbleWin":
            if e["amount"] != min(spin_win, WINCAP * 100):
                err(i, f"tumble win {e['amount']} != {spin_win}")
        elif t == "featureEvent" and e["featureType"] == "damage":
            info = e["info"][0]
            if info["added"] != len(last_win_positions):
                err(i, f"damage added {info['added']} != winning symbols {len(last_win_positions)}")
            damage = min(200, damage + info["added"])
            if info["damage"] != damage:
                err(i, f"damage {info['damage']} != tracked {damage}")
        elif t == "featureEvent" and e["featureType"] == "bossFeature":
            info = e["info"][0]
            if slain or fired >= len(LADDER) or info["feature"] != LADDER[fired]:
                err(i, f"power-up {info['feature']} out of order (expected {LADDER[fired] if fired < 8 else 'none'})")
            if damage < 25 * (fired + 1):
                err(i, f"power-up {info['feature']} at damage {damage}")
            fired += 1
            slain = slain or info["feature"] == "bossSlain"
            pending_feature = info
        elif t == "tumbleBoard":
            exploding = {(p["reel"], p["row"]) for p in e["explodingSymbols"]}
            if exploding != last_win_positions:
                err(i, "exploding positions differ from the winning positions")
            for r in range(N):
                survivors = [board[r][c] for c in range(N) if (r, c) not in exploding]
                fresh = [s["name"] for s in e["newSymbols"][r]]
                if len(fresh) + len(survivors) != N:
                    err(i, f"reel {r}: {len(fresh)} new + {len(survivors)} survivors != 6")
                board[r] = fresh + survivors
        elif t == "updateBoard":
            new = names(e["board"])
            changed = {(r, c) for r in range(N) for c in range(N) if new[r][c] != board[r][c]}
            if pending_feature is not None:
                f = pending_feature
                allowed = {(p["reel"], p["row"]) for p in f["positions"]}
                if not changed <= allowed:
                    err(i, f"{f['feature']} changed cells outside its positions")
                target = None
                if f["feature"].endswith("ToWild") or f["feature"] == "wildBlock":
                    target = "W"
                elif f["feature"] == "bossSlain":
                    target = "H6"
                elif f.get("symbols"):
                    target = f["symbols"][0]
                for r, c in allowed:
                    if new[r][c] != target:
                        err(i, f"{f['feature']} cell {r},{c} is {new[r][c]}, expected {target}")
                pending_feature = None
            else:
                # Abyssal upgrade: exactly one Compass becomes the Abyssal Compass
                if len(changed) != 1 or any(board[r][c] != "S" or new[r][c] != "S2" for r, c in changed):
                    err(i, f"unexpected board change {sorted(changed)}")
            board = new
        elif t == "updateGrid":
            grid = e["gridMultipliers"]
            for r in range(N):
                for c in range(N):
                    v = grid[r][c]
                    if v not in (1, 2, 4, 8, 16, 32, 64):
                        err(i, f"spot {v} not a power of two <= 64")
                    if in_fs and v < spots[r][c]:
                        err(i, f"spot {r},{c} shrank {spots[r][c]} -> {v}")
                    if v > spots[r][c] and (r, c) not in last_win_positions:
                        err(i, f"spot {r},{c} grew outside the winning clusters")
            spots = [list(x) for x in grid]
        elif t == "selectedMode":
            in_fs = True
            spots = [[TIER_START[e["mode"]]] * N for _ in range(N)]
            damage, fired, slain = 0, 0, False
        elif t == "setTotalWin":
            if e["amount"] < last_total:
                err(i, "total win decreased")
            last_total = e["amount"]
        elif t == "finalWin":
            if e["amount"] != book["payoutMultiplier"]:
                err(i, f"finalWin {e['amount']} != payoutMultiplier {book['payoutMultiplier']}")
            if e["amount"] != min(total_round, WINCAP * 100):
                err(i, f"finalWin {e['amount']} != sum of wins {total_round}")
    if not book["events"]:
        errs.append(f"{mode}#{bid}: no events")
    return errs


def main() -> int:
    files = sorted(f for f in os.listdir(DEMO) if f.endswith(".json") and f != "showcase.json")
    if not files:
        print("no demo books; run `npm run demo-books` first")
        return 1
    total_books = 0
    all_errs: list[str] = []
    for f in files:
        mode = f[:-5]
        books = json.load(open(os.path.join(DEMO, f), encoding="utf-8"))
        errs = []
        for b in books:
            errs += verify_book(mode, b)
        total_books += len(books)
        all_errs += errs
        print(f"{mode:<13} {len(books):>4} books  {len(errs)} mismatches")
    for e in all_errs[:40]:
        print("  " + e)
    print(f"\n{total_books} books replayed, {len(all_errs)} mismatches")
    return 1 if all_errs else 0


if __name__ == "__main__":
    sys.exit(main())
