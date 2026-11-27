import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {browserNetwork} from './browserNetwork.mjs';
const target='https://michaelwave369.github.io/parallax-watchtower/';
const network=await browserNetwork();let browser;
try {
 browser=await chromium.launch({proxy:network.proxy,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),evidence={checkedAt:new Date().toISOString(),url:target,tlsValidation:'enabled',console:[],requests:[]};
 page.on('console',m=>{if(['error','warning'].includes(m.type()))evidence.console.push({type:m.type(),message:m.text()});});page.on('pageerror',e=>evidence.console.push({type:'pageerror',message:e.message}));
 page.on('response',r=>{if(/openfreemap|maplibre-gl-worker/.test(r.url()))evidence.requests.push({url:r.url(),status:r.status(),contentType:r.headers()['content-type'],cors:r.headers()['access-control-allow-origin']});});
 page.on('requestfailed',r=>{if(/openfreemap|maplibre-gl-worker/.test(r.url()))evidence.requests.push({url:r.url(),error:r.failure()?.errorText});});
 await page.goto(target);await page.getByRole('button',{name:'Live signals',exact:true}).click();await page.getByRole('button',{name:'Map',exact:true}).click();
 await page.waitForTimeout(15500);
 evidence.afterFailure={heading:await page.locator('.map-head').innerText(),status:await page.locator('.status-strip').innerText()};
 await page.getByRole('button',{name:'Map',exact:true}).click();await page.waitForTimeout(500);
 evidence.afterRetry={heading:await page.locator('.map-head').innerText(),status:await page.locator('.status-strip').innerText(),canvas:await page.locator('.maplibregl-canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return {width:c.width,height:c.height,rect:{width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height},webgl:gl?.getParameter(gl.VERSION),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};})};
 await mkdir('docs/cartographer/evidence',{recursive:true});await mkdir('docs/cartographer/screenshots',{recursive:true});
 await page.locator('.map-panel').screenshot({path:'docs/cartographer/screenshots/production-black-after-retry.png'});
 await writeFile('docs/cartographer/evidence/production-retry-before.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await browser?.close();network.close();}
