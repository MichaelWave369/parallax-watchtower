# v0.1.6 Source Proxy Strategy

GitHub Pages is excellent for a static public dashboard, but browser-based public-data pulls can fail because some providers do not allow cross-origin requests from arbitrary sites.

The Watchtower pattern is:

```text
Static dashboard -> tiny source proxy -> public source API -> normalized signal records
```

## Why this exists

- Keep the public dashboard fast and simple.
- Avoid putting secrets or provider keys in the browser.
- Let source adapters add caching, source health, and safer error handling.
- Keep the Ledger visible when a source fails.

## Current proxy

This repo includes a Netlify function:

```text
netlify/functions/gdelt-proxy.mjs
```

When deployed to Netlify, it exposes:

```text
/.netlify/functions/gdelt-proxy
```

The function forwards a limited GDELT DOC 2.0 article-list request and returns JSON with permissive CORS headers for the public dashboard.

## Static dashboard behavior

The GitHub Pages build can stay online as the public static field console. A later sprint can add a user-configurable proxy URL in the UI so the dashboard tries:

1. Direct GDELT browser pull
2. Configured proxy URL
3. Safe fallback news card

## Guardrail

The proxy should only forward public source data. It should not add private tracking, hidden user location, private camera feeds, or person-targeting workflows.
