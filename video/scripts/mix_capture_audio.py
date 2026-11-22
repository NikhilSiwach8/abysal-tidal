#!/usr/bin/env python3
"""Rebuild a captured clip's soundtrack from its sound log (written by capture60.cjs).

    python mix_capture_audio.py <clip>.sounds.json <out>.wav

Mirrors frontend/src/audio.ts: bus levels, native loops between 0.15 s and 0.15 s + loop length,
fade-ins, exponential stop fades, playback-rate changes, and the music duck envelope.
Sources are the lossless renders in art/audio/wav (same sounds the game ships as MP3).
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
WAV = os.path.join(ROOT, "art", "audio", "wav")
MANIFEST = json.load(open(os.path.join(ROOT, "frontend", "src", "audio_manifest.json")))
SR = 44100
LEVEL = {"master": 0.8, "music": 0.42, "amb": 0.5, "sfx": 0.95}  # == LEVEL in audio.ts
LOOP_START = 0.15

_cache = {}


def load(name):
    if name not in _cache:
        sr, x = wavfile.read(os.path.join(WAV, f"{name}.wav"))
        x = x.astype(np.float32) / 32768
        if x.ndim == 1:
            x = np.stack([x, x], 1)
        _cache[name] = x
    return _cache[name]


def main(log_path, out_path):
    log = json.load(open(log_path))
    dur = log["duration"]
    n = int(dur * SR) + 1
    buses = {b: np.zeros((n, 2), np.float32) for b in ("music", "amb", "sfx")}
    ev = sorted(log["events"], key=lambda e: e["t"])
    stops = {e["id"]: e for e in ev if e["k"] == "stop"}
    rates = {}
    for e in ev:
        if e["k"] == "rate":
            rates.setdefault(e["id"], []).append(e)

    for e in ev:
        if e["k"] != "start":
            continue
        x = load(e["n"])
        meta = MANIFEST.get(e["n"], {})
        bus = e.get("bus") or meta.get("bus", "sfx")
        s0 = int(round(e["t"] * SR))
        if s0 >= n:
            continue
        stop = stops.get(e["id"])
        loop = e["loop"] and "loop" in meta
        end_t = stop["t"] + stop["fade"] + 0.05 if stop else (dur if loop else e["t"] + len(x) / SR / max(e["rate"], 0.25) + 0.01)
        s1 = min(n, int(round(end_t * SR)))
        if s1 <= max(s0, 0):
            continue
        idx = np.arange(max(s0, 0), s1)
        tt = idx / SR
        # playback position (source samples) with piecewise rate
        rate = np.full(len(idx), float(e["rate"]))
        for r in rates.get(e["id"], []):
            rate[tt >= r["t"]] = r["rate"]
        pos = np.cumsum(rate) - rate[0] + (max(0, -s0) * rate[0])
        if loop:
            a = LOOP_START * SR
            L = meta["loop"] * SR
            over = pos >= a + L
            pos = np.where(over, a + np.mod(pos - a, L), pos)
        valid = pos < len(x) - 1
        pos = np.clip(pos, 0, len(x) - 2)
        i = pos.astype(np.int64)
        f = (pos - i)[:, None]
        y = x[i] * (1 - f) + x[i + 1] * f
        y[~valid] = 0
        # gain: fade-in, then stop fade (exponential to -80 dB like the engine)
        g = np.full(len(idx), float(e["gain"]), np.float32)
        if e.get("fadeIn"):
            k = np.clip((tt - e["t"]) / e["fadeIn"], 0, 1)
            g *= 0.0001 ** (1 - k)
        if stop:
            k = np.clip((tt - stop["t"]) / max(stop["fade"], 1e-3), 0, 1)
            g *= np.where(tt >= stop["t"], 0.0001 ** k, 1)
        buses[bus][idx] += y * g[:, None]

    # music duck: each call replaces the envelope from its time on (cancelScheduledValues)
    duck = np.ones(n, np.float32)
    t = np.arange(n) / SR
    for e in (e for e in ev if e["k"] == "duck"):
        t0 = e["t"]
        cur = float(duck[min(n - 1, max(0, int(t0 * SR)))])
        d, h, r = e["depth"], e["hold"], e["release"]
        seg = t >= t0
        v = np.interp(t[seg], [t0, t0 + 0.08, t0 + max(h, 0.08), t0 + max(h, 0.08) + r], [cur, d, d, 1.0])
        duck[seg] = v

    mix = buses["music"] * duck[:, None] * LEVEL["music"] + buses["amb"] * LEVEL["amb"] + buses["sfx"] * LEVEL["sfx"]
    mix *= LEVEL["master"]
    # the engine's bus compressor + a safety limiter
    peak = 0.89
    mix = np.where(np.abs(mix) > 0.5, np.sign(mix) * (0.5 + (peak - 0.5) * np.tanh((np.abs(mix) - 0.5) / (peak - 0.5))), mix)
    wavfile.write(out_path, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
    starts = sum(1 for e in ev if e["k"] == "start")
    print(f"mixed {starts} sounds over {dur:.2f} s, peak {20 * np.log10(np.abs(mix).max() + 1e-9):.1f} dBFS -> {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
