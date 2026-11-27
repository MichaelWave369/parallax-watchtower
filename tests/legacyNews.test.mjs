import test from "node:test";
import assert from "node:assert/strict";
import { parseGdeltTimestamp, safeNewsReceipt, buildGdeltProxyUrl, normalizeGdeltArticle, normalizeGdeltArticles, GDELT_DOC_ENDPOINT } from "../lib/legacyNews.mjs";
import { createGdeltHandler } from "../netlify/functions/gdelt-proxy.mjs";
const now = Date.parse("2026-11-27T00:00:00Z");
const article = { title: "Japan earthquake reported by public broadcaster", url: "https://example.org/story", seendate: "20261126T230000Z", sourceCountry: "United States", language: "English" };
const json = (value, init = {}) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" }, ...init });

test("GDELT missing or malformed dates stay unknown and cannot become fresh records", () => {
  for (const raw of [undefined, "", "yesterday", "20260230T120000Z", "20261301T120000Z", "2026-02-30T12:00:00Z", "20261126T250000Z"]) {
    assert.equal(parseGdeltTimestamp(raw), null);
    assert.equal(normalizeGdeltArticle({ ...article, seendate: raw }, "direct", now), null);
  }
  assert.equal(parseGdeltTimestamp(article.seendate), "2026-11-26T23:00:00.000Z");
  assert.equal(parseGdeltTimestamp("2026-11-26T15:00:00-08:00"), "2026-11-26T23:00:00.000Z");
  assert.equal(normalizeGdeltArticle({ ...article, seendate: "20261128T230000Z" }, "direct", now), null);
});

test("generic hazards and publisher origin do not invent Northern California geography", () => {
  for (const title of [article.title, "Wildfire reported in Spain", "Shasta County planning announcement"]) {
    const record = normalizeGdeltArticle({ ...article, title }, "direct", now);
    assert.ok(record);
    assert.equal(record.lat, undefined);
    assert.equal(record.lon, undefined);
    assert.equal(record.locationLabel, undefined);
    assert.match(record.confidenceNotes, /first-seen.*not confirmed publication or event occurrence/);
    assert.equal(record.facts.sourceCountry, "United States");
    assert.equal(record.confidence, "reported");
  }
});

test("source links reject executable schemes, credentials, local/IP hosts, and unsafe ports", () => {
  for (const url of ["javascript:alert(1)", "http://example.org", "https://user:pass@example.org", "https://localhost/story", "https://127.0.0.1/story", "https://2130706433/story", "https://[::1]/story", "https://metadata.internal/", "https://example.org:8443/story", "https://example.org/\nattack"]) {
    assert.equal(safeNewsReceipt(url), null, url);
    assert.equal(normalizeGdeltArticle({ ...article, url }, "direct", now), null, url);
  }
  assert.equal(safeNewsReceipt("https://example.org/story#tracker"), "https://example.org/story");
});

test("GDELT normalization deduplicates receipt URLs with stable transport-independent IDs", () => {
  const direct = normalizeGdeltArticles([article, { ...article, title: "Revised title" }], "direct", now);
  const proxy = normalizeGdeltArticles([article], "proxy", now);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].id, proxy[0].id);
  assert.throws(() => normalizeGdeltArticles({ articles: [] }), /article list/);
  assert.equal(normalizeGdeltArticles(Array(100).fill(article), "direct", now).length, 1);
});

test("proxy configuration accepts public HTTPS or same-origin paths and rejects corrupt stored URLs", () => {
  assert.equal(buildGdeltProxyUrl("", "http://127.0.0.1:4173"), "");
  const local = new URL(buildGdeltProxyUrl("/.netlify/functions/gdelt-proxy", "http://127.0.0.1:4173"));
  assert.equal(local.origin, "http://127.0.0.1:4173");
  assert.equal(local.searchParams.get("maxrecords"), "20");
  const remote = new URL(buildGdeltProxyUrl("https://news.example.org/proxy#secret", "https://watch.example.org"));
  assert.equal(remote.hash, "");
  for (const raw of ["%%invalid", "javascript:alert(1)", "http://elsewhere.example.org/proxy", "https://127.0.0.1/", "//unsafe.example.org/"]) {
    assert.throws(() => buildGdeltProxyUrl(raw, "http://127.0.0.1:4173"), /public HTTPS/);
  }
});

test("public proxy keeps a fixed upstream and exports only validated article metadata", async () => {
  const handler = createGdeltHandler(async (url, options) => {
    assert.equal(new URL(url).origin + new URL(url).pathname, GDELT_DOC_ENDPOINT);
    assert.equal(new URL(url).searchParams.get("maxrecords"), "20");
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal);
    return json({ articles: [article, { ...article, url: "javascript:alert(1)" }], secret: "not-forwarded" });
  });
  const response = await handler({ queryStringParameters: { url: "https://private.invalid" } });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.articles.length, 1);
  assert.equal(body.secret, undefined);
  assert.equal(body.articles[0].url, article.url);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("public proxy bounds request parameters before making any network request", async () => {
  let requests = 0;
  const handler = createGdeltHandler(async () => { requests += 1; return json({ articles: [] }); });
  for (const params of [{ maxrecords: "500" }, { maxrecords: "0" }, { maxrecords: "2.5" }, { query: "x".repeat(601) }, { query: ["bad"] }, { query: "a\nb" }]) {
    assert.equal((await handler({ queryStringParameters: params })).statusCode, 400);
  }
  assert.equal((await handler({ httpMethod: "POST" })).statusCode, 405);
  assert.equal((await handler({ httpMethod: "OPTIONS" })).statusCode, 204);
  assert.equal(requests, 0);
});

test("public proxy rejects redirects, malformed feeds, oversized bodies and raw error leakage", async () => {
  const responses = [new Response("", { status: 302, headers: { location: "https://private.invalid" } }), new Response("<html>login</html>", { headers: { "content-type": "text/html" } }), json({ error: "no feed" }), json({ articles: [], padding: "x".repeat(400) }), json({ articles: [] }, { headers: { "content-type": "application/json", "content-length": "1000" } })];
  for (const upstream of responses) {
    const handler = createGdeltHandler(async () => upstream, { maxBytes: 200 });
    const response = await handler({});
    assert.equal(response.statusCode, 502);
    assert.equal(JSON.parse(response.body).articles, undefined);
    assert.equal(response.headers["cache-control"], "no-store");
  }
  const handler = createGdeltHandler(async () => { throw new Error("private machine token details"); });
  const response = await handler({});
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /private machine token/);
});

test("public proxy deadline aborts both request and streamed response reads", async () => {
  let abortedRequest = false;
  const fetchHandler = createGdeltHandler(async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => { abortedRequest = true; reject(new Error("aborted")); }, { once: true });
  }), { timeoutMs: 10 });
  assert.equal((await fetchHandler({})).statusCode, 502);
  assert.equal(abortedRequest, true);
  let abortedBody = false;
  const bodyHandler = createGdeltHandler(async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener("abort", () => { abortedBody = true; controller.error(new Error("aborted")); }, { once: true });
    }
  }), { headers: { "content-type": "application/json" } }), { timeoutMs: 10 });
  assert.equal((await bodyHandler({})).statusCode, 502);
  assert.equal(abortedBody, true);
});

test('proxy HTTP and content-type rejection cancel unread response bodies and abort transport',async()=>{
  for(const kind of ['http','type']) {
    let cancelled=false, signal;
    const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),kind==='http'?{status:503,headers:{'content-type':'application/json'}}:{headers:{'content-type':'text/html'}});
    const handler=createGdeltHandler(async(_url,options)=>{signal=options.signal;return response;});
    assert.equal((await handler({})).statusCode,502);
    assert.equal(cancelled,true);assert.equal(signal.aborted,true);
  }
});

test('proxy rejects oversized streamed data even when upstream cancellation never settles',async()=>{
  let cancelled=false;
  const body=new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(100)));},
    cancel(){cancelled=true;return new Promise(()=>{});}
  });
  const handler=createGdeltHandler(async()=>new Response(body,{headers:{'content-type':'application/json'}}),{maxBytes:20,timeoutMs:30});
  let timer;
  try{
    const response=await Promise.race([handler({}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('cancellation blocked error response')),200);})]);
    assert.equal(response.statusCode,502);assert.equal(cancelled,true);
  }finally{clearTimeout(timer);}
});
