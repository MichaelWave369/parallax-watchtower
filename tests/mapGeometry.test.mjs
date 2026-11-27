import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import { geoArea } from 'd3-geo';
import {normalizeMapView,projectMapPoint,invertMapPoint,panMapView,zoomMapView,clusterMapSignals,globalMapView} from '../lib/mapGeometry.mjs';
test('bundled licensed atlas has actual country boundaries, stable reference labels, and correct spherical winding',async()=>{
 const atlas=JSON.parse(await readFile(new URL('../lib/data/world-atlas.v1.json',import.meta.url),'utf8'));
 assert.equal(atlas.features.length,177);
 for(const f of atlas.features){assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));assert.ok(geoArea(f)>0&&geoArea(f)<Math.PI*2);assert.ok(f.properties.name);assert.equal(f.properties.label.length,2);}
 const receipt=JSON.parse(await readFile(new URL('../lib/data/world-atlas.provenance.json',import.meta.url),'utf8'));assert.equal(createHash('sha256').update(await readFile(new URL('../lib/data/world-atlas.v1.json',import.meta.url))).digest('hex'),receipt.sha256);assert.equal(receipt.license,'Public domain');assert.ok(receipt.sourceCommit.length===40);
});
test('projection roundtrips at antimeridian, preserves drag and mouse-centered zoom',()=>{
 const v={lon:179,lat:20,zoom:3};const p=projectMapPoint(-179,22,v,800,600),q=invertMapPoint(p.x,p.y,v,800,600);
 assert.ok(Math.abs(q.lon+179)<1e-8);assert.ok(Math.abs(q.lat-22)<1e-8);assert.ok(Math.abs(p.x-400)<30);
 const next=zoomMapView(v,1,p.x,p.y,800,600),anchor=projectMapPoint(-179,22,next,800,600);assert.ok(Math.abs(anchor.x-p.x)<1e-7);assert.ok(Math.abs(anchor.y-p.y)<1e-7);
 const moved=panMapView(v,100,50),back=panMapView(moved,-100,-50);assert.ok(Math.abs(back.lon-v.lon)<1e-7);assert.ok(Math.abs(back.lat-v.lat)<1e-7);
 assert.equal(normalizeMapView({lat:99,lon:540,zoom:999}).zoom,12);
});
test('more than 2000 events are represented without truncation; private and unsupported records are not markers',()=>{
 const signals=Array.from({length:2400},(_,i)=>({id:'event-'+i,type:'earthquake',source:'USGS',privacyClass:'public',lat:-60+(i%120),lon:-175+(i%350)}));
 const result=clusterMapSignals([...signals,{...signals[0],id:'private',privacyClass:'private_local'}],globalMapView(900,700),900,700,{selectedId:'event-20'});
 assert.equal(result.eligibleCount,2400);assert.equal(result.visibleCount,2400);assert.equal(result.markers.reduce((n,m)=>n+m.count,0),2400);
 assert.ok(result.markers.length<1000);assert.ok(result.markers.some(m=>m.selected&&m.count===1&&m.id==='event-20'));
});
