// theme.ts — single source of truth for the Abyssal Tide loops.
// Never inline colours, timings or rig pivots in components.
import { Easing } from "remotion"

export const theme = {
  colors: {
    ink: "#171B1D",
    fog: "#DCDFD7",
    teal: "#2BB3A3",
    tealHi: "#5FE3D2",
    coral: "#E8553E",
    gold: "#FFD36B",
    previewBg: "#2A3337", // dark slate behind transparent loops in MP4 previews
  },
  loop: { seconds: 5, fps: 30 },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  // Rig pivots: the cut line of each moving layer, as % of the source canvas
  // (see tools/rig_characters.py). Skewing about the seam keeps the joins closed.
  rig: {
    hero: { w: 1024, h: 1536, scarfPivotX: 22.95, coatPivotX: 14.65 },
    lev: { w: 971, h: 1619, headPivotX: 44.28 },
  },
  // Amplitudes from art/ABYSSAL_TIDE_ASSET_PROMPTS.txt §9.1
  motion: {
    breatheY: -1.2, // % of height
    breatheRot: -0.6, // deg
    clothSkew: 4, // deg
    headSkew: 4, // deg
    raysShift: 40, // px
    raysSkew: 3, // deg
    midDrift: 8, // px
    kelpSkew: 4, // deg (spec ±5 over a 14 s cycle; ±4 keeps the faster 5 s loop calm)
  },
} as const

/**
 * Seamless periodic wave. `cycles` full sine periods per loop (integer => frame 0 ==
 * frame N), `offsetSec` phase-shifts the wave in seconds. Returns -1..1.
 * Sine motion is inherently eased (slow at the extremes), never linear.
 */
export function wave(frame: number, total: number, cycles = 1, offsetSec = 0): number {
  const p = frame / total - offsetSec / theme.loop.seconds
  return Math.sin(2 * Math.PI * cycles * p)
}

/** 0..1..0 "breath" for one full cycle per loop (rest at frame 0). */
export function breath(frame: number, total: number, offsetSec = 0): number {
  return (1 - Math.cos(2 * Math.PI * (frame / total - offsetSec / theme.loop.seconds))) / 2
}

/** Position 0..1 that wraps once per loop (for particles), with a phase offset 0..1. */
export function cyclePos(frame: number, total: number, phase: number): number {
  return (frame / total + phase) % 1
}
