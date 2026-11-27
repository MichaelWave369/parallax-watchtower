import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { NEWS_SOURCES } from '../lib/newsSources.mjs';
import { normalizeNewsRecord } from '../lib/newsContract.mjs';
import { validateBriefingCitations } from '../lib/newsIntelligence.mjs';

const local = 'http://127.0.0.1:4173';
function fixture() {
  const now = new Date().toISOString();
  const ago = hours => new Date(Date.now() - hours * 3600000).toISOString();
  const record = (id, sourceId, title, more = {}) => {
    const source = NEWS_SOURCES.find(s => s.id === sourceId);
    return normalizeNewsRecord({ id, sourceId, publisher: source.publisher, originGroup: source.originGroup,
      title, url: new URL('/news/' + id, source.url).toString(), summary: 'Synthetic browser-test fixture. Never shipped as news.',
      language: 'en', topics: ['science', 'research'], region: { code: 'GLOBAL', label: 'Location not specified', precision: 'global' },
      publishedAt: ago(2), eventAt: null, modifiedAt: null, retrievedAt: now,
      kind: 'official_statement', evidenceType: 'official_statement', privacyClass: 'public', demo: false, ...more });
  };
  const records = [
    record('test-nasa','nasa-news','TEST FIXTURE: Orbital observatory mission publishes first solar research data'),
    record('test-un','un-geneva','TEST FIXTURE: The orbital observatory mission publishes first solar research data', { publishedAt: ago(3) }),
    record('test-ecb','ecb-press','TEST FIXTURE: Central bank publishes quarterly economic outlook', { topics: ['economics'], publishedAt: ago(4) }),
    record('test-undated','arxiv-ai','TEST FIXTURE: Undated research announcement', { publishedAt: null, kind: 'research', evidenceType: 'uncorroborated_claim' }),
    record('test-html','nasa-news',"TEST FIXTURE: <img src=x onerror='window.compromised=true'> Published research notice", { publishedAt: ago(5) })
  ];
  const sources = NEWS_SOURCES.map(source => ({ id: source.id, status: 'ok', attemptedAt: now, lastSuccessAt: now,
    lastFailureAt: null, recordCount: records.filter(r => r.sourceId === source.id).length, message: 'Synthetic test retrieval receipt.', consecutiveFailures: 0, nextAttemptAt: null }));
  return { schema: 'phi.watchtower.news.v1', generatedAt: now, records, sources };
}
async function setup(page, { offline = false } = {}) {
  const external = [];
  await page.route('**/*', route => {
    if (route.request().url().startsWith(local)) return route.continue();
    external.push(route.request().url()); return route.abort('failed');
  });
  const data = fixture();
  await page.route('**/data/news.v1.json', route => offline ? route.fulfill({ status: 503, body: '{}' }) : route.fulfill({ json: data }));
  await page.route('**/data/news-health.v1.json', route => offline ? route.fulfill({ status: 503, body: '{}' }) : route.fulfill({ json: { schema: 'phi.watchtower.news-health.v1', generatedAt: data.generatedAt, sources: data.sources } }));
  await page.goto('/parallax-watchtower/');
  await expect(page.getByRole('heading', { name: 'Global Command', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh cache', exact: true })).toBeEnabled();
  return { data, external };
}
function desk(page, name) { return page.getByRole('complementary', { name: 'News desks' }).getByRole('button', { name: new RegExp(name) }); }
function inspector(page) { return page.getByRole('complementary', { name: 'Evidence inspector' }); }

test('default command center reads only shared cache, preserves unknown times, and renders hostile feed text safely', async ({ page }) => {
  const { external } = await setup(page);
  await expect(page.locator('.nr-story')).toHaveCount(4);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => window.compromised)).toBeUndefined();
  await expect(page.locator('.nr-story img')).toHaveCount(0);
  await page.getByLabel('News time window').selectOption('all');
  await expect(page.locator('.nr-story')).toHaveCount(5);
  await page.getByRole('button', { name: 'TEST FIXTURE: Undated research announcement', exact: true }).click();
  await expect(inspector(page).locator('dl')).toContainText('PublicationNot supplied');
  await expect(inspector(page).getByRole('link', { name: 'Read original source' })).toHaveAttribute('rel', 'noopener noreferrer');
  await desk(page, 'Source Observatory').click();
  await expect(page.locator('.nr-source')).toHaveCount(6);
  await expect(page.locator('.nr-source').first()).toContainText('License limits');
});

test('source-attributed report groups can be compared and separated without losing articles', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'TEST FIXTURE: Orbital observatory mission publishes first solar research data', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.nr-comparison article')).toHaveCount(2);
  await expect(page.locator('.nr-comparison')).toContainText('Independence not assessed');
  await inspector(page).getByText('Report grouping method', { exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Keep this report separate', exact: true }).click();
  await expect(page.locator('.nr-comparison article')).toHaveCount(1);
  await expect(page.locator('.nr-story')).toHaveCount(4);
  await inspector(page).getByRole('button', { name: 'Allow automatic grouping', exact: true }).click();
  await expect(page.locator('.nr-comparison article')).toHaveCount(2);
});

test('watchlist and research persist locally; public briefing and archive exports exclude private research', async ({ page }) => {
  await setup(page);
  await page.getByLabel('Search public records').fill('observatory');
  await page.getByRole('button', { name: '+ Watch search', exact: true }).click();
  await page.locator('.nr-story').first().getByRole('button', { name: /^Save report:/ }).click();
  await desk(page, 'Research Room').click();
  await expect(page.locator('.nr-story')).toHaveCount(1);
  await page.getByLabel('Research annotation type').selectOption('disputed');
  await page.getByLabel('Research annotation', { exact: true }).fill('PRIVATE_TEST_NOTE_369: inspect a conflicting statement before drawing a conclusion.');
  await page.getByLabel('Annotation evidence URL').fill('https://www.nasa.gov/source/counterevidence');
  await page.getByRole('button', { name: 'Save local annotation', exact: true }).click();
  await expect(page.locator('.nr-note')).toContainText('disputed');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('watchtower:news-workspace:v1')).notes.length)).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Research Room', exact: true })).toBeVisible();
  await expect(page.locator('.nr-note')).toContainText('PRIVATE_TEST_NOTE_369');
  await desk(page, 'Intelligence Brief').click();
  const briefPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON brief' }).click();
  const brief = JSON.parse(await readFile(await (await briefPromise).path(), 'utf8'));
  expect(validateBriefingCitations(brief)).toBe(true); expect(brief.items.length).toBeGreaterThan(0);
  expect(JSON.stringify(brief)).not.toContain('PRIVATE_TEST_NOTE_369');
  await page.getByText('Local history & portable data', { exact: true }).click();
  const archivePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export public archive', exact: true }).click();
  const archive = JSON.parse(await readFile(await (await archivePromise).path(), 'utf8'));
  expect(archive.scope.watchlistsIncluded).toBe(false);
  expect(JSON.stringify(archive)).not.toContain('PRIVATE_TEST_NOTE_369');
  expect(JSON.stringify(archive)).not.toContain('counterevidence');
  expect(JSON.stringify(archive)).not.toContain('watchtower:news-workspace');
});

test('source outages recover cached records after a fresh browser load without retiming them', async ({ page }) => {
  const { data } = await setup(page);
  await expect(page.locator('.nr-story')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => new Promise(resolve => {
    const req = indexedDB.open('watchtower-news-v1', 1);
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('state'); const get = tx.objectStore('state').get('archive'); tx.oncomplete = () => { db.close(); resolve(get.result?.length || 0); }; };
  }))).toBe(5);
  await page.route('**/data/news.v1.json', route => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/data/news-health.v1.json', route => route.fulfill({ status: 503, body: '{}' }));
  await page.reload();
  await expect(page.locator('.nr-story')).toHaveCount(4);
  await expect(page.getByText(/Source snapshot unavailable\. Showing previously stored/)).toBeVisible();
  await expect(inspector(page).locator('dl')).toContainText('Retrieval');
  const old = await page.evaluate(() => new Promise(resolve => {
    const req = indexedDB.open('watchtower-news-v1', 1); req.onsuccess = () => { const db = req.result; const tx = db.transaction('state'); const get = tx.objectStore('state').get('archive'); tx.oncomplete = () => { db.close(); resolve(get.result.map(row => row.retrievedAt)); }; };
  }));
  expect(old.every(value => value === data.generatedAt)).toBe(true);
});

test('offline first visit contains no invented headlines and the retained Lite Atlas works without WebGL', async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(kind, ...args) { if (String(kind).includes('webgl')) return null; return original.call(this, kind, ...args); }; });
  await setup(page, { offline: true });
  await expect(page.locator('.nr-story')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No reports in this view' })).toBeVisible();
  await page.getByRole('button', { name: 'Live signals', exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
  await expect(page.getByText(/fallback market pulse|Fallback news lens/i)).toHaveCount(0);
});

test('mobile layout, keyboard search, reduced motion and both themes pass accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.keyboard.press('/'); await expect(page.getByLabel('Search public records')).toBeFocused();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Toggle light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-news-theme', theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
  await desk(page, 'Research Room').click();
  await page.getByLabel('Public source title').fill('TEST FIXTURE manual source');
  await page.getByLabel('Public source URL (HTTPS)').fill('https://www.nasa.gov/manual/source');
  await page.getByRole('button', { name: 'Add public source to research' }).click();
  await expect(page.locator('.nr-story')).toHaveCount(1);
  await expect(page.locator('.nr-story')).toContainText('USER SUBMISSION');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('production policy blocks inline script execution while the newsroom remains usable', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(() => new Promise(resolve => {
    const timer = setTimeout(() => resolve({ blocked: false, executed: Boolean(window.__watchtowerInlineRan) }), 1500);
    document.addEventListener('securitypolicyviolation', event => {
      if (event.effectiveDirective.startsWith('script-src')) { clearTimeout(timer); resolve({ blocked: true, executed: Boolean(window.__watchtowerInlineRan) }); }
    }, { once: true });
    const script = document.createElement('script'); script.textContent = 'window.__watchtowerInlineRan=true'; document.head.appendChild(script);
  }));
  expect(result).toEqual({ blocked: true, executed: false });
  await page.getByLabel('Search public records').fill('economic');
  await expect(page.locator('.nr-story')).toHaveCount(1);
});

test('manual saved-source comparison stays attributed and note drafts cannot cross report boundaries', async ({ page }) => {
  await setup(page);
  const economic = page.locator('.nr-story').filter({ hasText: 'quarterly economic outlook' });
  await economic.getByRole('button', { name: /^Save report:/ }).click();
  await inspector(page).getByText('Local research annotations (0)', { exact: true }).click();
  await page.getByLabel('Research annotation', { exact: true }).fill('UNSAVED DRAFT FOR FIRST REPORT');
  await economic.getByRole('button', { name: 'TEST FIXTURE: Central bank publishes quarterly economic outlook', exact: true }).click();
  await expect(page.getByLabel('Research annotation', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'TEST FIXTURE: Orbital observatory mission publishes first solar research data', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByLabel('Compare saved evidence').selectOption('test-ecb');
  await expect(page.locator('.nr-comparison article')).toHaveCount(3);
  await expect(page.locator('.nr-comparison')).toContainText('User-selected comparison; no relationship is inferred.');
  await expect(page.locator('.nr-comparison')).toContainText('3 origin families. Independence not assessed');
});

test('coverage matrix exposes regional blind spots and shared record count', async ({page})=>{
 await setup(page);
 await desk(page,'Source Observatory').click();
 const matrix=page.getByRole('region',{name:'Planetary coverage matrix'});
 await expect(matrix).toBeVisible();
 await expect(matrix.locator('.nr-coverage-cell').filter({hasText:'Africa'}).first()).toContainText('No dedicated remit');
 await expect(matrix.locator('.nr-coverage-cell').filter({hasText:'Global / space'})).toContainText('4 declared feed(s)');
 await expect(matrix).toContainText('5 recently retrieved records of 5');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
