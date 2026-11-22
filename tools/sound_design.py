#!/usr/bin/env python3
"""Abyssal Tide sound design: renders every sound effect and music loop from code.

    <venv with numpy+scipy>/bin/python tools/sound_design.py [names...]

Everything is synthesised (no samples), so the audio is original and reproducible.
One palette for the whole game: D minor (D Dorian colour), glassy FM bells for "treasure",
filtered noise for water, sine-drop drums for weight, a dark convolution reverb for depth.

Writes art/audio/wav/<name>.wav (44.1 kHz) and art/audio/manifest.json:
  loops carry "loop": seconds -- the file is that many seconds of periodic audio plus a tail,
  so the engine loops it natively between loopStart=0.15 s and loopStart+loop (encoder-delay safe).
Encode with tools/encode_audio.sh.
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "art", "audio", "wav")
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- pitch
A4 = 440.0


def hz(note: str) -> float:
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3, "Gb": -3,
             "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    n, o = note[:-1], int(note[-1])
    return A4 * 2 ** ((names[n] + (o - 4) * 12) / 12)


# ---------------------------------------------------------------- building blocks
def t_(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def env(n: int, a=0.005, d=0.1, s=0.0, r=0.1, curve=4.0) -> np.ndarray:
    """ADSR with exponential-ish decay; n samples total (release at the end)."""
    t = np.arange(n) / SR
    dur = n / SR
    e = np.empty(n)
    att = t < a
    e[att] = (t[att] / max(a, 1e-6))
    dec = (t >= a) & (t < dur - r)
    e[dec] = s + (1 - s) * np.exp(-curve * (t[dec] - a) / max(d, 1e-6))
    rel = t >= dur - r
    start = s + (1 - s) * np.exp(-curve * max(dur - r - a, 0) / max(d, 1e-6))
    e[rel] = start * np.clip((dur - t[rel]) / max(r, 1e-6), 0, 1) ** 2
    return e


def perc(n: int, a=0.002, decay=0.2) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-6)) * np.exp(-t / decay)


def sine(f, dur, phase=0.0):
    t = t_(dur)
    if np.ndim(f):
        ph = 2 * np.pi * np.cumsum(f) / SR
        return np.sin(ph + phase)
    return np.sin(2 * np.pi * f * t + phase)


def saw(f: float, dur: float, harmonics: int | None = None) -> np.ndarray:
    t = t_(dur)
    k = harmonics or max(1, int((SR / 2.2) / f))
    out = np.zeros_like(t)
    for h in range(1, k + 1):
        out += np.sin(2 * np.pi * f * h * t) / h
    return out * (2 / np.pi)


def fm_bell(f: float, dur: float, ratio=3.5, index=4.0, decay=1.2, bright=0.6) -> np.ndarray:
    """Glassy FM bell: modulation index decays faster than the amplitude."""
    t = t_(dur)
    idx = index * np.exp(-t / (decay * 0.35))
    mod = np.sin(2 * np.pi * f * ratio * t) * idx
    car = np.sin(2 * np.pi * f * t + mod)
    shimmer = bright * np.sin(2 * np.pi * f * 2.756 * t) * np.exp(-t / (decay * 0.25))
    return (car + shimmer) * perc(len(t), 0.002, decay)


def noise(dur: float, color="white") -> np.ndarray:
    n = int(dur * SR)
    w = rng.standard_normal(n)
    if color == "white":
        return w
    if color == "pink":
        f = np.fft.rfft(w)
        k = np.arange(len(f)); k[0] = 1
        return np.fft.irfft(f / np.sqrt(k), n) * 12
    if color == "brown":
        b = np.cumsum(w)
        b -= np.convolve(b, np.ones(2048) / 2048, mode="same")
        return b / (np.abs(b).max() + 1e-9)
    raise ValueError(color)


def pnoise(dur: float, period: float, color="white") -> np.ndarray:
    """Noise that repeats exactly every `period` seconds (so loops stay seamless)."""
    one = noise(period, color)
    reps = int(np.ceil(dur / period)) + 1
    return np.tile(one, reps)[: int(dur * SR)]


def filt(x, kind, f, order=2):
    nyq = SR / 2
    if kind == "band":
        sos = butter(order, [max(10, f[0]) / nyq, min(f[1], nyq * 0.99) / nyq], btype="band", output="sos")
    else:
        sos = butter(order, min(f, nyq * 0.99) / nyq, btype={"low": "low", "high": "high"}[kind], output="sos")
    return sosfilt(sos, x)


def sweep_filter(x, f0, f1, q=0.7, kind="low", curve="exp"):
    """Time-varying state-variable filter (cutoff glides f0 -> f1)."""
    n = len(x)
    u = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1 / q
    a1 = 1 / (1 + g * (g + k))
    ic1 = ic2 = 0.0
    out = np.empty(n)
    xs = x.tolist(); gs = g.tolist(); a1s = a1.tolist()
    for i in range(n):
        v3 = xs[i] - ic2
        v1 = a1s[i] * ic1 + gs[i] * a1s[i] * v3
        v2 = ic2 + gs[i] * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v2 if kind == "low" else (v1 if kind == "band" else xs[i] - k * v1 - v2)
    return out


def drop(f0, f1, dur, decay=0.25, curve=18.0):
    """Sine with an exponential pitch drop: kicks, toms, thuds."""
    t = t_(dur)
    f = f1 + (f0 - f1) * np.exp(-t * curve)
    return sine(f, dur) * perc(len(t), 0.001, decay)


def soft_clip(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def place(dst, src, at):
    i = int(round(at * SR))  # round, not truncate: keeps repeating patterns sample-exact
    if i >= len(dst):
        return dst
    j = min(len(dst), i + len(src))
    dst[i:j] += src[: j - i]
    return dst


def pad_to(x, dur):
    n = int(dur * SR)
    return np.pad(x, (0, max(0, n - len(x))))[:n]


# ---------------------------------------------------------------- space
_IR = {}


def ir(length=2.4, dark=3200, seed=1, stereo=False):
    key = (length, dark, seed, stereo)
    if key in _IR:
        return _IR[key]
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    chans = []
    for c in range(2 if stereo else 1):
        x = r.standard_normal(n) * np.exp(-t * (6.9 / length))
        x = filt(x, "low", dark, 2)
        x[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))  # pre-delay softness
        chans.append(x / np.sqrt((x ** 2).sum()))
    _IR[key] = chans
    return chans


def verb(x, mix=0.3, length=2.4, dark=3200):
    """Mono in -> mono out, dark underwater room."""
    wet = fftconvolve(x, ir(length, dark)[0])[: len(x) + int(length * SR)]
    dry = np.pad(x, (0, len(wet) - len(x)))
    return dry * (1 - mix) + wet * mix * 3.0


def verb_st(x, mix=0.3, length=3.0, dark=3000):
    """Mono in -> stereo out (decorrelated tails)."""
    L, R = ir(length, dark, 3, True)
    wl = fftconvolve(x, L)[: len(x) + len(L)]
    wr = fftconvolve(x, R)[: len(x) + len(R)]
    dry = np.pad(x, (0, len(wl) - len(x)))
    return np.stack([dry * (1 - mix) + wl * mix * 3.0, dry * (1 - mix) + wr * mix * 3.0], 1)


# ---------------------------------------------------------------- loudness + output
def normalize(x, target_rms_db=-18.0, peak=0.89):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-12
    x = x * (10 ** (target_rms_db / 20) / rms)
    # soft limiter so transients do not clip
    over = np.max(np.abs(x))
    if over > peak:
        x = np.tanh(x / peak * 1.2) / np.tanh(1.2) * peak
    return x


def fade_ends(x, a=0.002, r=0.01):
    n_a, n_r = int(a * SR), int(r * SR)
    y = x.copy()
    if n_a:
        y[:n_a] *= np.linspace(0, 1, n_a)[:, None] if y.ndim == 2 else np.linspace(0, 1, n_a)
    if n_r:
        y[-n_r:] *= np.linspace(1, 0, n_r)[:, None] if y.ndim == 2 else np.linspace(1, 0, n_r)
    return y


def trim_tail(x, floor_db=-62.0):
    """Drop the inaudible end of a reverb tail (relative to the sound's peak)."""
    mono = np.abs(x if x.ndim == 1 else x.max(1))
    thr = mono.max() * 10 ** (floor_db / 20)
    loud = np.nonzero(mono > thr)[0]
    end = min(len(x), (loud[-1] if len(loud) else len(x)) + int(0.05 * SR))
    return x[:end]


MANIFEST: dict[str, dict] = {}


def save(name, x, *, rms=-18.0, loop: float | None = None, bus="sfx", tail=0.5):
    """Write a wav. Loops: x must be >= loop+tail seconds of periodic audio (already wrapped)."""
    if loop is None:
        x = trim_tail(x)
        x = fade_ends(x, r=0.03)
    x = normalize(x, rms)
    os.makedirs(OUT, exist_ok=True)
    wavfile.write(os.path.join(OUT, f"{name}.wav"), SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    MANIFEST[name] = {"bus": bus, **({"loop": round(loop, 6)} if loop else {})}
    print(f"  {name:16s} {len(x) / SR:6.2f}s  {'stereo' if x.ndim == 2 else 'mono  '}  {bus}{f'  loop {loop:.3f}s' if loop else ''}")


def periodic(render, period: float, tail=0.5, stereo=False):
    """Render a section twice through reverb and keep one period starting at the second pass,
    plus a tail: the reverb of the end flows into the start, so the loop is seamless."""
    # enough periods of history for every reverb tail (<= 4 s) to reach steady state
    m = max(1, int(np.ceil(4.0 / period)))
    two = render((m + 1) * period + tail + 0.2)  # renderer must be periodic in `period`
    i = int(round(m * period * SR))
    j = i + int((period + tail + 0.15) * SR)
    seg = two[i:j]
    # loopStart offset 0.15 s: prepend the 0.15 s that precedes the loop point
    return seg


# ================================================================ SOUND EFFECTS
def s_spin():
    d = 0.55
    w = sweep_filter(noise(d, "pink"), 300, 2600, q=1.4, kind="band") * env(int(d * SR), 0.06, 0.35, 0, 0.12, 3)
    bub = np.zeros(int(d * SR))
    for k in range(7):
        f = rng.uniform(500, 1400)
        place(bub, sine(np.geomspace(f, f * 2.2, int(0.05 * SR)), 0.05) * perc(int(0.05 * SR), 0.001, 0.02) * 0.4, 0.08 + k * 0.05)
    save("spin", verb(w * 0.9 + bub, 0.25, 1.2), rms=-22)


def s_reel_stop():
    d = 0.32
    thud = drop(150, 52, d, 0.11, 30) * 1.0
    tap = filt(noise(d), "band", (900, 2600)) * perc(int(d * SR), 0.001, 0.012) * 0.35
    splash = filt(noise(d, "pink"), "band", (1500, 6000)) * perc(int(d * SR), 0.004, 0.05) * 0.18
    save("reel_stop", verb(soft_clip(thud + tap + splash, 1.3), 0.15, 0.9), rms=-17)


def s_tumble_pop():
    d = 0.5
    x = np.zeros(int(d * SR))
    for k in range(9):
        f = rng.uniform(380, 1100)
        dd = rng.uniform(0.04, 0.09)
        b = sine(np.geomspace(f, f * rng.uniform(1.8, 3.0), int(dd * SR)), dd) * perc(int(dd * SR), 0.001, dd / 3)
        place(x, b * rng.uniform(0.4, 1), rng.uniform(0, 0.16))
    burst = filt(noise(d, "pink"), "band", (1200, 7000)) * perc(int(d * SR), 0.002, 0.06) * 0.25
    save("tumble_pop", verb(x + burst, 0.3, 1.4), rms=-20)


def s_win(level):
    # cluster win: rising D-minor-pentatonic bell figure, longer and brighter per level
    notes = [["D5", "F5", "A5"], ["D5", "F5", "A5", "C6"], ["A4", "D5", "F5", "A5", "D6"]][level - 1]
    d = 0.9 + level * 0.35
    x = np.zeros(int(d * SR))
    for i, n in enumerate(notes):
        place(x, fm_bell(hz(n), 1.2, 3.5, 3.0 + level, 0.9, 0.5) * (0.7 + 0.1 * i), i * 0.075)
    shimmer = filt(noise(d, "pink"), "band", (5000, 11000)) * env(int(d * SR), 0.02, 0.5, 0, 0.3, 3) * 0.06 * level
    save(f"win_{level}", verb(x + shimmer, 0.35, 2.2, 5000), rms=-19)


def s_mult_up():
    d = 0.6
    f = np.geomspace(hz("A5"), hz("D7"), int(0.25 * SR))
    gl = sine(f, 0.25) * perc(int(0.25 * SR), 0.003, 0.1)
    x = pad_to(gl, d)
    place(x, fm_bell(hz("D7"), 0.5, 2.0, 1.5, 0.3, 0.2) * 0.6, 0.18)
    save("mult_up", verb(x, 0.3, 1.5, 6000), rms=-23)


def s_scatter_land():
    # the compass chime: a struck metal disc (inharmonic partials) + sonar sheen
    d = 1.6
    t = t_(d)
    f0 = hz("D6")
    parts = [(1.0, 1.0, 1.4), (2.76, 0.5, 0.9), (5.40, 0.25, 0.6), (8.93, 0.12, 0.4)]
    x = sum(a * np.sin(2 * np.pi * f0 * r * t) * perc(len(t), 0.001, dc) for r, a, dc in parts)
    x += fm_bell(hz("D5"), d, 1.0, 2.0, 1.2, 0.0) * 0.5
    hit = filt(noise(d), "band", (2500, 8000)) * perc(len(t), 0.0005, 0.01) * 0.5
    save("scatter_land", verb(x + hit, 0.35, 2.6, 5000), rms=-19)


def s_scatter_trigger():
    d = 3.2
    x = np.zeros(int(d * SR))
    # deep boom
    place(x, drop(90, 38, 1.4, 0.6, 9) * 1.2, 0.0)
    # rising D-minor chord swell
    chord = ["D3", "A3", "D4", "F4", "A4", "D5"]
    sw = np.zeros(int(d * SR))
    for n in chord:
        sw += saw(hz(n) * (1 + rng.uniform(-0.002, 0.002)), d, 30)
    sw = sweep_filter(sw, 300, 5000, 0.8) * env(int(d * SR), 0.9, 1.6, 0, 0.6, 2.2) * 0.22
    x += sw
    for i, n in enumerate(["D5", "F5", "A5", "D6", "F6"]):
        place(x, fm_bell(hz(n), 1.8, 3.5, 4.0, 1.3, 0.6) * 0.45, 0.3 + i * 0.09)
    place(x, filt(noise(1.2, "pink"), "band", (800, 6000)) * env(int(1.2 * SR), 0.01, 0.4, 0, 0.3) * 0.5, 0.0)
    save("scatter_trigger", verb(soft_clip(x, 1.2), 0.4, 3.2, 4500), rms=-15)


def s_tease_loop():
    # 1 bar at 120 bpm-ish heartbeat (lub-dub) + rising shimmer; periodic in P
    P = 1.0

    def render(dur):
        x = np.zeros(int(dur * SR))
        k = 0
        while k * P < dur:
            place(x, drop(70, 40, 0.25, 0.09, 16) * 1.0, k * P)
            place(x, drop(64, 38, 0.22, 0.08, 16) * 0.65, k * P + 0.19)
            k += 1
        tt = np.arange(len(x)) / SR
        trem = 0.5 + 0.5 * np.sin(2 * np.pi * tt / P * 4)
        sh = filt(pnoise(dur, P, "pink"), "band", (3000, 9000)) * trem * 0.04
        fd, fa = round(hz("D2") * P) / P, round(hz("A2") * P) / P  # whole cycles per loop
        drone = (np.sin(2 * np.pi * fd * tt) + 0.5 * np.sin(2 * np.pi * fa * tt)) * 0.12
        return verb(x + sh + drone, 0.25, 1.4)[: len(x)]

    save("tease_loop", periodic(render, P, 0.5), rms=-19, loop=P, bus="sfx")


def s_lev_hit():
    d = 0.8
    x = drop(110, 34, d, 0.28, 12) * 1.1
    growl = saw(55, d, 40) * (1 + 0.6 * np.sin(2 * np.pi * 23 * t_(d)))
    growl = filt(growl, "low", 700) * env(int(d * SR), 0.02, 0.35, 0, 0.2, 3) * 0.35
    crack = filt(noise(d), "band", (600, 4000)) * perc(int(d * SR), 0.0008, 0.03) * 0.6
    save("lev_hit", verb(soft_clip(x + growl + crack, 1.6), 0.25, 1.6, 2500), rms=-16)


def s_lev_roar():
    # Leviathan surfacing: a pitched, formant-swept moan over a sub drop and a wave crash
    d = 3.0
    t = t_(d)
    f = 70 + 40 * np.sin(np.pi * np.clip(t / 1.8, 0, 1)) - 25 * np.clip((t - 1.8) / 1.2, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    voice = sum(np.sin(ph * h) / h for h in range(1, 40))
    voice = sweep_filter(voice, 300, 1400, 2.5, "band") * 0.6 + sweep_filter(voice, 900, 2400, 3.0, "band") * 0.3
    voice *= env(len(t), 0.25, 1.4, 0.4, 0.8, 1.5) * (1 + 0.3 * np.sin(2 * np.pi * 7 * t))
    sub = drop(60, 28, d, 1.2, 4) * 0.9
    crash = filt(noise(d, "pink"), "band", (300, 5000)) * env(len(t), 0.4, 1.0, 0, 0.8, 2) * 0.5
    save("lev_roar", verb(soft_clip(voice + sub + crash, 1.4), 0.4, 3.4, 2600), rms=-15)


def s_powerup():
    d = 1.6
    x = sweep_filter(noise(d, "pink"), 200, 6000, 1.6, "band") * env(int(d * SR), 0.5, 0.6, 0, 0.4, 2.5) * 0.5
    for i, n in enumerate(["A4", "D5", "F5", "A5", "D6"]):
        place(x, fm_bell(hz(n), 1.0, 2.0, 2.5, 0.7, 0.4) * 0.5, 0.35 + i * 0.06)
    place(x, drop(130, 50, 0.6, 0.2, 14) * 0.8, 0.62)
    save("powerup", verb(x, 0.35, 2.0, 5500), rms=-17)


def s_feature_intro():
    d = 3.0
    x = np.zeros(int(d * SR))
    place(x, drop(80, 34, 1.6, 0.7, 7) * 1.2, 0)
    place(x, filt(noise(1.0, "pink"), "low", 3000) * perc(int(1.0 * SR), 0.003, 0.35) * 0.6, 0)
    for n in ["D3", "A3", "D4", "F4", "A4"]:
        x += saw(hz(n), d, 24) * env(int(d * SR), 0.02, 1.4, 0.2, 0.8, 2.2) * 0.07
    for i, n in enumerate(["D5", "A5", "D6"]):
        place(x, fm_bell(hz(n), 2.0, 3.5, 3.0, 1.5, 0.5) * 0.5, 0.05 + i * 0.12)
    save("feature_intro", verb(filt(x, "low", 7000), 0.4, 3.0, 4200), rms=-15)


def s_bigwin_loop():
    # treasure shimmer while a big win counts up; periodic in P (0.6 s)
    P = 0.6

    def render(dur):
        x = np.zeros(int(dur * SR))
        seq = ["D6", "F6", "A6", "C7", "A6", "F6"]
        k = 0
        while k * P / 6 < dur:
            place(x, fm_bell(hz(seq[k % 6]), 0.4, 2.0, 1.6, 0.18, 0.3) * 0.5, k * P / 6)
            k += 1
        tt = np.arange(len(x)) / SR
        x += filt(pnoise(dur, P), "band", (6000, 12000)) * (0.5 + 0.5 * np.sin(2 * np.pi * tt / P * 2)) * 0.05
        return verb(x, 0.3, 1.2, 7000)[: len(x)]

    save("bigwin_loop", periodic(render, P, 0.5), rms=-22, loop=P)


def s_bigwin_end():
    d = 3.4
    x = np.zeros(int(d * SR))
    place(x, drop(70, 32, 1.8, 0.8, 6) * 1.1, 0)
    chord = ["D4", "F4", "A4", "D5", "F5", "A5"]
    for n in chord:
        x += saw(hz(n), d, 28) * env(int(d * SR), 0.01, 2.2, 0.0, 1.0, 2.0) * 0.06
    for i, n in enumerate(["A5", "D6", "F6", "A6", "D7"]):
        place(x, fm_bell(hz(n), 2.4, 3.5, 3.5, 1.6, 0.6) * 0.45, i * 0.06)
    place(x, filt(noise(2.4, "pink"), "high", 4000) * env(int(2.4 * SR), 0.005, 1.0, 0, 0.8, 2) * 0.25, 0)
    save("bigwin_end", verb(x, 0.4, 3.2, 5000), rms=-15)


def s_wheel_tick():
    d = 0.06
    x = filt(noise(d), "band", (1800, 5200)) * perc(int(d * SR), 0.0003, 0.006) + drop(900, 500, d, 0.01, 60) * 0.4
    save("wheel_tick", x, rms=-20)


def s_wheel_land(hit: bool):
    d = 2.0 if hit else 1.4
    x = np.zeros(int(d * SR))
    place(x, drop(120, 48, 0.7, 0.25, 12) * 0.9, 0)
    if hit:
        for i, n in enumerate(["D5", "F5", "A5", "D6"]):
            place(x, fm_bell(hz(n), 1.6, 3.5, 3.5, 1.1, 0.5) * 0.5, 0.04 + i * 0.07)
        place(x, filt(noise(1.0, "pink"), "band", (900, 7000)) * perc(int(1.0 * SR), 0.003, 0.18) * 0.4, 0)
    else:
        for n in ["D3", "F3", "A3"]:
            x += sine(hz(n), d) * env(int(d * SR), 0.05, 0.9, 0, 0.3, 2) * 0.12
    save("wheel_win" if hit else "wheel_miss", verb(x, 0.35, 2.2, 4000), rms=-17 if hit else -21)


def s_ui_click():
    d = 0.08
    x = drop(1800, 900, d, 0.012, 50) * 0.6 + filt(noise(d), "band", (2000, 6000)) * perc(int(d * SR), 0.0003, 0.004) * 0.5
    save("ui_click", x, rms=-24)


def s_ui_buy():
    d = 1.2
    x = np.zeros(int(d * SR))
    place(x, fm_bell(hz("A5"), 1.0, 2.0, 2.0, 0.6, 0.3) * 0.6, 0)
    place(x, fm_bell(hz("D6"), 1.0, 2.0, 2.0, 0.7, 0.3) * 0.6, 0.09)
    place(x, drop(160, 70, 0.3, 0.1, 18) * 0.5, 0)
    save("ui_buy", verb(x, 0.3, 1.6, 6000), rms=-20)


def s_slam():
    d = 2.2
    x = np.zeros(int(d * SR))
    place(x, sweep_filter(noise(0.5, "pink"), 400, 5000, 1.2, "band") * env(int(0.5 * SR), 0.4, 0.1, 0, 0.05, 2) * 0.6, 0)
    place(x, drop(95, 30, 1.6, 0.6, 8) * 1.4, 0.45)
    place(x, filt(noise(1.6, "pink"), "band", (500, 9000)) * perc(int(1.6 * SR), 0.002, 0.4) * 0.5, 0.45)
    place(x, saw(hz("D2"), 1.6, 40) * env(int(1.6 * SR), 0.005, 0.8, 0, 0.5, 2) * 0.2, 0.45)
    save("slam", verb(soft_clip(x, 1.5), 0.35, 2.6, 3500), rms=-15)


def s_feature_end():
    d = 2.6
    x = np.zeros(int(d * SR))
    for i, n in enumerate(["D5", "A4", "F5", "D5", "A5"]):
        place(x, fm_bell(hz(n), 1.8, 3.5, 2.2, 1.2, 0.4) * 0.45, i * 0.14)
    for n in ["D3", "A3", "F4"]:
        x += sine(hz(n), d) * env(int(d * SR), 0.2, 1.6, 0, 0.8, 2) * 0.1
    save("feature_end", verb(x, 0.4, 3.0, 4500), rms=-18)


# ================================================================ MUSIC + AMBIENCE
def m_ambience():
    P = 24.0

    def render(dur):
        n = int(dur * SR)
        tt = np.arange(n) / SR
        # ocean rumble: brown noise, slow swells periodic in P
        rum = filt(pnoise(dur, P, "brown"), "low", 260) * (0.65 + 0.35 * np.sin(2 * np.pi * tt / P * 2))
        hiss = filt(pnoise(dur, P, "pink"), "band", (300, 1200)) * (0.5 + 0.5 * np.sin(2 * np.pi * tt / P * 3 + 1)) * 0.06
        x = rum + hiss
        # sonar pings and bubble clusters on a P-periodic schedule
        r = np.random.default_rng(11)
        events = sorted(r.uniform(0, P, 9))
        for k in range(int(np.ceil(dur / P))):
            for j, e in enumerate(events):
                at = k * P + e
                if j % 3 == 0:
                    place(x, fm_bell(hz("D6"), 2.5, 1.0, 0.6, 1.6, 0.0) * 0.05, at)
                else:
                    cl = np.zeros(int(0.5 * SR))
                    for q in range(5):
                        f = 300 + 700 * ((j * 7 + q * 3) % 10) / 10
                        dd = 0.06
                        place(cl, sine(np.geomspace(f, f * 2.4, int(dd * SR)), dd) * perc(int(dd * SR), 0.001, 0.02), q * 0.07)
                    place(x, cl * 0.12, at)
        st = verb_st(x, 0.45, 4.0, 1800)[:n]
        return st

    save("amb_deep", periodic(render, P, 0.5), rms=-28, loop=P, bus="amb")


def _pad(notes, dur, cutoff=1400, detune=0.004, gain=0.08):
    x = np.zeros(int(dur * SR))
    for n in notes:
        f = hz(n)
        for d in (-detune, 0, detune):
            x += saw(f * (1 + d), dur, 24)
    x = filt(x, "low", cutoff, 2)
    return x * env(len(x), 0.6, 1.0, 1.0, 0.8, 1.0) * gain


def m_base():
    # 75 bpm (a bar is a whole number of samples), 12 bars of 4/4 (38.4 s): Dm - Bbmaj7 - Fmaj7 - C(add9), each 3 bars; sparse and calm
    bpm = 75
    beat = 60 / bpm
    bar = 4 * beat
    P = 12 * bar
    prog = [["D3", "A3", "D4", "F4"], ["Bb2", "F3", "A3", "D4"], ["F2", "C4", "E4", "A4"], ["C3", "G3", "D4", "E4"]]
    arp = [["D5", "F5", "A5", "C6"], ["D5", "F5", "A5", "Bb5"], ["C5", "E5", "F5", "A5"], ["D5", "E5", "G5", "C6"]]
    bass = ["D2", "Bb1", "F2", "C2"]

    shaker = filt(noise(0.06), "high", 6000) * perc(int(0.06 * SR), 0.002, 0.018) * 0.05
    pads = [_pad(prog[c], 3 * bar + 0.8, 1200, 0.004, 0.07) for c in range(4)]

    def render(dur):
        n = int(dur * SR)
        x = np.zeros(n)
        k = 0
        while k * bar < dur:
            ch = (k // 3) % 4
            at = k * bar
            if k % 3 == 0:
                place(x, pads[ch], at)
                place(x, (sine(hz(bass[ch]), 3 * bar) + 0.3 * sine(hz(bass[ch]) * 2, 3 * bar)) * env(int(3 * bar * SR), 0.3, 2.0, 0.7, 1.0, 1.0) * 0.22, at)
            # gentle arpeggio: eighth notes on beats 1-2-3, rests on 4 (glassy, low velocity)
            for e in range(6):
                nn = arp[ch][(e + k) % 4]
                vel = 0.18 if e % 2 == 0 else 0.11
                place(x, fm_bell(hz(nn), 1.2, 3.5, 1.4, 0.7, 0.25) * vel, at + e * beat / 2)
            # soft pulse: muffled kick on 1 and 3, shaker on off-beats
            for b in (0, 2):
                place(x, drop(70, 45, 0.4, 0.14, 14) * 0.28, at + b * beat)
            for e in range(8):
                if e % 2:
                    place(x, shaker, at + e * beat / 2)
            k += 1
        return verb_st(x, 0.35, 3.2, 3200)[:n]

    save("music_base", periodic(render, P, 0.6), rms=-22, loop=P, bus="music", tail=0.6)


def m_bonus():
    # 105 bpm (whole-sample bars), 16 bars (36.6 s): driving drums, bass ostinato, pad + higher arps, D minor
    bpm = 105
    beat = 60 / bpm
    bar = 4 * beat
    P = 16 * bar
    prog = [["D3", "A3", "D4", "F4"], ["Bb2", "F3", "Bb3", "D4"], ["C3", "G3", "C4", "E4"], ["A2", "E3", "A3", "C#4"]]
    arp = [["D5", "A5", "F5", "A5"], ["D5", "Bb5", "F5", "Bb5"], ["E5", "C6", "G5", "C6"], ["E5", "A5", "C#6", "A5"]]
    bass = ["D2", "Bb1", "C2", "A1"]

    snare = filt(noise(0.25, "pink"), "band", (900, 5000)) * perc(int(0.25 * SR), 0.001, 0.07) * 0.32 + drop(220, 160, 0.25, 0.06, 20) * 0.25
    hat_c = filt(noise(0.05), "high", 7000) * perc(int(0.05 * SR), 0.001, 0.012) * 0.04
    hat_o = filt(noise(0.05), "high", 7000) * perc(int(0.05 * SR), 0.001, 0.03) * 0.06
    pads = [_pad(prog[c], 4 * bar + 0.6, 2200, 0.005, 0.06) for c in range(4)]

    def render(dur):
        n = int(dur * SR)
        x = np.zeros(n)
        k = 0
        while k * bar < dur:
            ch = (k // 4) % 4
            at = k * bar
            if k % 4 == 0:
                place(x, pads[ch], at)
            # bass ostinato (eighths, octave jumps), saturated
            for e in range(8):
                f = hz(bass[ch]) * (2 if e in (3, 6) else 1)
                d = beat / 2
                nb = (sine(f, d) + 0.35 * saw(f, d, 8)) * env(int(d * SR), 0.004, 0.18, 0.3, 0.04, 3)
                place(x, soft_clip(nb, 1.8) * 0.22, at + e * d)
            # drums: kick 1 & 3 (+ "and" of 4 on odd bars), tom fills on bar 4, hats on eighths
            for b in (0, 2):
                place(x, drop(120, 42, 0.45, 0.16, 20) * 0.75, at + b * beat)
            if k % 2:
                place(x, drop(120, 42, 0.45, 0.16, 20) * 0.5, at + 3.5 * beat)
            for b in (1, 3):
                place(x, snare, at + b * beat)
            for e in range(8):
                place(x, hat_o if e % 2 else hat_c, at + e * beat / 2)
            if k % 4 == 3:
                for i, (f0, tm) in enumerate([(180, 2.0), (150, 2.5), (120, 3.0), (100, 3.5)]):
                    place(x, drop(f0, f0 * 0.6, 0.3, 0.12, 12) * 0.45, at + tm * beat)
            # arps: sixteenth bells on bars 2-4 of each chord
            if k % 4:
                for e in range(16):
                    nn = arp[ch][e % 4]
                    place(x, fm_bell(hz(nn), 0.5, 3.5, 1.6, 0.28, 0.25) * (0.12 if e % 4 == 0 else 0.07), at + e * beat / 4)
            k += 1
        return verb_st(x, 0.25, 2.4, 4200)[:n]

    save("music_bonus", periodic(render, P, 0.6), rms=-20, loop=P, bus="music", tail=0.6)


# ================================================================ run
JOBS = {
    "spin": s_spin, "reel_stop": s_reel_stop, "tumble_pop": s_tumble_pop,
    "win_1": lambda: s_win(1), "win_2": lambda: s_win(2), "win_3": lambda: s_win(3),
    "mult_up": s_mult_up, "scatter_land": s_scatter_land, "scatter_trigger": s_scatter_trigger,
    "tease_loop": s_tease_loop, "lev_hit": s_lev_hit, "lev_roar": s_lev_roar, "powerup": s_powerup,
    "feature_intro": s_feature_intro, "feature_end": s_feature_end, "bigwin_loop": s_bigwin_loop, "bigwin_end": s_bigwin_end,
    "wheel_tick": s_wheel_tick, "wheel_win": lambda: s_wheel_land(True), "wheel_miss": lambda: s_wheel_land(False),
    "ui_click": s_ui_click, "ui_buy": s_ui_buy, "slam": s_slam,
    "amb_deep": m_ambience, "music_base": m_base, "music_bonus": m_bonus,
}

if __name__ == "__main__":
    want = sys.argv[1:] or list(JOBS)
    man_path = os.path.join(ROOT, "art", "audio", "manifest.json")
    if os.path.exists(man_path):
        MANIFEST.update(json.load(open(man_path)))
    for name in want:
        JOBS[name]()
    with open(man_path, "w") as f:
        json.dump(dict(sorted(MANIFEST.items())), f, indent=1)
    print(f"wrote {len(want)} sounds -> art/audio/wav, manifest.json")
