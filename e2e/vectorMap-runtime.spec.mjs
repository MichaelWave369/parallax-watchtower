import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {OPENFREE_MAP_STYLE} from '../lib/vectorMap.mjs';
import {mapFixture} from './helpers/mapFixture.mjs';
import {inspectMapPixels} from './helpers/mapVisual.mjs';
const atlas=JSON.parse(await readFile(new URL('../lib/data/world-atlas.v1.json',import.meta.url),'utf8'));
const geographicStyle={version:8,sources:{countries:{type:'geojson',data:atlas}},layers:[
 {id:'ocean',type:'background',paint:{'background-color':'#0c2334'}},
 {id:'land',type:'fill',source:'countries',paint:{'fill-color':'#29494d'}},
 {id:'boundaries',type:'line',source:'countries',paint:{'line-color':'#7faaa4'}}]};
test.use({launchOptions:{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}});

test('real MapLibre decodes geographic polygons in the emitted worker and paints geography plus 2400 signals',async({page},testInfo)=>{
 const workerResponses=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/maplibre-gl-worker-.*\.js/.test(r.url()))workerResponses.push(r.status());});
 // Deterministic CI uses real country geometry, real worker, real WebGL.
 // The separate live acceptance probe exercises the external provider unmocked.
 await mapFixture(page,{style:geographicStyle});
 const panel=page.locator('.cartographer');
 await expect(panel).toHaveAttribute('data-map-provider','openfreemap');
 await expect(panel).toHaveAttribute('data-map-renderer','vector');
 expect(Number(await page.locator('.vector-map').getAttribute('data-geographic-features'))).toBeGreaterThan(10);
 expect(Number(await page.locator('.vector-map').getAttribute('data-projection-error'))).toBeLessThan(0.5);
 expect(workerResponses).toContain(200);expect(errors).toEqual([]);
 expect(await page.locator('.geographic-atlas-signals').getAttribute('data-visible-count')).toBe('2400');
 const shot=await page.locator('.canvas-wrap').screenshot({path:testInfo.outputPath('geographic-proof.png')});inspectMapPixels(shot,{bundled:true});
 await testInfo.attach('verified-vector-geography',{body:shot,contentType:'image/png'});
 // Staying ready beyond the loading deadline catches timers that fire after success.
 await page.waitForTimeout(10500);await expect(panel).toHaveAttribute('data-map-renderer','vector');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect(panel).toHaveAttribute('data-map-view',/0\.00000,14\.00000,0\.94555/);
 await expect.poll(async()=>Number(await page.locator('.vector-map').getAttribute('data-projection-error'))).toBeLessThan(0.5);
});

test('external tiles blocked: independent bundled vector paints actual countries and shared markers',async({page},testInfo)=>{
 await mapFixture(page);
 const panel=page.locator('.cartographer');await expect(panel).toHaveAttribute('data-map-provider','bundled');await expect(panel).toHaveAttribute('data-map-renderer','vector');
 expect(Number(await page.locator('.vector-map').getAttribute('data-geographic-features'))).toBeGreaterThan(10);
 const shot=await page.locator('.canvas-wrap').screenshot({path:testInfo.outputPath('geographic-proof.png')});inspectMapPixels(shot,{bundled:true});await testInfo.attach('independent-vector',{body:shot,contentType:'image/png'});
 await expect(page.locator('.map-health')).toContainText('Active: bundled Natural Earth vector');
 await expect(page.getByRole('button',{name:'Map',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('empty background and malformed style are never accepted as geographic readiness',async({page})=>{
 await mapFixture(page);await page.route(OPENFREE_MAP_STYLE,r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'blank',type:'background',paint:{'background-color':'#000'}}]}}));
 await page.getByRole('button',{name:'Retry vector map'}).click();
 await expect(page.locator('.cartographer')).toHaveAttribute('data-map-renderer','offline');
 inspectMapPixels(await page.locator('.canvas-wrap').screenshot(),{bundled:true});
 await expect(page.locator('.cartographer')).toHaveAttribute('data-map-provider','bundled',{timeout:14000});
 await page.route(OPENFREE_MAP_STYLE,r=>r.fulfill({contentType:'application/json',body:'{broken'}));
 await page.getByRole('button',{name:'Retry vector map'}).click();
 await expect(page.locator('.cartographer')).toHaveAttribute('data-map-provider','bundled');
 await expect(page.locator('.map-diagnostics')).toContainText(/JSON|Unexpected|parse/i);
});

test('losing WebGL after readiness restores bundled geography without resetting the camera or selected receipt',async({page})=>{
 await mapFixture(page,{style:geographicStyle});await expect(page.locator('.cartographer')).toHaveAttribute('data-map-renderer','vector');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();const view=await page.locator('.cartographer').getAttribute('data-map-view'),receipt=await page.locator('.receipt').innerText();
 await page.locator('.maplibregl-canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await expect(page.locator('.cartographer')).toHaveAttribute('data-map-provider','bundled');
 expect(await page.locator('.cartographer').getAttribute('data-map-view')).toBe(view);expect(await page.locator('.receipt').innerText()).toBe(receipt);
 await expect(page.locator('.map-diagnostics')).toContainText('WebGL context lost');
});
