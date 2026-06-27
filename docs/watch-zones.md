# v0.1.8 Saved Watch Zones

Watchtower now supports browser-local saved watch zones.

## What it does

Users can create custom lenses with:

- Name
- Latitude
- Longitude
- Radius in kilometers

Saved zones are stored in the browser with `localStorage`. They are not uploaded to a server.

## Built-in lenses

The dashboard keeps the original built-in lenses:

- Corning Field Lens
- Mt. Shasta Watch Lens
- Northern California Lens
- West Coast Lens

## Local-only guardrail

Saved watch zones are convenience lenses. They do not enable hidden tracking, private location sharing, or person-targeting workflows.

## Field use

A watch zone is useful for:

- Home/local readiness
- Family places
- Mt. Shasta / regional watch
- Travel corridors
- Places the user explicitly chooses to monitor

## Ledger behavior

The status strip now shows the number of saved zones. The Alert Preview includes a Saved Zones count, and copied field reports include the saved-zone total.
