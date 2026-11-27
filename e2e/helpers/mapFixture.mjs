import {OPENFREE_MAP_STYLE} from "../../lib/vectorMap.mjs";
export const LOCAL = 'http://127.0.0.1:4173';
export const APP = '/parallax-watchtower/';
export async function mapFixture(page, { liveMap = false, style, cspWorkersBlocked = false, slowStyle, newsArea = false, blockTiles = false } = {}) {
  if(newsArea) await page.addInitScript(()=>localStorage.setItem('watchtower:gdeltProxyUrl','/data/cartographer-news.json'));
  const newsArticle={title:'Cartographer source-published news area',url:'https://news.un.org/en/story/2026/11/cartographer-fixture',seendate:new Date().toISOString(),geography:{kind:'source-published-area',receipt:'https://news.un.org/en/story/2026/11/cartographer-fixture',lat:20,lon:25,radiusKm:1200,label:'Published approximate region (test fixture)'}};
  const features=Array.from({length:2400},(_,i)=>({type:'Feature',id:`cartographer-${i}`,geometry:{type:'Point',coordinates:[-174+(i%60)*5.8,-58+Math.floor(i/60)*2.9,10]},properties:{type:'earthquake',mag:2.5,time:Date.now()-i*1000,title:`Cartographer fixture ${i}`,place:'Test-only geographic fixture',status:'reviewed',url:`https://earthquake.usgs.gov/earthquakes/eventpage/cartographer-${i}`}}));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(newsArea && url.startsWith(LOCAL) && url.includes('/data/cartographer-news.json')) return route.fulfill({json:{articles:[newsArticle]}});
    if(url.startsWith(LOCAL) && url.endsWith('/data/orbits.json')) return route.fulfill({json:{}});
    if(url.startsWith(LOCAL)) return route.continue();
    if(url.startsWith('https://earthquake.usgs.gov/earthquakes/feed/'))return route.fulfill({json:{type:'FeatureCollection',features}});
    if(liveMap && url.startsWith('https://tiles.openfreemap.org/')) {
      if(blockTiles && /\/\d+\/\d+\/\d+\.(pbf|png)(?:\?|$)/.test(url)) return route.abort('blockedbyclient');
      return route.continue();
    }
    return route.abort('blockedbyclient');
  });
  if(style) await page.route(OPENFREE_MAP_STYLE, route=>route.fulfill({json:style}));
  if(slowStyle) await page.route(OPENFREE_MAP_STYLE, slowStyle);
  if(cspWorkersBlocked) await page.route(LOCAL+APP,async route=>{const response=await route.fetch();const body=(await response.text()).replace(/worker-src (?:'|&#39;)self(?:'|&#39;) blob:/,"worker-src &#39;none&#39;");await route.fulfill({response,body});});
  await page.goto(APP);
  await page.getByRole('button',{name:'Live signals',exact:true}).click();
  await page.locator('.map-chip').getByText(newsArea ? /2401 mapped source signals/ : /2400 mapped source signals/).waitFor();
}
