import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNewsRevisions, revisionsForRecord, REVISION_LIMIT, REVISION_PER_RECEIPT } from '../lib/newsRevisions.mjs';
const now='2026-11-27T00:00:00Z';
const row=(extra={})=>({sourceId:'nasa-news',publisher:'NASA',originGroup:'nasa',title:'Fixture initial',url:'https://www.nasa.gov/fixture/',language:'en',topics:['science'],privacyClass:'public',demo:false,retrievedAt:'2026-11-26T10:00:00Z',...extra});
test('identical observations collapse but changes and reversion are retained by source receipt',()=>{
 const a=row(), b=row({retrievedAt:'2026-11-26T11:00:00Z'}), c=row({title:'Fixture revised',retrievedAt:'2026-11-26T12:00:00Z'}), d=row({retrievedAt:'2026-11-26T13:00:00Z'});
 const versions=mergeNewsRevisions([], [d,c,b,a], {now});
 assert.deepEqual(versions.map(r=>r.title),['Fixture initial','Fixture revised','Fixture initial']);
 assert.equal(versions[2].retrievedAt,'2026-11-26T10:00:00.000Z');
 assert.equal(versions[0].publishedAt,null);
 assert.equal(revisionsForRecord(versions,versions[0]).length,3);
});
test('same-clock conflict keeps earlier observation; distinct sources and URLs do not mix',()=>{
 const old=mergeNewsRevisions([], [row()],{now});
 const rows=mergeNewsRevisions(old,[row({title:'conflicting same time'}),row({sourceId:'un-geneva',url:'https://www.ungeneva.org/fixture'}),row({url:'https://www.nasa.gov/different/'})],{now});
 assert.equal(revisionsForRecord(rows,old[0]).length,1);
 assert.equal(revisionsForRecord(rows,old[0])[0].title,'Fixture initial');
 assert.equal(rows.length,3);
});
test('manual imports, private records, stale receipts and invalid timestamps never enter history',()=>{
 const rows=mergeNewsRevisions([], [row({sourceId:'manual'}),row({privacyClass:'private'}),row({demo:true}),row({retrievedAt:'2026-10-01T00:00:00Z'}),row({retrievedAt:'2027-01-01T00:00:00Z'}),row({notes:'private'})],{now,retentionDays:7});
 assert.equal(rows.length,1);assert.equal('notes' in rows[0],false);
});
test('per-receipt and global caps are bounded with newest observations preserved',()=>{
 const batch=Array.from({length:10},(_,i)=>row({title:'Fixture '+i,retrievedAt:new Date(Date.parse(now)-(10-i)*60000).toISOString()}));
 const rows=mergeNewsRevisions([],batch,{now});
 assert.equal(rows.length,REVISION_PER_RECEIPT);assert.equal(rows[0].title,'Fixture 9');
 let all=[];
 for(let group=0;group<3;group++)all=mergeNewsRevisions(all,Array.from({length:600},(_,i)=>row({url:'https://www.nasa.gov/fixture/'+group+'/'+i,retrievedAt:new Date(Date.parse(now)-(3-group)*60000).toISOString()})),{now});
 assert.equal(all.length,REVISION_LIMIT);assert.ok(all.every(r=>!r.url.includes('/fixture/0/')));
});
