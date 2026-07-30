// Liga MX club metadata — needed because Leagues Cup fixtures put Liga MX
// sides on the match wall, and they're absent from the MLS-only TEAM_LOGO /
// TEAM_ABBREV tables.
//
// LOGOS: ESPN serves these as PNG only — there is no .svg variant on their CDN
// (a.espncdn.com/i/teamlogos/soccer/500/{id}.svg returns 404). The 500px PNGs
// are used here since the wall renders logos at roughly 20px. To switch to
// local SVG crests later, drop them in `public/ligamx-logos/` and change
// LIGAMX_LOGO to point at those paths — nothing else needs to change.

export interface LigaMxTeam {
  /** ESPN displayName — the key everything else joins on */
  name: string
  abbrev: string
  short: string
  /** ESPN brand colour, stored as the raw hex ESPN gives us */
  color: string
  espnId: string
}

export const LIGAMX_TEAMS: LigaMxTeam[] = [
  {
    name: 'América',
    abbrev: 'AME',
    short: 'América',
    color: 'ffff91',
    espnId: '227',
  },
  {
    name: 'Atlante',
    abbrev: 'ATE',
    short: 'Atlante',
    color: '022789',
    espnId: '226',
  },
  {
    name: 'Atlas',
    abbrev: 'ATS',
    short: 'Atlas',
    color: 'EF0107',
    espnId: '216',
  },
  {
    name: 'Atlético de San Luis',
    abbrev: 'ASL',
    short: 'Atl. San Luis',
    color: 'EF0107',
    espnId: '15720',
  },
  {
    name: 'Cruz Azul',
    abbrev: 'CAZ',
    short: 'Cruz Azul',
    color: '0000ff',
    espnId: '218',
  },
  {
    name: 'FC Juarez',
    abbrev: 'JUA',
    short: 'Juárez',
    color: '89f442',
    espnId: '17851',
  },
  {
    name: 'Guadalajara',
    abbrev: 'GDL',
    short: 'Guadalajara',
    color: 'EF0107',
    espnId: '219',
  },
  {
    name: 'León',
    abbrev: 'LEO',
    short: 'León',
    color: '008000',
    espnId: '228',
  },
  {
    name: 'Mazatlán FC',
    abbrev: 'MAZ',
    short: 'Mazatlán',
    color: '9400D3',
    espnId: '20702',
  },
  {
    name: 'Monterrey',
    abbrev: 'MTY',
    short: 'Monterrey',
    color: '001C58',
    espnId: '220',
  },
  {
    name: 'Necaxa',
    abbrev: 'NCX',
    short: 'Necaxa',
    color: 'EF0107',
    espnId: '229',
  },
  {
    name: 'Pachuca',
    abbrev: 'PAC',
    short: 'Pachuca',
    color: '001C58',
    espnId: '234',
  },
  {
    name: 'Puebla',
    abbrev: 'PUE',
    short: 'Puebla',
    color: 'ffffff',
    espnId: '231',
  },
  {
    name: 'Pumas UNAM',
    abbrev: 'UNAM',
    short: 'UNAM',
    color: 'ffffff',
    espnId: '233',
  },
  {
    name: 'Querétaro',
    abbrev: 'QRO',
    short: 'Querétaro',
    color: '212121',
    espnId: '222',
  },
  {
    name: 'Santos',
    abbrev: 'SAN',
    short: 'Santos',
    color: '15926d',
    espnId: '225',
  },
  {
    name: 'Tigres UANL',
    abbrev: 'UANL',
    short: 'Tigres',
    color: 'ffd011',
    espnId: '232',
  },
  {
    name: 'Tijuana',
    abbrev: 'TIJ',
    short: 'Tijuana',
    color: 'EF0107',
    espnId: '10125',
  },
  {
    name: 'Toluca',
    abbrev: 'TOL',
    short: 'Toluca',
    color: 'EF0107',
    espnId: '223',
  },
]

function logoUrl(espnId: string): string {
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${espnId}.png`
}

export const LIGAMX_LOGO: Record<string, string> = Object.fromEntries(
  LIGAMX_TEAMS.map((t) => [t.name, logoUrl(t.espnId)])
)

export const LIGAMX_ABBREV: Record<string, string> = Object.fromEntries(
  LIGAMX_TEAMS.map((t) => [t.name, t.abbrev])
)

export const LIGAMX_SHORT_NAME: Record<string, string> = Object.fromEntries(
  LIGAMX_TEAMS.map((t) => [t.name, t.short])
)

export const LIGAMX_COLOR: Record<string, string> = Object.fromEntries(
  LIGAMX_TEAMS.map((t) => [t.name, t.color])
)

export function isLigaMxTeam(name: string): boolean {
  return name in LIGAMX_LOGO
}
