from game_executables import GameExecutables
from src.calculations.statistics import get_random_outcome
from src.events.events import reveal_event


class GameStateOverride(GameExecutables):
    """Overrides of universal state functions."""

    def reset_book(self):
        super().reset_book()
        self.tumble_win = 0
        self.tier = None
        self.forced_scatters = None
        self.wild_clusters = []
        self.reset_spots(1)  # base-game spots start at 1x and reset every spin
        self.reset_damage()  # base-game damage resets every spin

    def assign_special_sym_function(self):
        pass

    def draw_board(self, emit_event: bool = True, trigger_symbol: str = "scatter") -> None:
        """Feature criteria force the scatter count for their tier on the base reveal."""
        cond = self.get_current_distribution_conditions()
        if cond["force_freegame"] and self.gametype == self.config.basegame_type:
            self.tier = get_random_outcome(cond["tiers"])
            self.forced_scatters = {"B": 3, "S": 4, "U": 5, "H": 5}[self.tier]
            self.force_special_board(trigger_symbol, self.forced_scatters)
        elif self.gametype == self.config.basegame_type:
            self.create_board_reelstrips()
            while self.count_special_symbols(trigger_symbol) >= 3:
                self.create_board_reelstrips()
        else:
            self.create_board_reelstrips()
        if emit_event:
            reveal_event(self)

    def check_repeat(self) -> None:
        """Re-run the simulation if it failed its criteria."""
        if self.repeat is False:
            win_criteria = self.get_current_betmode_distributions().get_win_criteria()
            if win_criteria is not None and self.final_win != win_criteria:
                self.repeat = True
            if self.get_current_distribution_conditions()["force_freegame"] and not self.triggered_freegame:
                self.repeat = True
            if self.win_manager.running_bet_win == 0 and self.criteria != "0":
                self.repeat = True
