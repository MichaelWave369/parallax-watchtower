import test from 'node:test';
import assert from 'node:assert/strict';
import { readNewsStorage } from '../lib/newsWorkspace.mjs';

test('a blocked IndexedDB open closes a late database handle after reporting failure', async()=>{
  let closed = 0, transactionStarted = false;
  const request = {
    result: {
      close() { closed += 1; },
      transaction() { transactionStarted = true; throw new Error('must not read a rejected database'); }
    }
  };
  const factory = { open() {
    queueMicrotask(()=>{
      request.onblocked();
      // Simulate the competing tab releasing its lock after the caller already
      // received a recoverable storage error.
      setTimeout(()=>request.onsuccess(),0);
    });
    return request;
  }};
  await assert.rejects(readNewsStorage(factory), /Close another Watchtower tab/);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(closed,1);
  assert.equal(transactionStarted,false);
});
