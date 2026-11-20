"""Abyssal Tide — 6x6 cluster-pays tumble slot with a Leviathan damage ladder."""

import os
from src.config.config import Config
from src.config.distributions import Distribution
from src.config.betmode import BetMode

# Free-spin tiers: code -> (name, starting spot value)
TIERS = {
    "B": ("Riptide", 1),
    "S": ("Undertow", 2),
    "U": ("Maelstrom", 4),
    "H": ("Abyssal", 8),
}

# Leviathan damage ladder: one power-up every DAMAGE_STEP damage, in this order.
DAMAGE_STEP = 25
POWER_UPS = [
    "symbolsToWild",
    "wildBlock",
    "lowSymbolsToWild",
    "symbolBlock",
    "dualSymbolsToWild",
    "highSymbolBlock",
    "dualLowSymbolsToWild",
    "bossSlain",
]
BOSS_HP = DAMAGE_STEP * len(POWER_UPS)  # 200

HIGH = ["H1", "H2", "H3", "H4", "H5"]
LOW = ["L1", "L2", "L3", "L4", "L5"]
PAYING = HIGH + LOW

FREE_SPINS = 10
WINCAP = 100_000.0
DEFAULT_BOSS_SIZES = {3: 70, 4: 22, 5: 7, 6: 1}


class GameConfig(Config):
    """Singleton game configuration."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        super().__init__()
        self.game_id = "abyssal_tide"
        self.provider_number = 0
        self.working_name = "Abyssal Tide"
        self.wincap = WINCAP
        self.win_type = "cluster"
        self.rtp = 0.9670
        self.construct_paths()

        self.num_reels = 6
        self.num_rows = [6] * self.num_reels

        t1, t2, t3, t4 = (5, 7), (8, 10), (11, 13), (14, 36)
        pays = {
            "H5": (1, 2.5, 5, 50),
            "H4": (0.5, 1, 3.8, 35),
            "H3": (0.3, 0.8, 3, 30),
            "H2": (0.3, 0.6, 2.2, 20),
            "H1": (0.2, 0.5, 1.5, 10),
            "L5": (0.2, 0.4, 1.2, 7.5),
            "L4": (0.2, 0.3, 1, 6),
            "L3": (0.1, 0.3, 1, 6),
            "L2": (0.1, 0.2, 0.8, 5),
            "L1": (0.1, 0.2, 0.7, 5),
        }
        pay_group = {}
        for sym, values in pays.items():
            for tier, v in zip((t1, t2, t3, t4), values):
                pay_group[(tier, sym)] = float(v)
        # Leviathan mega symbol pays by covered cells (3x3 -> 100x ... 6x6 -> 100,000x)
        for tier, v in (((5, 15), 100.0), ((16, 24), 1_000.0), ((25, 35), 10_000.0), ((36, 36), 100_000.0)):
            pay_group[(tier, "H6")] = v
        self.paytable = self.convert_range_table(pay_group)

        self.include_padding = False
        self.special_symbols = {"wild": ["W"], "scatter": ["S", "S2"]}

        self.freespin_triggers = {
            self.basegame_type: {3: FREE_SPINS, 4: FREE_SPINS, 5: FREE_SPINS, 6: FREE_SPINS},
            self.freegame_type: {99: 0},  # no retriggers
        }
        self.anticipation_triggers = {self.basegame_type: 2, self.freegame_type: 99}

        self.maximum_board_mult = 64

        self.reels = {}
        for r in ("BR0", "FR0", "WCAP"):
            self.reels[r] = self.read_reels_csv(os.path.join(self.reels_path, f"{r}.csv"))

        self.bet_modes = [
            self._mode("base", 1, {"0": 0.40, "basegame": 0.478, "B": 0.06, "S": 0.03, "U": 0.02, "H": 0.01}, base=True),
            self._mode("hunt", 5, {"0": 0.35, "basegame": 0.448, "B": 0.09, "S": 0.05, "U": 0.035, "H": 0.025}, base=True),
            self._mode("deep_hunt", 50, {"0": 0.25, "basegame": 0.348, "B": 0.03, "S": 0.03, "U": 0.22, "H": 0.12}, base=True),
            self._mode("bonus", 150, {"B": 0.998}),
            self._mode("super", 400, {"S": 0.998}),
            self._mode("ultra", 1000, {"U": 0.90, "H": 0.098}),
            self._mode("mystery", 500, {"0": 0.50, "S": 0.25, "U": 0.15, "H": 0.098}),
            self._mode("mystery_deep", 650, {"0": 0.50, "S": 0.30, "H": 0.198}),
        ]

    # ------------------------------------------------------------------ helpers
    def _reels(self, wincap=False):
        return {
            self.basegame_type: {"BR0": 1},
            self.freegame_type: ({"FR0": 1, "WCAP": 3} if wincap else {"FR0": 1}),
        }

    def _mode(self, name, cost, quotas, base=False):
        """Build a bet mode. Feature criteria are named by tier code (B/S/U/H)."""
        tiers_in_mode = [k for k in quotas if k in TIERS]
        dists = [
            Distribution(
                criteria="wincap",
                quota=0.002,
                win_criteria=self.wincap,
                conditions={
                    "reel_weights": self._reels(wincap=True),
                    "force_wincap": True,
                    "force_freegame": True,
                    "tiers": {t: 1 for t in tiers_in_mode},
                    "boss_sizes": {4: 2, 5: 4, 6: 4},
                },
            )
        ]
        for crit, quota in quotas.items():
            if crit in TIERS:
                dists.append(
                    Distribution(
                        criteria=crit,
                        quota=quota,
                        conditions={
                            "reel_weights": self._reels(),
                            "force_wincap": False,
                            "force_freegame": True,
                            "tiers": {crit: 1},
                            "boss_sizes": DEFAULT_BOSS_SIZES,
                        },
                    )
                )
            else:  # "0" (no win) and "basegame" (any non-zero base win)
                dists.append(
                    Distribution(
                        criteria=crit,
                        quota=quota,
                        win_criteria=0.0 if crit == "0" else None,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}},
                            "force_wincap": False,
                            "force_freegame": False,
                            "boss_sizes": DEFAULT_BOSS_SIZES,
                        },
                    )
                )
        return BetMode(
            name=name,
            cost=float(cost),
            rtp=self.rtp,
            max_win=self.wincap,
            auto_close_disabled=False,
            is_feature=base,
            is_buybonus=not base,
            distributions=dists,
        )
