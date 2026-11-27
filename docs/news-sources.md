# Public news federation v1

This is a metadata federation for the static command center. Successful retrieval means an endpoint returned valid, attributable metadata. It does not verify a claim, an event, independence between publishers, public safety, or the completeness of coverage.

## Controlled live check

A direct execution of `node scripts/refreshNews.mjs` completed successfully on 2026-11-26 at approximately 16:10 America/Los_Angeles (2026-11-27 00:10 UTC). Collection-run timestamp: `2026-11-27T00:09:46.540Z`. All six fixed endpoints returned HTTP 200 and passed their adapters. The resulting cache holds 115 real public metadata records: NASA 10, UN Geneva 10, ECB 15, arXiv 30, Federal Register 20, USGS 30. The checked-in snapshots preserve their real timestamps and will eventually become stale; tests never require a historical snapshot to appear fresh.

| Source | Format | Endpoint | Attribution and reuse | Limits and coverage |
| --- | --- | --- | --- | --- |
| NASA news releases | RSS | `https://www.nasa.gov/news-release/feed/` | Credit NASA; informational-use guidelines apply. No imagery or article bodies retained. | Agency perspective; release time differs from event occurrence. Latest 10 observed. |
| United Nations Office at Geneva | RSS | `https://www.ungeneva.org/en/news-media/press-items-list/rss.xml` | The official RSS page explicitly permits website display. Original titles, dates and links only. | Institutional press and meeting coverage; not independent reporting. Latest 10 observed. |
| European Central Bank | RSS | `https://www.ecb.europa.eu/rss/press.html` | Accurate attributed free reuse under ECB copyright conditions. Normalized metadata; free originals linked. | No named-author papers or article bodies republished. Latest 15 observed. |
| arXiv cs.AI announcements | Atom | `https://rss.arxiv.org/atom/cs.AI` | CC0 descriptive metadata; paper licenses are separate. Titles and abstract-page links only. | Daily announcement feed; no abstracts/PDFs/author profiles stored. 30-record cap; no peer-review claim. |
| Office of the Federal Register | JSON | `https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest` | US-government metadata, with source credit; no NARA/OFR logos. | Informational web rendition. Verify legal text against an official edition. Date-only publication remains date-only. |
| U.S. Geological Survey | GeoJSON | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson` | Credit USGS/Department of the Interior; USGS-authored data are US public domain. | M4.5+ past week, 30-record cap. Catalog can be revised; no coordinates carried by this news contract. |

All sources currently supply English metadata. Global coverage refers to source remit and must not be mistaken for balanced worldwide journalism. Independent local, multilingual, commercial journalism and cybersecurity feeds require further policy review before enabling adapters.

## Primary policy and API receipts

- NASA feed index: https://www.nasa.gov/rss-feeds/
- NASA informational-use and third-party limits: https://www.nasa.gov/nasa-brand-center/images-and-media/
- UN Geneva RSS display permission: https://www.ungeneva.org/en/news-media/rss
- UN terms: https://www.un.org/en/about-us/terms-of-use
- ECB official feed index: https://www.ecb.europa.eu/home/html/rss.en.html
- ECB copyright and named-author exception: https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html
- arXiv feed-host documentation: https://info.arxiv.org/help/rss.html
- arXiv metadata terms and aggregate rate limit: https://info.arxiv.org/help/api/tou.html
- Federal Register API: https://www.federalregister.gov/developers/documentation/api/v1
- Federal Register reuse/API guidance: https://www.federalregister.gov/reader-aids/developer-resources/rest-api
- Federal Register collection rights: https://www.loc.gov/collections/federal-register/about-this-collection/rights-and-access/
- USGS GeoJSON fields: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- USGS attribution/copyright: https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits

Policies were reviewed using the live primary pages during this implementation. No upstream currently requires an API key for these fixed public endpoints. No numeric quota was found in the inspected NASA, UN, ECB, Federal Register or USGS pages; absence of a published quota is not unlimited permission. arXiv requires no more than one request per three seconds and one connection across controlled machines. This collector makes one arXiv feed request per six-hour cycle with no in-run retry; operators of other arXiv clients must coordinate their aggregate traffic.

Robots checks: NASA permits the endpoint, ECB restrictions do not match `/rss/press.html` (five-second crawl delay; only one ECB request per cycle), and Federal Register restrictions do not match `/api/v1/documents.json`. The official UN canonical RSS path is allowed by its generic site rules. `rss.arxiv.org/robots.txt` and `earthquake.usgs.gov/robots.txt` returned 404. The separately evaluated arXiv legacy API responded successfully but `export.arxiv.org/robots.txt` disallows crawlers; the shipped adapter uses only the documented `rss.arxiv.org` feed host. CISA advisory RSS returned HTTP 403 and is not integrated. An initially guessed UN RSS path returned 404; the configured canonical path was obtained from the official feed index and tested directly.

## Contract and timestamps

`lib/newsSources.mjs` owns the fixed allowlist and provider constraints. `public/data/news-sources.v1.json` publishes the machine-readable registry. Actual retrieval health is separate and joins by source ID; the static registry's null retrieval fields are declarations, not live results.

`phi.watchtower.news.v1` contains `generatedAt`, `sources`, and at most 600 public records. Each record has source identity, original HTTPS receipt, canonical URL, publisher/origin group, title, permitted short metadata, language, topics, location precision, and separate `publishedAt`, `eventAt`, `modifiedAt`, and `retrievedAt` fields. Unknown dates remain null. `retrievedAt` is the collection-run timestamp, never publication or occurrence time. Article bodies, abstracts, media, raw provider payloads, watch zones and private notes are absent.

USGS event and update timestamps come from the catalog fields; publication is unknown. Federal Register day-only publication is recorded in a clearly labeled short metadata string, with `publishedAt:null`; midnight is not invented. arXiv feed `updated` can mean announcement time and is not used as paper publication, modification or event time. XML timestamps require a declared timezone. Invalid dates do not become the current time. The validator rejects invalid calendar dates, future timestamps beyond a five-minute clock tolerance, non-public/demo records and conflicting record IDs. Source record counts must match validated snapshot records.

Canonicalization removes fragments and known tracking parameters while preserving meaningful query arguments. URL equality deduplicates within a source. Identical titles do not establish independence; the intelligence module assesses those relationships separately.

## Collector resilience and security

`lib/newsAdapters.mjs` supports strict RSS/Atom XML, JSON and GeoJSON. Requests are limited to the exact registry objects and their fixed URLs. There is no user-supplied fetch destination, article dereference, proxy, attachment parsing, key, cookie or model execution. Redirects are refused, non-200 responses fail closed, and receipt hosts must match their source allowlist. Content types are checked before parsing.

Each response has a 22-second deadline covering headers and the full body, an actual streamed 2,000,000-byte limit, UTF-8 decoding, and no in-run retry. HTTP, content-type and declared-size rejection immediately aborts the transport and cancels an unread body. Cancellation is best-effort and is not awaited, so an uncooperative stream cannot extend the request deadline. The XML parser rejects DTD/entity declarations, malformed namespace/root structures, depth above 32 and more than 30,000 nodes; only allowed metadata fields are extracted. A maximum of 500 input items is examined and 30 are retained per source. The collector permits at most two concurrent provider requests. HTML is never rendered from source content.

`saxes@6.0.0` is the single new XML-parser dependency. It is strict and has no external entity loader. The upstream project is archived; pinning, payload limits, namespace checks and explicit DTD rejection constrain the supported input surface. Future parser security advisories require dependency review rather than bypassing validation.

Health retains the most recent success, failure, attempt, next attempt and consecutive failure count. The base cooldown is six hours. Failures back off exponentially to 48 hours; a numeric Retry-After can extend the cooldown within that bound. Success resets failure backoff. Partial failure preserves that source's previous records with their original retrieval timestamps. When every attempted source fails, `news.v1.json` remains byte-for-byte unchanged while `news-health.v1.json` records the failures. The browser must prefer a newer sidecar for health and determine record freshness from each record's own retrieval time. Total failure never retimes old news as newly retrieved.

## Operations and verification

Run `node scripts/refreshNews.mjs` from the repository root to refresh fixed public sources, subject to persisted cooldowns. Run `node --test tests/newsAdapters.test.mjs` for deterministic parser, URL, schema, timestamp, transport, concurrency, partial-failure, backoff and total-failure coverage. Fixtures are explicitly synthetic test inputs under `tests/fixtures/news/`; none are copied into the public cache.

`.github/workflows/news-cache.yml` runs on main every six hours and on relevant main-branch changes/manual dispatch. Draft-PR creation does not enable or execute the scheduled job. It installs locked dependencies, runs unit tests, collects and commits only the three public news files, then builds and deploys Pages using the existing shared `pages` concurrency group. Complete provider failure still publishes the health sidecar and finishes with a failure conclusion so operators can investigate. A failed push stops deployment; rollback is to revert the feature commit and associated workflow, with original news files retained as dated artifacts.

This optional scheduled tier extends the static site; core reading, search, evidence inspection and prior-cache use require no account or runtime backend. No paid source is required. Source-policy rechecks, additional languages, richer location classification, ETag/Last-Modified transport optimization and long-lived ingestion history remain future work.

## Existing scheduled-cache transport hardening

The existing Discovery Leads and Orbital Catalog collectors now reuse the streamed response reader through `lib/scheduledJson.mjs`. That helper accepts only the four pre-existing fixed USGS, NASA EONET and CelesTrak URLs. Discovery retains its 22-second/2,000,000-byte limits; orbital groups retain their 25-second/3,000,000-byte limits. HTTP and redirect failures stop without retry, with transport abort and unread-body cancellation. Responses without a Content-Length header are bounded while streaming, before JSON parsing or any public-file write. No endpoints, workflows or published data caches were changed by this hardening.

The scripts expose injectable refresh functions while preserving their CLI entry points, output paths, formats and existing cooldown behavior. `tests/scheduledJson.test.mjs` demonstrates that oversized chunked bodies leave prior cache bytes unchanged, valid finite fixtures preserve both contracts, orbital cooldown suppresses all provider calls, Discovery preserves ten-hour no-change write suppression, redirects are not followed, and stalled bodies are aborted. All checks use deterministic fixtures and temporary files; no additional live provider requests were made.
