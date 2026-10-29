import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  TEAM_ESPN_ID,
  TEAM_LIST,
  TEAM_LOGO,
} from '../../app/composables/useTeamTheme'
import { SEASON_YEAR } from '../../app/constants/mls'
import { MLS_STADIUMS } from '../../app/constants/venues'
import { type Check, ESPN, errorMessage, getJson, slug } from './espn'

const MIN_ROSTER_SIZE = 15

export const checkSeason: Check = {
  category: 'season',
  name: 'app season matches ESPN',
  async run(ctx, add) {
    const data = await getJson<{
      leagues?: Array<{ season?: { year?: number } }>
    }>(`${ESPN}/site/v2/sports/soccer/usa.1/scoreboard`)
    const year = data.leagues?.[0]?.season?.year
    if (year && year !== SEASON_YEAR) {
      add({
        key: `season-year:${year}`,
        severity: 'warn',
        category: 'season',
        title: `ESPN has moved to the ${year} season (app is on ${SEASON_YEAR})`,
        detail:
          'Full-season schedules, fixtures and leaders are still built from the old season.',
        fix: `Update SEASON_YEAR in app/constants/mls.ts and search the repo for hardcoded "${SEASON_YEAR}" (leaders URL, fixtures labels).`,
      })
    }
    if (!(await ctx.seasonEvents()).length) {
      add({
        key: `season-empty:${SEASON_YEAR}`,
        severity: 'error',
        category: 'season',
        title: `ESPN returned no ${SEASON_YEAR} MLS matches`,
        detail:
          'The month-by-month scoreboard fetch came back empty; schedules will be blank.',
        fix: 'Check the ESPN scoreboard URL format used in server/utils/seasonRecords.ts.',
      })
    }
  },
}

export const checkRosters: Check = {
  category: 'rosters',
  name: 'ESPN rosters are populated',
  async run(ctx, add) {
    await Promise.all(
      TEAM_LIST.map(async (team) => {
        const id = TEAM_ESPN_ID[team]
        if (!id) return
        try {
          const size = await ctx.rosterSize(id)
          if (size >= MIN_ROSTER_SIZE) return
          add({
            key: `roster-small:${slug(team)}`,
            severity: 'warn',
            category: 'rosters',
            title: `${team} roster has only ${size} players on ESPN`,
            detail:
              'Either ESPN changed the roster response or the club id is wrong; the Lineups tab will be thin or empty.',
            fix: 'Check the roster parsing in server/api/team-detail.ts and the id in TEAM_ESPN_ID.',
          })
        } catch (err) {
          add({
            key: `roster-unavailable:${slug(team)}`,
            severity: 'warn',
            category: 'rosters',
            title: `${team} roster could not be fetched from ESPN`,
            detail: errorMessage(err),
            fix: `Verify TEAM_ESPN_ID["${team}"] (${id}) is still valid.`,
          })
        }
      })
    )
  },
}

export const checkAssets: Check = {
  category: 'assets',
  name: 'logo and stadium image files exist',
  async run(_ctx, add) {
    const publicDir = join(process.cwd(), 'public')
    const files = [
      ...Object.entries(TEAM_LOGO).map(([owner, path]) => ({ owner, path })),
      ...MLS_STADIUMS.map((s) => ({ owner: s.venue, path: s.image })),
    ]
    for (const { owner, path } of files) {
      if (existsSync(join(publicDir, path))) continue
      add({
        key: `asset-missing:${slug(path)}`,
        severity: 'error',
        category: 'assets',
        title: `Missing image ${path}`,
        detail: `Referenced by ${owner} but not found in public/.`,
        fix: `Add public${path} or fix the path.`,
      })
    }
  },
}
