# WATCHTOWER LIVE | Basemap 403 repair and marker clustering

## Root cause
The old `ActualMapCanvas` assigned `img.referrerPolicy = "no-referrer"` before requesting community-funded `tile.openstreetmap.org` raster tiles. OpenStreetMap's [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) requires a website Referer and caching/visible attribution; the screenshot exhibited OSM's explicit Access Blocked tile art. The implementation also created fresh Image objects on every 60-second signal refresh and marker selection.

## Fix
- The primary **Map** mode now uses **MapLibre GL JS + OpenFreeMap's Dark vector style**: `https://tiles.openfreemap.org/styles/dark`. OpenFreeMap's public instance is a published, no-key service with its own terms. No calls are made to OSMF's `tile.openstreetmap.org` server.
- Local **Lite Atlas** mode contains a dark grid, coordinates and markers, **with zero third-party tile requests**. It is available via a button, and is the automatic fallback when WebGL or vector map loading fails.
- Existing orthographic **Globe** stays available.
- MapLibre's GeoJSON source uses built-in visual clustering with expandable clusters at low zoom; all valid mapped signals can be displayed without cutting the list to 900.
- Source type colors remain, with satellite `orbit` clearly modeled/predicted and EONET wildfire points not perimeters.
- Vector styling loads once per mounted map, while GeoJSON data updates on the one-minute feed refresh without rebuilding or re-downloading the basemap.
- All external OSM-derived data gets persistent visible attribution for **OpenFreeMap, OpenMapTiles, and OpenStreetMap contributors**, including license link.
- A pure adapter filters private, demo/fallback and invalid-coordinate records before rendering. Unit tests verify safety and mapping semantics.

## Policy and limitations
- [OpenFreeMap public instance](https://openfreemap.org/) explicitly offers key-free map views but no SLA; consider support/donations if usage grows.
- [MapLibre GL](https://maplibre.org/maplibre-gl-js/docs/) runs in browsers with WebGL. Older/incompatible devices can use **Lite Atlas**.
- If the OpenFreeMap service fails, the app falls back to Lite Atlas rather than showing blocked raster tile imagery.
- WATCHTOWER does not run an imagery scraping proxy, pre-download tiles, bypass origin headers or impersonate another client.
- Cluster markers summarize coincident public records at this zoom; expanding or selecting a marker opens the original evidence receipt.

## Acceptance
1. Default map uses OpenFreeMap vector tiles, with no black/yellow 403 OSM imagery.
2. Zoom in on clusters to separate individual events and click one to open event receipt.
3. Test **Globe** and **Lite Atlas** modes.
4. Check attribution at map bottom right.
5. Open Chrome Network tab and confirm **no requests to tile.openstreetmap.org**.
6. On WebGL failure or vector source error, see Lite Atlas without losing source feed/receipts.
