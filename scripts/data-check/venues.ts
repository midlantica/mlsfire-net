import { TEAM_VENUE } from '../../app/composables/useTeamTheme'
import { getStadiumInfo } from '../../app/constants/venues'
import { type Add, type Check, slug } from './espn'
import { ourTeamName } from './teams'

const RECENT_HOME_MATCHES = 8
const UPCOMING_WINDOW_MS = 30 * 24 * 60 * 60_000

function sameVenueName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim()
  return norm(a) === norm(b)
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return counts
}

const unknownVenueFix = (venue: string) =>
  `Add "${venue}" to MLS_STADIUMS in app/constants/venues.ts (or to VENUE_ALIASES if it is a renamed stadium).`

function checkTeamModalVenue(team: string, recent: string[], add: Add) {
  const modalVenue = TEAM_VENUE[team]
  if (!modalVenue) return
  const modalInfo = getStadiumInfo(modalVenue)
  if (!modalInfo) {
    add({
      key: `team-venue-unresolved:${slug(team)}`,
      severity: 'error',
      category: 'venues',
      title: `${team}'s team-modal stadium "${modalVenue}" has no popup`,
      detail: 'TEAM_VENUE does not match any MLS_STADIUMS entry.',
      fix: 'Make TEAM_VENUE and MLS_STADIUMS agree on the stadium name.',
    })
    return
  }
  if (!recent.some((v) => getStadiumInfo(v)?.venue === modalInfo.venue)) {
    const usage = [...countBy(recent)].map(([v, n]) => `${v} (${n})`).join(', ')
    add({
      key: `team-venue-stale:${slug(team)}:${slug(modalInfo.venue)}`,
      severity: 'warn',
      category: 'venues',
      title: `${team}'s team modal says ${modalInfo.venue}, but its recent home matches were elsewhere`,
      detail: `Last ${recent.length} home matches on ESPN: ${usage}.`,
      fix: 'Update TEAM_VENUE in app/composables/useTeamTheme.ts and list the new home first for this club in MLS_STADIUMS (app/constants/venues.ts).',
    })
    return
  }
  if (`${modalInfo.venue}, ${modalInfo.city}` !== modalVenue) {
    add({
      key: `team-venue-mismatch:${slug(team)}`,
      severity: 'warn',
      category: 'venues',
      title: `${team}: team modal and stadium popup disagree`,
      detail: `TEAM_VENUE says "${modalVenue}" but MLS_STADIUMS says "${modalInfo.venue}, ${modalInfo.city}".`,
      fix: 'Make the two entries match.',
    })
  }
}

export const checkVenues: Check = {
  category: 'venues',
  name: 'home venues match the stadium list and team modal',
  async run(ctx, add) {
    const events = await ctx.seasonEvents()
    const now = Date.now()
    const playedHome = new Map<string, string[]>()

    for (const evt of events) {
      const comp = evt.competitions[0]
      const venue = comp?.venue?.fullName
      const home = comp?.competitors.find((c) => c.homeAway === 'home')
      const team = home && ourTeamName(home.team.id)
      if (!comp || !venue || !team) continue

      if (comp.status.type.completed) {
        playedHome.set(team, [...(playedHome.get(team) ?? []), venue])
        continue
      }
      const soon = new Date(evt.date).getTime() - now < UPCOMING_WINDOW_MS
      if (soon && !getStadiumInfo(venue)) {
        add({
          key: `venue-unknown:${slug(venue)}`,
          severity: 'warn',
          category: 'venues',
          title: `No stadium popup for "${venue}"`,
          detail: `${team} hosts a match there on ${evt.date.slice(0, 10)}; the game modal will show the venue as plain text.`,
          fix: unknownVenueFix(venue),
        })
      }
    }

    for (const [team, venues] of playedHome) {
      const recent = venues.slice(-RECENT_HOME_MATCHES)
      for (const [venue, n] of countBy(recent)) {
        // A single home match elsewhere (e.g. a one-off big-stadium game) is informational only.
        const severity = n >= 2 ? 'warn' : 'info'
        const info = getStadiumInfo(venue)
        if (!info) {
          add({
            key: `venue-unknown:${slug(venue)}`,
            severity,
            category: 'venues',
            title: `No stadium popup for "${venue}"`,
            detail: `${team} played ${n} of its last ${recent.length} home matches there; the game modal shows it as plain text.`,
            fix: unknownVenueFix(venue),
          })
        } else if (!sameVenueName(info.venue, venue)) {
          add({
            key: `venue-renamed:${slug(venue)}`,
            severity,
            category: 'venues',
            title: `ESPN calls it "${venue}", the popup says "${info.venue}"`,
            detail: `${team} played ${n} of its last ${recent.length} home matches there. The game header shows ESPN's name but the popup and team modal show ours, which may be an outdated naming-rights name.`,
            fix: `If "${venue}" is the current name, rename the MLS_STADIUMS entry and TEAM_VENUE, and keep "${info.venue}" in VENUE_ALIASES for older matches.`,
          })
        }
      }
      checkTeamModalVenue(team, recent, add)
    }
  },
}
