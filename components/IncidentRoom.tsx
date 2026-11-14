import { useState } from "react";
import { INCIDENT_CASES, buildIncidentBrief, isSafeIncidentUrl } from "../lib/incidentLedger.mjs";
import { EXPLORE_SOURCES } from "../lib/exploreCatalog.mjs";

const incident = INCIDENT_CASES[0];
const sourcesById = Object.fromEntries(incident.sources.map((item) => [item.id, item]));
const contextResources = incident.contextResourceIds.map((id) => EXPLORE_SOURCES.find((source) => source.id === id)).filter(Boolean);

function SourceLinks({ sourceIds }: { sourceIds: string[] }) {
  return <div className="incident-receipts">
    {sourceIds.map((id) => {
      const source = sourcesById[id];
      return source && isSafeIncidentUrl(source.url) ?
        <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} · {source.publishedDate} ↗</a> : null;
    })}
  </div>;
}

export function IncidentRoom() {
  const [view, setView] = useState<"timeline" | "evidence">("timeline");
  const [copyStatus, setCopyStatus] = useState("");
  const [showMethod, setShowMethod] = useState(false);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(buildIncidentBrief(incident));
      setCopyStatus("Incident brief copied with source receipts.");
    } catch {
      setCopyStatus("Clipboard permission unavailable. Open the source receipts to review the evidence.");
    }
  }

  return <section className="incident-room" aria-label="Incident Room">
    <div className="panel incident-hero">
      <div className="eyebrow">WATCHTOWER · INCIDENT ROOM</div>
      <div className="incident-hero-head">
        <div>
          <h2>{incident.title}</h2>
          <p>{incident.summary}</p>
          <span className="incident-state">Historical case · as reported {incident.phaseAsOf}</span>
        </div>
        <div className="incident-hero-actions">
          <button className="btn" type="button" onClick={copyBrief}>Copy sourced brief</button>
          <a className="federated-link" href={import.meta.env.BASE_URL + "data/incident-ledger.v1.json"} target="_blank" rel="noopener noreferrer">Open incident JSON ↗</a>
        </div>
      </div>
      <p className="small" role="status">{copyStatus}</p>
      <p className="small incident-warning">{incident.editorialNote}</p>
    </div>

    <div className="incident-facts">
      {incident.facts.map((fact) => <div className="panel incident-fact" key={fact.label}>
        <div className="small">{fact.label}</div>
        <strong>{fact.value}</strong>
        <span className="small">{fact.qualification}</span>
        <SourceLinks sourceIds={[fact.sourceId]}/>
      </div>)}
    </div>

    <div className="incident-switch" role="group" aria-label="Incident detail view">
      <button type="button" className={view === "timeline" ? "btn incident-active" : "btn"} aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>Timeline</button>
      <button type="button" className={view === "evidence" ? "btn incident-active" : "btn"} aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>Evidence sources</button>
    </div>
    {view === "timeline" ? <ol className="incident-timeline" aria-label="Documented event timeline">
      {incident.timeline.map((event) => <li className="panel incident-event" key={event.id}>
        <div className="incident-event-meta"><time dateTime={event.timestamp || event.date}>{event.displayAt}</time><span className={event.evidenceType === "preliminary_attributed" ? "incident-evidence preliminary" : "incident-evidence"}>{event.evidenceType === "preliminary_attributed" ? "Preliminary account" : event.evidenceType === "officially_confirmed" ? "Official confirmation" : "Officially reported"}</span></div>
        <h3>{event.label}</h3>
        <p>{event.detail}</p>
        <SourceLinks sourceIds={event.sourceIds}/>
      </li>)}
    </ol> :
    <div className="incident-source-grid">{incident.sources.map((source) =>
      <article className="panel incident-source" key={source.id}>
        <h3>{source.title}</h3>
        <p className="small">{source.publisher} · {source.publishedDate}</p>
        <p>Official account, published on the date shown. Read the original statement for wording and context.</p>
        <a href={source.url} target="_blank" rel="noopener noreferrer">Read source statement ↗</a>
      </article>)}</div>}
    <div className="panel incident-context">
      <div className="eyebrow">DISCOVERY TRAILS · CONTEXT ONLY</div>
      <h2>Explore the connected systems</h2>
      <p>These tools can help explore aviation, weather, global connectivity and time zones. They are <strong>not evidence about this specific outage</strong>, and they are not integrated Watchtower incident feeds.</p>
      <div className="incident-context-grid">{contextResources.map((resource) =>
        <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer">
          <strong>{resource.name} ↗</strong><span>{resource.description}</span>
        </a>)}</div>
    </div>
    <div className="panel panel-pad incident-method">
      <button className="btn" type="button" aria-expanded={showMethod} onClick={() => setShowMethod((value) => !value)}>{showMethod ? "Hide" : "Read"} evidence method</button>
      {showMethod && <div><h3>Receipts over conclusions</h3><p>The timeline is an editorial snapshot built from dated official statements, not archived flight tracks. It distinguishes exact reported times from date-only entries, and treats fault attribution as preliminary. Context links do not imply causation. No live feeds, saved locations or personal information are collected in Incident Room.</p></div>}
    </div>
  </section>;
}
