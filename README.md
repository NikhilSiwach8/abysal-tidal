# Abyssal Tide

A 6×6 cluster-pays tumble slot for Stake Engine — an original deep-sea hunt: a hooded
harpooner against the Leviathan. All art, names, text and audio are original.

| Part | Where |
| --- | --- |
| Math (Stake Python Math SDK) | `math-sdk/games/abyssal_tide` (separate repo, branch `abyssal-tide`; cloned, git-ignored here) |
| Math tools | `tools/` (`make_reels.py`, `audit_publish.py`) |
| Frontend (Vite + TypeScript, static) | `frontend/` |

## Setup

```bash
git clone https://github.com/StakeEngine/math-sdk math-sdk
python3.12 -m venv math-sdk/env
math-sdk/env/bin/pip install -r math-sdk/requirements.txt && math-sdk/env/bin/pip install -e math-sdk
cd frontend && npm ci
```
