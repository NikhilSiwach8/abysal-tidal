import React from "react"
import { Composition } from "remotion"
import { BackgroundLoop, HeroIdle, LeviathanIdle, LogoShimmer, WheelGlowLoop, WheelHubIdle } from "./loops"
import { theme } from "./theme"

const { fps, seconds } = theme.loop
const N = fps * seconds
const NG = fps * theme.wheel.glowSeconds

// Transparent loops (WebM VP9 alpha for the game) and *Preview variants over a dark
// backdrop (MP4 for sharing). Sizes are the source canvas, rounded up to even numbers.
export const Root: React.FC = () => (
  <>
    <Composition id="HeroIdle" component={HeroIdle} durationInFrames={N} fps={fps} width={1024} height={1536} defaultProps={{ preview: false }} />
    <Composition id="HeroIdlePreview" component={HeroIdle} durationInFrames={N} fps={fps} width={1024} height={1536} defaultProps={{ preview: true }} />
    <Composition id="LeviathanIdle" component={LeviathanIdle} durationInFrames={N} fps={fps} width={972} height={1620} defaultProps={{ preview: false }} />
    <Composition id="LeviathanIdlePreview" component={LeviathanIdle} durationInFrames={N} fps={fps} width={972} height={1620} defaultProps={{ preview: true }} />
    <Composition id="BackgroundLoop" component={BackgroundLoop} durationInFrames={N} fps={fps} width={1920} height={1080} />
    <Composition id="LogoShimmer" component={LogoShimmer} durationInFrames={N} fps={fps} width={1280} height={640} defaultProps={{ preview: false }} />
    <Composition id="LogoShimmerPreview" component={LogoShimmer} durationInFrames={N} fps={fps} width={1280} height={640} defaultProps={{ preview: true }} />
    <Composition id="WheelHubIdle" component={WheelHubIdle} durationInFrames={N} fps={fps} width={640} height={640} defaultProps={{ preview: false }} />
    <Composition id="WheelHubIdlePreview" component={WheelHubIdle} durationInFrames={N} fps={fps} width={640} height={640} defaultProps={{ preview: true }} />
    <Composition id="WheelGlowLoop" component={WheelGlowLoop} durationInFrames={NG} fps={fps} width={1024} height={1024} defaultProps={{ preview: false }} />
    <Composition id="WheelGlowLoopPreview" component={WheelGlowLoop} durationInFrames={NG} fps={fps} width={1024} height={1024} defaultProps={{ preview: true }} />
  </>
)
