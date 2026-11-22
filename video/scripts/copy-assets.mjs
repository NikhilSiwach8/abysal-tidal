// Copy the game's art layers into public/ so compositions load them with staticFile().
import { cpSync, mkdirSync, readdirSync } from "node:fs"
const A = "../frontend/src/assets"
const pick = [
  ["chars/hero_body.webp", "hero_body.webp"], ["chars/hero_scarf.webp", "hero_scarf.webp"],
  ["chars/hero_coat.webp", "hero_coat.webp"], ["chars/hero_eyes.webp", "hero_eyes.webp"],
  ["chars/lev_body.webp", "lev_body.webp"], ["chars/lev_head.webp", "lev_head.webp"], ["chars/lev_gills.webp", "lev_gills.webp"],
  ["bg/bg_layer_far_fog.webp", "bg_far.webp"], ["bg/bg_layer_mid_stacks_ship.webp", "bg_mid.webp"],
  ["bg/bg_layer_front_kelp.webp", "bg_front.webp"],
]
mkdirSync("public/fx", { recursive: true })
for (const [src, dst] of pick) cpSync(`${A}/${src}`, `public/${dst}`)
// full-resolution logo (the game copy is downscaled)
cpSync("../art/generated/lettering/logo_abyssal_tide.png", "public/logo_full.png")
// logo split into its swash and lettering layers (tools/split_logo.py)
cpSync("../art/generated/lettering/logo_layer_swash.png", "public/logo_swash.png")
cpSync("../art/generated/lettering/logo_layer_letters.png", "public/logo_letters.png")
// title font + the water slash for TitleHunt
cpSync("../frontend/node_modules/@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2", "public/permanent-marker.woff2")
cpSync("../art/generated/effects/water_slash.png", "public/water_slash.png")
// Depth Wheel art at full resolution
cpSync("../art/generated/ui/wheel/wheel_hub.png", "public/wheel_hub.png")
cpSync("../art/generated/ui/wheel/wheel_glow.png", "public/wheel_glow.png")
for (const f of readdirSync(`${A}/fx`)) if (/^(bubble|flake)_/.test(f)) cpSync(`${A}/fx/${f}`, `public/fx/${f}`)
console.log("assets copied")
