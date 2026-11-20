import React from "react"
import { AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { cyclePos, theme } from "./theme"

/** A full-canvas rig layer: every layer shares the source canvas so they stack exactly. */
export const Layer: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }} />
)

/** Bubbles rising once per loop, fading in and out; wrap happens while invisible. */
export const Bubbles: React.FC<{
  count: number
  area: { x0: number; x1: number; yStart: number; yEnd: number } // % of frame
  size: [number, number] // px range
  seed?: number
}> = ({ count, area, size, seed = 0 }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const k = (i * 0.618034 + seed) % 1
        const p = cyclePos(frame, durationInFrames, k)
        const y = area.yStart + (area.yEnd - area.yStart) * p
        const x = area.x0 + (area.x1 - area.x0) * ((i * 0.37 + seed * 0.5) % 1) + Math.sin(p * Math.PI * 4) * 0.6
        const opacity = interpolate(p, [0, 0.12, 0.8, 1], [0, 0.85, 0.6, 0], {
          easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        })
        const s = size[0] + (size[1] - size[0]) * ((i * 0.53) % 1)
        return (
          <Img key={i} src={staticFile(`fx/bubble_0${(i % 8) + 1}.webp`)}
            style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: s, opacity, transform: "translate(-50%,-50%)" }} />
        )
      })}
    </>
  )
}

/** Paper grain; the offset advances a whole number of tiles per loop so it stays seamless. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`
  const t = frame / durationInFrames
  return (
    <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
      backgroundPosition: `${t * 220 * 5}px ${t * 220 * 3}px`, opacity, mixBlendMode: "multiply" }} />
  )
}

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none",
    background: "radial-gradient(ellipse at center, transparent 58%, rgba(10,13,14,0.32) 100%)" }} />
)

/** Cool underwater grade (warm-free, slightly lifted blacks). */
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, rgba(95,227,210,0.05), rgba(23,27,29,0.12))", mixBlendMode: "soft-light" }} />
)

/** Dark slate backdrop for MP4 previews of transparent loops. */
export const PreviewBg: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #3a464b, ${theme.colors.previewBg} 70%)` }} />
)

/**
 * Hold the render until `src` is loaded and decoded. Remotion waits for <Img>, but not for
 * <image> inside an SVG, which would otherwise be captured blank.
 */
export function useSvgImage(src: string): string {
  const [handle] = React.useState(() => delayRender(`load ${src}`))
  React.useEffect(() => {
    const im = new Image()
    im.src = src
    im.decode().then(() => continueRender(handle), () => continueRender(handle))
  }, [src, handle])
  return src
}
