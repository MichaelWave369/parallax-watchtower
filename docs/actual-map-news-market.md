# v0.2.0 Actual Map + News + Market

Watchtower now renders an actual map background under the signal layer.

## Map

The field map uses OpenStreetMap raster tiles drawn onto the existing canvas. This keeps the Android-safe canvas overlay model while giving the dashboard real geographic context.

If tiles fail, the signal overlay still renders on the dark Lite Atlas background.

## News

The news adapter still follows the safe order:

```text
1. Saved proxy URL, if configured
2. Direct GDELT browser request
3. Safe fallback news card
```

The Source Ledger records which path passed or failed.

## Market

The market layer now tries a public CoinGecko snapshot for:

- BTC
- ETH
- SOL

If the market source fails, Watchtower uses a fallback market card and marks the source down in the Source Ledger.

## Guardrails

- Public sources only
- Market data is a snapshot, not financial advice
- News place lensing is approximate unless a source provides precise location
- The canvas map is for situational awareness, not precision navigation
