# IPS source admission gate

The publisher explicitly permits credited title/headline syndication, excluding complete stories: https://www.ipsnews.net/rss-feeds/ (reviewed November 26, 2026 Pacific). The candidate feed https://www.ipsnews.net/news/headlines/feed/ returned an unsupported text/xml response to the web reader; robots.txt was inaccessible through that reader. Neither is evidence of direct HTTP success.

This PR adds a one-time, fixed-host probe, not an active source. GitHub Actions runs it on opening this same-repository PR (path filter) or on explicit manual dispatch. It makes at most one robots request and one feed request, no redirects or retries, with bounded bytes/deadlines and a publisher-delay gate. If robots cannot be read, or any group could disallow the path, the feed is not requested. The deliberately conservative matcher ignores Allow exceptions; ambiguous encoded or oversized rules require manual review. This is not a comprehensive RFC 9309 parser.

The feed is parsed with the existing strict XML parser; only aggregate receipt counts are emitted. Date candidates are not validated publication timestamps, and the probe does not assess editorial type, event geography, originality or corroboration. A successful transport check still requires review of the exact endpoint, attribution presentation, rate limits, mixed opinion/news handling and production adapter normalization before activation.

No source registry, cache, scheduled publisher, Pages deployment, or article body is changed. No raw XML or headlines are stored. The separate admission workflow intentionally fails when transport is blocked; ordinary CI remains deterministic. Do not bypass publisher restrictions or repeatedly trigger probes to force success.

Validation: five deterministic fixture tests added; live runner result and full CI remain separate gates.