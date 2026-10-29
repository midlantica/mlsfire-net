import { TEAM_COLOR_PAIRS } from '../../app/composables/useTeamColors'
import {
  TEAM_ABBREV,
  TEAM_CONFERENCE,
  TEAM_ESPN_ID,
  TEAM_LIST,
  TEAM_LOGO,
  TEAM_SHORT_NAME,
  TEAM_VENUE,
} from '../../app/composables/useTeamTheme'
import { getStadiumByTeam } from '../../app/constants/venues'
import { type Check, type EspnTeamRef, ESPN, getJson, slug } from './espn'

const namesById = new Map<string, string[]>()
for (const [name, id] of Object.entries(TEAM_ESPN_ID)) {
  namesById.set(id, [...(namesById.get(id) ?? []), name])
}

/** Our canonical team name for an ESPN team id (handles casing aliases). */
export function ourTeamName(espnId: string): string | null {
  const names = namesById.get(espnId)
  if (!names) return null
  return names.find((n) => TEAM_LIST.includes(n)) ?? names[0] ?? null
}

export const checkStaticTeamMaps: Check = {
  category: 'teams',
  name: 'team metadata maps are complete',
  async run(_ctx, add) {
    const maps: Record<string, Record<string, unknown>> = {
      TEAM_LOGO,
      TEAM_CONFERENCE,
      TEAM_ABBREV,
      TEAM_SHORT_NAME,
      TEAM_ESPN_ID,
      TEAM_VENUE,
      TEAM_COLOR_PAIRS,
    }
    for (const team of TEAM_LIST) {
      for (const [mapName, map] of Object.entries(maps)) {
        if (map[team]) continue
        add({
          key: `missing-map:${slug(mapName)}:${slug(team)}`,
          severity: 'error',
          category: 'teams',
          title: `${team} is missing from ${mapName}`,
          detail: `Every club in TEAM_LIST needs a ${mapName} entry; without it parts of the UI fall back to blanks.`,
          fix: `Add "${team}" to ${mapName} (app/composables/useTeam*.ts).`,
        })
      }
      if (!getStadiumByTeam(team)) {
        add({
          key: `missing-stadium:${slug(team)}`,
          severity: 'error',
          category: 'teams',
          title: `${team} has no entry in MLS_STADIUMS`,
          detail: 'The stadium popup cannot open for this club.',
          fix: `Add a stadium entry with team: '${team}' to app/constants/venues.ts.`,
        })
      }
    }
  },
}

export const checkEspnTeamIdentity: Check = {
  category: 'teams',
  name: 'ESPN team IDs and names match TEAM_ESPN_ID',
  async run(ctx, add) {
    const espnTeams = await ctx.teams()
    const espnIds = new Set(espnTeams.map((t) => t.id))

    for (const t of espnTeams) {
      const names = namesById.get(t.id)
      if (!names) {
        add({
          key: `team-new:${t.id}`,
          severity: 'error',
          category: 'teams',
          title: `New MLS club on ESPN: ${t.displayName} (id ${t.id})`,
          detail:
            'ESPN lists a club the app does not know about (expansion team or ID change). It will render without logo, colors, conference or venue.',
          fix: `Add "${t.displayName}" to TEAM_ESPN_ID, TEAM_LOGO, TEAM_CONFERENCE, TEAM_ABBREV, TEAM_SHORT_NAME, TEAM_VENUE, TEAM_COLOR_PAIRS and MLS_STADIUMS.`,
        })
      } else if (!names.includes(t.displayName)) {
        add({
          key: `team-renamed:${t.id}:${slug(t.displayName)}`,
          severity: 'warn',
          category: 'teams',
          title: `ESPN renamed "${names[0]}" to "${t.displayName}"`,
          detail:
            'Team maps are keyed by ESPN displayName, so lookups for this club will miss until the name is updated.',
          fix: `Rename the key everywhere (or add "${t.displayName}" to TEAM_NAME_MAP in app/composables/useScores.ts).`,
        })
      }
    }

    for (const [id, names] of namesById) {
      if (espnIds.has(id)) continue
      add({
        key: `team-gone:${id}`,
        severity: 'error',
        category: 'teams',
        title: `ESPN no longer lists ${names[0]} (id ${id})`,
        detail:
          'Schedule, roster and leaders requests for this club will fail or come back empty.',
        fix: `Look up the club's current ESPN id and update TEAM_ESPN_ID in app/composables/useTeamTheme.ts.`,
      })
    }
  },
}

export const checkConferences: Check = {
  category: 'teams',
  name: 'conferences match ESPN standings',
  async run(_ctx, add) {
    const data = await getJson<{
      children?: Array<{
        name: string
        standings: { entries: Array<{ team: EspnTeamRef }> }
      }>
    }>(`${ESPN}/v2/sports/soccer/usa.1/standings`)
    for (const conf of data.children ?? []) {
      for (const { team } of conf.standings.entries) {
        const name = ourTeamName(team.id)
        if (!name || TEAM_CONFERENCE[name] === conf.name) continue
        add({
          key: `conference:${slug(name)}:${slug(conf.name)}`,
          severity: 'warn',
          category: 'teams',
          title: `${name} is in the ${conf.name} on ESPN`,
          detail: `TEAM_CONFERENCE says "${TEAM_CONFERENCE[name] ?? 'nothing'}".`,
          fix: `Update TEAM_CONFERENCE["${name}"] in app/composables/useTeamTheme.ts.`,
        })
      }
    }
  },
}
