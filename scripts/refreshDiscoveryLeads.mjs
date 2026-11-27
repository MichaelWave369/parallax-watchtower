// One centrally scheduled provider read per source; never fetch these per user browser.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EONET_DISCOVERY_URL, USGS_DISCOVERY_URL, makeDiscoveryCache
} from "../lib/discoveryCache.mjs";
import { fetchScheduledJson } from "../lib/scheduledJson.mjs";

async function fetchOne(label, url, fetchImpl) {
  try { return await fetchScheduledJson(url,{fetchImpl}); }
  catch (error) {
    console.warn(label + " unavailable: " + (error instanceof Error ? error.message : "request failed"));
    return null;
  }
}
export async function refreshDiscoveryLeads({output="public/data/discovery-candidates.v1.json",now=Date.now(),fetchImpl=fetch}={}) {
  const nowMs=typeof now==='number'?now:Date.parse(now);
  const [usgsPayload, eonetPayload] = await Promise.all([
    fetchOne("USGS", USGS_DISCOVERY_URL, fetchImpl),
    fetchOne("NASA EONET", EONET_DISCOVERY_URL, fetchImpl)
  ]);
  const snapshot = makeDiscoveryCache({ usgsPayload, eonetPayload }, nowMs);
  if (snapshot.status === "unavailable") {
    console.error("Both official providers were unavailable/invalid. Last published file left unchanged.");
    return {published:false,unavailable:true,snapshot};
  }
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
    return {published:false,reason:'unchanged',snapshot};
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log("Wrote " + snapshot.candidates.length + " unreviewed candidates: " + snapshot.status);
  return {published:true,snapshot};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{const result=await refreshDiscoveryLeads();if(result.unavailable)process.exitCode=1;}
  catch(error){console.error(error instanceof Error?error.message:'Discovery refresh failed');process.exitCode=1;}
}
