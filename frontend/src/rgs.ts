/**
 * Round providers.
 *  - RGS provider: stake-engine RGSClient when the launch URL has sessionID + rgs_url.
 *    Amounts are API units (x1,000,000); bet levels come from authenticate.
 *  - Demo provider: otherwise. Samples public/demo/<mode>.json (a weighted sample exported
 *    from the published books), 100,000 FUN balance, 0.1–100 ladder, win settled on end-round.
 *  - Replay: GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}, no session.
 */
import { RGSClient, DisplayAmount, type Balance, type JurisdictionFlags, type Round } from "stake-engine"

export const API = 1_000_000

export type BookEvent = { index: number; type: string; [k: string]: unknown }

export interface PlayedRound {
  events: BookEvent[]
  /** Final payout as a multiple of the base bet. */
  payoutMultiplier: number
  active: boolean
  mode: string
}

export interface AuthResult {
  balance: Balance
  betLevels: number[]
  defaultBet: number
  jurisdiction: Partial<JurisdictionFlags>
  activeRound: PlayedRound | null
}

export interface Provider {
  kind: "rgs" | "demo"
  authenticate(): Promise<AuthResult>
  play(amount: number, mode: string): Promise<{ balance: Balance; round: PlayedRound }>
  endRound(): Promise<{ balance: Balance }>
}

const qs = () => new URLSearchParams(location.search)

/** The local gaming server is plain HTTP; Stake's RGS is HTTPS. */
const protocol = (host: string): "http" | "https" =>
  /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host) ? "http" : "https"

function toRound(r: Round): PlayedRound {
  return {
    events: (Array.isArray(r.state) ? r.state : []) as BookEvent[],
    payoutMultiplier: r.payoutMultiplier ?? 0,
    active: r.active,
    mode: r.mode,
  }
}

class RgsProvider implements Provider {
  readonly kind = "rgs" as const
  private client: ReturnType<typeof RGSClient>
  constructor() {
    const url = new URL(location.href)
    if (url.searchParams.get("device") === "tablet") url.searchParams.set("device", "mobile")
    this.client = RGSClient({ url: url.toString(), protocol: protocol(url.searchParams.get("rgs_url") ?? ""), enforceBetLevels: true })
  }
  async authenticate(): Promise<AuthResult> {
    const r = await this.client.Authenticate()
    return {
      balance: r.balance,
      betLevels: r.config.betLevels,
      defaultBet: r.config.defaultBetLevel,
      jurisdiction: r.jurisdictionFlags ?? {},
      activeRound: r.round && r.round.active ? toRound(r.round) : null,
    }
  }
  async play(amount: number, mode: string) {
    const r = await this.client.Play({ amount, mode })
    return { balance: r.balance, round: toRound(r.round) }
  }
  endRound() {
    return this.client.EndRound()
  }
}

export const MODE_COST: Record<string, number> = {
  base: 1, hunt: 5, deep_hunt: 50, bonus: 150, super: 400, ultra: 1000, mystery: 500, mystery_deep: 650,
}

type DemoBook = { id: number; weight: number; payoutMultiplier: number; events: BookEvent[] }

class DemoProvider implements Provider {
  readonly kind = "demo" as const
  // QA helper (demo only): ?demoBalance=<amount> starts the demo wallet there
  private balance = (Number(qs().get("demoBalance")) || 100_000) * API
  private pending = 0
  private cache = new Map<string, DemoBook[]>()

  async authenticate(): Promise<AuthResult> {
    const levels = [0.1, 0.2, 0.4, 0.6, 0.8, 1, 2, 4, 5, 8, 10, 20, 50, 100].map((x) => Math.round(x * API))
    return {
      balance: { amount: this.balance, currency: "FUN" as Balance["currency"] },
      betLevels: levels,
      defaultBet: API,
      jurisdiction: {},
      activeRound: null,
    }
  }

  async books(mode: string): Promise<DemoBook[]> {
    if (!this.cache.has(mode)) {
      const res = await fetch(`./demo/${mode}.json`)
      if (!res.ok) throw new Error(`demo books for ${mode} missing`)
      this.cache.set(mode, (await res.json()) as DemoBook[])
    }
    return this.cache.get(mode)!
  }

  async play(amount: number, mode: string) {
    const cost = MODE_COST[mode] ?? 1
    if (this.balance < amount * cost) throw new Error("ERR_IPB")
    const books = await this.books(mode)
    const total = books.reduce((s, b) => s + b.weight, 0)
    let r = Math.random() * total
    let book = books.find((b) => b.weight > 0) ?? books[0]!
    for (const b of books) {
      if (b.weight <= 0) continue
      r -= b.weight
      if (r <= 0) { book = b; break }
    }
    // QA helper (demo only): ?demoBook=<id> plays that book of the mode every spin.
    const forced = Number(qs().get("demoBook"))
    if (qs().has("demoBook")) book = books.find((b) => b.id === forced) ?? book
    const mult = book.payoutMultiplier / 100
    this.balance -= amount * cost
    this.pending = Math.round(amount * mult)
    return {
      balance: { amount: this.balance, currency: "FUN" as Balance["currency"] },
      round: { events: book.events, payoutMultiplier: mult, active: mult > 0, mode },
    }
  }

  async endRound() {
    this.balance += this.pending
    this.pending = 0
    return { balance: { amount: this.balance, currency: "FUN" as Balance["currency"] } }
  }
}

export function createProvider(): Provider {
  const p = qs()
  return p.get("sessionID") && p.get("rgs_url") ? new RgsProvider() : new DemoProvider()
}

export const isReplay = () => qs().get("replay") === "true"

export interface ReplayRound extends PlayedRound {
  amount: number
  currency: string
}

export class ReplayNotFound extends Error {}

/** Replay mode: a single public GET. No authenticate / balance / play / event calls. */
export async function fetchReplay(): Promise<ReplayRound> {
  const p = qs()
  const host = p.get("rgs_url")
  const mode = p.get("mode") ?? "base"
  const amount = Number(p.get("amount")) || API
  const currency = p.get("currency") ?? "USD"
  if (!host) {
    // Local testing without an RGS: replay a demo book.
    const books = await new DemoProvider().books(mode)
    const wanted = Number(p.get("event"))
    const b = books.find((x) => x.id === wanted) ?? books.find((x) => x.payoutMultiplier > 0) ?? books[0]!
    return { events: b.events, payoutMultiplier: b.payoutMultiplier / 100, active: false, mode, amount, currency }
  }
  const parts = ["game", "version", "mode", "event"].map((k) => encodeURIComponent(p.get(k) ?? ""))
  const res = await fetch(`${protocol(host)}://${host}/bet/replay/${parts.join("/")}`)
  if (res.status === 404) throw new ReplayNotFound("not found")
  if (!res.ok) throw new Error(`replay ${res.status}`)
  const data = (await res.json()) as { payoutMultiplier: number; costMultiplier: number; state: unknown }
  return {
    events: (Array.isArray(data.state) ? data.state : []) as BookEvent[],
    payoutMultiplier: data.payoutMultiplier,
    active: false,
    mode,
    amount,
    currency,
  }
}

/** Money formatting: FUN in demo, otherwise the currency rules of stake-engine. */
export function money(amountApi: number, currency: string): string {
  if (currency === "FUN") {
    return `${(amountApi / API).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FUN`
  }
  try {
    return DisplayAmount({ amount: Math.round(amountApi), currency: currency as Balance["currency"] })
  } catch {
    return `${(amountApi / API).toFixed(2)} ${currency}`
  }
}
