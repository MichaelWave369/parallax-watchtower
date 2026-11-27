import test from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedJson } from '../lib/browserRequests.mjs';

test('bounded browser reader refuses error, oversized body and invalid JSON', async()=>{
  await assert.rejects(readBoundedJson('https://www.nasa.gov/',{fetchImpl:async()=>new Response('error',{status:503})}),/503/);
  await assert.rejects(readBoundedJson('https://www.nasa.gov/',{maxBytes:5,fetchImpl:async()=>new Response('123456')}),/size limit/);
  await assert.rejects(readBoundedJson('https://www.nasa.gov/',{fetchImpl:async()=>new Response('<html>')}),/JSON/);
  let opts;
  assert.deepEqual(await readBoundedJson('https://www.nasa.gov/',{fetchImpl:async(_,o)=>{opts=o;return new Response('{"ok":true}');}}),{ok:true});
  assert.equal(opts.redirect,'error');assert.equal(opts.credentials,'omit');
});
test('browser reader enforces header and body deadline, and caller cancellation',async()=>{
  const delayed=async(_, {signal})=>new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(Error('aborted')));}}));
  await assert.rejects(readBoundedJson('https://www.nasa.gov/',{fetchImpl:delayed,timeoutMs:20}),/timed out/);
  const controller=new AbortController();
  const request=readBoundedJson('https://www.nasa.gov/',{fetchImpl:delayed,signal:controller.signal});
  controller.abort(); await assert.rejects(request,/cancelled/);
});

test('HTTP errors and oversized response headers cancel unread bodies and abort transport', async()=>{
  for (const kind of ['http-error', 'oversized-header']) {
    let cancelled = false, signal;
    const body = new ReadableStream({ cancel() { cancelled = true; } });
    await assert.rejects(readBoundedJson('https://www.nasa.gov/', {
      maxBytes: 20,
      fetchImpl: async (_, options) => {
        signal = options.signal;
        return new Response(body, kind === 'http-error' ? {status:503} : {headers:{'content-length':'21'}});
      }
    }), kind === 'http-error' ? /503/ : /size limit/);
    assert.equal(cancelled, true, kind + ' leaves no unread source body');
    assert.equal(signal.aborted, true, kind + ' stops underlying fetch');
  }
});
