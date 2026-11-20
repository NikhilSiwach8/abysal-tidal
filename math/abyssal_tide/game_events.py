"""Custom book events for Abyssal Tide (on top of the SDK's standard events)."""

from src.events.events import json_ready_sym

UPDATE_GRID = "updateGrid"
UPDATE_BOARD = "updateBoard"
FEATURE = "featureEvent"
SELECTED_MODE = "selectedMode"
TUMBLE_BOARD = "tumbleBoard"


def _add(gamestate, event: dict) -> None:
    event = {"index": len(gamestate.book.events), **event}
    gamestate.book.add_event(event)


def board_json(gamestate) -> list:
    attrs = list(gamestate.config.special_symbols.keys())
    return [[json_ready_sym(sym, attrs) for sym in reel] for reel in gamestate.board]


def update_grid_event(gamestate) -> None:
    """Full 6x6 multiplier-spot grid, [reel][row]."""
    _add(gamestate, {"type": UPDATE_GRID, "gridMultipliers": [list(reel) for reel in gamestate.spots]})


def update_board_event(gamestate) -> None:
    """Full board after a power-up (or scatter upgrade) changed it."""
    _add(gamestate, {"type": UPDATE_BOARD, "board": board_json(gamestate)})


def damage_event(gamestate, added: int) -> None:
    _add(gamestate, {"type": FEATURE, "featureType": "damage", "info": [{"damage": gamestate.damage, "added": added}]})


def boss_feature_event(gamestate, feature: str, positions, symbols=None, size=None) -> None:
    info = {"damage": gamestate.damage, "feature": feature, "positions": [{"reel": r, "row": c} for r, c in positions]}
    if symbols is not None:
        info["symbols"] = list(symbols)
    if size is not None:
        info["size"] = size
    _add(gamestate, {"type": FEATURE, "featureType": "bossFeature", "info": [info]})


def selected_mode_event(gamestate, tier: str) -> None:
    _add(gamestate, {"type": SELECTED_MODE, "mode": tier})


def tumble_board_event(gamestate, exploding) -> None:
    """Removed positions (deduplicated) and the new symbols that drop in per reel (top first)."""
    attrs = list(gamestate.config.special_symbols.keys())
    new_symbols = [[json_ready_sym(s, attrs) for s in reel] for reel in gamestate.new_symbols_from_tumble]
    _add(
        gamestate,
        {
            "type": TUMBLE_BOARD,
            "newSymbols": new_symbols,
            "explodingSymbols": [{"reel": r, "row": c} for r, c in sorted(exploding)],
        },
    )
