# CLAUDE.md

This file documents conventions and context for AI-assisted development on this project.

## Project Overview

MLS Fire — a Nuxt 4 (Vue 3) app showing real-time MLS scores, standings, stats, and match details. Deployed on Netlify. Data sourced from ESPN's unofficial public API via Nuxt server routes.

## Tech Stack

- **Framework**: Nuxt 4.6, Vue 3, `<script setup lang="ts">`
- **Styling**: scoped component CSS on top of `app/assets/css/reset.css` (Tailwind's Preflight, kept after Tailwind was removed) and the variables in `main.css`. No Tailwind — don't add utility classes. `oklab()` / `oklch()` color functions used throughout.
- **Package manager**: pnpm
- **Deployment**: Netlify (Nitro preset)

## Key Conventions

### Colors

All colors use `oklab()` or `oklch()` — do not introduce `rgb()`, `hsl()`, or hex colors.

### Component structure

- `<script setup lang="ts">` only — no Options API, no `defineComponent`.
- Props typed with `defineProps<{...}>()`, emits with `defineEmits<{...}>()`.
- No comments unless the _why_ is non-obvious (hidden constraint, workaround, etc.).

### CSS

- All component styles are scoped (`<style scoped>`).
- Responsive breakpoints use `max-width` media queries, consistent thresholds: `425px`, `599px`, `768px`.
- `--modal-copy-size` CSS variable controls font size inside modals.

### Constants

- Shared config (dates, flags) lives in `app/constants/mls.ts`, not hardcoded in components.

### API / data

- All ESPN API calls go through `server/api/` routes — never fetch ESPN directly from the client.
- Composables in `app/composables/` handle data fetching and expose typed reactive state.

## Structure Notes

### Component folders

Modal components live in subfolders; Nuxt auto-imports by path (e.g. `GameDetail/StatsTab.vue` → `GameDetailStatsTab`).

### GameDetail/ folder (`app/components/GameDetail/`)

- `Modal.vue` — orchestrator; computes `homeLeaders`, `awayLeaders`, `homeRoster`, `awayRoster`, `homeLogo`, `awayLogo` and passes as props
- `StatsTab.vue` — match stats
- `LeadersTab.vue` — player leaders
- `LineupsTab.vue` — lineups/rosters
- `H2hTab.vue` — head-to-head history

### TeamDetail/ folder (`app/components/TeamDetail/`)

- `Modal.vue` — orchestrator; all data fetching/composables live here; passes typed props to tabs
- `ScheduleTab.vue` — recent results + next game; owns its own GameBlock grid/deep styles
- `LeadersTab.vue` — season stat leaders
- `LineupsTab.vue` — current roster / fallback last-lineup
- `FixturesTab.vue` — full 2026 season fixtures by month

### Playoffs/ folder (`app/components/Playoffs/`)

- `Bracket.vue` — replaces the "Next" week tab with "MLS Cup Playoffs" from `PLAYOFFS_TAB_FROM` until `NEXT_SEASON_FIRST_WEEK` (`app/constants/mls.ts`). From 1024px wide: mirrored West | MLS Cup | East, with both conference finals under the MLS Cup card. Narrower: one conference at a time (finals back inside the half), scrolling sideways.
- `TieCard.vue` / `CupCard.vue` — one matchup each; clicking opens `GameDetailModal`. Before ESPN schedules a set pairing, the card opens a preview match (`matchup-<homeId>-<awayId>`, `windowLabel` instead of a kickoff) that `server/api/match-detail.ts` answers from `server/utils/matchupPreview.ts`.
- Data: `server/api/playoffs.ts` → `server/utils/playoffBracket.ts` (pure; builds the bracket from ESPN standings seeds plus postseason scoreboard events) → `usePlayoffs()`.

### Season archive (standings + frozen weeks)

- Finished seasons live in `server/assets/standings/<year>.json`; `/api/standings?season=YYYY` serves those instead of ESPN, and only calls ESPN for a season with no file.
- After each Decision Day run `pnpm archive:standings <year>` — the year picker (`StandingsSeasonPicker.vue`) lists every archived season plus `SEASON_YEAR`.
- Past seasons render without team links: the team modal shows the current squad, not that season's.
- Finished match weeks can be frozen the same way: `pnpm archive:week <monday>` (needs `pnpm dev` running) writes `server/assets/scoreboard/<from>-<to>.json`, which `/api/scores` serves for that range. Between `PLAYOFFS_TAB_FROM` and `OFFSEASON_START` the Last/This tabs pin to `FINAL_WEEKS` (`app/constants/mls.ts`) and read "Final Stretch" / "Decision Day" — update both each season.

### Season changeover checklist

- **After Decision Day:** `pnpm archive:standings <year>`, `pnpm archive:week <monday>` for the last two weeks, update `FINAL_WEEKS`.
- **Through the off-season** (until `NEXT_SEASON_FIRST_WEEK`) the Final Stretch / Decision Day / Playoffs tabs stay up; the bracket shows a champion banner once MLS Cup is final. The bracket reads `PLAYOFFS_SEASON` (from `PLAYOFFS_START`), not `SEASON_YEAR`.
- **When MLS publishes the new schedule:** set `NEXT_SEASON_START`, `NEXT_SEASON_FIRST_WEEK`, `NEXT_SEASON_CONFIRMED = true`.
- **Opening week:** bump `SEASON_YEAR` (standings, stats, leaders, team fixtures follow it), then set the new season's playoff dates and `OFFSEASON_START` / `LAST_GAME_WEEK`. `pnpm check:data` flags when ESPN has moved on.

### Team metadata

- `TEAM_LOGO` — team logo URLs (in `useTeamTheme.ts`)
- `TEAM_SHORT_NAME` — 3–4 char abbreviations used inside modals (in `GameDetail/Modal.vue`)
- `useTeamTheme.ts` has its own `TEAM_SHORT_NAME` for the TeamDetail modal — intentionally separate (different display lengths).

## Commands

```bash
pnpm dev        # dev server at localhost:3000
pnpm build      # production build
pnpm preview    # preview production build
```
