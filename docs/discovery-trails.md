# Cross-source Discovery Trails v1

## Why a temporal lens?

Watchtower's first official-source cache contained 25 USGS earthquake candidates and six NASA EONET wildfire references. Their recorded UTC days did not overlap in that snapshot. Comparing only exact dates would yield no mixed-source results, and claiming that weather, wildfire and seismic events were connected merely because they shared a day would be unsupported.

The **Cross-source Discovery Trails** view groups public, source-receipted candidate records into explicitly defined UTC windows:

- UTC day: exact UTC calendar date.
- UTC week: Monday 00:00 UTC to Sunday 23:59:59 UTC, **not** an arbitrary sliding window.

A window can contain records from USGS, NASA EONET, or both. Two-source windows represent only time-bucket co-occurrence, not geography, mechanism, correlation, causal effects, risk, disaster severity, or an automatically verified Incident Room case.

## Data boundary

The view uses the existing published `phi.watchtower.discovery-cache.v1` snapshot only after it has passed source-validation and freshness gating. It does **not** call upstream APIs independently, request the user's location, access private watch zones, infer coordinates from titles, create new network activity or alter a historical case.

Source record timestamps are not interchangeable: USGS timestamps are earthquake event records, while EONET event geometry timestamps are curated observations and are **not necessarily ignition times**. The UI makes this distinction explicit.

## Controls

- Switch UTC day/week and pick a time-bucket.
- See separate USGS and NASA lists, counts, timestamps and **direct original HTTPS receipts**.
- Manually queue selected entries into the already-existing local Discovery Inbox.
- Copy a source-backed timeline or explicitly download a research packet, schema `phi.watchtower.temporal-trails.v1`. The packet carries source receipt URLs and an explicit uncertainty notice. It does not carry private coordinates, personal location or case-publication flags.

## Implementation

- `lib/discoveryTrails.mjs`: pure grouping and bounded packet-building logic, with hard-coded permitted source hostnames and receipt deduplication.
- `components/DiscoveryTrails.tsx`: responsive interactive comparison UI.
- `tests/discoveryTrails.test.mjs`: date and week grouping, misattribution guardrails, duplicate/unsafe-link filtering, and research packet scope.
- `e2e/startup.smoke.spec.mjs`: browser-only mock of the published cache to assert exact-day separation vs shared-week grouping, queueing and the Lite Atlas fallback.

There is no relation-scoring engine yet, deliberately. Real cross-source *associations* should be proposed only when explicit location or named-system evidence from authorized providers is available and should require human review. Time proximity alone is an exploration affordance, **not evidence of connection**.
