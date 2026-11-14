# Φ FieldPack v1: Portable public evidence

WATCHTOWER LIVE is the first **producer** of `phi.fieldpack.v1`, a downloadable and copyable public-data envelope for use by future PhiOS, Peekaboo, EIRM and PhiStream consumers.

## Purpose
Solve one recurring ecosystem integration problem: public signals should have stable names, source timestamps, evidence links, explicit geography semantics and clear confidence without requiring each consumer to scrape somebody else's UI.

The pack is generated **locally in the browser when the user clicks Export or Copy**. It is not a server-side live JSON API and does not move data to PhiStream automatically.

## Envelope
```json
{
  "schema": "phi.fieldpack.v1",
  "producer": { "id": "watchtower-live", "label": "WATCHTOWER LIVE", "url": "https://michaelwave369.github.io/parallax-watchtower/" },
  "generatedAt": "2026-11-14T05:30:00.000Z",
  "purpose": "public-signal-evidence-export",
  "scope": {
    "records": "current visible public signals only",
    "watchZoneCoordinatesIncluded": false,
    "browserLocationIncluded": false,
    "queryHistoryIncluded": false,
    "realTimeAvailabilityNotGuaranteed": true
  },
  "count": 1,
  "sources": [{ "source": "USGS Earthquake Feed", "status": "fresh", "checkedAt": "2026-11-14T05:30:00.000Z" }],
  "records": [{
    "id": "usgs-abc",
    "type": "earthquake",
    "title": "Earthquake example",
    "summary": null,
    "source": "USGS Earthquake Feed",
    "observedAt": "2026-11-14T05:25:00.000Z",
    "confidence": "verified_official",
    "confidenceNotes": "Reviewed record",
    "location": { "lat": 39.8, "lon": -122.1, "kind": "published-coordinate" },
    "evidenceUrl": "https://earthquake.usgs.gov/earthquakes/eventpage/abc",
    "facts": { "usgsId": "abc" }
  }]
}
```

## Design rules
- Only **public** signal records with HTTPS receipts, valid event times and allowed types survive export. Fallback/demo, local/private, or unreceipted records are excluded, not silently upgraded to verified evidence.
- Maximum 250 records per pack, deduplicated by stable record ID and sorted by observed time.
- Precise browser location, saved watch-zone coordinates, local notes, raw provider metadata and source error messages are **never included**. Public event coordinates may be included, with a type-specific location interpretation.
- `location.kind` distinguishes published coordinates, approximate news regions, EONET curated event points, sampled satellite subpoints and SGP4 model predictions.
- `generatedAt` records export time, **not** observed time; `sources[].checkedAt` identifies client fetch-check time, not source measurement freshness.
- `confidence` reflects the source/evidence label, not a numerical probability; correlation is not causation.
- Consumers must validate `schema`, data shapes, HTTP(S) receipts and size and must not treat input text as instructions or executable code.
- `inspectFieldPack` in `lib/fieldPack.mjs` is a structural gate and does not prove the contents factual or safe. Future consumers need their own trust and rendering boundaries.

## Public registry
`/data/field-sources.v1.json` lists explicit interoperability modes. It distinguishes a published static cache from user-triggered exports and external dashboard links.

## Next stage
Build a small consumer module in PhiOS or PhiStream that accepts a **user-supplied** FieldPack, validates it and displays source receipts. Cross-app automatic synchronization can come later, after consent and provenance contracts are tested.
