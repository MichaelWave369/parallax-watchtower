// Curated user-supplied starting points. Links are NOT health-checked, licensed APIs,
// live-feed guarantees, or endorsements. Never scrape or embed them by default.
export const EXPLORE_CATEGORIES = Object.freeze([
  {
    "id": "earth",
    "label": "Live Planet",
    "description": "Earth observation, hazards, infrastructure and public trackers"
  },
  {
    "id": "places",
    "label": "Maps & Places",
    "description": "Explore geography, history and destinations"
  },
  {
    "id": "space",
    "label": "Space & Sky",
    "description": "Astronomy, planets and NASA collections"
  },
  {
    "id": "data",
    "label": "Data & Insight",
    "description": "Research data, statistics and visual journalism"
  },
  {
    "id": "archive",
    "label": "Archives & Art",
    "description": "Libraries, public heritage and museum collections"
  },
  {
    "id": "culture",
    "label": "Culture & Science",
    "description": "Music, encyclopedias, science and creative tools"
  }
]);

export const EXPLORE_SOURCES = Object.freeze([
  {
    "id": "01",
    "name": "Zoom Earth",
    "url": "https://zoom.earth",
    "category": "earth",
    "description": "Satellite weather and Earth imagery explorer",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "02",
    "name": "Flightradar24",
    "url": "https://flightradar24.com",
    "category": "earth",
    "description": "Public flight-tracking map and aircraft information",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "03",
    "name": "MarineTraffic",
    "url": "https://marinetraffic.com",
    "category": "earth",
    "description": "Ship tracking and maritime traffic overview",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "04",
    "name": "Windy",
    "url": "https://windy.com",
    "category": "earth",
    "description": "Weather forecast maps for wind and storms",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "05",
    "name": "Lightning Maps",
    "url": "https://lightningmaps.org",
    "category": "earth",
    "description": "Community lightning strike visualizations",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "06",
    "name": "USGS Earthquakes",
    "url": "https://earthquake.usgs.gov",
    "category": "earth",
    "description": "Official United States Geological Survey earthquake reporting",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "07",
    "name": "Submarine Cable Map",
    "url": "https://submarinecablemap.com",
    "category": "earth",
    "description": "Map of global submarine communications cables",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "08",
    "name": "Global Forest Watch",
    "url": "https://globalforestwatch.org",
    "category": "earth",
    "description": "Forest monitoring and environmental data explorer",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "09",
    "name": "Worldometer",
    "url": "https://worldometers.info",
    "category": "earth",
    "description": "Public counters and compiled population statistics",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "10",
    "name": "Internet Live Stats",
    "url": "https://internetlivestats.com",
    "category": "earth",
    "description": "Internet activity counters and estimated trends",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "11",
    "name": "The True Size",
    "url": "https://thetruesize.com",
    "category": "places",
    "description": "Compare countries using a more faithful size projection",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "12",
    "name": "Old Maps Online",
    "url": "https://oldmapsonline.org",
    "category": "places",
    "description": "Find historical cartography by location and time",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "13",
    "name": "David Rumsey Map Collection",
    "url": "https://davidrumsey.com",
    "category": "places",
    "description": "Historical maps and geographic collections",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "14",
    "name": "OpenStreetMap",
    "url": "https://openstreetmap.org",
    "category": "places",
    "description": "Community-created global map",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "15",
    "name": "Window Swap",
    "url": "https://window-swap.com",
    "category": "places",
    "description": "View submitted window scenes from around the world",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "16",
    "name": "Virtual Vacation",
    "url": "https://virtualvacation.us",
    "category": "places",
    "description": "Virtual visits and walking experiences in cities",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "17",
    "name": "MapCrunch",
    "url": "https://mapcrunch.com",
    "category": "places",
    "description": "Explore randomly selected street-level locations",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "18",
    "name": "Atlas Obscura",
    "url": "https://atlasobscura.com",
    "category": "places",
    "description": "Unusual locations and stories from around the globe",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "19",
    "name": "Neal.fun",
    "url": "https://neal.fun",
    "category": "places",
    "description": "Interactive educational experiments and visual experiences",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "20",
    "name": "Scale of the Universe",
    "url": "https://htwins.net/scale2",
    "category": "places",
    "description": "Interactive journey across orders of magnitude",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "21",
    "name": "NASA Eyes",
    "url": "https://eyes.nasa.gov",
    "category": "space",
    "description": "NASA interactive solar system and mission visualizations",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "22",
    "name": "Stellarium Web",
    "url": "https://stellarium-web.org",
    "category": "space",
    "description": "Interactive sky chart and planetarium",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "23",
    "name": "NASA Astronomy Picture of the Day",
    "url": "https://apod.nasa.gov",
    "category": "space",
    "description": "Astronomy image and explanation archive",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "24",
    "name": "NASA Image Library",
    "url": "https://images.nasa.gov",
    "category": "space",
    "description": "NASA imagery and media archive",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "25",
    "name": "The Pudding",
    "url": "https://pudding.cool",
    "category": "data",
    "description": "Visual essays and interactive data storytelling",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "26",
    "name": "Our World in Data",
    "url": "https://ourworldindata.org",
    "category": "data",
    "description": "Research and data charts about global conditions",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "27",
    "name": "Gapminder",
    "url": "https://gapminder.org",
    "category": "data",
    "description": "Tools to test assumptions about global development",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "28",
    "name": "Information Is Beautiful",
    "url": "https://informationisbeautiful.net",
    "category": "data",
    "description": "Visual explanations of complex datasets",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "29",
    "name": "World Bank Open Data",
    "url": "https://data.worldbank.org",
    "category": "data",
    "description": "Worldwide development indicators and datasets",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "30",
    "name": "Turkish Statistical Institute Data",
    "url": "https://data.tuik.gov.tr",
    "category": "data",
    "description": "Official statistics database for Türkiye",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "31",
    "name": "Internet Archive",
    "url": "https://archive.org",
    "category": "archive",
    "description": "Digital collections of books, media and software",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "32",
    "name": "Project Gutenberg",
    "url": "https://gutenberg.org",
    "category": "archive",
    "description": "Free digital texts, many in the public domain",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "33",
    "name": "Open Library",
    "url": "https://openlibrary.org",
    "category": "archive",
    "description": "Catalog and lending access to books",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "34",
    "name": "Library of Congress",
    "url": "https://loc.gov",
    "category": "archive",
    "description": "United States cultural and historical collections",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "35",
    "name": "Europeana",
    "url": "https://europeana.eu",
    "category": "archive",
    "description": "European cultural heritage collections",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "36",
    "name": "Digital Public Library of America",
    "url": "https://dp.la",
    "category": "archive",
    "description": "Aggregated collections from American cultural institutions",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "37",
    "name": "Google Arts & Culture",
    "url": "https://artsandculture.google.com",
    "category": "archive",
    "description": "Museum tours, exhibitions and cultural material",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "38",
    "name": "Rijksmuseum",
    "url": "https://rijksmuseum.nl",
    "category": "archive",
    "description": "Museum collections and available artwork images",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "39",
    "name": "WikiArt",
    "url": "https://wikiart.org",
    "category": "archive",
    "description": "Browse artworks and artist information",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "40",
    "name": "Public Domain Review",
    "url": "https://publicdomainreview.org",
    "category": "archive",
    "description": "Curated historical and public-domain collections",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "41",
    "name": "Open Culture",
    "url": "https://openculture.com",
    "category": "archive",
    "description": "Links to education and cultural media",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "42",
    "name": "Metropolitan Museum of Art",
    "url": "https://metmuseum.org",
    "category": "archive",
    "description": "The Met's artworks and collection information",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "43",
    "name": "Musicmap",
    "url": "https://musicmap.info",
    "category": "culture",
    "description": "Explore the evolution of musical genres",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "44",
    "name": "Radiooooo",
    "url": "https://radiooooo.com",
    "category": "culture",
    "description": "Browse music by country and decade",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "45",
    "name": "Listen to Wikipedia",
    "url": "https://listen.hatnote.com",
    "category": "culture",
    "description": "Audio visualization of Wikipedia edits",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "46",
    "name": "Wikipedia",
    "url": "https://wikipedia.org",
    "category": "culture",
    "description": "Collaboratively edited encyclopedia and knowledge links",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "47",
    "name": "Time and Date",
    "url": "https://timeanddate.com",
    "category": "culture",
    "description": "Time zones, sunrise, celestial calendars and more",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "48",
    "name": "ScienceDaily",
    "url": "https://sciencedaily.com",
    "category": "culture",
    "description": "Science research news and coverage",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "49",
    "name": "arXiv",
    "url": "https://arxiv.org",
    "category": "culture",
    "description": "Open-access scientific preprints",
    "access": "external-link",
    "verification": "not-checked"
  },
  {
    "id": "50",
    "name": "Observable",
    "url": "https://observablehq.com",
    "category": "culture",
    "description": "Interactive notebooks and data visualizations",
    "access": "external-link",
    "verification": "not-checked"
  }
]);

export function isSafeExploreUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function filterExploreSources(sources, { category = "all", query = "" } = {}) {
  const term = String(query).trim().toLocaleLowerCase();
  return sources.filter((source) => {
    if (category !== "all" && source.category !== category) return false;
    if (!term) return true;
    const haystack = [source.name, source.description, source.url, source.category]
      .join(" ").toLocaleLowerCase();
    return haystack.includes(term);
  });
}
