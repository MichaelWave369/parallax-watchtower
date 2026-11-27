# IPS source admission gate

The publisher explicitly permits credited title/headline syndication, excluding complete stories: https://www.ipsnews.net/rss-feeds/ (reviewed November 26, 2026 Pacific). The candidate feed https://www.ipsnews.net/news/headlines/feed/ returned an unsupported text/xml response to the web reader; robots.txt was inaccessible through that reader. Neither is evidence of direct HTTP success.

This PR adds a one-time, fixed-host probe, not an active source. GitHub Actions runs deterministic tests on relevant pull request changes. The live probe runs only on explicit manual dispatch, after those tests pass. It makes at most one robots request and one feed request, no redirects or retries, with bounded bytes/deadlines and a publisher-delay gate. If robots cannot be read, or any group could disallow the path, the feed is not requested. The deliberately conservative matcher ignores Allow exceptions; ambiguous encoded or oversized rules require manual review. This is not a comprehensive RFC 9309 parser.

The feed is parsed with the existing strict XML parser; only aggregate receipt counts are emitted. Date candidates are not validated publication timestamps, and the probe does not assess editorial type, event geography, originality or corroboration. A successful transport check still requires review of the exact endpoint, attribution presentation, rate limits, mixed opinion/news handling and production adapter normalization before activation.

No source registry, cache, scheduled publisher, Pages deployment, or article body is changed. No raw XML or headlines are stored. The manual live admission job intentionally fails when transport is blocked; pull-request checks remain deterministic. A skipped live job is not source approval. Do not bypass publisher restrictions or repeatedly trigger probes to force success.

Validation: five deterministic fixture tests added; live runner result and full CI remain separate gates.

## Observed first runner result

[Admission run 45930666638](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45930666638), head `ad14d214bb891cd0103300a671e678e0b4e9e3a9`, passed all five fixture tests. Its live probe returned `state: blocked`, `stage: robots`, `productionEnabled: false`, and `reason: Transport or parsing failed`, then correctly exited 1. No feed request or feed metadata success is established. The generic diagnostic does not establish whether DNS, TLS, a network failure, or an unreadable policy caused the block.

The workflow now separates deterministic PR tests from the manual live admission gate. The original failed receipt remains valid and is not superseded by green code tests. No exit-code suppression, retry, network workaround, production adapter activation, cache publication, or source policy bypass was introduced. Do not manually repeat the probe until access and publisher policy can be reviewed.
