/**
 * Symbol art. Every symbol is a <symbol> (viewBox 0 0 100 100) injected once into the
 * document; cells reference it with <use>. symbolSvg(code, slice) returns the markup
 * for one cell; `slice` view-boxes one cell of the n×n H6 Leviathan mega symbol.
 */

export type Code =
  | "L1" | "L2" | "L3" | "L4" | "L5"
  | "H1" | "H2" | "H3" | "H4" | "H5" | "H6"
  | "W" | "S" | "S2"

const INK = "#171b1d"

const parchment = `<rect x="5" y="5" width="90" height="90" rx="14" fill="url(#parch)" stroke="${INK}" stroke-width="3" filter="url(#rough)"/>`
const wash = (color: string, d: string) => `<path d="${d}" fill="${color}" opacity=".55" filter="url(#wash)"/>`
const panel = (grad: string) =>
  `<rect x="4" y="4" width="92" height="92" rx="12" fill="url(#${grad})" stroke="${INK}" stroke-width="3.5" filter="url(#rough)"/>
   <rect x="10" y="10" width="80" height="80" rx="8" fill="none" stroke="#f3f5f2" stroke-width="1.4" opacity=".35"/>`
const label = (t: string, size = 15, y = 88, fill = "#f3f5f2") =>
  `<text x="50" y="${y}" text-anchor="middle" font-family="'Permanent Marker', cursive" font-size="${size}" fill="${fill}" stroke="${INK}" stroke-width="3.2" paint-order="stroke" letter-spacing=".5">${t}</text>`

const ART: Record<Code, string> = {
  // ---------- low: ink outlines on parchment with colour washes
  L1: `${parchment}${wash("#4fae8a", "M40 22 C 60 16, 70 34, 62 46 C 56 56, 50 62, 54 76 C 58 88, 40 90, 36 80 Z")}
    <g fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#rough)">
      <path d="M44 20 C 62 16, 70 32, 62 44 L 72 46 L 60 52 C 54 60, 52 66, 56 74 C 60 84, 48 90, 40 84 C 34 78, 40 70, 46 74"/>
      <path d="M44 20 C 36 26, 36 38, 46 44 C 52 48, 56 50, 58 54"/>
      <path d="M38 28 l -8 -6 M40 22 l -6 -10 M48 18 l 0 -9"/>
    </g><circle cx="54" cy="28" r="3" fill="${INK}"/>`,
  L2: `${parchment}${wash("#e8553e", "M50 14 L60 40 L88 42 L66 58 L74 86 L50 70 L26 86 L34 58 L12 42 L40 40 Z")}
    <path d="M50 14 L60 40 L88 42 L66 58 L74 86 L50 70 L26 86 L34 58 L12 42 L40 40 Z" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" filter="url(#rough)"/>
    <g fill="${INK}" opacity=".7"><circle cx="50" cy="32" r="2"/><circle cx="50" cy="50" r="3"/><circle cx="66" cy="47" r="2"/><circle cx="34" cy="47" r="2"/><circle cx="61" cy="68" r="2"/><circle cx="39" cy="68" r="2"/></g>`,
  L3: `${parchment}${wash("#e8667a", "M30 88 C 26 60, 22 40, 30 22 C 44 36, 50 50, 52 60 C 58 40, 70 26, 80 20 C 82 46, 70 70, 60 88 Z")}
    <g fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" filter="url(#rough)">
      <path d="M50 90 L50 60 M50 66 C 40 56, 34 44, 34 28 M50 62 C 62 52, 68 40, 68 24 M36 44 C 28 42, 22 34, 22 24 M66 44 C 74 40, 80 32, 80 22 M50 60 L50 34"/>
    </g>`,
  L4: `${parchment}${wash("#d9a66b", "M16 70 C 20 34, 80 34, 84 70 C 66 80, 34 80, 16 70 Z")}
    <g fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#rough)">
      <path d="M16 70 C 20 30, 80 30, 84 70 C 66 80, 34 80, 16 70 Z"/>
      <path d="M50 76 L50 34 M50 76 L32 40 M50 76 L68 40 M50 76 L22 54 M50 76 L78 54"/>
      <path d="M40 78 L44 86 L56 86 L60 78"/>
    </g>`,
  L5: `${parchment}${wash("#7fa8c9", "M18 64 C 30 86, 70 86, 82 64 C 70 56, 30 56, 18 64 Z")}
    <path d="M18 64 C 30 86, 70 86, 82 64" fill="none" stroke="${INK}" stroke-width="3.2" filter="url(#rough)"/>
    <circle cx="50" cy="50" r="22" fill="url(#pearl-g)" stroke="${INK}" stroke-width="3.2" filter="url(#rough)"/>
    <circle cx="42" cy="42" r="6" fill="#fff" opacity=".85"/>`,

  // ---------- high: painted creatures
  H1: `<circle cx="50" cy="50" r="44" fill="#222a2d" opacity=".35" filter="url(#blur3)"/>
    <g stroke="${INK}" stroke-width="3" stroke-linecap="round" filter="url(#rough)">
      <path d="M30 56 C 28 70, 22 80, 26 92 M42 58 C 42 74, 36 84, 40 94 M58 58 C 58 74, 64 84, 60 94 M70 56 C 72 70, 78 80, 74 92" fill="none" stroke="#c48ad8"/>
      <path d="M30 56 C 28 70, 22 80, 26 92 M42 58 C 42 74, 36 84, 40 94 M58 58 C 58 74, 64 84, 60 94 M70 56 C 72 70, 78 80, 74 92" fill="none" stroke-width="1.2"/>
      <path d="M18 56 C 18 26, 82 26, 82 56 C 70 62, 30 62, 18 56 Z" fill="#b06fd6"/>
    </g>
    <path d="M28 46 C 36 34, 52 30, 64 36" fill="none" stroke="#f3e6ff" stroke-width="3" opacity=".7" stroke-linecap="round"/>
    <circle cx="50" cy="44" r="16" fill="#e7c6ff" opacity=".35" filter="url(#blur3)"/>`,
  H2: `<circle cx="50" cy="50" r="44" fill="#222a2d" opacity=".35" filter="url(#blur3)"/>
    <g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" filter="url(#rough)">
      <path d="M52 86 C 22 86, 12 60, 18 42 C 26 18, 64 10, 82 32 C 96 50, 90 74, 72 78 C 58 82, 46 72, 48 60 C 50 50, 62 48, 66 56" fill="#f3e2c4"/>
      <path d="M32 26 L44 48 M50 16 L54 44 M70 18 L62 44 M88 46 L68 56 M18 60 L46 60 M30 82 L48 68" stroke="#d27a32" stroke-width="7" stroke-linecap="round"/>
      <path d="M18 60 C 12 72, 26 88, 52 86" fill="none"/>
    </g><circle cx="28" cy="72" r="3.2" fill="${INK}"/>`,
  H3: `<circle cx="50" cy="50" r="44" fill="#222a2d" opacity=".35" filter="url(#blur3)"/>
    <path d="M48 30 C 50 14, 66 8, 78 14" fill="none" stroke="#4a5a60" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="80" cy="15" r="9" fill="#ffd36b" opacity=".45" filter="url(#blur3)"/><circle cx="80" cy="15" r="5" fill="#fff1b8"/>
    <g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" filter="url(#rough)">
      <path d="M12 58 C 12 34, 50 26, 70 40 C 82 48, 88 56, 88 62 C 78 76, 56 86, 36 82 C 22 80, 12 70, 12 58 Z" fill="#2c6a70"/>
      <path d="M88 62 L 98 50 L 96 76 Z" fill="#1f4f54"/>
      <path d="M26 66 C 42 80, 70 76, 82 62 L 80 68 C 66 86, 40 86, 26 66 Z" fill="#0b1416"/>
    </g>
    <path d="M32 70 l3 6 l3 -5 l3 6 l3 -6 l3 6 l3 -6 l3 5 l3 -6" fill="none" stroke="#f3f5f2" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="32" cy="50" r="7" fill="#ffd36b" stroke="${INK}" stroke-width="2"/><circle cx="33" cy="51" r="3" fill="${INK}"/>`,
  H4: `<circle cx="50" cy="50" r="44" fill="#222a2d" opacity=".35" filter="url(#blur3)"/>
    <g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" filter="url(#rough)">
      <path d="M26 74 q -14 -2 -14 -16 q 8 8 18 4 M34 82 q -2 12 -14 14 q 8 -12 4 -18 M66 82 q 2 12 14 14 q -8 -12 -4 -18 M74 74 q 14 -2 14 -16 q -8 8 -18 4 M46 86 q -2 10 -8 12 M54 86 q 2 10 8 12" fill="#c8402c"/>
      <path d="M24 52 C 20 18, 80 18, 76 52 C 74 74, 62 86, 50 86 C 38 86, 26 74, 24 52 Z" fill="#e8553e"/>
    </g>
    <ellipse cx="38" cy="56" rx="7" ry="8" fill="#ffd36b" stroke="${INK}" stroke-width="2"/><ellipse cx="62" cy="56" rx="7" ry="8" fill="#ffd36b" stroke="${INK}" stroke-width="2"/>
    <rect x="36" y="51" width="4" height="11" rx="2" fill="${INK}"/><rect x="60" y="51" width="4" height="11" rx="2" fill="${INK}"/>
    <path d="M36 32 C 44 26, 56 26, 64 32" fill="none" stroke="#ffb3a3" stroke-width="3" opacity=".6" stroke-linecap="round"/>`,

  // ---------- framed panels
  H5: `${panel("pan-coral")}
    <g filter="url(#rough)" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M50 92 L50 40" stroke-width="9"/><path d="M50 92 L50 40" stroke="url(#gold-g)" stroke-width="5"/>
      <path d="M26 18 L26 42 Q26 50 36 50 L64 50 Q74 50 74 42 L74 18 M50 12 L50 50" fill="none" stroke-width="9"/>
      <path d="M26 18 L26 42 Q26 50 36 50 L64 50 Q74 50 74 42 L74 18 M50 12 L50 50" fill="none" stroke="url(#gold-g)" stroke-width="5"/>
      <path d="M20 24 L26 10 L32 24 Z M68 24 L74 10 L80 24 Z M44 18 L50 4 L56 18 Z" fill="url(#gold-g)" stroke-width="2.5"/>
    </g>`,
  W: `${panel("pan-teal")}
    <g fill="none" stroke-linecap="round" filter="url(#rough)">
      <path d="M50 46 m -26 0 a 26 20 0 1 1 52 0 a 20 15 0 1 1 -40 0 a 13 10 0 1 1 26 0 a 6 5 0 1 1 -12 0" stroke="${INK}" stroke-width="8"/>
      <path d="M50 46 m -26 0 a 26 20 0 1 1 52 0 a 20 15 0 1 1 -40 0 a 13 10 0 1 1 26 0 a 6 5 0 1 1 -12 0" stroke="#e9fffb" stroke-width="3.5"/>
    </g>${label("WILD", 21, 88)}`,
  S: `${panel("pan-navy")}
    <circle cx="50" cy="42" r="28" fill="#c9cec6" stroke="${INK}" stroke-width="3.5" filter="url(#rough)"/>
    <circle cx="50" cy="42" r="21" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".6"/>
    <path d="M50 16 L57 42 L50 68 L43 42 Z" fill="#e8553e" stroke="${INK}" stroke-width="2.5"/>
    <path d="M50 42 L57 42 L50 68 L43 42 Z" fill="#2b3a40"/>
    <path d="M24 42 H30 M70 42 H76 M50 14 V20" stroke="${INK}" stroke-width="2.5"/>
    ${label("BONUS", 17, 90, "#ffd36b")}`,
  S2: `${panel("pan-purple")}
    <circle cx="50" cy="42" r="28" fill="#e6d6ff" stroke="${INK}" stroke-width="3.5" filter="url(#rough)"/>
    <circle cx="50" cy="42" r="30" fill="#a26ff0" opacity=".5" filter="url(#blur3)"/>
    <circle cx="50" cy="42" r="21" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".6"/>
    <path d="M50 16 L57 42 L50 68 L43 42 Z" fill="#5fe3d2" stroke="${INK}" stroke-width="2.5"/>
    <path d="M50 42 L57 42 L50 68 L43 42 Z" fill="#3b1f6e"/>
    ${label("ABYSSAL", 13.5, 90, "#f3f5f2")}`,
  H6: `${panel("pan-abyss")}
    <rect x="8" y="8" width="84" height="84" rx="8" fill="url(#scales)" opacity=".7"/>
    <g filter="url(#rough)" stroke="${INK}" stroke-width="2" stroke-linejoin="round">
      <path d="M12 46 C 18 22, 58 10, 84 26 C 94 34, 92 50, 84 58 L 70 62 C 54 64, 32 70, 18 86 L 14 86 C 8 70, 8 58, 12 46 Z" fill="#33454b"/>
      <path d="M14 86 C 30 92, 62 90, 86 74 L 90 66 C 72 76, 48 82, 18 80 Z" fill="#33454b"/>
      <path d="M18 80 C 40 80, 66 76, 88 66 L 86 74 C 62 86, 36 88, 16 86 Z" fill="#5a1f1a"/>
      <path d="M60 22 C 66 10, 80 6, 92 8 C 82 12, 74 20, 70 28 Z M 44 22 C 42 10, 50 2, 58 2 C 54 8, 52 16, 52 24 Z" fill="#c9cec6"/>
      <path d="M80 50 q 5 7 1 15 M 74 52 q 5 8 1 16" fill="none" stroke="#2bb3a3" stroke-width="2.5"/>
    </g>
    <g fill="#f3f5f2">${Array.from({ length: 7 }, (_, i) => `<path d="M${22 + i * 9} ${78 - i * 1.8} l3 -7 l3 7 Z"/>`).join("")}</g>
    <ellipse cx="54" cy="36" rx="8" ry="5" fill="url(#amber)" stroke="${INK}" stroke-width="1.6"/>
    <ellipse cx="55" cy="36" rx="1.6" ry="4.4" fill="${INK}"/>`,
}

export const CODES = Object.keys(ART) as Code[]

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

/** <symbol> sprites for every code — inject once next to DEFS. */
export const SYMBOL_SPRITES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${CODES.map(
  (c) => `<symbol id="sym-${c}" viewBox="0 0 100 100">${ART[c]}</symbol>`,
).join("")}</defs></svg>`

export interface Slice {
  col: number
  row: number
  n: number
}

export function symbolSvg(code: Code, slice?: Slice): string {
  const vb = slice ? `${(slice.col * 100) / slice.n} ${(slice.row * 100) / slice.n} ${100 / slice.n} ${100 / slice.n}` : "0 0 100 100"
  return `<svg viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true"><use href="#sym-${code}" width="100" height="100"/></svg>`
}
