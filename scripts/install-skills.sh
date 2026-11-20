#!/usr/bin/env bash
# Installs the Stake Engine / slot development Claude Code skills into this
# project's .claude/skills (and optionally ~/.claude/skills with --global).
#
# Sources:
#   - ReSkin-Games/stake-engine-skills (MIT): stake-math-sdk, stake-web-sdk
#   - egorfedorov/Slot-Casino-Game-Developer-Skills-for-Stake-Engine (no license file
#     upstream, so these are fetched on demand and git-ignored, not redistributed)
#
# The libraries from engineio/ts-client (npm: stake-engine) and slot-engine/slot-engine
# (npm: @slot-engine/*) are regular npm dependencies, installed by `pnpm install`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${ROOT}/.claude/skills"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

git clone --depth 1 -q https://github.com/ReSkin-Games/stake-engine-skills.git "${TMP}/reskin"
git clone --depth 1 -q https://github.com/egorfedorov/Slot-Casino-Game-Developer-Skills-for-Stake-Engine.git "${TMP}/egor"

mkdir -p "${DEST}"
install_skill() { # $1 = source dir
  local name; name="$(basename "$1")"
  rm -rf "${DEST:?}/${name}"
  cp -R "$1" "${DEST}/${name}"
  chmod +x "${DEST}/${name}/scripts/"* 2>/dev/null || true
  echo "installed ${name}"
}

for s in "${TMP}"/reskin/stake-*-sdk; do install_skill "$s"; done
for s in "${TMP}"/egor/*/; do [ -f "${s}SKILL.md" ] && install_skill "${s%/}"; done

if [ "${1:-}" = "--global" ]; then
  mkdir -p "${HOME}/.claude/skills"
  cp -R "${DEST}/." "${HOME}/.claude/skills/"
  echo "also copied to ${HOME}/.claude/skills"
fi
echo "Done. Restart Claude Code (or open a new session) to load the skills."
