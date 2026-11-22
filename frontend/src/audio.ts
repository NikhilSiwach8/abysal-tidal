/**
 * Abyssal Tide audio engine (WebAudio).
 *
 * Sounds are original renders from tools/sound_design.py (bundled MP3s, no network beyond the
 * game's own files). Mix: master -> [music bus, ambience bus, sfx bus]. Music crossfades between
 * the base and bonus tracks and ducks under big moments; the ambience bed runs under everything.
 * Loops use native looping between loopStart = 0.15 s and loopStart + loop length (from the
 * manifest), which is immune to MP3 encoder padding. Until a sound has decoded (or if decoding
 * fails) the older synthesised blip plays instead, so nothing is ever silent by error.
 * Sound and music on/off are remembered; the context suspends while the tab is hidden.
 */
import manifest from "./audio_manifest.json"

const files = import.meta.glob("./assets/audio/*.mp3", { eager: true, import: "default", query: "?url" }) as Record<string, string>
const URLS: Record<string, string> = {}
for (const [p, u] of Object.entries(files)) URLS[p.replace("./assets/audio/", "").replace(".mp3", "")] = u
const LOOPS = manifest as Record<string, { bus: string; loop?: number }>
const LOOP_START = 0.15

type Tone = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slide?: number }
type Bus = "sfx" | "music" | "amb"
type Voice = { src: AudioBufferSourceNode; gain: GainNode }

const LEVEL = { master: 0.8, music: 0.42, amb: 0.5, sfx: 0.95 }
const KEY_MUTED = "abyssal-tide:muted"
const KEY_MUSIC = "abyssal-tide:music"

function stored(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? def : v === "1"
  } catch {
    return def
  }
}
function store(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0")
  } catch {
    /* storage blocked */
  }
}

class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: Partial<Record<Bus, GainNode>> = {}
  private duckGain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private loading: Promise<void> | null = null
  private track: { name: string; voice: Voice } | null = null
  private wantTrack: string | null = null
  private amb: Voice | null = null
  private tease: Voice | null = null
  private counting: Voice | null = null
  private lastMult = 0
  muted = stored(KEY_MUTED, false)
  musicOn = stored(KEY_MUSIC, true)

  /** Create/resume the context; must run inside a user gesture. Starts loading every sound. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = (this.ctx = new Ctor())
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : LEVEL.master
    // gentle bus compressor keeps stacked wins from spiking
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    comp.attack.value = 0.005
    comp.release.value = 0.2
    this.master.connect(comp).connect(ctx.destination)
    this.duckGain = ctx.createGain()
    this.duckGain.connect(this.master)
    for (const b of ["sfx", "music", "amb"] as Bus[]) {
      const g = ctx.createGain()
      g.gain.value = b === "music" ? (this.musicOn ? LEVEL.music : 0) : b === "amb" ? (this.musicOn ? LEVEL.amb : 0) : LEVEL.sfx
      g.connect(b === "music" ? this.duckGain : this.master)
      this.bus[b] = g
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return
      if (document.hidden) void this.ctx.suspend()
      else void this.ctx.resume()
    })
    this.loading = this.loadAll()
  }

  private async loadAll(): Promise<void> {
    const ctx = this.ctx!
    // music last: effects are needed first
    const names = Object.keys(URLS).sort((a, b) => Number(LOOPS[a]?.bus === "music") - Number(LOOPS[b]?.bus === "music"))
    await Promise.all(names.map(async (n) => {
      try {
        const buf = await (await fetch(URLS[n]!)).arrayBuffer()
        this.buffers.set(n, await ctx.decodeAudioData(buf))
        if (n === "amb_deep") this.startAmbience()
        if (this.wantTrack && n === `music_${this.wantTrack}`) this.music(this.wantTrack as "base" | "bonus")
      } catch {
        /* missing or undecodable: the synth fallback covers it */
      }
    }))
  }

  setMuted(m: boolean): void {
    this.muted = m
    store(KEY_MUTED, m)
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : LEVEL.master, this.ctx.currentTime, 0.04)
  }

  setMusic(on: boolean): void {
    this.musicOn = on
    store(KEY_MUSIC, on)
    const ctx = this.ctx
    if (!ctx) return
    this.bus.music?.gain.setTargetAtTime(on ? LEVEL.music : 0, ctx.currentTime, 0.2)
    this.bus.amb?.gain.setTargetAtTime(on ? LEVEL.amb : 0, ctx.currentTime, 0.2)
  }

  // ---------------------------------------------------------------- playback core
  private voice(name: string, opt: { gain?: number; rate?: number; delay?: number; bus?: Bus; loop?: boolean; fadeIn?: number } = {}): Voice | null {
    const ctx = this.ctx
    const buf = this.buffers.get(name)
    if (!ctx || !buf) return null
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = opt.rate ?? 1
    const meta = LOOPS[name]
    if (opt.loop && meta?.loop) {
      src.loop = true
      src.loopStart = LOOP_START
      src.loopEnd = LOOP_START + meta.loop
    }
    const g = ctx.createGain()
    const at = ctx.currentTime + (opt.delay ?? 0)
    const level = opt.gain ?? 1
    if (opt.fadeIn) {
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(level, at + opt.fadeIn)
    } else g.gain.value = level
    src.connect(g).connect(this.bus[opt.bus ?? (meta?.bus as Bus) ?? "sfx"]!)
    src.start(at, opt.loop ? 0 : 0)
    return { src, gain: g }
  }

  private stopVoice(v: Voice | null, fade = 0.25) {
    const ctx = this.ctx
    if (!v || !ctx) return
    const now = ctx.currentTime
    v.gain.gain.cancelScheduledValues(now)
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now)
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade)
    try {
      v.src.stop(now + fade + 0.05)
    } catch {
      /* already stopped */
    }
  }

  /** Play a one-shot; falls back to `synth` if the sample is not ready. */
  private play(name: string, opt: Parameters<Audio["voice"]>[1] = {}, synth?: () => void): Voice | null {
    if (this.muted) return null
    const v = this.voice(name, opt)
    if (!v && synth) synth()
    return v
  }

  /** Dip the music for a big moment (sidechain-style), then recover. */
  duck(depth = 0.35, hold = 1.2, release = 0.8): void {
    const ctx = this.ctx
    const g = this.duckGain?.gain
    if (!ctx || !g) return
    const now = ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(depth, now + 0.08)
    g.setValueAtTime(depth, now + hold)
    g.linearRampToValueAtTime(1, now + hold + release)
  }

  // ---------------------------------------------------------------- music + ambience
  private startAmbience() {
    if (this.amb || !this.buffers.has("amb_deep")) return
    this.amb = this.voice("amb_deep", { loop: true, fadeIn: 3, bus: "amb" })
  }

  /** Switch the music track ("base" or "bonus") with a crossfade; null fades it out. */
  music(name: "base" | "bonus" | null): void {
    this.wantTrack = name
    if (!this.ctx) return
    if (this.track?.name === name) return
    const old = this.track
    this.track = null
    if (old) this.stopVoice(old.voice, 1.6)
    if (!name) return
    const v = this.voice(`music_${name}`, { loop: true, fadeIn: old ? 1.4 : 2.5, bus: "music" })
    if (v) this.track = { name, voice: v }
  }

  // ---------------------------------------------------------------- game events
  spin() { this.play("spin", { gain: 0.8, rate: 0.96 + Math.random() * 0.08 }, () => this.noise(0.45, 400, 1600, 0.09, 0.7)) }
  /** Reel stop: a step brighter per reel, so a full stop reads as one rising phrase. */
  land(reel: number) { this.play("reel_stop", { gain: 0.85, rate: 0.94 + reel * 0.035 }, () => this.tones([{ f: 120 + reel * 9, t: 0, d: 0.14, type: "triangle", g: 0.2, slide: 70 }])) }
  /** Tumble refill landing: softer and lighter than a reel stop. */
  fall(reel: number) { this.play("reel_stop", { gain: 0.42, rate: 1.12 + reel * 0.02 }) }
  pop() { this.play("tumble_pop", { gain: 0.8, rate: 0.94 + Math.random() * 0.12 }, () => this.tones([{ f: 900, t: 0, d: 0.12, g: 0.1, slide: 1500 }])) }
  win(level = 1) {
    const n = Math.max(1, Math.min(3, level - (level > 3 ? 1 : 0)))
    this.play(`win_${n}`, { gain: 0.8 }, () => this.tones([392, 493.9, 587.3].map((f, i) => ({ f, t: i * 0.07, d: 0.32, type: "triangle", g: 0.11 }))))
  }
  /** A multiplier spot doubles (throttled: many spots change together). */
  mult() {
    const now = performance.now()
    if (now - this.lastMult < 140) return
    this.lastMult = now
    this.play("mult_up", { gain: 0.55, rate: 0.97 + Math.random() * 0.06 })
  }
  /** A scatter lands: the compass chime climbs a whole tone per scatter on the board. */
  scatterLand(n: number) { this.play("scatter_land", { gain: 0.8, rate: Math.pow(2, (2 * (Math.min(n, 6) - 1)) / 12) }, () => this.tones([{ f: 660 * Math.pow(1.122, n - 1), t: 0, d: 0.35, g: 0.13 }])) }
  /** Bonus triggered. */
  scatter(_n: number) {
    this.duck(0.3, 2.0, 1.2)
    this.play("scatter_trigger", { gain: 0.95 }, () => this.tones([{ f: 520, t: 0, d: 0.7, g: 0.14 }]))
  }
  /** Tease: heartbeat loop while reels hold back; faster and tighter as more scatters land. */
  teaseStart(level: number) {
    if (this.muted) return
    const rate = 1 + Math.max(0, level - 2) * 0.12
    if (this.tease) {
      this.tease.src.playbackRate.setTargetAtTime(rate, this.ctx!.currentTime, 0.1)
      return
    }
    this.duck(0.55, 30, 0.6)
    this.tease = this.voice("tease_loop", { loop: true, rate, gain: 0.8, fadeIn: 0.12 })
  }
  teaseStop() {
    this.stopVoice(this.tease, 0.3)
    this.tease = null
    this.duck(0.55, 0, 0.6)
  }
  /** Leviathan takes damage. */
  hit() { this.play("lev_hit", { gain: 0.75, rate: 0.92 + Math.random() * 0.14 }, () => this.noise(0.25, 180, 60, 0.18, 1.5)) }
  /** Power-up fires (every 25 damage). */
  power() { this.play("powerup", { gain: 0.85 }, () => this.tones([0, 1, 2, 3].map((i) => ({ f: 300 * Math.pow(1.26, i), t: i * 0.06, d: 0.3, type: "sawtooth" as OscillatorType, g: 0.04 })))) }
  /** The Leviathan rises (200 damage) / surfaces. */
  roar() {
    this.duck(0.25, 2.4, 1.2)
    this.play("lev_roar", { gain: 0.95 })
  }
  /** Free-spins tier announced. */
  featureIntro() {
    this.duck(0.2, 2.2, 1)
    this.play("feature_intro", { gain: 0.95 }, () => this.tones([{ f: 1318.5, t: 0, d: 0.5, g: 0.08 }]))
  }
  featureEnd() { this.play("feature_end", { gain: 0.85 }) }
  /** Big-win count-up: shimmer loop while counting, stinger when it lands. */
  bigWinStart() {
    if (this.muted) return
    this.duck(0.3, 30, 0.8)
    this.stopVoice(this.counting, 0.05)
    this.counting = this.voice("bigwin_loop", { loop: true, gain: 0.7, fadeIn: 0.1 })
    if (!this.counting) this.tones([392, 523.3, 659.3, 784].map((f, i) => ({ f, t: i * 0.11, d: 0.45, type: "triangle", g: 0.12 })))
  }
  bigWinEnd() {
    this.stopVoice(this.counting, 0.15)
    this.counting = null
    this.play("bigwin_end", { gain: 0.95 })
    this.duck(0.3, 2.2, 1.4)
  }
  /** Depth Wheel: a tick per peg, then the result. */
  wheelTick(rate = 1) { this.play("wheel_tick", { gain: 0.5, rate: rate * (0.95 + Math.random() * 0.1) }) }
  wheelLand(hit: boolean) {
    this.duck(0.35, 1.6, 1)
    this.play(hit ? "wheel_win" : "wheel_miss", { gain: 0.9 })
  }
  /** Showdown title slam. */
  slam() {
    this.duck(0.2, 1.8, 1)
    this.play("slam", { gain: 0.95 }, () => this.noise(0.25, 180, 60, 0.18, 1.5))
  }
  click() { this.play("ui_click", { gain: 0.7 }, () => this.tones([{ f: 700, t: 0, d: 0.05, type: "triangle", g: 0.06 }])) }
  buy() { this.play("ui_buy", { gain: 0.8 }) }

  // ---------------------------------------------------------------- synth fallback
  private tones(list: Tone[]): void {
    const ctx = this.ctx
    const out = this.bus.sfx
    if (!ctx || !out || this.muted) return
    const now = ctx.currentTime
    for (const n of list) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = n.type ?? "sine"
      o.frequency.setValueAtTime(n.f, now + n.t)
      if (n.slide) o.frequency.exponentialRampToValueAtTime(n.slide, now + n.t + n.d)
      g.gain.setValueAtTime(0.0001, now + n.t)
      g.gain.exponentialRampToValueAtTime(n.g ?? 0.18, now + n.t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
      o.connect(g).connect(out)
      o.start(now + n.t)
      o.stop(now + n.t + n.d + 0.05)
    }
  }

  private noise(dur: number, from: number, to: number, gain = 0.12, q = 1): void {
    const ctx = this.ctx
    const out = this.bus.sfx
    if (!ctx || !out || this.muted) return
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.Q.value = q
    const now = ctx.currentTime
    f.frequency.setValueAtTime(from, now)
    f.frequency.exponentialRampToValueAtTime(to, now + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + dur * 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    src.connect(f).connect(g).connect(out)
    src.start()
  }

  /** For QA: which sounds have decoded. */
  get loaded(): string[] {
    return [...this.buffers.keys()].sort()
  }
  get ready(): Promise<void> {
    return this.loading ?? Promise.resolve()
  }
}

export const sfx = new Audio()
