"""Reproduce Stake Engine's publish risk checks from the published lookup tables.

    math-sdk/env/bin/python tools/risk_checks.py [publish_files_dir]

Payouts are in base-bet multiples (book payoutMultiplier / 100); "relative" divides by
the mode cost. Limits are the ones Stake shows for the risk checks.
"""
import json, os, sys
import numpy as np

D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "math-sdk/games/abyssal_tide/library/publish_files")
LIMITS = {"std_rel": 60.0, "cvar_rel": 700.0, "cvar_abs": 50_000.0}
FREQ = {5_000: 20, 10_000: 100, 25_000: 200, 50_000: 1_000, 100_000: 2_000}  # P(x >= T) must be <= 1/N


def load(mode):
    a = np.loadtxt(os.path.join(D, f"lookUpTable_{mode}_0.csv"), delimiter=",", dtype=np.float64)
    return a[:, 1], a[:, 2] / 100


def metrics(w, x, cost):
    p = w / w.sum()
    mean = (p * x).sum()
    std = np.sqrt((p * (x - mean) ** 2).sum())
    o = np.argsort(-x)
    cp = np.cumsum(p[o])
    k = np.searchsorted(cp, 0.001)  # top 0.1% of probability mass (partial last book)
    take = p[o][: k + 1].copy()
    take[-1] -= cp[k] - 0.001
    cvar = (take * x[o][: k + 1]).sum() / 0.001
    freq = {T: (p[x >= T].sum()) for T in FREQ}
    return {"rtp": mean / cost, "std_rel": std / cost, "cvar_rel": cvar / cost, "cvar_abs": cvar, "freq": freq,
            "hit": p[x > 0].sum(), "max": x.max()}


def main():
    modes = [m["name"] for m in json.load(open(os.path.join(D, "index.json")))["modes"]]
    costs = {m["name"]: m["cost"] for m in json.load(open(os.path.join(D, "index.json")))["modes"]}
    fails = 0
    print(f"{'mode':13s} {'RTP':>9s} {'any win':>8s} {'std/cost':>9s} {'CVaR/cost':>10s} {'CVaR abs':>10s}  " + "  ".join(f"{T//1000}k+ (1/{N})" for T, N in FREQ.items()))
    for m in modes:
        w, x = load(m)
        r = metrics(w, x, costs[m])
        bad = []
        for k in LIMITS:
            if r[k] > LIMITS[k] + 1e-9: bad.append(k)
        fs = []
        for T, N in FREQ.items():
            f = r["freq"][T]
            s = f"1/{1/f:,.0f}" if f > 0 else "never"
            if f > 1 / N + 1e-12: bad.append(f"{T}+"); s += "!"
            fs.append(f"{s:>12s}")
        fails += len(bad)
        print(f"{m:13s} {r['rtp']:9.4%} {r['hit']:8.1%} {r['std_rel']:9.2f} {r['cvar_rel']:10.1f} {r['cvar_abs']:10,.1f}  " + "  ".join(fs) + (f"   FAIL {bad}" if bad else "   pass"))
    print("ALL RISK CHECKS PASS" if not fails else f"{fails} risk-check failures")
    return fails


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
