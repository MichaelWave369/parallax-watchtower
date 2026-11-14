import { useMemo, useState } from "react";
import {
  DISCOVERY_STORAGE_KEY, MAX_DISCOVERY_ITEMS, addCandidate, candidateFromLink,
  candidateFromSignal, createReviewPacket, encodeInbox, readInbox, receiptKey,
  setReviewNote, setReviewState
} from "../lib/incidentDiscovery.mjs";

type PublicSignal = {
  id: string; type: string; title: string; summary?: string; source: string;
  sourceUrl?: string; timestamp: string; confidence: string;
  privacyClass: string; magnitude?: number; facts?: Record<string, unknown>;
};
type Props = { signals: PublicSignal[] };
type Lead = {
  id: string; origin: string; signalType: string; title: string; summary: string;
  sourceName: string; sourceUrl: string; sourceTimestamp: string | null;
  capturedAt: string; status: string; reviewNote: string;
};

function loadLocalInbox(): Lead[] {
  try {
    return typeof window === "undefined" ? [] : readInbox(window.localStorage.getItem(DISCOVERY_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function DiscoveryInbox({ signals }: Props) {
  const [items, setItems] = useState<Lead[]>(loadLocalInbox);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  // Reuse Watchtower's already-loaded public signals. No new feed fetches occur here.
  const leads = useMemo(() => {
    const encountered = new Set<string>();
    return signals.map((signal) => candidateFromSignal(signal)).filter((lead): lead is NonNullable<ReturnType<typeof candidateFromSignal>> => {
      if (!lead) return false;
      const key = receiptKey(lead.sourceUrl);
      if (!key || encountered.has(key)) return false;
      encountered.add(key);
      return true;
    }).slice(0, 24);
  }, [signals]);
  const savedKeys = useMemo(() => new Set(items.map((item) => receiptKey(item.sourceUrl))), [items]);
  const shownItems = useMemo(() => filter === "all" ? items : items.filter((item) => item.status === filter), [items, filter]);

  function persist(next: Lead[]) {
    setItems(next);
    try {
      window.localStorage.setItem(DISCOVERY_STORAGE_KEY, encodeInbox(next));
    } catch {
      setMessage("Local storage is unavailable. Export the review packet before leaving this page.");
    }
  }

  function queue(lead: Lead) {
    try {
      const result = addCandidate(items, lead);
      persist(result.items);
      setMessage(result.added ? "Candidate saved locally for human review." : "That source receipt is already in the inbox.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the candidate.");
    }
  }

  function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const item = candidateFromLink({title, url: sourceUrl, summary});
      const result = addCandidate(items, item);
      persist(result.items);
      setMessage(result.added ? "Manual source saved for human review, not published." : "That source is already in the inbox.");
      if (result.added) { setTitle(""); setSourceUrl(""); setSummary(""); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to validate the source link.");
    }
  }

  function changeState(id: string, status: string) {
    try { persist(setReviewState(items, id, status)); setMessage("Review workflow updated locally. This does not verify an incident."); }
    catch { setMessage("Invalid review status."); }
  }

  function changeNote(id: string, text: string) {
    persist(setReviewNote(items, id, text));
  }

  function remove(id: string) {
    persist(items.filter((item) => item.id !== id));
    setMessage("Candidate removed from this browser's inbox.");
  }

  async function copyPacket() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(createReviewPacket(items), null, 2));
      setMessage("Human-review packet copied. Nothing was published or uploaded.");
    } catch {
      setMessage("Clipboard unavailable. Use Download review JSON instead.");
    }
  }

  function downloadPacket() {
    try {
      const packet = JSON.stringify(createReviewPacket(items), null, 2);
      const blob = new Blob([packet], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "watchtower-incident-review.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setMessage("Review packet downloaded locally. It is not a published incident.");
    } catch {
      setMessage("Download failed. Check browser download permissions.");
    }
  }

  return <section className="discovery-inbox" aria-label="Incident Discovery Inbox">
    <div className="panel discovery-hero">
      <div className="eyebrow">WATCHTOWER · HUMAN-IN-THE-LOOP DISCOVERY</div>
      <h2>Incident Discovery Inbox</h2>
      <p>Collect possible leads, verify the source yourself, and prepare a research packet. <strong>A candidate is not a confirmed incident.</strong> Nothing here is automatically published to Incident Room.</p>
      <div className="discovery-metrics">
        <span><strong>{leads.length}</strong> eligible public-signal leads</span>
        <span><strong>{items.length}</strong> locally saved</span>
        <span><strong>{items.filter((item) => item.status === "reviewing").length}</strong> reviewing</span>
      </div>
      <p className="small">Data comes from Watchtower's existing public feeds when reachable. News fallbacks, low-magnitude earthquakes, private/local data, orbit predictions and market records are excluded. This is not an emergency-alert service.</p>
    </div>

    <section className="panel discovery-section" aria-label="Source-linked candidates">
      <h3>Public-source leads</h3>
      <p className="small">USGS earthquakes M4.5+, NASA EONET wildfire references, and directly sourced public news. Click Queue to nominate a record; there is no automatic intake.</p>
      {leads.length === 0 ? <p className="discovery-muted" role="status">No eligible, source-linked records are available from this session's public feeds. You can still add a verified HTTPS source below.</p> :
      <div className="discovery-grid">{leads.map((lead) => {
        const saved = savedKeys.has(receiptKey(lead.sourceUrl));
        return <article className="discovery-card" key={lead.id}>
          <span className="discovery-kind">{lead.signalType} · source feed</span>
          <h4>{lead.title}</h4>
          <p>{lead.summary || "No additional details provided by the source."}</p>
          <div className="small">{lead.sourceName} · record time {new Date(lead.sourceTimestamp!).toLocaleString()}</div>
          <div className="discovery-actions">
            <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer">Read receipt ↗</a>
            <button type="button" className="btn" disabled={saved} onClick={() => queue(lead)}>{saved ? "In inbox" : "Queue for review"}</button>
          </div>
        </article>;
      })}</div>}
    </section>

    <section className="panel discovery-section" aria-label="Manual source nomination">
      <h3>Add a public source manually</h3>
      <p className="small">Useful for infrastructure disruptions that existing feeds do not cover. Supply an original source link; the publication date and cause are <strong>not inferred</strong>.</p>
      <form className="discovery-form" onSubmit={submitManual}>
        <label htmlFor="discovery-title">Research lead title</label>
        <input id="discovery-title" className="explore-search" value={title} maxLength={180} required onChange={(event) => setTitle(event.target.value)} placeholder="Example: FAA ground stop statement"/>
        <label htmlFor="discovery-url">Source URL (HTTPS)</label>
        <input id="discovery-url" className="explore-search" type="url" value={sourceUrl} required onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://www.faa.gov/newsroom/..." />
        <label htmlFor="discovery-summary">Context note (optional)</label>
        <textarea id="discovery-summary" className="discovery-textarea" value={summary} maxLength={700} onChange={(event) => setSummary(event.target.value)} placeholder="What should be checked? No unsupported root-cause assumptions." rows={3}/>
        <button type="submit" className="btn">Add to local inbox</button>
      </form>
    </section>

    <section className="panel discovery-section" aria-label="Local review queue">
      <div className="discovery-head">
        <div><h3>Review queue</h3><p className="small">Stored only in this browser, up to {MAX_DISCOVERY_ITEMS} items. Pending, Reviewing and Dismissed are workflow labels, not evidence ratings.</p></div>
        <div className="discovery-actions"><button type="button" className="btn" disabled={!items.length} onClick={copyPacket}>Copy review JSON</button>
          <button type="button" className="btn" disabled={!items.length} onClick={downloadPacket}>Download review JSON</button></div>
      </div>
      <div role="group" aria-label="Filter review queue" className="discovery-filters">
        {["all", "pending", "reviewing", "dismissed"].map((status) =>
          <button type="button" className={status === filter ? "explore-filter active" : "explore-filter"}
            aria-pressed={status === filter} key={status} onClick={() => setFilter(status)}>{status === "all" ? "All" : status[0].toUpperCase() + status.slice(1)}</button>)}
      </div>
      <p role="status" className="small">{message}</p>
      {!shownItems.length ? <p className="discovery-muted">No candidates in this view. Queue a public feed record or add a source above.</p> :
      <div className="discovery-saved-list">{shownItems.map((item) => <article className="discovery-saved" key={item.id}>
        <div className="discovery-head"><div><span className="discovery-kind">{item.status} · {item.origin}</span><h4>{item.title}</h4>
          <div className="small">{item.sourceName} · saved {new Date(item.capturedAt).toLocaleString()}</div></div>
          <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">Source receipt ↗</a></div>
        {item.summary && <p className="small">{item.summary}</p>}
        <label className="small" htmlFor={`review-note-${item.id}`}>Reviewer notes (local, unverified)</label>
        <textarea className="discovery-textarea" id={`review-note-${item.id}`} value={item.reviewNote} rows={2} maxLength={700} onChange={(event) => changeNote(item.id, event.target.value)} />
        <div className="discovery-actions">
          {item.status !== "reviewing" && <button type="button" className="btn" onClick={() => changeState(item.id, "reviewing")}>Mark reviewing</button>}
          {item.status !== "pending" && <button type="button" className="btn" onClick={() => changeState(item.id, "pending")}>Move to pending</button>}
          {item.status !== "dismissed" && <button type="button" className="btn" onClick={() => changeState(item.id, "dismissed")}>Dismiss lead</button>}
          <button type="button" className="btn" onClick={() => remove(item.id)}>Remove</button>
        </div>
      </article>)}</div>}
    </section>
    <p className="small">Export is an explicit local action. Neither case publication nor background monitoring is implemented; published Incident Room cases still require separately reviewed evidence.</p>
  </section>;
}
