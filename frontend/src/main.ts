import "@fontsource/permanent-marker/latin-400.css"
import "@fontsource/lilita-one/latin-400.css"
import "@fontsource/outfit/latin-400.css"
import "@fontsource/outfit/latin-600.css"
import "@fontsource/outfit/latin-800.css"
import "./style.css"

import { NOISE_URL, UI_ICONS, icon } from "./art"
import { allAssetUrls, asset, assetsMatching, preloadTracked, titleImage } from "./assets"
import { setLeviathanLoopPaused, startLoops, attachWheelLoops } from "./loops"
import bgFar from "./assets/bg/bg_layer_far_fog.webp"
import bgMid from "./assets/bg/bg_layer_mid_stacks_ship.webp"
import bgFront from "./assets/bg/bg_layer_front_kelp.webp"
import bgPortrait from "./assets/bg/bg_portrait.webp"
import heroVictory from "./assets/chars/hero_victory.webp"
import { SYMBOL_NAMES, symbolSvg, type Code } from "./symbols"
import { sfx } from "./audio"
import { isSocial, setSocial, t, translateTree } from "./text"
import {
  API, MODE_COST, ReplayNotFound, createProvider, fetchReplay, isReplay, money,
  type BookEvent, type PlayedRound, type Provider,
} from "./rgs"

// ================================================================ constants
const N = 6
const BOSS_HP = 200
const STEP = 25
const FREE_SPINS = 10
const WINCAP = 100_000
const TIER: Record<string, { name: string; start: number }> = {
  B: { name: "Riptide", start: 1 },
  S: { name: "Undertow", start: 2 },
  U: { name: "Maelstrom", start: 4 },
  H: { name: "Abyssal", start: 8 },
}
const POWER_NAMES: Record<string, string> = {
  symbolsToWild: "Tidal Turn",
  wildBlock: "Whirlpool Block",
  lowSymbolsToWild: "Shallows Surge",
  symbolBlock: "Shoal Block",
  dualSymbolsToWild: "Twin Currents",
  highSymbolBlock: "Treasure Block",
  dualLowSymbolsToWild: "Twin Shallows",
  bossSlain: "Leviathan Rises",
}
const LADDER = Object.keys(POWER_NAMES)
const BIG_WINS: [number, string][] = [
  [5000, "LEGENDARY CATCH"],
  [1000, "ABYSSAL WIN"],
  [200, "TIDAL WAVE"],
  [100, "MEGA WIN"],
  [20, "BIG WIN"],
]
const PAYTABLE: Record<string, number[]> = {
  H5: [1, 2.5, 5, 50], H4: [0.5, 1, 3.8, 35], H3: [0.3, 0.8, 3, 30], H2: [0.3, 0.6, 2.2, 20], H1: [0.2, 0.5, 1.5, 10],
  L5: [0.2, 0.4, 1.2, 7.5], L4: [0.2, 0.3, 1, 6], L3: [0.1, 0.3, 1, 6], L2: [0.1, 0.2, 0.8, 5], L1: [0.1, 0.2, 0.7, 5],
}
const MODES = [
  { id: "base", name: "Base game", buys: "One spin", vol: 0 },
  { id: "hunt", name: "Leviathan Hunt", buys: "Every bonus 10× as likely (ante, every spin)", vol: 55 },
  { id: "deep_hunt", name: "Trench Hunt", buys: "Maelstrom and Abyssal 150× as likely (ante, every spin)", vol: 78 },
  { id: "bonus", name: "Riptide", buys: "10 free spins, spots start at 1×", vol: 45 },
  { id: "super", name: "Undertow", buys: "10 free spins, spots start at 2×", vol: 62 },
  { id: "ultra", name: "Maelstrom", buys: "10 free spins, spots start at 4×; 6.66% upgrade to Abyssal (8×)", vol: 80 },
  { id: "mystery", name: "Mystery Depths", buys: "60% nothing / 25% Undertow / 10% Maelstrom / 5% Abyssal", vol: 70 },
  { id: "mystery_deep", name: "Abyssal Mystery", buys: "60% nothing / 30% Undertow / 10% Abyssal", vol: 85 },
]

// ================================================================ state
const params = new URLSearchParams(location.search)
const st = {
  provider: null as Provider | null,
  replay: isReplay(),
  balance: 0,
  currency: params.get("currency") ?? "USD",
  levels: [] as number[],
  betIdx: 0,
  ante: null as null | "hunt" | "deep_hunt",
  busy: false,
  autoLeft: 0,
  turbo: false,
  slam: false,
  jur: {} as Record<string, unknown>,
  board: [] as Code[][],
  spots: [] as number[][],
  mega: null as null | { r0: number; c0: number; n: number },
  damage: 0,
  tier: null as null | string,
  bet: API,
  shownWin: 0, // book units (x100 of bet) for the current round
  spinBase: 0,
  pendingLine: "",
  lastBursts: [] as { reel: number; row: number }[],
  modal: false,
}
const speed = () => (st.slam ? 0.15 : st.turbo ? 0.45 : 1)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * speed()))
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
const h = (html: string) => {
  const d = document.createElement("div")
  d.innerHTML = html.trim()
  return d.firstElementChild as HTMLElement
}
const fmt = (api: number) => money(api, st.currency)
const bookToApi = (units: number) => (st.bet * units) / 100

// ================================================================ DOM
/**
 * Background: the generated art layers, unchanged, stacked for parallax.
 * Free-spin tiers grade each layer separately (see "tier grading" in style.css):
 * far fog strongest, sea stacks/ship medium, foreground kelp subtle. Symbols, UI
 * and characters sit outside .background-scene and are never graded.
 */
function sceneHtml(): string {
  const bubbleArt = assetsMatching("fx/bubble_")
  const flakeArt = assetsMatching("fx/flake_")
  const bubbles = Array.from({ length: 10 }, (_, i) => {
    const left = 4 + ((i * 37) % 92)
    const size = 10 + (i % 4) * 7
    return `<img class="particle bubble" src="${bubbleArt[i % bubbleArt.length]}" alt="" style="left:${left}%;width:${size}px;animation-delay:-${(i * 1.2).toFixed(1)}s">`
  }).join("")
  const flakes = Array.from({ length: 7 }, (_, i) =>
    `<img class="particle flake" src="${flakeArt[i % flakeArt.length]}" alt="" style="left:${12 + i * 13}%;width:${20 + (i % 3) * 7}px;--rot:${180 + ((i * 47) % 181)}deg;--sway:${14 + (i % 3) * 8}px;animation-delay:-${(i * 1.3).toFixed(1)}s;animation-duration:${6 + (i % 4)}s">`,
  ).join("")
  return `
    <div class="background-scene" aria-hidden="true">
      <div class="bg-layer bg-far" style="background-image:url(${bgFar})"></div>
      <div class="bg-rays"><i></i><i></i><i></i><i></i></div>
      <div class="bg-layer bg-mid" style="background-image:url(${bgMid})"></div>
      <div class="environment-fog"></div>
      <div class="bg-layer bg-front kelp-l" style="background-image:url(${bgFront})"></div>
      <div class="bg-layer bg-front kelp-r" style="background-image:url(${bgFront})"></div>
      <div class="bg-layer bg-portrait" style="background-image:url(${bgPortrait})"></div>
      <div class="particles">${bubbles}${flakes}</div>
    </div>`
}

const TIER_CLASS: Record<string, string> = { B: "tier-riptide", S: "tier-undertow", U: "tier-maelstrom", H: "tier-abyssal" }

function buildDom() {
  document.documentElement.style.setProperty("--noise", NOISE_URL)
  const app = $("#app")
  app.innerHTML = `
    ${sceneHtml()}
    <div class="char hero"><div class="breathe">
      <div class="hero-pose idle rig hero-rig">
        <img class="rig-l" src="${asset("chars/hero_coat")}" alt="" draggable="false" data-part="coat">
        <img class="rig-l" src="${asset("chars/hero_body")}" alt="" draggable="false">
        <img class="rig-l" src="${asset("chars/hero_scarf")}" alt="" draggable="false" data-part="scarf">
        <img class="rig-l" src="${asset("chars/hero_eyes")}" alt="" draggable="false" data-part="eyes">
      </div>
      <img class="hero-pose victory" src="${heroVictory}" alt="" draggable="false">
    </div></div>
    <div class="char leviathan"><div class="breathe"><div class="rig lev-rig">
      <img class="rig-l" src="${asset("chars/lev_body")}" alt="" draggable="false">
      <img class="rig-l" src="${asset("chars/lev_head")}" alt="" draggable="false" data-part="head">
      <img class="rig-l" src="${asset("chars/lev_gills")}" alt="" draggable="false" data-part="gills">
    </div></div></div>
    <div class="logo"><img class="logo-img" src="${asset("lettering/logo")}" alt="Abyssal Tide" draggable="false"><span class="logo-shine" style="--logo:url(${asset("lettering/logo")})"></span><span class="tag" hidden></span></div>
    <main class="stage">
      <section class="boss" aria-label="Leviathan health">
        <div class="boss-head"><span class="tier">BASE GAME</span><span class="tab">LEVIATHAN HP</span><span class="fs"></span></div>
        <div class="hp"><div class="hp-fill" style="background-image:url(${asset("ui/hp_fill")})"></div><div class="hp-ticks"></div><img class="hp-frame" src="${asset("ui/hp_frame")}" alt="" draggable="false"><div class="hp-text">${BOSS_HP} / ${BOSS_HP}</div></div>
        <div class="track"><span class="cap"></span>${LADDER.map(
          (k, i) => `<span class="node${i === 7 ? " final" : ""}" style="--at:${((i + 1) * STEP) / BOSS_HP}" title="${POWER_NAMES[k]} at ${(i + 1) * STEP}"><img src="${asset(`ui/pu/${i + 1}_${k}`)}" alt="" draggable="false"></span>`,
        ).join("")}</div>
      </section>
      <section class="grid" aria-label="Game board" style="--tile-mask:url(${asset("sym/tile")})">
        <div class="grid-bg"></div>
        <div class="layer spots"></div>
        <div class="layer symbols"></div>
        <div class="layer labels"></div>
        <img class="grid-frame" src="${asset("ui/grid_frame")}" alt="" draggable="false">
      </section>
      <div class="banner" aria-live="polite"></div>
      <div class="ante" hidden></div>
    </main>
    <nav class="bar" style="--bar-art:url(${asset("ui/control_bar")})">
      <button class="buy-badge" data-act="buy" style="background-image:url(${asset("ui/buy_badge")})"><span>${t("BUY FEATURE")}</span></button>
      <button class="menu-btn" data-act="info" aria-label="Game info">${icon(UI_ICONS.menu)}</button>
      <div class="read bal"><span class="k">${t("BALANCE")}</span><span class="v">–</span></div>
      <div class="read winr"><span class="k">${t("WIN")}</span><span class="v">–</span></div>
      <div class="read betr"><span class="k">${t("BET")}</span><span class="v">–</span><span class="x" hidden></span></div>
      <div class="pm"><button class="round" data-act="plus" aria-label="Increase bet">${icon(UI_ICONS.plus)}</button><button class="round" data-act="minus" aria-label="Decrease bet">${icon(UI_ICONS.minus)}</button></div>
      <button class="spin-btn" data-act="spin" aria-label="Spin"><img src="${asset("ui/spin")}" alt="" draggable="false"></button>
      <div class="stack"><button class="round" data-act="auto" aria-label="Autoplay">${icon(UI_ICONS.auto)}<span class="left" hidden></span></button><button class="round" data-act="turbo" aria-label="Turbo">${icon(UI_ICONS.turbo)}</button></div>
    </nav>`
  const spots = $(".spots")
  const labels = $(".labels")
  const tileUrl = asset("sym/tile")
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      spots.append(h(`<div class="spot" data-r="${r}" data-c="${c}" style="left:${(r * 100) / N}%;top:${(c * 100) / N}%"><i style="background-image:url(${tileUrl})"></i></div>`))
      labels.append(h(`<div class="lab" data-r="${r}" data-c="${c}" style="left:${(r * 100) / N}%;top:${(c * 100) / N}%"></div>`))
    }
}

// ================================================================ board rendering
const cells: (HTMLElement | null)[][] = Array.from({ length: N }, () => Array(N).fill(null))
const topPct = (row: number) => `${(row * 100) / N}%`

function cellHtml(code: Code, r: number, c: number): string {
  if (code === "H6" && st.mega) {
    const { r0, c0, n } = st.mega
    return symbolSvg("H6", { col: r - r0, row: c - c0, n })
  }
  return symbolSvg(code)
}

function makeCell(code: Code, r: number, c: number, fromRow: number): HTMLElement {
  const el = h(`<div class="cell${code === "H6" ? " mega" : ""}${code === "S" || code === "S2" ? " is-scat" : ""}" style="left:${(r * 100) / N}%;top:${topPct(fromRow)}">${cellHtml(code, r, c)}</div>`)
  el.dataset.code = code
  $(".symbols").append(el)
  return el
}

function placeCell(r: number, c: number, code: Code) {
  cells[r]![c]?.remove()
  cells[r]![c] = makeCell(code, r, c, c)
}

function setSpots(grid: number[][], flash = true) {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = grid[r]![c]!
      const prev = st.spots[r]?.[c]
      const el = $(`.spot[data-r="${r}"][data-c="${c}"]`)
      const lvl = Math.round(Math.log2(Math.max(1, v)))
      el.className = `spot${lvl ? ` l${Math.min(lvl, 6)}` : ""}`
      if (flash && prev !== undefined && prev !== v) {
        void el.offsetWidth
        el.classList.add("flash")
      }
      $(`.lab[data-r="${r}"][data-c="${c}"]`).innerHTML = v > 1 ? `<span class="badge">×${v}</span>` : ""
    }
  st.spots = grid.map((x) => [...x])
}

function resetSpots(start = 1) {
  setSpots(Array.from({ length: N }, () => Array(N).fill(start)), false)
}

// ================================================================ effects
/** One-shot effect sprite centred on a grid cell; `scale` is in cells. Removes itself. */
function fx(key: string, cls: string, at: { reel: number; row: number }, scale: number) {
  const el = h(`<img class="fx ${cls}" src="${asset(key)}" alt="" style="left:${((at.reel + 0.5) * 100) / N}%;top:${((at.row + 0.5) * 100) / N}%;width:calc(var(--cell) * ${scale.toFixed(2)})">`)
  $(".grid").append(el)
  setTimeout(() => el.remove(), 900 * speed())
}

/** Water slash across the Leviathan when it takes damage. */
function slashLeviathan() {
  const lev = $(".leviathan")
  const el = h(`<img class="fx fx-slash" src="${asset("fx/water_slash")}" alt="">`)
  lev.append(el)
  setTimeout(() => el.remove(), 600 * speed())
}

// ================================================================ HUD helpers
function banner(text: string) {
  const b = $(".banner")
  b.innerHTML = text ? `<span>${t(text)}</span>` : ""
  translateTree(b)
}
function fitReadout(el: HTMLElement, text: string) {
  el.textContent = text
  el.classList.toggle("long", text.length > 11)
}
function setWinReadout(units: number) {
  units = Math.min(units, WINCAP * 100) // a round never shows more than the cap
  st.shownWin = units
  fitReadout($(".winr .v"), units > 0 ? fmt(bookToApi(units)) : "–")
}
function setBalance(api: number) {
  st.balance = api
  fitReadout($(".bal .v"), fmt(api))
}
function updateBetReadout() {
  st.bet = st.levels[st.betIdx] ?? API
  $(".betr .v").textContent = fmt(st.bet)
  const x = $(".betr .x")
  const cost = st.ante ? MODE_COST[st.ante]! : 1
  x.hidden = cost <= 1
  x.textContent = `${fmt(st.bet * cost)} / ${t("SPIN")}`
  const ante = $(".ante")
  ante.hidden = !st.ante
  ante.textContent = st.ante === "hunt" ? t("LEVIATHAN HUNT ON · 5× BET") : st.ante === "deep_hunt" ? t("TRENCH HUNT ON · 50× BET") : ""
  $(".buy-badge").classList.toggle("hunting", !!st.ante)
}
function setDamage(d: number, hit = false) {
  st.damage = d
  const left = Math.max(0, BOSS_HP - d)
  // The fill art always spans the frame's channel; damage clips it away from the left,
  // so the bar's edge reaches node i exactly at (i + 1) * STEP damage.
  $(".hp-fill").style.setProperty("--dmg", `${(Math.min(d, BOSS_HP) / BOSS_HP) * 100}%`)
  $(".hp-text").textContent = left === 0 ? "SLAIN" : `${left} / ${BOSS_HP}`
  document.querySelectorAll<HTMLElement>(".node").forEach((n, i) => {
    const lit = d >= (i + 1) * STEP
    if (lit && !n.classList.contains("lit")) n.classList.add("lit")
    if (!lit) n.classList.remove("lit")
  })
  if (hit) {
    const hp = $(".hp")
    hp.classList.remove("shake")
    void hp.offsetWidth
    hp.classList.add("shake")
    const lev = $(".leviathan")
    if (left > 0) slashLeviathan()
    lev.classList.remove("recoil")
    void lev.offsetWidth
    lev.classList.add("recoil")
  }
  $(".leviathan").classList.toggle("slain", left === 0)
  setLeviathanLoopPaused(left === 0)
}
function setTierUi(tier: string | null, fs = 0) {
  st.tier = tier
  if (tier) document.body.dataset.tier = tier
  else delete document.body.dataset.tier
  document.body.classList.remove(...Object.values(TIER_CLASS))
  if (tier) document.body.classList.add(TIER_CLASS[tier]!)
  $(".boss-head .tier").textContent = tier ? TIER[tier]!.name.toUpperCase() : st.ante === "hunt" ? "LEVIATHAN HUNT" : st.ante === "deep_hunt" ? "TRENCH HUNT" : "BASE GAME"
  $(".boss-head .fs").textContent = tier ? `${t("FREE SPINS")} ${fs} / ${FREE_SPINS}` : ""
}
function toast(msg: string, err = false) {
  document.querySelector(".toast")?.remove()
  const el = h(`<div class="toast${err ? " err" : ""}" role="status">${t(msg)}</div>`)
  document.body.append(el)
  setTimeout(() => el.remove(), 2600)
}
function syncButtons() {
  const busy = st.busy
  const j = st.jur
  document.querySelectorAll<HTMLButtonElement>('[data-act="plus"],[data-act="minus"],[data-act="buy"]').forEach((b) => (b.disabled = busy || st.autoLeft > 0))
  if (j.disabledBuyFeature) $(".buy-badge").hidden = true
  const auto = $<HTMLButtonElement>('[data-act="auto"]')
  auto.hidden = !!j.disabledAutoplay
  auto.classList.toggle("on", st.autoLeft > 0)
  const left = $(".left", auto)
  left.hidden = st.autoLeft <= 0
  left.textContent = String(st.autoLeft)
  const turbo = $<HTMLButtonElement>('[data-act="turbo"]')
  turbo.hidden = !!j.disabledTurbo
  turbo.classList.toggle("on", st.turbo)
  const spin = $<HTMLButtonElement>('[data-act="spin"]')
  spin.classList.toggle("busy", busy)
  spin.disabled = busy && (!!j.disabledSlamstop || st.slam) && st.autoLeft <= 0
  $<HTMLButtonElement>('[data-act="plus"]').disabled ||= st.betIdx >= st.levels.length - 1
  $<HTMLButtonElement>('[data-act="minus"]').disabled ||= st.betIdx <= 0
  document.documentElement.style.setProperty("--spd", String(speed()))
}

// ================================================================ overlays
function overlay(html: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const el = h(`<div class="overlay" role="dialog"><img class="ov-backdrop" src="${asset("fx/overlay_backdrop")}" alt=""><div class="card">${html}<div class="hint">${t("Tap to continue")}</div></div></div>`)
    translateTree(el)
    document.body.append(el)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.remove()
      resolve()
    }
    el.addEventListener("pointerdown", finish)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        finish()
        removeEventListener("keydown", onKey, true)
      }
    }
    addEventListener("keydown", onKey, true)
    setTimeout(finish, ms * speed())
  })
}

/**
 * Overlay heading: the painted title when one exists. Social-casino sessions use the
 * translated text instead, because several titles contain restricted words ("WIN").
 */
function heading(text: string): string {
  const img = isSocial() ? null : titleImage(text)
  return img ? `<h1 class="title-img"><img src="${img}" alt="${text}" draggable="false"></h1>` : `<h1>${t(text)}</h1>`
}

// ================================================================ depth wheel (mystery buys)
/**
 * Slices of the Depth Wheel, clockwise from the pointer. Sizes are the real odds of
 * each outcome in that mode's published weights (60% no bonus, the rest by tier), so
 * the wheel shows exactly what the book decided. "" is the no-bonus outcome.
 */
const WHEEL: Record<string, [string, number][]> = {
  mystery: [["", 20], ["S", 25], ["", 20], ["U", 10], ["", 20], ["H", 5]],
  mystery_deep: [["", 30], ["S", 30], ["", 30], ["H", 10]],
}
const WHEEL_FILL: Record<string, string> = { "": "#262e31", S: "#e9ad2c", U: "#2bb3a3", H: "#8a47d6" }
const WHEEL_SPIN_MS = 4600

const WHEEL_ART: Record<string, string> = { "": "still", S: "undertow", U: "maelstrom", H: "abyssal" }
/** Wheel geometry in SVG units (viewBox -100..100), fitted to the painted rim. */
const WHEEL_R = 78 // slices tuck under the rim, whose inner edge is at r 74.7
const RIM_SCALE = 0.1623 // rim art: 1254 px, centre (625, 622), inner edge 460 px, knots 610 px

function wheelSvg(slices: [string, number][]): string {
  const xy = (a: number, r: number) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)] as const
  const pt = (a: number, r: number) => xy(a, r).map((v) => v.toFixed(2)).join(",")
  const chord = (deg: number, r: number) => 2 * r * Math.sin((Math.min(deg, 120) * Math.PI) / 360)
  const keys = [...new Set(slices.map(([k]) => k))]
  const R = WHEEL_R
  const defs = keys.map((k) => `<pattern id="wash-${WHEEL_ART[k]}" patternUnits="userSpaceOnUse" x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}"><image href="${asset(`ui/wheel/wash_${WHEEL_ART[k]}`)}" width="${2 * R}" height="${2 * R}" preserveAspectRatio="xMidYMid slice"/></pattern>`).join("")
  let a = 0
  let fills = ""
  let marks = ""
  slices.forEach(([k, w], i) => {
    const a0 = a
    const a1 = a + w * 3.6
    a = a1
    const span = a1 - a0
    const mid = (a0 + a1) / 2
    const large = span > 180 ? 1 : 0
    fills += `<path class="slice" data-i="${i}" d="M0,0 L${pt(a0, R)} A${R},${R} 0 ${large} 1 ${pt(a1, R)} Z" fill="url(#wash-${WHEEL_ART[k]})"/>`
    fills += `<line x1="0" y1="0" x2="${xy(a0, R)[0].toFixed(2)}" y2="${xy(a0, R)[1].toFixed(2)}" class="sep"/>`
    const name = k ? TIER[k]!.name.toUpperCase() : t("STILL WATER")
    const em = Math.min(25, chord(span, 45) * 0.8)
    const fs = Math.min(7.5, (chord(span, 63) * 0.86) / (name.length * 0.62))
    marks += `<g class="mark" data-i="${i}" transform="rotate(${mid.toFixed(2)})">
      <image href="${asset(`ui/wheel/emblem_${WHEEL_ART[k]}`)}" x="${(-em / 2).toFixed(2)}" y="${(-45 - em / 2).toFixed(2)}" width="${em.toFixed(2)}" height="${em.toFixed(2)}"/>
      <text class="wl" x="0" y="-63.5" font-size="${fs.toFixed(2)}" text-anchor="middle" dominant-baseline="central">${name}</text></g>`
  })
  const rim = RIM_SCALE
  return `<svg class="wheel-svg" viewBox="-100 -100 200 200" aria-hidden="true">
    <defs>${defs}<radialGradient id="wheel-shade"><stop offset="55%" stop-color="#171b1d" stop-opacity="0"/><stop offset="100%" stop-color="#171b1d" stop-opacity=".5"/></radialGradient></defs>
    <g class="wheel-rot">${fills}<circle r="${R}" fill="url(#wheel-shade)" pointer-events="none"/>${marks}</g>
    <image class="wheel-rim" href="${asset("ui/wheel/rim")}" x="${(-625 * rim).toFixed(2)}" y="${(-622 * rim).toFixed(2)}" width="${(1254 * rim).toFixed(2)}" height="${(1254 * rim).toFixed(2)}"/>
    <image class="wheel-hub" href="${asset("ui/wheel/hub")}" x="-25" y="-25" width="50" height="50"/></svg>`
}

/** Flash sprite is painted teal; these filters recolour it per outcome. */
const WHEEL_TINT: Record<string, string> = {
  "": "grayscale(1) brightness(1.3)",
  S: "hue-rotate(-128deg) saturate(1.6) brightness(1.1)",
  U: "none",
  H: "hue-rotate(95deg) saturate(1.3)",
}

/** Painted lettering where it exists (not in social-casino sessions), else text. */
function paintedTitle(text: string, cls: string, color = ""): string {
  const img = isSocial() ? null : titleImage(text)
  return img
    ? `<h2 class="${cls} painted"><img src="${img}" alt="${text}" draggable="false"></h2>`
    : `<h2 class="${cls}"${color ? ` style="color:${color}"` : ""}>${t(text)}</h2>`
}

/** Total odds per outcome, shown under the wheel. */
function wheelOdds(slices: [string, number][]): string {
  const total = new Map<string, number>()
  for (const [k, w] of slices) total.set(k, (total.get(k) ?? 0) + w)
  return [...total].map(([k, w]) => `<span><img src="${asset(`ui/wheel/emblem_${WHEEL_ART[k]}`)}" alt="">${k ? TIER[k]!.name : t("Still water")} ${w}%</span>`).join("")
}

/**
 * Mystery buys spin the Depth Wheel first and land it on the outcome already in the
 * book (its selectedMode event, or no bonus). Slam-stop and Space skip to the stop,
 * and players with reduced motion get the result without the spin.
 */
/**
 * The wheel waits for the player: the SPIN button, a tap on the hub, or Space / Enter.
 * The key press is stopped here so the game's own Space handler does not read it as a
 * slam-stop of the round that is about to play.
 */
function waitForWheelSpin(el: HTMLElement): Promise<void> {
  const btn = el.querySelector<HTMLButtonElement>(".wheel-spin")!
  el.classList.add("armed")
  btn.focus({ preventScroll: true })
  return new Promise((resolve) => {
    const go = () => {
      removeEventListener("keydown", onKey, true)
      el.classList.remove("armed")
      btn.disabled = true
      btn.classList.add("gone")
      resolve()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat) go()
    }
    addEventListener("keydown", onKey, true)
    btn.addEventListener("click", go, { once: true })
    el.querySelector(".wheel")!.addEventListener("click", (e) => {
      if ((e.target as Element).closest(".wheel-hub-video, .wheel-hub")) go()
    })
  })
}

async function depthWheel(mode: string, tier: string | null): Promise<void> {
  const slices = WHEEL[mode]
  if (!slices) return
  const key = tier ?? ""
  const hits = slices.map((s, i) => [s, i] as const).filter(([s]) => s[0] === key)
  if (!hits.length) return
  // Pick one matching slice (weighted by size) and a point well inside it.
  let r = Math.random() * hits.reduce((n, [s]) => n + s[1], 0)
  let pick = hits[0]!
  for (const hEntry of hits) {
    r -= hEntry[0][1]
    if (r <= 0) { pick = hEntry; break }
  }
  const start = slices.slice(0, pick[1]).reduce((n, s) => n + s[1], 0) * 3.6
  const width = pick[0][1] * 3.6
  const target = start + width * (0.2 + Math.random() * 0.6)
  const turns = 5
  const finalDeg = turns * 360 - target
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  const name = MODES.find((m) => m.id === mode)?.name ?? ""

  const el = h(`<div class="overlay wheel-ov" role="dialog" aria-label="${t("Depth Wheel")}"><img class="ov-backdrop" src="${asset("fx/overlay_backdrop")}" alt="">
    <div class="wheel-card">${paintedTitle("THE DEPTH WHEEL", "wheel-title")}<p class="wheel-sub">${name}</p>
      <div class="wheel"><img class="wheel-glow" src="${asset("ui/wheel/glow")}" alt="">${wheelSvg(slices)}<div class="wheel-flash" style="--tint:${WHEEL_TINT[tier ?? ""]}"></div><img class="wheel-pointer" src="${asset("ui/wheel/pointer")}" alt="" draggable="false"></div>
      <div class="wheel-odds">${wheelOdds(slices)}</div>
      <div class="wheel-result" aria-live="polite"></div>
      <button class="wheel-spin" type="button" aria-label="${t("Spin the wheel")}"><img src="${asset("ui/spin")}" alt="" draggable="false"><span>${t("SPIN")}</span></button></div></div>`)
  translateTree(el)
  document.body.append(el)
  attachWheelLoops(el.querySelector<HTMLElement>(".wheel")!)
  const rot = el.querySelector<SVGGElement>(".wheel-rot")!
  await waitForWheelSpin(el)
  const ms = reduce ? 0 : WHEEL_SPIN_MS * speed()
  let skip: () => void = () => {}
  const skipped = new Promise<void>((res) => (skip = res))
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); skip() }
  }
  addEventListener("keydown", onKey, true)
  el.addEventListener("pointerdown", () => skip())
  const slamWatch = setInterval(() => { if (st.slam) skip() }, 80)

  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
  if (ms > 0) {
    sfx.spin()
    const anim = rot.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${finalDeg}deg)` }],
      { duration: ms, easing: "cubic-bezier(.12,.62,.08,1)", fill: "forwards" })
    await Promise.race([anim.finished.catch(() => {}), skipped])
    anim.finish()
  } else {
    rot.style.transform = `rotate(${finalDeg}deg)`
  }
  clearInterval(slamWatch)
  rot.querySelectorAll(`[data-i="${pick[1]}"]`).forEach((n) => n.classList.add("hit"))
  el.classList.add(tier ? "landed" : "landed-calm")
  const res = el.querySelector(".wheel-result")!
  if (tier) {
    sfx.pearl()
    res.innerHTML = `${paintedTitle(TIER[tier]!.name.toUpperCase(), "wheel-res-title", WHEEL_FILL[tier])}<span>${t("10 free spins unlocked")}</span>`
  } else {
    res.innerHTML = `${paintedTitle("STILL WATER", "wheel-res-title")}<span>${t("No bonus this time — the spin plays on")}</span>`
  }
  if (!reduce) el.querySelector(".wheel-flash")!.classList.add("go")
  // Give the result a moment, then let a tap or Space continue early.
  const hold = new Promise<void>((r2) => setTimeout(r2, 1500 * speed()))
  let cont: () => void = () => {}
  const tapped = new Promise<void>((r2) => (cont = r2))
  setTimeout(() => {
    el.addEventListener("pointerdown", () => cont())
    removeEventListener("keydown", onKey, true)
    addEventListener("keydown", function k(e) { if (e.code === "Space") { e.preventDefault(); cont(); removeEventListener("keydown", k, true) } }, true)
  }, 250)
  await Promise.race([hold, tapped])
  removeEventListener("keydown", onKey, true)
  el.remove()
}

/** Hero switches to the victory pose for big-win and feature-end celebrations. */
function setHeroCelebrating(on: boolean) {
  document.querySelector(".hero")?.classList.toggle("celebrating", on)
}

async function countUpOverlay(title: string, units: number, ms: number) {
  setHeroCelebrating(true)
  try {
    await countUpOverlayInner(title, units, ms)
  } finally {
    setHeroCelebrating(false)
  }
}

async function countUpOverlayInner(title: string, units: number, ms: number) {
  const amountId = `amt-${Math.random().toString(36).slice(2)}`
  const p = overlay(`${heading(title)}<div class="amount" id="${amountId}">${fmt(0)}</div>`, ms)
  sfx.bigWin()
  const start = performance.now()
  const dur = ms * 0.6 * speed()
  const tick = () => {
    const el = document.getElementById(amountId)
    if (!el) return
    const k = Math.min(1, (performance.now() - start) / dur)
    el.textContent = fmt(bookToApi(units * (1 - Math.pow(1 - k, 3))))
    if (k < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  await p
}

const bigWinLabel = (x: number) => BIG_WINS.find(([min]) => x >= min)?.[1] ?? null

// ================================================================ event playback
type Pos = { reel: number; row: number }

// ---------------------------------------------------------------- reel motion
const prefersReduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const isScatter = (c: Code) => c === "S" || c === "S2"
/** Symbols shown on the blurred spinning strips (never the mega or the scatters). */
const STRIP_POOL: Code[] = ["L1", "L2", "L3", "L4", "L5", "H1", "H2", "H3", "H4", "H5", "W"]
/** Reel timing in ms at normal speed (scaled by speed(): turbo 0.45, slam 0.15). */
const REEL = {
  outStagger: 35, out: 240, spinLead: 360, gap: 120, stop: 300, rowStagger: 22,
  tease: 1200, teaseNext: 950, // extra spin time per teased reel
}

/** Like sleep(), but finishes within a frame or two once the player slam-stops. */
function waitSlam(ms: number): Promise<void> {
  const end = performance.now() + ms * speed()
  return new Promise((res) => {
    const tick = () => {
      const left = end - performance.now()
      if (left <= 0 || st.slam) return res()
      setTimeout(tick, Math.min(left, 30))
    }
    tick()
  })
}

/**
 * Drop curve as a CSS linear() easing: the symbol arrives already moving (v0), accelerates
 * like it is falling, hits at `impact`, rebounds by `bounce` (fraction of the drop) and settles.
 * Sampled finely so the motion stays smooth; falls back to a cubic-bezier where linear()
 * is not supported (older Safari).
 */
const LINEAR_OK = typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)")
const easingCache = new Map<string, string>()
function dropEasing(bounce: number, v0 = 0.35, impact = 0.68): string {
  if (!LINEAR_OK) return "cubic-bezier(.45,.05,.55,1.15)"
  const key = `${bounce.toFixed(3)}|${v0}|${impact}`
  const hit = easingCache.get(key)
  if (hit) return hit
  const pts: string[] = []
  const n = 48
  for (let i = 0; i <= n; i++) {
    const t = i / n
    let x: number
    if (t <= impact) {
      const u = t / impact
      x = v0 * u + (1 - v0) * u * u
    } else {
      const tau = (t - impact) / (1 - impact)
      x = 1 - bounce * Math.sin(Math.PI * tau) * Math.pow(1 - tau, 0.6)
    }
    pts.push(`${x.toFixed(4)} ${(t * 100).toFixed(2)}%`)
  }
  const v = `linear(${pts.join(", ")})`
  easingCache.set(key, v)
  return v
}

/** Small squash on the symbol art at the moment of impact (separate element: no transform clash). */
function squashAt(cell: HTMLElement, at: number, strength = 1) {
  const art = cell.querySelector<HTMLElement>(".art")
  if (!art || prefersReduced()) return
  const k = 0.07 * strength
  art.animate([
    { transform: "none" },
    { transform: `scale(${1 + k * 0.6}, ${1 - k})`, offset: 0.35 },
    { transform: "none" },
  ], { duration: 190 * speed(), delay: at, easing: "ease-out" })
}

/** A blurred column of random symbols scrolling down, shown while a reel spins. */
function spinStrip(r: number): { el: HTMLElement; anim: Animation } {
  const pick = () => STRIP_POOL[Math.floor(Math.random() * STRIP_POOL.length)]!
  const items = Array.from({ length: N * 2 }, () => `<div class="strip-cell">${symbolSvg(pick())}</div>`).join("")
  const el = h(`<div class="reel-strip" style="left:${(r * 100) / N}%"><div class="strip-inner">${items}</div></div>`)
  $(".symbols").append(el)
  const anim = el.firstElementChild!.animate([{ transform: "translateY(-50%)" }, { transform: "translateY(0)" }],
    { duration: 300, iterations: Infinity, easing: "linear" })
  // fade in just behind the old symbols leaving this reel
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 * speed(), delay: (r * REEL.outStagger + REEL.out * 0.55) * speed(), fill: "backwards" })
  return { el, anim }
}

/** Drop a column of cells into place with a landing bounce (bottom row first). */
function landColumn(els: HTMLElement[], fromRows: number, heavy: boolean): Animation[] {
  const reduce = prefersReduced()
  const dur = (heavy ? REEL.stop * 1.3 : REEL.stop) * speed()
  const easing = dropEasing(heavy ? 0.075 : 0.05, 0.45)
  return els.map((el, c) => {
    const delay = (N - 1 - c) * REEL.rowStagger * speed()
    if (reduce) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 * speed(), delay, fill: "backwards" })
    squashAt(el, delay + dur * 0.68, heavy ? 1.4 : 1)
    return el.animate([{ transform: `translateY(${-fromRows * 100}%)` }, { transform: "translateY(0)" }],
      { duration: dur, delay, easing, fill: "backwards" })
  })
}

/** One dimming layer over the board while reels tease (scatters sit above it). */
function setTeaseDim(on: boolean) {
  let dim = document.querySelector<HTMLElement>(".symbols .tease-dim")
  if (!dim) {
    dim = h(`<div class="tease-dim"></div>`)
    $(".symbols").append(dim)
  }
  dim.classList.toggle("on", on)
}

/** Tease frame over a reel that is about to stop with a bonus in reach. */
function teaseColumn(r: number, level: number): HTMLElement {
  const el = h(`<div class="tease-col lv${Math.min(level, 4)}" style="left:${(r * 100) / N}%"><i></i></div>`)
  $(".grid").append(el)
  return el
}

async function evReveal(e: BookEvent) {
  const board = (e.board as { name: Code }[][]).map((reel) => reel.map((s) => s.name))
  if ((e.gameType as string) === "basegame") {
    resetSpots(1)
    st.mega = null
  }
  const reduce = prefersReduced()
  // 1. the old board drops out, reel by reel
  const old = [...document.querySelectorAll<HTMLElement>(".symbols .cell")]
  old.forEach((el) => {
    const r = Math.round((parseFloat(el.style.left) * N) / 100)
    const a = reduce
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140 * speed(), fill: "forwards" })
      : el.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(130%)", opacity: 0 }],
          { duration: REEL.out * speed(), delay: r * REEL.outStagger * speed(), easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" })
    a.finished.then(() => el.remove(), () => el.remove())
  })
  // 2. every reel spins as a blurred strip until its stop
  const strips = reduce ? [] : Array.from({ length: N }, (_, r) => spinStrip(r))
  st.board = board
  await waitSlam(reduce ? 140 : REEL.spinLead)
  // 3. reels stop left to right; with two scatters down, the rest slow down and tease
  let scatters = 0
  let teased = 0
  for (let r = 0; r < N; r++) {
    let tease: HTMLElement | null = null
    if (scatters >= 2 && !st.slam && !reduce) {
      tease = teaseColumn(r, scatters)
      setTeaseDim(true)
      const strip = strips[r]!
      strip.el.classList.add("teased") // stays bright above the dimming layer
      const total = (teased ? REEL.teaseNext : REEL.tease) * speed()
      const t0 = performance.now()
      const beat = setInterval(() => sfx.tease(scatters), 380 * speed())
      sfx.tease(scatters)
      // the reel visibly loses speed while it teases (eased every frame, no steps)
      let raf = 0
      const slow = () => {
        const k = Math.min(1, (performance.now() - t0) / total)
        strip.anim.playbackRate = 1 - 0.8 * (1 - Math.pow(1 - k, 2.2))
        if (k < 1) raf = requestAnimationFrame(slow)
      }
      raf = requestAnimationFrame(slow)
      await waitSlam(teased ? REEL.teaseNext : REEL.tease)
      clearInterval(beat)
      cancelAnimationFrame(raf)
      teased++
    } else if (r > 0) {
      await waitSlam(REEL.gap)
    }
    // stop reel r
    const els: HTMLElement[] = []
    for (let c = 0; c < N; c++) {
      const el = makeCell(board[r]![c]!, r, c, c)
      cells[r]![c] = el
      els.push(el)
    }
    const strip = strips[r]
    if (strip) {
      strip.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 * speed(), easing: "ease-out", fill: "forwards" }).finished.then(() => strip.el.remove())
    }
    const anims = landColumn(els, 1.25, !!tease)
    sfx.land(r)
    const here = board[r]!.filter(isScatter).length
    if (here) {
      void Promise.all(anims.map((a) => a.finished)).then(() => {
        for (let c = 0; c < N; c++) if (isScatter(board[r]![c]!)) {
          cells[r]![c]?.classList.add("scat-land")
          fx("fx/glow_ring", "fx-glow", { reel: r, row: c }, 1.6)
        }
      })
    }
    scatters += here
    if (here) sfx.scatterLand(scatters)
    if (tease) {
      const t = tease
      t.classList.add("done")
      setTimeout(() => t.remove(), 260 * speed())
    }
  }
  setTeaseDim(false)
  await sleep(REEL.stop + (N - 1) * REEL.rowStagger + 40)
  document.querySelectorAll(".cell.scat-land").forEach((el) => el.classList.remove("scat-land"))
  if (scatters >= 3) sfx.scatter(scatters)
}

async function evWinInfo(e: BookEvent) {
  const wins = e.wins as { symbol: Code; clusterSize: number; win: number; positions: Pos[]; meta: { clusterMult: number; overlay: Pos } }[]
  for (const w of wins) {
    for (const p of w.positions) cells[p.reel]![p.row]?.classList.add("win")
    const o = w.meta.overlay
    const pop = h(`<div class="win-pop" style="left:${((o.reel + 0.5) * 100) / N}%;top:${((o.row + 0.5) * 100) / N}%">${fmt(bookToApi(w.win))}</div>`)
    $(".grid").append(pop)
    setTimeout(() => pop.remove(), 950 * speed())
    fx("fx/glow_ring", "fx-glow", o, Math.min(4, 1.2 + w.positions.length / 6))
    st.lastBursts.push(o)
  }
  const top = [...wins].sort((a, b) => b.win - a.win)[0]!
  const mult = top.meta.clusterMult > 1 ? ` ×${top.meta.clusterMult}` : ""
  st.pendingLine = `${top.clusterSize} ${SYMBOL_NAMES[top.symbol].toUpperCase()}${mult}${wins.length > 1 ? ` +${wins.length - 1}` : ""}`
  sfx.win(Math.min(4, Math.ceil(Math.log10(1 + (e.totalWin as number) / 100) * 2)))
}

async function evTumbleWin(e: BookEvent) {
  const amt = e.amount as number
  setWinReadout(st.spinBase + amt)
  banner(`${st.pendingLine} · TUMBLE ${fmt(bookToApi(amt))}`)
  await sleep(700)
}

async function evGrid(e: BookEvent) {
  setSpots(e.gridMultipliers as number[][])
}

async function evFeature(e: BookEvent) {
  const info = (e.info as Record<string, unknown>[])[0]!
  if (e.featureType === "damage") {
    setDamage(info.damage as number, true)
    sfx.hit()
    return
  }
  const feature = info.feature as string
  const positions = info.positions as Pos[]
  banner(`POWER-UP · ${POWER_NAMES[feature] ?? feature}`)
  sfx.power()
  if (feature === "bossSlain") {
    const r0 = Math.min(...positions.map((p) => p.reel))
    const c0 = Math.min(...positions.map((p) => p.row))
    st.mega = { r0, c0, n: info.size as number }
    setDamage(BOSS_HP)
    await overlay(`${heading("THE LEVIATHAN RISES")}<p>A ${info.size}×${info.size} Leviathan surfaces</p>`, 1800)
  }
  for (const p of positions) cells[p.reel]![p.row]?.classList.add("affect")
  await sleep(700)
  for (const p of positions) cells[p.reel]![p.row]?.classList.remove("affect")
}

async function evUpdateBoard(e: BookEvent) {
  const board = (e.board as { name: Code }[][]).map((reel) => reel.map((s) => s.name))
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (board[r]![c] !== st.board[r]![c] || board[r]![c] === "H6") {
        placeCell(r, c, board[r]![c]!)
        cells[r]![c]!.classList.add("morph")
      }
  st.board = board
  await sleep(600)
}

async function evTumble(e: BookEvent) {
  const exploding = e.explodingSymbols as Pos[]
  const newSyms = (e.newSymbols as { name: Code }[][]).map((reel) => reel.map((s) => s.name))
  const reduce = prefersReduced()
  // 1. winning symbols burst, rippling out from the middle of the win
  const cx = exploding.reduce((n, p) => n + p.reel, 0) / exploding.length
  const cy = exploding.reduce((n, p) => n + p.row, 0) / exploding.length
  let popEnd = 0
  for (const p of exploding) {
    const el = cells[p.reel]![p.row]
    if (!el) continue
    el.classList.remove("win")
    el.style.transformOrigin = "50% 50%"
    const delay = Math.hypot(p.reel - cx, p.row - cy) * 28 * speed()
    popEnd = Math.max(popEnd, delay)
    el.classList.add("bursting")
    el.animate(reduce ? [{ opacity: 1 }, { opacity: 0 }] : [
      { transform: "scale(1)", opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
      { transform: "scale(1.16)", opacity: 1, offset: 0.32, easing: "cubic-bezier(.6,0,.9,.4)" },
      { transform: "scale(.12) rotate(14deg)", opacity: 0 },
    ], { duration: 360 * speed(), delay, fill: "forwards" })
  }
  sfx.pop()
  for (const o of st.lastBursts.splice(0)) fx("fx/ink_splash", "fx-ink", o, 2.2)
  await sleep(340 + popEnd / speed())
  // 2. survivors fall under gravity, new symbols drop in from above (bottom first)
  const gone = new Set(exploding.map((p) => `${p.reel},${p.row}`))
  let longest = 0
  for (let r = 0; r < N; r++) {
    const survivors: { code: Code; el: HTMLElement; from: number }[] = []
    for (let c = 0; c < N; c++) {
      const el = cells[r]![c]!
      if (gone.has(`${r},${c}`)) el.remove()
      else survivors.push({ code: st.board[r]![c]!, el, from: c })
    }
    const fresh = newSyms[r] ?? []
    if (!fresh.length) continue
    st.board[r] = [...fresh, ...survivors.map((s) => s.code)]
    const moves: { el: HTMLElement; rows: number; row: number }[] = []
    survivors.forEach((s, i) => {
      const row = fresh.length + i
      cells[r]![row] = s.el
      if (row !== s.from) {
        s.el.style.top = topPct(row)
        moves.push({ el: s.el, rows: row - s.from, row })
      }
    })
    fresh.forEach((code, i) => {
      const el = makeCell(code, r, i, i)
      cells[r]![i] = el
      moves.push({ el, rows: fresh.length + 0.35, row: i })
    })
    for (const m of moves) {
      // longer falls take longer (gravity, ~sqrt of the distance) and bounce a touch more
      const dur = (210 + 120 * Math.sqrt(m.rows)) * speed()
      const delay = (r * 26 + (N - 1 - m.row) * 18) * speed()
      longest = Math.max(longest, dur + delay)
      if (reduce) {
        m.el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: dur, delay, fill: "backwards" })
        continue
      }
      m.el.animate([{ transform: `translateY(${-m.rows * 100}%)` }, { transform: "translateY(0)" }],
        { duration: dur, delay, easing: dropEasing(Math.min(0.07, 0.11 / m.rows), 0.08, 0.72), fill: "backwards" })
      squashAt(m.el, delay + dur * 0.72, Math.min(1.3, 0.6 + m.rows * 0.2))
    }
    setTimeout(() => sfx.land(r), (r * 26 + 220) * speed())
  }
  await sleep(longest / speed() + 30)
}

async function playEvents(events: BookEvent[], opts: { mode: string }) {
  st.spinBase = 0
  setWinReadout(0)
  banner("")
  setDamage(0)
  setTierUi(null)
  let feature = false
  let finalUnits = 0
  if (WHEEL[opts.mode]) {
    const sel = events.find((e) => e.type === "selectedMode")
    await depthWheel(opts.mode, sel ? (sel.mode as string) : null)
  }
  for (const e of events) {
    switch (e.type) {
      case "reveal":
        if (e.gameType === "basegame") setDamage(0)
        await evReveal(e)
        break
      case "winInfo": await evWinInfo(e); break
      case "updateTumbleWin": await evTumbleWin(e); break
      case "updateGrid": await evGrid(e); break
      case "featureEvent": await evFeature(e); break
      case "updateBoard": await evUpdateBoard(e); break
      case "tumbleBoard": await evTumble(e); break
      case "setWin": break
      case "setTotalWin":
        st.spinBase = e.amount as number
        setWinReadout(st.spinBase)
        break
      case "freeSpinTrigger":
        for (const p of e.positions as Pos[]) cells[p.reel]![p.row]?.classList.add("scat")
        sfx.scatter(5)
        banner("THE COMPASS POINTS DOWN")
        await sleep(900)
        break
      case "selectedMode": {
        const tier = e.mode as string
        feature = true
        setTierUi(tier, 0)
        setDamage(0)
        sfx.pearl()
        await overlay(
          `${heading(TIER[tier]!.name.toUpperCase())}<p>${FREE_SPINS} FREE SPINS · every spot starts at ${TIER[tier]!.start}×</p>`,
          3000,
        )
        break
      }
      case "updateFreeSpin":
        setTierUi(st.tier, e.amount as number)
        banner("")
        break
      case "freeSpinEnd": {
        const units = e.amount as number
        const label = bigWinLabel(units / 100)
        await countUpOverlay(label ?? "FEATURE COMPLETE", units, 3200)
        break
      }
      case "wincap":
        setHeroCelebrating(true)
        await overlay(`${heading("MAX WIN")}<div class="amount">${fmt(bookToApi(WINCAP * 100))}</div><p>${WINCAP.toLocaleString("en-US")}× reached!</p>`, 4000)
        setHeroCelebrating(false)
        break
      case "finalWin":
        finalUnits = e.amount as number
        setWinReadout(finalUnits)
        break
    }
  }
  if (!feature && (opts.mode === "mystery" || opts.mode === "mystery_deep")) banner("STILL WATER · NO BONUS")
  else banner(finalUnits > 0 ? `WIN ${fmt(bookToApi(finalUnits))}` : "")
  if (!feature) {
    const label = bigWinLabel(finalUnits / 100)
    if (label) await countUpOverlay(label, finalUnits, 3200)
  }
  setTierUi(null)
  setDamage(0)
  return finalUnits
}

// ================================================================ rounds
async function playRound(mode: string) {
  const provider = st.provider!
  const cost = MODE_COST[mode] ?? 1
  if (st.balance < st.bet * cost) {
    toast("Balance too low for this bet.", true)
    st.autoLeft = 0
    syncButtons()
    return false
  }
  sfx.unlock()
  sfx.spin()
  st.busy = true
  st.slam = false
  syncButtons()
  const started = performance.now()
  try {
    const res = await provider.play(st.bet, mode)
    setBalance(res.balance.amount)
    await playEvents(res.round.events, { mode })
    if (res.round.active) setBalance((await provider.endRound()).balance.amount)
    const minMs = Number(st.jur.minimumRoundDuration ?? 0)
    const elapsed = performance.now() - started
    if (minMs > elapsed) await new Promise((r) => setTimeout(r, minMs - elapsed))
    return true
  } catch (err) {
    console.warn(err)
    toast(String(err).includes("ERR_IPB") ? "Balance too low for this bet." : "Connection problem. Reload the game to finish any round in progress.", true)
    st.autoLeft = 0
    return false
  } finally {
    st.busy = false
    st.slam = false
    syncButtons()
  }
}

async function onSpin() {
  if (st.modal) return
  if (st.busy) {
    if (st.autoLeft > 0) {
      st.autoLeft = 0
      syncButtons()
      toast("Autoplay stopped")
    }
    if (!st.jur.disabledSlamstop) {
      st.slam = true
      syncButtons()
    }
    return
  }
  await playRound(st.ante ?? "base")
}

async function runAutoplay(count: number) {
  st.autoLeft = count
  syncButtons()
  while (st.autoLeft > 0) {
    const ok = await playRound(st.ante ?? "base")
    if (!ok) break
    st.autoLeft = Math.max(0, st.autoLeft - 1)
    syncButtons()
    const cost = MODE_COST[st.ante ?? "base"]!
    if (st.balance < st.bet * cost) {
      st.autoLeft = 0
      toast("Autoplay stopped: balance too low.")
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  st.autoLeft = 0
  syncButtons()
}

// ================================================================ modals
function modal(html: string, cls = ""): HTMLElement {
  st.modal = true
  const wrap = h(`<div class="modal-wrap"><div class="sheet ${cls}" role="dialog" aria-modal="true"><button class="x-close" aria-label="Close">${icon(UI_ICONS.close)}</button>${html}</div></div>`)
  const close = () => {
    wrap.remove()
    st.modal = !!document.querySelector(".modal-wrap")
  }
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || (e.target as HTMLElement).closest(".x-close")) close()
  })
  ;(wrap as HTMLElement & { close: () => void }).close = close
  translateTree(wrap)
  document.body.append(wrap)
  return wrap
}
const closeModal = (el: HTMLElement) => (el as HTMLElement & { close: () => void }).close()

function confirmDialog(title: string, body: string, okLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const m = modal(`<h2>${t(title)}</h2><p>${t(body)}</p><div class="row"><button class="btn ghost" data-no>${t("Cancel")}</button><button class="btn green" data-yes>${t(okLabel)}</button></div>`, "small")
    $("[data-yes]", m).onclick = () => { closeModal(m); resolve(true) }
    $("[data-no]", m).onclick = () => { closeModal(m); resolve(false) }
    $(".x-close", m).addEventListener("click", () => resolve(false))
  })
}

function openAutoplay() {
  if (st.busy) return
  let pick = 10
  const m = modal(
    `<h2>${t("Autoplay")}</h2><p>${t("Choose how many spins to play. Autoplay stops when your balance runs out; press SPIN at any time to stop it.")}</p>
     <div class="row choices">${[10, 25, 50, 100].map((n) => `<button data-n="${n}" class="${n === 10 ? "on" : ""}">${n}</button>`).join("")}</div>
     <div class="row"><button class="btn ghost" data-no>${t("Cancel")}</button><button class="btn green" data-yes>${t("Start autoplay")}</button></div>`,
    "small",
  )
  m.querySelectorAll<HTMLButtonElement>("[data-n]").forEach((b) => (b.onclick = () => {
    pick = Number(b.dataset.n)
    m.querySelectorAll("[data-n]").forEach((x) => x.classList.toggle("on", x === b))
  }))
  $("[data-no]", m).onclick = () => closeModal(m)
  $("[data-yes]", m).onclick = () => { closeModal(m); void runAutoplay(pick) }
}

const VOL: Record<string, number> = Object.fromEntries(MODES.map((x) => [x.id, x.vol]))
const ABYSS = new Set(["hunt", "deep_hunt", "mystery", "mystery_deep", "ultra"])

function buyCard(id: string, title: string, desc: string, illus: string, row2 = false): string {
  const isHunt = id === "hunt" || id === "deep_hunt"
  const active = st.ante === id
  const cost = MODE_COST[id]!
  return `<article style="background-image:url(${asset("ui/card")})" class="bcard${row2 ? " r2" : ""}${ABYSS.has(id) ? " has-abyss" : ""}" data-mode="${id}">
    ${ABYSS.has(id) ? `<div class="abyss-badge">CHANCE OF ABYSSAL BONUS</div>` : ""}
    <h4>${t(title)}</h4>
    <div class="illus">${illus}</div>
    <div class="desc">${t(desc)}</div>
    <div class="vol"><b style="left:${VOL[id]}%"></b></div><div class="vol-l"><span>LOW</span><span>VOLATILITY</span><span>HIGH</span></div>
    <div class="price">${fmt(st.bet * cost)}</div>
    ${isHunt ? `<button class="btn ${active ? "gold" : "blue"}" data-hunt="${id}">${active ? "ACTIVE ✓" : "ACTIVATE"}</button>` : `<button class="btn green" data-buy="${id}">${t("BUY")}</button>`}
  </article>`
}

function openBuy() {
  if (st.busy || st.jur.disabledBuyFeature) return
  const art = (key: string, extra = "") => `<img class="illus-img" src="${asset(`ui/${key}`)}" alt="" draggable="false">${extra}`
  const fsArt = (n: number) => art("illus_freespins", `<span class="illus-mult">${n}×</span>`)
  const render = () => `
    <h2>${t("Buy Feature")}</h2>
    <div class="buy-grid">
      ${buyCard("hunt", "Leviathan Hunt", "Every bonus 10× as likely, every spin", art("illus_hunt"))}
      ${buyCard("deep_hunt", "Trench Hunt", "Maelstrom & Abyssal 150× as likely", art("illus_trench"))}
      ${buyCard("mystery", "Mystery Depths", "A hidden bonus — or nothing at all", art("illus_mystery", `<span class="pct">40%</span>`))}
      ${buyCard("mystery_deep", "Abyssal Mystery", "Undertow or Abyssal — or nothing", art("illus_mystery", `<span class="pct">40%</span>`))}
      ${buyCard("bonus", "Riptide", "10 free spins, spots start at 1×", fsArt(1), true)}
      ${buyCard("super", "Undertow", "10 free spins, spots start at 2×", fsArt(2))}
      ${buyCard("ultra", "Maelstrom", "10 free spins, spots start at 4×", fsArt(4))}
    </div>
    <div class="bet-panel"><span>${t("BET")}</span><button class="sq" data-bm>${icon(UI_ICONS.minus)}</button><span class="amt">${fmt(st.bet)}</span><button class="sq" data-bp>${icon(UI_ICONS.plus)}</button><span>${t("BALANCE")}: ${fmt(st.balance)}</span></div>`
  const m = modal(render())
  const sheet = $(".sheet", m)
  const wire = () => {
    sheet.querySelectorAll<HTMLButtonElement>("[data-hunt]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.hunt as "hunt" | "deep_hunt"
      st.ante = st.ante === id ? null : id
      toast(st.ante ? `${id === "hunt" ? "Leviathan Hunt" : "Trench Hunt"} active — ${MODE_COST[id]}× bet every spin` : "Hunt deactivated")
      updateBetReadout()
      setTierUi(null)
      refresh()
    }))
    sheet.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => (b.onclick = async () => {
      const id = b.dataset.buy!
      const name = MODES.find((x) => x.id === id)!.name
      const ok = await confirmDialog(`Buy ${name}?`, `${MODES.find((x) => x.id === id)!.buys}. Price: ${fmt(st.bet * MODE_COST[id]!)}`, "Buy")
      if (!ok) return
      closeModal(m)
      void playRound(id)
    }))
    $<HTMLButtonElement>("[data-bm]", sheet).onclick = () => { changeBet(-1); refresh() }
    $<HTMLButtonElement>("[data-bp]", sheet).onclick = () => { changeBet(1); refresh() }
  }
  const refresh = () => {
    const close = $(".x-close", sheet)
    sheet.innerHTML = ""
    sheet.append(close)
    sheet.insertAdjacentHTML("beforeend", render())
    translateTree(sheet)
    wire()
  }
  wire()
}

function payRow(code: Code) {
  const p = PAYTABLE[code]!
  const tiers = ["5–7", "8–10", "11–13", "14+"]
  return `<div class="pay"><span class="sv">${symbolSvg(code, undefined, true)}</span><div><div class="nm">${SYMBOL_NAMES[code]}</div><table>${tiers
    .map((k, i) => `<tr><td>${k}</td><td>${p[i]}×</td></tr>`).join("")}</table></div></div>`
}

function openInfo() {
  const rtpPct = "96.70%"
  const m = modal(`
    <h2>${t("Game Info")}</h2>
    <div class="toggle-row"><button class="btn ${sfx.muted ? "ghost" : "green"}" data-mute>${sfx.muted ? "SOUND OFF" : "SOUND ON"}</button><span>Sound effects</span></div>

    <h3>How to play</h3>
    <p>${t("Abyssal Tide is played on a 6×6 grid. Clusters of 5 or more matching symbols joined horizontally or vertically win. Winning symbols are removed and new symbols fall in from above (a tumble); tumbles continue until no win remains. Wins are multiplied by the bet.")}</p>

    <h3>Paytable (× bet, by cluster size)</h3>
    <div class="pay-grid">${(["H5", "H4", "H3", "H2", "H1", "L5", "L4", "L3", "L2", "L1"] as Code[]).map(payRow).join("")}</div>

    <h3>Whirlpool Wild</h3>
    <div class="pay"><span class="sv">${symbolSvg("W", undefined, true)}</span><p>${t("Substitutes for every paying symbol. After a winning cluster that contains a Wild has paid, every multiplier spot under that cluster doubles, up to 64×.")}</p></div>

    <h3>Multiplier spots</h3>
    <p>${t("Every cell has a spot. In the base game all spots start at 1× and reset every spin. A cluster's multiplier is the sum of the spots above 1× that it covers; if every covered spot is 1×, the multiplier is 1×. In free spins, spots start at the feature's level and carry over between spins.")}</p>

    <h3>The Leviathan</h3>
    <p>${t("Every tumble deals damage equal to the number of winning symbols. Every 25 damage fires the next power-up, in order:")}</p>
    <ul>
      <li><b>25 Tidal Turn</b> — one paying symbol type becomes Wild</li>
      <li><b>50 Whirlpool Block</b> — a 2×2 block of Wilds</li>
      <li><b>75 Shallows Surge</b> — one low symbol type becomes Wild</li>
      <li><b>100 Shoal Block</b> — a 3×3 block of one symbol</li>
      <li><b>125 Twin Currents</b> — two paying symbol types become Wild</li>
      <li><b>150 Treasure Block</b> — a 3×3 block of a high symbol</li>
      <li><b>175 Twin Shallows</b> — two low symbol types become Wild</li>
      <li><b>200 Leviathan Rises</b> — the Leviathan is slain and a Leviathan block from 3×3 to 6×6 lands</li>
    </ul>
    <p>${t("Damage resets every base spin. In free spins it carries across all 10 spins.")}</p>
    <div class="pay"><span class="sv">${symbolSvg("H6", undefined, true)}</span><p>${t("Leviathan mega symbol pays by the cells it covers: 5–15 → 100×, 16–24 → 1,000×, 25–35 → 10,000×, 36 → 100,000×. A 3×3 pays 100×, 4×4 1,000×, 5×5 10,000×, 6×6 100,000×. Spot multipliers do not apply to it.")}</p></div>

    <h3>Sunken Compass &amp; free spins</h3>
    <div class="pay"><span class="sv">${symbolSvg("S", undefined, true)}</span><p>${t("Scatter. 3 Compasses award Riptide, 4 award Undertow, 5 award Maelstrom. Every feature is 10 free spins with no retriggers.")}</p></div>
    <div class="pay"><span class="sv">${symbolSvg("S2", undefined, true)}</span><p>${t("Abyssal Compass: on a 5-Compass trigger one Compass can upgrade to the Abyssal Compass (4 + Abyssal), awarding the Abyssal feature.")}</p></div>
    <table class="modes"><tr><th>Trigger</th><th>Feature</th><th>Spots start at</th></tr>
      <tr><td>3 Compasses</td><td>Riptide</td><td>1×</td></tr><tr><td>4 Compasses</td><td>Undertow</td><td>2×</td></tr>
      <tr><td>5 Compasses</td><td>Maelstrom</td><td>4×</td></tr><tr><td>4 + Abyssal Compass</td><td>Abyssal</td><td>8×</td></tr></table>

    <h3>Bet modes</h3>
    <table class="modes"><tr><th>Mode</th><th>Cost</th><th>What it buys</th><th>RTP</th><th>Max win</th></tr>
      ${MODES.map((x) => `<tr><td>${t(x.name)}</td><td>${MODE_COST[x.id]}× bet</td><td>${t(x.buys)}</td><td>${rtpPct}</td><td>100,000×</td></tr>`).join("")}
    </table>
    <p>${t("The maximum win is 100,000× the base bet in every mode; a round ends as soon as it is reached. Hunts are ante modes: while active, every spin costs the shown multiple of the bet. Mystery buys reveal their outcome after the purchase.")}</p>

    <h3>Buttons</h3>
    <div class="guide">
      <b>SPIN</b><span>${t("Places a bet at the current bet size (Space also spins). Press during a round to speed it up.")}</span>
      <b>+ / −</b><span>${t("Change the bet size through the levels offered for your session.")}</span>
      <b>BUY FEATURE</b><span>${t("Opens the feature menu: activate a hunt or buy a bonus.")}</span>
      <b>≡</b><span>${t("Opens this game information, including the sound toggle.")}</span>
      <b>AUTOPLAY</b><span>${t("Plays a confirmed number of spins in a row.")}</span>
      <b>TURBO</b><span>${t("Faster animations.")}</span>
      <b>BALANCE / WIN / BET</b><span>${t("Your balance, the win of the current round and the current bet.")}</span>
    </div>

    <h3>Disclaimer</h3>
    <p>${t("Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser.")}</p>
    <p class="muted">Abyssal Tide © 2026. All rights reserved.</p>`)
  const mute = $<HTMLButtonElement>("[data-mute]", m)
  mute.onclick = () => {
    sfx.unlock()
    sfx.setMuted(!sfx.muted)
    mute.textContent = sfx.muted ? "SOUND OFF" : "SOUND ON"
    mute.className = `btn ${sfx.muted ? "ghost" : "green"}`
  }
}

// ================================================================ bet
function changeBet(d: number) {
  if (st.busy) return
  st.betIdx = Math.max(0, Math.min(st.levels.length - 1, st.betIdx + d))
  sfx.click()
  updateBetReadout()
  syncButtons()
}

// ================================================================ boot
/** (Re)apply translatable labels — social mode can switch on after authenticate. */
function relabel() {
  $(".buy-badge span").textContent = t("BUY FEATURE")
  $(".bal .k").textContent = t("BALANCE")
  $(".winr .k").textContent = t("WIN")
  $(".betr .k").textContent = t("BET")
  const tag = $(".logo .tag")
  if (st.jur.displayRTP && !st.replay) {
    let rtp = document.querySelector<HTMLElement>(".rtp-tag")
    if (!rtp) {
      rtp = h(`<span class="tag rtp-tag"></span>`)
      tag.after(rtp)
    }
    rtp.textContent = "RTP 96.70%"
  }
  updateBetReadout()
}

function wire() {
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")
    if (!b || (b as HTMLButtonElement).disabled) return
    sfx.unlock()
    switch (b.dataset.act) {
      case "spin": void onSpin(); break
      case "plus": changeBet(1); break
      case "minus": changeBet(-1); break
      case "buy": openBuy(); break
      case "info": openInfo(); break
      case "auto":
        if (st.autoLeft > 0) { st.autoLeft = 0; syncButtons() } else openAutoplay()
        break
      case "turbo": st.turbo = !st.turbo; syncButtons(); break
    }
  })
  addEventListener("keydown", (e) => {
    if (e.code !== "Space" || st.jur.disabledSpacebar || st.replay) return
    if (st.modal || document.querySelector(".overlay")) return
    e.preventDefault()
    if (e.repeat) return
    sfx.unlock()
    void onSpin()
  })
}

function initialBoard() {
  const pool: Code[] = ["L1", "L2", "L3", "L4", "L5", "H1", "H2", "H3", "H4", "H5"]
  st.board = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => pool[(r * 7 + c * 3 + ((r * c) % 5)) % pool.length]!))
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) placeCell(r, c, st.board[r]![c]!)
  resetSpots(1)
}

async function bootReplay() {
  document.body.classList.add("replay")
  $(".bar").hidden = true // no bet controls or balance in replay mode
  const tag = $(".logo .tag")
  tag.hidden = false
  tag.textContent = "REPLAY"
  const bar = h(`<div class="replay-bar"><span class="msg">${t("LOADING REPLAY…")}</span></div>`)
  document.body.append(bar)
  try {
    const round = await fetchReplay()
    st.bet = round.amount
    st.currency = round.currency
    const play = async () => {
      bar.innerHTML = `<span class="msg">${t("REPLAY")}</span>`
      sfx.unlock()
      const units = await playEvents(round.events, { mode: round.mode })
      bar.innerHTML = `<span class="msg">${t("TOTAL WIN")} ${fmt(bookToApi(units))}</span><button class="btn gold" data-again>${t("PLAY AGAIN")}</button>`
      $<HTMLButtonElement>("[data-again]", bar).onclick = play
    }
    bar.innerHTML = `<button class="btn green" data-play>${t("PLAY")}</button>`
    $<HTMLButtonElement>("[data-play]", bar).onclick = play
  } catch (err) {
    bar.innerHTML = `<span class="msg">${err instanceof ReplayNotFound ? "This round could not be found" : "This replay could not be loaded"}</span>`
  }
}

// ================================================================ studio splash + intro
const LOADER_MIN_MS = 2600 // the logo reveal and shine finish before the splash leaves
const LOADER_MAX_MS = 12000 // never hold the player on the splash longer than this

/** Drive the inline splash (index.html): real progress over `work`, then fade out. */
async function runLoader(work: Promise<unknown>[]): Promise<void> {
  const el = document.getElementById("loader")
  if (!el) return
  const fill = el.querySelector<HTMLElement>(".ld-fill")
  let done = 0
  const step = () => {
    done++
    const k = done / work.length
    if (fill) fill.style.transform = `scaleX(${Math.max(0.02, k)})`
    el.setAttribute("aria-valuenow", String(Math.round(k * 100)))
  }
  work.forEach((p) => p.then(step, step))
  await Promise.race([Promise.allSettled(work), new Promise((r) => setTimeout(r, LOADER_MAX_MS))])
  if (fill) fill.style.transform = "scaleX(1)"
  const wait = LOADER_MIN_MS - performance.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  el.classList.add("done")
  await new Promise((r) => setTimeout(r, 650))
  el.remove()
}

const SKIP_INTRO_KEY = "abyssal-tide:skip-intro"
function introSkipped(): boolean {
  try {
    return localStorage.getItem(SKIP_INTRO_KEY) === "1"
  } catch {
    return false
  }
}

/** Game intro: logo, three feature cards, "press to continue". Resolves when dismissed. */
function showIntro(): Promise<void> {
  const cards: [string, string, string, string][] = [
    ["teal", t("TUMBLE INTO THE DEEP"),
      t("Land 5 or more matching symbols in a cluster on the 6×6 grid. Winning symbols vanish and new ones tumble in from above."),
      `<img src="${asset("ui/illus_freespins")}" alt="" draggable="false">`],
    ["gold", t("HUNT THE LEVIATHAN"),
      t("Every winning symbol wounds the Leviathan. Every 25 damage unleashes a power-up, and at 200 it surfaces as a giant mega symbol."),
      `<span class="pu-row">${[1, 4, 8].map((n) => `<img src="${assetsMatching(`ui/pu/${n}_`)[0]}" alt="" draggable="false">`).join("")}</span>`],
    ["violet", t("100,000× MAX WIN"),
      t("Wild clusters double the multiplier spots beneath them, up to 64×. Chain them through the free spins for wins up to 100,000× the bet."),
      `<span class="wild-art"><img src="${asset("sym/W")}" alt="" draggable="false"><b>×64</b></span>`],
  ]
  const el = h(`<div class="intro" role="dialog" aria-modal="true" aria-label="${t("Game introduction")}">
    <div class="intro-fog"></div>
    <img class="intro-logo" src="${asset("lettering/logo")}" alt="Abyssal Tide" draggable="false">
    <div class="intro-cards">${cards.map(([c, title, body, art], i) => `
      <article class="intro-card glow-${c}" style="--i:${i};background-image:url(${asset("ui/card")})">
        <h3>${title}</h3><div class="intro-art">${art}</div><p>${body}</p>
      </article>`).join("")}</div>
    <button class="intro-go" type="button">${t("PRESS TO CONTINUE")}</button>
    <label class="intro-skip"><input type="checkbox"> ${t("Don't show this again")}</label>
  </div>`)
  translateTree(el)
  st.modal = true
  document.body.append(el)
  const box = el.querySelector<HTMLInputElement>(".intro-skip input")!
  return new Promise((resolve) => {
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      removeEventListener("keydown", onKey, true)
      try {
        if (box.checked) localStorage.setItem(SKIP_INTRO_KEY, "1")
      } catch {
        /* storage blocked: the intro simply shows again next time */
      }
      sfx.click()
      el.classList.add("leaving")
      setTimeout(() => {
        el.remove()
        st.modal = !!document.querySelector(".modal-wrap")
        resolve()
      }, prefersReduced() ? 0 : 420)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return
      e.preventDefault()
      e.stopImmediatePropagation() // never reaches the spin control
      if (!e.repeat) close()
    }
    addEventListener("keydown", onKey, true)
    el.addEventListener("click", (e) => {
      if ((e.target as Element).closest(".intro-skip")) return // ticking the box does not continue
      close()
    })
  })
}

/**
 * Showdown splash between the intro and the slot: a diagonal panel wipe, the harpooner and
 * the Leviathan slide in face to face, "THE HUNT BEGINS" slams in, then the screen fades
 * through black into the game. Tap / Space / Enter skips to the fade.
 */
function showShowdown(): Promise<void> {
  const reduce = prefersReduced()
  const el = h(`<div class="vs${reduce ? " still" : ""}" role="dialog" aria-label="${t("The hunt begins")}">
    <div class="vs-bg"><i class="vs-ray"></i><i class="vs-ray r2"></i></div>
    <img class="vs-slash s1" src="${asset("fx/water_slash")}" alt="">
    <img class="vs-slash s2" src="${asset("fx/water_slash")}" alt="">
    <img class="vs-ink k1" src="${asset("fx/ink_splash")}" alt=""><img class="vs-ink k2" src="${asset("fx/ink_splash")}" alt="">
    <div class="vs-char vs-hero"><div class="rig hero-rig">
      <img class="rig-l" src="${asset("chars/hero_coat")}" alt="" data-part="coat"><img class="rig-l" src="${asset("chars/hero_body")}" alt="">
      <img class="rig-l" src="${asset("chars/hero_scarf")}" alt="" data-part="scarf"><img class="rig-l" src="${asset("chars/hero_eyes")}" alt="" data-part="eyes">
    </div></div>
    <div class="vs-char vs-lev"><div class="rig lev-rig">
      <img class="rig-l" src="${asset("chars/lev_body")}" alt=""><img class="rig-l" src="${asset("chars/lev_head")}" alt="" data-part="head">
      <img class="rig-l" src="${asset("chars/lev_gills")}" alt="" data-part="gills">
    </div></div>
    <div class="vs-title"><img class="vs-title-slash" src="${asset("fx/water_slash")}" alt=""><h1>${t("THE HUNT BEGINS")}</h1></div>
    <div class="vs-black"></div>
  </div>`)
  st.modal = true
  document.body.append(el)
  // timings in ms (scaled down for reduced motion)
  const T = reduce ? { slam: 150, hold: 1100 } : { slam: 820, hold: 1700 }
  return new Promise((resolve) => {
    let leaving = false
    const timers: number[] = []
    const leave = () => {
      if (leaving) return
      leaving = true
      timers.forEach(clearTimeout)
      removeEventListener("keydown", onKey, true)
      el.classList.add("out")
      setTimeout(() => {
        el.classList.add("reveal")
        st.modal = !!document.querySelector(".modal-wrap")
        setTimeout(() => {
          el.remove()
          resolve()
        }, 480)
      }, reduce ? 150 : 380)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat) leave()
    }
    addEventListener("keydown", onKey, true)
    el.addEventListener("click", leave)
    if (!reduce) timers.push(window.setTimeout(() => sfx.spin(), 120))
    timers.push(window.setTimeout(() => {
      el.classList.add("slammed")
      sfx.hit()
      sfx.power()
    }, T.slam))
    timers.push(window.setTimeout(leave, T.slam + T.hold))
  })
}

async function boot() {
  // Start audio on the first touch / key, so creating the AudioContext (tens of ms, once)
  // never lands in the same frame as the first spin animation.
  const warm = () => sfx.unlock()
  addEventListener("pointerdown", warm, { once: true, capture: true })
  addEventListener("keydown", warm, { once: true, capture: true })
  // Everything the game draws is decoded behind the splash, so nothing pops in later.
  const work: Promise<unknown>[] = [...preloadTracked(allAssetUrls()), document.fonts?.ready ?? Promise.resolve()]
  if (params.get("social") === "true") setSocial(true)
  buildDom()
  startLoops()
  initialBoard()
  setDamage(0)
  setTierUi(null)
  wire()
  if (st.replay) {
    document.body.classList.add("replay")
    $(".bar").hidden = true // no bet controls in replay, not even behind the splash
    await runLoader(work)
    await bootReplay()
    return
  }
  st.provider = createProvider()
  if (st.provider.kind === "demo") {
    const tag = $(".logo .tag")
    tag.hidden = false
    tag.textContent = "DEMO"
  }
  const authP = st.provider.authenticate()
  work.push(authP)
  const ready = runLoader(work)
    .then(() => (introSkipped() ? undefined : showIntro()))
    .then(() => showShowdown())
  try {
    const auth = await authP
    st.jur = auth.jurisdiction as Record<string, unknown>
    if (st.jur.socialCasino) setSocial(true)
    st.currency = auth.balance.currency
    st.levels = auth.betLevels
    st.betIdx = Math.max(0, st.levels.indexOf(auth.defaultBet))
    setBalance(auth.balance.amount)
    relabel()
    syncButtons()
    await ready
    if (auth.activeRound) await resume(auth.activeRound)
  } catch (err) {
    console.warn(err)
    await ready
    toast("Could not connect to the game server. Please reload.", true)
  }
}

async function resume(round: PlayedRound) {
  toast("Resuming your unfinished round…")
  st.busy = true
  syncButtons()
  try {
    await playEvents(round.events, { mode: round.mode })
    setBalance((await st.provider!.endRound()).balance.amount)
  } finally {
    st.busy = false
    syncButtons()
  }
}

void boot()
