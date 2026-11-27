# Ascension 02: shared publishing queue

## Observed incident

On 2026-11-27 UTC, the first public-news refresh ([run 45919526853](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45919526853)) was cancelled before any jobs were recorded. The orbital refresh associated with the same main commit was also cancelled. All four publishing workflows shared the `pages` concurrency group with `cancel-in-progress: false`, but no explicit pending queue. GitHub's default concurrency behavior keeps only one pending run and replaces it when another enters the group. This is a concrete configuration defect consistent with the cancellations; the API does not establish who or what cancelled that specific run.

## Repair

- Keep all four workflows serialized in the same group, with GitHub's documented `queue: max` option (up to 100 waiting runs). Do not cancel an active run. This avoids default single-pending replacement.
- Check out current main when execution begins, rather than building the potentially old triggering SHA after a queue delay. Pages builds are restricted to main, including manual dispatches.
- Cache writers fetch full history and rebase onto origin/main immediately before a normal, non-forced push. A conflict or rejected push stops the workflow; no automatic conflict overwrite or provider retry is introduced.
- Keep provider cooldowns, fixed endpoints, existing cron schedules, health sidecars and publication semantics unchanged.
- A queued workflow may publish a newer main revision than its triggering SHA. For diagnosis, compare the actual checkout and cache commit logs rather than interpreting the event SHA as the artifact SHA.

Reference: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency

## Acceptance and limitations

The new Node regression tests check all four workflow declarations. They are configuration guards, not a hosted scheduler simulation. After review and authorized merge, confirm GitHub accepts the queue syntax, inspect the initial news refresh and the next scheduled cycle, confirm current metadata and health are published, and check that simultaneous pending runs are retained. Queue capacity is finite; manual cancellations, provider failures and push conflicts remain possible. No live collection, deployment, or physical-GPU verification is implied by this PR.
