import { test, expect } from '@playwright/test';
import { OPENFREE_MAP_STYLE } from '../lib/vectorMap.mjs';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

test('actual MapLibre 6 renderer initializes against a controlled local style without the removed supported API', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4173') ? route.continue() : route.abort());
  await page.route(OPENFREE_MAP_STYLE, route => route.fulfill({ json: {
    version: 8, name: 'Controlled renderer test; not a provider availability check', sources: {},
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#162634' } }]
  } }));
  await page.goto('/parallax-watchtower/');
  await page.getByRole('button', { name: 'Live signals', exact: true }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vector Map · Clustered Signals' })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Lite', exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
});
