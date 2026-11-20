/**
 * Abyssal Tide — small inline UI pieces that stay vector: the paper-grain noise
 * texture and the line icons on the round control buttons. All illustrated art
 * (symbols, characters, logo, UI panels, effects) is bundled from src/assets
 * (see tools/prepare_game_assets.py).
 */

/** Paper-grain noise texture for the CSS variable --noise. */
export const NOISE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .09  0 0 0 0 .1  0 0 0 0 .11  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
)}")`

export const icon = (inner: string, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`

export const UI_ICONS = {
  menu: `<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  spin: `<path d="M20 12a8 8 0 1 1 -2.4 -5.7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  auto: `<path d="M5 12a7 7 0 0 1 12-5M19 12a7 7 0 0 1-12 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M17 3v4h-4M7 21v-4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  turbo: `<path d="M13 2 L5 13h6l-1 9 8-11h-6z" fill="currentColor"/>`,
  plus: `<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  minus: `<path d="M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  sound: `<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  mute: `<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
}
