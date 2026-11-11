// MLS schedule constants — centralised so components don't embed dates inline.

import type { PlayoffRound } from './rounds'

/** Season fetched for the full-year schedule; `pnpm check:data` flags when ESPN moves on. */
export const SEASON_YEAR = 2026

/** Date the 2026 World Cup break was publicly announced. */
export const WC_ANNOUNCED = new Date('2026-05-18')

/** Date MLS resumes after the 2026 World Cup break. */
export const WC_RESUME = new Date('2026-07-22')

/**
 * 2026 MLS Cup Playoffs. From `PLAYOFFS_TAB_FROM` (the day after Decision
 * Day) until `NEXT_SEASON_FIRST_WEEK`, the "Next" week tab becomes the
 * bracket — it stays up through the off-season as the season's record.
 */
export const PLAYOFFS_TAB_FROM = '2026-11-08'
export const PLAYOFFS_START = '2026-11-19'
/** Season the bracket belongs to — kept apart from `SEASON_YEAR` so the
 *  bracket still shows 2026 after `SEASON_YEAR` moves on. */
export const PLAYOFFS_SEASON = Number(PLAYOFFS_START.slice(0, 4))

/**
 * Mondays of the last two regular-season weeks. From `PLAYOFFS_TAB_FROM`
 * until `NEXT_SEASON_FIRST_WEEK` the "Last" / "This" week tabs show these instead of
 * the (mostly empty) calendar weeks. Both are frozen in
 * server/assets/scoreboard/ via `pnpm archive:week`.
 */
export const FINAL_WEEKS = {
  last: '2026-10-26',
  this: '2026-11-02',
} as const
export const MLS_CUP_DATE = '2026-12-18'

/** First day of each round's window (YYYY-MM-DD). */
export const PLAYOFF_ROUND_START: Record<PlayoffRound, string> = {
  'wild-card': '2026-11-19',
  'round-one': '2026-11-20',
  semifinals: '2026-12-05',
  final: '2026-12-11',
  'mls-cup': MLS_CUP_DATE,
}

/** Round windows as published on mlssoccer.com's bracket (column headers). */
export const PLAYOFF_ROUND_DATES: Record<PlayoffRound, string> = {
  'wild-card': 'Nov 19',
  'round-one': 'Nov 20 – Dec 2',
  semifinals: 'Dec 5 – 6',
  final: 'Dec 11 – 12',
  'mls-cup': 'Dec 18',
}

/**
 * 2026–27 off-season. The playoffs run Nov 19 – Dec 18 (MLS Cup, Fri Dec 18),
 * so the break starts the Monday after MLS Cup week. `pnpm check:data` flags
 * when ESPN schedules MLS games inside this window or past `OFFSEASON_START`.
 */
export const OFFSEASON_START = '2026-12-21'
/** Last MLS week before the break (Monday) — the week of MLS Cup. */
export const LAST_GAME_WEEK = '2026-12-14'
/** 2027 opener. Only announced as "February" so far; confirm once MLS publishes the 2027 schedule. */
export const NEXT_SEASON_START = '2027-02-27'
/** Flip once MLS publishes the 2027 schedule — until then copy says "February". */
export const NEXT_SEASON_CONFIRMED = false
/** Monday of the week the 2027 season opens. */
export const NEXT_SEASON_FIRST_WEEK = '2027-02-22'
