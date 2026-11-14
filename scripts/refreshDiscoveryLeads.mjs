// One centrally scheduled provider read per source; never fetch these per user browser.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  EONET_DISCOVERY_URL, USGS_DISCOVERY_URL, makeDiscoveryCache
} from "../lib/discoveryCache.mjs";

const output = "public/data/discovery-candidates.v1.json";
async function fetchOne(label, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(url, {
      cache: "no-store", redirect: "manual", signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "WatchtowerLive/1.0 (scheduled public-source discovery cache)" }
    });
    if (response.status !== 200) throw new Error("HTTP " + response.status);
    const declaredSize = Number(response.headers.get("content-length"));
    if (declaredSize > 2000000) throw new Error("response too large");
    const body = await response.text();
    if (body.length > 2000000) throw new Error("response too large");
    return JSON.parse(body);
  } catch (error) {
    console.warn(label + " unavailable: " + (error instanceof Error ? error.message : "request failed"));
    return null;
  } finally { clearTimeout(timer); }
}

const nowMs = Date.now();
const [usgsPayload, eonetPayload] = await Promise.all([
  fetchOne("USGS", USGS_DISCOVERY_URL),
  fetchOne("NASA EONET", EONET_DISCOVERY_URL)
]);
const snapshot = makeDiscoveryCache({ usgsPayload, eonetPayload }, nowMs);
if (snapshot.status === "unavailable") {
  console.error("Both official providers were unavailable/invalid. Last published file left unchanged.");
  process.exitCode = 1;
} else {
  // Skip writes for equivalent data if a prior snapshot is younger than ten hours.
  let prior = null;
  try { prior = JSON.parse(await readFile(output, "utf8")); } catch {}
  const simplify = (items) => items.map(({ capturedAt, ...candidate }) => candidate);
  const same = prior && prior.status === snapshot.status &&
    JSON.stringify(prior.sources?.map(({ id, status, accepted }) => ({ id, status, accepted }))) ===
    JSON.stringify(snapshot.sources.map(({ id, status, accepted }) => ({ id, status, accepted }))) &&
    JSON.stringify(simplify(prior.candidates ?? [])) === JSON.stringify(simplify(snapshot.candidates));
  const oldAge = nowMs - Date.parse(prior?.generatedAt);
  if (same && oldAge >= 0 && oldAge < 10 * 60 * 60 * 1000) {
    console.log("Candidate cache still within 10-hour no-change interval; skipping write");
  } else {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    console.log("Wrote " + snapshot.candidates.length + " unreviewed candidates: " + snapshot.status);
  }
}
