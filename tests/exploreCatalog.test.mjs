import test from "node:test";
import assert from "node:assert/strict";
import { EXPLORE_CATEGORIES, EXPLORE_SOURCES, filterExploreSources, isSafeExploreUrl } from "../lib/exploreCatalog.mjs";

test("catalog preserves 50 distinct user-curated resources with valid HTTPS external links", () => {
  assert.equal(EXPLORE_SOURCES.length, 50);
  assert.equal(new Set(EXPLORE_SOURCES.map((source) => source.id)).size, 50);
  assert.equal(new Set(EXPLORE_SOURCES.map((source) => source.url)).size, 50);
  assert.ok(EXPLORE_SOURCES.every((source) =>
    isSafeExploreUrl(source.url) &&
    source.access === "external-link" &&
    source.verification === "not-checked" &&
    Boolean(source.description)));
});

test("all catalog entries use a known category", () => {
  const categoryIds = new Set(EXPLORE_CATEGORIES.map((category) => category.id));
  assert.equal(EXPLORE_CATEGORIES.length, 6);
  assert.ok(EXPLORE_SOURCES.every((source) => categoryIds.has(source.category)));
  assert.equal(EXPLORE_CATEGORIES.reduce((sum, category) =>
    sum + filterExploreSources(EXPLORE_SOURCES, { category: category.id }).length, 0), 50);
});

test("search finds resources by name, topic or domain, and combines category filters", () => {
  assert.deepEqual(filterExploreSources(EXPLORE_SOURCES, {query:"  SUBMARINE  "}).map((s) => s.id), ["07"]);
  assert.deepEqual(filterExploreSources(EXPLORE_SOURCES, {category:"space",query:"NASA"}).map((s) => s.id), ["21", "23", "24"]);
  assert.equal(filterExploreSources(EXPLORE_SOURCES, {category:"archive",query:"NASA"}).length,0);
  assert.equal(filterExploreSources(EXPLORE_SOURCES, {query:"does-not-exist"}).length,0);
});

test("malformed and unsafe URLs are rejected", () => {
  assert.equal(isSafeExploreUrl("javascript:alert(1)"),false);
  assert.equal(isSafeExploreUrl("http://example.com"),false);
  assert.equal(isSafeExploreUrl("https://user:password@example.com"),false);
  assert.equal(isSafeExploreUrl("not a url"),false);
  assert.equal(isSafeExploreUrl("https://arxiv.org"),true);
});
