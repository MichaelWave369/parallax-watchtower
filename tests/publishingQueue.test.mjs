import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflows = ['pages.yml', 'news-cache.yml', 'orbital-catalog.yml', 'discovery-leads.yml'];
for (const filename of workflows) {
  test(`${filename}: shared Pages queue preserves pending cache/deploy runs and checks out current main`, () => {
    const yaml = readFileSync(new URL('../.github/workflows/' + filename, import.meta.url), 'utf8');
    assert.match(yaml, /^concurrency:\n  group: pages\n  queue: max\n  cancel-in-progress: false\s*$/m);
    assert.match(yaml, /if: github\.ref == 'refs\/heads\/main'/);
    assert.match(yaml, /uses: actions\/checkout@v4\n +with:\n +ref: main\n/);
    if (filename !== 'pages.yml') {
      assert.match(yaml, /ref: main\n +fetch-depth: 0\n/);
      assert.match(yaml, /git pull --rebase origin main\n +git push origin HEAD:main/);
      assert.doesNotMatch(yaml, /git push[^\n]*(?:--force| -f\b)/);
    }
  });
}
