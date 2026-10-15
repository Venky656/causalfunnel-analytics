import { Component } from 'react';
import type { ReactNode } from 'react';

/** Shows crash details on screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[ui] crashed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border-l-4 border-red-500 bg-white p-6 shadow-sm">
          <p className="font-extrabold text-red-700">Something broke on this page</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-red-200">
            {String(this.state.error.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
