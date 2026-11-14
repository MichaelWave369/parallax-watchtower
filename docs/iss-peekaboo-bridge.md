# WATCHTOWER LIVE: ISS + Peekaboo public-view bridge

## ISS provider
- Provider: Where the ISS at? (https://docs.wheretheiss.at/w/developer).
- Endpoint: https://api.wheretheiss.at/v1/satellites/25544
- Sampling: existing WATCHTOWER one-minute refresh cadence; no artificial animation or prediction.
- Meaning: third-party ground-track sample for NORAD 25544, **not NASA telemetry** or an ISS camera.
- Stale policy: suppress observations older than ten minutes or more than two minutes ahead of client clock.
- Failure policy: no phantom ISS coordinate; show adapter failure or stale state in source ledger.
- Only the ISS is integrated, not a full satellite catalog.

## Peekaboo bridge
- Opens the current lens via Peekaboo's documented public hash: #map=zoom/lat/lon&layers=&mode=public.
- Explicitly public views, not surveillance scans; location is passed in a URL only on a user click.
- Neither app scrapes the other or merges unverifiable camera feeds.

## Next
A versioned shared adapter contract, rate-limited/cache-safe satellite catalogs with orbital propagation, and separately vetted aviation/maritime providers.
