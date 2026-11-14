# Watchtower Live · Explore source catalog v1

The **Explore** workspace is a searchable, category-filtered collection of 50 user-supplied internet exploration sites. It complements the live signal dashboard rather than replacing it.

## Safety and provenance

- The links are user-curated starting points; their availability, licensing, CORS behavior, live updates and API access have **not** been verified.
- Entries are classified as `external-link` with `verification: not-checked`, not as integrated source adapters.
- Every destination opens on deliberate user action in a separate tab using `rel="noopener noreferrer"`. No third-party pages, cameras or scripts are silently embedded, requested or scraped.
- The Explore catalog does **not** add records to Watchtower's public signal ledger or FieldPack v1, and does not imply that a tracking site provides unrestricted live data.
- Search and category selection are local browser interactions, with no analytics, geolocation or external query submission.
- The existing signal workspace remains the startup default and preserves all current consent, source-ledger and Lite Atlas fallback behavior.

## Versioned data

The canonical source metadata is in `lib/exploreCatalog.mjs`. A static, consumer-readable snapshot is published as `public/data/explore-sources.v1.json`, available under the GitHub Pages base path. The static snapshot is **not** an upstream data feed.

## Next steps

1. Link-check sources periodically with a conservative request policy; mark unavailable links without pretending they are healthy.
2. Review license, attribution, API access and CORS per provider before implementing optional adapters.
3. Add explicitly source-receipted discovery trails, with human-reviewed cross-links rather than causal claims.
4. Define an optional consumer contract for PhiDiscovery and PhiOS without leaking local watch-zone data.

## Verification

Run `npm test`, `npm run build`, and `npm run test:browser`. The Playwright Explore smoke test exercises the new workspace with external requests blocked.
