# Incident Library · evidence-ledger v1

WATCHTOWER LIVE now includes **two separate public-source historical cases**:

- November 13, 2026: nationwide FAA ground stop during ATC telecommunications and radar-data instability. Evidence: DOT November 13 and 14 statements, plus FAA ATCSCC Advisory 111. The advisory signing time is **not** a measured universal operational stop time.
- January 11, 2023: NOTAM outage and a nationwide departure ground stop. Evidence: FAA's January 11/19 statements and Acting Administrator Billy Nolen's February 15 Senate testimony. A stated approximately 7:15 a.m. stop time is marked as approximate; the 9:07 a.m. release is attributed to testimony.

## Directory and evidence boundaries
- Search cases by year, title, system or description.
- Choose a case to see its independent summary, facts, timeline, source receipts, contextual discovery links, and copyable sourced brief.
- The "Compare with..." jump means **related category**, not established technical equivalence, a shared underlying failure, or causal linkage.
- Official statements are cited as statements, not independently verified telemetry or complete engineering root-cause reports.
- Distinguish `minute`, `approximate_minute` and `day` precision in records, with explicit user-facing labels.
- Notes labeled preliminary are not presented as settled final causes.
- Context links into the Explore catalog are **not** case evidence.
- No client scraping, third-party embeds, personal user location, automatic downloads or new live feeds.

## Catalog and consumers
- Canonical editorial cases and helpers: `lib/incidentLedger.mjs`.
- Machine-readable static export: `public/data/incident-ledger.v1.json`, preserving the v1 schema.
- New code should use `validateIncidentLibrary` before adding cases, verifying evidence references, timestamps and known related-case IDs.
- FieldPack v1 stays limited to public live-signal records.

## Validation
`npm test`, `npm run build`, `npm run test:browser`. Browser smoke covers both cases, the detailed timeline/source view, context disclaimers, and returning to Live Signals.
