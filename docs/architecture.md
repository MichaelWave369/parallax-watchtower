# Parallax Watchtower Architecture

## v0.1 shape

The first public build is intentionally simple:

```text
Public feeds -> browser/client adapter -> normalized signal records -> Lite Atlas map -> signal feed -> receipt drawer
```

## Signal record

Every event should carry:

- id
- type
- title / summary
- source
- source URL when available
- timestamp
- latitude / longitude when available
- confidence label
- privacy class
- raw facts when needed

## First adapters

- USGS earthquakes: live public GeoJSON feed
- Demo news: placeholder for GDELT/news adapter
- Demo markets: placeholder for market provider adapter

## Map strategy

v0.1 uses a canvas Lite Atlas so the app can work on devices where external map tiles, WebGL, CDNs, or browser rendering fail.

Later versions can add MapLibre as the primary map with Lite Atlas as fallback.

## Watch zones

Watch zones are radius lenses around places such as Corning, Mt. Shasta, Northern California, and the West Coast. Location is consent-based and should remain local unless the user explicitly saves or shares it.
