/**
 * MLS Cup finals, newest first, for the trophy popup. Scores are the
 * champion's side first. Sources: Wikipedia's MLS Cup and Philip F. Anschutz
 * Trophy articles, with 2002–2025 scorelines checked against ESPN.
 *
 * Add each new champion after MLS Cup (the popup also fills in the current
 * season's final from the live match until this list has it).
 */

export interface CupFinal {
  year: number
  /** The champion's name that season, e.g. "Kansas City Wizards". */
  champion: string
  /** Today's club, for the logo (a `TEAM_LOGO` key). */
  club: string
  runnerUp: string
  score: string
  /** "a.e.t.", "golden goal", or a shootout, e.g. "4–2 pens". */
  note?: string
}

export const MLS_CUP_FINALS: CupFinal[] = [
  {
    year: 2025,
    champion: 'Inter Miami CF',
    club: 'Inter Miami CF',
    runnerUp: 'Vancouver Whitecaps',
    score: '3–1',
  },
  {
    year: 2024,
    champion: 'LA Galaxy',
    club: 'LA Galaxy',
    runnerUp: 'New York Red Bulls',
    score: '2–1',
  },
  {
    year: 2023,
    champion: 'Columbus Crew',
    club: 'Columbus Crew',
    runnerUp: 'LAFC',
    score: '2–1',
  },
  {
    year: 2022,
    champion: 'LAFC',
    club: 'LAFC',
    runnerUp: 'Philadelphia Union',
    score: '3–3',
    note: '3–0 pens',
  },
  {
    year: 2021,
    champion: 'New York City FC',
    club: 'New York City FC',
    runnerUp: 'Portland Timbers',
    score: '1–1',
    note: '4–2 pens',
  },
  {
    year: 2020,
    champion: 'Columbus Crew',
    club: 'Columbus Crew',
    runnerUp: 'Seattle Sounders',
    score: '3–0',
  },
  {
    year: 2019,
    champion: 'Seattle Sounders',
    club: 'Seattle Sounders FC',
    runnerUp: 'Toronto FC',
    score: '3–1',
  },
  {
    year: 2018,
    champion: 'Atlanta United',
    club: 'Atlanta United FC',
    runnerUp: 'Portland Timbers',
    score: '2–0',
  },
  {
    year: 2017,
    champion: 'Toronto FC',
    club: 'Toronto FC',
    runnerUp: 'Seattle Sounders',
    score: '2–0',
  },
  {
    year: 2016,
    champion: 'Seattle Sounders',
    club: 'Seattle Sounders FC',
    runnerUp: 'Toronto FC',
    score: '0–0',
    note: '5–4 pens',
  },
  {
    year: 2015,
    champion: 'Portland Timbers',
    club: 'Portland Timbers',
    runnerUp: 'Columbus Crew',
    score: '2–1',
  },
  {
    year: 2014,
    champion: 'LA Galaxy',
    club: 'LA Galaxy',
    runnerUp: 'New England Revolution',
    score: '2–1',
    note: 'a.e.t.',
  },
  {
    year: 2013,
    champion: 'Sporting Kansas City',
    club: 'Sporting Kansas City',
    runnerUp: 'Real Salt Lake',
    score: '1–1',
    note: '7–6 pens',
  },
  {
    year: 2012,
    champion: 'LA Galaxy',
    club: 'LA Galaxy',
    runnerUp: 'Houston Dynamo',
    score: '3–1',
  },
  {
    year: 2011,
    champion: 'LA Galaxy',
    club: 'LA Galaxy',
    runnerUp: 'Houston Dynamo',
    score: '1–0',
  },
  {
    year: 2010,
    champion: 'Colorado Rapids',
    club: 'Colorado Rapids',
    runnerUp: 'FC Dallas',
    score: '2–1',
    note: 'a.e.t.',
  },
  {
    year: 2009,
    champion: 'Real Salt Lake',
    club: 'Real Salt Lake',
    runnerUp: 'LA Galaxy',
    score: '1–1',
    note: '5–4 pens',
  },
  {
    year: 2008,
    champion: 'Columbus Crew',
    club: 'Columbus Crew',
    runnerUp: 'New York Red Bulls',
    score: '3–1',
  },
  {
    year: 2007,
    champion: 'Houston Dynamo',
    club: 'Houston Dynamo FC',
    runnerUp: 'New England Revolution',
    score: '2–1',
  },
  {
    year: 2006,
    champion: 'Houston Dynamo',
    club: 'Houston Dynamo FC',
    runnerUp: 'New England Revolution',
    score: '1–1',
    note: '4–3 pens',
  },
  {
    year: 2005,
    champion: 'LA Galaxy',
    club: 'LA Galaxy',
    runnerUp: 'New England Revolution',
    score: '1–0',
    note: 'a.e.t.',
  },
  {
    year: 2004,
    champion: 'D.C. United',
    club: 'D.C. United',
    runnerUp: 'Kansas City Wizards',
    score: '3–2',
  },
  {
    year: 2003,
    champion: 'San Jose Earthquakes',
    club: 'San Jose Earthquakes',
    runnerUp: 'Chicago Fire',
    score: '4–2',
  },
  {
    year: 2002,
    champion: 'LA Galaxy',
    club: 'LA Galaxy',
    runnerUp: 'New England Revolution',
    score: '1–0',
    note: 'a.e.t.',
  },
  {
    year: 2001,
    champion: 'San Jose Earthquakes',
    club: 'San Jose Earthquakes',
    runnerUp: 'LA Galaxy',
    score: '2–1',
  },
  {
    year: 2000,
    champion: 'Kansas City Wizards',
    club: 'Sporting Kansas City',
    runnerUp: 'Chicago Fire',
    score: '1–0',
  },
  {
    year: 1999,
    champion: 'D.C. United',
    club: 'D.C. United',
    runnerUp: 'LA Galaxy',
    score: '2–0',
  },
  {
    year: 1998,
    champion: 'Chicago Fire',
    club: 'Chicago Fire FC',
    runnerUp: 'D.C. United',
    score: '2–0',
  },
  {
    year: 1997,
    champion: 'D.C. United',
    club: 'D.C. United',
    runnerUp: 'Colorado Rapids',
    score: '2–1',
  },
  {
    year: 1996,
    champion: 'D.C. United',
    club: 'D.C. United',
    runnerUp: 'LA Galaxy',
    score: '3–2',
    note: 'golden goal',
  },
]
