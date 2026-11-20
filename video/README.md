# Abyssal Tide — idle loops (Remotion)

Seamless 5-second loops (asset prompts §9.2) rendered from the game's own rigged art
layers, so the motion matches the in-game idles exactly.

| Composition | Output | Notes |
| --- | --- | --- |
| `HeroIdle` | `out/HeroIdle.webm` (VP9 + alpha, 1024×1536) | breathing, scarf/coat swing, eye pulse, bubbles |
| `LeviathanIdle` | `out/LeviathanIdle.webm` (VP9 + alpha, 972×1620) | breathing, head bob, gill pulse, bubbles from the jaw |
| `BackgroundLoop` | `out/BackgroundLoop.mp4` / `.webm` (1920×1080) | light shafts, parallax, kelp, fog, bubbles, flakes |
| `LogoShimmer` | `out/LogoShimmer.webm` (VP9 + alpha, 1280×640) | teal light sweep, ink droplets |
| `WheelHubIdle` | `out/WheelHubIdle.webm` (VP9 + alpha, 640×640, 5 s) | Depth Wheel hub: chest rocks, seam glow pulses with rising sparks, ink question mark drifts like smoke |
| `WheelGlowLoop` | `out/WheelGlowLoop.webm` (VP9 + alpha, 10 s; render with `--scale=0.75 --crf=48` → 768×768, 2.5 MB) | ring sways, strokes flow, bloom breathes, droplets orbit once per loop |
| `*Preview` | `out/*_preview.mp4` | the transparent loops over a dark backdrop, for sharing |

```bash
npm ci
npm run assets     # copies layers from ../frontend/src/assets (re-run after tools/rig_characters.py)
npm run render     # renders everything into out/
npm run studio     # live preview
```

Every motion is a whole number of sine periods (or full orbits) per loop, so the last frame flows into frame 0.
The wheel loops animate parts of one flat painting through feathered masked copies and an SVG
displacement whose noise travels a full circle per loop; `useSvgImage` holds the render until
SVG `<image>` art has decoded (Remotion only waits for `<Img>`).
A tiny constant rotation keeps every frame on the same raster path (an exactly-zero
transform at frame 0 renders crisper than its neighbours and pops once per loop).

VP9 alpha plays in Chrome, Edge and Firefox. Safari needs HEVC-with-alpha instead.
Remotion is pinned to 4.0.540. Rendering uses Playwright's headless Chromium when present
(`REMOTION_BROWSER` overrides).
