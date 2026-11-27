import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onCrash: (error: Error) => void };
type State = { failed: boolean };

// This boundary keeps the rest of WATCHTOWER visible if MapLibre fails during
// dynamic module import, initialization or rendering.
export class MapRenderBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[WATCHTOWER] Vector map unavailable", error);
    this.props.onCrash(error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
