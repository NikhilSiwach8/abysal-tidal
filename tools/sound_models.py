"""Physical / acoustic models for the Abyssal Tide sound set (used by tools/sound_design.py).

Each model imitates how the real thing makes sound, so the result reads as an object
or creature instead of a "synth beep":
  bubble()      Minnaert resonance: a bubble rings at f = 3.26/r Hz, rising as it floats up
  bubbles()     a cloud of those (water, bursting symbols, rising treasure)
  creak()       stick-slip friction (rope on a pulley, a ship's hull) exciting wood modes
  wood_knock()  modal wood block (planks, the ship's wheel, ratchet)
  ship_bell()   cast-bronze bell partials (hum, prime, tierce, quint, nominal ...)
  brass_plate() inharmonic plate modes (the compass case)
  frame_drum()  circular-membrane (Bessel) modes + slap
  cello()       sawtooth "bow" with vibrato and bow noise through a cello-body resonance
  conch()       lip-buzzed shell horn: pulse wave, pitch scoop, horn formants, breath
  voice()       glottal source through vowel formants (whale song, choir, the Leviathan)
  wave()        surf / surge: shaped noise with a travelling low-pass
  whistle()     a harpoon in flight: narrow-band noise with a Doppler glide
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
_rng = np.random.default_rng(23)


def _t(dur):
    return np.arange(int(dur * SR)) / SR


def _band(x, lo, hi, order=2):
    nyq = SR / 2
    sos = butter(order, [max(20, lo) / nyq, min(hi, nyq * 0.98) / nyq], btype="band", output="sos")
    return sosfilt(sos, x)


def _lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR * 0.49) / (SR / 2), output="sos"), x)


def _hp(x, f, order=2):
    return sosfilt(butter(order, max(20, f) / (SR / 2), btype="high", output="sos"), x)


def _res(x, f, q):
    """Two-pole resonator (narrow band-pass) centred on f."""
    bw = f / q
    return _band(x, f - bw / 2, f + bw / 2, 1)


def _place(dst, src, at):
    i = int(round(at * SR))
    if i >= len(dst) or i + len(src) <= 0:
        return dst
    s0 = max(0, -i)
    j = min(len(dst), i + len(src))
    dst[max(i, 0):j] += src[s0: s0 + j - max(i, 0)]
    return dst


# ---------------------------------------------------------------- water
def bubble(radius_mm=2.0, dur=None, rise=0.15, amp=1.0, rng=None):
    """One bubble: damped sine at the Minnaert frequency, pitch rising as it ascends."""
    f0 = 3.26 / (radius_mm / 1000)
    tau = 0.012 + radius_mm * 0.006
    dur = dur or tau * 6
    t = _t(dur)
    f = f0 * (1 + rise * t / dur * 4)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / tau) * np.minimum(1, t / 0.0015) * amp


def bubbles(dur, count, r_range=(1.0, 4.0), spread=None, amp=0.5, seed=1, rise=0.2):
    """A cloud of bubbles over `spread` seconds (default the whole duration)."""
    r = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    spread = dur if spread is None else spread
    for _ in range(count):
        rad = np.exp(r.uniform(np.log(r_range[0]), np.log(r_range[1])))
        _place(out, bubble(rad, rise=rise, amp=r.uniform(0.3, 1.0) * amp), r.uniform(0, spread))
    return out


def wave(dur, peak=0.4, lo=120, hi=2600, seed=3, shape=2.0):
    """Surf/surge: brown+pink noise, rising to a crest at `peak` (0..1 of dur) then washing out."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    w = r.standard_normal(n)
    pink = np.fft.irfft(np.fft.rfft(w) / np.sqrt(np.arange(n // 2 + 1) + 1), n) * 14
    t = np.linspace(0, 1, n)
    envl = np.where(t < peak, (t / peak) ** shape, np.exp(-(t - peak) / (1 - peak) * 3.2))
    # the crest opens the filter (bright foam), the wash closes it again
    lowband = _lp(pink, lo * 4) * 0.9
    foam = _band(pink, lo * 3, hi) * envl ** 1.5
    return (lowband + foam) * envl


def underwater(x, f=2200):
    """Everything heard below the surface loses its top end."""
    return _lp(x, f, 4)


# ---------------------------------------------------------------- wood, rope, metal
def wood_knock(f=220, dur=0.25, hardness=1.0, seed=0):
    """Modal wood block: a few strongly damped, slightly inharmonic modes + contact click."""
    t = _t(dur)
    modes = [(1.0, 1.0, 0.045), (2.32, 0.55, 0.025), (4.25, 0.35, 0.014), (6.1, 0.2, 0.008)]
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / d) for m, a, d in modes)
    click = _band(np.random.default_rng(seed).standard_normal(len(t)), 1500, 7000) * np.exp(-t / 0.002) * 0.4 * hardness
    return (x + click) * np.minimum(1, t / 0.0006)


def creak(dur, rate=(25, 70), modes=(320, 690, 1240), q=9, amp=1.0, seed=5):
    """Stick-slip friction: an irregular impulse train (rate glides) ringing wooden modes."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    rates = np.geomspace(rate[0], rate[1], n) * (1 + 0.25 * np.sin(np.linspace(0, 7, n)))
    phase = np.cumsum(rates / SR)
    imp = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(phase)) > 0)[0]
    imp[idx] = r.uniform(0.5, 1.0, len(idx))
    out = sum(_res(imp, m * r.uniform(0.97, 1.03), q) for m in modes)
    envl = np.sin(np.pi * np.linspace(0, 1, n)) ** 0.6
    return out * envl * amp * 6


def ratchet(dur, ticks, f=2600, accel=1.0, amp=1.0, seed=2):
    """Metal/wood ratchet: `ticks` clicks; accel>1 speeds up, <1 slows down."""
    out = np.zeros(int(dur * SR))
    u = np.linspace(0, 1, ticks) ** accel
    for k, a in enumerate(u):
        _place(out, wood_knock(f * (1 + 0.02 * (k % 3)), 0.03, 1.4, seed + k) * 0.6 * amp, a * (dur - 0.04))
    return out


def ship_bell(f=440.0, dur=4.0, amp=1.0, strike=1.0):
    """Cast-bronze bell. Partials relative to the strike note (hum .5, prime 1, minor-third tierce
    1.19, quint 1.5, nominal 2 ...), each with its own decay; pairs beat slightly like real castings."""
    t = _t(dur)
    parts = [(0.5, 0.55, 3.2), (1.0, 0.8, 2.4), (1.19, 0.6, 1.9), (1.5, 0.35, 1.4), (2.0, 1.0, 1.6),
             (2.51, 0.35, 0.9), (2.66, 0.3, 0.8), (3.01, 0.25, 0.6), (4.17, 0.18, 0.4), (5.43, 0.12, 0.28)]
    x = np.zeros_like(t)
    for ratio, a, dec in parts:
        for det in (-0.0015, 0.0015):
            x += a * 0.5 * np.sin(2 * np.pi * f * ratio * (1 + det) * t) * np.exp(-t / (dec * dur / 4))
    clang = _band(_rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t / 0.006) * 0.5 * strike
    return (x + clang) * np.minimum(1, t / 0.0008) * amp


def brass_plate(f=900.0, dur=1.5, amp=1.0):
    """Inharmonic plate modes: the compass case ringing after the needle clicks home."""
    t = _t(dur)
    ratios = [1.0, 1.63, 2.38, 2.97, 3.82, 4.66]
    x = sum(np.sin(2 * np.pi * f * r * t) * np.exp(-t / (0.5 / (1 + i * 0.6))) / (1 + i * 0.5) for i, r in enumerate(ratios))
    return x * np.minimum(1, t / 0.0005) * amp


# ---------------------------------------------------------------- drums
def frame_drum(f=95.0, dur=0.9, amp=1.0, slap=0.5, seed=4):
    """Circular membrane modes (Bessel zero ratios) + hand slap; slight pitch drop on impact."""
    t = _t(dur)
    bend = 1 + 0.12 * np.exp(-t / 0.03)
    ratios = [(1.0, 1.0, 0.32), (1.59, 0.55, 0.18), (2.14, 0.4, 0.12), (2.30, 0.3, 0.1), (2.65, 0.22, 0.08), (2.92, 0.15, 0.06)]
    x = np.zeros_like(t)
    for r_, a, d in ratios:
        ph = 2 * np.pi * np.cumsum(f * r_ * bend) / SR
        x += a * np.sin(ph) * np.exp(-t / d)
    hit = _lp(np.random.default_rng(seed).standard_normal(len(t)), 2500) * np.exp(-t / 0.012) * slap
    return (x + hit) * np.minimum(1, t / 0.0008) * amp


def deep_drum(f=55.0, dur=1.6, amp=1.0):
    """A big low war drum: longer membrane, more sub, felt beater."""
    return frame_drum(f, dur, amp, slap=0.25) + frame_drum(f * 0.5, dur, amp * 0.6, slap=0.0)


def shell_shaker(dur=0.12, amp=1.0, seed=6):
    """A rattle of shells: many tiny hard clicks in a short swarm."""
    r = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    for _ in range(14):
        _place(out, wood_knock(r.uniform(1400, 3200), 0.015, 0.8, int(r.integers(1e6))) * r.uniform(0.15, 0.45), r.uniform(0, dur * 0.6))
    return out * amp


# ---------------------------------------------------------------- instruments and voices
def _glottal(f, dur, vib=0.0, vib_rate=5.5, jitter=0.0, seed=0):
    """Band-limited sawtooth-like source with a gently falling spectrum (voice / bow / lips)."""
    t = _t(dur)
    r = np.random.default_rng(seed)
    ff = f * (1 + vib * np.sin(2 * np.pi * vib_rate * t + r.uniform(0, 6))) if np.ndim(f) == 0 else f * (1 + vib * np.sin(2 * np.pi * vib_rate * t))
    if jitter:
        ff = ff * (1 + jitter * _lp(r.standard_normal(len(t)), 30) * 8)
    ph = 2 * np.pi * np.cumsum(ff) / SR
    fmax = float(np.max(ff))
    k = max(1, int(SR / 2.3 / fmax))
    return sum(np.sin(ph * h) / h ** 1.15 for h in range(1, k + 1))


VOWELS = {"oo": (300, 870, 2240), "oh": (450, 800, 2830), "ah": (730, 1090, 2440), "uh": (520, 1190, 2390), "ee": (270, 2290, 3010)}


def formant(x, vowel="oh", q=(8, 10, 12), gains=(1.0, 0.5, 0.25)):
    fs = VOWELS[vowel] if isinstance(vowel, str) else vowel
    return sum(g * _res(x, f, qq) for f, qq, g in zip(fs, q, gains))


def cello(f, dur, amp=1.0, attack=0.25, release=0.4, vib=0.004, seed=0):
    """Bowed string: vibrato saw + bow hiss through a cello body (main air/wood resonances)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = _glottal(f, dur, vib, 5.2, 0.0015, seed)
    bow = _band(np.random.default_rng(seed).standard_normal(n), 1500, 6000) * 0.04
    body = 0.6 * _res(src, 220, 2.5) + 0.8 * _res(src, 420, 3) + 0.5 * _res(src, 1100, 2.5) + 0.25 * _res(src, 2600, 3) + 0.15 * src
    envl = np.minimum(1, t / attack) * np.clip((dur - t) / release, 0, 1)
    return _lp(body * 1.6 + bow, 3200, 2) * envl * amp


def cello_stab(f, dur=0.32, amp=1.0, seed=0):
    """Short, dug-in bow stroke for the hunt ostinato."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = _glottal(f, dur, 0.0, 5, 0.002, seed)
    body = 0.7 * _res(src, 220, 2.5) + 0.9 * _res(src, 420, 3) + 0.5 * _res(src, 1100, 2.5) + 0.2 * src
    scrape = _band(np.random.default_rng(seed).standard_normal(n), 2000, 7000) * np.exp(-t / 0.02) * 0.15
    envl = np.minimum(1, t / 0.012) * np.exp(-t / (dur * 0.45))
    return _lp(body * 1.6 + scrape, 2600, 4) * envl * amp


def conch(f=233.0, dur=1.8, amp=1.0, scoop=3.0, seed=0):
    """Shell horn: lips buzz up into the note (scoop in semitones), horn formants, breath."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    pitch = f * 2 ** (-(scoop / 12) * np.exp(-t / 0.09))
    src = _glottal(pitch, dur, 0.006, 4.8, 0.003, seed)
    body = 0.9 * _res(src, 480, 4) + 0.6 * _res(src, 1150, 5) + 0.3 * _res(src, 2600, 6) + 0.12 * src
    breath = _band(np.random.default_rng(seed + 1).standard_normal(n), 600, 3000) * 0.05
    envl = np.minimum(1, t / 0.08) * np.clip((dur - t) / 0.35, 0, 1) * (1 - 0.15 * np.exp(-((t - 0.25) / 0.2) ** 2))
    # gentle drive and a horn-bell roll-off: a shell horn is hollow, not buzzy
    return _lp(np.tanh((body * 2.0 + breath) * 1.0), 2400, 4) * envl * amp


def voice(f_curve, vowel_curve=("oo", "ah"), amp=1.0, vib=0.01, growl=0.0, seed=0):
    """Voice from a pitch curve (array of Hz): formants morph from vowel A to B.
    growl adds sub-harmonic amplitude modulation (creature roughness)."""
    n = len(f_curve)
    dur = n / SR
    t = np.arange(n) / SR
    src = _glottal(np.asarray(f_curve), dur, vib, 4.5, 0.004, seed)
    if growl:
        src = src * (1 + growl * np.sin(2 * np.pi * np.cumsum(np.asarray(f_curve) / 2) / SR))
    a = formant(src, vowel_curve[0])
    b = formant(src, vowel_curve[1])
    m = np.linspace(0, 1, n) ** 1.3
    return _lp(a * (1 - m) + b * m, 2600, 2) * amp


def whale_call(dur=2.4, f_from=180, f_to=420, back=260, amp=1.0, seed=0):
    """Humpback-like moan: a slow up-glide that bends back down, airy and resonant."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    up = f_from + (f_to - f_from) * np.sin(np.clip(u / 0.6, 0, 1) * np.pi / 2)
    down = f_to + (back - f_to) * np.clip((u - 0.6) / 0.4, 0, 1) ** 1.5
    f = np.where(u < 0.6, up, down)
    v = voice(f, ("oo", "oh"), amp, 0.004, 0.0, seed)
    envl = np.sin(np.pi * u) ** 0.7
    return underwater(v * envl, 3200)


def whistle(dur=0.35, f0=2600, f1=1100, amp=1.0, seed=8):
    """Harpoon in flight: narrow band of air noise gliding down (passing by)."""
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    w = r.standard_normal(n)
    # sweep by summing short narrow bands along the glide
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        u = i / n
        fc = f0 * (f1 / f0) ** u
        out[i:i + seg] = _res(w[max(0, i - 2048): i + seg], fc, 14)[-len(out[i:i + seg]):]
    envl = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return out * envl * amp * 4
