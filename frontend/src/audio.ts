/**
 * WebAudio-synthesised sound effects — nothing is loaded from the network.
 * spin, land(reel), pop, win, scatter, pearl, bigWin, click; mute is remembered.
 */
type Tone = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slide?: number }

class Audio {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem("abyssal-tide:muted") === "1"
    } catch {
      /* storage blocked */
    }
  }

  /** Create/resume the context; must run inside a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    this.out = this.ctx.createGain()
    this.out.gain.value = this.muted ? 0 : 0.5
    this.out.connect(this.ctx.destination)
  }

  setMuted(m: boolean): void {
    this.muted = m
    try {
      localStorage.setItem("abyssal-tide:muted", m ? "1" : "0")
    } catch {
      /* ignore */
    }
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.04)
  }

  private tones(list: Tone[]): void {
    const { ctx, out } = this
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
    const { ctx, out } = this
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

  spin() { this.noise(0.45, 400, 1600, 0.09, 0.7) }
  land(reel: number) { this.tones([{ f: 120 + reel * 9, t: 0, d: 0.14, type: "triangle", g: 0.2, slide: 70 }]) }
  pop() { this.tones([{ f: 900, t: 0, d: 0.12, type: "sine", g: 0.1, slide: 1500 }]); this.noise(0.15, 2500, 5000, 0.04, 2) }
  win(level = 1) {
    const base = [392, 493.9, 587.3, 784, 987.8]
    this.tones(base.slice(0, 2 + Math.min(3, level)).map((f, i) => ({ f, t: i * 0.07, d: 0.32, type: "triangle", g: 0.11 })))
  }
  scatter(n: number) { this.tones([{ f: 520 * Math.pow(1.12, n), t: 0, d: 0.7, g: 0.14 }, { f: 1040 * Math.pow(1.12, n), t: 0.03, d: 0.45, g: 0.05 }]) }
  /** Heartbeat while a reel teases a bonus; brighter as more scatters are down. */
  tease(level: number) {
    this.tones([{ f: 62, t: 0, d: 0.16, type: "sine", g: 0.22, slide: 40 }, { f: 62, t: 0.17, d: 0.14, type: "sine", g: 0.14, slide: 40 }])
    this.tones([{ f: 330 * Math.pow(1.19, Math.min(level, 5) - 2), t: 0, d: 0.3, type: "triangle", g: 0.035 }])
  }
  /** A scatter lands: rising chime, one step per scatter on the board. */
  scatterLand(n: number) {
    const f = 660 * Math.pow(1.122, Math.min(n, 6) - 1)
    this.tones([{ f, t: 0, d: 0.35, type: "sine", g: 0.13 }, { f: f * 2, t: 0.02, d: 0.25, type: "triangle", g: 0.04 }])
  }
  pearl() { this.tones([{ f: 1318.5, t: 0, d: 0.5, g: 0.08 }, { f: 1760, t: 0.08, d: 0.5, g: 0.06 }]) }
  hit() { this.noise(0.25, 180, 60, 0.18, 1.5); this.tones([{ f: 90, t: 0, d: 0.25, type: "square", g: 0.06, slide: 45 }]) }
  power() { this.tones([0, 1, 2, 3].map((i) => ({ f: 300 * Math.pow(1.26, i), t: i * 0.06, d: 0.3, type: "sawtooth" as OscillatorType, g: 0.04 }))) }
  bigWin() {
    const seq = [392, 523.3, 659.3, 784, 659.3, 784, 1046.5, 1318.5]
    this.tones(seq.map((f, i) => ({ f, t: i * 0.11, d: 0.45, type: "triangle", g: 0.12 })))
    this.tones(seq.map((f, i) => ({ f: f / 2, t: i * 0.11, d: 0.5, type: "sawtooth", g: 0.03 })))
  }
  click() { this.tones([{ f: 700, t: 0, d: 0.05, type: "triangle", g: 0.06 }]) }
}

export const sfx = new Audio()
