// Fixed reviewed metadata endpoints. Browser clients only request our published cache.
const HOURS = 60 * 60 * 1000;
const common = {
  enabled:true, language:'en', retrievalMethod:'scheduled-cache', authentication:'none',
  minIntervalMs:6*HOURS, expectedUpdateFrequency:'Cache every 6 hours; source publication varies',
  lastSuccessfulRetrieval:null, lastFailedRetrieval:null, dataFreshness:'Evaluate per-record retrievedAt; stale after 36 hours',
  adapterHealth:'pending', healthUrl:'data/news-health.v1.json',
  supportedFields:['title','url','publisher','language','topics','publishedAt','eventAt','modifiedAt','retrievedAt'],
  summaryPolicy:'Titles, links and permitted metadata only. No article body, images, abstracts or attachments retained.'
};
export const NEWS_SOURCES = Object.freeze([
  {
    ...common, id:'nasa-news', name:'NASA News Releases', publisher:'NASA', originGroup:'nasa', category:'science',
    geographicCoverage:['Global','Space'], coverage:'Global / space', format:'rss',
    url:'https://www.nasa.gov/news-release/feed/', receiptHosts:['www.nasa.gov','nasa.gov','science.nasa.gov'],
    topics:['science','space','technology'], kind:'official_statement', evidenceType:'official_statement',
    attribution:'Source: NASA. Open the original release for full context; no NASA endorsement implied.',
    license:'NASA informational-use guidelines',
    licensingConstraints:'NASA-authored metadata only; third-party material and NASA insignia have separate restrictions. No imagery or full text republished.',
    policyUrls:['https://www.nasa.gov/rss-feeds/','https://www.nasa.gov/nasa-brand-center/images-and-media/'],
    limitations:'Agency communications, not independent reporting. A release may describe a scheduled or historical event; publication time is not occurrence time.'
  },
  {
    ...common, id:'un-geneva', name:'UN Geneva Press Items', publisher:'United Nations Geneva', originGroup:'un-geneva', category:'world',
    geographicCoverage:['Global'], coverage:'Global institutional affairs', format:'rss',
    url:'https://www.ungeneva.org/en/news-media/press-items-list/rss.xml', receiptHosts:['www.ungeneva.org','ungeneva.org'],
    topics:['world','policy','humanitarian'], kind:'official_statement', evidenceType:'official_statement',
    attribution:'Source: United Nations Office at Geneva. Titles link to original press items.',
    license:'UN Geneva RSS website-display permission',
    licensingConstraints:'Official RSS page expressly permits displaying feed news on a website. Only titles, dates and links are retained; no images, full documents or third-party material copied.',
    policyUrls:['https://www.ungeneva.org/en/news-media/rss','https://www.un.org/en/about-us/terms-of-use'],
    limitations:'Institutional press statements and meeting coverage, not independent corroboration. Global source coverage does not identify an individual story location.'
  },
  {
    ...common, id:'ecb-press', name:'ECB Press', publisher:'European Central Bank', originGroup:'ecb', category:'economics',
    geographicCoverage:['Europe','Euro area'], coverage:'Euro area / European monetary policy', format:'rss',
    url:'https://www.ecb.europa.eu/rss/press.html', receiptHosts:['www.ecb.europa.eu','ecb.europa.eu'],
    topics:['economics','policy','markets'], kind:'official_statement', evidenceType:'official_statement',
    attribution:'Source: European Central Bank. Normalized metadata; original information is available free from the ECB.',
    license:'ECB copyright: accurate attributed free reuse',
    licensingConstraints:'Cite ECB; disclose modifications and free original availability if sold. Named-author publications require separate permission. Only press-headline metadata retained; no authored papers or body text.',
    policyUrls:['https://www.ecb.europa.eu/home/html/rss.en.html','https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html'],
    limitations:'Issuer perspective, not independent market analysis. Source coverage is European but per-story location remains unspecified. No financial recommendations.'
  },
  {
    ...common, id:'arxiv-ai', name:'arXiv AI Announcements', publisher:'arXiv', originGroup:'arxiv', category:'research',
    geographicCoverage:['Global'], coverage:'Global research submissions / cs.AI', format:'atom',
    url:'https://rss.arxiv.org/atom/cs.AI', receiptHosts:['arxiv.org','www.arxiv.org'],
    topics:['science','technology','research'], kind:'research', evidenceType:'uncorroborated_claim',
    attribution:'arXiv metadata; open the original abstract record. Preprint status does not establish peer review or verified findings.',
    license:'CC0 descriptive metadata; papers retain individual licenses',
    licensingConstraints:'Titles and links only. No abstracts, author profiles, PDFs or source files retained. Single feed request per 6-hour interval; no export.arxiv.org API/crawler calls.',
    policyUrls:['https://info.arxiv.org/help/rss.html','https://info.arxiv.org/help/api/tou.html'],
    limitations:'Daily announcement feed, not a complete research index. Entry updated can be announcement time; it is not used as first publication or event time. Descriptive title is not a verified claim.'
  },
  {
    ...common, id:'federal-register', name:'Federal Register Documents', publisher:'Office of the Federal Register', originGroup:'us-federal-register', category:'policy',
    geographicCoverage:['United States'], coverage:'United States federal public policy', format:'json',
    url:'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest', receiptHosts:['www.federalregister.gov','federalregister.gov'],
    topics:['policy','government'], kind:'official_statement', evidenceType:'primary_documentation',
    attribution:'Source: Office of the Federal Register / NARA. Informational API metadata; verify legal text against the official edition.',
    license:'US-government-authored metadata; third-party rights may apply',
    licensingConstraints:'No NARA/OFR logos or seals. Only document titles, URLs and publication dates used. No full legal text or third-party content stored.',
    policyUrls:['https://www.federalregister.gov/developers/documentation/api/v1','https://www.federalregister.gov/reader-aids/developer-resources/rest-api','https://www.loc.gov/collections/federal-register/about-this-collection/rights-and-access/'],
    limitations:'Informational web rendition, not the official legal edition. Date-only publication stays date-only in summary with publishedAt:null; no midnight publication time invented.'
  },
  {
    ...common, id:'usgs-earthquakes', name:'USGS M4.5+ Earthquakes', publisher:'U.S. Geological Survey', originGroup:'usgs', category:'hazards',
    geographicCoverage:['Global'], coverage:'Global M4.5+ earthquakes / past week', format:'geojson',
    url:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson', receiptHosts:['earthquake.usgs.gov'],
    topics:['hazards','earthquakes','environment'], kind:'public_data', evidenceType:'primary_documentation',
    attribution:'Source: U.S. Geological Survey / Department of the Interior.',
    license:'USGS-authored data: US public domain',
    licensingConstraints:'Credit USGS. Third-party material and USGS identifiers have separate restrictions; only earthquake metadata retained.',
    policyUrls:['https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits'],
    limitations:'Instrument-derived catalog values can be revised. Event occurrence and catalog update are separate; publication time is unavailable. This news contract does not carry coordinates.'
  }
].map(source => Object.freeze(source)));
export function getNewsSource(id) { return NEWS_SOURCES.find(s => s.id === id) ?? null; }
export function makeNewsSourceManifest() {
  return {schema:'phi.watchtower.news-sources.v1',notice:'Metadata-only public-source adapters. Fetch health is not claim verification; coverage is incomplete.',sources:NEWS_SOURCES};
}
