import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMapState, mapLifecycle } from '../lib/mapLifecycle.mjs';
test('loading never hides offline geography before actual rendered features, and empty style cannot become ready',()=>{
 let s=mapLifecycle(initialMapState(),{type:'START'}); const a=s.attempt;
 s=mapLifecycle(s,{type:'STYLE_LOADING',attempt:a});s=mapLifecycle(s,{type:'STYLE_READY',attempt:a});
 assert.equal(s.phase,'loading_geography');assert.equal(s.renderer,'offline');
 assert.equal(mapLifecycle(s,{type:'GEOGRAPHY_READY',attempt:a,featureCount:0}).renderer,'offline');
 s=mapLifecycle(s,{type:'GEOGRAPHY_READY',attempt:a,featureCount:8});assert.equal(s.phase,'ready');assert.equal(s.renderer,'vector');
});
test('provider errors recover at most once to independent geography, then offline, with stale callbacks ignored',()=>{
 let s=mapLifecycle(initialMapState(),{type:'START'});const old=s.attempt;
 for(let i=0;i<2;i++){s=mapLifecycle(s,{type:'FAIL',attempt:s.attempt,reason:'worker failure'});assert.equal(s.renderer,'offline');s=mapLifecycle(s,{type:'RECOVER',attempt:s.attempt});s=mapLifecycle(s,{type:'NEXT',attempt:s.attempt});}
 assert.equal(s.phase,'offline_atlas');assert.equal(s.diagnostics.length,2);
 assert.deepEqual(mapLifecycle(s,{type:'GEOGRAPHY_READY',attempt:old,featureCount:100}),s);
 assert.deepEqual(mapLifecycle(s,{type:'FAIL',attempt:old,reason:'late timeout'}),s);
});
test('manual retry changes generation; a late unmount cannot replace a newer globe/offline choice',()=>{
 let s=mapLifecycle(initialMapState(),{type:'START'});const old=s.attempt;
 s=mapLifecycle(s,{type:'GLOBE'});assert.equal(s.renderer,'globe');assert.deepEqual(mapLifecycle(s,{type:'FAIL',attempt:old}),s);
 s=mapLifecycle(s,{type:'OFFLINE'});s=mapLifecycle(s,{type:'START'});assert.ok(s.attempt>old);assert.equal(s.provider,'openfreemap');
});
