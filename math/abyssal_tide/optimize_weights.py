"""Deterministic lookup-table weight solver for Abyssal Tide.

Replaces the SDK's stochastic Rust optimizer (which failed to honour the hit-rate
targets of the multi-criteria modes). For every mode and every criteria from
game_optimization.mode_targets():

  * the criteria gets exactly its target probability  p = 1 / hr
    (one criteria per mode takes the remaining probability: "0" or an "x" criteria);
  * its books are re-weighted with a power tilt  w_i ∝ (1 + payout_i) ** theta,
    where theta is solved by bisection so the criteria's average win is exactly
    its target (avg = hr * rtp * cost). theta = 0 keeps the simulated distribution.

Weights are integers on a 2**50 scale; every book keeps weight >= 1. Book IDs and
payouts are untouched, so the book files and their verification hashes stay valid.

    python games/abyssal_tide/optimize_weights.py [modes]
"""

import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from game_optimization import mode_targets  # noqa: E402

SCALE = 2**50
COST = {"base": 1, "hunt": 5, "deep_hunt": 50, "bonus": 150, "super": 400, "ultra": 1000, "mystery": 500, "mystery_deep": 650}
LIB = os.path.join(HERE, "library")


def read_criteria(mode):
    out = {}
    with open(os.path.join(LIB, "lookup_tables", f"lookUpTableSegmented_{mode}.csv"), encoding="utf-8") as f:
        for line in f:
            i, c, _, _ = line.strip().split(",")
            out[int(i)] = c
    return out


def read_lut(path):
    ids, pays = [], []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                i, _, p = line.strip().split(",")
                ids.append(int(i))
                pays.append(int(float(p)))
    return ids, pays


def tilt(x: np.ndarray, target: float) -> np.ndarray:
    """Normalised weights over payouts x (multiples of bet) with mean exactly `target`."""
    if np.all(x == x[0]):
        return np.full(len(x), 1 / len(x))
    lx = np.log1p(x)

    def mean(theta):
        lw = theta * lx
        lw -= lw.max()
        w = np.exp(lw)
        return float((w * x).sum() / w.sum()), w / w.sum()

    lo, hi = -40.0, 40.0
    if not (mean(lo)[0] <= target <= mean(hi)[0]):
        raise ValueError(f"target avg {target:.4f} outside reachable [{x.min():.2f}, {x.max():.2f}]")
    for _ in range(200):
        mid = (lo + hi) / 2
        m, _ = mean(mid)
        if m < target:
            lo = mid
        else:
            hi = mid
    return mean((lo + hi) / 2)[1]


def solve_mode(mode: str, targets: dict) -> dict:
    cost = COST[mode]
    lut_path = os.path.join(LIB, "publish_files", f"lookUpTable_{mode}_0.csv")
    ids, pays = read_lut(lut_path)
    crit = read_criteria(mode)
    groups: dict[str, list[int]] = {}
    for idx, i in enumerate(ids):
        groups.setdefault(crit[i], []).append(idx)

    # probability and average win per criteria
    plan = {}
    remainder = None
    for c, t in targets.items():
        hr = t.get("hr")
        if c == "wincap":
            p = t["rtp"] * cost / t["av_win"]
            plan[c] = (p, t["av_win"])
        elif hr in (None, "x"):
            assert remainder is None, f"{mode}: more than one remainder criteria"
            remainder = c
        else:
            p = 1 / float(hr)
            plan[c] = (p, float(hr) * t["rtp"] * cost)
    p_rem = 1 - sum(p for p, _ in plan.values())
    assert p_rem > 0, f"{mode}: hit rates over-allocate probability"
    t = targets[remainder]
    plan[remainder] = (p_rem, t["rtp"] * cost / p_rem if t["rtp"] else 0.0)

    weights = np.zeros(len(ids), dtype=np.float64)
    report = {}
    for c, (p, avg) in plan.items():
        idx = groups.get(c)
        assert idx, f"{mode}: no books for criteria {c}"
        x = np.array([pays[i] / 100 for i in idx], dtype=np.float64)
        q = tilt(x, avg) if avg > 0 else np.full(len(idx), 1 / len(idx))
        weights[idx] = p * q
        report[c] = (1 / p, avg)

    w_int = np.maximum(1, np.round(weights * SCALE)).astype(np.int64)
    with open(lut_path, "w", encoding="utf-8") as f:
        for i, w, pay in zip(ids, w_int, pays):
            f.write(f"{i},{int(w)},{pay}\n")
    total = int(w_int.sum())
    rtp = float((w_int.astype(np.float64) * np.array(pays)).sum()) / total / 100 / cost
    return {"rtp": rtp, "criteria": report}


def main(modes):
    targets = mode_targets()
    for m in modes:
        r = solve_mode(m, targets[m])
        crit = "  ".join(f"{c}: 1/{hr:,.1f} avg {avg:,.1f}x" for c, (hr, avg) in r["criteria"].items())
        print(f"{m:<13} RTP {r['rtp']:.6%}   {crit}")


if __name__ == "__main__":
    main(sys.argv[1].split(",") if len(sys.argv) > 1 else list(COST))
