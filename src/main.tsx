import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// A production bundle can build and still fail at runtime. Never make
// WATCHTOWER disappear into an unhelpful blank screen when that happens.
class AppCrashBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, details: React.ErrorInfo) {
    console.error("[WATCHTOWER] Application startup failure", error, details);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="shell" role="alert" style={{ maxWidth: 900, margin: "auto", paddingTop: 80 }}>
      <div className="panel panel-pad">
        <div className="eyebrow">WATCHTOWER LIVE · RECOVERY MODE</div>
        <h1 style={{ fontSize: "2rem", lineHeight: 1.2, marginTop: 16 }}>The dashboard hit a browser error.</h1>
        <p className="small">The sources and your saved settings have not been deleted. Try reloading. If the problem persists, share the error text below.</p>
        <pre className="error" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{this.state.error.message}</pre>
        <button className="btn" onClick={() => window.location.reload()}>Reload WATCHTOWER</button>
      </div>
    </main>;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("WATCHTOWER root element is missing");
createRoot(root).render(
  <React.StrictMode>
    <AppCrashBoundary><App /></AppCrashBoundary>
  </React.StrictMode>
);
