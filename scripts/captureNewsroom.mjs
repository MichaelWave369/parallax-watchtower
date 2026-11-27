// Manual evidence capture from the built candidate and its real dated public cache.
// Does not collect providers, authenticate, upload anything, or deploy the site.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

await mkdir('docs/ascension/screenshots', { recursive: true });
await mkdir('docs/ascension/evidence', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4181', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview startup deadline exceeded.')), 15000);
    server.stdout.on('data', data => { if (data.toString().includes('4181')) { clearTimeout(timer); resolve(); } });
    server.on('error', error => { clearTimeout(timer); reject(error); });
    server.on('exit', code => { clearTimeout(timer); reject(new Error('Preview exited ' + code)); });
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1060 } });
  const page = await context.newPage();
  const pageErrors = [], externalRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4181') ? route.continue() : (externalRequests.push(route.request().url()), route.abort()));
  const start = Date.now();
  await page.goto('http://127.0.0.1:4181/parallax-watchtower/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Global Command', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Refresh cache', exact: true }).waitFor();
  await page.locator('.nr-story').first().waitFor();
  const readyMs = Date.now() - start;
  await page.screenshot({ path: 'docs/ascension/screenshots/newsroom-desktop.png' });
  const desktopAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const performance = await page.evaluate(() => ({
    navigation: performance.getEntriesByType('navigation').map(n => ({ domContentLoadedMs: n.domContentLoadedEventEnd - n.startTime, loadMs: n.loadEventEnd - n.startTime })),
    resourceBytes: performance.getEntriesByType('resource').reduce((n, r) => n + r.encodedBodySize, 0),
    renderedStories: document.querySelectorAll('.nr-story').length,
    documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth
  }));
  await page.getByRole('button', { name: 'Toggle light theme' }).click();
  await page.screenshot({ path: 'docs/ascension/screenshots/newsroom-light.png' });
  const lightAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await page.getByRole('button', { name: 'Toggle light theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/ascension/screenshots/newsroom-mobile.png' });
  const mobileWidth = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  await page.setViewportSize({ width: 1600, height: 1060 });
  await page.getByRole('complementary', { name: 'News desks' }).getByRole('button', { name: /Intelligence Brief/ }).click();
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON brief' }).click();
  await (await download).saveAs('docs/ascension/evidence/actual-brief.json');
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown brief' }).click();
  await (await download).saveAs('docs/ascension/evidence/actual-brief.md');
  const compact = results => results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }));
  const result = { checkedAt: new Date().toISOString(), kind: 'local production bundle; actual checked-in provider snapshot; external requests blocked', browser: browser.version(), readyMs, performance, mobileWidth, pageErrors, externalRequests, axe: { desktop: compact(desktopAxe), light: compact(lightAxe) } };
  await writeFile('docs/ascension/evidence/browser-measurements.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (pageErrors.length || result.axe.desktop.length || result.axe.light.length || mobileWidth.document > mobileWidth.viewport) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
