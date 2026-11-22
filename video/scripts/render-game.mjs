// Render the loops the game ships (60 fps) straight into ../frontend/src/assets/video/.
// Scales match the on-screen size (2x density) so files stay small; transparent loops are VP9 + alpha.
import { execFileSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"

const shell = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"
const browser = process.env.REMOTION_BROWSER ?? (existsSync(shell) ? shell : undefined)
const base = ["remotion", "render", "src/index.ts", "--log=error", "--overwrite", ...(browser ? [`--browser-executable=${browser}`] : [])]
const OUT = "../frontend/src/assets/video"
const alpha = ["--codec=vp9", "--pixel-format=yuva420p", "--image-format=png"]

const jobs = [
  ["HeroIdle", "hero_idle.webm", [...alpha, "--scale=0.75", "--crf=32"]],
  ["LeviathanIdle", "lev_idle.webm", [...alpha, "--scale=0.5", "--crf=32"]],
  ["LogoIdle", "logo.webm", [...alpha, "--scale=0.5", "--crf=32"]],
  ["LogoReveal", "logo_reveal.webm", [...alpha, "--crf=34"]],
  ["TitleHunt", "title_hunt.webm", [...alpha, "--crf=34"]],
  ["WheelHubIdle", "wheel_hub.webm", [...alpha, "--crf=32"]],
  ["WheelGlowLoop", "wheel_glow.webm", [...alpha, "--scale=0.75", "--crf=50"]],
  ["BackgroundLoop", "bg.webm", ["--codec=vp9", "--scale=0.75", "--crf=34"]],
  ["BackgroundLoop", "bg.mp4", ["--codec=h264", "--scale=0.75", "--crf=26"]],
]
const only = process.argv[2]?.split(",")
for (const [id, file, args] of jobs) {
  if (only && !only.includes(file)) continue
  const t0 = Date.now()
  execFileSync("npx", [...base, id, `${OUT}/${file}`, ...args], { stdio: "inherit" })
  console.log(`${file}: ${(statSync(`${OUT}/${file}`).size / 1e6).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}
