"""Deterministic lookup-table weight solver for Abyssal Tide.

Replaces the SDK's stochastic Rust optimizer (which failed to honour the hit-rate
targets of the multi-criteria modes). For every mode and every criteria from
game_optimization.mode_targets():

  * the criteria gets exactly its target probability  p = 1 / hr
    (one criteria per mode takes the remaining probability: "0" or an "x" criteria);
  * its books are re-weighted with a power tilt  w_i ∝ (1 + payout_i) ** theta,
    where theta is solved by bisection so the criteria's average win is exactly
    its target (avg = hr * rtp * cost). theta = 0 keeps the simulated distribution;
  * Stake Engine's publish risk checks (volatility, worst-0.1% CVaR, big-win frequency)
    are met by an extra tail damping  exp(-damp * payout / 100,000): per mode, the
    smallest damp that passes every check with 3% headroom (0 if it already passes).

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
TAIL_SCALE = 100_000.0  # damping unit: the win cap
MARGIN = 0.97  # pass every risk check with 3% headroom
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


def tilt(x: np.ndarray, target: float, damp: float = 0.0) -> np.ndarray:
    """Normalised weights over payouts x (multiples of bet) with mean exactly `target`.

    w ∝ (1 + x)**theta * exp(-damp * x / TAIL_SCALE): `damp` discounts the largest payouts
    progressively (risk checks), theta then restores the exact mean."""
    if np.all(x == x[0]):
        return np.full(len(x), 1 / len(x))
    lx = np.log1p(x)
    tail = damp * x / TAIL_SCALE

    def mean(theta):
        lw = theta * lx - tail
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


def solve_mode(mode: str, targets: dict, damp: float = 0.0, write: bool = True) -> dict:
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
        q = tilt(x, avg, damp) if avg > 0 else np.full(len(idx), 1 / len(idx))
        weights[idx] = p * q
        report[c] = (1 / p, avg)

    w_int = np.maximum(1, np.round(weights * SCALE)).astype(np.int64)
    if write:
        with open(lut_path, "w", encoding="utf-8") as f:
            for i, w, pay in zip(ids, w_int, pays):
                f.write(f"{i},{int(w)},{pay}\n")
    total = int(w_int.sum())
    rtp = float((w_int.astype(np.float64) * np.array(pays)).sum()) / total / 100 / cost
    risk = risk_metrics(w_int.astype(np.float64), np.array(pays, dtype=np.float64) / 100, cost)
    return {"rtp": rtp, "criteria": report, "risk": risk, "damp": damp}


# ---------------------------------------------------------------- Stake risk checks
# Limits shown by Stake Engine's publish page (payouts in base-bet multiples).
RISK_LIMITS = {"std_rel": 60.0, "cvar_rel": 700.0, "cvar_abs": 50_000.0}
BIG_WIN_LIMITS = {5_000: 20, 10_000: 100, 25_000: 200, 50_000: 1_000, 100_000: 2_000}  # P(x >= T) <= 1/N


def risk_metrics(w: np.ndarray, x: np.ndarray, cost: float) -> dict:
    p = w / w.sum()
    mean = (p * x).sum()
    std = float(np.sqrt((p * (x - mean) ** 2).sum()))
    o = np.argsort(-x)
    po, xo = p[o], x[o]
    cp = np.cumsum(po)
    k = int(np.searchsorted(cp, 0.001))
    take = po[: k + 1].copy()
    take[-1] -= cp[k] - 0.001
    cvar = float((take * xo[: k + 1]).sum() / 0.001)
    return {"std_rel": std / cost, "cvar_rel": cvar / cost, "cvar_abs": cvar,
            "freq": {T: float(p[x >= T].sum()) for T in BIG_WIN_LIMITS}}


def risk_ok(r: dict, margin: float = MARGIN) -> bool:
    if any(r[k] > RISK_LIMITS[k] * margin for k in RISK_LIMITS):
        return False
    return all(r["freq"][T] <= margin / N for T, N in BIG_WIN_LIMITS.items())


def solve_mode_safe(mode: str, targets: dict) -> dict:
    """Smallest tail damping that passes every risk check with MARGIN headroom."""
    def trial(d):
        try:
            return solve_mode(mode, targets, d, write=False)
        except ValueError:
            return None
    r = trial(0.0)
    if r and risk_ok(r["risk"]):
        return solve_mode(mode, targets, 0.0)
    lo, hi = 0.0, 1.0
    while True:
        r = trial(hi)
        if r and risk_ok(r["risk"]):
            break
        lo, hi = hi, hi * 2
        if hi > 4096:
            raise RuntimeError(f"{mode}: no damping passes the risk checks")
    for _ in range(40):
        mid = (lo + hi) / 2
        r = trial(mid)
        if r and risk_ok(r["risk"]):
            hi = mid
        else:
            lo = mid
    return solve_mode(mode, targets, hi)


def main(modes):
    targets = mode_targets()
    for m in modes:
        r = solve_mode_safe(m, targets[m])
        crit = "  ".join(f"{c}: 1/{hr:,.1f} avg {avg:,.1f}x" for c, (hr, avg) in r["criteria"].items())
        k = r["risk"]
        print(f"{m:<13} RTP {r['rtp']:.6%}  damp {r['damp']:.3f}  std/cost {k['std_rel']:.2f}  CVaR {k['cvar_rel']:.1f}/{k['cvar_abs']:,.0f}   {crit}")


if __name__ == "__main__":
    main(sys.argv[1].split(",") if len(sys.argv) > 1 else list(COST))
