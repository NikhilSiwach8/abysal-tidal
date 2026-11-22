import React from "react"
import { AbsoluteFill, Img, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
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

// ------------------------------------------------------------------ Logo (reveal + idle)
// The logo is two painted layers (tools/split_logo.py): the teal swash behind and the white
// lettering in front. Canvas = logo + 10% margin on every side (room for splashes), 2:1.
const LOGO = { w: 1758, h: 879, margin: 0.1 }

/** Seeded particle list (deterministic between renders). */
function particles(n: number, seed: number) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: n }, () => ({ a: r(), b: r(), c: r(), d: r() }))
}

const LogoStage: React.FC<{ children: React.ReactNode; scale?: number; rot?: number; dy?: number }> = ({ children, scale = 1, rot = 0, dy = 0 }) => (
  <AbsoluteFill style={{ padding: `${LOGO.margin * 100}%` }}>
    <svg viewBox={`0 0 ${LOGO.w} ${LOGO.h}`} style={{ width: "100%", height: "100%", overflow: "visible",
      transform: `translateY(${dy}%) scale(${scale}) rotate(${rot + RASTER_EPS}deg)` }}>
      {children}
    </svg>
  </AbsoluteFill>
)

/**
 * LogoReveal (2.6 s, transparent): the swash slashes in with a ragged brush edge flinging water;
 * "ABYSSAL" then "TIDE" are painted in by brush strokes while the logo settles; ink splatter bursts
 * on impact and a glint runs over the letters. The last frames are exactly the static logo.
 */
export const LogoReveal: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const swashSrc = useSvgImage(staticFile("logo_swash.png"))
  const letterSrc = useSvgImage(staticFile("logo_letters.png"))
  const { w: W, h: H } = LOGO
  const sec = (s: number) => s * fps
  const ease = (from: number, to: number, a: number, b: number, e = theme.ease.out) =>
    interpolate(f, [sec(a), sec(b)], [from, to], { easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  // brush wipes: 0..1 progress, drawn as skewed rects whose edge is torn by turbulence
  const swashP = ease(0, 1, 0.05, 0.42, theme.ease.inOut)
  const lineA = ease(0, 1, 0.3, 0.72, theme.ease.inOut)
  const lineB = ease(0, 1, 0.52, 0.92, theme.ease.inOut)
  const settle = spring({ frame: f - sec(0.28), fps, config: { damping: 11, stiffness: 120, mass: 0.9 } })
  const scale = interpolate(settle, [0, 1], [1.12, 1])
  const rot = interpolate(settle, [0, 1], [-2.5, 0])
  const impact = sec(0.92)
  const glint = ease(-0.3, 1.3, 1.05, 1.7, theme.ease.inOut)
  const rag = interpolate(f, [0, sec(1.1)], [70, 0], { extrapolateRight: "clamp" }) // edge tears heal once painted
  const spray = particles(18, 7)
  const ink = particles(16, 11)
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <LogoStage scale={scale} rot={rot}>
        <defs>
          <filter id="rag" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={3} seed={3} />
            <feDisplacementMap in="SourceGraphic" scale={rag} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <mask id="mSwash" maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}>
            <g filter="url(#rag)"><rect x={-W * 0.2} y={-H * 0.2} width={W * 1.45 * swashP} height={H * 1.4} fill="#fff" transform={`skewX(-28)`} /></g>
          </mask>
          <mask id="mLetters" maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}>
            <g filter="url(#rag)">
              <rect x={-W * 0.15} y={-H * 0.1} width={W * 1.35 * lineA} height={H * 0.62} fill="#fff" transform="skewX(-18)" />
              <rect x={W * 0.05} y={H * 0.48} width={W * 1.25 * lineB} height={H * 0.62} fill="#fff" transform="skewX(-18)" />
            </g>
          </mask>
          <mask id="mGlint"><image href={letterSrc} width={W} height={H} /></mask>
          <linearGradient id="glintG" x1="0" x2="1" y1="0" y2="0.2">
            <stop offset={Math.max(0, glint - 0.12)} stopColor="#fff" stopOpacity={0} />
            <stop offset={Math.min(1, Math.max(0, glint))} stopColor="#e9fffb" stopOpacity={0.85} />
            <stop offset={Math.min(1, glint + 0.12)} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <g mask="url(#mSwash)"><image href={swashSrc} width={W} height={H} /></g>
        {/* water flung off the swash's leading edge */}
        {spray.map((p, i) => {
          const t0 = sec(0.12 + p.a * 0.28)
          const k = (f - t0) / sec(0.7)
          if (k <= 0 || k >= 1) return null
          const x0 = W * (0.1 + p.a * 0.85), y0 = H * (0.85 - p.a * 0.62)
          const x = x0 + (60 + p.b * 160) * k, y = y0 - (90 + p.c * 120) * k + 260 * k * k
          return <circle key={i} cx={x} cy={y} r={(4 + p.d * 9) * (1 - k * 0.6)} fill={theme.colors.tealHi} opacity={(1 - k) * 0.9} />
        })}
        <g mask="url(#mLetters)"><image href={letterSrc} width={W} height={H} /></g>
        {/* ink splatter at the moment the lettering lands */}
        {ink.map((p, i) => {
          const k = (f - impact) / sec(0.55)
          if (k <= 0 || k >= 1) return null
          const ang = p.a * Math.PI * 2, dist = (120 + p.b * 520) * theme.ease.out(k)
          return <circle key={i} cx={W * 0.5 + Math.cos(ang) * dist * 1.6} cy={H * 0.5 + Math.sin(ang) * dist * 0.8} r={(5 + p.c * 14) * (1 - k * 0.5)} fill={theme.colors.ink} opacity={(1 - k) * 0.85} />
        })}
        {glint > -0.2 && glint < 1.2 ? <rect width={W} height={H} fill="url(#glintG)" mask="url(#mGlint)" style={{ mixBlendMode: "screen" }} /> : null}
      </LogoStage>
    </AbsoluteFill>
  )
}

/**
 * LogoIdle (5 s seamless loop, transparent) for the game's corner: the swash flows like water
 * (displacement noise on a circular path), a glint passes over the white letters once, droplets
 * drip off the swash tail, and the logo breathes very slightly.
 */
export const LogoIdle: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { durationInFrames: N, fps } = useVideoConfig()
  const swashSrc = useSvgImage(staticFile("logo_swash.png"))
  const letterSrc = useSvgImage(staticFile("logo_letters.png"))
  const { w: W, h: H } = LOGO
  const ang = (2 * Math.PI * f) / N
  const b = breath(f, N)
  const glint = interpolate(f, [0.15 * N, 0.5 * N], [-0.3, 1.3], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const drips = [0.55, 0.62, 0.71].map((at, i) => ({ at, x: W * (0.935 + i * 0.012), y: H * (0.2 + i * 0.03) }))
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <LogoStage scale={1 + 0.008 * b}>
        <defs>
          <filter id="flowL" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={5} result="n" />
            <feOffset in="n" dx={Math.cos(ang) * 70} dy={Math.sin(ang) * 70} result="no" />
            <feDisplacementMap in="SourceGraphic" in2="no" scale={14} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <mask id="mGlintI"><image href={letterSrc} width={W} height={H} /></mask>
          <linearGradient id="glintI" x1="0" x2="1" y1="0" y2="0.2">
            <stop offset={Math.max(0, glint - 0.1)} stopColor="#fff" stopOpacity={0} />
            <stop offset={Math.min(1, Math.max(0, glint))} stopColor="#e9fffb" stopOpacity={0.7} />
            <stop offset={Math.min(1, glint + 0.1)} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <image href={swashSrc} width={W} height={H} filter="url(#flowL)" />
        {drips.map((d, i) => {
          const k = (f / N - d.at) / 0.22
          if (k <= 0 || k >= 1) return null
          return <ellipse key={i} cx={d.x} cy={d.y + 150 * k * k} rx={6} ry={6 + 8 * k} fill={theme.colors.tealHi} opacity={Math.sin(Math.PI * k) * 0.9} />
        })}
        <image href={letterSrc} width={W} height={H} />
        {glint > -0.2 && glint < 1.2 ? <rect width={W} height={H} fill="url(#glintI)" mask="url(#mGlintI)" style={{ mixBlendMode: "screen" }} /> : null}
      </LogoStage>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ "THE HUNT BEGINS" title
/** Load the game's title font (Permanent Marker) and hold the render until it is ready. */
function useTitleFont(): string {
  const [handle] = React.useState(() => delayRender("title font"))
  React.useEffect(() => {
    const face = new FontFace("TitleMarker", `url(${staticFile("permanent-marker.woff2")})`)
    face.load().then((f) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(f); continueRender(handle) }, () => continueRender(handle))
  }, [handle])
  return "TitleMarker"
}

/**
 * TitleHunt (1.9 s, transparent, 1600x560): a water slash cuts across, then THE / HUNT / BEGINS each
 * slam in on their own beat (HUNT hardest), revealed by a torn brush stroke; coral ink bursts on the
 * HUNT impact, the whole title shakes once, and a glint runs over it. Ends on a still title.
 */
export const TitleHunt: React.FC<LoopProps> = ({ preview }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const font = useTitleFont()
  const slash = useSvgImage(staticFile("water_slash.png"))
  const sec = (s: number) => s * fps
  const W = 1600, H = 560
  // exact widths (textLength) so the three words sit side by side with even gaps
  const words = [
    { text: "THE", x: 225, y: 318, size: 130, w: 250, at: 0.14, push: 1.9 },
    { text: "HUNT", x: 672, y: 334, size: 220, w: 560, at: 0.3, push: 2.6 },
    { text: "BEGINS", x: 1240, y: 318, size: 150, w: 500, at: 0.5, push: 2.1 },
  ]
  const slashP = interpolate(f, [sec(0), sec(0.32)], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const hit = sec(0.3 + 0.16)
  const shakeK = interpolate(f, [hit, hit + sec(0.35)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const shake = f >= hit ? Math.sin((f - hit) * 1.9) * 14 * shakeK : 0
  const glint = interpolate(f, [sec(0.95), sec(1.55)], [-0.3, 1.3], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const rag = interpolate(f, [0, sec(1.0)], [55, 0], { extrapolateRight: "clamp" })
  const ink = particles(22, 19)
  const stroke = (size: number) => size * 0.11
  return (
    <AbsoluteFill>
      {preview ? <PreviewBg /> : null}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", overflow: "visible", transform: `translate(${shake}px, ${shake * -0.5}px) rotate(${-4 + RASTER_EPS}deg)` }}>
        <defs>
          <filter id="ragT" x="-20%" y="-30%" width="140%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={3} seed={8} />
            <feDisplacementMap in="SourceGraphic" scale={rag} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <mask id="mSlash" maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}>
            <g filter="url(#ragT)"><rect x={-100} y={-100} width={(W + 300) * slashP} height={H + 200} fill="#fff" transform="skewX(-25)" /></g>
          </mask>
          <linearGradient id="glintT" x1="0" x2="1" y1="0" y2="0.15">
            <stop offset={Math.max(0, glint - 0.08)} stopColor="#fff" stopOpacity={0} />
            <stop offset={Math.min(1, Math.max(0, glint))} stopColor="#e9fffb" stopOpacity={0.9} />
            <stop offset={Math.min(1, glint + 0.08)} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          {words.map((w, i) => {
            const p = interpolate(f, [sec(w.at), sec(w.at + 0.16)], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            const half = w.w / 2
            return (
              <mask key={i} id={`mw${i}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}>
                <g filter="url(#ragT)"><rect x={w.x - half - 60} y={w.y - w.size} width={(half * 2 + 120) * p} height={w.size * 1.4} fill="#fff" transform={`skewX(-18)`} style={{ transformOrigin: `${w.x}px ${w.y}px` }} /></g>
              </mask>
            )
          })}
        </defs>
        {/* the water slash behind the words */}
        <g mask="url(#mSlash)">
          <image href={slash} x={W * 0.02} y={H * 0.08} width={W * 0.96} height={H * 0.86} preserveAspectRatio="none" opacity={0.92} />
        </g>
        {/* coral ink bursting from the HUNT impact */}
        {ink.map((p, i) => {
          const k = (f - hit) / sec(0.6)
          if (k <= 0 || k >= 1) return null
          const a = p.a * Math.PI * 2, dist = (80 + p.b * 520) * theme.ease.out(k)
          return <circle key={i} cx={672 + Math.cos(a) * dist * 1.5} cy={260 + Math.sin(a) * dist * 0.55 + 120 * k * k}
            r={(5 + p.c * 16) * (1 - 0.5 * k)} fill={i % 3 ? theme.colors.coral : theme.colors.ink} opacity={(1 - k) * 0.9} />
        })}
        {words.map((w, i) => {
          const s = spring({ frame: f - sec(w.at), fps, config: { damping: 12, stiffness: 190, mass: 0.7 } })
          const scale = interpolate(s, [0, 1], [w.push, 1])
          const op = interpolate(f, [sec(w.at), sec(w.at + 0.06)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          const common = { x: w.x, y: w.y, textAnchor: "middle" as const, fontFamily: font, fontSize: w.size, textLength: w.w, lengthAdjust: "spacingAndGlyphs" as const }
          return (
            <g key={i} mask={`url(#mw${i})`} opacity={op} style={{ transformOrigin: `${w.x}px ${w.y - w.size * 0.35}px`, transform: `scale(${scale})` }}>
              <text {...common} fill={theme.colors.ink} stroke={theme.colors.ink} strokeWidth={stroke(w.size) * 2.2} strokeLinejoin="round" transform={`translate(0 ${w.size * 0.06})`}>{w.text}</text>
              <text {...common} fill="#F3F5F2" stroke={theme.colors.ink} strokeWidth={stroke(w.size)} strokeLinejoin="round" paintOrder="stroke">{w.text}</text>
              {glint > -0.2 && glint < 1.2 ? <text {...common} fill="url(#glintT)" style={{ mixBlendMode: "screen" }}>{w.text}</text> : null}
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}
