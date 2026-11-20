"""Optimizer targets for every mode (RTP 96.70%).

Hit rates follow the game rules exactly:
  base       natural rates below
  hunt       every bonus 10x as likely as base
  deep_hunt  Maelstrom (U) and Abyssal (H) 150x as likely as base
  ultra      Abyssal on 6.66% of buys
  mystery    60% nothing / 25% Undertow / 10% Maelstrom / 5% Abyssal
  mystery_d  60% nothing / 30% Undertow / 10% Abyssal
Per-criteria RTP is a fraction of the mode cost (avg payout = hr * rtp * cost); one
criteria per mode ("x") absorbs the remaining probability. Average wins per tier are
then chosen by the optimizer to land each mode exactly on target.
"""

from optimization_program.optimization_config import (
    ConstructConditions,
    ConstructParameters,
    ConstructScaling,
    verify_optimization_input,
)

RTP = 0.967
WINCAP = 100_000

# Natural (base-game) hit rates, 1 in N spins.
BASE_HR = {"B": 900, "S": 4_000, "U": 6_000, "H": 80_000, "wincap": 10_000_000}
# Reference average wins per tier (x bet), anchored on buy prices: bonus 150x, super 400x, ultra 1000x.
AVG = {"B": 145.0, "S": 387.0, "U": 850.0, "H": 2_600.0}


def _rtp(avg, hr, cost):
    return avg / (hr * cost)


def _cond(rtp, hr):
    return ConstructConditions(rtp=round(rtp, 6), hr=hr).return_dict()


def _zero():
    return ConstructConditions(rtp=0, av_win=0, search_conditions=0).return_dict()


def _wincap(hr, cost):
    return ConstructConditions(rtp=round(_rtp(WINCAP, hr, cost), 6), av_win=WINCAP, search_conditions=WINCAP).return_dict()


def _balance(conds: dict, flex: list[str], cost: float) -> dict:
    """Scale the RTP of the `flex` criteria so the mode sums exactly to RTP."""
    fixed = sum(c["rtp"] for k, c in conds.items() if k not in flex)
    current = sum(conds[k]["rtp"] for k in flex)
    scale = (RTP - fixed) / current
    for k in flex:
        hr = conds[k].get("hr")
        conds[k] = _cond(conds[k]["rtp"] * scale, hr)
    # absorb rounding on the last flex criteria
    diff = RTP - sum(c["rtp"] for c in conds.values())
    last = flex[-1]
    conds[last] = _cond(conds[last]["rtp"] + diff, conds[last].get("hr"))
    return conds


def mode_targets() -> dict:
    t = {}

    # base: features ~43%, base-game wins the rest
    c = {"wincap": _wincap(BASE_HR["wincap"], 1), "0": _zero()}
    for k in "BSUH":
        c[k] = _cond(_rtp(AVG[k], BASE_HR[k], 1), BASE_HR[k])
    c["basegame"] = _cond(0.5, 3.2)
    t["base"] = _balance(c, ["basegame"], 1)

    # hunt (5x): any bonus 10x as likely
    c = {"wincap": _wincap(BASE_HR["wincap"] / 10, 5), "0": _zero()}
    for k in "BSUH":
        c[k] = _cond(_rtp(AVG[k], BASE_HR[k] / 10, 5), BASE_HR[k] / 10)
    c["basegame"] = _cond(0.08, 3.2)
    t["hunt"] = _balance(c, ["basegame", "B", "S", "U", "H"], 5)

    # deep_hunt (50x): Maelstrom and Abyssal 150x as likely
    c = {"wincap": _wincap(BASE_HR["wincap"] / 150, 50), "0": _zero()}
    for k in "BS":
        c[k] = _cond(_rtp(AVG[k], BASE_HR[k], 50), BASE_HR[k])
    for k in "UH":
        c[k] = _cond(_rtp(AVG[k], BASE_HR[k] / 150, 50), round(BASE_HR[k] / 150, 4))
    c["basegame"] = _cond(0.0105, 3.2)
    t["deep_hunt"] = _balance(c, ["U", "H"], 50)

    # bonus (150x): buys Riptide
    t["bonus"] = _balance({"wincap": _wincap(100_000, 150), "B": _cond(0.9, "x")}, ["B"], 150)
    # super (400x): buys Undertow
    t["super"] = _balance({"wincap": _wincap(50_000, 400), "S": _cond(0.9, "x")}, ["S"], 400)
    # ultra (1000x): Maelstrom, 6.66% upgrade to Abyssal
    hr_h = round(1 / 0.0666, 4)
    t["ultra"] = _balance(
        {"wincap": _wincap(20_000, 1000), "H": _cond(_rtp(AVG["H"], hr_h, 1000), hr_h), "U": _cond(0.8, "x")},
        ["U"],
        1000,
    )
    # mystery (500x): 60% nothing / 25% S / 10% U / 5% H
    t["mystery"] = _balance(
        {
            "wincap": _wincap(50_000, 500),
            "0": _zero(),
            "S": _cond(_rtp(AVG["S"], 4, 500), 4),
            "U": _cond(_rtp(AVG["U"], 10, 500), 10),
            "H": _cond(_rtp(AVG["H"], 20, 500), 20),
        },
        ["S", "U", "H"],
        500,
    )
    # mystery_deep (650x): 60% nothing / 30% S / 10% H
    t["mystery_deep"] = _balance(
        {
            "wincap": _wincap(50_000, 650),
            "0": _zero(),
            "S": _cond(_rtp(AVG["S"], round(1 / 0.3, 4), 650), round(1 / 0.3, 4)),
            "H": _cond(_rtp(AVG["H"], 10, 650), 10),
        },
        ["S", "H"],
        650,
    )
    return t


def _params(test_spins, test_weights):
    return ConstructParameters(
        num_show=5000,
        num_per_fence=10000,
        min_m2m=2,
        max_m2m=12,
        pmb_rtp=1.0,
        sim_trials=5000,
        test_spins=test_spins,
        test_weights=test_weights,
        score_type="rtp",
    ).return_dict()


class OptimizationSetup:
    def __init__(self, game_config):
        self.game_config = game_config
        params = {}
        for mode, conds in mode_targets().items():
            buy = mode not in ("base", "hunt", "deep_hunt")
            params[mode] = {
                "conditions": conds,
                "scaling": ConstructScaling([]).return_dict(),
                "parameters": _params([10, 20, 50] if buy else [50, 100, 200], [0.6, 0.2, 0.2] if buy else [0.3, 0.4, 0.3]),
            }
        self.game_config.opt_params = params
        verify_optimization_input(self.game_config, self.game_config.opt_params)


if __name__ == "__main__":
    import json

    for m, c in mode_targets().items():
        tot = sum(v["rtp"] for v in c.values())
        print(m, round(tot, 6), json.dumps({k: (round(v["rtp"], 4), v.get("hr")) for k, v in c.items()}))
