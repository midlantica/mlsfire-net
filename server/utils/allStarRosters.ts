/**
 * Hardcoded fallback player pools for the 2026 MLS All-Star Game.
 *
 * ESPN's summary API returns empty `roster` arrays for this fixture — the
 * coaches' player pools simply aren't structured data anywhere on ESPN — so
 * we hand-maintain the announced player pool here as a stand-in until an
 * actual starting XI is confirmed.
 *
 * Source: https://www.pcmag.com/news/how-to-watch-2026-mls-all-star-liga-mx-game-live-even-for-free-today
 */

export interface FallbackPlayer {
  displayName: string
  club: string
  position: 'G' | 'D' | 'M' | 'F'
}

const MLS_ALL_STARS: FallbackPlayer[] = [
  { displayName: 'Maxime Crépeau', club: 'Orlando City SC', position: 'G' },
  { displayName: 'Matt Freese', club: 'New York City FC', position: 'G' },
  { displayName: 'Brian Schwake', club: 'Nashville SC', position: 'G' },
  { displayName: 'Max Arfsten', club: 'Columbus Crew', position: 'D' },
  { displayName: 'Lucas Herrington', club: 'Colorado Rapids', position: 'D' },
  { displayName: 'Richie Laryea', club: 'Toronto FC', position: 'D' },
  {
    displayName: 'Anthony Markanich',
    club: 'Minnesota United FC',
    position: 'D',
  },
  { displayName: 'Steven Moreira', club: 'Columbus Crew', position: 'D' },
  { displayName: 'Daniel Munie', club: 'San Jose Earthquakes', position: 'D' },
  { displayName: 'Andy Najar', club: 'Nashville SC', position: 'D' },
  { displayName: 'Jackson Ragen', club: 'Seattle Sounders FC', position: 'D' },
  { displayName: 'Tim Ream', club: 'Charlotte FC', position: 'D' },
  {
    displayName: 'Sebastian Berhalter',
    club: 'Vancouver Whitecaps FC',
    position: 'M',
  },
  { displayName: 'Pep Biel', club: 'Charlotte FC', position: 'M' },
  { displayName: 'Yannick Bright', club: 'Inter Miami CF', position: 'M' },
  {
    displayName: 'Andrés Cubas',
    club: 'Vancouver Whitecaps FC',
    position: 'M',
  },
  { displayName: 'Evander', club: 'FC Cincinnati', position: 'M' },
  { displayName: 'Carles Gil', club: 'New England Revolution', position: 'M' },
  { displayName: 'Zavier Gozo', club: 'Real Salt Lake', position: 'M' },
  { displayName: 'Hany Mukhtar', club: 'Nashville SC', position: 'M' },
  {
    displayName: 'Thomas Müller',
    club: 'Vancouver Whitecaps FC',
    position: 'M',
  },
  { displayName: 'Ashley Westwood', club: 'Charlotte FC', position: 'M' },
  { displayName: 'Anders Dreyer', club: 'San Diego FC', position: 'F' },
  { displayName: 'Guilherme', club: 'Houston Dynamo FC', position: 'F' },
  { displayName: 'Julian Hall', club: 'Red Bull New York', position: 'F' },
  { displayName: 'Son Heung-Min', club: 'LAFC', position: 'F' },
  { displayName: 'Petar Musa', club: 'FC Dallas', position: 'F' },
  { displayName: 'Sam Surridge', club: 'Nashville SC', position: 'F' },
  {
    displayName: 'Philip Zinckernagel',
    club: 'Chicago Fire FC',
    position: 'F',
  },
]

const LIGA_MX_ALL_STARS: FallbackPlayer[] = [
  { displayName: 'Carlos Acevedo', club: 'Santos Laguna', position: 'G' },
  { displayName: 'Carlos Moreno', club: 'CF Pachuca', position: 'G' },
  { displayName: 'Omar Campos', club: 'Cruz Azul', position: 'D' },
  { displayName: 'Willer Ditta', club: 'Cruz Azul', position: 'D' },
  { displayName: 'Jesús Gallardo', club: 'Toluca FC', position: 'D' },
  { displayName: 'Jesús Garza', club: 'Tigres UANL', position: 'D' },
  { displayName: 'Bruno Méndez', club: 'Toluca FC', position: 'D' },
  { displayName: 'Federico Pereira', club: 'Toluca FC', position: 'D' },
  {
    displayName: 'Luis Gabriel Rey',
    club: 'Chivas Guadalajara',
    position: 'D',
  },
  { displayName: 'Israel Reyes', club: 'Club América', position: 'D' },
  { displayName: 'Nathan Silva', club: 'Pumas UNAM', position: 'D' },
  { displayName: 'Juan Brunetta', club: 'Tigres UANL', position: 'M' },
  { displayName: 'Iker Fimbres', club: 'CF Monterrey', position: 'M' },
  { displayName: 'Fernando Gorriarán', club: 'Tigres UANL', position: 'M' },
  { displayName: 'Erik Lira', club: 'Cruz Azul', position: 'M' },
  { displayName: 'Elías Montiel', club: 'CF Pachuca', position: 'M' },
  { displayName: 'José Paradela', club: 'Cruz Azul', position: 'M' },
  { displayName: 'Carlos Rodríguez', club: 'Cruz Azul', position: 'M' },
  { displayName: 'Franco Romero', club: 'Toluca FC', position: 'M' },
  { displayName: 'Javier Ruiz', club: 'Necaxa', position: 'M' },
  {
    displayName: 'Kevin Castañeda',
    club: 'Chivas Guadalajara',
    position: 'F',
  },
  { displayName: 'Alexei Domínguez', club: 'CF Pachuca', position: 'F' },
  { displayName: 'Salomón Rondón', club: 'CF Pachuca', position: 'F' },
  { displayName: 'Robert Morales', club: 'Pumas UNAM', position: 'F' },
]

/**
 * Fallback player pools keyed by ESPN eventId, then by the team's ESPN
 * `displayName` exactly as it appears in the summary API's `header`.
 */
export const ALL_STAR_FALLBACK_ROSTERS: Record<
  string,
  Record<string, FallbackPlayer[]>
> = {
  '401864004': {
    'MLS All-Stars': MLS_ALL_STARS,
    'Liga MX All-Stars': LIGA_MX_ALL_STARS,
  },
}
