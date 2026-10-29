// MLS schedule constants — centralised so components don't embed dates inline.

/** Season fetched for the full-year schedule; `pnpm check:data` flags when ESPN moves on. */
export const SEASON_YEAR = 2026

/** Date the 2026 World Cup break was publicly announced. */
export const WC_ANNOUNCED = new Date('2026-05-18')

/** Date MLS resumes after the 2026 World Cup break. */
export const WC_RESUME = new Date('2026-07-22')

/**
 * 2026–27 off-season. The playoffs run Nov 18 – Dec 18 (MLS Cup, Fri Dec 18),
 * so the break starts the Monday after MLS Cup week. `pnpm check:data` flags
 * when ESPN schedules MLS games inside this window or past `OFFSEASON_START`.
 */
export const OFFSEASON_START = '2026-12-21'
/** Last MLS week before the break (Monday) — the week of MLS Cup. */
export const LAST_GAME_WEEK = '2026-12-14'
/** 2027 opener. Only announced as "February" so far; confirm once MLS publishes the 2027 schedule. */
export const NEXT_SEASON_START = '2027-02-27'
/** Monday of the week the 2027 season opens. */
export const NEXT_SEASON_FIRST_WEEK = '2027-02-22'
