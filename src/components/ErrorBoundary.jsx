import { Component } from 'react';

/**
 * App-level error boundary (QA report recommendation #2, after BUG-018):
 * a single rendering bug must never take down the whole app with an
 * unrecoverable blank screen. Degrade to an inline error card with a
 * reload path, and log the error for diagnosis.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('FundOS UI error boundary caught:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 620, margin: '60px auto', padding: 24 }}>
        <div className="card" style={{ borderColor: 'var(--amber-600, #b45309)' }}>
          <h2>Something went wrong rendering this page</h2>
          <p className="hint">
            The rest of your data is safe — this is a display error, not a data
            loss. You can reload the page, or go back to your deal list.
          </p>
          <p className="hint" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { window.location.href = '/start'; }}
            >
              Back to deal list
            </button>
          </div>
        </div>
      </div>
    );
  }
}
