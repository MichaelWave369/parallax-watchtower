import { test, expect } from '@playwright/test';
import { NEWS_SOURCES } from '../lib/newsSources.mjs';
import { normalizeNewsRecord } from '../lib/newsContract.mjs';
import { makeNewsArchive } from '../lib/newsWorkspace.mjs';

const origin = process.env.WATCHTOWER_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const entry = origin + '/parallax-watchtower/';
function fixture({ stale = false } = {}) {
  const generatedAt = new Date(Date.now() - (stale ? 48 : 0) * 3600000).toISOString();
  const publishedAt = new Date(Date.parse(generatedAt) - 2 * 3600000).toISOString();
  const records = [
    ['security-one', 'TEST FIXTURE: Observatory archive release'],
    ['security-two', 'TEST FIXTURE: Lunar instrument workshop announcement']
  ].map(([id, title]) => normalizeNewsRecord({ id, title, sourceId: 'nasa-news', publisher: 'NASA',
    originGroup: 'nasa', url: 'https://www.nasa.gov/news/' + id, summary: 'Synthetic security regression fixture; never shipped as current news.',
    language: 'en', topics: ['science'], region: { code: 'GLOBAL', label: 'Location not specified', precision: 'global' },
    publishedAt, eventAt: null, modifiedAt: null, retrievedAt: generatedAt,
    kind: 'official_statement', evidenceType: 'official_statement', privacyClass: 'public', demo: false }));
  return { schema: 'phi.watchtower.news.v1', generatedAt, records, sources: NEWS_SOURCES.map(source => ({
    id: source.id, status: 'ok', attemptedAt: generatedAt, lastSuccessAt: generatedAt, lastFailureAt: null,
    recordCount: records.filter(row => row.sourceId === source.id).length, message: 'Synthetic test retrieval receipt.',
    consecutiveFailures: 0, nextAttemptAt: null
  })) };
}
async function load(page, data = fixture()) {
  const externalRequests = [], browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    externalRequests.push(url); return route.abort('failed');
  });
  await page.route('**/data/news.v1.json', route => route.fulfill({ json: data }));
  await page.route('**/data/news-health.v1.json', route => route.fulfill({ json: {
    schema: 'phi.watchtower.news-health.v1', generatedAt: data.generatedAt, sources: data.sources
  } }));
  await page.goto(entry);
  await expect(page.getByRole('heading', { name: 'Global Command', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh cache', exact: true })).toBeEnabled();
  return { externalRequests, browserErrors };
}
const desk = (page, name) => page.getByRole('complementary', { name: 'News desks' }).getByRole('button', { name: new RegExp(name) });

test('malformed shared cache rejects the whole snapshot without displaying a safe-looking subset', async ({ page }) => {
  const payload = fixture();
  payload.records[1].url = 'javascript:window.compromised=true';
  const result = await load(page, payload);
  await expect(page.locator('.nr-story')).toHaveCount(0);
  await expect(page.getByText('The source snapshot failed validation. Showing previously stored public records, if available.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No reports in this view', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.compromised)).toBeUndefined();
  expect(result.externalRequests).toEqual([]); expect(result.browserErrors).toEqual([]);
});

test('manual nominations reject executable, credentialed and private destinations before saving or fetching', async ({ page }) => {
  const result = await load(page);
  await desk(page, 'Research Room').click();
  await page.getByLabel('Public source title', { exact: true }).fill('TEST FIXTURE: unsafe nomination');
  for (const url of ['javascript:window.compromised=true', 'https://user:secret@www.nasa.gov/private', 'https://127.0.0.1/private', 'https://localhost/private']) {
    await page.getByLabel('Public source URL (HTTPS)', { exact: true }).fill(url);
    await page.getByRole('button', { name: 'Add public source to research', exact: true }).click();
    await expect(page.getByText('Use a public HTTPS receipt, a title, and an optional valid past publication date.')).toBeVisible();
    await expect(page.locator('.nr-story')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.compromised)).toBeUndefined();
  expect(result.externalRequests).toEqual([]); expect(result.browserErrors).toEqual([]);
});

test('hostile archive import is atomic and accepted imports cannot impersonate provider verification', async ({ page }) => {
  const result = await load(page);
  await expect(page.locator('.nr-story')).toHaveCount(2);
  const safe = fixture().records[0];
  const untrusted = { ...safe, id: 'hostile-import-safe', title: 'TEST FIXTURE: External archive claim',
    url: 'https://www.nasa.gov/news/import-claim', canonicalUrl: 'https://www.nasa.gov/news/import-claim',
    evidenceType: 'primary_documentation', privateNote: 'PRIVATE_IMPORT_SENTINEL_369' };
  const rejected = makeNewsArchive([untrusted]);
  rejected.records.push({ ...untrusted, id: 'hostile-import-bad', url: 'javascript:window.compromised=true' });
  await page.getByText('Local history & portable data', { exact: true }).click();
  const fileInput = page.locator('.nr-storage input[type="file"]');
  await fileInput.setInputFiles({ name: 'hostile-archive.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(rejected)) });
  await expect(page.getByText('The archive contains an unsafe or malformed record. Nothing was imported.')).toBeVisible();
  await expect(page.locator('.nr-story')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'TEST FIXTURE: External archive claim', exact: true })).toHaveCount(0);

  const accepted = makeNewsArchive([untrusted]);
  await fileInput.setInputFiles({ name: 'untrusted-public-archive.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(accepted)) });
  await expect(page.getByText('1 public records imported as unreviewed user submissions. Personal notes were not imported.')).toBeVisible();
  await expect(page.locator('.nr-story')).toHaveCount(3);
  const story = page.locator('.nr-story').filter({ hasText: 'TEST FIXTURE: External archive claim' });
  await expect(story).toContainText('Imported · NASA');
  await expect(story).toContainText('USER SUBMISSION');
  await expect(story).toContainText('uncorroborated claim');
  await story.getByRole('button', { name: 'TEST FIXTURE: External archive claim', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Evidence inspector' })).toContainText('Source-attributed · not independently verified');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('watchtower:news-workspace:v1')).notes)).toEqual([]);
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE_IMPORT_SENTINEL_369');
  expect(result.externalRequests).toEqual([]); expect(result.browserErrors).toEqual([]);
});

test('denied localStorage and IndexedDB leave a usable in-memory newsroom', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'indexedDB']) Object.defineProperty(window, name, {
      configurable: true, get() { throw new DOMException('Storage disabled by test policy', 'SecurityError'); }
    });
  });
  const result = await load(page);
  await expect(page.locator('.nr-story')).toHaveCount(2);
  await expect(page.locator('.nr-notice').filter({ hasText: /cannot be saved|Local history is unavailable/ })).toBeVisible();
  await page.getByLabel('Search public records', { exact: true }).fill('observatory');
  await page.getByRole('button', { name: '+ Watch search', exact: true }).click();
  await desk(page, 'My Watchlist').click();
  await expect(page.locator('.nr-story')).toHaveCount(1);
  await expect(page.locator('.nr-story')).toContainText('Observatory archive release');
  expect(result.externalRequests).toEqual([]); expect(result.browserErrors).toEqual([]);
});

test('source observatory distinguishes stale retrieval from successful historical fetch and links exact policies', async ({ page }) => {
  const result = await load(page, fixture({ stale: true }));
  await expect(page.locator('.nr-status')).toContainText('STALE / NO CURRENT SNAPSHOT');
  await desk(page, 'Source Observatory').click();
  await expect(page.locator('.nr-source')).toHaveCount(6);
  await expect(page.locator('.nr-source .nr-tag')).toHaveText(Array(6).fill('stale snapshot'));
  for (const source of NEWS_SOURCES) {
    const card = page.locator('.nr-source').filter({ has: page.getByRole('heading', { name: source.name, exact: true }) });
    await expect(card).toContainText('Last success'); await expect(card).toContainText('License limits');
    await expect(card.getByRole('link', { name: 'Provider documentation' })).toHaveAttribute('href', source.policyUrls[0]);
    await expect(card.getByRole('link', { name: 'Usage policy' })).toHaveAttribute('href', source.policyUrls[source.policyUrls.length - 1]);
  }
  await expect(page.getByText(/Adapter availability describes retrieval. It is not a rating/)).toBeVisible();
  expect(result.externalRequests).toEqual([]); expect(result.browserErrors).toEqual([]);
});

test('legacy atlas controls survive denied writes, reject invalid lenses, and retain direct news with a corrupt saved proxy', async({page})=>{
  await page.addInitScript(()=>{
    const originalGet=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){return key==='watchtower:gdeltProxyUrl'?'javascript:invalid-stored-proxy':originalGet.call(this,key);};
    Storage.prototype.setItem=function(){throw new DOMException('Writes disabled by test policy','QuotaExceededError');};
    Storage.prototype.removeItem=function(){throw new DOMException('Writes disabled by test policy','SecurityError');};
  });
  const {externalRequests,browserErrors}=await load(page);
  await page.getByRole('button',{name:'Live signals',exact:true}).click();
  await expect(page.locator('.status-strip').getByText('Feeds loaded',{exact:true})).toBeVisible();
  expect(externalRequests.some(url=>url.startsWith('https://api.gdeltproject.org/'))).toBe(true);
  await page.getByPlaceholder('lat',{exact:true}).fill('91');
  await page.getByRole('button',{name:'Save custom',exact:true}).click();
  await expect(page.getByText(/Watch zone requires latitude -90 to 90/)).toBeVisible();
  await page.getByPlaceholder('lat',{exact:true}).fill('39.9');
  await page.getByPlaceholder('lon',{exact:true}).fill('-122.1');
  await page.getByRole('button',{name:'Save custom',exact:true}).click();
  await expect(page.getByText('Could not persist watch zones. Changes apply to this session only.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Activate',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Save alert rule',exact:true}).click();
  await expect(page.getByText('Could not persist alert rules. Changes apply to this session only.')).toBeVisible();
  await page.getByRole('button',{name:'Pause',exact:true}).first().click();
  await page.getByRole('button',{name:'Remove',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'Activate',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await expect(page.getByText('Could not persist news proxy. Changes apply to this session only.')).toBeVisible();
  expect(browserErrors).toEqual([]);
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
});
