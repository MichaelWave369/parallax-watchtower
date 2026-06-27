# v0.1.7 Proxy-Aware News Mode

The dashboard now supports an optional news proxy URL.

## Why

Some public data APIs work from server-side environments but fail from browser-only GitHub Pages builds because of CORS or provider restrictions. Watchtower should fail safely, but it should also support a clean upgrade path.

## Runtime order

When loading news signals, the app now attempts:

```text
1. Saved proxy URL, if configured
2. Direct GDELT browser request
3. Safe fallback news record
```

## How to use

Deploy the included Netlify function, then paste its URL into the dashboard's News Proxy Mode field:

```text
https://your-site.netlify.app/.netlify/functions/gdelt-proxy
```

Click Save proxy, then let the next refresh run or reload the page.

## Ledger behavior

The Source Ledger records whether the news source used:

- Proxy GDELT News Adapter
- Direct GDELT News Adapter
- Fallback News Adapter

The field report also notes whether a proxy is configured.

## Guardrail

The proxy is only for public source data. It must not forward private tracking, private camera feeds, person-targeting queries, or hidden user location.
