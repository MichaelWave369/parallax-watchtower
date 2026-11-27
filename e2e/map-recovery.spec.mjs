import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {mapFixture} from './helpers/mapFixture.mjs';
import {inspectMapPixels} from './helpers/mapVisual.mjs';
test.use({launchOptions:{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}});
test.describe('bounded recovery and truthful status',()=>{

 test('CSP worker violations produce a real geographic Canvas fallback and diagnostics',async({page},testInfo)=>{
  const consoleMessages=[];page.on('console',m=>consoleMessages.push(m.text()));
  await page.addInitScript(()=>{globalThis.__mapCsp=[];document.addEventListener('securitypolicyviolation',e=>globalThis.__mapCsp.push({directive:e.violatedDirective,blocked:e.blockedURI}));});
  await mapFixture(page,{cspWorkersBlocked:true});
  await expect(page.locator('.cartographer')).toHaveAttribute('data-map-state','offline_atlas');
  const violations=await page.evaluate(()=>globalThis.__mapCsp);
  const proofPath=testInfo.outputPath('csp-violations.json');await writeFile(proofPath,JSON.stringify({violations,consoleMessages,diagnostics:await page.locator('.map-diagnostics').textContent()},null,2));
  await testInfo.attach('CSP-violations',{path:proofPath,contentType:'application/json'});
  expect(violations.some(v=>v.directive==='worker-src')).toBe(true);
  const shot=await page.locator('.canvas-wrap').screenshot({path:testInfo.outputPath('geographic-proof.png')});inspectMapPixels(shot,{bundled:true});await testInfo.attach('CSP-offline-geography',{body:shot,contentType:'image/png'});
  await expect(page.locator('.map-diagnostics')).toContainText(/Worker|worker|security/i);
 });
 test('slow style remains geographic while the deadline moves to independent vector; retry does not reset the camera',async({page})=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await mapFixture(page,{slowStyle:async route=>{await gate;await route.abort().catch(()=>{});}});
  await expect(page.locator('.cartographer')).toHaveAttribute('data-map-renderer','offline');
  inspectMapPixels(await page.locator('.canvas-wrap').screenshot(),{bundled:true});
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();const view=await page.locator('.cartographer').getAttribute('data-map-view');
  await expect(page.locator('.cartographer')).toHaveAttribute('data-map-provider','bundled',{timeout:14000});
  await expect(page.locator('.map-diagnostics')).toContainText('exceeded 10s');
  expect(await page.locator('.cartographer').getAttribute('data-map-view')).toBe(view);
  await page.getByRole('button',{name:'Retry vector map'}).click();await expect(page.locator('.map-health')).toContainText('Active: offline geographic atlas');
  expect(await page.locator('.cartographer').getAttribute('data-map-view')).toBe(view);release();
 });
});
