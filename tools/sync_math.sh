#!/usr/bin/env bash
# Mirror the game math between the git-ignored math-sdk clone and this repo.
#   tools/sync_math.sh export   math-sdk/games/abyssal_tide -> math/abyssal_tide (to commit here)
#   tools/sync_math.sh import   math/abyssal_tide -> math-sdk/games/abyssal_tide (fresh clone)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK="${ROOT}/math-sdk/games/abyssal_tide"
MIRROR="${ROOT}/math/abyssal_tide"
case "${1:-}" in
  export) rm -rf "${MIRROR}"; mkdir -p "${MIRROR}"; (cd "${SDK}" && tar --exclude=library --exclude=__pycache__ -cf - .) | (cd "${MIRROR}" && tar -xf -) ;;
  import) mkdir -p "${SDK}"; (cd "${MIRROR}" && tar -cf - .) | (cd "${SDK}" && tar -xf -) ;;
  *) echo "usage: $0 export|import" >&2; exit 2 ;;
esac
echo "done: $1"
