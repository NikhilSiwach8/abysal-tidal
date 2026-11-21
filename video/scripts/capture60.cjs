// True 60 fps gameplay capture of the built game (frontend/dist served on :4173).
//
// Headless Chromium cannot render a heavy page at 60 fps in real time, so the page runs in
// slow motion (RATE): the animation timeline via the DevTools protocol, the game's timers and
// clocks via an injected time warp, and <video> loops via playbackRate. Timestamped screencast
// frames are mapped back to game time and written at exactly 60 fps of game time to ffmpeg.
//
//   node scripts/capture60.cjs <clip> [outDir]      clips: startup, tumbles, tease, bonus, wheel
const { chromium } = require("playwright")
const { spawn } = require("node:child_process")
const path = require("node:path")

const RATE = 0.125 // page runs at 1/8 speed while capturing
const FPS = 60
const W = 1920, H = 1080
const URL = process.env.GAME_URL || "http://localhost:4173/"
const FFDIR = path.join(__dirname, "..", "node_modules", "@remotion", "compositor-linux-x64-gnu")

// Injected before any page script: warp performance.now / Date / timers / rAF by RATE,
// and slow every <video> to RATE.
const warp = (R) => {
  const now0 = performance.now.bind(performance)
  const date0 = Date.now
  const real0 = now0()
  const dateBase = date0()
  const warpNow = () => real0 + (now0() - real0) * R
  performance.now = warpNow
  Date.now = () => dateBase + (now0() - real0) * R
  const st = window.setTimeout, si = window.setInterval, raf = window.requestAnimationFrame
  window.setTimeout = (fn, ms = 0, ...a) => st(fn, ms / R, ...a)
  window.setInterval = (fn, ms = 0, ...a) => si(fn, ms / R, ...a)
  window.requestAnimationFrame = (cb) => raf((ts) => cb(real0 + (ts - real0) * R))
  const slow = (v) => { try { v.defaultPlaybackRate = R; v.playbackRate = R } catch {} }
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...a) { slow(this); return play.apply(this, a) }
  document.addEventListener("loadedmetadata", (e) => e.target instanceof HTMLMediaElement && slow(e.target), true)
  document.addEventListener("playing", (e) => e.target instanceof HTMLMediaElement && slow(e.target), true)
}

const skipIntro = () => { try { localStorage.setItem("abyssal-tide:skip-intro", "1") } catch {} }
const ready = (p) => p.waitForFunction(() => !document.querySelector("#loader") && !document.querySelector(".vs") && !document.querySelector(".intro"), null, { timeout: 120000 })
const idle = (p) => p.waitForFunction(() => !document.querySelector(".spin-btn")?.classList.contains("busy"), null, { timeout: 900000 })
const game = (ms) => new Promise((r) => setTimeout(r, ms / RATE)) // wait `ms` of game time

// Each clip: [query, skip intro?, start capture before load?, scenario(page) -> runs while recording]
const CLIPS = {
  startup: ["", false, true, async (p) => {
    await p.waitForSelector(".intro", { timeout: 300000 }); await game(2600)
    await p.keyboard.press("Space"); await p.waitForSelector(".vs", { timeout: 60000 })
    await p.waitForSelector(".vs", { state: "detached", timeout: 300000 }); await game(1500)
  }],
  tumbles: ["?demoBook=5907", true, false, async (p) => { await game(400); await p.click(".spin-btn"); await game(500); await idle(p); await game(1200) }],
  tease: ["?demoBook=50727", true, false, async (p) => { await game(400); await p.click(".spin-btn"); await game(500); await idle(p); await game(1200) }],
  bonus: ["?demoBook=2", true, false, async (p) => { await game(400); await p.click(".spin-btn"); await game(16500) }],
  wheel: ["?demoBook=12", true, false, async (p) => {
    await game(400); await p.click(".buy-badge"); await game(900)
    await p.click("[data-buy=mystery]"); await game(700); await p.click("[data-yes]")
    await p.waitForSelector(".wheel-ov.armed", { timeout: 60000 }); await game(1400)
    await p.click(".wheel-spin"); await p.waitForSelector(".wheel-ov", { state: "detached", timeout: 300000 }); await game(4500)
  }],
}

async function capture(name, outDir) {
  const [query, skip, early, scenario] = CLIPS[name]
  const out = path.join(outDir, `${name}_60fps.mp4`)
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.addInitScript(warp, RATE)
  if (skip) await p.addInitScript(skipIntro)
  const cdp = await ctx.newCDPSession(p)
  await cdp.send("Animation.enable")
  // a navigation creates a new document timeline: slow it again before anything paints
  await cdp.send("Runtime.enable")
  cdp.on("Runtime.executionContextCreated", () => { cdp.send("Animation.setPlaybackRate", { playbackRate: RATE }).catch(() => {}) })

  const ff = spawn(path.join(FFDIR, "ffmpeg"), ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", out],
    { env: { ...process.env, LD_LIBRARY_PATH: FFDIR }, stdio: ["pipe", "inherit", "inherit"] })
  const ffDone = new Promise((r) => ff.on("close", r))

  let t0 = null, tick = 0, last = null, written = 0, recording = false
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
    if (!recording) return
    const buf = Buffer.from(data, "base64")
    if (t0 === null) t0 = metadata.timestamp
    const gameT = (metadata.timestamp - t0) * RATE
    while (last && tick / FPS < gameT) { ff.stdin.write(last); tick++; written++ }
    last = buf
  })
  const start = async () => {
    await cdp.send("Animation.setPlaybackRate", { playbackRate: RATE })
    recording = true
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  }
  if (early) await start()
  await p.goto(URL + query)
  if (!early) { await ready(p); await start() }
  await cdp.send("Animation.setPlaybackRate", { playbackRate: RATE }) // re-apply after navigation
  const real0 = Date.now()
  await scenario(p)
  recording = false
  await cdp.send("Page.stopScreencast")
  if (last) { ff.stdin.write(last); written++ }
  ff.stdin.end(); await ffDone
  await b.close()
  console.log(`${name}: ${written} frames = ${(written / FPS).toFixed(2)} s at ${FPS} fps (captured over ${((Date.now() - real0) / 1000).toFixed(0)} s real) -> ${out}`)
}

const [name, outDir = path.join(__dirname, "..", "out", "clips")] = process.argv.slice(2)
require("node:fs").mkdirSync(outDir, { recursive: true })
const names = name === "all" || !name ? Object.keys(CLIPS) : name.split(",")
;(async () => { for (const n of names) await capture(n, outDir) })().catch((e) => { console.error(e); process.exit(1) })
