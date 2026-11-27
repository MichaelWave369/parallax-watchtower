import { useMemo, useState } from "react";
import { EXPLORE_CATEGORIES, EXPLORE_SOURCES, filterExploreSources } from "../lib/exploreCatalog.mjs";

export function ExplorePanel() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const results = useMemo<Array<(typeof EXPLORE_SOURCES)[number]>>(() => filterExploreSources(EXPLORE_SOURCES, { category, query }), [category, query]);
  const categoryLabels = useMemo(() => Object.fromEntries(EXPLORE_CATEGORIES.map((entry) => [entry.id, entry.label])), []);

  return <section className="explore-panel" aria-label="Explore source catalog">
    <div className="panel explore-intro">
      <div className="eyebrow">WATCHTOWER · EXPLORE</div>
      <h2>Explore the Knowledge Atlas</h2>
      <p>50 curated doors into the planet, history, space, art and science. Choose a category or search a topic. These open independent websites, not Watchtower live feeds.</p>
      <div className="explore-metrics"><span><strong>{EXPLORE_SOURCES.length}</strong> starting points</span><span><strong>{EXPLORE_CATEGORIES.length}</strong> knowledge fields</span><span>External sites · availability not checked</span></div>
    </div>
    <div className="explore-controls">
      <label htmlFor="explore-search">Search the catalog</label>
      <input id="explore-search" className="explore-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search NASA, old maps, music, cables..." autoComplete="off" />
      <div className="explore-filters" role="group" aria-label="Explore category">
        <button type="button" className={category === "all" ? "explore-filter active" : "explore-filter"} aria-pressed={category === "all"} onClick={() => setCategory("all")}>All 50</button>
        {EXPLORE_CATEGORIES.map((item) => <button type="button" key={item.id} className={category === item.id ? "explore-filter active" : "explore-filter"} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
      </div>
      <p className="small explore-count" role="status">{results.length} {results.length === 1 ? "resource" : "resources"} found</p>
    </div>
    {results.length ? <div className="explore-grid">{results.map((source) =>
      <article className="explore-card" key={source.id}>
        <div className="explore-card-top"><span className="explore-number">#{source.id}</span><span className="explore-category">{categoryLabels[source.category] || "Source"}</span></div>
        <h3>{source.name}</h3>
        <p>{source.description}</p>
        <div className="explore-card-footer">
          <span title="Linked site has not been health-checked">External · unverified</span>
          <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${source.name} in a new tab`}>Open site ↗</a>
        </div>
      </article>)}</div> :
      <div className="panel panel-pad explore-empty"><p>No matching resources. Try another term or category.</p><button className="btn" type="button" onClick={() => { setCategory("all"); setQuery(""); }}>Clear filters</button></div>}
    <p className="small explore-disclaimer">Source links are a research directory, not automated data feeds, safety alerts, endorsements or claims of current availability. Site policies and access conditions may change.</p>
  </section>;
}
