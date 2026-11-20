import "@fontsource/permanent-marker/latin-400.css"
import "@fontsource/lilita-one/latin-400.css"
import "@fontsource/outfit/latin-400.css"
import "@fontsource/outfit/latin-600.css"
import "@fontsource/outfit/latin-800.css"
import "./style.css"

import { DEFS, HERO_SVG, LEVIATHAN_SVG, LOGO_SVG, NOISE_URL, POWER_ICONS, SCENE_SVG, UI_ICONS, icon } from "./art"
import { SYMBOL_NAMES, SYMBOL_SPRITES, symbolSvg, type Code } from "./symbols"
import { sfx } from "./audio"
import { setSocial, t, translateTree } from "./text"
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
function buildDom() {
  document.body.insertAdjacentHTML("afterbegin", DEFS + SYMBOL_SPRITES)
  document.documentElement.style.setProperty("--noise", NOISE_URL)
  const app = $("#app")
  app.innerHTML = `
    <div class="scene">${SCENE_SVG}</div>
    <div class="char hero"><div class="breathe">${HERO_SVG}</div></div>
    <div class="char leviathan"><div class="breathe">${LEVIATHAN_SVG}</div></div>
    <div class="logo">${LOGO_SVG}<span class="tag" hidden></span></div>
    <main class="stage">
      <section class="boss" aria-label="Leviathan health">
        <div class="boss-head"><span class="tier">BASE GAME</span><span class="tab">LEVIATHAN HP</span><span class="fs"></span></div>
        <div class="hp"><div class="hp-fill"></div><div class="hp-ticks"></div><div class="hp-text">${BOSS_HP} / ${BOSS_HP}</div></div>
        <div class="track"><span class="cap"></span>${LADDER.map(
          (k, i) => `<span class="node${i === 7 ? " final" : ""}" style="left:${(i + 1) * 12.5}%" title="${POWER_NAMES[k]} at ${(i + 1) * STEP}">${icon(POWER_ICONS[i]!)}</span>`,
        ).join("")}</div>
      </section>
      <section class="grid" aria-label="Game board">
        <div class="grid-bg"></div>
        <div class="layer spots"></div>
        <div class="layer symbols"></div>
        <div class="layer labels"></div>
        <div class="grid-frame"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" rx="2" fill="none" stroke="#171b1d" stroke-width="2.4" vector-effect="non-scaling-stroke" filter="url(#rough-big)"/></svg></div>
      </section>
      <div class="banner" aria-live="polite"></div>
      <div class="ante" hidden></div>
    </main>
    <nav class="bar">
      <button class="buy-badge" data-act="buy">${t("BUY FEATURE")}</button>
      <button class="menu-btn" data-act="info" aria-label="Game info">${icon(UI_ICONS.menu)}</button>
      <div class="read bal"><span class="k">${t("BALANCE")}</span><span class="v">–</span></div>
      <div class="read winr"><span class="k">${t("WIN")}</span><span class="v">–</span></div>
      <div class="read betr"><span class="k">${t("BET")}</span><span class="v">–</span><span class="x" hidden></span></div>
      <div class="pm"><button class="round" data-act="plus" aria-label="Increase bet">${icon(UI_ICONS.plus)}</button><button class="round" data-act="minus" aria-label="Decrease bet">${icon(UI_ICONS.minus)}</button></div>
      <button class="spin-btn" data-act="spin" aria-label="Spin">${icon(UI_ICONS.spin)}</button>
      <div class="stack"><button class="round" data-act="auto" aria-label="Autoplay">${icon(UI_ICONS.auto)}<span class="left" hidden></span></button><button class="round" data-act="turbo" aria-label="Turbo">${icon(UI_ICONS.turbo)}</button></div>
    </nav>`
  const spots = $(".spots")
  const labels = $(".labels")
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      spots.append(h(`<div class="spot" data-r="${r}" data-c="${c}" style="left:${(r * 100) / N}%;top:${(c * 100) / N}%"><i></i></div>`))
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
  const el = h(`<div class="cell${code === "H6" ? " mega" : ""}" style="left:${(r * 100) / N}%;top:${topPct(fromRow)}">${cellHtml(code, r, c)}</div>`)
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

// ================================================================ HUD helpers
function banner(text: string) {
  const b = $(".banner")
  b.innerHTML = text ? `<span>${t(text)}</span>` : ""
  translateTree(b)
}
function setWinReadout(units: number) {
  st.shownWin = units
  $(".winr .v").textContent = units > 0 ? fmt(bookToApi(units)) : "–"
}
function setBalance(api: number) {
  st.balance = api
  $(".bal .v").textContent = fmt(api)
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
  $(".hp-fill").style.width = `${(left / BOSS_HP) * 100}%`
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
    lev.classList.remove("recoil")
    void lev.offsetWidth
    lev.classList.add("recoil")
  }
  $(".leviathan").classList.toggle("slain", left === 0)
}
function setTierUi(tier: string | null, fs = 0) {
  st.tier = tier
  if (tier) document.body.dataset.tier = tier
  else delete document.body.dataset.tier
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
    const el = h(`<div class="overlay" role="dialog"><div class="card">${html}<div class="hint">${t("Tap to continue")}</div></div></div>`)
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

async function countUpOverlay(title: string, units: number, ms: number) {
  const amountId = `amt-${Math.random().toString(36).slice(2)}`
  const p = overlay(`<h1>${t(title)}</h1><div class="amount" id="${amountId}">${fmt(0)}</div>`, ms)
  sfx.bigWin()
  const start = performance.now()
  const dur = Math.min(ms * 0.6, 2200) * speed()
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

async function evReveal(e: BookEvent) {
  const board = (e.board as { name: Code }[][]).map((reel) => reel.map((s) => s.name))
  if ((e.gameType as string) === "basegame") {
    resetSpots(1)
    st.mega = null
  }
  // old board falls out
  const old = document.querySelectorAll<HTMLElement>(".symbols .cell")
  old.forEach((el) => el.classList.add("out"))
  setTimeout(() => old.forEach((el) => el.remove()), 240 * speed())
  await sleep(120)
  st.board = board
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const el = makeCell(board[r]![c]!, r, c, c - N)
      cells[r]![c] = el
      el.style.transitionDelay = `${(r * 60 + (N - c) * 22) * speed()}ms`
    }
    setTimeout(() => sfx.land(r), (r * 60 + 300) * speed())
  }
  void $(".symbols").offsetWidth
  requestAnimationFrame(() => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells[r]![c]!.style.top = topPct(c)
  })
  await sleep(380 + 5 * 60 + 6 * 22 + 60)
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells[r]![c]!.style.transitionDelay = ""
  const scat = board.flat().filter((s) => s === "S" || s === "S2").length
  if (scat >= 3) sfx.scatter(scat)
}

async function evWinInfo(e: BookEvent) {
  const wins = e.wins as { symbol: Code; clusterSize: number; win: number; positions: Pos[]; meta: { clusterMult: number; overlay: Pos } }[]
  for (const w of wins) {
    for (const p of w.positions) cells[p.reel]![p.row]?.classList.add("win")
    const o = w.meta.overlay
    const pop = h(`<div class="win-pop" style="left:${((o.reel + 0.5) * 100) / N}%;top:${((o.row + 0.5) * 100) / N}%">${fmt(bookToApi(w.win))}</div>`)
    $(".grid").append(pop)
    setTimeout(() => pop.remove(), 950 * speed())
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
    await overlay(`<h1>THE LEVIATHAN RISES</h1><p>A ${info.size}×${info.size} Leviathan surfaces</p>`, 1800)
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
  for (const p of exploding) {
    const el = cells[p.reel]![p.row]
    if (el) {
      el.classList.remove("win")
      el.classList.add("pop")
    }
  }
  sfx.pop()
  await sleep(380)
  const gone = new Set(exploding.map((p) => `${p.reel},${p.row}`))
  for (let r = 0; r < N; r++) {
    const survivors: { code: Code; el: HTMLElement }[] = []
    for (let c = 0; c < N; c++) {
      const el = cells[r]![c]!
      if (gone.has(`${r},${c}`)) el.remove()
      else survivors.push({ code: st.board[r]![c]!, el })
    }
    const fresh = newSyms[r] ?? []
    const column: Code[] = [...fresh, ...survivors.map((s) => s.code)]
    st.board[r] = column
    survivors.forEach((s, i) => {
      const row = fresh.length + i
      s.el.classList.add("fall")
      s.el.style.top = topPct(row)
      cells[r]![row] = s.el
    })
    fresh.forEach((code, i) => {
      const el = makeCell(code, r, i, i - fresh.length)
      el.classList.add("fall")
      cells[r]![i] = el
    })
  }
  void $(".symbols").offsetWidth
  requestAnimationFrame(() => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells[r]![c]!.style.top = topPct(c)
  })
  await sleep(440)
  document.querySelectorAll(".cell.fall").forEach((el) => el.classList.remove("fall"))
}

async function playEvents(events: BookEvent[], opts: { mode: string }) {
  st.spinBase = 0
  setWinReadout(0)
  banner("")
  setDamage(0)
  setTierUi(null)
  let feature = false
  let finalUnits = 0
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
          `<h1>${TIER[tier]!.name.toUpperCase()}</h1><p>${FREE_SPINS} FREE SPINS · every spot starts at ${TIER[tier]!.start}×</p>`,
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
        await overlay(`<h1>MAX WIN</h1><div class="amount">${fmt(bookToApi(WINCAP * 100))}</div><p>${WINCAP.toLocaleString("en-US")}× reached!</p>`, 4000)
        break
      case "finalWin":
        finalUnits = e.amount as number
        setWinReadout(finalUnits)
        break
    }
  }
  if (!feature && (opts.mode === "mystery" || opts.mode === "mystery_deep")) banner("THE DEPTHS STAY QUIET")
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
  return `<article class="bcard${row2 ? " r2" : ""}${ABYSS.has(id) ? " has-abyss" : ""}" data-mode="${id}">
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
  const compass = (c: Code, cls = "") => `<span class="t ${cls}">${symbolSvg(c)}</span>`
  const mini = (n: number) => `${compass("S")}<span class="mini">${Array.from({ length: 36 }, () => `<i>${n}×</i>`).join("")}</span>${compass("S")}`
  const render = () => `
    <h2>${t("Buy Feature")}</h2>
    <div class="buy-grid">
      ${buyCard("hunt", "Leviathan Hunt", "Every bonus 10× as likely, every spin", `${compass("S", "fan")}${compass("S", "fan")}${compass("S", "fan")}`)}
      ${buyCard("deep_hunt", "Trench Hunt", "Maelstrom & Abyssal 150× as likely", `${compass("S", "fan")}${compass("S2", "fan")}${compass("S", "fan")}`)}
      ${buyCard("mystery", "Mystery Depths", "A hidden bonus — or nothing at all", `<span class="q">?</span><span class="pct">10%</span>`)}
      ${buyCard("mystery_deep", "Abyssal Mystery", "Undertow or Abyssal — or nothing", `<span class="q">?</span><span class="pct">10%</span>`)}
      ${buyCard("bonus", "Riptide", "10 free spins, spots start at 1×", mini(1), true)}
      ${buyCard("super", "Undertow", "10 free spins, spots start at 2×", mini(2))}
      ${buyCard("ultra", "Maelstrom", "10 free spins, spots start at 4×", mini(4))}
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
  return `<div class="pay"><span class="sv">${symbolSvg(code)}</span><div><div class="nm">${SYMBOL_NAMES[code]}</div><table>${tiers
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
    <div class="pay"><span class="sv">${symbolSvg("W")}</span><p>${t("Substitutes for every paying symbol. After a winning cluster that contains a Wild has paid, every multiplier spot under that cluster doubles, up to 64×.")}</p></div>

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
    <div class="pay"><span class="sv">${symbolSvg("H6")}</span><p>${t("Leviathan mega symbol pays by the cells it covers: 5–15 → 100×, 16–24 → 1,000×, 25–35 → 10,000×, 36 → 100,000×. A 3×3 pays 100×, 4×4 1,000×, 5×5 10,000×, 6×6 100,000×. Spot multipliers do not apply to it.")}</p></div>

    <h3>Sunken Compass &amp; free spins</h3>
    <div class="pay"><span class="sv">${symbolSvg("S")}</span><p>${t("Scatter. 3 Compasses award Riptide, 4 award Undertow, 5 award Maelstrom. Every feature is 10 free spins with no retriggers.")}</p></div>
    <div class="pay"><span class="sv">${symbolSvg("S2")}</span><p>${t("Abyssal Compass: on a 5-Compass trigger one Compass can upgrade to the Abyssal Compass (4 + Abyssal), awarding the Abyssal feature.")}</p></div>
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
  $(".buy-badge").textContent = t("BUY FEATURE")
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

async function boot() {
  if (params.get("social") === "true") setSocial(true)
  buildDom()
  initialBoard()
  setDamage(0)
  setTierUi(null)
  wire()
  if (st.replay) {
    $("#loader")?.remove()
    await bootReplay()
    return
  }
  st.provider = createProvider()
  if (st.provider.kind === "demo") {
    const tag = $(".logo .tag")
    tag.hidden = false
    tag.textContent = "DEMO"
  }
  try {
    const auth = await st.provider.authenticate()
    st.jur = auth.jurisdiction as Record<string, unknown>
    if (st.jur.socialCasino) setSocial(true)
    st.currency = auth.balance.currency
    st.levels = auth.betLevels
    st.betIdx = Math.max(0, st.levels.indexOf(auth.defaultBet))
    setBalance(auth.balance.amount)
    relabel()
    syncButtons()
    if (auth.activeRound) await resume(auth.activeRound)
  } catch (err) {
    console.warn(err)
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
