import { TEAM_ESPN_ID, TEAM_LIST } from '../../app/composables/useTeamTheme'
import { type Check, errorMessage, getJson } from './espn'

/** Smoke-tests the deployed API routes against what ESPN currently returns. */
export function siteCheck(siteUrl: string): Check {
  const probeTeam = TEAM_LIST[0] ?? 'Atlanta United FC'
  const probeId = TEAM_ESPN_ID[probeTeam] ?? ''

  return {
    category: 'site',
    name: `live API routes on ${siteUrl}`,
    async run(ctx, add) {
      const fail = (key: string, title: string, detail: string, fix: string) =>
        add({ key, severity: 'error', category: 'site', title, detail, fix })

      try {
        const scores = await getJson<{ events?: unknown[]; _error?: boolean }>(
          `${siteUrl}/api/scores?week=this`
        )
        if (!Array.isArray(scores.events) || scores._error) {
          fail(
            'site-scores',
            'Live /api/scores is reporting an ESPN failure',
            `events=${Array.isArray(scores.events) ? scores.events.length : 'missing'}, _error=${scores._error ?? false}.`,
            'Check server/api/scores.ts and the Netlify Function logs.'
          )
        }
      } catch (err) {
        fail(
          'site-scores',
          'Live /api/scores request failed',
          errorMessage(err),
          'Check the Netlify deploy and Function logs.'
        )
      }

      try {
        const espnCount = (await ctx.seasonEvents()).filter((e) =>
          e.competitions[0]?.competitors.some((c) => c.team.id === probeId)
        ).length
        const schedule = await getJson<{ events?: unknown[] }>(
          `${siteUrl}/api/schedule?teamId=${probeId}`
        )
        const siteCount = schedule.events?.length ?? 0
        if (siteCount < espnCount) {
          fail(
            'site-schedule',
            `Live /api/schedule returned ${siteCount} matches for ${probeTeam}; ESPN has ${espnCount}`,
            'The team modal schedule, fixtures tab and "games played" counter will be wrong for every club.',
            'Check fetchSeasonBlob in server/utils/seasonRecords.ts against the current ESPN scoreboard URL format.'
          )
        }
      } catch (err) {
        fail(
          'site-schedule',
          `Live /api/schedule failed for ${probeTeam}`,
          errorMessage(err),
          'Check fetchSeasonBlob in server/utils/seasonRecords.ts and the Netlify Function logs.'
        )
      }

      try {
        const espnRoster = await ctx.rosterSize(probeId)
        const detail = await getJson<{ roster?: unknown[] }>(
          `${siteUrl}/api/team-detail?teamId=${probeId}`
        )
        if (espnRoster > 0 && !detail.roster?.length) {
          fail(
            'site-roster',
            `Live /api/team-detail returned an empty roster for ${probeTeam}`,
            `ESPN lists ${espnRoster} players. The Lineups tab will be empty for every club.`,
            'Check the roster parsing in server/api/team-detail.ts.'
          )
        }
      } catch (err) {
        fail(
          'site-roster',
          `Live /api/team-detail failed for ${probeTeam}`,
          errorMessage(err),
          'Check server/api/team-detail.ts and the Netlify Function logs.'
        )
      }

      try {
        await getJson(`${siteUrl}/api/standings`)
      } catch (err) {
        fail(
          'site-standings',
          'Live /api/standings request failed',
          errorMessage(err),
          'Check server/api/standings.ts and the Netlify Function logs.'
        )
      }
    },
  }
}
