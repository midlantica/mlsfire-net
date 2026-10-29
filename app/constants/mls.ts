// MLS schedule constants — centralised so components don't embed dates inline.

/** Season fetched for the full-year schedule; `pnpm check:data` flags when ESPN moves on. */
export const SEASON_YEAR = 2026

/** Date the 2026 World Cup break was publicly announced. */
export const WC_ANNOUNCED = new Date('2026-05-18')

/** Date MLS resumes after the 2026 World Cup break. */
export const WC_RESUME = new Date('2026-07-22')
