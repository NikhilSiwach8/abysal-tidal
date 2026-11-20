/**
 * Abyssal Tide — all art as inline SVG strings (original ink-wash illustration).
 * Shared <defs> (filters, gradients, patterns) are injected once into the document;
 * every other SVG references them by id.
 */

export const DEFS = `
<svg id="at-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
<defs>
  <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="rough-big" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="8" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wash" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="12" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.8" result="b"/>
    <feComponentTransfer in="b"><feFuncA type="linear" slope="0.85"/></feComponentTransfer>
  </filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="blur10" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>
  <filter id="blur24" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
  <filter id="glow-teal" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="b"/>
    <feFlood flood-color="#5fe3d2" flood-opacity="0.9"/>
    <feComposite in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>

  <linearGradient id="pan-coral" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f07a5f"/><stop offset=".55" stop-color="#e8553e"/><stop offset="1" stop-color="#8f2a1d"/></linearGradient>
  <linearGradient id="pan-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fe3d2"/><stop offset=".5" stop-color="#2bb3a3"/><stop offset="1" stop-color="#0f4f49"/></linearGradient>
  <linearGradient id="pan-navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5f86"/><stop offset=".55" stop-color="#22395a"/><stop offset="1" stop-color="#0d1828"/></linearGradient>
  <linearGradient id="pan-purple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c49bff"/><stop offset=".5" stop-color="#a26ff0"/><stop offset="1" stop-color="#3b1f6e"/></linearGradient>
  <linearGradient id="pan-abyss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3f4a"/><stop offset=".6" stop-color="#13212a"/><stop offset="1" stop-color="#05090c"/></linearGradient>
  <linearGradient id="hp-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a5f"/><stop offset=".5" stop-color="#e8553e"/><stop offset="1" stop-color="#9c2716"/></linearGradient>
  <radialGradient id="parch" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ecede4"/><stop offset=".7" stop-color="#dcdfd7"/><stop offset="1" stop-color="#b9bfb5"/></radialGradient>
  <radialGradient id="pearl-g" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e9eef0"/><stop offset="1" stop-color="#9fb1b8"/></radialGradient>
  <radialGradient id="amber" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#ffd36b"/><stop offset="1" stop-color="#b8650f"/></radialGradient>
  <linearGradient id="gold-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#ffd36b"/><stop offset="1" stop-color="#b37a12"/></linearGradient>
  <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa7ad"/><stop offset=".45" stop-color="#6f7f87"/><stop offset="1" stop-color="#2f3b41"/></linearGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f5f2" stop-opacity=".55"/><stop offset="1" stop-color="#f3f5f2" stop-opacity="0"/></linearGradient>
  <linearGradient id="fgfog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9cec6" stop-opacity="0"/><stop offset="1" stop-color="#c9cec6" stop-opacity=".55"/></linearGradient>

  <pattern id="scales" width="14" height="10" patternUnits="userSpaceOnUse">
    <path d="M0 10 Q7 0 14 10" fill="none" stroke="#171b1d" stroke-width="1.3" opacity=".55"/>
    <path d="M-7 5 Q0 -5 7 5 M7 5 Q14 -5 21 5" fill="none" stroke="#171b1d" stroke-width="1.1" opacity=".35"/>
  </pattern>
  <pattern id="plates" width="40" height="12" patternUnits="userSpaceOnUse">
    <path d="M0 11 H40" stroke="#171b1d" stroke-width="2" opacity=".5"/>
    <path d="M6 4 H34" stroke="#f3f5f2" stroke-width="1.2" opacity=".18"/>
  </pattern>
</defs>
</svg>`

/** Paper-grain noise texture for the CSS variable --noise. */
export const NOISE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .09  0 0 0 0 .1  0 0 0 0 .11  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
)}")`

// ---------------------------------------------------------------- scene
const kelp = (x: number, h: number, i: number) =>
  `<path class="kelp" style="animation-delay:-${(i * 1.7).toFixed(1)}s;transform-origin:${x}px 900px" d="M${x} 900 C ${x - 18} ${900 - h * 0.3}, ${x + 22} ${900 - h * 0.55}, ${x - 6} ${900 - h * 0.8} S ${x + 10} ${900 - h}, ${x + 2} ${900 - h - 10}" fill="none" stroke="#1f2a2b" stroke-width="${6 + (i % 3) * 2}" stroke-linecap="round" opacity=".75" filter="url(#rough)"/>
   <path class="kelp" style="animation-delay:-${(i * 1.7).toFixed(1)}s;transform-origin:${x}px 900px" d="M${x - 2} ${900 - h * 0.4} q -18 -8 -26 -26 M${x + 4} ${900 - h * 0.62} q 20 -6 26 -24" fill="none" stroke="#1f2a2b" stroke-width="3" opacity=".6"/>`

const bubbles = Array.from({ length: 10 }, (_, i) => {
  const x = 120 + ((i * 157) % 1380)
  const r = 4 + (i % 4) * 3
  return `<circle class="bubble" style="animation-delay:-${(i * 1.2).toFixed(1)}s" cx="${x}" cy="900" r="${r}" fill="none" stroke="#f3f5f2" stroke-width="1.6" opacity=".55"/>`
}).join("")

export const SCENE_SVG = `
<svg class="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="1600" height="900" fill="url(#fog)"/>
  <g class="rays" opacity=".55">
    <path d="M520 0 L640 0 L420 900 L250 900 Z" fill="url(#ray)" filter="url(#blur10)"/>
    <path d="M820 0 L880 0 L760 900 L640 900 Z" fill="url(#ray)" filter="url(#blur10)" opacity=".7"/>
    <path d="M1080 0 L1180 0 L1240 900 L1060 900 Z" fill="url(#ray)" filter="url(#blur10)" opacity=".6"/>
  </g>
  <g fill="#4d5a60" opacity=".55" filter="url(#rough-big)">
    <path d="M60 900 L90 520 L140 470 L170 360 L230 330 L260 420 L300 900 Z"/>
    <path d="M1310 900 L1340 560 L1380 500 L1400 410 L1450 380 L1500 470 L1530 900 Z"/>
  </g>
  <g fill="none" stroke="#3a4549" stroke-width="7" opacity=".6" filter="url(#rough)">
    <path d="M1180 900 L1210 420" /><path d="M1150 520 L1270 500" /><path d="M1165 610 L1255 596"/>
    <path d="M1210 420 L1120 640 M1210 430 L1300 650" stroke-width="2.5"/>
  </g>
  <path d="M0 790 C 260 760, 420 820, 700 800 S 1200 760, 1600 800 L1600 900 L0 900 Z" fill="#2a3337" filter="url(#rough-big)"/>
  ${[90, 210, 340, 1240, 1370, 1500].map((x, i) => kelp(x, 260 + (i % 3) * 70, i)).join("")}
  <g class="bubbles">${bubbles}</g>
  <rect y="620" width="1600" height="280" fill="url(#fgfog)"/>
</svg>`

// ---------------------------------------------------------------- characters
export const HERO_SVG = `
<svg class="char-svg" viewBox="0 0 320 660" aria-hidden="true">
  <ellipse cx="160" cy="640" rx="120" ry="14" fill="#171b1d" opacity=".35" filter="url(#blur3)"/>
  <g filter="url(#rough)" stroke="#171b1d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <!-- flowing hood cloth behind -->
    <path d="M120 120 C 60 180, 40 300, 18 420 C 50 400, 70 410, 92 380 C 80 300, 100 220, 140 170 Z" fill="#2a3134"/>
    <!-- legs & boots -->
    <path d="M128 440 L112 600 L84 616 L138 622 L150 452 Z" fill="#222a2d"/>
    <path d="M182 440 L196 600 L232 618 L176 622 L164 452 Z" fill="#222a2d"/>
    <!-- coat -->
    <path d="M104 210 C 90 300, 92 380, 98 470 L 222 470 C 228 380, 226 300, 214 210 C 190 196, 128 196, 104 210 Z" fill="#33393b"/>
    <!-- lighter coat panel with folds -->
    <path d="M150 220 C 146 300, 146 390, 150 468 L 206 468 C 210 380, 206 300, 196 222 Z" fill="#5d6466"/>
    <path d="M164 260 C 162 330, 164 400, 168 460 M182 250 C 184 320, 186 400, 190 462 M140 300 C 132 360, 128 420, 126 466" fill="none" stroke-width="2"/>
    <!-- teal sash -->
    <path d="M100 330 C 140 346, 190 340, 226 322 L 228 348 C 190 366, 140 370, 100 356 Z" fill="#2bb3a3"/>
    <path d="M200 350 C 210 380, 206 410, 214 440 L 198 444 C 190 414, 188 384, 186 356 Z" fill="#2bb3a3"/>
    <!-- arms gripping harpoon -->
    <path d="M206 236 C 236 260, 250 290, 262 318 L 244 330 C 230 306, 214 282, 196 266 Z" fill="#33393b"/>
    <path d="M110 240 C 120 300, 150 330, 190 336 L 192 312 C 160 306, 138 282, 130 240 Z" fill="#33393b"/>
    <!-- shoulder plate -->
    <path d="M186 206 C 214 196, 238 210, 244 236 C 224 230, 204 232, 190 240 Z" fill="#6c7476"/>
    <path d="M196 214 C 214 210, 228 216, 236 230" fill="none" stroke-width="2"/>
    <!-- teal scarf -->
    <path d="M118 182 C 150 200, 186 200, 214 180 L 220 206 C 186 226, 146 226, 112 206 Z" fill="#2bb3a3"/>
    <path d="M124 204 C 110 236, 88 262, 60 280 C 82 284, 104 270, 122 250 C 126 236, 132 222, 140 214 Z" fill="#2bb3a3"/>
    <!-- hood -->
    <path d="M118 186 C 100 120, 128 60, 178 56 C 222 58, 238 110, 224 186 C 206 196, 140 198, 118 186 Z" fill="#222a2d"/>
    <path d="M150 170 C 146 130, 162 98, 192 96 C 214 100, 220 136, 212 172 C 196 182, 166 182, 150 170 Z" fill="#0d1112"/>
  </g>
  <!-- glowing eyes -->
  <g filter="url(#glow-teal)"><path d="M178 134 l14 -2 M198 132 l10 0" stroke="#5fe3d2" stroke-width="4" stroke-linecap="round"/></g>
  <!-- harpoon -->
  <g filter="url(#rough)">
    <path d="M70 520 L 296 96" stroke="#171b1d" stroke-width="9" stroke-linecap="round"/>
    <path d="M74 512 L 292 104" stroke="#9aa4a6" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    <path d="M296 96 L 312 54 L 282 86 Z M 286 112 L 306 110 L 292 96 M 300 82 L 280 76 L 292 92" fill="#c9cec6" stroke="#171b1d" stroke-width="3" stroke-linejoin="round"/>
    <path d="M110 446 L 132 456 M 118 432 L 140 442" stroke="#2bb3a3" stroke-width="4"/>
  </g>
</svg>`

function teeth(): string {
  const out: string[] = []
  for (let i = 0; i < 9; i++) {
    const x = 214 + i * 17
    const top = 300 + i * 4
    out.push(`<path d="M${x} ${top} l7 ${20 - (i % 2) * 6} l7 ${-20 + (i % 2) * 6} Z" fill="#f3f5f2"/>`)
    const by = 368 + i * 6
    out.push(`<path d="M${x + 4} ${by} l7 ${-18 + (i % 2) * 5} l7 ${18 - (i % 2) * 5} Z" fill="#f3f5f2"/>`)
  }
  return out.join("")
}

export const LEVIATHAN_SVG = `
<svg class="char-svg" viewBox="0 0 440 760" aria-hidden="true">
  <ellipse cx="220" cy="740" rx="180" ry="16" fill="#171b1d" opacity=".35" filter="url(#blur3)"/>
  <g filter="url(#rough)" stroke="#171b1d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <!-- coiled body -->
    <path d="M40 740 C 20 640, 120 600, 200 620 C 300 640, 380 600, 380 520 C 380 430, 300 410, 250 440 C 210 464, 200 520, 150 520 C 100 520, 80 460, 120 400 C 160 340, 240 320, 280 280 L 340 300 C 320 360, 230 380, 196 430 C 176 460, 186 480, 210 470 C 250 450, 280 380, 350 380 C 430 390, 440 540, 400 620 C 360 700, 250 690, 190 680 C 140 672, 100 700, 110 740 Z" fill="#2d3a3f"/>
    <path d="M40 740 C 20 640, 120 600, 200 620 C 300 640, 380 600, 380 520 C 380 430, 300 410, 250 440 C 210 464, 200 520, 150 520 C 100 520, 80 460, 120 400 C 160 340, 240 320, 280 280 L 340 300 C 320 360, 230 380, 196 430 C 176 460, 186 480, 210 470 C 250 450, 280 380, 350 380 C 430 390, 440 540, 400 620 C 360 700, 250 690, 190 680 C 140 672, 100 700, 110 740 Z" fill="url(#scales)" stroke="none"/>
    <!-- belly plates -->
    <path d="M80 720 C 90 660, 150 650, 200 656 C 260 664, 340 650, 370 600 L 390 610 C 360 680, 270 690, 200 680 C 150 676, 108 690, 100 726 Z" fill="#8a8f84"/>
    <path d="M80 720 C 90 660, 150 650, 200 656 C 260 664, 340 650, 370 600 L 390 610 C 360 680, 270 690, 200 680 C 150 676, 108 690, 100 726 Z" fill="url(#plates)" stroke="none"/>
    <!-- dorsal fins -->
    <path d="M300 395 L 330 330 L 350 386 M 360 410 L 400 360 L 396 420 M 396 470 L 436 440 L 414 500 M 160 400 L 150 340 L 190 372" fill="#2bb3a3" opacity=".9"/>
    <!-- neck -->
    <path d="M280 280 C 260 220, 270 160, 300 120 L 360 150 C 340 200, 336 250, 340 300 Z" fill="#2d3a3f"/>
    <path d="M280 280 C 260 220, 270 160, 300 120 L 360 150 C 340 200, 336 250, 340 300 Z" fill="url(#scales)" stroke="none"/>
    <!-- head -->
    <path d="M196 140 C 220 70, 330 40, 400 90 C 430 120, 424 170, 400 196 L 360 214 C 320 220, 250 236, 210 300 L 200 300 C 186 240, 182 180, 196 140 Z" fill="#33454b"/>
    <!-- lower jaw (open) -->
    <path d="M206 360 C 250 380, 330 370, 380 330 L 396 300 C 360 330, 300 344, 214 330 Z" fill="#33454b"/>
    <path d="M210 300 C 260 300, 330 300, 380 280 L 384 320 C 320 346, 260 350, 212 336 Z" fill="#5a1f1a"/>
    <!-- horns -->
    <path d="M330 72 C 350 30, 390 14, 420 20 C 392 34, 372 56, 362 84 Z M 284 74 C 282 30, 300 4, 326 -2 C 312 22, 306 50, 308 80 Z" fill="#c9cec6"/>
    <!-- gills -->
    <path d="M370 200 q 14 20 4 44 M 352 210 q 14 22 4 46 M 334 222 q 12 22 4 44" fill="none" stroke="#2bb3a3" stroke-width="5"/>
  </g>
  <g>${teeth()}</g>
  <!-- amber eye -->
  <g>
    <ellipse cx="300" cy="128" rx="20" ry="13" fill="url(#amber)" stroke="#171b1d" stroke-width="3"/>
    <ellipse cx="302" cy="128" rx="4" ry="11" fill="#171b1d"/>
    <ellipse cx="300" cy="128" rx="26" ry="18" fill="#ffd36b" opacity=".25" filter="url(#blur10)"/>
  </g>
</svg>`

export const LOGO_SVG = `
<svg class="logo-svg" viewBox="0 0 340 160" aria-label="Abyssal Tide" role="img">
  <path d="M14 96 C 70 70, 170 60, 330 66 C 300 96, 210 118, 40 128 C 24 122, 14 110, 14 96 Z" fill="#2bb3a3" filter="url(#rough-big)" opacity=".95"/>
  <path d="M30 120 C 120 112, 230 104, 310 86" stroke="#171b1d" stroke-width="3" fill="none" opacity=".5" filter="url(#rough)"/>
  <text x="170" y="62" text-anchor="middle" class="logo-a">ABYSSAL</text>
  <text x="182" y="124" text-anchor="middle" class="logo-b">TIDE</text>
</svg>`

/** 24x24 power-up icons, index-aligned with the damage ladder. */
export const POWER_ICONS: string[] = [
  // symbolsToWild: swirl
  `<path d="M12 4a8 8 0 1 0 8 8a5 5 0 1 0 -5 5a2.5 2.5 0 1 0 -2.5 -2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  // wildBlock: 2x2
  `<rect x="4" y="4" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor"/>`,
  // lowSymbolsToWild: shell -> swirl
  `<path d="M4 18 Q12 2 20 18 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6 V18 M8 10 L9.5 18 M16 10 L14.5 18" stroke="currentColor" stroke-width="1.6"/>`,
  // symbolBlock: 3x3
  `<path d="M4 4h16v16H4z M9.3 4v16 M14.7 4v16 M4 9.3h16 M4 14.7h16" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  // dualSymbolsToWild: two swirls
  `<path d="M8 4a5 5 0 1 0 5 5a3 3 0 1 0 -3 3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 11a5 5 0 1 0 5 5a3 3 0 1 0 -3 3" fill="none" stroke="currentColor" stroke-width="2"/>`,
  // highSymbolBlock: trident in box
  `<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 20V7 M7 7v4h10V7 M12 4v3" fill="none" stroke="currentColor" stroke-width="2"/>`,
  // dualLowSymbolsToWild: two shells
  `<path d="M2 17 Q7 6 12 17 Z M12 17 Q17 6 22 17 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  // bossSlain: skull/crossed harpoons
  `<path d="M4 20 L20 4 M4 4 L20 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="currentColor"/>`,
]

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
