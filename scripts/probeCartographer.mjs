import {browserNetwork} from './browserNetwork.mjs';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {mapFixture} from '../e2e/helpers/mapFixture.mjs';
import {inspectMapPixels} from '../e2e/helpers/mapVisual.mjs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'pipe'});
const ready=new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('4173'))resolve();});server.on('error',reject);server.on('exit',code=>reject(new Error(`Preview exited ${code}`)));});
let browser; const network = await browserNetwork();
try {
 await ready; await mkdir('docs/cartographer/screenshots',{recursive:true});await mkdir('docs/cartographer/evidence',{recursive:true});
 browser=await chromium.launch({headless:true,proxy:network.proxy,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({baseURL:'http://127.0.0.1:4173',viewport:{width:1600,height:1100}}), evidence={checkedAt:new Date().toISOString(),console:[],requests:[],workers:[],visuals:{}};
 page.on('console',m=>{if(['warning','error'].includes(m.type()))evidence.console.push({type:m.type(),message:m.text()});});page.on('pageerror',e=>{console.error(e.message);evidence.console.push({type:'pageerror',message:e.message});});
 page.on('response',r=>{if(/openfreemap|maplibre-gl-worker/.test(r.url()))evidence.requests.push({url:r.url(),status:r.status(),type:r.request().resourceType()});});
 page.on('requestfailed',r=>{if(/openfreemap|maplibre-gl-worker/.test(r.url()))evidence.requests.push({url:r.url(),error:r.failure()?.errorText});});page.on('worker',w=>evidence.workers.push(w.url()));
 await mapFixture(page,{liveMap:process.argv.includes('--live'),blockTiles:process.argv.includes('--blocked-tiles')});
 const provider=process.argv.includes('--live')&&!process.argv.includes('--blocked-tiles')?'openfreemap':'bundled';
 const scenario=process.argv.includes('--blocked-tiles')?'external-tiles-blocked':provider;
 await page.waitForFunction(p=>{const m=document.querySelector('.cartographer');return m?.getAttribute('data-map-provider')===p&&m?.getAttribute('data-map-renderer')==='vector';},provider,{timeout:30000});
 evidence.environment={browser:browser.version(),tlsValidation:'enabled',geography:'real external style/tiles; signal records are deterministic test fixtures',gpu:await page.locator('.maplibregl-canvas').evaluate(c=>{const g=c.getContext('webgl2');const ext=g?.getExtension('WEBGL_debug_renderer_info');return g?{version:g.getParameter(g.VERSION),renderer:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}:null;})};
 evidence.state=await page.locator('.cartographer').evaluate(el=>({...el.dataset,health:el.querySelector('.map-health').textContent,features:el.querySelector('.vector-map')?.getAttribute('data-geographic-features')}));
 const screenshot=await page.locator('.canvas-wrap').screenshot({path:`docs/cartographer/screenshots/${scenario}-vector.png`});evidence.visuals.vector=inspectMapPixels(screenshot,{bundled:provider==='bundled'});
 await page.getByRole('button',{name:'Lite',exact:true}).click();
 await page.waitForTimeout(150);evidence.visuals.offline=inspectMapPixels(await page.locator('.canvas-wrap').screenshot({path:'docs/cartographer/screenshots/offline-atlas.png'}),{bundled:true});
 await page.getByRole('button',{name:'Globe',exact:true}).click();await page.waitForTimeout(150);evidence.visuals.globe=inspectMapPixels(await page.locator('.canvas-wrap').screenshot({path:'docs/cartographer/screenshots/geographic-globe.png'}),{bundled:true,globe:true});
 await writeFile(`docs/cartographer/evidence/candidate-${scenario}.json`,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
} catch(error) { console.error(error); if(browser){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error((await p.locator('body').innerText()).slice(0,300));await p.screenshot({path:'docs/cartographer/screenshots/probe-error.png'});}} throw error; } finally {await browser?.close();server.kill();network.close();}
