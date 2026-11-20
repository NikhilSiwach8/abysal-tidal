# Abyssal Tide

A 6×6 cluster-pays tumble slot for Stake Engine: a hooded harpooner hunts the Leviathan in
an original ink-wash deep sea. All art, names, text and audio in this repo are original.

| Part | Where |
| --- | --- |
| Game math (Stake Python Math SDK) | `math/abyssal_tide/` (mirror), run inside `math-sdk/games/abyssal_tide` |
| Math tools | `tools/make_reels.py`, `tools/audit_publish.py`, `tools/diag.py`, `tools/sync_math.sh` |
| Frontend (Vite 6 + TypeScript, static) | `frontend/` |
| Claude Code skills | `.claude/skills/` (`scripts/install-skills.sh` restores them) |

`math-sdk/` (StakeEngine/math-sdk) and `vendor/` (ts-client, web-sdk for reference) are
cloned locally and git-ignored. The game math lives on the `abyssal-tide` branch of the
local math-sdk clone and is mirrored here in `math/abyssal_tide/`.

## Setup

```bash
git clone https://github.com/StakeEngine/math-sdk math-sdk
python3.12 -m venv math-sdk/env
math-sdk/env/bin/pip install -r math-sdk/requirements.txt
math-sdk/env/bin/pip install -e math-sdk
tools/sync_math.sh import
cd frontend && npm ci
```

## Math

```bash
python3 tools/make_reels.py                                    # BR0 / FR0 / WCAP strips
cd math-sdk && env/bin/python games/abyssal_tide/run.py 100000 all   # sims + optimizer + checks
cd .. && math-sdk/env/bin/python tools/audit_publish.py --books
```

`run.py [num_sims] [sims|opt|all] [modes]`. Output: `math-sdk/games/abyssal_tide/library/publish_files/`
(`books_<mode>.jsonl.zst`, `lookUpTable_<mode>_0.csv`, `index.json`).

### Rules implemented

* 6×6, no padding. Clusters of 5+ (horizontal/vertical); Wild `W` substitutes; tumbles until no win.
* Multiplier spots on every cell. Base: start 1×, reset every spin. A winning cluster that
  contains a Wild doubles every spot under it after paying (cap 64×). Cluster multiplier =
  sum of covered spots above 1×, or 1× if none.
* Leviathan damage = winning symbols per tumble; every 25 fires the next power-up:
  symbolsToWild, wildBlock, lowSymbolsToWild, symbolBlock, dualSymbolsToWild,
  highSymbolBlock, dualLowSymbolsToWild, bossSlain (H6 block 3×3–6×6 at 200).
  Damage resets each base spin; carries across the 10 free spins.
* H6 pays by covered cells (5–15 → 100×, 16–24 → 1,000×, 25–35 → 10,000×, 36 → 100,000×).
  Spots do not multiply H6.
* Free spins: always 10, no retriggers. 3 S → Riptide (1×), 4 S → Undertow (2×),
  5 S → Maelstrom (4×), 4 S + S2 → Abyssal (8×). Spots carry over between free spins.
* Win cap 100,000× in every mode; the round ends when reached. RTP 96.70% in every mode.

| Mode | Cost | Behaviour |
| --- | --- | --- |
| base | 1× | base game |
| hunt | 5× | every bonus 10× as likely |
| deep_hunt | 50× | Maelstrom and Abyssal 150× as likely |
| bonus | 150× | buys Riptide |
| super | 400× | buys Undertow |
| ultra | 1,000× | buys Maelstrom, 6.66% upgrade to Abyssal |
| mystery | 500× | 60% nothing / 25% Undertow / 10% Maelstrom / 5% Abyssal |
| mystery_deep | 650× | 60% nothing / 30% Undertow / 10% Abyssal |

Hit rates follow these ratios exactly (see `game_optimization.py`). With fixed buy prices,
the average value of a tier differs between modes, so each mode's books are re-weighted to
land on 96.70%.

**Optimizer.** `run.py` uses `optimize_weights.py`, a deterministic solver: each criteria
gets exactly its target probability, and its books are re-weighted by a power tilt
`w ∝ (1 + payout)^θ` with θ bisected to hit the target average win exactly. The SDK's
Rust optimizer (`OPTIMIZER=rust`) ignored the hit-rate targets in the multi-criteria modes
(base came out at 53.6% RTP), so it is not used by default. Book IDs and payouts are
untouched, so the SDK's book hashes and `execute_all_tests` still verify.

Final audit (`tools/audit_publish.py --books`, 100,000 books per mode): every mode at
96.7000%, spread 0.0000%, base hit rate 1 in 3.18, max win 100,000× reachable in every
mode (base about 1 in 5.6M). The SDK's Studio risk checks flag volatility/tail limits in
base, hunt, ultra, mystery and mystery_deep, which caps the max base bet template at $100.

## Frontend

```bash
cd frontend
npm run demo-books               # weighted sample of published books -> public/demo/
python3 scripts/verify_playback.py   # replays every demo book's board logic vs the math
npm run dev                      # http://localhost:5173 (demo mode without sessionID/rgs_url)
npm run build                    # dist/ (relative paths, static only)
```

* Live: `?sessionID=…&rgs_url=…&lang=…&currency=…` uses `stake-engine` RGSClient.
* Replay: `?replay=true&game=…&version=…&mode=…&event=…&rgs_url=…`; without `rgs_url` a demo book is replayed.
* Social: `?social=true` or jurisdiction `socialCasino` swaps money wording for coin wording.
* Background: the generated art layers in `frontend/src/assets/bg/` (unchanged copies of
  `art/generated/background/`), stacked for parallax with a fog and particle layer.
  Free-spin tiers grade each layer separately via body classes `tier-riptide`,
  `tier-undertow`, `tier-maelstrom`, `tier-abyssal` (far strongest, mid medium,
  front subtle; symbols, UI and characters are never filtered). Brightness is
  calibrated to -0/-10/-20/-30%; CSS filters approximate a LUT.
* QA helper (demo only): `?demoBook=<id>` forces a demo book; showcase IDs are in `public/demo/showcase.json`.

## Art

Generated art lives in `art/generated/` (sources and cleaned PNGs). The game uses
right-sized WebP copies in `frontend/src/assets/`, produced by:

```bash
python3 tools/prepare_game_assets.py
```

Re-run it after replacing any art. The characters are split into animation layers (scarf, coat
tail and eyes for the hero; head and gills for the Leviathan) by `python3 tools/rig_characters.py`;
re-run it after replacing `hero_idle` or `leviathan_idle`. Ambient loops follow section 9 of
`art/ABYSSAL_TIDE_ASSET_PROMPTS.txt` and switch off under the OS "reduce motion" setting. Symbols sit on the parchment multiplier-spot tile
(tinted by spot level); specials are full panels; the Leviathan mega symbol is sliced
per cell. Painted overlay titles are used except in social-casino sessions, which show
translated text because several titles contain restricted words ("WIN").

## Upload

* Math: `math-sdk/games/abyssal_tide/library/publish_files/*`
* Frontend: `frontend/dist/*`
