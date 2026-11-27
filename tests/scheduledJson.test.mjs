import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchScheduledJson } from '../lib/scheduledJson.mjs';
import { refreshDiscoveryLeads } from '../scripts/refreshDiscoveryLeads.mjs';
import { refreshOrbitalCatalog } from '../scripts/refreshOrbitalCatalog.mjs';
import { USGS_DISCOVERY_URL,EONET_DISCOVERY_URL,makeDiscoveryCache,readDiscoveryCache } from '../lib/discoveryCache.mjs';
import { ORBITAL_GROUPS,makeOrbitalSnapshot,validateOrbitalSnapshot } from '../lib/orbitalCatalog.mjs';
const now=Date.parse('2026-11-27T00:00:00Z');
const usgs={type:'FeatureCollection',features:[{id:'fixture-quake',properties:{type:'earthquake',mag:5.4,title:'Fixture catalog earthquake',place:'Fixture region',url:'https://earthquake.usgs.gov/earthquakes/eventpage/fixture-quake',time:now-2*3600000}}]};
const eonet={events:[{id:'EONET_FIXTURE',title:'Fixture curated wildfire',closed:null,geometry:[{type:'Point',date:new Date(now-2*3600000).toISOString(),coordinates:[-121,40]}]}]};
const omm={OBJECT_NAME:'PUBLIC TEST ORBIT',OBJECT_ID:'2026-001A',EPOCH:'2026-11-26T23:40:00.000',NORAD_CAT_ID:61001,MEAN_MOTION:15,ECCENTRICITY:0.000583,INCLINATION:98.3164,RA_OF_ASC_NODE:103.8411,ARG_OF_PERICENTER:20.5667,MEAN_ANOMALY:339.5789,BSTAR:0.00048021,MEAN_MOTION_DOT:0.00005995,MEAN_MOTION_DDOT:0,EPHEMERIS_TYPE:0,CLASSIFICATION_TYPE:'U',ELEMENT_SET_NO:999,REV_AT_EPOCH:8655};
const json=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
function oversized(bytes,onCancel=()=>{}) {return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(bytes));},cancel:onCancel}),{headers:{'content-type':'application/json'}});}
async function inTemp(fn){const dir=await mkdtemp(join(tmpdir(),'watchtower-scheduled-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}

test('scheduled transport accepts only the four existing fixed source URLs and refuses redirects without retries',async()=>{
  let calls=0,cancelled=false,requestSignal;
  const fetchImpl=async(_url,options)=>{calls++;requestSignal=options.signal;return new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:302,headers:{location:'http://127.0.0.1/'}});};
  await assert.rejects(fetchScheduledJson('https://attacker.example.org/',{fetchImpl}),/allowlisted/);assert.equal(calls,0);
  await assert.rejects(fetchScheduledJson(USGS_DISCOVERY_URL,{fetchImpl}),/HTTP 302/);assert.equal(calls,1);assert.equal(cancelled,true);assert.equal(requestSignal.aborted,true);
});
test('scheduled transport keeps the deadline active through a stalled body and aborts it',async()=>{
  let requestSignal,cancelled=false;
  await assert.rejects(fetchScheduledJson(EONET_DISCOVERY_URL,{timeoutMs:15,fetchImpl:async(_url,options)=>{
    requestSignal=options.signal;return new Response(new ReadableStream({cancel(){cancelled=true;}}));
  }}),/timed out/);
  assert.equal(requestSignal.aborted,true);assert.equal(cancelled,true);
});
test('oversized chunked discovery responses never replace the existing published cache',async()=>inTemp(async dir=>{
  const output=join(dir,'discovery.json');const before=JSON.stringify(makeDiscoveryCache({usgsPayload:usgs,eonetPayload:eonet},now-3*3600000))+'\n';await writeFile(output,before);
  let calls=0,cancellations=0;const signals=[];
  const result=await refreshDiscoveryLeads({output,now,fetchImpl:async(_url,options)=>{calls++;signals.push(options.signal);return oversized(2_000_001,()=>{cancellations++;});}});
  assert.equal(result.published,false);assert.equal(result.unavailable,true);assert.equal(await readFile(output,'utf8'),before);
  assert.equal(calls,2);assert.equal(cancellations,2);assert.ok(signals.every(s=>s.aborted));
}));
test('finite discovery fixtures preserve schema and its existing ten-hour no-change write suppression',async()=>inTemp(async dir=>{
  const output=join(dir,'discovery.json');let calls=0;
  const fetchImpl=async url=>{calls++;assert.ok([USGS_DISCOVERY_URL,EONET_DISCOVERY_URL].includes(url));return json(url===USGS_DISCOVERY_URL?usgs:eonet);};
  const first=await refreshDiscoveryLeads({output,now,fetchImpl});assert.equal(first.published,true);assert.equal(first.snapshot.status,'ok');assert.equal(first.snapshot.candidates.length,2);
  const bytes=await readFile(output,'utf8');assert.equal(readDiscoveryCache(JSON.parse(bytes),now).state,'fresh');
  const second=await refreshDiscoveryLeads({output,now:now+3600000,fetchImpl});assert.equal(second.published,false);assert.equal(second.reason,'unchanged');assert.equal(await readFile(output,'utf8'),bytes);assert.equal(calls,4);
}));
test('oversized chunked second orbital group fails before publishing and retains the complete prior file',async()=>inTemp(async dir=>{
  const outputPath=join(dir,'orbits.json');const before=JSON.stringify(makeOrbitalSnapshot([{key:'stations',items:[omm]}],new Date(now-3*3600000).toISOString()))+'\n';await writeFile(outputPath,before);
  let calls=0,cancelled=false;const signals=[];
  await assert.rejects(refreshOrbitalCatalog({outputPath,now,fetchImpl:async(_url,options)=>{signals.push(options.signal);calls++;return calls===1?json([omm]):oversized(3_000_001,()=>{cancelled=true;});}}),/size limit/);
  assert.equal(await readFile(outputPath,'utf8'),before);assert.equal(calls,2);assert.equal(cancelled,true);assert.ok(signals.every(s=>s.aborted));
}));
test('finite orbital fixtures preserve output and the 2h15m shared cooldown prevents any provider calls',async()=>inTemp(async dir=>{
  const outputPath=join(dir,'orbits.json');let calls=0;
  const fetchImpl=async url=>{calls++;assert.ok(ORBITAL_GROUPS.some(g=>g.url===url));return json([{...omm,NORAD_CAT_ID:url===ORBITAL_GROUPS[0].url?61001:61002}]);};
  const first=await refreshOrbitalCatalog({outputPath,now,fetchImpl});assert.equal(first.published,true);assert.equal(first.snapshot.items.length,2);
  const bytes=await readFile(outputPath,'utf8');assert.equal(validateOrbitalSnapshot(JSON.parse(bytes),now).length,2);
  const second=await refreshOrbitalCatalog({outputPath,now:now+2*3600000,fetchImpl});assert.equal(second.reason,'cooldown');assert.equal(await readFile(outputPath,'utf8'),bytes);assert.equal(calls,2);
}));
