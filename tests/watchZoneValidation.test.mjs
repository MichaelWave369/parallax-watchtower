import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWatchZone, readSavedWatchZones } from '../lib/watchZoneValidation.mjs';
const zone={name:'Local lens',lat:39.9277,lon:-122.1792,radiusKm:250};
test('watch lenses preserve valid boundaries and strip arbitrary persisted fields',()=>{
  assert.deepEqual(normalizeWatchZone({...zone,privateToken:'secret'}),{...zone,source:'saved'});
  assert.ok(normalizeWatchZone({...zone,lat:-90,lon:180,radiusKm:20000}));
  assert.ok(normalizeWatchZone({...zone,lat:90,lon:-180,radiusKm:0.1}));
});
test('invalid geographic ranges, radii and numeric strings never reach renderers',()=>{
  for(const extra of [{lat:90.1},{lat:-91},{lon:180.01},{lon:-181},{radiusKm:0},{radiusKm:-1},{radiusKm:20000.1},{lat:NaN},{lon:Infinity},{lat:'39.9'},{radiusKm:'250'},{name:''}]){
    assert.equal(normalizeWatchZone({...zone,...extra}),null);
  }
  assert.equal(normalizeWatchZone(null),null);assert.equal(normalizeWatchZone([]),null);
});
test('recovery rejects malformed saved lenses, deduplicates names, and bounds storage',()=>{
  const list=readSavedWatchZones(JSON.stringify([zone,{...zone,lat:99},{...zone,lon:300},{...zone,radiusKm:-1},{...zone,privateToken:'hidden'}]));
  assert.equal(list.length,1);assert.equal('privateToken' in list[0],false);
  assert.deepEqual(readSavedWatchZones('invalid json'),[]);assert.deepEqual(readSavedWatchZones('{}'),[]);
  assert.equal(readSavedWatchZones(JSON.stringify(Array.from({length:40},(_,i)=>({...zone,name:'Zone'+i})))).length,12);
});
