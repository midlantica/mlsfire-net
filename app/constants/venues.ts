// Shared venue data for MLS team stadiums.
// Used by: app/components/GameDetail/Modal.vue, app/components/GameDetail/StadiumModal.vue

export interface StadiumInfo {
  team: string
  venue: string
  city: string
  capacity: number
  image: string
  bio: string
}

export const MLS_STADIUMS: StadiumInfo[] = [
  {
    team: 'Atlanta United FC',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta, GA',
    capacity: 71_000,
    image: '/venues/mercedesbenz-mls.jpg',
    bio: 'Opened in 2017, Mercedes-Benz Stadium is widely regarded as one of the finest multi-purpose stadiums in North America. Home to Atlanta United since the club joined MLS in 2017, its retractable roof opens like a camera aperture, and Atlanta regularly draws the largest crowds in MLS history.',
  },
  {
    team: 'Austin FC',
    venue: 'Q2 Stadium',
    city: 'Austin, TX',
    capacity: 20_738,
    image: '/venues/q2-stadium.jpg',
    bio: "Q2 Stadium opened in 2021 as Austin FC's soccer-specific home in North Austin. Known for 'The Verde Fog' pregame tradition and one of the loudest supporter sections in MLS, the stadium was built with a steep-raked bowl designed specifically to amplify crowd noise onto the pitch.",
  },
  {
    team: 'CF Montréal',
    venue: 'Stade Saputo',
    city: 'Montreal, QC',
    capacity: 19_619,
    image: '/venues/saputo.jpg',
    bio: "Stade Saputo has been home to Montréal's MLS club since 2008, located on the Olympic Park grounds alongside the 1976 Olympic Stadium. Named for team owner Joey Saputo, it has been expanded twice and gives fans an intimate, soccer-specific atmosphere in the shadow of Montreal's Olympic Tower.",
  },
  {
    team: 'Charlotte FC',
    venue: 'Bank of America Stadium',
    city: 'Charlotte, NC',
    capacity: 74_867,
    image: '/venues/bank-of-america.jpg',
    bio: "Shared with the NFL's Carolina Panthers, Bank of America Stadium in uptown Charlotte became Charlotte FC's home upon the club's 2022 MLS debut. Charlotte set the all-time MLS single-match attendance record there, drawing over 74,000 fans for its inaugural home game.",
  },
  {
    team: 'Chicago Fire FC',
    venue: 'Soldier Field',
    city: 'Chicago, IL',
    capacity: 61_500,
    image: '/venues/soldier-field.jpg',
    bio: "One of America's most historic stadiums, Soldier Field has overlooked Lake Michigan since 1924. The Chicago Fire returned to the lakefront venue in 2020 after a stint in the suburbs, giving the club a home with sweeping views of the Chicago skyline.",
  },
  {
    team: 'Colorado Rapids',
    venue: "Dick's Sporting Goods Park",
    city: 'Commerce City, CO',
    capacity: 18_061,
    image: '/venues/dsg-park.jpg',
    bio: "Dick's Sporting Goods Park opened in 2007 as a dedicated soccer venue north of Denver. Sitting at roughly 5,000 feet of elevation, it's part of a large sports complex with dozens of additional fields, and its altitude has long been considered a home-field advantage for the Rapids.",
  },
  {
    team: 'Columbus Crew',
    venue: 'Lower.com Field',
    city: 'Columbus, OH',
    capacity: 20_371,
    image: '/venues/lowercom-field.jpg',
    bio: "Opened in 2021, Lower.com Field replaced Historic Crew Stadium — the first soccer-specific stadium built in MLS — just across the street in the Arena District. The Crew won MLS Cup in the stadium's debut season and again in 2023, cementing it as one of the league's premier atmospheres.",
  },
  {
    team: 'D.C. United',
    venue: 'Audi Field',
    city: 'Washington, D.C.',
    capacity: 20_000,
    image: '/venues/audi-field.jpg',
    bio: "Audi Field opened in 2018 in the Buzzard Point neighborhood along the Anacostia River, finally giving D.C. United — one of MLS's most decorated original clubs — a soccer-specific home after two decades at RFK Stadium.",
  },
  {
    team: 'FC Cincinnati',
    venue: 'TQL Stadium',
    city: 'Cincinnati, OH',
    capacity: 26_000,
    image: '/venues/tql-stadium.jpg',
    bio: 'TQL Stadium opened in 2021 in the West End neighborhood, built to house the passionate supporter culture FC Cincinnati established during its record-setting USL and early MLS years. Its steep, enclosed bowl design creates one of the most intense home-field atmospheres in MLS.',
  },
  {
    team: 'FC Dallas',
    venue: 'Toyota Stadium',
    city: 'Frisco, TX',
    capacity: 19_096,
    image: '/venues/toyota-stadium.jpg',
    bio: 'Toyota Stadium opened in 2005 as Pizza Hut Park, one of the first wave of soccer-specific stadiums built in MLS. Located in Frisco as part of a large multi-sport complex, it also hosts United States national team matches and high school football championships.',
  },
  {
    team: 'Houston Dynamo FC',
    venue: 'Shell Energy Stadium',
    city: 'Houston, TX',
    capacity: 22_039,
    image: '/venues/shell-energy.jpg',
    bio: 'Opened in 2012 near downtown Houston, Shell Energy Stadium has been home to the Dynamo since the club relocated from San Jose. The compact, soccer-specific bowl keeps fans close to the pitch and has hosted two MLS Cup finals.',
  },
  {
    team: 'Inter Miami CF',
    venue: 'Chase Stadium',
    city: 'Fort Lauderdale, FL',
    capacity: 21_550,
    image: '/venues/chase-stadium.jpg',
    bio: "Chase Stadium has served as Inter Miami's home since the club's 2020 inaugural season and became a global focal point after Lionel Messi joined in 2023. It is planned as an interim home while Miami Freedom Park, the club's permanent stadium, is developed nearby.",
  },
  {
    team: 'LA Galaxy',
    venue: 'Dignity Health Sports Park',
    city: 'Carson, CA',
    capacity: 27_000,
    image: '/venues/dignity-health.jpg',
    bio: "Opened in 2003 as the Home Depot Center, this venue has been the Galaxy's home for their entire soccer-specific-stadium era, a period that included five MLS Cup titles and the David Beckham years. It remains one of the league's most storied grounds.",
  },
  {
    team: 'LAFC',
    venue: 'BMO Stadium',
    city: 'Los Angeles, CA',
    capacity: 22_000,
    image: '/venues/bmo-stadium.jpg',
    bio: "BMO Stadium opened in 2018 in Exposition Park, just steps from the Coliseum, as LAFC's home from its debut season. Known for The 3252 supporters' section and a black-and-gold atmosphere considered among MLS's best, it has hosted an MLS Cup final and a CONCACAF Champions Cup final.",
  },
  {
    team: 'Minnesota United FC',
    venue: 'Allianz Field',
    city: 'St. Paul, MN',
    capacity: 19_400,
    image: '/venues/allianz-field.jpg',
    bio: "Allianz Field opened in 2019 with a distinctive translucent exterior skin designed to glow at night and shelter fans from Minnesota's harsh winds. It gave Minnesota United a soccer-specific home after two seasons sharing the University of Minnesota's football stadium.",
  },
  {
    team: 'Nashville SC',
    venue: 'GEODIS Park',
    city: 'Nashville, TN',
    capacity: 30_000,
    image: '/venues/geodis-park.jpg',
    bio: "GEODIS Park opened in 2022 as the largest soccer-specific stadium in the United States. Built on the Nashville Fairgrounds, its size and sightlines quickly made it one of the league's top attendance draws, regularly filling all 30,000 seats.",
  },
  {
    team: 'New England Revolution',
    venue: 'Gillette Stadium',
    city: 'Foxborough, MA',
    capacity: 65_878,
    image: '/venues/gillette-mls.jpg',
    bio: "Shared with the NFL's New England Patriots, Gillette Stadium has been the Revolution's home since it opened in 2002. The venue is configured to a smaller soccer capacity for most matches but has hosted MLS Cup finals and is slated to host 2026 World Cup matches.",
  },
  {
    team: 'New York City FC',
    venue: 'Yankee Stadium',
    city: 'Bronx, NY',
    capacity: 54_251,
    image: '/venues/yankee-stadium.jpg',
    bio: 'NYCFC has played its home matches at Yankee Stadium since entering MLS in 2015, an unusual arrangement that requires the pitch to be laid out diagonally across the baseball outfield and infield. The club is developing its own soccer-specific stadium at Willets Point in Queens.',
  },
  {
    team: 'Orlando City SC',
    venue: 'Inter&Co Stadium',
    city: 'Orlando, FL',
    capacity: 25_500,
    image: '/venues/interco-stadium.jpg',
    bio: "Opened in 2017 near downtown Orlando, this soccer-specific stadium (originally Orlando City Stadium, then Exploria Stadium) is known for its supporters' section and purple-hued nighttime atmosphere, and has hosted both MLS and NWSL matches for Orlando's men's and women's clubs.",
  },
  {
    team: 'Philadelphia Union',
    venue: 'Subaru Park',
    city: 'Chester, PA',
    capacity: 18_500,
    image: '/venues/subaru-park.jpg',
    bio: "Subaru Park opened in 2010 on the banks of the Delaware River in Chester, giving the Union a riverfront soccer-specific home. Its picturesque waterfront backdrop and supporters' section, the Sons of Ben, make it one of the more scenic venues in MLS.",
  },
  {
    team: 'Portland Timbers',
    venue: 'Providence Park',
    city: 'Portland, OR',
    capacity: 25_218,
    image: '/venues/providence-park.jpg',
    bio: 'One of the oldest continuously used sports venues in the country, Providence Park dates to 1926 and has been home to the Timbers since the club joined MLS in 2011. Its steep, enclosed stands and the Timbers Army supporters group create one of the loudest atmospheres in American soccer.',
  },
  {
    team: 'Real Salt Lake',
    venue: 'America First Field',
    city: 'Sandy, UT',
    capacity: 20_213,
    image: '/venues/america-first-field.jpg',
    bio: 'Opened in 2008 as Rio Tinto Stadium, this soccer-specific venue sits at the base of the Wasatch Mountains south of Salt Lake City. Real Salt Lake won the 2009 MLS Cup in its debut season at the stadium, and the mountain backdrop remains one of the most recognizable settings in MLS.',
  },
  {
    team: 'Red Bull New York',
    venue: 'Red Bull Arena',
    city: 'Harrison, NJ',
    capacity: 25_000,
    image: '/venues/red-bull-arena.jpg',
    bio: "Red Bull Arena opened in 2010 in Harrison, New Jersey, directly across the Passaic River from Newark. Its steep, compact bowl and proximity to New York City have made it a fixture for MLS Cup Playoffs and U.S. Men's National Team matches alike.",
  },
  {
    team: 'San Diego FC',
    venue: 'Snapdragon Stadium',
    city: 'San Diego, CA',
    capacity: 35_000,
    image: '/venues/snapdragon-stadium.jpg',
    bio: "Snapdragon Stadium opened in 2022 on the San Diego State University campus and became San Diego FC's home upon the club's 2025 MLS debut as the league's 30th team. Its modern, sail-like canopy roof echoes the region's coastal setting.",
  },
  {
    team: 'San Jose Earthquakes',
    venue: 'PayPal Park',
    city: 'San Jose, CA',
    capacity: 18_000,
    image: '/venues/paypal-park.jpg',
    bio: "PayPal Park opened in 2015 as Avaya Stadium, the Earthquakes' first true soccer-specific stadium after decades of sharing football venues. Located near San Jose's Mineta International Airport, it's known for its open-air 'beer garden' berm overlooking the field.",
  },
  {
    team: 'Seattle Sounders FC',
    venue: 'Lumen Field',
    city: 'Seattle, WA',
    capacity: 37_722,
    image: '/venues/lumen-mls.jpg',
    bio: "Lumen Field is shared with the NFL's Seahawks and has been the Sounders' home since the club's 2009 MLS debut. Seattle routinely leads MLS in attendance, and the open north-end design amplifies crowd noise to deafening levels on matchdays.",
  },
  {
    team: 'Sporting Kansas City',
    venue: "Children's Mercy Park",
    city: 'Kansas City, KS',
    capacity: 18_467,
    image: '/venues/childrens-mercy-park.jpg',
    bio: "Opened in 2011 as LIVESTRONG Sporting Park, this soccer-specific stadium sits in the Village West district of Kansas City, Kansas. Its cantilevered roof and close sightlines have made it one of MLS's premier venues, hosting an MLS Cup final and multiple U.S. Open Cup finals.",
  },
  {
    team: 'St. Louis City SC',
    venue: 'CITYPARK',
    city: 'St. Louis, MO',
    capacity: 22_500,
    image: '/venues/citypark.jpg',
    bio: 'CITYPARK opened in 2023 in the Gateway neighborhood near downtown St. Louis, launching one of the most successful expansion sides in MLS history. St. Louis City set a single-season points record in its debut MLS campaign playing in front of sold-out crowds.',
  },
  {
    team: 'Toronto FC',
    venue: 'BMO Field',
    city: 'Toronto, ON',
    capacity: 30_000,
    image: '/venues/bmo-field-mls.jpg',
    bio: "BMO Field opened in 2007 on the Exhibition Place waterfront as MLS's first soccer-specific stadium in Canada. Home to Toronto FC since the club's inaugural 2007 season, it has undergone multiple expansions and hosted the 2016 MLS Cup Final.",
  },
  {
    team: 'Vancouver Whitecaps',
    venue: 'BC Place',
    city: 'Vancouver, BC',
    capacity: 54_500,
    image: '/venues/bcplace-mls.jpg',
    bio: "Canada's largest stadium, BC Place has been home to the Whitecaps since the club joined MLS in 2011. Its retractable roof — replaced with a modern cable-supported design in 2011 — makes it one of the few fully weatherproof venues in MLS, and it hosted matches at the 2015 FIFA Women's World Cup.",
  },
]

const VENUE_ALIASES: Record<string, string> = {
  'children s mercy park': "Children's Mercy Park",
  citypark: 'CITYPARK',
  'city park': 'CITYPARK',
  'energizer park': 'CITYPARK',
  'scottsmiracle-gro field': 'Lower.com Field',
  'historic crew stadium': 'Lower.com Field',
  'sports illustrated stadium': 'Red Bull Arena',
  'exploria stadium': 'Inter&Co Stadium',
  'orlando city stadium': 'Inter&Co Stadium',
  'rio tinto stadium': 'America First Field',
  'avaya stadium': 'PayPal Park',
  'pizza hut park': 'Toyota Stadium',
  'livestrong sporting park': "Children's Mercy Park",
  'sporting park': "Children's Mercy Park",
  'home depot center': 'Dignity Health Sports Park',
  'stubhub center': 'Dignity Health Sports Park',
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim()
}

/** Look up stadium info by venue name (case-insensitive, alias + partial match
 *  for ESPN naming-rights variants like "Sports Illustrated Stadium"). */
export function getStadiumInfo(
  venueName: string | null | undefined
): StadiumInfo | null {
  if (!venueName) return null
  const lower = normalize(venueName)

  const aliasTarget = VENUE_ALIASES[lower]
  if (aliasTarget) {
    return MLS_STADIUMS.find((s) => s.venue === aliasTarget) ?? null
  }

  const exact = MLS_STADIUMS.find((s) => normalize(s.venue) === lower)
  if (exact) return exact

  const partial = MLS_STADIUMS.find(
    (s) =>
      lower.includes(normalize(s.venue)) || normalize(s.venue).includes(lower)
  )
  return partial ?? null
}

/** Look up stadium info by MLS team name (uses the club's home venue). */
export function getStadiumByTeam(
  teamName: string | null | undefined
): StadiumInfo | null {
  if (!teamName) return null
  return MLS_STADIUMS.find((s) => s.team === teamName) ?? null
}
