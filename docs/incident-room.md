# Incident Room · Evidence Ledger v1

This adds a manually sourced historical case room inside WATCHTOWER LIVE. The first recorded case covers the November 13, 2026 FAA ground stop, using only U.S. Department of Transportation statements from November 13 and 14.

## Evidence model
- **Officially confirmed** = event/status confirmed in a named official statement.
- **Officially reported** = details as attributed to an official statement, not independently established telemetry.
- **Preliminary account** = investigation hypotheses that might change.
- Dates with no cited exact time are shown explicitly as **time not specified**.
- Every event carries one or more source IDs mapping to HTTPS evidence receipts.
- Context research portals link to separate websites and **are not supporting evidence** of the incident.
- Not a live FAA API, not flight-tracking history, and not a real-time safety alert. Never use it to infer flight safety or operational status after the as-of date.

## Export and privacy
- `lib/incidentLedger.mjs`: canonical editorial case and readable brief builder.
- `public/data/incident-ledger.v1.json`: static versioned snapshot for optional PhiOS and PhiDiscovery consumers.
- Copy brief is user-initiated, and includes per-event source receipts.
- No tracking pixels, third-party script embeds, browser location, saved watch zones or automatic uploads.
- Incident Room data does **not** enter `phi.fieldpack.v1` because that format remains for active, public feed signal records.

## Verification
Run `npm test`, `npm run build`, `npm run test:browser`. The browser smoke covers opening Incident Room and navigating timeline, evidence, contextual references and back to the default Lite Atlas.

## Future case work
New cases must be checked against their primary source and given explicit as-of dates. Only introduce data adapters after API permission, rate limits, retention and provenance are reviewed.
