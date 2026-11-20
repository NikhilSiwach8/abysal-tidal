/**
 * Symbol art (generated, see art/generated/symbols). Low symbols and creatures are
 * transparent and sit on the multiplier-spot parchment tile; specials are full panels.
 * symbolSvg(code, slice?) returns the markup for one cell; `slice` shows one cell of
 * the n×n Leviathan mega symbol.
 */
import { asset } from "./assets"

export type Code =
  | "L1" | "L2" | "L3" | "L4" | "L5"
  | "H1" | "H2" | "H3" | "H4" | "H5" | "H6"
  | "W" | "S" | "S2"

export const CODES: Code[] = ["L1", "L2", "L3", "L4", "L5", "H1", "H2", "H3", "H4", "H5", "H6", "W", "S", "S2"]

export const SYMBOL_NAMES: Record<Code, string> = {
  H6: "Leviathan",
  H5: "Golden Trident",
  H4: "Kraken",
  H3: "Anglerfish",
  H2: "Nautilus",
  H1: "Jellyfish",
  L5: "Pearl",
  L4: "Shell",
  L3: "Coral",
  L2: "Starfish",
  L1: "Seahorse",
  W: "Whirlpool Wild",
  S: "Sunken Compass",
  S2: "Abyssal Compass",
}

/** Full-panel symbols cover the spot tile; the rest are transparent art on it. */
export const PANEL: ReadonlySet<Code> = new Set<Code>(["H5", "W", "S", "S2", "H6"])

export interface Slice {
  col: number
  row: number
  n: number
}

export function symbolUrl(code: Code): string {
  return asset(`sym/${code}`)
}

/**
 * Markup for one symbol. In the grid the parchment comes from the spot layer; pass
 * `withTile` for standalone uses (paytable, menus) so lows/creatures get a tile too.
 */
export function symbolSvg(code: Code, slice?: Slice, withTile = false): string {
  if (code === "H6" && slice && slice.n > 1) {
    const { col, row, n } = slice
    const pos = (v: number) => (n === 1 ? 0 : (v * 100) / (n - 1))
    return `<div class="art mega-slice" style="background-image:url(${symbolUrl("H6")});background-size:${n * 100}% ${n * 100}%;background-position:${pos(col)}% ${pos(row)}%"></div>`
  }
  const img = `<img class="art${PANEL.has(code) ? " panel" : ""}" src="${symbolUrl(code)}" alt="" draggable="false">`
  if (withTile && !PANEL.has(code)) return `<div class="tiled" style="background-image:url(${asset("sym/tile")})">${img}</div>`
  return img
}
