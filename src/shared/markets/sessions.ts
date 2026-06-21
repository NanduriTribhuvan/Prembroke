/**
 * Forex trading-session utilities (Sydney, Tokyo, London, New York).
 *
 * Session windows use fixed UTC hours and approximate "winter" (standard-time)
 * boundaries. Daylight-saving shifts are NOT modelled, and weekends are treated
 * as regular days (the FX weekend close is not applied). Suitable for clocks and
 * "next event" countdowns, not for exact exchange-holiday scheduling.
 *
 * @module markets/sessions
 */

/** Identifier for a forex session. */
export type SessionId = 'sydney' | 'tokyo' | 'london' | 'newyork'

/** A session window expressed in UTC hours. `open`/`close` are hours `[0,24)`. */
export interface SessionWindow {
  id: SessionId
  label: string
  /** UTC hour the session opens. */
  open: number
  /** UTC hour the session closes. A value <= `open` means the window wraps past midnight. */
  close: number
}

/** Fixed UTC session windows (DST approximated). */
export const SESSIONS: readonly SessionWindow[] = [
  { id: 'sydney', label: 'Sydney', open: 21, close: 6 },
  { id: 'tokyo', label: 'Tokyo', open: 0, close: 9 },
  { id: 'london', label: 'London', open: 8, close: 17 },
  { id: 'newyork', label: 'New York', open: 13, close: 22 }
]

/** Result describing the next session open/close event. */
export interface NextSessionEvent {
  session: SessionId
  type: 'open' | 'close'
  minutesUntil: number
}

function minutesOfDayUTC(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
}

/**
 * Whether a given session is open at `date`.
 *
 * @param session Session id.
 * @param date Reference time.
 * @returns `true` when the session window contains `date` (UTC), else `false`.
 *          Returns `false` for unknown session ids.
 */
export function isSessionOpen(session: SessionId, date: Date): boolean {
  const w = SESSIONS.find((s) => s.id === session)
  if (!w) return false
  const m = minutesOfDayUTC(date)
  const open = w.open * 60
  const close = w.close * 60
  if (open < close) return m >= open && m < close
  // Wraps past midnight (e.g. Sydney 21:00 -> 06:00).
  return m >= open || m < close
}

/**
 * All sessions currently open at `date`.
 *
 * @param date Reference time.
 * @returns Array of open {@link SessionId}s (possibly empty).
 */
export function activeSessions(date: Date): SessionId[] {
  return SESSIONS.filter((s) => isSessionOpen(s.id, date)).map((s) => s.id)
}

/**
 * The soonest upcoming session open or close after `date`.
 *
 * @param date Reference time.
 * @returns The nearest {@link NextSessionEvent}, or `null` if none can be computed.
 */
export function nextSessionEvent(date: Date): NextSessionEvent | null {
  const now = date.getTime()
  let best: NextSessionEvent | null = null
  for (const s of SESSIONS) {
    for (const dayOffset of [-1, 0, 1]) {
      for (const type of ['open', 'close'] as const) {
        const hour = type === 'open' ? s.open : s.close
        const d = new Date(date)
        d.setUTCHours(hour, 0, 0, 0)
        d.setUTCDate(d.getUTCDate() + dayOffset)
        const diff = d.getTime() - now
        if (diff > 0) {
          const minutesUntil = diff / 60000
          if (best === null || minutesUntil < best.minutesUntil) {
            best = { session: s.id, type, minutesUntil }
          }
        }
      }
    }
  }
  return best
}

/**
 * Pairs of sessions whose windows overlap at `date` (e.g. London/New York).
 *
 * @param date Reference time.
 * @returns Array of `[SessionId, SessionId]` pairs currently both open.
 */
export function sessionOverlaps(date: Date): [SessionId, SessionId][] {
  const open = activeSessions(date)
  const pairs: [SessionId, SessionId][] = []
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      pairs.push([open[i], open[j]])
    }
  }
  return pairs
}
