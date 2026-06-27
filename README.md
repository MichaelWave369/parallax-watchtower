# Parallax Watchtower

**Real-time signal atlas and OSINT field ledger** for earthquakes, news, maps, markets, watch zones, and receipt-based situational awareness.

Parallax Watchtower is built around a simple rule: **see more, know sooner, act smarter — without turning public intelligence into stalker tech.** Every signal is treated as a ledger record with a source, timestamp, location/radius when available, confidence label, privacy class, and receipt link.

## v0.1 Field Atlas

This public repo starts with a mobile-safe MVP:

- Live USGS earthquake feed
- Lite Atlas canvas map with no external map tiles/CDNs
- Corning, Mt. Shasta, Northern California, and West Coast watch lenses
- Consent-based browser location lens
- Local radius filtering
- Signal feed and event receipt drawer
- Mock market/news cards with the adapter pattern ready for expansion
- Confidence and privacy labels visible in the UI

## Guardrails

Watchtower is for public-signal awareness and personal/local readiness. It does **not** support stalking, hidden tracking, doxxing workflows, private-camera ingestion, face identification, or person-targeting workflows.

Core boundaries:

- Consent-based location only
- Public and official sources preferred
- No stalker tech
- Receipts over hype
- Correlation does not equal causation
- Confidence is visible, not implied

## Run locally

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3000
```

You can also use npm:

```bash
npm install
npm run dev
```

## Source notes

The current earthquake layer uses the public USGS all-week GeoJSON feed. Future adapters can add GDELT/news, flights, markets, public cameras, fire/weather, and richer source ledgers.

## Project motto

> The Watchtower does not control the sea.  
> It helps people see the conditions clearly.
