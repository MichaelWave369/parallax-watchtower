import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewsPreferences, loadNewsPreferences, saveNewsPreferences, mergeNewsArchive, makeNewsArchive, readNewsArchiveImport, matchesNewsQuery } from '../lib/newsWorkspace.mjs';
const now = '2026-11-26T20:00:00.000Z';
const row = (extra = {}) => ({ id:'nasa-a',sourceId:'nasa',publisher:'NASA',originGroup:'nasa',title:'Artemis science update',url:'https://www.nasa.gov/news/artemis',summary:'Public mission research',language:'en',topics:['science'],region:{code:'GLOBAL',label:'Location unspecified',precision:'global'},publishedAt:'2026-11-26T10:00:00.000Z',eventAt:null,modifiedAt:null,retrievedAt:now,kind:'official_statement',evidenceType:'official_statement',privacyClass:'public',demo:false,...extra });

test('workspace preferences are bounded, local, and recover from corrupt or denied storage', () => {
  assert.equal(loadNewsPreferences({getItem(){throw Error();}}).theme,'dark');
  assert.equal(loadNewsPreferences({getItem(){return 'bad json';}}).timeWindow,'168');
  assert.equal(saveNewsPreferences({setItem(){throw Error();}},{}),false);
  const p=normalizeNewsPreferences({theme:'evil',retentionDays:999,pins:Array(200).fill('a'),watchlist:Array.from({length:80},(_,i)=>({id:'w'+i,query:'<script>term</script>'})),notes:[{id:'x',recordId:'y',text:'a',kind:'disputed',referenceUrl:'javascript:alert(1)',createdAt:now}],cloudToken:'secret'});
  assert.equal(p.theme,'dark'); assert.equal(p.retentionDays,30); assert.equal(p.watchlist.length,30); assert.equal(p.pins.length,1);
  assert.equal(p.notes[0].referenceUrl,null); assert.equal('cloudToken' in p,false);
});
test('archive merge deduplicates, keeps retrieval times, enforces retention and strips private data',()=>{
  const r=mergeNewsArchive([row({retrievedAt:'2026-11-25T20:00:00.000Z'})],[row({notes:'secret',watchZone:{lat:2},browserLocation:'private'}),row({id:'old',url:'https://www.nasa.gov/old',retrievedAt:'2026-08-01T00:00:00.000Z'}),row({privacyClass:'private_local'})],{now});
  assert.equal(r.length,1); assert.equal(r[0].retrievedAt,now); assert.equal('notes' in r[0],false); assert.equal('watchZone' in r[0],false);
  assert.equal(mergeNewsArchive([],Array.from({length:2100},(_,i)=>row({id:'a'+i,url:'https://www.nasa.gov/a/'+i})),{now}).length,2000);
});
test('public archive has no personal workspace state and imports downgrade attribution to unreviewed',()=>{
  const pack=makeNewsArchive([row({notes:'PRIVATE',watchlist:['PRIVATE']})],now);
  const text=JSON.stringify(pack);
  assert.equal(text.includes('PRIVATE'),false); assert.equal(pack.scope.watchlistsIncluded,false);
  const imported=readNewsArchiveImport(text,now);
  assert.equal(imported[0].evidenceType,'uncorroborated_claim'); assert.equal(imported[0].sourceId,'manual'); assert.equal(imported[0].publishedAt,'2026-11-26T10:00:00.000Z');
  assert.throws(()=>readNewsArchiveImport(JSON.stringify({...pack,records:[row(),row({url:'javascript:alert(1)'})]}),now),/Nothing was imported/);
  assert.throws(()=>readNewsArchiveImport('a'.repeat(3000001),now),/3 MB/);
});
test('watchlist search requires every term and supports named topics without regex execution',()=>{
  assert.equal(matchesNewsQuery(row(),'artemis science'),true); assert.equal(matchesNewsQuery(row(),'artemis flood'),false); assert.equal(matchesNewsQuery(row(),'.*'),false);
});
test('saved workspaces preserve desk, time window, density and observation filters',()=>{
  const p=normalizeNewsPreferences({savedViews:[{id:'v1',name:'Regional review',query:'Japan',topic:'earthquakes',region:'GLOBAL',desk:'hazards',timeWindow:'24',compact:true,includeObservations:true}]});
  assert.deepEqual(p.savedViews[0],{id:'v1',name:'Regional review',query:'Japan',topic:'earthquakes',region:'GLOBAL',language:'',sourceId:'',desk:'hazards',timeWindow:'24',compact:true,includeObservations:true});
});
test('conflicting import identities fail atomically and cannot attach existing notes to a different receipt',()=>{
  const first=row({id:'shared'}), second=row({id:'shared',url:'https://www.nasa.gov/different-receipt'});
  const raw={schema:'phi.watchtower.news-archive.v1',records:[first,second]};
  assert.throws(()=>readNewsArchiveImport(JSON.stringify(raw),now),/conflicting record identities/);
  const merged=mergeNewsArchive([first],[second],{now});
  assert.equal(merged.length,1);assert.equal(merged[0].url,first.url);
});
test('large public archives roundtrip inside the same UTF-8 size limit with explicit omissions',()=>{
  const input=Array.from({length:2000},(_,i)=>row({id:'a'+i,url:'https://www.nasa.gov/'+i+'x'.repeat(1800),summary:'s'.repeat(350)}));
  const pack=makeNewsArchive(input,now), text=JSON.stringify(pack);
  assert.ok(new TextEncoder().encode(text).byteLength<=3000000);
  assert.ok(pack.omittedCount>0); assert.equal(pack.count+pack.omittedCount,2000);
  assert.equal(readNewsArchiveImport(text,now).length,pack.count);
});

test('language and publisher filters survive saved views and older preferences migrate to all',()=>{
 const old=normalizeNewsPreferences({});assert.equal(old.language,'');assert.equal(old.sourceId,'');
 const p=normalizeNewsPreferences({language:'es',sourceId:'ips-headlines',savedViews:[{id:'v1',name:'Spanish',language:'es',sourceId:'ips-headlines'}]});
 assert.equal(p.language,'es');assert.equal(p.sourceId,'ips-headlines');assert.equal(p.savedViews[0].language,'es');assert.equal(p.savedViews[0].sourceId,'ips-headlines');
 const bad=normalizeNewsPreferences({language:'<script>',sourceId:'https:// unsafe'});assert.equal(bad.language,'');assert.equal(bad.sourceId,'');
});
test('search handles canonical Unicode equivalence without altering source text',()=>{
 const report=row({title:'Café y política',language:'es'});
 assert.equal(matchesNewsQuery(report,'CAFE\u0301 POLI\u0301TICA'),true);
 assert.equal(matchesNewsQuery(report,'cafe'),false);
 assert.equal(matchesNewsQuery(row({title:'日本の研究'}),'日本'),true);
 assert.equal(report.title,'Café y política');
});
