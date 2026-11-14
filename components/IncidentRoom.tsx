import { useMemo, useState } from "react";
import { INCIDENT_CASES, buildIncidentBrief, filterIncidentCases, isSafeIncidentUrl } from "../lib/incidentLedger.mjs";
import { EXPLORE_SOURCES } from "../lib/exploreCatalog.mjs";

function SourceLinks({ sourceIds, sourcesById }: {
  sourceIds: string[];
  sourcesById: Record<string, { id: string; url: string; publisher: string; publishedDate: string }>;
}) {
  return <div className="incident-receipts">
    {sourceIds.map((id) => {
      const source = sourcesById[id];
      return source && isSafeIncidentUrl(source.url) ?
        <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} · {source.publishedDate} ↗</a> : null;
    })}
  </div>;
}

export function IncidentRoom() {
  const [selectedCaseId, setSelectedCaseId] = useState(INCIDENT_CASES[0].id);
  const [caseQuery, setCaseQuery] = useState("");
  const [view, setView] = useState<"timeline" | "evidence">("timeline");
  const [copyStatus, setCopyStatus] = useState("");
  const [showMethod, setShowMethod] = useState(false);
  const incident = INCIDENT_CASES.find((record) => record.id === selectedCaseId) ?? INCIDENT_CASES[0];
  const sourcesById = useMemo(() => Object.fromEntries(incident.sources.map((item) => [item.id, item])), [incident]);
  const contextResources = useMemo(() => incident.contextResourceIds
    .map((id) => EXPLORE_SOURCES.find((source) => source.id === id)).filter(Boolean), [incident]);
  const related = useMemo(() => INCIDENT_CASES.filter((c) => incident.relatedCaseIds?.includes(c.id)), [incident]);
  const matches = useMemo(() => filterIncidentCases(INCIDENT_CASES, caseQuery), [caseQuery]);

  function openCase(id: string) {
    setSelectedCaseId(id);
    setView("timeline");
    setCopyStatus("");
  }
  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(buildIncidentBrief(incident));
      setCopyStatus("Incident brief copied with source receipts.");
    } catch {
      setCopyStatus("Clipboard unavailable. Open the source receipts to review the evidence.");
    }
  }

  return <section className="incident-room" aria-label="Incident Room">
    <section className="panel incident-library" aria-label="Incident case library">
      <div className="eyebrow">WATCHTOWER · INCIDENT LIBRARY</div>
      <h2>Explore documented disruptions</h2>
      <p>Two historical aviation incidents, traced through primary records. Each case has its own evidence, timestamps and qualifications. A shared category does not mean a shared cause.</p>
      <label htmlFor="incident-case-search">Find a historical case</label>
      <input id="incident-case-search" type="search" value={caseQuery} onChange={(event) => setCaseQuery(event.target.value)} placeholder="Search incident, date or system..." className="explore-search" />
      <div className="incident-case-grid">
        {matches.map((item) => <button type="button" key={item.id} className={item.id === incident.id ? "incident-case active" : "incident-case"}
          onClick={() => openCase(item.id)} aria-pressed={item.id === incident.id}>
          <span>{item.eventDate} · {item.region}</span>
          <strong>{item.title}</strong>
          <small>{item.systems.join(" · ")}</small>
          <em>{item.sources.length} source receipts · {item.timeline.length} timeline events</em>
        </button>)}
      </div>
      {!matches.length && <p role="status">No incidents match that search.</p>}
    </section>
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
        <div className="small">{fact.label}</div><strong>{fact.value}</strong>
        <span className="small">{fact.qualification}</span>
        <SourceLinks sourceIds={[fact.sourceId]} sourcesById={sourcesById}/>
      </div>)}
    </div>
    <div className="incident-switch" role="group" aria-label="Incident detail view">
      <button type="button" className={view === "timeline" ? "btn incident-active" : "btn"} aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>Timeline</button>
      <button type="button" className={view === "evidence" ? "btn incident-active" : "btn"} aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>Evidence sources</button>
    </div>
    {view === "timeline" ? <ol className="incident-timeline" aria-label="Documented event timeline">
      {incident.timeline.map((event) => <li className="panel incident-event" key={event.id}>
        <div className="incident-event-meta">
          <time dateTime={event.timestamp || event.date}>{event.displayAt}</time>
          <span className={event.evidenceType === "preliminary_attributed" ? "incident-evidence preliminary" : "incident-evidence"}>
            {event.evidenceType === "preliminary_attributed" ? "Preliminary account" : event.evidenceType === "officially_confirmed" ? "Official confirmation" : "Officially reported"}
          </span>
        </div>
        <h3>{event.label}</h3><p>{event.detail}</p>
        <SourceLinks sourceIds={event.sourceIds} sourcesById={sourcesById}/>
      </li>)}
    </ol> :
    <div className="incident-source-grid">{incident.sources.map((source) =>
      <article className="panel incident-source" key={source.id}>
        <h3>{source.title}</h3>
        <p className="small">{source.publisher} · {source.publishedDate}</p>
        <p>Read the dated original for exact wording, context and any limits in the findings.</p>
        <a href={source.url} target="_blank" rel="noopener noreferrer">Read source statement ↗</a>
      </article>)}</div>}
    {related.length > 0 && <section className="panel incident-compare" aria-label="Related historical cases">
      <div className="eyebrow">CROSS-CASE RESEARCH</div>
      <h2>Related events, separate investigations</h2>
      <p>{incident.comparisonNote}</p>
      {related.map((caseItem) => <button className="btn" type="button" key={caseItem.id} onClick={() => openCase(caseItem.id)}>
        Compare with {caseItem.eventDate}: {caseItem.title}
      </button>)}
    </section>}
    <div className="panel incident-context">
      <div className="eyebrow">DISCOVERY TRAILS · CONTEXT ONLY</div>
      <h2>Explore the connected systems</h2>
      <p>These tools help explore aviation, infrastructure, research and time zones. They are <strong>not evidence about this specific outage</strong> and not integrated Watchtower incident feeds.</p>
      <div className="incident-context-grid">{contextResources.map((resource) =>
        <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer">
          <strong>{resource.name} ↗</strong><span>{resource.description}</span>
        </a>)}</div>
    </div>
    <div className="panel panel-pad incident-method">
      <button className="btn" type="button" aria-expanded={showMethod} onClick={() => setShowMethod((value) => !value)}>{showMethod ? "Hide" : "Read"} evidence method</button>
      {showMethod && <div><h3>Receipts over conclusions</h3>
        <p>Case records are manually reviewed editorial snapshots, not live air traffic feeds. We label exact and approximate times, identify primary-source statements, distinguish preliminary conclusions, and keep contextual links separate from evidence. Shared symptoms do not establish shared root causes.</p>
      </div>}
    </div>
  </section>;
}
