# News intelligence and public briefing contracts

This candidate adds deterministic metadata tools above the static news cache. It
does not perform independent claim verification and does not require an LLM,
account, inference server or paid service. The controlling product requirements
are Operation Watchtower Ascension, especially sections 5–8, 13, 15 and 19.

## Module API

`lib/newsIntelligence.mjs` exposes the following pure functions. `now` accepts a
numeric epoch in milliseconds or an ISO timestamp; tests use a fixed time.

| Function | Return value and purpose |
| --- | --- |
| `deduplicateNews(records, { now })` | `{ records, duplicates }`, retaining validated public metadata and recording why a copy was removed. |
| `newsRecordFreshness(record, now, maxAgeHours = 36)` | Separate retrieval and publication age, with `fresh`, `stale` or `unknown` cache state. Fresh retrieval is not fresh reporting. |
| `clusterEvents(records, { separateIds, now })` | Reviewable event suggestions with source records, distinct origin groups, source-attributed timeline entries and explicit unknowns. |
| `compareEventReports(event)` | Attributed headline, feed excerpt, evidence type and four timestamp fields for each report. |
| `makeNewsBriefing(records, options)` | A versioned public metadata briefing with explicit source references and coverage limits. |
| `validateBriefingCitations(brief)` | Checks every item references a safe URL with the same source headline and publisher. This validates internal consistency, not what the linked page says. |
| `briefingToMarkdown(brief)` | A printable Markdown brief; refuses missing or mismatched references and escapes active markup in titles. |

Records first pass through `normalizeNewsRecord`. Demonstration records, private
records, malformed timestamps and unsafe receipt URLs are excluded. Extra
properties are discarded. The normalized contract carries permitted source
metadata and links, without copying full articles.

## Duplicate handling and event suggestions

Canonical URL equality collapses repeated links across feeds. Identical headline
fingerprints collapse only within the same configured origin group and exact
known report time, with matching kind, occurrence/modification times, language
and declared geographic precision and place label. Public-data observations deduplicate only by
URL. A fingerprint is a deterministic lookup aid, not a
cryptographic integrity statement. Different publication times remain separate
observations. Selection is deterministic across input order; when the same URL
is repeated, the most recently retrieved version is preferred.

Event suggestions require strong headline overlap, a shared configured topic,
matching declared region code and precision, and known source times within 48
hours. Known occurrence times more than 48 hours apart prevent grouping even if
both reports were published together. Region- and point-level place labels must
also match after text normalization: a shared broad coverage code such as GLOBAL
does not establish that differently named regions are the same place.

Public-data observations with distinct canonical receipt URLs are never
automatically grouped with each other or with news articles. Two earthquakes can
have the same magnitude, place label and nearly adjacent timestamps while still
being different events. Canonical-URL copies already deduplicate. Matching
different providers' event identifiers would require an explicit evidence-backed
identity contract; that capability is not implemented.
Different numeric quantities or explicit negations prevent automatic grouping.
An indexed candidate search and comparison against both the anchor and latest
member reduce broad vocabulary matches and transitive similarity chains.

The conservative matcher will miss genuine relationships, especially between
different languages, differently worded headlines and short titles. This is
intentional: false negatives are preferable to invented event relationships.
Matching global or unknown geographic metadata never establishes a precise
location. No coordinates are inferred from publisher geography or generic
keywords.

Each suggestion preserves its original reports. Supplying a report ID in
`separateIds` forces that report into its own suggestion, allowing a local user
correction without altering the original cache. Event IDs derive from the
canonical URL of the oldest known source record. They are stable for input
reordering, repeated links and later reports; discovery of an earlier report can
reanchor a heuristic event. These are local suggestion identities, not a
permanent globally synchronized event registry.

`sourceCount` counts distinct feed IDs. `originGroups` counts configured upstream
origins. Neither count measures independent confirmation. Exact headline reuse
across retained reports sets `possibleSyndication`; the tool does not declare
syndication proven. `independentCorroboration` is always `not_assessed`.

`firstReportedAt` uses known publication timestamps only. `lastUpdatedAt` uses
known publication and modification timestamps only. Event occurrence and cache
retrieval are kept separately, including when publication is unknown. Every
timeline entry identifies its time type, originating record and source URL.

Source metadata does not establish quoted parties, omitted context, a factual
contradiction or corrections to an underlying claim. The comparison desk presents
the original statements for review. A title explicitly beginning “Correction” or
“Retraction” is a source-signaled notice, not an automatically adjudicated change
to another record. Automated claim extraction, contradiction adjudication and a
persisted correction ledger remain planned.

## Deterministic briefings

The default window is the last 24 hours; `windowHours: 168` produces a seven-day
selection. Custom windows are bounded to 31 days. Options include `topic`,
`region`, `query` and `maxItems` (1–100, default 30).

The selection applies explicit filters and orders by known publication time,
falling back to event occurrence, then source modification when publication is
unknown. Stable IDs break ties. It does not substitute retrieval time for missing
source time, predict engagement, infer impact scores or claim to identify the
world's objectively most important stories. Publication time takes precedence
when known, so a newly retrieved old article does not become breaking news.

Each item preserves publication, occurrence, modification and retrieval time,
evidence type, source identity, geographic precision, cache state and references.
Undated records are counted as excluded rather than assigned an invented time.
Older cached records may appear in an appropriate historical window and are
explicitly labeled stale. Coverage includes source count, omitted records,
duplicate removals, stale retrieval count and input truncation.

Only a public field allowlist enters the briefing envelope. Watchlists, watch
zones, private notes, raw provider errors and arbitrary imported properties are
not included. Exports happen only after a user action in the interface. Consumer
applications must still request consent before importing or saving a packet.

## Versioned interfaces

| Contract | Schema | Purpose |
| --- | --- | --- |
| Public news record | `public/schemas/news-record.schema.json` | Permitted metadata, attribution and separate timestamps. |
| Public cache | `public/schemas/news-snapshot.schema.json` | `phi.watchtower.news.v1` source health and bounded records. |
| Event suggestion | `public/schemas/news-event.schema.json` | `phi.watchtower.event.v1` reversible grouping with originals. |
| Source-backed brief | `public/schemas/news-briefing.schema.json` | `phi.watchtower.briefing.v1` deterministic selection with citations. |

These are Watchtower-side contracts. No downstream repository is changed, and no
PhiOS, PhiBuddy, Agentora, PhiMemory9, Peekaboo or EIRM consumer is claimed to be
implemented. Existing `phi.fieldpack.v1` stays compatible. News consumers should
validate structure, URL safety, timestamp limits, per-item reference integrity
and public-only import scope before use. JSON Schema structural validation alone
does not establish chronology, provider authenticity, claim truth or privacy
consent. Runtime validators enforce additional semantic constraints.

## Verification and limits

`node --test tests/newsIntelligence.test.mjs` currently exercises 20 behavior and
security cases: duplicate identity, multiple feeds per origin, syndication
uncertainty, false relationship prevention, independent time fields, reversible
grouping, citation integrity, date windows, stale caches, bounded processing,
unsafe receipts, private-data exclusion and escaped Markdown.

Four emitted object types were also validated locally against the JSON Schema
2020-12 contracts using Python `jsonschema` 4.26 with format checking. A private
record failed the public record schema as expected. This is a local
implementation check; no CI execution of that Python library is implied.

Processing reads at most 5,000 input records. Event output is capped at 1,500 and
briefings at 100 items. The source cache contract is smaller (600). Candidate
search examines at most 80 candidate groups per report; this is an explicit
performance/recall tradeoff. High-volume matching is not a substitute for an
archive index or a dedicated worker. Controlled fixture measurements belong in
the mission report and must not be represented as live provider throughput or
browser rendering performance.

This is the metadata grouping and deterministic briefing portion of the larger
mission. Full historical event versioning, calibrated relevance ranking,
multilingual semantic clustering, historical context generation and optional
model assistance remain planned. No generated analysis is presented as reporting.
