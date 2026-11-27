# Planetary Observatory: federation capacity gate

Baseline: merged publishing fix, main `7c9fd095dfd375ab85221f68688ef746237e2402`. The first post-merge [news workflow](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45926818780) succeeded but its actual collector log said the cache was within source cooldowns and made no provider calls or writes. It verified publishing, not a new upstream collection.

## Capacity defect and change

36 adapters at 30 records each can produce 1,080 records; the v1 snapshot accepts 600. The previous collector flattened batches then truncated them without correcting per-source counts, so saturation could invalidate the entire snapshot. Truncation also favored early registry entries.

The candidate uses deterministic round-robin allocation from each already sorted batch, returns exactly the published counts, and preserves timestamps and record identity. At full 36 x 30 saturation, all 36 sources contribute 16 or 17 records. Short/empty batches release capacity to others. Registry order breaks ties for the final partial round. Source health recordCount continues to mean published records, not upstream response volume. Existing schema caps, cooldowns, request bounds, policies, and last-good failure behavior remain. This is bounded coverage, not a claim of equal editorial importance.

## Source admission research (2026-11-26 Pacific)

- Global Voices English: https://globalvoices.org/feed/ returned an RSS content type to the web inspection tool but the tool could not parse the body. The publisher policy page https://globalvoices.org/about/global-voices-attribution-policy/ could not be retrieved. Creative Commons case study https://wiki.creativecommons.org/Case_Studies/Global_Voices_Online describes attribution-based sharing, but is not a substitute for current primary terms. Spanish endpoint https://es.globalvoices.org/feed/ could not be fetched. Both remain candidates only, with one shared publisher/origin group if admitted; translations are not independent confirmations.
- Le Monde: https://www.lemonde.fr/en/about-us/article/2026/03/27/le-monde-rss-feeds_6751860_115.html explicitly limits RSS use to personal nonprofessional noncollective use absent paid authorization. Not admitted.
- The Conversation: https://theconversation.com/us/republishing-guidelines is a candidate for further primary policy and Atom transport review. Attribution/no-derivatives conditions and author credit need to be checked against the metadata schema and intended use. Not admitted.

Do not activate any of these on the basis of this note. Require current primary permission, documented attribution, fixed HTTPS endpoint, direct status/content-type/receipt/parser checks, and rate-limit review before enabling. No new public source or synthetic production record is introduced.

## Validation

Pure allocator executed on 36 saturated batches, under-budget and empty batches, and uneven batch redistribution in the connected execution environment. The added Node regression suite includes actual v1 snapshot validation, deterministic allocation, reference preservation and invalid budgets. Full remote CI and production collection remain separate gates.
