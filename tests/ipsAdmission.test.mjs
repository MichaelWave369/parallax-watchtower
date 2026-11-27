import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAdmissionRobots, inspectAdmissionFeed, probeIps, IPS_ROBOTS, IPS_FEED } from '../scripts/probeIpsAdmission.mjs';
const allowed='User-agent: *\nDisallow: /wp-admin/\nCrawl-delay: 2';
const blocked='User-agent: *\nDisallow: /news/*/feed/$\nAllow: /news/headlines/feed/';
const rss='<rss version="2.0"><channel><item><title>Fixture headline</title><link>https://www.ipsnews.net/fixture/</link><pubDate>Thu, 26 Nov 2026 12:30:00 GMT</pubDate></item><item><title>Duplicate</title><link>https://www.ipsnews.net/fixture/</link></item><item><title>Unsafe receipt</title><link>https://other.example.org/fixture</link></item></channel></rss>';
const response=(body,type,status=200)=>new Response(body,{status,headers:{'content-type':type}});
test('conservative robots gate respects disallow, wildcard, ambiguity and crawl delay',()=>{
 assert.deepEqual(checkAdmissionRobots(allowed),{allowed:true,delaySeconds:2});
 for(const value of [blocked,'User-agent: anotherbot\nDisallow: /','User-agent: *\nDisallow: /news%2f','<html>error</html>','User-agent: *\nCrawl-delay: 120',''])assert.equal(checkAdmissionRobots(value).allowed,false);
 assert.equal(checkAdmissionRobots('User-agent: *\nDisallow: /private$').allowed,true);
});
test('feed inspection counts only unique allowed HTTPS receipts and emits no headline text',()=>{
 assert.deepEqual(inspectAdmissionFeed(rss),{items:3,attributableUniqueItems:1,timezoneDateCandidates:1});
 assert.throws(()=>inspectAdmissionFeed('<!DOCTYPE rss><rss/>'));
});
test('robots unavailable or denied means no feed request',async()=>{
 for(const res of [()=>response('', 'text/plain',403),()=>response(blocked,'text/plain'),()=>response(allowed,'text/html')]){
   const calls=[];const report=await probeIps({fetchImpl:async url=>{calls.push(url);return res();},sleep:async()=>{}});
   assert.deepEqual(calls,[IPS_ROBOTS]);assert.equal(report.state,'blocked');assert.equal(report.productionEnabled,false);
 }
});
test('probe requests only fixed endpoints once, waits for policy delay and emits counts',async()=>{
 const calls=[],waits=[];
 const report=await probeIps({fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return url===IPS_ROBOTS?response(allowed,'text/plain'):response(rss,'text/xml');},sleep:async ms=>waits.push(ms)});
 assert.deepEqual(calls,[IPS_ROBOTS,IPS_FEED]);assert.deepEqual(waits,[2000]);assert.equal(report.state,'transport-reviewed');assert.equal(report.productionEnabled,false);assert.equal(report.feed.attributableUniqueItems,1);assert.ok(!JSON.stringify(report).includes('Fixture headline'));
});
test('feed redirect and empty feed fail closed without retry',async()=>{
 for(const feed of [()=>response('', 'text/xml',302),()=>response('<rss><channel/></rss>','text/xml')]){
   let calls=0;const report=await probeIps({fetchImpl:async url=>{calls++;return url===IPS_ROBOTS?response(allowed,'text/plain'):feed();},sleep:async()=>{}});
   assert.equal(calls,2);assert.equal(report.state,'blocked');assert.equal(report.stage,'feed');
 }
});
