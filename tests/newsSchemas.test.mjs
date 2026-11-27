import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateNewsSnapshot } from '../lib/newsContract.mjs';
import { clusterEvents, makeNewsBriefing } from '../lib/newsIntelligence.mjs';

test('published schemas validate actual normalized snapshot, records, events and briefings', async()=>{
  const ajv = new Ajv2020({ allErrors:true, strict:true }); addFormats(ajv);
  const schemas = await Promise.all(['record','snapshot','event','briefing'].map(async name=>JSON.parse(await readFile(new URL('../public/schemas/news-'+name+'.schema.json',import.meta.url),'utf8'))));
  for(const schema of schemas) ajv.addSchema(schema);
  const raw = JSON.parse(await readFile(new URL('../public/data/news.v1.json',import.meta.url),'utf8'));
  const snapshot = validateNewsSnapshot(raw,raw.generatedAt);
  assert.ok(snapshot);
  const recordValidator = ajv.getSchema(schemas[0].$id), snapshotValidator = ajv.getSchema(schemas[1].$id), eventValidator=ajv.getSchema(schemas[2].$id), briefValidator=ajv.getSchema(schemas[3].$id);
  assert.ok(snapshotValidator(snapshot),JSON.stringify(snapshotValidator.errors));
  for(const row of snapshot.records) assert.ok(recordValidator(row),JSON.stringify(recordValidator.errors));
  for(const event of clusterEvents(snapshot.records,{now:raw.generatedAt})) assert.ok(eventValidator(event),JSON.stringify(eventValidator.errors));
  assert.ok(briefValidator(makeNewsBriefing(snapshot.records,{now:raw.generatedAt,windowHours:168})),JSON.stringify(briefValidator.errors));
  assert.equal(recordValidator({...snapshot.records[0],privacyClass:'private_local'}),false);
  assert.equal(snapshotValidator({...snapshot,privateNotes:'secret'}),false);
});
