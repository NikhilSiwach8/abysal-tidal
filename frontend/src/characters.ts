/**
 * Character performance: the harpooner and the Leviathan react to what happens on the board.
 *
 * Every reaction is a Web Animation on the character's outer box with `composite: "add"`, so it
 * stacks on top of the idle breathing, the rig sway, the pre-rendered video loop and the spear
 * lunge instead of replacing them. Transform only (composited). Reduced motion: nothing moves.
 *
 *   hero:      brace (spin), nod (win), lean (tease, held), leap (bonus), thrust (power-up),
 *              idle weight shifts
 *   leviathan: flinch (compass lands), lean (tease, held), roar (power-up / bonus), death shake,
 *              idle snarls, hurt stages (wound tint + faster breathing as HP drops)
 */
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)"
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches

let speed: () => number = () => 1
let idleCheck: () => boolean = () => false
const hero = () => document.querySelector<HTMLElement>(".hero")
const lev = () => document.querySelector<HTMLElement>(".leviathan")

function play(el: HTMLElement | null, frames: Keyframe[], ms: number, easing = EASE_OUT, fill: FillMode = "none"): Animation | null {
  if (!el || reduced()) return null
  return el.animate(frames, { duration: ms * speed(), easing, composite: "add", fill })
}

const T0 = { transform: "translate(0, 0) rotate(0deg) scale(1)" }

// ---------------------------------------------------------------- hero
let lastNod = 0
export const heroAct = {
  /** Spin starts: a short brace, weight dropping into the knees. */
  brace() {
    play(hero(), [T0, { transform: "translate(0, 1.4%) rotate(-.6deg) scale(1, .985)", offset: 0.35 }, T0], 420)
  },
  /** A cluster wins: a small approving lift (throttled: tumbles chain quickly). */
  nod() {
    const now = performance.now()
    if (now - lastNod < 700) return
    lastNod = now
    play(hero(), [T0, { transform: "translate(0, -1.6%) rotate(-1deg)", offset: 0.4 }, T0], 460)
  },
  /** The bonus is won: crouch, then spring up and land. */
  leap() {
    play(hero(), [T0,
      { transform: "translate(0, 2%) rotate(0deg) scale(1.02, .95)", offset: 0.22 },
      { transform: "translate(1%, -7%) rotate(-2deg) scale(.98, 1.04)", offset: 0.55 },
      { transform: "translate(0, .8%) rotate(0deg) scale(1.02, .97)", offset: 0.82 }, T0], 860, EASE_IN_OUT)
  },
  /** A power-up fires: the harpoon thrusts toward the beast. */
  thrust() {
    play(hero(), [T0, { transform: "translate(3.5%, -.5%) rotate(2.5deg)", offset: 0.35 }, T0], 380)
  },
}

// ---------------------------------------------------------------- leviathan
export const levAct = {
  /** A compass lands: the beast's attention snaps to it. */
  flinch() {
    play(lev(), [T0, { transform: "translate(1.2%, 0) rotate(1deg)", offset: 0.3 }, T0], 320)
  },
  /** Power-up / bonus: rears back, then lunges with a shudder. */
  roar() {
    play(lev(), [T0,
      { transform: "translate(2.5%, .5%) rotate(2.5deg)", offset: 0.22 },
      { transform: "translate(-4%, -1%) rotate(-3deg) scale(1.04)", offset: 0.48 },
      { transform: "translate(-3.4%, -1%) rotate(-2.4deg) scale(1.04)", offset: 0.56 },
      { transform: "translate(-4.2%, -1%) rotate(-3.2deg) scale(1.04)", offset: 0.64 },
      T0], 980, EASE_IN_OUT)
  },
  /** Slain: a violent shudder as it collapses (the sink itself is CSS on .slain). */
  death() {
    play(lev(), [T0,
      { transform: "translate(-1.5%, 0) rotate(-2deg)", offset: 0.15 },
      { transform: "translate(1.5%, 0) rotate(2deg)", offset: 0.3 },
      { transform: "translate(-1%, 0) rotate(-1.5deg)", offset: 0.45 },
      { transform: "translate(.6%, 0) rotate(.8deg)", offset: 0.6 }, T0], 700)
  },
  /** Wound stages from damage (0..200): tint deepens and breathing quickens. */
  hurt(damage: number) {
    const el = lev()
    if (!el) return
    const stage = damage >= 175 ? 3 : damage >= 125 ? 2 : damage >= 75 ? 1 : 0
    for (let i = 1; i <= 3; i++) el.classList.toggle(`hurt-${i}`, stage === i)
  },
}

// ---------------------------------------------------------------- held poses (tease)
let leanH: Animation | null = null
let leanL: Animation | null = null
/** Both lean in while a reel teases a bonus; release eases back. */
export function tensionLean(on: boolean) {
  if (on) {
    if (leanH) return
    leanH = play(hero(), [T0, { transform: "translate(2%, .6%) rotate(2.2deg)" }], 520, EASE_OUT, "forwards")
    leanL = play(lev(), [T0, { transform: "translate(-2.4%, .4%) rotate(-1.6deg)" }], 520, EASE_OUT, "forwards")
    return
  }
  for (const a of [leanH, leanL]) {
    if (!a) continue
    a.updatePlaybackRate(1.4)
    a.reverse()
    a.finished.then(() => a.cancel(), () => {})
  }
  leanH = leanL = null
}

// ---------------------------------------------------------------- idle life
/** Idle variations between rounds: the Leviathan snarls, the harpooner shifts his grip. */
function idleLoop() {
  const next = (min: number, max: number, fn: () => void) => setTimeout(() => {
    if (idleCheck() && !document.hidden) fn()
    next(min, max, fn)
  }, min + Math.random() * (max - min))
  next(6500, 10500, () => play(lev(), [T0,
    { transform: "translate(-3%, -.6%) rotate(-2.6deg) scale(1.025)", offset: 0.35 },
    { transform: "translate(-2.6%, -.6%) rotate(-2.2deg) scale(1.025)", offset: 0.55 }, T0], 1100, EASE_IN_OUT))
  next(8000, 13000, () => play(hero(), [T0,
    { transform: "translate(-.8%, .3%) rotate(-1.2deg)", offset: 0.4 },
    { transform: "translate(.4%, 0) rotate(.6deg)", offset: 0.75 }, T0], 1800, EASE_IN_OUT))
}

export function initCharacters(getSpeed: () => number, isIdle: () => boolean) {
  speed = getSpeed
  idleCheck = isIdle
  for (const [el, origin] of [[hero(), "50% 100%"], [lev(), "40% 100%"]] as const) if (el) el.style.transformOrigin = origin
  idleLoop()
}
