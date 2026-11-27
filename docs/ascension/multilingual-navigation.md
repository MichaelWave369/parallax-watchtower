# Planetary Observatory: multilingual navigation

Adds composable language and publisher-feed filters to the existing newsroom and briefings. Options reflect the current local archive; a saved selection absent from the archive remains visibly selected rather than silently broadening results. Existing preferences migrate to all languages and publishers. Saved views retain both dimensions, desk changes and archive reset clear them, and the user-selected filters remain local. Publisher filter keys are source IDs, not a claim of editorial independence.

Search uses Unicode NFC and locale-independent lowercase matching while retaining literal AND terms and original text. This handles canonically equivalent accented strings, not translation, transliteration or accent-insensitive search. Headline language/direction attributes support browser and assistive technology rendering. No new source, article content, external translation service or production network request is introduced. Current live federation remains English; browser tests use explicitly synthetic Spanish metadata.

Two unit tests and one browser test added. Full CI remains the acceptance gate.