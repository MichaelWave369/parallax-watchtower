import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoverage } from '../lib/newsCoverage.mjs';
const at="2026-11-27T00:00:00Z";
const sources=[{"id":"a","enabled":true,"originGroup":"one","language":"en","geographicCoverage":["Global"]},{"id":"b","enabled":true,"originGroup":"one","language":"es","geographicCoverage":["South America"]},{"id":"c","enabled":false,"originGroup":"two","language":"fr","geographicCoverage":["Africa"]}];
const records=[{"sourceId":"a","privacyClass":"public","demo":false,"retrievedAt":"2026-11-27T00:00:00Z","language":"en","kind":"article"},{"sourceId":"b","privacyClass":"public","demo":false,"retrievedAt":"2026-11-24T00:00:00Z","language":"es","kind":"official_statement"},{"sourceId":"manual","privacyClass":"public","demo":false,"retrievedAt":"2026-11-27T00:00:00Z","language":"fr","kind":"article"}];
const health=[{"id":"a","status":"ok","lastSuccessAt":"2026-11-27T00:00:00Z"},{"id":"b","status":"error","lastSuccessAt":"2026-11-27T00:00:00Z"}];
test('coverage separates sources, origin families, health, current records, and declared geography',()=>{
 const m=buildCoverage(sources,records,health,at);
 assert.deepEqual([m.configured,m.originFamilies,m.healthy,m.records,m.freshRecords],[2,1,1,2,1]);
 assert.equal(m.regions[0].feeds,0);assert.equal(m.regions[7].feeds,1);assert.equal(m.regions[1].freshRecords,0);
 assert.deepEqual(m.languages.map(r=>r.language),['en','es']);
});
test('unavailable or old snapshot does not imply recent coverage',()=>{
 const empty=buildCoverage(sources,[],[],at);assert.equal(empty.records,0);assert.equal(empty.healthy,0);assert.equal(empty.configured,2);
 const stale=buildCoverage(sources,records,health,'2026-12-01T00:00:00Z');assert.equal(stale.freshRecords,0);assert.equal(stale.healthy,0);
});
test('private, demo, unregistered and future-dated inputs cannot inflate recent records',()=>{
 const extra=[{...records[0],privacyClass:'private'},{...records[0],demo:true},{...records[0],sourceId:'unknown'},{...records[0],retrievedAt:'2026-12-01T00:00:00Z'}];
 const m=buildCoverage(sources,[...records,...extra],health,at);assert.equal(m.records,3);assert.equal(m.freshRecords,1);
});
