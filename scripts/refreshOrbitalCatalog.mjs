// Centralized scheduled fetch: GitHub Pages serves cached files, browsers never query CelesTrak.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORBITAL_GROUPS, makeOrbitalSnapshot } from "../lib/orbitalCatalog.mjs";
import { fetchScheduledJson } from "../lib/scheduledJson.mjs";

const minimumInterval = 2 * 60 * 60 * 1000 + 15 * 60 * 1000;
export async function refreshOrbitalCatalog({outputPath="public/data/orbits.json",now=Date.now(),fetchImpl=fetch}={}) {
  const nowMs=typeof now==='number'?now:Date.parse(now);
  try {
    const previous = JSON.parse(await readFile(outputPath, "utf8"));
    const age = nowMs - Date.parse(previous.fetchedAt);
    if (previous.version === 1 && previous.items?.length > 0 && Number.isFinite(age) && age >= 0 && age < minimumInterval) {
      console.log("Using previously fetched catalog: within 2h15m shared cache window");
      return {published:false,reason:'cooldown'};
    }
  } catch { /* First run has no published data; fetch once. */ }

  const groups = [];
  for (const group of ORBITAL_GROUPS) {
    // Provider policy: no retry on any failure or redirect. Deadline covers the streamed body.
    const payload = await fetchScheduledJson(group.url,{fetchImpl});
    if (!Array.isArray(payload)) throw new Error("CelesTrak returned unexpected " + group.key + " format");
    groups.push({ key: group.key, items: payload });
    console.log("Fetched " + group.key + ": " + payload.length + " orbital element entries");
  }
  const snapshot = makeOrbitalSnapshot(groups, new Date(nowMs).toISOString());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot) + "\n", "utf8");
  console.log("Published " + snapshot.items.length + " unique non-ISS orbital elements at " + snapshot.fetchedAt);
  return {published:true,snapshot};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{await refreshOrbitalCatalog();}
  catch(error){console.error(error instanceof Error?error.message:'Orbital catalog refresh failed');process.exitCode=1;}
}
