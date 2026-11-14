// Centralized scheduled fetch: GitHub Pages serves cached files, browsers never query CelesTrak.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { ORBITAL_GROUPS, makeOrbitalSnapshot } from "../lib/orbitalCatalog.mjs";

const outputPath = "public/data/orbits.json";
const minimumInterval = 2 * 60 * 60 * 1000 + 15 * 60 * 1000;
const nowMs = Date.now();
try {
  const previous = JSON.parse(await readFile(outputPath, "utf8"));
  const age = nowMs - Date.parse(previous.fetchedAt);
  if (previous.version === 1 && previous.items?.length > 0 && Number.isFinite(age) && age >= 0 && age < minimumInterval) {
    console.log("Using previously fetched catalog: within 2h15m shared cache window");
    process.exit(0);
  }
} catch { /* First run has no published data; fetch once. */ }

const groups = [];
for (const group of ORBITAL_GROUPS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(group.url, {
      redirect: "manual", cache: "no-store", signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "WatchtowerLive/0.2 (GitHub Actions cached public orbital catalog)" }
    });
    // Provider policy: do not retry *any* HTTP failure or redirect; surface it for investigation.
    if (response.status !== 200) throw new Error("CelesTrak " + group.key + " returned HTTP " + response.status + "; stopping without retry");
    const content = await response.text();
    if (content.length > 3000000) throw new Error("Oversized CelesTrak " + group.key + " response");
    const payload = JSON.parse(content);
    if (!Array.isArray(payload)) throw new Error("CelesTrak returned unexpected " + group.key + " format");
    groups.push({ key: group.key, items: payload });
    console.log("Fetched " + group.key + ": " + payload.length + " orbital element entries");
  } finally {
    clearTimeout(timer);
  }
}
const snapshot = makeOrbitalSnapshot(groups, new Date(nowMs).toISOString());
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(snapshot) + "\n", "utf8");
console.log("Published " + snapshot.items.length + " unique non-ISS orbital elements at " + snapshot.fetchedAt);
