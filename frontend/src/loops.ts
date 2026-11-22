/**
 * Pre-rendered idle loops (video/, Remotion) layered over the live CSS animation.
 *
 * Each loop is attached as a muted, looping <video>. The host only switches to
 * "video mode" (hiding the live rig) once the video is actually playing, so any
 * failure — autoplay blocked, decode error, missing codec — leaves the live
 * animation in place. Transparent loops are VP9-with-alpha WebM, which Safari
 * cannot render with transparency, so Safari keeps the live versions. Players
 * who ask the OS for reduced motion get the still/live fallback as well.
 */
import heroLoop from "./assets/video/hero_idle.webm?url"
import levLoop from "./assets/video/lev_idle.webm?url"
import logoLoop from "./assets/video/logo.webm?url"
import bgLoopWebm from "./assets/video/bg.webm?url"
import bgLoopMp4 from "./assets/video/bg.mp4?url"
import wheelHubLoop from "./assets/video/wheel_hub.webm?url"
import logoRevealClip from "./assets/video/logo_reveal.webm?url"
import titleHuntClip from "./assets/video/title_hunt.webm?url"
import wheelGlowLoop from "./assets/video/wheel_glow.webm?url"

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

/** True where VP9 alpha in WebM is decoded with transparency (Chromium, Firefox). */
function alphaWebmSupported(): boolean {
  const ua = navigator.userAgent
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios|edg|android|fxios|firefox/i.test(ua)
  if (isSafari) return false
  return document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== ""
}

function makeVideo(className: string, sources: [string, string][]): HTMLVideoElement {
  const v = document.createElement("video")
  v.className = className
  v.muted = true
  v.defaultMuted = true
  v.loop = true
  v.autoplay = true
  v.playsInline = true
  v.preload = "auto"
  v.setAttribute("aria-hidden", "true")
  v.disablePictureInPicture = true
  for (const [src, type] of sources) {
    const s = document.createElement("source")
    s.src = src
    s.type = type
    v.append(s)
  }
  return v
}

/** Attach a loop inside `host`; `flagEl` gets `flagClass` once frames are playing. */
function attach(host: Element | null, flagEl: Element | null, flagClass: string, video: HTMLVideoElement) {
  if (!host || !flagEl) return
  host.append(video)
  video.addEventListener("playing", () => flagEl.classList.add(flagClass), { once: true })
  video.addEventListener("error", () => { flagEl.classList.remove(flagClass); video.remove() }, true)
  void video.play().catch(() => { /* autoplay refused: live animation stays */ })
}

export function startLoops(): void {
  if (reducedMotion()) return
  if (alphaWebmSupported()) {
    attach(document.querySelector(".hero-pose.idle"), document.querySelector(".hero"), "video-on",
      makeVideo("loop-video", [[heroLoop, "video/webm"]]))
    attach(document.querySelector(".lev-rig"), document.querySelector(".leviathan"), "video-on",
      makeVideo("loop-video", [[levLoop, "video/webm"]]))
    attach(document.querySelector(".logo"), document.querySelector(".logo"), "video-on",
      makeVideo("loop-video logo-video", [[logoLoop, "video/webm"]]))
  }
  // The background has no alpha, so Safari gets the MP4.
  attach(document.querySelector(".background-scene"), document.body, "bgvideo-on",
    makeVideo("bg-video", [[bgLoopWebm, "video/webm"], [bgLoopMp4, "video/mp4"]]))
}

/** Freeze the Leviathan loop when it is slain (the slain pose is applied in CSS). */
export function setLeviathanLoopPaused(paused: boolean): void {
  const v = document.querySelector<HTMLVideoElement>(".leviathan video")
  if (!v) return
  if (paused) v.pause()
  else void v.play().catch(() => {})
}

/**
 * Depth Wheel loops (video/: WheelHubIdle, WheelGlowLoop), both transparent. The painted
 * hub and glow stay until each video is playing; Safari and reduced motion keep them.
 */
export function attachWheelLoops(wheel: HTMLElement): void {
  if (reducedMotion() || !alphaWebmSupported()) return
  const hub = document.createElement("div")
  hub.className = "wheel-hub-video"
  wheel.append(hub)
  attach(hub, wheel, "hub-video-on", makeVideo("loop-video", [[wheelHubLoop, "video/webm"]]))
  const glow = document.createElement("div")
  glow.className = "wheel-glow-video"
  wheel.prepend(glow)
  attach(glow, wheel, "glow-video-on", makeVideo("loop-video", [[wheelGlowLoop, "video/webm"]]))
}

/** URLs of the one-shot clips, so the loader can fetch them into the cache. */
export const ONE_SHOT_CLIPS = [logoRevealClip, titleHuntClip]

/**
 * A one-shot transparent clip (Remotion, 60 fps): prepared paused inside `host`; play() starts it
 * and resolves true once frames are playing (the host gets `video-on`), false if it cannot play
 * in time (Safari, reduced motion, slow load) -- the caller then keeps its CSS animation.
 * The clip holds its last frame when it ends.
 */
function oneShot(host: HTMLElement, src: string, cls: string): { play: (waitMs: number) => Promise<boolean> } {
  if (reducedMotion() || !alphaWebmSupported()) return { play: async () => false }
  const v = document.createElement("video")
  v.className = `oneshot-video ${cls}`
  v.muted = true
  v.defaultMuted = true
  v.playsInline = true
  v.preload = "auto"
  v.setAttribute("aria-hidden", "true")
  v.src = src
  host.append(v)
  return {
    play: (waitMs) => new Promise<boolean>((resolve) => {
      let done = false
      const finish = (ok: boolean) => {
        if (done) return
        done = true
        if (ok) host.classList.add("video-on")
        else v.remove()
        resolve(ok)
      }
      v.addEventListener("playing", () => finish(true), { once: true })
      v.addEventListener("error", () => finish(false), { once: true })
      setTimeout(() => finish(false), waitMs)
      void v.play().catch(() => finish(false))
    }),
  }
}

/** The ink-brush logo reveal on the intro screen. */
export const logoReveal = (host: HTMLElement) => oneShot(host, logoRevealClip, "logo-reveal")
/** "THE HUNT BEGINS" title slam in the showdown. */
export const titleHunt = (host: HTMLElement) => oneShot(host, titleHuntClip, "title-hunt")
