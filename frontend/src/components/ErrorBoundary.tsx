import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Keeps a crash in one page from blanking the whole app; offers a retry instead. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card page-error" role="alert">
        <h1>Something went wrong on this page</h1>
        <p>Sorry — this part of NookSure hit an unexpected problem. Your saved plans aren’t affected.</p>
        <button type="button" className="button primary" onClick={this.retry}>
          Try again
        </button>
      </section>
    );
  }
}
