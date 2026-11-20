/**
 * Player-facing words. English is the only required language; unknown `lang` values
 * fall back to English. Social-casino sessions swap money wording for coin wording
 * following Stake's restricted-phrase list (bet→play, buy→get, win→prize/won, pay→award,
 * cash/money→coins, cost→price).
 */
let social = false

export function setSocial(v: boolean): void {
  social = v
  document.body.dataset.social = v ? "1" : "0"
}
export const isSocial = (): boolean => social

const SOCIAL_SWAPS: [RegExp, string][] = [
  [/\bbonus buys?\b/gi, "bonus features"],
  [/\bbuy feature\b/gi, "get feature"],
  [/\bbuys\b/gi, "gets"],
  [/\bbought\b/gi, "instantly triggered"],
  [/\bbuy\b/gi, "get"],
  [/\bpurchase\b/gi, "play"],
  [/\btotal bet\b/gi, "total play"],
  [/\bbets\b/gi, "plays"],
  [/\bbetting\b/gi, "playing"],
  [/\bbet\b/gi, "play"],
  [/\bwager\b/gi, "play"],
  [/\bpays out\b/gi, "awards"],
  [/\bpaid out\b/gi, "awarded"],
  [/\bpayouts?\b/gi, "awards"],
  [/\bpays\b/gi, "awards"],
  [/\bpaid\b/gi, "awarded"],
  [/\bpay\b/gi, "award"],
  [/\bcash\b/gi, "coins"],
  [/\bmoney\b/gi, "coins"],
  [/\bcost of\b/gi, "price of"],
  [/\bcosts\b/gi, "is priced at"],
  [/\bcost\b/gi, "price"],
  [/\bwinnings\b/gi, "prizes"],
  [/\bwins\b/gi, "prizes"],
  [/\bwin\b/gi, "prize"],
  [/\bgamble\b/gi, "play"],
  [/\bcurrency\b/gi, "token"],
  [/\bdeposit\b/gi, "get coins"],
  [/\bwithdraw\b/gi, "redeem"],
  [/\bcredit\b/gi, "balance"],
]

function matchCase(src: string, rep: string): string {
  if (src === src.toUpperCase()) return rep.toUpperCase()
  if (src[0] === src[0]!.toUpperCase()) return rep[0]!.toUpperCase() + rep.slice(1)
  return rep
}

/** Translate player-facing copy for the current session (identity outside social mode). */
export function t(text: string): string {
  if (!social) return text
  let out = text
  for (const [re, rep] of SOCIAL_SWAPS) out = out.replace(re, (m) => matchCase(m, rep))
  return out
}

/** Apply t() to every text node under `root` (no-op outside social mode). */
export function translateTree(root: Node): void {
  if (!social) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const v = n.nodeValue ?? ""
    const out = t(v)
    if (out !== v) n.nodeValue = out
  }
}
