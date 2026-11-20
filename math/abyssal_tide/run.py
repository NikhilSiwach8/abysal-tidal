"""Abyssal Tide: simulate books, optimize to target RTP, analyse, verify.

    python run.py [num_sims] [sims|opt|all] [modes]

    num_sims   books per mode (default 100000)
    stage      sims = simulate only, opt = optimize + analyse + verify existing books,
               all  = everything (default)
    modes      comma-separated subset, e.g. base,bonus (default: all 8 modes)
"""

import os
import sys

from game_config import GameConfig
from gamestate import GameState
from game_optimization import OptimizationSetup
from optimization_program.run_script import OptimizationExecution
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs
from utils.game_analytics.run_analysis import create_stat_sheet
from utils.rgs_verification import execute_all_tests

ALL_MODES = ["base", "hunt", "deep_hunt", "bonus", "super", "ultra", "mystery", "mystery_deep"]

if __name__ == "__main__":
    args = sys.argv[1:]
    num_sims = int(float(args[0])) if len(args) > 0 else 100_000
    stage = args[1] if len(args) > 1 else "all"
    modes = args[2].split(",") if len(args) > 2 else ALL_MODES
    assert stage in ("sims", "opt", "all"), "stage must be sims|opt|all"
    assert all(m in ALL_MODES for m in modes), f"unknown mode in {modes}"

    num_threads = int(os.environ.get("THREADS", os.cpu_count() or 4))
    rust_threads = num_threads
    batching_size = max(1, min(5000, num_sims // num_threads))
    compression = True

    config = GameConfig()
    gamestate = GameState(config)
    OptimizationSetup(config)  # attaches targets; written into math_config.json by generate_configs

    if stage in ("sims", "all"):
        create_books(
            gamestate,
            config,
            {m: num_sims for m in modes},
            batching_size,
            num_threads,
            compression,
            False,
        )
        generate_configs(gamestate)

    if stage in ("opt", "all"):
        generate_configs(gamestate)
        OptimizationExecution().run_all_modes(config, modes, rust_threads)
        generate_configs(gamestate)
        create_stat_sheet(gamestate, custom_keys=[{"symbol": "scatter"}])
        execute_all_tests(config)
