"""Game-specific actions: multiplier spots, Leviathan damage ladder, power-ups, tumbles."""

import random

from game_calculations import GameCalculations
from game_config import BOSS_HP, DAMAGE_STEP, HIGH, LOW, PAYING, POWER_UPS
from game_events import (
    boss_feature_event,
    damage_event,
    tumble_board_event,
    update_board_event,
    update_grid_event,
)
from src.events.events import update_freespin_event, update_tumble_win_event, win_info_event
from src.calculations.statistics import get_random_outcome


class GameExecutables(GameCalculations):
    # ------------------------------------------------------------------ spots
    def reset_spots(self, start: int = 1) -> None:
        self.spots = [[start] * self.config.num_rows[r] for r in range(self.config.num_reels)]

    def grow_spots(self) -> bool:
        """After a winning cluster containing a Wild has paid, double every spot under it (cap 64x)."""
        changed = False
        cap = self.config.maximum_board_mult
        for group in self.wild_clusters:
            for r, c in group:
                new = min(self.spots[r][c] * 2, cap)
                if new != self.spots[r][c]:
                    self.spots[r][c] = new
                    changed = True
        if changed:
            update_grid_event(self)
        return changed

    # ------------------------------------------------------------------ damage
    def reset_damage(self) -> None:
        self.damage = 0
        self.powerups_fired = 0
        self.boss_slain = False

    def add_damage(self, amount: int) -> None:
        if self.boss_slain or amount <= 0:
            return
        self.damage = min(self.damage + amount, BOSS_HP)
        damage_event(self, amount)

    def pending_powerups(self) -> bool:
        return not self.boss_slain and self.damage >= DAMAGE_STEP * (self.powerups_fired + 1)

    def apply_powerups(self) -> None:
        """Fire every power-up whose damage threshold has been reached, in ladder order."""
        while self.pending_powerups():
            feature = POWER_UPS[self.powerups_fired]
            self.powerups_fired += 1
            getattr(self, f"_pu_{feature}")(feature)
            self.get_special_symbols_on_board()
            update_board_event(self)

    def _names_on_board(self, pool) -> list[str]:
        present = {s.name for reel in self.board for s in reel}
        return [p for p in pool if p in present]

    def _set(self, positions, name: str) -> None:
        for r, c in positions:
            self.board[r][c] = self.create_symbol(name)

    def _symbols_to_wild(self, feature: str, pool, count: int) -> None:
        choices = self._names_on_board(pool)
        random.shuffle(choices)
        picked = sorted(choices[:count])
        positions = [(r, c) for r, reel in enumerate(self.board) for c, s in enumerate(reel) if s.name in picked]
        self._set(positions, "W")
        boss_feature_event(self, feature, positions, symbols=picked)

    def _block(self, size: int, keep_scatters: bool = True):
        n = self.config.num_reels
        r0 = random.randint(0, n - size)
        c0 = random.randint(0, self.config.num_rows[0] - size)
        cells = [(r, c) for r in range(r0, r0 + size) for c in range(c0, c0 + size)]
        if keep_scatters:
            cells = [(r, c) for r, c in cells if not self.board[r][c].check_attribute("scatter")]
        return cells

    def _pu_symbolsToWild(self, f):
        self._symbols_to_wild(f, PAYING, 1)

    def _pu_lowSymbolsToWild(self, f):
        self._symbols_to_wild(f, LOW, 1)

    def _pu_dualSymbolsToWild(self, f):
        self._symbols_to_wild(f, PAYING, 2)

    def _pu_dualLowSymbolsToWild(self, f):
        self._symbols_to_wild(f, LOW, 2)

    def _pu_wildBlock(self, f):
        cells = self._block(2)
        self._set(cells, "W")
        boss_feature_event(self, f, cells, symbols=["W"], size=2)

    def _pu_symbolBlock(self, f):
        sym = random.choice(PAYING)
        cells = self._block(3)
        self._set(cells, sym)
        boss_feature_event(self, f, cells, symbols=[sym], size=3)

    def _pu_highSymbolBlock(self, f):
        sym = random.choice(HIGH)
        cells = self._block(3)
        self._set(cells, sym)
        boss_feature_event(self, f, cells, symbols=[sym], size=3)

    def _pu_bossSlain(self, f):
        size = int(get_random_outcome(self.get_current_distribution_conditions()["boss_sizes"]))
        cells = self._block(size, keep_scatters=False)
        self._set(cells, "H6")
        self.boss_slain = True
        boss_feature_event(self, f, cells, symbols=["H6"], size=size)

    # ------------------------------------------------------------------ tumbles
    def tumble_sequence(self) -> None:
        """Evaluate -> pay -> grow spots -> damage -> tumble -> power-ups, until no win."""
        while True:
            self.evaluate_board()
            if self.win_data["totalWin"] <= 0:
                break
            win_info_event(self, include_padding_index=False)
            update_tumble_win_event(self)
            self.evaluate_wincap()
            self.grow_spots()
            exploding = {(p["reel"], p["row"]) for w in self.win_data["wins"] for p in w["positions"]}
            self.add_damage(len(exploding))
            if self.wincap_triggered:
                break
            self.tumble_board()
            tumble_board_event(self, exploding)
            self.apply_powerups()
        self.set_end_tumble_event()
        self.win_manager.update_gametype_wins(self.gametype)

    def update_freespin(self) -> None:
        """Called before each free-spin reveal."""
        self.fs += 1
        update_freespin_event(self)
        self.win_manager.reset_spin_win()
        self.win_data = {}
