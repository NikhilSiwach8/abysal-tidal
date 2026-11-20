import React from "react"
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { Bubbles, Grade, Grain, Layer, PreviewBg, Vignette, useSvgImage } from "./components"
import { breath, cyclePos, theme, wave } from "./theme"

type LoopProps = { preview?: boolean } // preview: render over a dark backdrop (MP4); else transparent

const M = theme.motion
// Keep every frame on the same (resampled) raster path: an exactly-zero transform at
// frame 0 draws crisper than its neighbours and "pops" once per loop.
const RASTER_EPS = 0.001

// ------------------------------------------------------------------ Hero idle
export const HeroIdle: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const b = breath(f, N)
  const scarf = wave(f, N, 1, 1.3) * M.clothSkew
  const coat = wave(f, N, 1, 1.9) * M.clothSkew
  const eyes = 0.55 + 0.45 * (0.5 + 0.5 * wave(f, N, 2, 0.4)) // 2.5 s pulse
  const r = theme.rig.hero
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <AbsoluteFill style={{ transform: `translateY(${M.breatheY * b}%) rotate(${M.breatheRot * b + RASTER_EPS}deg)`, transformOrigin: "50% 100%" }}>
        <Layer src="hero_coat.webp" style={{ transform: `skewY(${coat}deg)`, transformOrigin: `${r.coatPivotX}% 50%` }} />
        <Layer src="hero_body.webp" />
        <Layer src="hero_scarf.webp" style={{ transform: `skewY(${scarf}deg)`, transformOrigin: `${r.scarfPivotX}% 50%` }} />
        <Layer src="hero_eyes.webp" style={{ opacity: eyes, mixBlendMode: "screen",
          filter: `brightness(1.4) drop-shadow(0 0 10px ${theme.colors.tealHi})` }} />
      </AbsoluteFill>
      <Bubbles count={5} area={{ x0: 8, x1: 40, yStart: 92, yEnd: 4 }} size={[16, 34]} seed={0.2} />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ Leviathan idle
export const LeviathanIdle: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const b = breath(f, N)
  const head = wave(f, N, 1, 0.8) * M.headSkew
  const gills = 0.7 + 0.3 * (0.5 + 0.5 * wave(f, N, 2)) // 0.7 -> 1, 2.5 s period
  const r = theme.rig.lev
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <AbsoluteFill style={{ transform: `translateY(${M.breatheY * b}%) rotate(${M.breatheRot * b + RASTER_EPS}deg)`, transformOrigin: "50% 100%" }}>
        <Layer src="lev_body.webp" />
        <Layer src="lev_head.webp" style={{ transform: `skewY(${head}deg)`, transformOrigin: `${r.headPivotX}% 50%` }} />
        <Layer src="lev_gills.webp" style={{ opacity: gills, mixBlendMode: "screen",
          filter: `brightness(1.5) drop-shadow(0 0 10px ${theme.colors.teal}) drop-shadow(0 0 22px ${theme.colors.teal})` }} />
      </AbsoluteFill>
      {/* a few bubbles escaping the open jaw */}
      <Bubbles count={4} area={{ x0: 14, x1: 26, yStart: 26, yEnd: 2 }} size={[12, 26]} seed={0.55} />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ Background
const Cover: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <Img src={staticFile(src)} style={{ position: "absolute", inset: "-4%", width: "108%", height: "108%", objectFit: "cover", ...style }} />
)

const Rays: React.FC = () => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const w = wave(f, N)
  const beams: [number, number, number][] = [[22, 9, 1], [38, 5, 0.7], [55, 7, 1], [71, 4, 0.6]]
  return (
    <AbsoluteFill style={{ inset: "-6% -10%", mixBlendMode: "screen", transformOrigin: "50% 0",
      transform: `translateX(${w * M.raysShift}px) skewX(${w * M.raysSkew}deg)` }}>
      {beams.map(([left, width, op], i) => (
        <div key={i} style={{ position: "absolute", top: "-10%", left: `${left}%`, width: `${width}%`, height: "120%", opacity: op,
          background: "linear-gradient(180deg, rgba(243,245,242,.32), rgba(243,245,242,0) 85%)",
          transform: "skewX(-18deg)", filter: "blur(14px)" }} />
      ))}
    </AbsoluteFill>
  )
}

const Fog: React.FC = () => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const x = wave(f, N, 1, 0.6) * 3
  return (
    <AbsoluteFill style={{ opacity: 0.4, transform: `translateX(${x}%) scaleX(1.1)`,
      background: "radial-gradient(ellipse 60% 30% at 30% 85%, rgba(220,223,215,.9), transparent 70%), radial-gradient(ellipse 55% 28% at 75% 80%, rgba(220,223,215,.8), transparent 70%), linear-gradient(180deg, transparent 45%, rgba(201,206,198,.55) 100%)" }} />
  )
}

const Flakes: React.FC = () => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const p = cyclePos(f, N, (i * 0.618034) % 1)
        const sway = Math.sin(p * Math.PI * 4 + i) * 1.4 // % of width
        const x = 18 + i * 12 - p * 22 + sway // falls top-right -> bottom-left
        const y = -8 + p * 116 // enters and leaves off-frame, so the wrap is unseen
        const rot = (180 + ((i * 47) % 181)) * p
        return (
          <Img key={i} src={staticFile(`fx/flake_0${(i % 7) + 1}.webp`)}
            style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 34 + (i % 3) * 12,
              transform: `translate(-50%,-50%) rotate(${rot}deg)`, filter: "blur(.7px)", opacity: 0.85 }} />
        )
      })}
    </>
  )
}

export const BackgroundLoop: React.FC = () => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const mid = wave(f, N, 1, 1.0) * M.midDrift
  const far = wave(f, N, 1, 2.0) * 0.6 // % gentle drift
  const kelpL = wave(f, N, 1, 0) * M.kelpSkew
  const kelpR = wave(f, N, 1, 2.5) * M.kelpSkew // half a cycle apart = staggered
  return (
    <AbsoluteFill style={{ background: theme.colors.fog }}>
      {/* 1 background */}
      <Cover src="bg_far.webp" style={{ transform: `translateX(${far}%)` }} />
      <Rays />
      {/* 2 assets */}
      <Cover src="bg_mid.webp" style={{ transform: `translateX(${mid}px)` }} />
      <Fog />
      <Cover src="bg_front.webp" style={{ clipPath: "inset(0 50% 0 0)", transformOrigin: "20% 100%", transform: `skewX(${kelpL}deg)` }} />
      <Cover src="bg_front.webp" style={{ clipPath: "inset(0 0 0 50%)", transformOrigin: "80% 100%", transform: `skewX(${kelpR}deg)` }} />
      {/* 3 particles */}
      <Bubbles count={10} area={{ x0: 4, x1: 96, yStart: 104, yEnd: -4 }} size={[14, 40]} seed={0.1} />
      <Flakes />
      {/* 4 grade, 5 grain + vignette */}
      <Grade />
      <Grain />
      <Vignette />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ Logo shimmer
export const LogoShimmer: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { durationInFrames: N, fps } = useVideoConfig()
  const t = f / N
  // light sweep left -> right across the first 60% of the loop, off-frame at both ends
  const sweep = interpolate(t, [0.1, 0.7], [-40, 140], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const logo = `url(${staticFile("logo_full.png")})`
  // ink droplets flick off the end of the swash as the light passes it, gone before the loop ends
  const flickStart = Math.round(0.62 * N)
  const drops = [[1.0, -0.6], [1.5, -0.2], [0.8, 0.3]]
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <AbsoluteFill style={{ padding: "4%" }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Img src={staticFile("logo_full.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen",
            WebkitMaskImage: logo, maskImage: logo, WebkitMaskSize: "contain", maskSize: "contain",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center",
            background: `linear-gradient(105deg, transparent ${sweep - 14}%, rgba(95,227,210,.9) ${sweep}%, transparent ${sweep + 14}%)` }} />
          {drops.map(([speed, dir], i) => {
            const local = (f - flickStart - i * Math.round(fps * 0.08)) / fps
            if (local < 0) return null
            const op = interpolate(local, [0, 0.12, 0.9], [0, 1, 0], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            const x = 93 + local * 9 * speed
            const y = 22 + dir * local * 20 + local * local * 30
            return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 10 - i * 2, height: 10 - i * 2,
              borderRadius: "50%", background: theme.colors.ink, opacity: op }} />
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ Depth Wheel hub
/**
 * Hub cap idle (5 s): the chest rocks on its base, the teal seam glow pulses with sparks
 * rising out of it, the ink question mark drifts like smoke, and the cap breathes. The
 * art is one flat image, so each part moves as a feathered, masked copy over the base.
 */
export const WheelHubIdle: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const W = theme.wheel.art
  const H = theme.wheel.hub
  const src = useSvgImage(staticFile("wheel_hub.png"))
  const rock = wave(f, N, 1, 0.5) * H.rockDeg
  const seam = 0.35 + 0.55 * (0.5 + 0.5 * wave(f, N, 2, 0.2)) // 2.5 s pulse
  const ang = (2 * Math.PI * f) / N // smoke noise orbits once per loop -> seamless
  const sx = Math.cos(ang) * H.smokeOrbit
  const sy = Math.sin(ang) * H.smokeOrbit
  const scale = 1 + H.breathe * breath(f, N, 0.8)
  const [px, py] = H.rockPivot
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const p = cyclePos(f, N, (i * 0.618034) % 1)
    const x = H.seam.cx - 220 + ((i * 0.37) % 1) * 440 + Math.sin(p * Math.PI * 3 + i) * 18
    const y = H.seam.cy - p * 230
    const op = interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 0.6, 0], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    return <circle key={i} cx={x} cy={y} r={7 + (i % 3) * 3} fill="url(#spark)" opacity={op} />
  })
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <AbsoluteFill><svg viewBox={`0 0 ${W} ${W}`} style={{ width: "100%", height: "100%" }}>
        <defs>
          <filter id="smoke" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={2} seed={4} result="n" />
            <feOffset in="n" dx={sx} dy={sy} result="no" />
            <feDisplacementMap in="SourceGraphic" in2="no" scale={H.smokeScale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="feather"><stop offset="55%" stopColor="#fff" /><stop offset="100%" stopColor="#000" /></radialGradient>
          <mask id="qm"><ellipse cx={H.qmark.cx} cy={H.qmark.cy} rx={H.qmark.rx} ry={H.qmark.ry} fill="url(#feather)" /></mask>
          <mask id="cm"><ellipse cx={H.chest.cx} cy={H.chest.cy} rx={H.chest.rx} ry={H.chest.ry} fill="url(#feather)" /></mask>
          <radialGradient id="seamGlow"><stop offset="0%" stopColor={theme.colors.tealHi} stopOpacity={0.95} /><stop offset="60%" stopColor={theme.colors.teal} stopOpacity={0.35} /><stop offset="100%" stopColor={theme.colors.teal} stopOpacity={0} /></radialGradient>
          <radialGradient id="spark"><stop offset="0%" stopColor="#F3F5F2" /><stop offset="45%" stopColor={theme.colors.tealHi} /><stop offset="100%" stopColor={theme.colors.tealHi} stopOpacity={0} /></radialGradient>
        </defs>
        <g transform={`translate(${W / 2} ${W / 2}) scale(${scale}) rotate(${RASTER_EPS}) translate(${-W / 2} ${-W / 2})`}>
          <image href={src} width={W} height={W} />
          <g mask="url(#qm)"><image href={src} width={W} height={W} filter="url(#smoke)" /></g>
          <g transform={`rotate(${rock + RASTER_EPS} ${px} ${py})`}>
            <g mask="url(#cm)"><image href={src} width={W} height={W} /></g>
            <ellipse cx={H.seam.cx} cy={H.seam.cy} rx={H.seam.rx} ry={H.seam.ry} fill="url(#seamGlow)" opacity={seam} style={{ mixBlendMode: "screen" }} />
          </g>
          <g style={{ mixBlendMode: "screen" }}>{sparks}</g>
        </g>
      </svg></AbsoluteFill>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ Depth Wheel back glow
/**
 * Back-glow loop (10 s): the water ring sways, its strokes flow (displacement noise on a
 * circular path), the bloom breathes twice, and droplets orbit once per loop.
 */
export const WheelGlowLoop: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { durationInFrames: N } = useVideoConfig()
  const W = theme.wheel.art
  const G = theme.wheel.glow
  const src = useSvgImage(staticFile("wheel_glow.png"))
  const sway = wave(f, N, 1) * G.swayDeg
  const scale = 1 + G.breathe * breath(f, N)
  const bloom = 0.25 + 0.3 * (0.5 + 0.5 * wave(f, N, 2, 1))
  const ang = (2 * Math.PI * f) / N
  const fx = Math.cos(ang) * G.flowOrbit
  const fy = Math.sin(ang) * G.flowOrbit
  const c = W / 2
  const drops = Array.from({ length: G.droplets }, (_, i) => {
    const a = ang + (i / G.droplets) * 2 * Math.PI + ((i * 0.37) % 1) * 0.4
    const rad = 455 + ((i * 0.618) % 1) * 110 + wave(f, N, 3, i * 0.7) * 14
    const op = 0.35 + 0.65 * (0.5 + 0.5 * wave(f, N, 2, i * 0.9))
    return <circle key={i} cx={c + Math.sin(a) * rad} cy={c - Math.cos(a) * rad} r={6 + (i % 4) * 3} fill="url(#drop)" opacity={op} />
  })
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <AbsoluteFill><svg viewBox={`0 0 ${W} ${W}`} style={{ width: "100%", height: "100%" }}>
        <defs>
          <filter id="flow" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves={2} seed={9} result="n" />
            <feOffset in="n" dx={fx} dy={fy} result="no" />
            <feDisplacementMap in="SourceGraphic" in2="no" scale={G.flowScale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="bloom" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="22" /></filter>
          <radialGradient id="drop"><stop offset="0%" stopColor="#F3F5F2" /><stop offset="40%" stopColor={theme.colors.tealHi} /><stop offset="100%" stopColor={theme.colors.tealHi} stopOpacity={0} /></radialGradient>
        </defs>
        <g transform={`translate(${c} ${c}) rotate(${sway + RASTER_EPS}) scale(${scale}) translate(${-c} ${-c})`}>
          <image href={src} width={W} height={W} filter="url(#bloom)" opacity={bloom} style={{ mixBlendMode: "screen" }} />
          <image href={src} width={W} height={W} filter="url(#flow)" />
        </g>
        <g style={{ mixBlendMode: "screen" }}>{drops}</g>
      </svg></AbsoluteFill>
    </AbsoluteFill>
  )
}
