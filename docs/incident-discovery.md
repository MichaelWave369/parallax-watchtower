# WATCHTOWER Discovery Inbox · v1

## Purpose
**Incident Discovery Inbox** is a human-in-the-loop proposal staging area inside Watchtower Live. It does not create public incident cases automatically, does not assert root causes, and is not an active emergency advisory.

The dashboard already collects USGS earthquakes, NASA EONET curated wildfire metadata and GDELT news where accessible. The Inbox *reads those existing public signal records* without initiating any additional requests or ingesting private location data. People may also add a source-backed lead manually by supplying a title and HTTPS source link.

## Intake and filtering
- Only public signals with an HTTPS receipt, a valid timestamp from the prior 14 days (up to 6 hours future clock skew), and source confidence reported/verified_official may be offered as leads.
- Auto-generated quake nominations require magnitude >= 4.5. The threshold is an inbox noise-management rule, **not** an official emergency alert or claim of severe consequences.
- Wildfire entries remain NASA-curated *event references*, not perimeters, severity assessments or evacuation alerts.
- News entries require direct HTTPS article links; missing/approximate/demo/fallback records are excluded.
- Orbit predictions, markets, NOAA planetary Kp measurements, private/local data, saved zones and browser geolocation are never nominated.
- Queue additions are **manual user clicks**. Browser storage retains a bounded 80-item local inbox with deduplication by normalized source URL.

## Review workflow
- Statuses: Pending, Reviewing, Dismissed. These describe a researcher's workflow, **not** incident verification.
- Manual intake requires a title and HTTPS source URL; it does not invent a publication time, event time, location or provenance authority.
- Reviewer notes are local and limited. The user may explicitly copy or download a review packet.
- Export schema `phi.watchtower.incident-proposals.v1` contains only candidates, source receipts and workflow metadata; it never contains geocoordinates, private location or source error data.
- Published Incident Room cases remain hand-maintained in `lib/incidentLedger.mjs`, with independent editorial evidence and tests. Importing a review packet into Incident Room is **not supported** yet. No direct publishing, cloud sync or GitHub PR creation is performed.

## Follow-on work
A future server-side collector may summarize approved official public feeds into an unreviewed candidate file or PR, but it must validate licensing/rate limits, label source health, retain provenance, deduplicate, and require explicit review before promotion. Do not mislabel an HTTP response as a confirmed incident or claim any particular outage cause without documented sources.

## Verification
Run `npm test`, `npm run build`, `npm run test:browser`. Browser tests include offline/blocked-feed startup, manual nomination, queue review, and returning to the Lite Atlas.
