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
