import test from 'node:test';
import assert from 'node:assert/strict';
import { compareNewsVisits } from '../lib/newsVisits.mjs';
const now='2026-11-27T00:00:00Z', older='2026-11-26T10:00:00Z', later='2026-11-26T12:00:00Z';
const row=(id,extra={})=>({id,sourceId:'nasa-news',publisher:'NASA',originGroup:'nasa',title:'Fixture '+id,url:'https://www.nasa.gov/fixture/'+id,language:'en',topics:['science'],privacyClass:'public',demo:false,retrievedAt:older,...extra});
function snap(records,generatedAt=older){
 const ids=[...new Set(records.map(r=>r.sourceId))];
 return {schema:'phi.watchtower.news.v1',generatedAt,records,sources:ids.map(id=>({id,status:'ok',recordCount:records.filter(r=>r.sourceId===id).length}))};
}
test('newly listed and revised receipts are separate from repeated retrieval or disappearance',()=>{
 const a=row('a'),b=row('b'),c=row('c'),d=row('d');
 const before=snap([a,b,c]);
 const after=snap([{...a,title:'Fixture revised',retrievedAt:later},{...b,retrievedAt:later},d],later);
 const r=compareNewsVisits(before,after,now);
 assert.equal(r.state,'ready');assert.deepEqual(r.added.map(x=>x.id),['d']);assert.equal(r.revised[0].before.title,a.title);assert.equal(r.revised[0].after.title,'Fixture revised');assert.equal(r.same,1);assert.equal(r.ignored,0);
 assert.equal(r.added[0].retrievedAt,'2026-11-26T10:00:00.000Z');
});
test('first visit, invalid snapshot and rollback never assert changes',()=>{
 const before=snap([row('a')]),after=snap([row('b')],later);
 assert.equal(compareNewsVisits(null,after,now).state,'baseline-needed');
 assert.equal(compareNewsVisits(before,null,now).state,'unavailable');
 assert.equal(compareNewsVisits(after,before,now).state,'older-snapshot');
 assert.deepEqual(compareNewsVisits(before,before,now).added,[]);
});
test('same-clock conflicting metadata and unregistered source are not reported as revisions',()=>{
 const a=row('a');
 const before=snap([a]),after=snap([{...a,title:'Conflict'},row('manual',{sourceId:'manual'})],later);
 const r=compareNewsVisits(before,after,now);
 assert.equal(r.ignored,2);assert.deepEqual(r.revised,[]);assert.deepEqual(r.added,[]);
});
