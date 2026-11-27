import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NEWS_SOURCES, getNewsSource, makeNewsSourceManifest } from '../lib/newsSources.mjs';
import { NEWS_SCHEMA, canonicalizeNewsUrl, normalizeNewsRecord, validateNewsSnapshot, validateNewsHealth } from '../lib/newsContract.mjs';
import { parseSyndicationFeed, normalizeSourcePayload, fetchNewsSource, collectNews, readNewsResponse, NEWS_RESPONSE_MAX_BYTES } from '../lib/newsAdapters.mjs';
import { refreshNews } from '../scripts/refreshNews.mjs';
const now=Date.parse('2026-11-27T00:00:00Z');
const iso=new Date(now).toISOString();
const rss=await readFile(new URL('./fixtures/news/news.rss.xml',import.meta.url),'utf8');
const atom=await readFile(new URL('./fixtures/news/news.atom.xml',import.meta.url),'utf8');
const record=(overrides={})=>({id:'test-1',sourceId:'manual',publisher:'Fixture public source',originGroup:'fixture-origin',title:'A factual metadata title',url:'https://reports.example.org/story?utm_medium=rss',retrievedAt:iso,publishedAt:'2026-11-26T12:30:00Z',eventAt:null,modifiedAt:null,privacyClass:'public',demo:false,...overrides});
function bodyFor(source) {
  if(source.format==='rss')return `<rss version="2.0"><channel><item><title>Fixture ${source.id} publication</title><link>https://${source.receiptHosts[0]}/press/fixture</link><pubDate>Thu, 26 Nov 2026 12:30:00 GMT</pubDate></item></channel></rss>`;
  if(source.format==='atom')return atom;
  if(source.id==='usgs-earthquakes')return JSON.stringify({type:'FeatureCollection',features:[{id:'fixture',properties:{title:'M 5.1 – fixture region',type:'earthquake',mag:5.1,time:now-3600000,updated:now-1800000,place:'Published fixture region',url:'https://earthquake.usgs.gov/earthquakes/eventpage/fixture'}}]});
  return JSON.stringify({results:[{title:'Fixture public policy notice',html_url:'https://www.federalregister.gov/documents/2026/11/26/fixture',publication_date:'2026-11-26'}]});
}
function responseFor(source) {
  return new Response(bodyFor(source),{status:200,headers:{'content-type':source.format==='rss'?'application/rss+xml':source.format==='atom'?'application/atom+xml':'application/json'}});
}
const successfulFetch=async url=>responseFor(NEWS_SOURCES.find(s=>s.url===url));

test('reviewed source registry declares policy, retrieval, attribution and limitations for six sources',()=>{
  assert.equal(NEWS_SOURCES.length,6);assert.equal(new Set(NEWS_SOURCES.map(s=>s.id)).size,6);
  for(const source of NEWS_SOURCES)for(const field of ['url','format','geographicCoverage','language','retrievalMethod','expectedUpdateFrequency','attribution','licensingConstraints','limitations','supportedFields','policyUrls'])assert.ok(source[field],source.id+':'+field);
  assert.equal(makeNewsSourceManifest().sources,NEWS_SOURCES);
});
test('canonical URLs remove tracking, preserve meaningful query arguments and reject private or executable destinations',()=>{
  assert.equal(canonicalizeNewsUrl('https://www.nasa.gov/story?b=2&utm_source=x&a=1#frag'),'https://www.nasa.gov/story?a=1&b=2');
  for(const url of ['javascript:alert(1)','http://www.nasa.gov/story','https://user:pass@www.nasa.gov/','https://127.0.0.1/a','https://0x7f000001/a','https://[::1]/a','https://host.local/a','https://www.nasa.gov:8443/a'])assert.equal(canonicalizeNewsUrl(url),null,url);
});
test('metadata normalization separates timestamps and strips private fields and HTML',()=>{
  const result=normalizeNewsRecord(record({title:'<img src=x onerror=alert(1)>Read <b>the</b> source',publishedAt:null,note:'private',watchZone:{lat:1}}),now);
  assert.equal(result.title,'Read the source');assert.equal(result.publishedAt,null);assert.equal(result.eventAt,null);
  assert.equal(result.retrievedAt,iso);assert.ok(!('watchZone'in result));assert.ok(!('note'in result));
  assert.equal(normalizeNewsRecord(record({demo:true}),now),null);assert.equal(normalizeNewsRecord(record({privacyClass:'private_local'}),now),null);
});
test('malformed calendar dates, missing timezones and future-dated metadata are rejected',()=>{
  for(const date of ['2026-02-30T12:00:00Z','2026-11-26T24:00:00Z','2026-11-26T12:99:00Z','2026-11-26T12:00:00','2026-13-01T00:00:00Z','2026-11-29T00:00:00Z'])assert.equal(normalizeNewsRecord(record({publishedAt:date}),now),null,date);
  assert.ok(normalizeNewsRecord(record({publishedAt:'2026-11-26T16:30:00+04:00'}),iso));
});
test('RSS parser retains only attributed public metadata, deduplicates URLs, rejects unsafe receipts',()=>{
  const rows=normalizeSourcePayload('nasa-news',rss,now);
  assert.equal(rows.length,1);assert.equal(rows[0].title,'Open science & public evidence');assert.equal(rows[0].publishedAt,'2026-11-26T12:30:00.000Z');
  assert.equal(rows[0].summary,'');assert.equal(rows[0].eventAt,null);assert.equal(rows[0].publisher,'NASA');
});
test('Atom arXiv metadata excludes abstracts and never turns announcement updated into publication or event time',()=>{
  const rows=normalizeSourcePayload('arxiv-ai',atom,now);assert.equal(rows.length,1);
  assert.equal(rows[0].url,'https://arxiv.org/abs/2611.00001');assert.equal(rows[0].summary,'');assert.equal(rows[0].publishedAt,null);assert.equal(rows[0].modifiedAt,null);assert.equal(rows[0].eventAt,null);
  assert.equal(rows[0].evidenceType,'uncorroborated_claim');
});
test('DTD, entity expansion, namespace spoofing, malformed XML and excessive depth fail closed',()=>{
  const hostile=['<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>','<rss><channel><item><title>&bogus;</title></item></channel></rss>','<rss><channel>','<feed xmlns="urn:fake"><entry/></feed>','<rss>'+ '<x>'.repeat(34)+'</x>'.repeat(34)+'</rss>'];
  for(const xml of hostile)assert.throws(()=>parseSyndicationFeed(xml,xml.startsWith('<feed')?'atom':'rss'));
  assert.throws(()=>normalizeSourcePayload('nasa-news','<rss xmlns:bad="urn:evil"><channel><item><title>Label</title><bad:link>https://www.nasa.gov/fake</bad:link></item></channel></rss>',now),/no valid/);
});
test('GeoJSON has event and modification times without invented publication; date-only policy metadata stays date-only',()=>{
  const q=normalizeSourcePayload('usgs-earthquakes',JSON.parse(bodyFor(getNewsSource('usgs-earthquakes'))),now)[0];
  assert.equal(q.eventAt,'2026-11-26T23:00:00.000Z');assert.equal(q.publishedAt,null);assert.equal(q.modifiedAt,'2026-11-26T23:30:00.000Z');assert.ok(!('coordinates'in q.region));
  const p=normalizeSourcePayload('federal-register',JSON.parse(bodyFor(getNewsSource('federal-register'))),now)[0];
  assert.equal(p.publishedAt,null);assert.match(p.summary,/2026-11-26 \(day precision/);
});
test('source adapters require exact allowlisted identities, do not follow redirects and enforce response content type',async()=>{
  await assert.rejects(fetchNewsSource({...NEWS_SOURCES[0],url:'https://127.0.0.1/'},{fetchImpl:successfulFetch,now}));
  await assert.rejects(fetchNewsSource('nasa-news',{fetchImpl:async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/'}}),now}),/HTTP 302/);
  await assert.rejects(fetchNewsSource('nasa-news',{fetchImpl:async()=>new Response('<html>provider login</html>',{headers:{'content-type':'text/html'}}),now}),/content type/);
});
test('streamed and declared response limits reject oversized payloads without parsing',async()=>{
  const controller=new AbortController();
  await assert.rejects(readNewsResponse(new Response('x',{headers:{'content-length':String(NEWS_RESPONSE_MAX_BYTES+1)}}),controller.signal),/size limit/);
  await assert.rejects(readNewsResponse(new Response('x'.repeat(100)),controller.signal,20),/size limit/);
});
test('timeout remains active while reading a stalled body',async()=>{
  const stream=new ReadableStream({start(){}});
  const start=Date.now();
  await assert.rejects(fetchNewsSource('nasa-news',{fetchImpl:async()=>new Response(stream,{headers:{'content-type':'application/rss+xml'}}),now,timeoutMs:20}),/timed out/);
  assert.ok(Date.now()-start<1000);
});
test('collector supports heterogeneous feeds with at most two concurrent requests and source cooldowns',async()=>{
  let active=0,max=0,calls=0;
  const fetchImpl=async url=>{active++;max=Math.max(max,active);calls++;await new Promise(r=>setTimeout(r,1));const response=await successfulFetch(url);active--;return response;};
  const result=await collectNews({fetchImpl,now,concurrency:99});assert.equal(result.succeeded,6);assert.equal(result.snapshot.records.length,6);assert.equal(max,2);
  const second=await collectNews({previous:result.snapshot,previousHealth:result.health,now:now+3600000,fetchImpl});assert.equal(second.attempted,0);assert.equal(second.unchanged,true);assert.equal(calls,6);
});
test('partial failures retain original receipt times while successful sources refresh and backoff persists',async()=>{
  const first=await collectNews({fetchImpl:successfulFetch,now});const later=now+7*3600000;
  const result=await collectNews({previous:first.snapshot,previousHealth:first.health,now:later,fetchImpl:async url=>url===NEWS_SOURCES[0].url?new Response('',{status:429,headers:{'retry-after':'86400'}}):successfulFetch(url)});
  assert.equal(result.succeeded,5);assert.equal(result.publish,true);
  const old=result.snapshot.records.find(r=>r.sourceId==='nasa-news');assert.equal(old.retrievedAt,iso);
  const state=result.health.sources.find(s=>s.id==='nasa-news');assert.equal(state.status,'error');assert.equal(state.lastSuccessAt,iso);assert.equal(state.lastFailureAt,new Date(later).toISOString());assert.equal(Date.parse(state.nextAttemptAt),later+24*3600000);
});
test('snapshot import rejects incorrect counts, conflicting IDs and malicious/future health',()=>{
  const row=normalizeNewsRecord(record(),now);
  const snapshot={schema:NEWS_SCHEMA,generatedAt:iso,sources:[{id:'manual',status:'ok',lastSuccessAt:iso,lastFailureAt:null,attemptedAt:iso,recordCount:1,message:'test'}],records:[row]};
  assert.ok(validateNewsSnapshot(snapshot,now));assert.equal(validateNewsSnapshot({...snapshot,sources:[{...snapshot.sources[0],recordCount:90}]},now),null);
  assert.equal(validateNewsSnapshot({...snapshot,sources:[{...snapshot.sources[0],recordCount:2}],records:[row,{...row,url:'https://reports.example.org/other',canonicalUrl:'https://reports.example.org/other'}]},now),null);
  assert.equal(validateNewsHealth({schema:'phi.watchtower.news-health.v1',generatedAt:'2026-02-30T00:00:00Z',sources:[]},now),null);
});
test('complete upstream failure preserves last good snapshot bytes and writes separate failure health',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'watchtower-news-'));
  try{
    const first=await collectNews({fetchImpl:successfulFetch,now});const bytes=JSON.stringify(first.snapshot,null,2)+'\n';
    await writeFile(join(dir,'news.v1.json'),bytes);await writeFile(join(dir,'news-health.v1.json'),JSON.stringify(first.health));
    const result=await refreshNews({outputDir:dir,now:now+7*3600000,fetchImpl:async()=>{throw new Error('fixture outage');}});
    assert.equal(result.publish,false);assert.equal(result.succeeded,0);assert.equal(await readFile(join(dir,'news.v1.json'),'utf8'),bytes);
    const health=JSON.parse(await readFile(join(dir,'news-health.v1.json'),'utf8'));assert.equal(health.sources.filter(s=>s.status==='error').length,6);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('published public cache and registry conform without assuming old metadata is current',async()=>{
  const snapshot=JSON.parse(await readFile(new URL('../public/data/news.v1.json',import.meta.url),'utf8'));
  const health=JSON.parse(await readFile(new URL('../public/data/news-health.v1.json',import.meta.url),'utf8'));
  const manifest=JSON.parse(await readFile(new URL('../public/data/news-sources.v1.json',import.meta.url),'utf8'));
  const at=Math.max(Date.now(),Date.parse(snapshot.generatedAt),Date.parse(health.generatedAt));
  assert.ok(validateNewsSnapshot(snapshot,at));assert.ok(validateNewsHealth(health,at));
  assert.deepEqual(manifest,makeNewsSourceManifest());
  assert.equal(snapshot.records.some(r=>r.demo || r.privacyClass!=='public'),false);
});
test('early HTTP, content-type and declared-size rejection cancels unread bodies and aborts transport',async()=>{
  const cases=[
    {status:503,headers:{'content-type':'application/rss+xml'},pattern:/HTTP 503/},
    {status:200,headers:{'content-type':'text/html'},pattern:/content type/},
    {status:200,headers:{'content-type':'application/rss+xml','content-length':String(NEWS_RESPONSE_MAX_BYTES+1)},pattern:/size limit/}
  ];
  for(const scenario of cases){
    let cancelled=0,requestSignal;
    const response=new Response(new ReadableStream({cancel(){cancelled++;}}),scenario);
    await assert.rejects(fetchNewsSource('nasa-news',{now,fetchImpl:async(_url,options)=>{requestSignal=options.signal;return response;}}),scenario.pattern);
    assert.equal(requestSignal.aborted,true,'request controller aborted after validation rejection');
    assert.equal(cancelled,1,'unread response body cancelled exactly once');
  }
});
test('response cleanup never waits indefinitely for an uncooperative stream cancellation',async()=>{
  let cancelled=false,requestSignal;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{});}}),{status:503});
  const result=await Promise.race([
    fetchNewsSource('nasa-news',{now,fetchImpl:async(_url,options)=>{requestSignal=options.signal;return response;}}).then(()=>false,error=>error.message==='HTTP 503'),
    new Promise(resolve=>setTimeout(()=>resolve(false),200))
  ]);
  assert.equal(result,true);assert.equal(cancelled,true);assert.equal(requestSignal.aborted,true);
});
test('standalone response reader cancels a declared oversized body before acquiring a reader',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-length':String(NEWS_RESPONSE_MAX_BYTES+1)}});
  await assert.rejects(readNewsResponse(response,new AbortController().signal),/size limit/);
  assert.equal(cancelled,true);assert.equal(response.body.locked,false);
});
