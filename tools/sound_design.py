#!/usr/bin/env python3
"""Abyssal Tide sound design: renders every sound effect and music loop from code.

    <venv with numpy+scipy>/bin/python tools/sound_design.py [names...]

Everything is synthesised (no samples), so the audio is original and reproducible.
Every sound is a thing from the game's world, built from physical models in tools/sound_models.py:
bubbles (Minnaert), rope/hull creaks (stick-slip), oak knocks, a ship's bell, the brass compass,
frame and war drums, a bowed cello, a conch horn, whale and Leviathan voices, surf. D Dorian.

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
# v2: every sound is a thing from the game's world (see the docstring of tools/sound_models.py).
from sound_models import (bubble, bubbles, brass_plate, cello, cello_stab, conch, creak, deep_drum, frame_drum,
                          ratchet, shell_shaker, ship_bell, underwater, voice, wave, whale_call, whistle, wood_knock)


def s_spin():
    # the harpooner pays out line: rope runs over a wooden pulley, water rushes past the reels
    d = 0.75
    x = creak(d * 0.8, (90, 40), (380, 820, 1500), 7, 0.45, seed=11)
    x = pad_to(x, d)
    x += sweep_filter(noise(d, "pink"), 350, 1800, 1.1, "band") * env(int(d * SR), 0.08, 0.4, 0, 0.2, 3) * 0.55
    x += bubbles(d, 10, (1.5, 3.5), 0.45, 0.25, seed=3)
    save("spin", verb(underwater(x, 5200), 0.22, 1.2, 3000), rms=-22)


def s_reel_stop():
    # a barnacled oak plank knocking home underwater: wood modes, a muffled thump, a few bubbles
    d = 0.5
    x = wood_knock(165, d, 0.8, seed=1) * 0.9
    x += drop(110, 48, d, 0.09, 26) * 0.7
    x += bubbles(d, 4, (2.0, 4.5), 0.12, 0.2, seed=9)
    save("reel_stop", verb(underwater(soft_clip(x, 1.2), 3800), 0.16, 0.9, 2600), rms=-17)


def s_tumble_pop():
    # a winning symbol bursts into ink: a gulp of air escapes as a bubble cloud, the ink swirls away
    d = 0.8
    x = bubble(5.5, 0.12, 0.6, 1.0) * 0.8  # the big "bloop"
    x = pad_to(x, d)
    x += bubbles(d, 22, (0.8, 3.0), 0.35, 0.4, seed=17, rise=0.5)
    swirl = sweep_filter(noise(d, "pink"), 900, 300, 2.2, "band") * env(int(d * SR), 0.02, 0.4, 0, 0.3, 3) * 0.35
    save("tumble_pop", verb(underwater(x + swirl, 6000), 0.3, 1.4, 3500), rms=-20)


def s_win(level):
    # wins are the sea answering: 1 a sonar return, 2 a whale's reply, 3 the hunter's conch over a swell
    if level == 1:
        d = 1.6
        x = np.zeros(int(d * SR))
        for i, f in enumerate([1180, 1580]):
            place(x, sine(f, 0.18) * perc(int(0.18 * SR), 0.002, 0.06) * 0.6, i * 0.12)
        x += bubbles(d, 14, (1.0, 2.5), 0.9, 0.22, seed=21, rise=0.6)
        save("win_1", verb(x, 0.5, 2.6, 4500), rms=-21)
    elif level == 2:
        d = 2.6
        x = pad_to(whale_call(1.8, 240, 520, 380, 1.0, seed=2), d)
        x += pad_to(bubbles(1.4, 18, (1.0, 3.0), 1.0, 0.25, seed=22, rise=0.6), d)
        save("win_2", verb(x, 0.45, 3.0, 3800), rms=-19)
    else:
        d = 3.6
        x = pad_to(wave(2.4, 0.35, 140, 3000, seed=5) * 0.6, d)
        place(x, conch(hz("D4"), 1.0, 0.8, 4, seed=1), 0.15)
        place(x, conch(hz("A4"), 1.3, 0.9, 3, seed=2), 0.95)
        place(x, bubbles(1.5, 20, (1.0, 3.0), 1.2, 0.2, seed=23), 0.4)
        save("win_3", verb(x, 0.4, 3.0, 4200), rms=-17)


def s_mult_up():
    # a whirlpool tightens under a wild: water spins faster and higher, ending in a droplet
    d = 0.9
    t = t_(d)
    sw = _band_sweep(noise(d, "pink"), 300, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(np.linspace(6, 22, len(t))) / SR))
    sw *= env(len(t), 0.25, 0.35, 0, 0.25, 3) * 0.7
    place(sw, bubble(1.8, 0.08, 0.25, 0.35), 0.55)
    save("mult_up", verb(underwater(sw, 7000), 0.3, 1.4, 4000), rms=-23)


def _band_sweep(x, f0, f1, q=2.0):
    return sweep_filter(x, f0, f1, q, "band")


def s_scatter_land():
    # the brass compass lands: its needle spins on the pivot, clicks home, the case rings
    d = 1.8
    x = np.zeros(int(d * SR))
    place(x, ratchet(0.32, 9, 3800, 1.8, 0.5, seed=4), 0)
    place(x, brass_plate(hz("D5") * 1.0, 1.4, 0.45), 0.32)
    place(x, wood_knock(900, 0.08, 1.5, 3) * 0.6, 0.32)
    save("scatter_land", verb(x, 0.3, 2.2, 6000), rms=-19)


def s_scatter_trigger():
    # "the compass points down": the needle whirs, the ship's bell tolls, the sea heaves, a whale answers
    d = 4.6
    x = np.zeros(int(d * SR))
    place(x, ratchet(0.7, 22, 4200, 0.6, 0.45, seed=7), 0)
    place(x, ship_bell(hz("D4"), 3.6, 0.8), 0.68)
    place(x, ship_bell(hz("D4"), 3.0, 0.45), 1.18)
    place(x, wave(3.0, 0.45, 110, 2600, seed=8) * 0.7, 0.55)
    place(x, deep_drum(46, 2.0, 0.9), 0.68)
    place(x, whale_call(2.2, 200, 470, 300, 0.55, seed=4), 1.6)
    save("scatter_trigger", verb(soft_clip(x, 1.1), 0.38, 3.4, 3800), rms=-15)


def s_tease_loop():
    # the hunt holds its breath: a sonar ping each beat, hull groaning under pressure, a pulse in the deep
    P = 1.0

    def render(dur):
        x = np.zeros(int(dur * SR))
        ping = sine(1250, 0.22) * perc(int(0.22 * SR), 0.002, 0.07) * 0.55 + pad_to(sine(2500, 0.1) * perc(int(0.1 * SR), 0.001, 0.02), 0.22) * 0.1
        thump = frame_drum(62, 0.5, 0.75, 0.1)
        groan = creak(P, (14, 22), (140, 310, 560), 10, 0.35, seed=31)
        k = 0
        while k * P < dur:
            place(x, ping, k * P)
            place(x, thump, k * P + 0.5)
            if k % 2 == 0:
                place(x, groan, k * P + 0.1)
            k += 1
        tt = np.arange(len(x)) / SR
        fd = round(hz("D1") * 2 * P) / P
        rumble = _lp_(pnoise(dur, P, "brown"), 180) * 0.5 + np.sin(2 * np.pi * fd * tt) * 0.08
        return verb(x + rumble, 0.35, 2.0, 2800)[: len(x)]

    save("tease_loop", periodic(render, 2 * P, 0.5), rms=-19, loop=2 * P)


def _lp_(x, f):
    return filt(x, "low", f)


def s_lev_hit():
    # a harpoon strikes the Leviathan: it whistles in, thuds into hide, the beast grunts through the water
    d = 1.1
    x = np.zeros(int(d * SR))
    place(x, whistle(0.22, 3200, 1400, 0.5), 0)
    place(x, drop(130, 40, 0.6, 0.16, 18) * 1.0, 0.2)
    place(x, filt(noise(0.2), "band", (250, 1200)) * perc(int(0.2 * SR), 0.001, 0.03) * 0.8, 0.2)
    f = np.geomspace(95, 70, int(0.55 * SR))
    place(x, voice(f, ("uh", "oh"), 0.8, 0.02, 0.9, seed=3) * env(len(f), 0.03, 0.3, 0, 0.15, 3), 0.24)
    save("lev_hit", verb(underwater(soft_clip(x, 1.5), 3000), 0.28, 1.8, 2400), rms=-16)


def s_lev_roar():
    # the Leviathan surfaces: a huge rough bellow through the water, an explosion of bubbles, the sea heaving
    d = 4.6
    n = int(3.4 * SR)
    u = np.linspace(0, 1, n)
    f = 52 + 38 * np.sin(np.pi * np.clip(u / 0.55, 0, 1)) - 12 * np.clip((u - 0.55) / 0.45, 0, 1)
    roar = voice(f, ("oh", "ah"), 1.0, 0.03, 1.2, seed=5) + 0.5 * voice(f * 1.5, ("uh", "ah"), 0.6, 0.04, 1.0, seed=6)
    roar *= env(n, 0.35, 1.6, 0.5, 0.9, 1.4)
    x = pad_to(roar, d)
    place(x, bubbles(1.6, 60, (1.5, 7.0), 0.9, 0.5, seed=41, rise=0.6), 0.15)
    place(x, wave(3.8, 0.4, 90, 2200, seed=12) * 0.6, 0.2)
    place(x, deep_drum(40, 2.4, 0.8), 0.05)
    save("lev_roar", verb(underwater(soft_clip(x, 1.3), 2600), 0.42, 3.6, 2200), rms=-15)


def s_powerup():
    # the tide answers the hunter: a surge swells up, bubbles rush to the surface, the medallion flares
    d = 2.2
    x = wave(d, 0.55, 150, 3500, seed=14) * 0.75
    place(x, bubbles(1.0, 40, (0.8, 3.0), 0.8, 0.35, seed=51, rise=0.8), 0.5)
    place(x, frame_drum(80, 0.9, 0.8, 0.6), 1.2)
    place(x, brass_plate(hz("A5"), 1.0, 0.25), 1.2)
    save("powerup", verb(x, 0.35, 2.4, 4200), rms=-17)


def s_feature_intro():
    # a free-spins tier opens: the war conch sounds over a breaking wave and the hunt drum
    d = 4.4
    x = np.zeros(int(d * SR))
    place(x, wave(3.2, 0.3, 110, 3200, seed=16) * 0.8, 0)
    place(x, deep_drum(48, 2.2, 1.0), 0.05)
    place(x, conch(hz("D4"), 1.4, 1.0, 4, seed=5), 0.1)
    place(x, conch(hz("A4"), 1.9, 0.9, 3, seed=6), 1.1)
    place(x, ship_bell(hz("D4"), 2.6, 0.25), 0.1)
    save("feature_intro", verb(soft_clip(x, 1.1), 0.36, 3.2, 3600), rms=-15)


def s_feature_end():
    # the hunt is done: waves draw back, one bell from the ship, a whale far off
    d = 4.6
    x = np.zeros(int(d * SR))
    place(x, wave(3.6, 0.2, 100, 1800, seed=18) * 0.5, 0)
    place(x, ship_bell(hz("D5"), 3.4, 0.6), 0.3)
    place(x, whale_call(2.6, 170, 330, 220, 0.4, seed=8), 1.5)
    save("feature_end", verb(x, 0.42, 3.4, 3200), rms=-19)


def s_bigwin_loop():
    # treasure rising from the deep while the win counts: a stream of bubbles + a rattle of shells
    P = 0.6

    def render(dur):
        x = np.zeros(int(dur * SR))
        bub = bubbles(P, 16, (0.8, 2.6), P, 0.35, seed=61, rise=0.7)
        sh = shell_shaker(0.12, 0.6)
        k = 0
        while k * P < dur:
            place(x, bub, k * P)
            place(x, sh, k * P)
            place(x, sh * 0.6, k * P + P / 2)
            place(x, frame_drum(105, 0.3, 0.35, 0.3), k * P)
            k += 1
        return verb(x, 0.3, 1.2, 5000)[: len(x)]

    save("bigwin_loop", periodic(render, P, 0.5), rms=-22, loop=P)


def s_bigwin_end():
    # the catch lands: a great wave breaks, the conch rings out, drums answer
    d = 4.6
    x = np.zeros(int(d * SR))
    place(x, wave(3.4, 0.22, 100, 3600, seed=20) * 0.9, 0)
    place(x, deep_drum(50, 2.0, 1.0), 0)
    place(x, frame_drum(90, 0.8, 0.7), 0.42)
    place(x, frame_drum(90, 0.8, 0.7), 0.63)
    place(x, conch(hz("A4"), 2.4, 1.0, 5, seed=9), 0.05)
    place(x, bubbles(2.0, 40, (1.0, 4.0), 1.6, 0.3, seed=71), 0.2)
    save("bigwin_end", verb(soft_clip(x, 1.1), 0.38, 3.2, 3800), rms=-15)


def s_wheel_tick():
    # the Depth Wheel is a ship's helm: one wooden spoke-pawl click
    save("wheel_tick", wood_knock(780, 0.06, 1.3, 5), rms=-20)


def s_wheel_land(hit: bool):
    if hit:
        # a bonus: "two bells" on the ship's bell, the sea lifting
        d = 3.6
        x = np.zeros(int(d * SR))
        place(x, ship_bell(hz("D5"), 2.8, 0.8), 0)
        place(x, ship_bell(hz("D5"), 2.6, 0.7), 0.42)
        place(x, wave(2.6, 0.4, 120, 2800, seed=24) * 0.45, 0.1)
        save("wheel_win", verb(x, 0.35, 2.6, 4200), rms=-17)
    else:
        # still water: the helm settles with a creak and the swell goes quiet
        d = 2.2
        x = pad_to(creak(0.9, (30, 12), (200, 450, 900), 9, 0.6, seed=29), d)
        place(x, wave(1.8, 0.25, 90, 900, seed=25) * 0.35, 0.2)
        save("wheel_miss", verb(x, 0.35, 2.2, 2600), rms=-22)


def s_ui_click():
    # menu buttons: a small hard knock on oak
    save("ui_click", wood_knock(1300, 0.06, 1.0, 7), rms=-24)


def s_ui_buy():
    # a purchase: a rope pulled taut and a single small bell
    d = 2.2
    x = pad_to(creak(0.18, (120, 60), (500, 1100, 2000), 8, 0.5, seed=33), d)
    place(x, ship_bell(hz("A5"), 1.8, 0.55), 0.12)
    save("ui_buy", verb(x, 0.3, 1.8, 5000), rms=-20)


def s_slam():
    # "The Hunt Begins": a harpoon thrown full force, it hits, the sea erupts and the war drum answers
    d = 3.6
    x = np.zeros(int(d * SR))
    place(x, whistle(0.45, 3600, 900, 0.7, seed=9), 0)
    place(x, deep_drum(44, 2.2, 1.2), 0.45)
    place(x, wood_knock(140, 0.4, 1.6, 9) * 0.9, 0.45)
    place(x, wave(2.6, 0.12, 110, 3600, seed=26) * 0.8, 0.45)
    place(x, conch(hz("D4"), 1.6, 0.6, 5, seed=11), 0.6)
    save("slam", verb(soft_clip(x, 1.4), 0.34, 3.0, 3200), rms=-15)


# ================================================================ MUSIC + AMBIENCE
def m_ambience():
    # below the hull: deep current, the ship's timbers working, distant whales, bubbles drifting up
    P = 24.0

    def render(dur):
        n = int(dur * SR)
        tt = np.arange(n) / SR
        rum = filt(pnoise(dur, P, "brown"), "low", 220) * (0.7 + 0.3 * np.sin(2 * np.pi * tt / P * 2))
        cur = filt(pnoise(dur, P, "pink"), "band", (200, 700)) * (0.5 + 0.5 * np.sin(2 * np.pi * tt / P * 3 + 1)) * 0.07
        x = rum + cur
        events = [(1.5, "creak"), (5.0, "bub"), (8.5, "whale"), (12.0, "bub"), (14.5, "creak"), (17.0, "bub"), (20.0, "bub")]
        sounds = {
            "creak": creak(1.6, (16, 28), (180, 400, 820), 10, 0.25, seed=81),
            "bub": bubbles(1.0, 12, (1.0, 3.5), 0.8, 0.12, seed=82, rise=0.6),
            "whale": whale_call(3.4, 150, 310, 210, 0.12, seed=12),
        }
        for k in range(int(np.ceil(dur / P)) + 1):
            for at, kind in events:
                place(x, sounds[kind], k * P + at)
        return verb_st(underwater(x, 2400), 0.45, 4.0, 1800)[:n]

    save("amb_deep", periodic(render, P, 0.5), rms=-28, loop=P, bus="amb")


def m_base():
    # "The Deep" (75 bpm, 12 bars): a low cello drone and a slow D-Dorian cello line over a frame-drum
    # heartbeat; a wordless low choir breathes under it and whales call between phrases. No bells.
    bpm = 75
    beat = 60 / bpm
    bar = 4 * beat
    P = 12 * bar
    melody = [("D3", 0, 2), ("F3", 2, 1), ("E3", 3, 1), ("A3", 4, 3), ("G3", 7, 1), ("F3", 8, 2), ("E3", 10, 1), ("C3", 11, 1),
              ("D3", 12, 3), ("A2", 15, 1), ("C3", 16, 2), ("D3", 18, 2), ("F3", 20, 2), ("E3", 22, 2),
              ("D3", 24, 4), ("B2", 28, 2), ("C3", 30, 2), ("A2", 32, 4), ("C3", 36, 2), ("E3", 38, 2), ("D3", 40, 8)]
    choir = [["D2", "A2"], ["F2", "C3"], ["C2", "G2"], ["A1", "E2"]]
    drone = cello(hz("D2"), P + 1.0, 0.35, 1.5, 1.0, 0.002, seed=1)
    lines = [(cello(hz(n), d * beat + 0.4, 0.55, 0.22, 0.35, 0.005, seed=i), s * beat) for i, (n, s, d) in enumerate(melody)]
    drum_a, drum_b = frame_drum(78, 0.9, 0.6, 0.15), frame_drum(70, 0.9, 0.38, 0.1)
    choirs = []
    for c, notes in enumerate(choir):
        dur = 3 * bar + 1.0
        f = np.full(int(dur * SR), 1.0)
        v = sum(voice(f * hz(nn) * (1 + det), ("oo", "oh"), 0.12, 0.006, 0, seed=c * 7 + j) for j, nn in enumerate(notes) for det in (-0.003, 0.003))
        choirs.append(v * env(len(v), 1.0, 1.0, 1.0, 1.0, 1.0))
    whale = whale_call(3.0, 160, 340, 230, 0.18, seed=21)

    def render(dur):
        n = int(dur * SR)
        x = np.zeros(n)
        for k in range(int(np.ceil(dur / P)) + 1):
            o = k * P
            place(x, drone, o)
            for s, at in lines:
                place(x, s, o + at)
            for b in range(12):
                place(x, drum_a, o + b * bar)
                place(x, drum_b, o + b * bar + beat * 0.75)
            for c in range(4):
                place(x, choirs[c], o + c * 3 * bar)
            place(x, whale, o + 5 * bar + beat)
        return verb_st(underwater(x, 4200), 0.38, 3.6, 2800)[:n]

    save("music_base", periodic(render, P, 0.6), rms=-22, loop=P, bus="music", tail=0.6)


def m_bonus():
    # "The Hunt" (105 bpm, 16 bars): war frame drums and a deep drum, a driving cello ostinato,
    # a conch-horn call every four bars, a shell rattle, the choir pushing on "ah".
    bpm = 105
    beat = 60 / bpm
    bar = 4 * beat
    P = 16 * bar
    roots = ["D2", "Bb1", "C2", "A1"]
    ostinato = [0, 0, 12, 0, 7, 0, 12, 10]  # semitones over the root, eighths
    stabs = {(r, s): cello_stab(hz(r) * 2 ** (s / 12), beat / 2 + 0.05, 0.5, seed=s) for r in roots for s in set(ostinato)}
    deep = deep_drum(50, 1.2, 0.9)
    fd_hi, fd_lo = frame_drum(120, 0.5, 0.5, 0.6), frame_drum(92, 0.6, 0.65, 0.5)
    sh = shell_shaker(0.1, 0.22)
    horn_a = conch(hz("D4"), 1.0, 0.45, 3, seed=31)
    horn_b = conch(hz("A4"), 1.5, 0.45, 2, seed=32)
    choir = []
    for c, r in enumerate(roots):
        dur = 4 * bar + 0.6
        f = np.full(int(dur * SR), 1.0)
        notes = [hz(r) * 2, hz(r) * 3, hz(r) * 4]
        v = sum(voice(f * nn * (1 + det), ("ah", "oh"), 0.07, 0.006, 0, seed=c * 5 + i) for i, nn in enumerate(notes) for det in (-0.003, 0.003))
        choir.append(v * env(len(v), 0.5, 1.0, 1.0, 0.6, 1.0))

    def render(dur):
        n = int(dur * SR)
        x = np.zeros(n)
        for k in range(int(np.ceil(dur / P)) + 1):
            o = k * P
            for b in range(16):
                at = o + b * bar
                ch = (b // 4) % 4
                if b % 4 == 0:
                    place(x, choir[ch], at)
                for e, s in enumerate(ostinato):
                    place(x, stabs[(roots[ch], s)], at + e * beat / 2)
                place(x, deep, at)
                place(x, deep * 0.7, at + 2 * beat)
                for e, kind in enumerate("hlhhlhlh"):
                    place(x, fd_hi if kind == "h" else fd_lo, at + e * beat / 2 + (beat / 4 if e == 7 else 0))
                for e in range(8):
                    place(x, sh * (0.6 if e % 2 else 1.0), at + e * beat / 2 + beat / 4)
                if b % 4 == 3:
                    place(x, horn_a, at + 0.0)
                    place(x, horn_b, at + 2 * beat)
        return verb_st(underwater(x, 4800), 0.26, 2.6, 3400)[:n]

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
