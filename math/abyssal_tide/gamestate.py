import random

from game_config import FREE_SPINS, TIERS
from game_events import selected_mode_event, update_board_event, update_grid_event
from game_override import GameStateOverride
from src.events.events import fs_trigger_event


class GameState(GameStateOverride):
    """Round flow: base spin with tumbles, then (maybe) 10 free spins."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board()
            self.tumble_sequence()

            scatters = self.count_special_symbols("scatter")
            if self.get_current_distribution_conditions()["force_freegame"]:
                # Tumbles may add or remove scatters; the round must match its tier exactly.
                if scatters != self.forced_scatters or self.wincap_triggered:
                    self.repeat = True
                    continue
                self.trigger_free_spins()
            elif scatters >= 3:
                self.repeat = True
                continue

            self.evaluate_finalwin()
            self.check_repeat()

        self.imprint_wins()

    def trigger_free_spins(self):
        if self.tier == "H":
            # One of the five Sunken Compasses upgrades to the Abyssal Compass.
            pos = random.choice(self.special_syms_on_board["scatter"])
            self.board[pos["reel"]][pos["row"]] = self.create_symbol("S2")
            self.get_special_symbols_on_board()
            update_board_event(self)
        self.record({"kind": self.forced_scatters, "symbol": "scatter", "tier": self.tier, "gametype": self.gametype})
        self.tot_fs = FREE_SPINS
        fs_trigger_event(self, include_padding_index=False, basegame_trigger=True, freegame_trigger=False)
        self.run_freespin()

    def run_freespin(self):
        self.reset_fs_spin()
        self.tot_fs = FREE_SPINS
        self.reset_spots(TIERS[self.tier][1])  # spots carry over between free spins
        self.reset_damage()  # damage carries across all 10 free spins
        selected_mode_event(self, self.tier)
        update_grid_event(self)
        while self.fs < self.tot_fs and not self.wincap_triggered:
            self.update_freespin()
            self.draw_board()
            self.tumble_sequence()
        self.end_freespin()
