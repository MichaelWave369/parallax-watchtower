import { useMemo, useState } from "react";
import { receiptKey } from "../lib/incidentDiscovery.mjs";
import { formatTemporalResearchBrief, groupTemporalTrails, makeTemporalResearchPacket } from "../lib/discoveryTrails.mjs";

type Lead = {
  id: string; origin: string; signalType: string; title: string; summary: string;
  sourceName: string; sourceUrl: string; sourceTimestamp: string | null;
  capturedAt: string; status: string; reviewNote: string;
};
type Props = {
  candidates: Lead[]; cacheState: string; generatedAt: string | null;
  savedKeys: Set<string | null>; onQueue: (lead: Lead) => void;
};

export function DiscoveryTrails({ candidates, cacheState, generatedAt, savedKeys, onQueue }: Props) {
  const [period, setPeriod] = useState<"day" | "week">("week");
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const windows = useMemo(() => groupTemporalTrails(candidates, period), [candidates, period]);
  const selected = windows.find((item) => item.id === selectedId) ??
    windows.find((item) => item.hasBothSources) ?? windows[0];
  const crossSourceWindows = windows.filter((item) => item.hasBothSources).length;

  async function copyResearchBrief() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(formatTemporalResearchBrief(selected, generatedAt));
      setMessage("Source-backed timeline copied. No incident was verified or published.");
    } catch {
      setMessage("Clipboard unavailable. You can download the research JSON instead.");
    }
  }

  function downloadResearchPacket() {
    if (!selected) return;
    try {
      const content = JSON.stringify(makeTemporalResearchPacket(selected, generatedAt), null, 2);
      const url = URL.createObjectURL(new Blob([content], {type: "application/json"}));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "watchtower-temporal-trail-" + selected.from + ".json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Unreviewed temporal research packet saved locally.");
    } catch {
      setMessage("Download unavailable. Confirm browser file permissions.");
    }
  }

  return <section className="panel discovery-section temporal-trails" aria-label="Cross-source discovery trails">
    <div className="eyebrow">WATCHTOWER · SOURCE-BACKED TIME LENS</div>
    <h3>Cross-source Discovery Trails</h3>
    <p className="small">Place official records side by side by <strong>UTC calendar date</strong> or <strong>Monday-to-Sunday UTC week</strong>. Matching a time window is <strong>not evidence of shared location, causation, or a connected incident.</strong></p>
    <p className="small">USGS timestamps represent reported earthquake records; NASA EONET timestamps refer to the latest curated event geometry, not necessarily wildfire ignition.</p>
    <div className="discovery-filters" role="group" aria-label="Trail time resolution">
      <button type="button" className={period === "week" ? "explore-filter active" : "explore-filter"}
        aria-pressed={period === "week"} onClick={() => { setPeriod("week"); setSelectedId(""); }}>UTC week</button>
      <button type="button" className={period === "day" ? "explore-filter active" : "explore-filter"}
        aria-pressed={period === "day"} onClick={() => { setPeriod("day"); setSelectedId(""); }}>UTC day</button>
    </div>
    {cacheState !== "fresh" && cacheState !== "partial" ? <p className="discovery-muted">
      No verified-fresh cached source snapshot is available for temporal browsing. The regular local review queue is unaffected.
    </p> : windows.length === 0 ? <p className="discovery-muted">No eligible records have a dated official source receipt in this cache.</p> : <>
      <p className="small" role="status">{windows.length} UTC windows · {crossSourceWindows} {crossSourceWindows === 1 ? "window contains" : "windows contain"} records from both provider families. This is temporal overlap only.</p>
      <div className="temporal-window-list" role="group" aria-label="Select a UTC record window">
        {windows.map((item) => <button type="button" key={item.id}
          className={selected?.id === item.id ? "temporal-window selected" : "temporal-window"}
          aria-pressed={selected?.id === item.id}
          onClick={() => { setSelectedId(item.id); setMessage(""); }}>
          <strong>{item.label}</strong>
          <span>USGS {item.counts.earthquake} · NASA {item.counts.wildfire}</span>
          <small>{item.hasBothSources ? "Two source families" : "One source family"}</small>
        </button>)}
      </div>
      {selected && <div className="temporal-detail">
        <div className="temporal-detail-head">
          <div>
            <h4>{selected.label}</h4>
            <p className="small">{selected.candidates.length} source-linked records. Source timestamps were grouped mechanically, not correlated geographically or causally.</p>
          </div>
          <div className="discovery-actions">
            <button type="button" className="btn" onClick={copyResearchBrief}>Copy sourced timeline</button>
            <button type="button" className="btn" onClick={downloadResearchPacket}>Download trail JSON</button>
          </div>
        </div>
        <p role="status" className="small">{message}</p>
        <div className="temporal-source-grid">
          {([{type: "earthquake", label: "USGS earthquakes", note: "Official event timestamps, threshold M4.5+"},
            {type: "wildfire", label: "NASA EONET wildfires", note: "Curated event geometry timestamps, not ignition or perimeter data"}] as const).map((provider) => {
            const records = selected.candidates.filter((item) => item.signalType === provider.type);
            return <div className="temporal-source-column" key={provider.type}>
              <div className="temporal-source-heading"><strong>{provider.label}</strong><span>{records.length} records</span></div>
              <p className="small">{provider.note}</p>
              {!records.length ? <p className="discovery-muted">No records from this provider in this UTC window.</p> :
                <div className="temporal-source-rows">{records.map((lead) => {
                  const saved = savedKeys.has(receiptKey(lead.sourceUrl));
                  return <article className="temporal-source-item" key={lead.id}>
                    <time dateTime={lead.sourceTimestamp ?? undefined}>{new Date(lead.sourceTimestamp!).toLocaleString()}</time>
                    <strong>{lead.title}</strong>
                    {lead.summary && <p className="small">{lead.summary}</p>}
                    <div className="discovery-actions">
                      <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer">Official receipt ↗</a>
                      <button className="btn" type="button" disabled={saved}
                        onClick={() => onQueue(lead)}>{saved ? "In inbox" : "Queue for review"}</button>
                    </div>
                  </article>;
                })}</div>}
            </div>;
          })}
        </div>
        <p className="small">Co-observed source records do not establish geographic proximity, interaction, increased risk, or shared root cause. Human review and independent evidence remain required before publishing an incident.</p>
      </div>}
    </>}
  </section>;
}
