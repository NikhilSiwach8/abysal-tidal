# Abyssal Tide — idle loops (Remotion)

Seamless 5-second loops (asset prompts §9.2) rendered from the game's own rigged art
layers, so the motion matches the in-game idles exactly.

| Composition | Output | Notes |
| --- | --- | --- |
| `HeroIdle` | `out/HeroIdle.webm` (VP9 + alpha, 1024×1536) | breathing, scarf/coat swing, eye pulse, bubbles |
| `LeviathanIdle` | `out/LeviathanIdle.webm` (VP9 + alpha, 972×1620) | breathing, head bob, gill pulse, bubbles from the jaw |
| `BackgroundLoop` | `out/BackgroundLoop.mp4` / `.webm` (1920×1080) | light shafts, parallax, kelp, fog, bubbles, flakes |
| `LogoShimmer` | `out/LogoShimmer.webm` (VP9 + alpha, 1280×640) | teal light sweep, ink droplets |
| `*Preview` | `out/*_preview.mp4` | the transparent loops over a dark backdrop, for sharing |

```bash
npm ci
npm run assets     # copies layers from ../frontend/src/assets (re-run after tools/rig_characters.py)
npm run render     # renders everything into out/
npm run studio     # live preview
```

Every motion is a whole number of sine periods per loop, so frame 150 equals frame 0.
A tiny constant rotation keeps every frame on the same raster path (an exactly-zero
transform at frame 0 renders crisper than its neighbours and pops once per loop).

VP9 alpha plays in Chrome, Edge and Firefox. Safari needs HEVC-with-alpha instead.
Remotion is pinned to 4.0.540. Rendering uses Playwright's headless Chromium when present
(`REMOTION_BROWSER` overrides).
