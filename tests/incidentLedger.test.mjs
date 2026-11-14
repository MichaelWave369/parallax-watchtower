import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INCIDENT_CASES, INCIDENT_LEDGER_VERSION, buildIncidentBrief, isSafeIncidentUrl, validateIncident } from "../lib/incidentLedger.mjs";
import { EXPLORE_SOURCES } from "../lib/exploreCatalog.mjs";

test("FAA case has fully attributed official receipts and no synthetic timestamps", () => {
  assert.equal(INCIDENT_LEDGER_VERSION, "phi.watchtower.incidents.v1");
  assert.equal(INCIDENT_CASES.length, 1);
  const incident = INCIDENT_CASES[0];
  assert.equal(incident.eventDate, "2026-11-13");
  assert.equal(incident.phaseAsOf, "2026-11-14");
  assert.equal(validateIncident(incident), true);
  assert.ok(incident.timeline.some((event) => event.evidenceType === "preliminary_attributed"));
  assert.ok(incident.timeline.some((event) => event.precision === "day" && /time not/.test(event.displayAt)));
  assert.ok(incident.timeline.every((event) => event.precision === "day" ? !event.timestamp : !event.date));
  assert.ok(incident.sources.every((source) => source.kind === "official_statement"));
});

test("all contextual discovery links are from the curated catalog, never evidence receipts", () => {
  const incident = INCIDENT_CASES[0];
  assert.equal(incident.contextResourceIds.length, 4);
  for (const id of incident.contextResourceIds) {
    assert.ok(EXPLORE_SOURCES.some((resource) => resource.id === id));
    assert.ok(incident.sources.every((source) => source.id !== id));
  }
});

test("copy brief includes qualifying language and original URLs", () => {
  const brief = buildIncidentBrief(INCIDENT_CASES[0]);
  assert.match(brief, /preliminary account, not a settled root cause/i);
  assert.match(brief, /time not published/i);
  assert.match(brief, /transportation.gov/);
  assert.match(brief, /not a live FAA status feed/i);
});

test("serialized static artifact mirrors canonical editorial case", () => {
  const payload = JSON.parse(readFileSync(new URL("../public/data/incident-ledger.v1.json", import.meta.url), "utf8"));
  assert.equal(payload.schema, INCIDENT_LEDGER_VERSION);
  assert.equal(payload.mode, "editorial-historical-snapshot");
  assert.deepEqual(payload.cases, INCIDENT_CASES);
});

test("rejects malformed URL and missing evidence", () => {
  assert.equal(isSafeIncidentUrl("https://www.transportation.gov/"), true);
  assert.equal(isSafeIncidentUrl("http://example.com"), false);
  assert.equal(isSafeIncidentUrl("javascript:alert(1)"), false);
  assert.equal(validateIncident({ ...INCIDENT_CASES[0], sources: [] }), false);
});
