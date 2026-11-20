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
the average value of a tier differs between modes: the optimizer re-weights each mode's
books to land on 96.70%.

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
* QA helper (demo only): `?demoBook=<id>` forces a demo book; showcase IDs are in `public/demo/showcase.json`.

## Upload

* Math: `math-sdk/games/abyssal_tide/library/publish_files/*`
* Frontend: `frontend/dist/*`
