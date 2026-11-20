"""Cluster evaluation for Abyssal Tide.

* Clusters: 5+ matching paying symbols joined horizontally/vertically. Wilds join any
  cluster (and may be shared by several). Scatters never join.
* H6 (Leviathan mega symbol) pays by the number of H6 cells it covers; wilds do not
  extend it.
* Cluster multiplier = sum of the multiplier spots above 1x that the cluster covers,
  or 1x if every covered spot is still 1x.
"""

from src.executables.executables import Executables
from src.calculations.cluster import Cluster

WILD = "W"
MEGA = "H6"
NON_JOINING = {"S", "S2", MEGA, WILD}


def find_clusters(names: list[list[str]]) -> list[tuple[str, list[tuple[int, int]]]]:
    """Return [(symbol, [(reel,row), ...])] for every connected group (any size)."""
    reels = len(names)
    seen: set[tuple[int, int]] = set()
    out = []
    for r in range(reels):
        for c in range(len(names[r])):
            sym = names[r][c]
            if (r, c) in seen or sym in ("S", "S2", WILD):
                continue
            joins = (lambda s, target=sym: s == target) if sym == MEGA else (lambda s, target=sym: s == target or s == WILD)
            group = [(r, c)]
            local = {(r, c)}
            seen.add((r, c))
            stack = [(r, c)]
            while stack:
                x, y = stack.pop()
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < reels and 0 <= ny < len(names[nx]) and (nx, ny) not in local:
                        if joins(names[nx][ny]):
                            local.add((nx, ny))
                            group.append((nx, ny))
                            stack.append((nx, ny))
                            if names[nx][ny] != WILD:
                                seen.add((nx, ny))
            out.append((sym, sorted(group)))
    return out


class GameCalculations(Executables):
    """Win evaluation with multiplier spots."""

    def cluster_multiplier(self, positions) -> int:
        total = sum(self.spots[r][c] for r, c in positions if self.spots[r][c] > 1)
        return max(total, 1)

    def evaluate_board(self) -> None:
        """Find paying clusters, set explode flags, fill self.win_data, update the wallet."""
        names = [[s.name for s in reel] for reel in self.board]
        wins = []
        self.wild_clusters = []  # positions of winning clusters that contain a Wild
        total = 0.0
        for sym, group in find_clusters(names):
            size = len(group) if sym != MEGA else sum(1 for r, c in group if names[r][c] == MEGA)
            base = self.config.paytable.get((size, sym))
            if not base:
                continue
            # The Leviathan pays its fixed amount by size; spots apply to normal clusters only.
            mult = 1 if sym == MEGA else self.cluster_multiplier(group)
            win = round(base * mult, 2)
            total += win
            json_positions = [{"reel": r, "row": c} for r, c in group]
            centre = Cluster.get_central_cluster_position(json_positions)
            wins.append(
                {
                    "symbol": sym,
                    "clusterSize": size,
                    "win": win,
                    "positions": json_positions,
                    "meta": {
                        "globalMult": 1,
                        "clusterMult": mult,
                        "winWithoutMult": base,
                        "overlay": {"reel": centre[0], "row": centre[1]},
                    },
                }
            )
            if any(names[r][c] == WILD for r, c in group):
                self.wild_clusters.append(group)
            for r, c in group:
                self.board[r][c].explode = True

        total = round(total, 2)
        self.win_data = {"totalWin": total, "wins": wins}
        Cluster.record_cluster_wins(self)
        self.win_manager.update_spinwin(total)
        self.win_manager.tumble_win = total
