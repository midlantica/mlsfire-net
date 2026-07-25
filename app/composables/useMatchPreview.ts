import type { H2HGame, PreviewOdds, SeasonLeader } from './useMatchDetail'
import type { ConferenceBadge } from './useStandings'

export interface MatchPreviewInput {
  eventId: string
  homeTeam: string
  awayTeam: string
  homeAbbr: string
  awayAbbr: string
  homePoints?: string
  awayPoints?: string
  homeBadge?: ConferenceBadge
  awayBadge?: ConferenceBadge
  homeForm?: string
  awayForm?: string
  h2h: H2HGame[]
  homeLeader?: SeasonLeader
  awayLeader?: SeasonLeader
  previewOdds?: PreviewOdds
}

export interface MatchPreview {
  template: string
  text: string
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

function conferenceName(letter: string): string {
  return letter === 'E' ? 'Eastern Conference' : 'Western Conference'
}

function formatForm(form?: string): string {
  if (!form) return ''
  return form.split('-').join('')
}

function formatMoneyline(ml?: number): string {
  if (ml === undefined) return ''
  return ml > 0 ? `+${ml}` : `${ml}`
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function pickVariant(seed: string, count: number): number {
  if (count <= 1) return 0
  return hashCode(seed) % count
}

export function generateMatchPreview(
  input: MatchPreviewInput
): MatchPreview | null {
  const candidates: MatchPreview[] = []

  // ── Template 1: Form & Table Watch ──────────────────────────────────────
  if (
    input.homeForm &&
    input.awayForm &&
    input.homePoints &&
    input.awayPoints
  ) {
    const homeRankText = input.homeBadge
      ? `sitting ${ordinal(input.homeBadge.rank)} in the ${conferenceName(input.homeBadge.letter)} with ${input.homePoints} points`
      : `sitting on ${input.homePoints} points`
    const awayRankText = input.awayBadge
      ? `${ordinal(input.awayBadge.rank)} in the ${conferenceName(input.awayBadge.letter)} with ${input.awayPoints} points`
      : `${input.awayPoints} points of their own`
    const homeFormStr = formatForm(input.homeForm)
    const awayFormStr = formatForm(input.awayForm)

    const variants = [
      `${input.homeTeam} arrive on a ${homeFormStr} run through their last five, ${homeRankText}. ${input.awayTeam} come in on a ${awayFormStr} stretch, ${awayRankText} — both clubs will be eager to keep their recent momentum going tonight.`,
      `${input.homeTeam} head into this one on the back of a ${homeFormStr} run, ${homeRankText}. ${input.awayTeam}, meanwhile, arrive on a ${awayFormStr} stretch, ${awayRankText} — plenty on the line for both sides.`,
      `Recent form is worth watching here: ${input.homeTeam} have gone ${homeFormStr} across their last five, ${homeRankText}, while ${input.awayTeam} have managed ${awayFormStr}, ${awayRankText}.`,
      `${input.homeTeam} (${homeFormStr} in their last five) host ${input.awayTeam} (${awayFormStr}) tonight, with ${homeRankText} and the visitors ${awayRankText}.`,
    ]
    const idx = pickVariant(`${input.eventId}-form-table`, variants.length)
    candidates.push({
      template: 'form-table',
      text: variants[idx] ?? variants[0]!,
    })
  }

  // ── Template 2: Series History ──────────────────────────────────────────
  if (input.h2h.length > 0) {
    const tally = { W: 0, L: 0, D: 0 }
    for (const g of input.h2h) {
      if (g.result === 'W') tally.W++
      else if (g.result === 'L') tally.L++
      else tally.D++
    }
    const last = input.h2h[0]
    if (last) {
      const lastResultText =
        last.result === 'W'
          ? `a win for ${input.homeAbbr}`
          : last.result === 'L'
            ? `a win for ${input.awayAbbr}`
            : 'a draw'
      const count = input.h2h.length
      const countText = `${count} time${count === 1 ? '' : 's'}`
      const record = `${tally.W}-${tally.L}-${tally.D}`

      const variants = [
        `${input.homeAbbr} and ${input.awayAbbr} have met ${countText} recently, with ${input.homeAbbr} holding a ${record} edge in that span. Their last meeting finished ${last.score}, ${lastResultText} — expect a little extra edge with history on the line.`,
        `History between these two: ${input.homeAbbr} hold a ${record} edge over their last ${count} meetings with ${input.awayAbbr}, and the most recent one finished ${last.score} (${lastResultText}). Old rivalries die hard.`,
        `These sides know each other well — ${countText} recently, with ${input.homeAbbr} ahead ${record}. The last meeting finished ${last.score}, ${lastResultText}.`,
        `Familiarity breeds intensity: ${input.homeAbbr} and ${input.awayAbbr} have squared off ${countText} of late (${input.homeAbbr} ${record}), with the last clash ending ${last.score}, ${lastResultText}.`,
      ]
      const idx = pickVariant(
        `${input.eventId}-series-history`,
        variants.length
      )
      candidates.push({
        template: 'series-history',
        text: variants[idx] ?? variants[0]!,
      })
    }
  }

  // ── Template 3: Vegas Lens ───────────────────────────────────────────────
  if (input.previewOdds?.favorite && input.previewOdds.overUnder) {
    const favTeam =
      input.previewOdds.favorite === 'home' ? input.homeTeam : input.awayTeam
    const mlText = formatMoneyline(input.previewOdds.favoriteMoneyline)
    const mlSuffix = mlText ? ` (${mlText})` : ''
    const ou = input.previewOdds.overUnder

    const variants = [
      `Oddsmakers have ${favTeam} favored${mlSuffix} heading into kickoff, with the total goals line set at ${ou} — a number that hints at an entertaining night for neutrals either way.`,
      `The betting markets lean toward ${favTeam}${mlSuffix} tonight, and the over/under is set at ${ou} goals — worth keeping an eye on as the game unfolds.`,
      `${favTeam} enter as the bookmakers' pick${mlSuffix}, with the total sitting at ${ou} goals — bettors clearly expect goals at both ends.`,
      `Vegas has ${favTeam} as the favorite${mlSuffix} coming in, and the goals total is pegged at ${ou} — a solid gauge of how open this one is expected to be.`,
    ]
    const idx = pickVariant(`${input.eventId}-vegas-lens`, variants.length)
    candidates.push({
      template: 'vegas-lens',
      text: variants[idx] ?? variants[0]!,
    })
  }

  // ── Template 4: Players to Watch ─────────────────────────────────────────
  if (input.homeLeader || input.awayLeader) {
    const homeClause = input.homeLeader
      ? `${input.homeLeader.name} leads the line for ${input.homeAbbr} with ${
          input.homeLeader.goals !== undefined
            ? `${input.homeLeader.goals} goals`
            : 'goals'
        }${
          input.homeLeader.matches !== undefined
            ? ` in ${input.homeLeader.matches} matches`
            : ''
        }`
      : undefined
    const awayClause = input.awayLeader
      ? `${input.awayLeader.name} has been the man for ${input.awayAbbr} with ${
          input.awayLeader.goals !== undefined
            ? `${input.awayLeader.goals} goals`
            : 'goals'
        }${
          input.awayLeader.matches !== undefined
            ? ` in ${input.awayLeader.matches} matches`
            : ''
        }`
      : undefined

    let variants: string[]

    if (homeClause && awayClause) {
      const joined = `${homeClause}, while ${awayClause}`
      variants = [
        `Keep an eye on the scoresheet tonight: ${joined}. Two players capable of deciding this one on their own.`,
        `Individual quality could settle this one: ${joined}. Either man is capable of a moment of magic.`,
        `Firepower to watch on both ends — ${joined} — expect fireworks if either finds space.`,
        `If this game hinges on a flash of quality, ${joined} — the two most likely to provide it.`,
      ]
    } else {
      const clause = (homeClause ?? awayClause)!
      variants = [
        `Keep an eye on the scoresheet tonight: ${clause}. A player capable of deciding this one on their own.`,
        `One name to watch closely: ${clause} — capable of a moment of magic at either end.`,
        `${clause}. If the game is there for the taking, don't be surprised if it's decided by a moment of individual quality.`,
        `All eyes may be on one man tonight: ${clause}, and a quiet night for the opposing defense could prove costly.`,
      ]
    }

    const idx = pickVariant(
      `${input.eventId}-players-to-watch`,
      variants.length
    )
    candidates.push({
      template: 'players-to-watch',
      text: variants[idx] ?? variants[0]!,
    })
  }

  if (candidates.length === 0) return null

  const index = hashCode(input.eventId) % candidates.length
  return candidates[index] ?? candidates[0] ?? null
}
