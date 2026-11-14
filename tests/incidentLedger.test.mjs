import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INCIDENT_CASES, INCIDENT_LEDGER_VERSION, buildIncidentBrief, filterIncidentCases, isSafeIncidentUrl, validateIncident, validateIncidentLibrary } from "../lib/incidentLedger.mjs";
import { EXPLORE_SOURCES } from "../lib/exploreCatalog.mjs";

test("two independently sourced FAA cases have valid receipts and explicit uncertainty", () => {
  assert.equal(INCIDENT_LEDGER_VERSION, "phi.watchtower.incidents.v1");
  assert.equal(INCIDENT_CASES.length, 2);
  assert.equal(validateIncidentLibrary(INCIDENT_CASES), true);
  assert.ok(INCIDENT_CASES.every((incident) => incident.timeline.some(e => e.evidenceType === "preliminary_attributed")));
  assert.ok(INCIDENT_CASES.every((incident) => incident.sources.every(s => s.kind.startsWith("official_"))));
  assert.notEqual(INCIDENT_CASES[0].systems[0], INCIDENT_CASES[1].systems[0]);
});

test("timestamps preserve approximation and day-only precision", () => {
  const older = INCIDENT_CASES.find(c=>c.eventDate === "2023-01-11");
  const newer = INCIDENT_CASES.find(c=>c.eventDate === "2026-11-13");
  assert.ok(older.timeline.some(e=>e.precision==="approximate_minute" && /around/.test(e.displayAt)));
  assert.ok(newer.timeline.some(e=>e.precision==="minute" && /advisory/.test(e.displayAt)));
  assert.ok(newer.sources.some(s=>s.url.includes("fly.faa.gov")));
  assert.ok(older.timeline.some(e=>e.precision==="day" && !e.timestamp));
  assert.ok(INCIDENT_CASES.every(c=>validateIncident(c)));
});

test("all discovery links come from catalog, not from claimed incident receipts", () => {
  for (const incident of INCIDENT_CASES) {
    for (const id of incident.contextResourceIds) {
      assert.ok(EXPLORE_SOURCES.some(r=>r.id===id));
      assert.ok(incident.sources.every(s=>s.id!==id));
    }
  }
});

test("case search supports title, date and affected system", () => {
  assert.equal(filterIncidentCases(INCIDENT_CASES,"  NOTAM ").length,1);
  assert.equal(filterIncidentCases(INCIDENT_CASES,"2026").length,1);
  assert.equal(filterIncidentCases(INCIDENT_CASES,"database synchronization")[0].eventDate,"2023-01-11");
  assert.equal(filterIncidentCases(INCIDENT_CASES,"unknown").length,0);
});

test("copied briefs include their case-specific original receipts", () => {
  const newest = buildIncidentBrief(INCIDENT_CASES[0]);
  const oldest = buildIncidentBrief(INCIDENT_CASES[1]);
  assert.match(newest,/fly\.faa\.gov/);
  assert.match(newest,/preliminary account, not a settled root cause/i);
  assert.match(oldest,/faa\.gov\/testimony/);
  assert.match(oldest,/unintentionally deleted files/i);
  assert.doesNotMatch(oldest,/transportation\.gov\/briefing-room/);
});

test("static published JSON matches canonical cases", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../public/data/incident-ledger.v1.json",import.meta.url),"utf8"));
  assert.equal(snapshot.schema, INCIDENT_LEDGER_VERSION);
  assert.equal(snapshot.mode,"editorial-historical-snapshot");
  assert.deepEqual(snapshot.cases, INCIDENT_CASES);
});

test("rejects unsafe links, invalid evidence, broken relationships", () => {
  assert.equal(isSafeIncidentUrl("https://www.faa.gov"),true);
  assert.equal(isSafeIncidentUrl("javascript:alert(1)"),false);
  assert.equal(isSafeIncidentUrl("http://example.com"),false);
  assert.equal(validateIncident({ ...INCIDENT_CASES[0], sources: [] }),false);
  assert.equal(validateIncident({ ...INCIDENT_CASES[0], timeline:[{...INCIDENT_CASES[0].timeline[0],sourceIds:["bad-source"]}] }),false);
  assert.equal(validateIncidentLibrary([{ ...INCIDENT_CASES[0], relatedCaseIds:["missing"] }]),false);
});
