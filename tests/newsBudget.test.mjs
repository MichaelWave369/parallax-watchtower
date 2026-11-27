import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateNewsBatches } from '../lib/newsBudget.mjs';
import { NEWS_MAX_RECORDS, NEWS_SCHEMA, validateNewsSnapshot, normalizeNewsRecord } from '../lib/newsContract.mjs';

test('36-source saturation retains every source and exact public contract counts', () => {
  const at='2026-11-27T00:00:00.000Z';
  const batches=Array.from({length:36},(_,i)=>Array.from({length:30},(_,j)=>normalizeNewsRecord({
    id:`story-${i}-${j}`, sourceId:`source-${i}`, publisher:'Fixture', originGroup:`origin-${i}`,
    title:`Fixture ${i} report ${j}`, url:`https://example.org/${i}/${j}`, retrievedAt:at,
    privacyClass:'public', demo:false
  },at)));
  const {records,counts}=allocateNewsBatches(batches,NEWS_MAX_RECORDS);
  assert.equal(records.length,600);
  assert.equal(Math.min(...counts),16);
  assert.equal(Math.max(...counts),17);
  const sources=counts.map((recordCount,i)=>({id:`source-${i}`,status:'ok',recordCount}));
  assert.ok(validateNewsSnapshot({schema:NEWS_SCHEMA,generatedAt:at,sources,records},at));
  for (let i=0;i<batches.length;i++) assert.deepEqual(records.filter(r=>r.sourceId===`source-${i}`),batches[i].slice(0,counts[i]));
  assert.deepEqual(allocateNewsBatches(batches,NEWS_MAX_RECORDS),{records,counts});
});

test('unused slots redistribute without changing the remaining source order',()=>{
  const batches=[[1,2,3],[],[4],[5,6,7]];
  assert.deepEqual(allocateNewsBatches(batches,5),{records:[1,4,5,2,6],counts:[2,0,1,2]});
  assert.deepEqual(allocateNewsBatches(batches,100),{records:[1,4,5,2,6,3,7],counts:[3,0,1,3]});
  assert.deepEqual(batches,[[1,2,3],[],[4],[5,6,7]]);
});

test('empty and zero budget cases are explicit; invalid budgets rejected',()=>{
  assert.deepEqual(allocateNewsBatches([[],[]],600),{records:[],counts:[0,0]});
  assert.deepEqual(allocateNewsBatches([[1],[2]],0),{records:[],counts:[0,0]});
  for(const limit of [-1,1.5,Infinity,NaN])assert.throws(()=>allocateNewsBatches([],limit),RangeError);
});

test('under-budget batches retain original references, provenance and clocks',()=>{
  const first=Object.freeze({retrievedAt:'2026-11-26T00:00:00Z',sourceId:'retained'});
  const second=Object.freeze({retrievedAt:'2026-11-27T00:00:00Z',sourceId:'fresh'});
  const result=allocateNewsBatches([[first],[second]],600);
  assert.equal(result.records[0],first);
  assert.equal(result.records[1],second);
  assert.deepEqual(result.counts,[1,1]);
});
