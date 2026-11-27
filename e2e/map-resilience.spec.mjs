import {test,expect} from '@playwright/test';
import {mapFixture} from './helpers/mapFixture.mjs';
import {inspectMapPixels} from './helpers/mapVisual.mjs';
test.use({launchOptions:{args:['--disable-webgl','--disable-webgl2']}});

test.describe('Canvas geography with no WebGL',()=>{
 test('all providers unavailable, offline, resize, pan/zoom, workspace/mode changes, receipts and filters',async({page,context},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await mapFixture(page);
  const panel=page.locator('.cartographer'),surface=page.locator('.geographic-atlas-signals');
  await expect(panel).toHaveAttribute('data-map-state','offline_atlas');
  await expect(page.getByRole('button',{name:'Lite',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.map-health')).toContainText('Active: offline geographic atlas');
  await expect(page.locator('.geographic-atlas-geography')).toHaveAttribute('data-country-count','177');
  await expect(surface).toHaveAttribute('data-visible-count','2400');
  const shot=await page.locator('.canvas-wrap').screenshot({path:testInfo.outputPath('geographic-proof.png')});inspectMapPixels(shot,{bundled:true});await testInfo.attach('offline-2400-signals',{body:shot,contentType:'image/png'});
  await context.setOffline(true);
  await surface.focus();await page.keyboard.press('Enter');await expect(page.locator('.receipt')).toContainText('Cartographer fixture');
  const selected=await page.locator('.receipt').innerText();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const zoomed=await panel.getAttribute('data-map-view');await surface.press('ArrowRight');const moved=await panel.getAttribute('data-map-view');expect(moved).not.toBe(zoomed);
  await page.getByRole('button',{name:'Globe',exact:true}).click();await expect(page.locator('.geographic-globe')).toHaveAttribute('data-country-count','177');
  expect(await panel.getAttribute('data-map-view')).toBe(moved);
  await page.getByRole('button',{name:'Lite',exact:true}).click();expect(await panel.getAttribute('data-map-view')).toBe(moved);
  expect(await page.locator('.receipt').innerText()).toBe(selected);
  // Explore is eagerly bundled, so switching remains possible after network loss.
  await page.getByRole('button',{name:/Explore · 50 sources/}).click();await page.getByRole('button',{name:'Live signals',exact:true}).click();
  expect(await panel.getAttribute('data-map-view')).toBe(moved);expect(await page.locator('.receipt').innerText()).toBe(selected);
  await page.setViewportSize({width:800,height:1000});await page.getByRole('button',{name:'Global view'}).click();
  inspectMapPixels(await page.locator('.canvas-wrap').screenshot(),{bundled:true});
  await page.getByRole('button',{name:'Fullscreen map'}).click();await expect(panel).toHaveClass(/map-expanded/);
  await page.getByRole('button',{name:'Exit fullscreen'}).click();
  await page.getByRole('button',{name:'Local view',exact:true}).click();expect(await panel.getAttribute('data-map-view')).not.toBe(moved);
  await page.getByPlaceholder('place, source, keyword').fill('Cartographer fixture 2399');await expect(surface).toHaveAttribute('data-eligible-count','1');
  await page.getByRole('button',{name:'Retry vector map'}).click();await expect(panel).toHaveAttribute('data-map-state','offline_atlas');
  await expect(page.getByPlaceholder('place, source, keyword')).toHaveValue('Cartographer fixture 2399');
  expect(errors).toEqual([]);
 });
 test('geographic globe paints countries and visible signal clusters without WebGL',async({page},testInfo)=>{
  await mapFixture(page);await page.getByRole('button',{name:'Globe',exact:true}).click();
  await expect(page.locator('.geographic-globe')).toHaveAttribute('data-country-count','177');
  const shot=await page.locator('.canvas-wrap').screenshot({path:testInfo.outputPath('geographic-proof.png')});inspectMapPixels(shot,{bundled:true,globe:true});await testInfo.attach('geographic-globe',{body:shot,contentType:'image/png'});
  const before=await page.locator('.cartographer').getAttribute('data-map-view');await page.locator('.geographic-globe').press('ArrowLeft');expect(await page.locator('.cartographer').getAttribute('data-map-view')).not.toBe(before);
 });
});



test('source-linked news areas show uncertainty and retain the original evidence receipt',async({page})=>{
 await mapFixture(page,{newsArea:true});await page.getByRole('button',{name:'Lite',exact:true}).click();
 await page.getByPlaceholder('place, source, keyword').fill('source-published news area');
 await expect(page.locator('.geographic-atlas-signals')).toHaveAttribute('data-eligible-count','1');
 await expect(page.locator('.geographic-atlas-signals')).toHaveAttribute('data-uncertainty-radius-km','1200');
 await expect(page.locator('.receipt')).toContainText('not independently verified');
 await expect(page.locator('.receipt a')).toHaveAttribute('href','https://news.un.org/en/story/2026/11/cartographer-fixture');
 const uncertaintyPixels=await page.locator('.geographic-atlas-signals').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>100&&d[i]<150&&d[i+1]>220&&d[i+2]>200&&d[i+3]>50)n++;return n;});
 expect(uncertaintyPixels).toBeGreaterThan(20);
 await page.getByRole('button',{name:'Globe',exact:true}).click();await expect(page.locator('.geographic-globe')).toHaveAttribute('data-eligible-count','1');
});
