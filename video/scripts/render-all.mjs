// Render every loop: transparent VP9 WebM (for the game) + H.264 MP4 preview (for sharing).
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"

const shell = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"
const browser = process.env.REMOTION_BROWSER ?? (existsSync(shell) ? shell : undefined)
const base = ["remotion", "render", "src/index.ts", "--log=error", "--overwrite", ...(browser ? [`--browser-executable=${browser}`] : [])]
const run = (args) => execFileSync("npx", [...base, ...args], { stdio: "inherit" })

const transparent = ["HeroIdle", "LeviathanIdle", "LogoShimmer", "WheelHubIdle", "WheelGlowLoop"]
// the soft back glow compresses hard and displays at about 660 px
const extra = { WheelGlowLoop: ["--scale=0.75", "--crf=48"] }
for (const id of transparent) {
  run([id, `out/${id}.webm`, "--codec=vp9", "--pixel-format=yuva420p", "--image-format=png", ...(extra[id] ?? ["--crf=18"])])
  run([`${id}Preview`, `out/${id}_preview.mp4`, "--codec=h264", "--crf=17"])
}
run(["BackgroundLoop", "out/BackgroundLoop.mp4", "--codec=h264", "--crf=17"])
run(["BackgroundLoop", "out/BackgroundLoop.webm", "--codec=vp9", "--crf=24"])
console.log("rendered all loops to out/")
