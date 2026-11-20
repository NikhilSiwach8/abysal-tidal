"""Fast in-process diagnostics: python tools/diag.py <mode> <criteria> <n>
Prints average payout, boss-slain rate, damage and spot stats for one criteria."""
import os, sys, statistics, random
ROOT = os.path.join(os.path.dirname(__file__), "..", "math-sdk")
sys.path[:0] = [ROOT, os.path.join(ROOT, "games", "abyssal_tide")]
os.chdir(ROOT)
from game_config import GameConfig
from gamestate import GameState

mode, crit, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
cfg = GameConfig(); gs = GameState(cfg)
gs.betmode = mode; gs.criteria = crit
from src.wins.win_manager import WinManager
gs.win_manager = WinManager(cfg.basegame_type, cfg.freegame_type, cfg.wincap)
wins, slain, dmg, maxspot, powerups = [], 0, [], [], []
for i in range(n):
    gs.run_spin(i)
    wins.append(gs.final_win)
    ev = gs.book.events
    slain += any(e.get("featureType") == "bossFeature" and e["info"][0]["feature"] == "bossSlain" for e in ev)
    ds = [e["info"][0]["damage"] for e in ev if e.get("featureType") == "damage"]
    dmg.append(max(ds) if ds else 0)
    grids = [max(max(r) for r in e["gridMultipliers"]) for e in ev if e["type"] == "updateGrid"]
    maxspot.append(max(grids) if grids else 1)
    gs.win_manager.reset_end_round_wins()
wins.sort()
print(f"{mode}/{crit} n={n} avg={statistics.mean(wins):.1f} med={wins[n//2]:.1f} p90={wins[int(n*.9)]:.0f} p99={wins[int(n*.99)]:.0f} max={wins[-1]:.0f} "
      f"slain={slain/n:.1%} dmg_avg={statistics.mean(dmg):.0f} maxspot_avg={statistics.mean(maxspot):.1f} hit={sum(1 for w in wins if w>0)/n:.2%}")
